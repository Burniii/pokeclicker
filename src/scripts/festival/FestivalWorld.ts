/// <reference path="../../declarations/DataStore/common/Saveable.d.ts" />
/// <reference path="./FestivalData.ts" />

type FestivalEnemy = { name: PokemonNameType, id: number, shiny: boolean, hp: number, maxHp: number };

// The Festival Archipelago runs in its own window next to the base game, like the Fusion world,
// but it uses the player's party and Poké Balls and every catch goes into the normal Pokédex.
class FestivalWorld implements Saveable {
    saveKey = 'festivalWorld';
    defaults: Record<string, any> = {};

    // The festival party gets half of the party attack, so it does not double the main game's progress
    public static readonly ATTACK_SHARE = 0.5;

    public area: KnockoutObservable<string> = ko.observable('plaza');
    public kills: KnockoutObservable<Record<string, number>> = ko.observable({});
    public announcedStages: KnockoutObservableArray<number> = ko.observableArray([]);

    // Runtime state (not saved)
    public enemy: KnockoutObservable<FestivalEnemy> = ko.observable(null);
    public catching: KnockoutObservable<boolean> = ko.observable(false);
    public ball: KnockoutObservable<GameConstants.Pokeball> = ko.observable(GameConstants.Pokeball.None);
    public log: KnockoutObservableArray<string> = ko.observableArray([]);
    private counter = 0;
    private catchCountdown = 0;

    // An island opens when its herald has been met (first step of its quest line)
    public stageUnlocked(n: number): boolean {
        const stage = FestivalData.stage(n);
        const line = App.game.quests.getQuestLine(stage?.questLine);
        return !!line && (line.state() === QuestLineState.ended || (line.state() === QuestLineState.started && line.curQuest() >= 1));
    }

    public unlocked = ko.pureComputed(() => this.stageUnlocked(1));

    public areaUnlocked(area: FestivalArea): boolean {
        if (!area || !this.stageUnlocked(area.stage)) {
            return false;
        }
        return !area.unlockKills || this.killsOn(area.unlockKills.area) >= area.unlockKills.kills;
    }

    public currentArea = ko.pureComputed(() => FestivalData.area(this.area()));
    public inTown = ko.pureComputed(() => this.currentArea()?.kind === 'town');
    public inBattle = ko.pureComputed(() => this.unlocked() && !this.inTown());

    public killsOn(id: string): number {
        return this.kills()[id] ?? 0;
    }

    public caughtOnStage(n: number): number {
        return FestivalData.stagePokemon(n).filter((name) => App.game.party.alreadyCaughtPokemonByName(name)).length;
    }

    public addLog(text: string) {
        this.log.unshift(text);
        if (this.log().length > 6) {
            this.log.pop();
        }
    }

    public goTo(id: string) {
        const area = FestivalData.area(id);
        if (!area || !this.areaUnlocked(area)) {
            return;
        }
        this.area(id);
        this.catching(false);
        this.counter = 0;
        this.enemy(null);
        if (area.kind !== 'town') {
            this.spawn();
        }
    }

    // Strength of the island: the last route of its main region
    private regionRoute(): { route: number, region: GameConstants.Region } {
        const region = FestivalData.stage(this.currentArea().stage).region;
        const routes = Routes.getRoutesByRegion(region);
        return { route: routes[routes.length - 1].number, region };
    }

    private spawn() {
        const area = this.currentArea();
        if (!area?.pokemon) {
            this.enemy(null);
            return;
        }
        const pool = area.rare?.length && Rand.chance(0.05) ? area.rare : area.pokemon;
        const name = Rand.fromArray(pool);
        const pokemon = pokemonMap[name];
        const { route, region } = this.regionRoute();
        const hp = Math.round(PokemonFactory.routeHealth(route, region) * (area.kind === 'cave' ? 1.5 : 1));
        const shiny = PokemonFactory.generateShiny(GameConstants.SHINY_CHANCE_BATTLE);
        PokemonHelper.incrementPokemonStatistics(pokemon.id, GameConstants.PokemonStatisticsType.Encountered, shiny, GameConstants.BattlePokemonGender.NoGender, GameConstants.ShadowStatus.None);
        this.enemy({ name, id: pokemon.id, shiny, hp, maxHp: hp });
    }

    public attack(): number {
        const enemy = this.enemy();
        if (!enemy) {
            return 0;
        }
        const types = pokemonMap[enemy.name].type;
        return Math.max(1, Math.round(App.game.party.calculatePokemonAttack(types[0], types[1] ?? PokemonType.None, true) * FestivalWorld.ATTACK_SHARE));
    }

    public clickAttack(): number {
        return Math.max(1, Math.round(App.game.party.calculateClickAttack() * FestivalWorld.ATTACK_SHARE));
    }

    public click() {
        if (!this.inBattle() || this.catching()) {
            return;
        }
        this.damage(this.clickAttack());
    }

    private damage(amount: number) {
        const enemy = this.enemy();
        if (!enemy) {
            return;
        }
        enemy.hp = Math.max(0, enemy.hp - amount);
        this.enemy.valueHasMutated();
        if (enemy.hp <= 0) {
            this.defeated(enemy);
        }
    }

    private defeated(enemy: FestivalEnemy) {
        const area = this.currentArea();
        const { route, region } = this.regionRoute();
        PokemonHelper.incrementPokemonStatistics(enemy.id, GameConstants.PokemonStatisticsType.Defeated, enemy.shiny, GameConstants.BattlePokemonGender.NoGender, GameConstants.ShadowStatus.None);
        App.game.wallet.gainMoney(PokemonFactory.routeMoney(route, region));
        const kills = { ...this.kills() };
        kills[area.id] = (kills[area.id] ?? 0) + 1;
        this.kills(kills);
        const ball = App.game.pokeballs.calculatePokeballToUse(enemy.id, enemy.shiny, false, EncounterType.route);
        if (ball !== GameConstants.Pokeball.None) {
            App.game.pokeballs.usePokeball(ball);
            this.ball(ball);
            this.catching(true);
            this.catchCountdown = Math.max(1, Math.round(App.game.pokeballs.calculateCatchTime(ball) / 100));
            return;
        }
        this.spawn();
    }

    public catchChance(): number {
        const enemy = this.enemy();
        if (!enemy) {
            return 0;
        }
        const base = PokemonFactory.catchRateHelper(pokemonMap[enemy.name].catchRate, true);
        if (this.ball() === GameConstants.Pokeball.None) {
            return base / 100;
        }
        const bonus = App.game.pokeballs.getCatchBonus(this.ball(), { pokemon: enemy.name, encounterType: EncounterType.route });
        return Math.min(100, base + bonus) / 100;
    }

    private finishCatch() {
        const enemy = this.enemy();
        const name = PokemonHelper.displayName(enemy.name);
        if (Rand.chance(this.catchChance())) {
            App.game.party.gainPokemonById(enemy.id, enemy.shiny);
            this.addLog(`${enemy.shiny ? '✨ ' : ''}${name} gefangen!`);
        } else {
            this.addLog(`${name} ist entkommen.`);
        }
        this.catching(false);
        this.spawn();
    }

    // Called from the base game tick (100 ms)
    public tick() {
        for (let n = 1; n <= FestivalData.STAGES.length; n++) {
            if (!this.announcedStages().includes(n) && this.stageUnlocked(n)) {
                this.announcedStages.push(n);
                Notifier.notify({
                    title: '🎪 Festival-Archipel',
                    message: n === 1
                        ? 'Die Fähre zum Festival-Archipel legt ab! Unter der Town Map gibt es jetzt die Festivalkarte und das Festivalfenster.'
                        : `${FestivalData.stage(n).island} ist jetzt geöffnet!`,
                    type: NotificationConstants.NotificationOption.info,
                    timeout: 30 * 1000,
                });
            }
        }
        if (!this.inBattle()) {
            return;
        }
        if (!this.areaUnlocked(this.currentArea())) {
            this.goTo('plaza');
            return;
        }
        if (!this.enemy()) {
            this.spawn();
        }
        if (this.catching()) {
            if (--this.catchCountdown <= 0) {
                this.finishCatch();
            }
            return;
        }
        if (++this.counter < 10) {
            return;
        }
        this.counter = 0;
        this.damage(this.attack());
    }

    toJSON(): Record<string, any> {
        return {
            area: this.area(),
            kills: this.kills(),
            announcedStages: this.announcedStages(),
        };
    }

    fromJSON(json: Record<string, any>): void {
        if (!json) {
            return;
        }
        this.area(FestivalData.area(json.area) ? json.area : 'plaza');
        this.kills(json.kills ?? {});
        this.announcedStages(json.announcedStages ?? []);
    }
}
