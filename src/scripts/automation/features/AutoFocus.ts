/// <reference path="../AutomationFeature.ts" />

type FocusAction =
    | { kind: 'route', region: GameConstants.Region, route: number, catchAll?: boolean, label: string }
    | { kind: 'gym', gym: Gym, label: string }
    | { kind: 'dungeon', dungeon: Dungeon, label: string }
    | { kind: 'idle', label: string };

type FocusMode = { id: string, name: string, unlocked: () => boolean, hint: string };

// "Focus on": moves the player to wherever the chosen goal progresses fastest and keeps working on it
class AutoFocus extends AutomationFeature {
    id = 'focus';
    name = 'Fokus';
    icon = '🎯';
    group: AutomationGroup = 'focus';
    description = 'Reist automatisch dorthin, wo das gewählte Ziel am schnellsten vorankommt, und arbeitet daran.';
    unlockHint = 'Besiege den Kanto-Champion. Weitere Ziele werden mit dem Fortschritt freigeschaltet.';
    interval = 1000;
    settingsTemplate = 'automationFocusSettingsTemplate';

    private static readonly FILTER_NAME = '🤖 Automatik';
    private lastAction: FocusAction = null;
    private lastPlanTime = 0;
    private announcedModes = new Set<string>();

    public static readonly modes: FocusMode[] = [
        { id: 'xp', name: 'Erfahrung', unlocked: () => true, hint: '' },
        { id: 'money', name: 'Geld', unlocked: () => true, hint: '' },
        { id: 'tokens', name: 'Dungeon-Tokens', unlocked: () => true, hint: '' },
        ...GameHelper.enumNumbers(PokemonType).filter((t) => t >= 0).map((t) => ({
            id: `gem:${t}`,
            name: `Edelsteine: ${PokemonType[t]}`,
            unlocked: () => App.game.gems.canAccess(),
            hint: 'Schalte die Edelsteine frei.',
        })),
        { id: 'quests', name: 'Tägliche Quests', unlocked: () => App.game.badgeCase.hasBadge(BadgeEnums.Elite_JohtoChampion), hint: 'Besiege den Johto-Champion.' },
        { id: 'achievements', name: 'Erfolge', unlocked: () => App.game.badgeCase.hasBadge(BadgeEnums.Elite_HoennChampion), hint: 'Besiege den Hoenn-Champion.' },
        {
            id: 'pokerus',
            name: 'Pokérus auskurieren',
            unlocked: () => App.game.keyItems.hasKeyItem(KeyItemType.Pokerus_virus) && App.game.badgeCase.hasBadge(BadgeEnums.Elite_SinnohChampion),
            hint: 'Erhalte das Pokérus-Virus und besiege den Sinnoh-Champion.',
        },
        {
            id: 'shadow',
            name: 'Crypto-Pokémon erlösen',
            unlocked: () => PurifyChamber.requirements.isCompleted(),
            hint: 'Schalte die Erlösungskammer in Orre frei.',
        },
    ];

    settingDefs: AutomationSettingDef[] = [
        { key: 'mode', label: '', type: 'select', default: 'xp' },
        { key: 'allRegions', label: 'Auch Routen anderer Regionen nutzen (sonst nur die aktuelle Region)', type: 'bool', default: false },
        {
            key: 'ball',
            label: 'Ball zum Fangen (für Tokens, Quests und Pokérus)',
            type: 'select',
            default: GameConstants.Pokeball.Ultraball,
            options: () => [GameConstants.Pokeball.Pokeball, GameConstants.Pokeball.Greatball, GameConstants.Pokeball.Ultraball, GameConstants.Pokeball.Masterball]
                .filter((b) => App.game.pokeballs.pokeballs[b]?.unlocked())
                .map((b) => ({ value: b, text: `${GameConstants.Pokeball[b]} (${App.game.pokeballs.getBallQuantity(b).toLocaleString('de-DE')})` })),
        },
        { key: 'manageFeatures', label: 'Für Quests passende Automatiken (Brutstätte, Untergrund, Farm) selbst einschalten', type: 'bool', default: true },
    ];

    public isUnlocked(): boolean {
        return App.game.badgeCase.hasBadge(BadgeEnums.Elite_KantoChampion);
    }

    public availableModes = ko.pureComputed(() => {
        App.game.automation.unlockedCount();
        return AutoFocus.modes.filter((m) => {
            try {
                return m.unlocked();
            } catch {
                return false;
            }
        });
    });

    public refreshModes(silent: boolean) {
        AutoFocus.modes.filter((m) => !m.id.startsWith('gem:')).forEach((m) => {
            let unlocked = false;
            try {
                unlocked = m.unlocked();
            } catch {
                unlocked = false;
            }
            if (unlocked && !this.announcedModes.has(m.id)) {
                this.announcedModes.add(m.id);
                if (!silent && this.unlocked() && m.id !== 'xp' && m.id !== 'money' && m.id !== 'tokens') {
                    App.game.automation.notify(`Neues Fokus-Ziel freigeschaltet: <b>${m.name}</b>`, NotificationConstants.NotificationOption.info, 15000);
                }
            }
        });
    }

    public onDisable() {
        this.removeFilter();
        this.lastAction = null;
    }

    public init() {
        super.init();
        this.settings.mode.subscribe(() => {
            this.lastAction = null;
            this.lastPlanTime = 0;
        });
    }

    // ---------- Combat estimates ----------

    private static damagePerSecond(region: GameConstants.Region, type1 = PokemonType.None, type2 = PokemonType.None): number {
        let dps = App.game.party.calculatePokemonAttack(type1, type2, false, region);
        const click = App.game.automation.feature('click');
        if (click.enabled() && click.unlocked()) {
            dps += App.game.party.calculateClickAttack() * (+click.setting('clicksPerSecond') || 0);
        }
        return Math.max(1, dps);
    }

    private static secondsPerKill(hp: number, dps: number): number {
        // Pokémon attack once per second, a new enemy appears right away
        return Math.max(1, Math.ceil(hp / dps));
    }

    private routes(): RegionRoute[] {
        const all = this.setting('allRegions');
        return Routes.regionRoutes.filter((r) => (all || r.region === player.region) && MapHelper.accessToRoute(r.number, r.region));
    }

    private bestRoute(score: (r: RegionRoute, killsPerSecond: number) => number): RegionRoute | null {
        let best: RegionRoute = null;
        let bestScore = 0;
        this.routes().forEach((r) => {
            const hp = PokemonFactory.routeHealth(r.number, r.region);
            const kps = 1 / AutoFocus.secondsPerKill(hp, AutoFocus.damagePerSecond(r.region));
            const s = score(r, kps);
            if (s > bestScore) {
                bestScore = s;
                best = r;
            }
        });
        return best;
    }

    private gymsInReach(): Gym[] {
        return Object.values(GymList).filter((g) => {
            const town = g.parent?.name ?? g.town;
            return g.isUnlocked() && TownList[town] && MapHelper.accessToTown(town)
                && (this.setting('allRegions') || TownList[town].region === player.region);
        });
    }

    private static gymSeconds(gym: Gym): number {
        const region = TownList[gym.parent?.name ?? gym.town]?.region ?? player.region;
        const list = gym.getPokemonList();
        return 2 + list.reduce((s, p) => {
            const data = pokemonMap[p.name];
            return s + AutoFocus.secondsPerKill(p.maxHealth, AutoFocus.damagePerSecond(region, data.type[0], data.type[1] ?? PokemonType.None));
        }, 0);
    }

    // ---------- Planning ----------

    private routeAction(r: RegionRoute, label: string, catchAll = false): FocusAction {
        return { kind: 'route', region: r.region, route: r.number, catchAll, label: `${label}: ${Routes.getName(r.number, r.region)}` };
    }

    private planXp(): FocusAction {
        const r = this.bestRoute((route, kps) => PokemonFactory.routeLevel(route.number, route.region) * kps);
        return r ? this.routeAction(r, 'Erfahrung') : { kind: 'idle', label: 'Keine passende Route gefunden.' };
    }

    private planMoney(): FocusAction {
        const r = this.bestRoute((route, kps) => PokemonFactory.routeMoney(route.number, route.region, false) * kps);
        const routeRate = r ? PokemonFactory.routeMoney(r.number, r.region, false) / AutoFocus.secondsPerKill(PokemonFactory.routeHealth(r.number, r.region), AutoFocus.damagePerSecond(r.region)) : 0;
        let bestGym: Gym = null;
        let gymRate = 0;
        this.gymsInReach().forEach((g) => {
            const rate = g.moneyReward / AutoFocus.gymSeconds(g);
            if (rate > gymRate) {
                gymRate = rate;
                bestGym = g;
            }
        });
        if (bestGym && gymRate > routeRate) {
            return { kind: 'gym', gym: bestGym, label: `Geld: Arena ${bestGym.leaderName}` };
        }
        return r ? this.routeAction(r, 'Geld') : { kind: 'idle', label: 'Keine passende Route gefunden.' };
    }

    private planTokens(): FocusAction {
        // Every capture gives tokens, catching takes about a second extra
        const r = this.bestRoute((route, kps) => PokemonFactory.routeDungeonTokens(route.number, route.region) / (1 / kps + 1));
        return r ? this.routeAction(r, 'Dungeon-Tokens', true) : { kind: 'idle', label: 'Keine passende Route gefunden.' };
    }

    private typeShare(names: PokemonNameType[], type: PokemonType): number {
        if (!names.length) {
            return 0;
        }
        return names.filter((n) => (pokemonMap[n]?.type as PokemonType[] ?? []).includes(type)).length / names.length;
    }

    private planGems(type: PokemonType, prefix = 'Edelsteine'): FocusAction {
        const r = this.bestRoute((route, kps) => this.typeShare(RouteHelper.getAvailablePokemonList(route.number, route.region), type) * kps);
        const routeRate = r ? this.typeShare(RouteHelper.getAvailablePokemonList(r.number, r.region), type)
            / AutoFocus.secondsPerKill(PokemonFactory.routeHealth(r.number, r.region), AutoFocus.damagePerSecond(r.region)) : 0;
        let bestGym: Gym = null;
        let gymRate = 0;
        this.gymsInReach().forEach((g) => {
            const count = g.getPokemonList().filter((p) => (pokemonMap[p.name].type as PokemonType[]).includes(type)).length;
            const rate = count / AutoFocus.gymSeconds(g);
            if (rate > gymRate) {
                gymRate = rate;
                bestGym = g;
            }
        });
        if (bestGym && gymRate >= routeRate) {
            return { kind: 'gym', gym: bestGym, label: `${prefix} (${PokemonType[type]}): Arena ${bestGym.leaderName}` };
        }
        return r && routeRate > 0 ? this.routeAction(r, `${prefix} (${PokemonType[type]})`) : { kind: 'idle', label: `Kein Ort mit ${PokemonType[type]}-Pokémon erreichbar.` };
    }

    private dungeonAction(name: string, label: string): FocusAction {
        const dungeon = dungeonList[name];
        if (!dungeon || !TownList[name] || !MapHelper.accessToTown(name) || !dungeon.isUnlocked()) {
            return { kind: 'idle', label: `${label}: ${name} ist nicht erreichbar.` };
        }
        return { kind: 'dungeon', dungeon, label: `${label}: ${name}` };
    }

    private gymAction(townKey: string, label: string): FocusAction {
        const gym = GymList[townKey];
        const town = gym?.parent?.name ?? gym?.town;
        if (!gym || !gym.isUnlocked() || !TownList[town] || !MapHelper.accessToTown(town)) {
            return { kind: 'idle', label: `${label}: ${townKey} ist nicht erreichbar.` };
        }
        return { kind: 'gym', gym, label: `${label}: Arena ${gym.leaderName}` };
    }

    private enableFeature(id: string) {
        const f = App.game.automation.feature(id);
        if (this.setting('manageFeatures') && f?.unlocked() && !f.enabled()) {
            f.enabled(true);
            App.game.automation.notify(`Für eine Quest eingeschaltet: ${f.icon} ${f.name}`);
        }
    }

    private planQuests(): FocusAction {
        const quests = App.game.quests;
        quests.questList().forEach((q, i) => {
            if (q.isCompleted() && !q.claimed()) {
                quests.claimQuest(i);
            }
        });
        // Start the quests that the automation can work on best
        const rank = (q: Quest) => {
            if (q instanceof DefeatPokemonsQuest || q instanceof CapturePokemonsQuest || q instanceof GainMoneyQuest || q instanceof GainTokensQuest) {
                return 0;
            }
            if (q instanceof GainGemsQuest || q instanceof CapturePokemonTypesQuest || q instanceof DefeatGymQuest || q instanceof DefeatDungeonQuest) {
                return 1;
            }
            if (q instanceof HatchEggsQuest || q instanceof MineItemsQuest || q instanceof MineLayersQuest || q instanceof HarvestBerriesQuest || q instanceof GainFarmPointsQuest) {
                return 2;
            }
            return 3;
        };
        let guard = 0;
        while (quests.canStartNewQuest() && guard++ < 10) {
            const open = quests.questList().map((q, i) => ({ q, i })).filter(({ q }) => !q.inProgress() && !q.isCompleted() && !q.claimed());
            if (!open.length) {
                break;
            }
            open.sort((a, b) => rank(a.q) - rank(b.q));
            quests.beginQuest(open[0].i);
        }
        const active = quests.currentQuests().filter((q) => !q.isCompleted());
        if (!active.length) {
            return quests.allQuestClaimed() ? { kind: 'idle', label: 'Alle Quests für heute erledigt.' } : this.planXp();
        }
        // Passive quests are handled by the other automations
        active.forEach((q) => {
            if (q instanceof HatchEggsQuest) {
                this.enableFeature('hatchery');
            } else if (q instanceof MineItemsQuest || q instanceof MineLayersQuest) {
                this.enableFeature('mine');
            } else if (q instanceof HarvestBerriesQuest || q instanceof GainFarmPointsQuest) {
                this.enableFeature('farm');
            }
        });
        for (const q of active.sort((a, b) => rank(a) - rank(b))) {
            if (q instanceof DefeatPokemonsQuest) {
                const r = Routes.getRoute(q.region, q.route);
                if (r && MapHelper.accessToRoute(q.route, q.region)) {
                    return this.routeAction(r, 'Quest');
                }
            } else if (q instanceof CapturePokemonsQuest) {
                return { ...this.planTokens(), label: 'Quest: Pokémon fangen' } as FocusAction;
            } else if (q instanceof CapturePokemonTypesQuest) {
                const a = this.planGems(q.type, 'Quest: fangen');
                if (a.kind === 'route') {
                    return { ...a, catchAll: true };
                }
            } else if (q instanceof GainGemsQuest) {
                return this.planGems((q as any).type as PokemonType, 'Quest');
            } else if (q instanceof GainMoneyQuest) {
                return this.planMoney();
            } else if (q instanceof GainTokensQuest) {
                return this.planTokens();
            } else if (q instanceof DefeatGymQuest) {
                const a = this.gymAction(q.gymTown, 'Quest');
                if (a.kind !== 'idle') {
                    return a;
                }
            } else if (q instanceof DefeatDungeonQuest) {
                const a = this.dungeonAction(q.dungeon, 'Quest');
                if (a.kind !== 'idle') {
                    return a;
                }
            }
        }
        return { ...this.planXp(), label: 'Quests laufen nebenbei · Erfahrung sammeln' } as FocusAction;
    }

    private planAchievements(): FocusAction {
        const open = AchievementHandler.achievementList.filter((a) => !a.isCompleted() && a.achievable());
        for (const a of open) {
            const req = a.property;
            if (req instanceof RouteKillRequirement) {
                const r = Routes.getRoute(req.region, req.route);
                if (r && MapHelper.accessToRoute(req.route, req.region) && (this.setting('allRegions') || req.region === player.region)) {
                    return this.routeAction(r, `Erfolg „${a.name}“`);
                }
            } else if (req instanceof ClearGymRequirement) {
                const town = GameConstants.RegionGyms.flat()[req.gymIndex];
                const action = this.gymAction(town, `Erfolg „${a.name}“`);
                if (action.kind === 'gym' && (this.setting('allRegions') || TownList[action.gym.parent?.name ?? action.gym.town]?.region === player.region)) {
                    return action;
                }
            } else if (req instanceof ClearDungeonRequirement) {
                const name = GameConstants.RegionDungeons.flat()[req.dungeonIndex];
                const action = this.dungeonAction(name, `Erfolg „${a.name}“`);
                if (action.kind !== 'idle' && (this.setting('allRegions') || TownList[name]?.region === player.region)) {
                    return action;
                }
            }
        }
        return { kind: 'idle', label: 'Keine Routen-, Arena- oder Dungeon-Erfolge in dieser Region offen.' };
    }

    private planPokerus(): FocusAction {
        // Contagious Pokémon need 50 EVs to become resistant; EVs come from catching their species
        const targets = new Set(App.game.party.caughtPokemon
            .filter((p) => p.pokerus === GameConstants.Pokerus.Infected || p.pokerus === GameConstants.Pokerus.Contagious)
            .map((p) => p.name));
        if (!targets.size) {
            return { kind: 'idle', label: 'Kein Pokémon mit aktivem Pokérus.' };
        }
        const r = this.bestRoute((route, kps) => RouteHelper.getAvailablePokemonList(route.number, route.region).filter((n) => targets.has(n)).length * kps);
        return r ? this.routeAction(r, `Pokérus (${targets.size} Arten)`, true) : { kind: 'idle', label: 'Keine Route mit infizierten Arten erreichbar.' };
    }

    private planShadow(): FocusAction {
        const chamber = App.game.purifyChamber;
        const shadow = App.game.party.caughtPokemon.filter((p) => p.shadow === GameConstants.ShadowStatus.Shadow);
        if (!shadow.length) {
            return { kind: 'idle', label: 'Keine Crypto-Pokémon mehr zu erlösen.' };
        }
        if (chamber.currentFlow() >= chamber.flowNeeded()) {
            chamber.selectedPokemon(shadow[0]);
            if (chamber.canPurify()) {
                chamber.purify();
                App.game.automation.notify(`${shadow[0].displayName} wurde erlöst.`, NotificationConstants.NotificationOption.success);
            }
        }
        return { ...this.planXp(), label: `Crypto: ${shadow.length} übrig · Flow ${chamber.currentFlow()} / ${chamber.flowNeeded()}` } as FocusAction;
    }

    private plan(): FocusAction {
        const mode: string = this.setting('mode');
        const m = AutoFocus.modes.find((x) => x.id === mode);
        if (!m || !m.unlocked()) {
            return { kind: 'idle', label: 'Dieses Ziel ist noch nicht freigeschaltet.' };
        }
        if (mode.startsWith('gem:')) {
            return this.planGems(+mode.slice(4));
        }
        switch (mode) {
            case 'money': return this.planMoney();
            case 'tokens': return this.planTokens();
            case 'quests': return this.planQuests();
            case 'achievements': return this.planAchievements();
            case 'pokerus': return this.planPokerus();
            case 'shadow': return this.planShadow();
            default: return this.planXp();
        }
    }

    // ---------- Execution ----------

    private ensureFilter(on: boolean) {
        const filters = App.game.pokeballFilters;
        const existing = filters.list().find((f) => f.name === AutoFocus.FILTER_NAME);
        if (!on) {
            this.removeFilter();
            return;
        }
        const ball = +this.setting('ball') as GameConstants.Pokeball;
        if (existing) {
            existing.ball(ball);
            return;
        }
        const filter = new PokeballFilter(AutoFocus.FILTER_NAME, {}, ball as any, true);
        Settings.getSetting('catchFilters.invertPriorityOrder').observableValue() ? filters.list.push(filter) : filters.list.unshift(filter);
    }

    public removeFilter() {
        const filters = App.game.pokeballFilters;
        filters.list().filter((f) => f.name === AutoFocus.FILTER_NAME).forEach((f) => filters.list.remove(f));
    }

    private inForeignInstance(): boolean {
        const state = App.game.gameState;
        return state === GameConstants.GameState.safari || state === GameConstants.GameState.battleFrontier || state === GameConstants.GameState.temporaryBattle;
    }

    public run() {
        if (this.inForeignInstance()) {
            this.status('Pausiert, solange du in der Safari, der Kampfzone oder einem Sonderkampf bist.');
            return;
        }
        // Quest and achievement plans change often, the others are recalculated every 30 seconds
        const mode: string = this.setting('mode');
        const replanEvery = mode === 'quests' || mode === 'achievements' || mode === 'shadow' ? 5000 : 30000;
        const state = App.game.gameState;
        const busy = state === GameConstants.GameState.gym || state === GameConstants.GameState.dungeon;
        if (!busy && (!this.lastAction || Date.now() - this.lastPlanTime > replanEvery)) {
            this.lastAction = this.plan();
            this.lastPlanTime = Date.now();
        }
        const action = this.lastAction;
        if (!action) {
            return;
        }
        this.status(action.label);
        this.ensureFilter(action.kind === 'route' && !!action.catchAll);
        switch (action.kind) {
            case 'route':
                if (busy) {
                    return;
                }
                if (player.route !== action.route || player.region !== action.region || state !== GameConstants.GameState.fighting) {
                    MapHelper.moveToRoute(action.route, action.region);
                }
                break;
            case 'gym': {
                if (state === GameConstants.GameState.gym) {
                    return;
                }
                const town = action.gym.parent?.name ?? action.gym.town;
                if (state === GameConstants.GameState.dungeon) {
                    return;
                }
                if (player.town?.name !== town || state !== GameConstants.GameState.town) {
                    MapHelper.moveToTown(town);
                    return;
                }
                action.gym.protectedOnclick();
                break;
            }
            case 'dungeon': {
                const dungeonFeature = App.game.automation.feature<AutoDungeon>('dungeon');
                if (state === GameConstants.GameState.dungeon) {
                    dungeonFeature.explore();
                    return;
                }
                if (state === GameConstants.GameState.gym) {
                    return;
                }
                if (player.town?.name !== action.dungeon.name || state !== GameConstants.GameState.town) {
                    MapHelper.moveToTown(action.dungeon.name);
                    return;
                }
                if (App.game.keyItems.hasKeyItem(KeyItemType.Dungeon_ticket) && DungeonRunner.hasEnoughTokens(action.dungeon)) {
                    DungeonRunner.initializeDungeon(action.dungeon);
                } else {
                    this.status(`${action.label} · nicht genug Dungeon-Tokens`);
                }
                break;
            }
        }
    }

    // The dungeon automation runs its own exploration; avoid double moves when both are on
    public get handlesDungeon(): boolean {
        return this.enabled() && this.unlocked() && this.lastAction?.kind === 'dungeon';
    }
}
