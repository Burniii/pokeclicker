/// <reference path="../../declarations/TemporaryScriptTypes.d.ts" />

type DashboardSample = { time: number, values: Record<string, number> };
type DashboardRegionProgress = {
    name: string,
    parts: Array<{ label: string, done: number, total: number }>,
};

// Progress per region, efficiency over the last hour and estimated time for the current quests
class Dashboard {
    public static readonly rateStats = [
        { key: 'totalPokemonDefeated', label: 'Pokémon defeated' },
        { key: 'totalPokemonCaptured', label: 'Pokémon captured' },
        { key: 'totalPokemonHatched', label: 'Eggs hatched' },
        { key: 'totalShinyPokemonCaptured', label: 'Shinies captured' },
        { key: 'totalMoney', label: 'Pokédollars' },
        { key: 'totalDungeonTokens', label: 'Dungeon Tokens' },
        { key: 'totalQuestPoints', label: 'Quest Points' },
        { key: 'totalFarmPoints', label: 'Farm Points' },
    ];

    private static readonly SAMPLE_INTERVAL = 30 * 1000;
    private static readonly WINDOW = 60 * 60 * 1000;
    private static samples = ko.observableArray<DashboardSample>([]);
    private static questSamples = new WeakMap<Quest, Array<{ time: number, progress: number }>>();
    private static timer: ReturnType<typeof setInterval>;

    public static initialize() {
        Dashboard.sample();
        clearInterval(Dashboard.timer);
        Dashboard.timer = setInterval(() => Dashboard.sample(), Dashboard.SAMPLE_INTERVAL);
    }

    private static sample() {
        const now = Date.now();
        const values: Record<string, number> = {};
        Dashboard.rateStats.forEach(({ key }) => values[key] = App.game.statistics[key]());
        const samples = Dashboard.samples().filter((s) => now - s.time <= Dashboard.WINDOW);
        samples.push({ time: now, values });
        Dashboard.samples(samples);

        Dashboard.trackedQuests().forEach((quest) => {
            const list = (Dashboard.questSamples.get(quest) ?? []).filter((s) => now - s.time <= Dashboard.WINDOW);
            list.push({ time: now, progress: quest.progress() });
            Dashboard.questSamples.set(quest, list);
        });
    }

    private static trackedQuests(): Quest[] {
        const quests: Quest[] = [...App.game.quests.currentQuests()];
        App.game.quests.questLines().filter((ql) => ql.state() == QuestLineState.started).forEach((ql) => {
            const quest = ql.curQuestObject();
            if (quest instanceof MultipleQuestsQuest) {
                quests.push(...quest.quests.filter((q) => !q.isCompleted()));
            } else if (quest instanceof Quest && !quest.isCompleted()) {
                quests.push(quest);
            }
        });
        return quests;
    }

    // Per hour over the recent samples (up to one hour)
    public static recentRate(key: string): number | undefined {
        const samples = Dashboard.samples();
        if (samples.length < 2) {
            return undefined;
        }
        const first = samples[0];
        const last = samples[samples.length - 1];
        const hours = (last.time - first.time) / (60 * 60 * 1000);
        return hours > 0 ? (last.values[key] - first.values[key]) / hours : undefined;
    }

    public static lifetimeRate(key: string): number | undefined {
        const hours = App.game.statistics.secondsPlayed() / 3600;
        return hours > 0 ? App.game.statistics[key]() / hours : undefined;
    }

    public static measuredMinutes = ko.pureComputed(() => {
        const samples = Dashboard.samples();
        return samples.length < 2 ? 0 : Math.round((samples[samples.length - 1].time - samples[0].time) / 60000);
    });

    public static formatRate(rate?: number): string {
        if (rate == undefined || !isFinite(rate)) {
            return '–';
        }
        return `${Math.round(rate).toLocaleString('en-US')} / h`;
    }

    public static questEstimates = ko.pureComputed(() => {
        Dashboard.samples(); // refresh with every sample
        return Dashboard.trackedQuests().map((quest) => {
            const list = Dashboard.questSamples.get(quest) ?? [];
            const progress = quest.progress();
            let eta = '–';
            if (list.length >= 2) {
                const first = list[0];
                const perMs = (progress - first.progress) / (Date.now() - first.time);
                if (perMs > 0) {
                    eta = GameConstants.formatTimeShortWords(((1 - progress) / perMs));
                }
            }
            return {
                quest,
                questLine: quest.parentQuestLine?.displayName ?? (quest.inQuestLine ? '' : 'Daily quest'),
                description: quest.description,
                progress,
                eta,
            };
        });
    });

    public static regionProgress = ko.pureComputed((): DashboardRegionProgress[] => {
        const regions = GameHelper.enumNumbers(GameConstants.Region).filter((r) => r >= 0 && r <= player.highestRegion());
        const caught = App.game.party.caughtPokemon;
        return regions.map((region) => {
            const native = (p: PartyPokemon) => p.id > 0 && PokemonHelper.calcNativeRegion(p.name) === region;
            const caughtSpecies = new Set(caught.filter(native).map((p) => Math.floor(p.id))).size;
            const shinySpecies = new Set(caught.filter((p) => native(p) && p.shiny).map((p) => Math.floor(p.id))).size;
            const species = PokemonHelper.calcUniquePokemonsByRegion(region);
            const gyms = GameConstants.RegionGyms[region] ?? [];
            const badges = gyms.filter((g) => GymList[g] && App.game.badgeCase.hasBadge(GymList[g].badgeReward)).length;
            const dungeons = GameConstants.RegionDungeons[region] ?? [];
            const cleared = dungeons.filter((d) => App.game.statistics.dungeonsCleared[GameConstants.getDungeonIndex(d)]() > 0).length;
            const routes = Routes.getRoutesByRegion(region);
            const routesDone = routes.filter((r) => App.game.statistics.routeKills[region][r.number]() >= GameConstants.ROUTE_KILLS_NEEDED).length;
            return {
                name: GameConstants.camelCaseToString(GameConstants.Region[region]),
                parts: [
                    { label: 'Pokédex', done: caughtSpecies, total: species },
                    { label: 'Shiny', done: shinySpecies, total: species },
                    { label: 'Gyms', done: badges, total: gyms.length },
                    { label: 'Dungeons', done: cleared, total: dungeons.length },
                    { label: 'Routes', done: routesDone, total: routes.length },
                ],
            };
        });
    });
}
