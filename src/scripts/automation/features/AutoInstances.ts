/// <reference path="../AutomationFeature.ts" />

// Repeats a gym of the current town
class AutoGym extends AutomationFeature {
    id = 'gym';
    name = 'Arena wiederholen';
    icon = '🏟️';
    group: AutomationGroup = 'instances';
    description = 'Fordert eine Arena der aktuellen Stadt immer wieder heraus (z. B. für Edelsteine oder Quests).';
    unlockHint = 'Erhalte den Quellorden (Cascade Badge).';
    interval = 500;
    private runs = 0;

    settingDefs: AutomationSettingDef[] = [
        {
            key: 'gym',
            label: 'Arena',
            type: 'select',
            default: '',
            options: () => [{ value: '', text: 'Erste freigeschaltete Arena der Stadt' }, ...AutoGym.gymsHere().map((g) => ({ value: g.town, text: g.displayName ?? g.leaderName }))],
        },
        { key: 'stopAfter', label: 'Nach so vielen Kämpfen aufhören (0 = endlos)', type: 'number', default: 0, min: 0 },
    ];

    public static gymsHere(): Gym[] {
        return (player.town?.content ?? []).filter((c) => c instanceof Gym && c.isUnlocked()) as Gym[];
    }

    public isUnlocked(): boolean {
        return App.game.badgeCase.hasBadge(BadgeEnums.Cascade);
    }

    public onEnable() {
        this.runs = 0;
    }

    public run() {
        if (App.game.gameState === GameConstants.GameState.gym) {
            return;
        }
        if (App.game.automation.feature('focus')?.active()) {
            this.status('Pausiert, solange der Fokus aktiv ist.');
            return;
        }
        if (App.game.gameState !== GameConstants.GameState.town) {
            this.status('Wartet, bis du in einer Stadt mit Arena bist.');
            return;
        }
        const gyms = AutoGym.gymsHere();
        const gym = gyms.find((g) => g.town === this.setting('gym')) ?? gyms[0];
        if (!gym) {
            this.status('In dieser Stadt gibt es keine freigeschaltete Arena.');
            return;
        }
        const limit = +this.setting('stopAfter') || 0;
        if (limit > 0 && this.runs >= limit) {
            this.enabled(false);
            App.game.automation.notify(`Arena-Automatik beendet nach ${this.runs} Kämpfen.`);
            return;
        }
        this.runs++;
        this.status(`Kampf ${this.runs}${limit ? ` / ${limit}` : ''} gegen ${gym.leaderName}`);
        gym.protectedOnclick();
    }
}

// Explores dungeons tile by tile, opens chests, fights and restarts as long as tokens last
class AutoDungeon extends AutomationFeature {
    id = 'dungeon';
    name = 'Dungeon';
    icon = '🗝️';
    group: AutomationGroup = 'instances';
    description = 'Betritt den Dungeon der aktuellen Stadt, erkundet ihn, öffnet Truhen, besiegt den Boss und startet neu.';
    unlockHint = 'Besiege den Kanto-Champion.';
    interval = 150;
    private runs = 0;

    private static readonly tiers: LootTier[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

    settingDefs: AutomationSettingDef[] = [
        {
            key: 'chests',
            label: 'Truhen öffnen',
            type: 'select',
            default: 'common',
            options: () => [
                { value: 'common', text: 'Alle' },
                { value: 'rare', text: 'Ab selten' },
                { value: 'epic', text: 'Ab episch' },
                { value: 'legendary', text: 'Ab legendär' },
                { value: 'none', text: 'Keine' },
            ],
        },
        { key: 'avoidFights', label: 'Mit Taschenlampe Kämpfen ausweichen, wenn möglich', type: 'bool', default: false },
        { key: 'fast', label: 'Schnell: direkt zum Boss bzw. zur Leiter, sobald gefunden', type: 'bool', default: false },
        {
            key: 'stopWhen',
            label: 'Aufhören, wenn …',
            type: 'select',
            default: 'never',
            options: () => [
                { value: 'never', text: 'nie (bis die Tokens ausgehen)' },
                { value: 'caught', text: 'alle Pokémon des Dungeons gefangen sind' },
                { value: 'shiny', text: 'alle Pokémon des Dungeons schillernd gefangen sind' },
            ],
        },
        { key: 'stopAfter', label: 'Nach so vielen Durchläufen aufhören (0 = endlos)', type: 'number', default: 0, min: 0 },
    ];

    public isUnlocked(): boolean {
        return App.game.badgeCase.hasBadge(BadgeEnums.Elite_KantoChampion);
    }

    public onEnable() {
        this.runs = 0;
    }

    public run() {
        const focus = App.game.automation.feature<AutoFocus>('focus');
        if (App.game.gameState === GameConstants.GameState.dungeon) {
            if (!focus?.handlesDungeon) {
                this.explore();
            }
            return;
        }
        if (focus?.active()) {
            this.status('Pausiert, solange der Fokus aktiv ist.');
            return;
        }
        if (App.game.gameState !== GameConstants.GameState.town || !(player.town instanceof DungeonTown)) {
            this.status('Wartet, bis du in einem Dungeon-Ort bist.');
            return;
        }
        const dungeon = player.town.dungeon;
        const stopWhen = this.setting('stopWhen');
        if ((stopWhen === 'caught' && DungeonRunner.dungeonCompleted(dungeon, false)) || (stopWhen === 'shiny' && DungeonRunner.dungeonCompleted(dungeon, true))) {
            this.enabled(false);
            App.game.automation.notify(`${dungeon.name}: Ziel erreicht, die Dungeon-Automatik wurde beendet.`, NotificationConstants.NotificationOption.success);
            return;
        }
        const limit = +this.setting('stopAfter') || 0;
        if (limit > 0 && this.runs >= limit) {
            this.enabled(false);
            App.game.automation.notify(`Dungeon-Automatik beendet nach ${this.runs} Durchläufen.`);
            return;
        }
        if (!App.game.keyItems.hasKeyItem(KeyItemType.Dungeon_ticket) || !dungeon.isUnlocked() || !DungeonRunner.hasEnoughTokens(dungeon)) {
            this.status('Nicht genug Dungeon-Tokens (oder Dungeon gesperrt).');
            return;
        }
        this.runs++;
        this.status(`Durchlauf ${this.runs}${limit ? ` / ${limit}` : ''}: ${dungeon.name}`);
        DungeonRunner.initializeDungeon(dungeon);
    }

    public wantChest(tile: DungeonTile): boolean {
        const min = this.setting('chests');
        if (min === 'none') {
            return false;
        }
        const tier = tile.metadata?.tier ?? 'common';
        return AutoDungeon.tiers.indexOf(tier) >= AutoDungeon.tiers.indexOf(min);
    }

    public explore() {
        // A hired dungeon guide explores on its own
        if (DungeonGuides.hired() || DungeonRunner.fighting() || DungeonRunner.fightingBoss() || DungeonBattle.catching() || DungeonRunner.dungeonFinished()) {
            return;
        }
        const map = DungeonRunner.map;
        const floor = map.playerPosition().floor;
        const tiles = map.board()[floor].flat();
        const current = map.currentTile();
        if (current.type() === GameConstants.DungeonTileType.chest && this.wantChest(current)) {
            DungeonRunner.openChest();
            return;
        }
        const reachable = (t: DungeonTile) => !t.hasPlayer && map.hasAccessToTile(t.position);
        const isLastFloor = floor >= map.floorSizes.length - 1;
        const exitType = isLastFloor ? GameConstants.DungeonTileType.boss : GameConstants.DungeonTileType.ladder;
        const exit = tiles.find((t) => t.isVisible && t.type() === exitType);

        const goTo = (t: DungeonTile) => {
            map.moveToTile(t.position);
            const type = t.type();
            if (type === GameConstants.DungeonTileType.chest && this.wantChest(t)) {
                DungeonRunner.openChest();
            } else if (type === GameConstants.DungeonTileType.boss || type === GameConstants.DungeonTileType.ladder) {
                DungeonRunner.handleInteraction();
            }
        };

        if (this.setting('fast') && exit && (reachable(exit) || exit.hasPlayer)) {
            exit.hasPlayer ? DungeonRunner.handleInteraction() : goTo(exit);
            return;
        }
        const chest = tiles.find((t) => t.isVisible && t.type() === GameConstants.DungeonTileType.chest && this.wantChest(t) && reachable(t));
        if (chest) {
            goTo(chest);
            return;
        }
        const avoid = this.setting('avoidFights') && !!(map as any).flash;
        if (!avoid) {
            const enemy = tiles.find((t) => t.isVisible && t.type() === GameConstants.DungeonTileType.enemy && reachable(t));
            if (enemy) {
                goTo(enemy);
                return;
            }
        }
        // Explore: prefer unvisited tiles with many unvisited neighbours, avoid known enemies when asked to
        const unvisited = tiles.filter((t) => !t.isVisited && reachable(t)
            && !(t.isVisible && (t.type() === exitType || (avoid && t.type() === GameConstants.DungeonTileType.enemy))));
        if (unvisited.length) {
            const score = (t: DungeonTile) => map.nearbyTiles(t.position).filter((n) => !n.isVisited).length;
            goTo(unvisited.sort((a, b) => score(b) - score(a))[0]);
            return;
        }
        if (exit) {
            exit.hasPlayer ? DungeonRunner.handleInteraction() : goTo(exit);
            return;
        }
        // Only avoided enemies are left between us and the exit
        const anyEnemy = tiles.find((t) => t.isVisible && t.type() === GameConstants.DungeonTileType.enemy && reachable(t));
        if (anyEnemy) {
            goTo(anyEnemy);
        }
    }
}

// Keeps running the Battle Frontier from the last checkpoint
class AutoBattleFrontier extends AutomationFeature {
    id = 'frontier';
    name = 'Kampfzone';
    icon = '🏯';
    group: AutomationGroup = 'instances';
    description = 'Startet die Kampfzone (Battle Frontier) nach einer Niederlage automatisch vom letzten Checkpoint neu.';
    unlockHint = 'Schalte die Kampfzone frei (Hoenn).';
    interval = 1000;

    public isUnlocked(): boolean {
        return App.game.battleFrontier.canAccess();
    }

    public run() {
        if (App.game.gameState !== GameConstants.GameState.battleFrontier) {
            this.status('Wartet, bis du die Kampfzone betrittst.');
            return;
        }
        this.status(`Stufe ${BattleFrontierRunner.stage()} · Rekord ${BattleFrontierRunner.highest()}`);
        if (!BattleFrontierRunner.started()) {
            BattleFrontierRunner.start(true);
        }
    }
}

// Walks through the Safari Zone, catches new or shiny Pokémon and collects items
class AutoSafari extends AutomationFeature {
    id = 'safari';
    name = 'Safari-Zone';
    icon = '🦒';
    group: AutomationGroup = 'instances';
    description = 'Läuft in der Safari-Zone herum, fängt Pokémon und sammelt Gegenstände ein.';
    unlockHint = 'Erhalte den Safari-Pass und besiege den Kanto-Champion.';
    interval = 300;

    settingDefs: AutomationSettingDef[] = [
        {
            key: 'catch',
            label: 'Pokémon fangen',
            type: 'select',
            default: 'new',
            options: () => [
                { value: 'new', text: 'Nur neue und schillernde' },
                { value: 'all', text: 'Alle' },
            ],
        },
        { key: 'bait', label: 'Vor dem Werfen einmal Köder werfen (wenn vorhanden)', type: 'bool', default: false },
        { key: 'items', label: 'Gegenstände auf der Karte einsammeln', type: 'bool', default: true },
        { key: 'restart', label: 'Neue Safari starten, wenn die Bälle aufgebraucht sind', type: 'bool', default: false },
    ];
    private baited = false;

    public isUnlocked(): boolean {
        return App.game.keyItems.hasKeyItem(KeyItemType.Safari_ticket) && App.game.badgeCase.hasBadge(BadgeEnums.Elite_KantoChampion);
    }

    private static position(): { x: number, y: number } {
        return (Safari as any).playerXY;
    }

    private static walkable(x: number, y: number): boolean {
        return y >= 0 && y < Safari.grid.length && x >= 0 && x < Safari.grid[y].length
            && GameConstants.SAFARI_LEGAL_WALK_BLOCKS.includes(Safari.grid[y][x]);
    }

    private static encounterTile(x: number, y: number): boolean {
        const tile = Safari.grid[y]?.[x];
        return tile === GameConstants.SafariTile.grass || GameConstants.SAFARI_WATER_BLOCKS.includes(tile);
    }

    public run() {
        if (App.game.gameState !== GameConstants.GameState.safari) {
            this.status('Wartet, bis du die Safari-Zone betrittst.');
            return;
        }
        if (!Safari.inProgress()) {
            if (this.setting('restart')) {
                (Safari as any).payEntranceFee();
            }
            this.status('Safari beendet.');
            return;
        }
        if (Safari.inBattle()) {
            this.battle();
            return;
        }
        this.baited = false;
        if (Safari.isMoving || Safari.walking) {
            return;
        }
        this.walk();
    }

    private wanted(pokemon: SafariPokemon): boolean {
        return this.setting('catch') === 'all' || pokemon.shiny || !App.game.party.alreadyCaughtPokemonByName(pokemon.name);
    }

    private battle() {
        if (SafariBattle.busy() || !SafariBattle.enemy) {
            return;
        }
        const enemy = SafariBattle.enemy;
        if (!this.wanted(enemy)) {
            SafariBattle.run();
            return;
        }
        if (this.setting('bait') && !this.baited && SafariBattle.selectedBait().amount() > 0) {
            this.baited = true;
            SafariBattle.throwBait();
            return;
        }
        SafariBattle.throwBall();
        this.status(`Wirft Bälle auf ${enemy.displayName ?? enemy.name}${enemy.shiny ? ' ✨' : ''} · ${Safari.balls()} Bälle übrig`);
    }

    private walk() {
        const pos = AutoSafari.position();
        const key = (x: number, y: number) => `${x},${y}`;
        const pokemon = new Set(Safari.pokemonGrid().filter((p) => this.wanted(p)).map((p) => key(p.x, p.y)));
        const items = new Set(this.setting('items') ? Safari.itemGrid().map((i) => key(i.x, i.y)) : []);
        // Breadth first search to the closest wanted Pokémon, item or encounter tile
        const from = new Map<string, string>();
        const queue: [number, number][] = [[pos.x, pos.y]];
        from.set(key(pos.x, pos.y), null);
        let goal: string = null;
        let fallback: string = null;
        while (queue.length && !goal) {
            const [x, y] = queue.shift();
            const k = key(x, y);
            if (k !== key(pos.x, pos.y)) {
                if (pokemon.has(k) || items.has(k)) {
                    goal = k;
                    break;
                }
                if (!fallback && AutoSafari.encounterTile(x, y)) {
                    fallback = k;
                }
            }
            for (const [nx, ny] of Rand.shuffleArray([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])) {
                const nk = key(nx, ny);
                if (!from.has(nk) && AutoSafari.walkable(nx, ny)) {
                    from.set(nk, k);
                    queue.push([nx, ny]);
                }
            }
        }
        const target = goal ?? fallback;
        if (!target) {
            return;
        }
        let step = target;
        while (from.get(step) && from.get(step) !== key(pos.x, pos.y)) {
            step = from.get(step);
        }
        const [sx, sy] = step.split(',').map(Number);
        const dir = sx > pos.x ? 'right' : sx < pos.x ? 'left' : sy > pos.y ? 'down' : 'up';
        Safari.move(dir);
        Safari.stop(dir);
        this.status(`${Safari.balls()} Bälle übrig${goal ? (pokemon.has(goal) ? ' · läuft zu einem Pokémon' : ' · holt einen Gegenstand') : ' · sucht im Gras'}`);
    }
}
