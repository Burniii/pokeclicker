// "What am I missing?" - lists uncaught Pokémon with their known sources
type MissingPokemonSource = {
    text: string,
    // true = reachable now, false = locked, undefined = unknown
    available?: boolean,
    // why it is locked
    hint?: string,
};

type MissingPokemonEntry = {
    id: number,
    name: PokemonNameType,
    sources: MissingPokemonSource[],
    availableNow: boolean,
};

class MissingPokemon {
    // -1 = all regions up to the highest reached one
    public static region = ko.observable<GameConstants.Region>(-1);
    public static shiny = ko.observable<boolean>(false);
    public static includeForms = ko.observable<boolean>(false);
    public static onlyAvailable = ko.observable<boolean>(false);
    public static list = ko.observableArray<MissingPokemonEntry>([]);

    public static initialize() {
        $('#missingPokemonModal').on('show.bs.modal', () => MissingPokemon.refresh());
        MissingPokemon.region.subscribe(() => MissingPokemon.refresh());
        MissingPokemon.shiny.subscribe(() => MissingPokemon.refresh());
        MissingPokemon.includeForms.subscribe(() => MissingPokemon.refresh());
    }

    public static regionOptions(): Array<{ id: GameConstants.Region, name: string }> {
        const regions = GameHelper.enumNumbers(GameConstants.Region)
            .filter((r) => r >= 0 && r <= player.highestRegion())
            .map((r) => ({ id: r, name: GameConstants.camelCaseToString(GameConstants.Region[r]) }));
        return [{ id: -1, name: 'All regions' }, ...regions];
    }

    public static visibleList = ko.pureComputed(() => {
        const list = MissingPokemon.list();
        return MissingPokemon.onlyAvailable() ? list.filter((e) => e.availableNow) : list;
    });

    public static availableCount = ko.pureComputed(() => MissingPokemon.list().filter((e) => e.availableNow).length);

    public static refresh() {
        const maxRegion = player.highestRegion();
        const region = MissingPokemon.region();
        const shiny = MissingPokemon.shiny();
        const caught = (name: PokemonNameType) => App.game.party.alreadyCaughtPokemonByName(name, shiny);

        const candidates = pokemonList.filter((p) => {
            const native = PokemonHelper.calcNativeRegion(p.name);
            return p.id > 0 && native <= maxRegion && (region < 0 || native === region);
        });

        let missing: typeof candidates;
        if (MissingPokemon.includeForms()) {
            missing = candidates.filter((p) => !caught(p.name));
        } else {
            // A species counts as caught once any of its forms is caught (same as the region achievements)
            const caughtSpecies = new Set(candidates.filter((p) => caught(p.name)).map((p) => Math.floor(p.id)));
            const shown = new Set<number>();
            missing = candidates.filter((p) => {
                const species = Math.floor(p.id);
                if (caughtSpecies.has(species) || shown.has(species)) {
                    return false;
                }
                shown.add(species);
                return true;
            });
        }

        const entries = missing.map((p) => {
            const sources = MissingPokemon.getSources(p.name, maxRegion);
            return {
                id: p.id,
                name: p.name,
                sources,
                availableNow: sources.some((s) => s.available === true),
            };
        });
        entries.sort((a, b) => (Number(b.availableNow) - Number(a.availableNow)) || (a.id - b.id));
        MissingPokemon.list(entries);
    }

    private static req(requirement?: Requirement | { isCompleted: () => boolean }): boolean {
        return requirement?.isCompleted?.() ?? true;
    }

    private static townUnlocked(name: string): boolean | undefined {
        return TownList[name]?.isUnlocked();
    }

    public static getSources(name: PokemonNameType, maxRegion: GameConstants.Region): MissingPokemonSource[] {
        const sources: MissingPokemonSource[] = [];
        // hints are only built for locked sources, some requirement hints need runtime data
        const add = (text: string, available?: boolean, hint?: () => string | undefined) => {
            let reason: string;
            if (available === false && hint) {
                try {
                    reason = hint();
                } catch {
                    reason = undefined;
                }
            }
            sources.push({ text, available, hint: reason });
        };
        const regionName = (r: number) => GameConstants.camelCaseToString(GameConstants.Region[r]);

        const routes = PokemonLocations.getPokemonRegionRoutes(name, maxRegion) ?? {};
        Object.entries(routes).forEach(([region, list]) => {
            (list as Array<{ route: number, requirements?: Requirement }>).forEach(({ route, requirements }) => {
                add(Routes.getName(route, +region, true), MapHelper.accessToRoute(route, +region) && MissingPokemon.req(requirements),
                    () => (MapHelper.accessToRoute(route, +region) ? requirements?.hint() : 'Route not unlocked yet.'));
            });
        });

        const dungeonSources: Array<[Array<object>, string]> = [
            [PokemonLocations.getPokemonDungeons(name, maxRegion), ''],
            [PokemonLocations.getPokemonBossDungeons(name, maxRegion), 'Boss: '],
            [PokemonLocations.getPokemonChestDungeons(name, maxRegion), 'Chest: '],
        ];
        dungeonSources.forEach(([list, prefix]) => {
            const seen = new Set<string>();
            (list as Array<{ dungeon: string, requirements?: Requirement }>).forEach(({ dungeon, requirements }) => {
                if (seen.has(dungeon)) {
                    return;
                }
                seen.add(dungeon);
                add(`${prefix}${dungeon}`, !!MissingPokemon.townUnlocked(dungeon) && MissingPokemon.req(requirements),
                    () => (MissingPokemon.townUnlocked(dungeon) ? requirements?.hint() : 'Dungeon not unlocked yet.'));
            });
        });

        PokemonLocations.getShadowPokemonDungeons(name, maxRegion).forEach((dungeon) => add(`Shadow: ${dungeon}`, !!MissingPokemon.townUnlocked(dungeon)));

        PokemonLocations.getPokemonPrevolution(name, maxRegion).forEach((evo) => {
            if (!EvolutionInfo.isRelevant(evo)) {
                return;
            }
            const level = EvolutionInfo.requiredLevel(evo);
            const stone = (evo as StoneEvoData).stone;
            const method = evo.trigger === EvoTrigger.STONE
                ? ItemList[GameConstants.StoneType[stone]]?.displayName ?? GameConstants.humanifyString(GameConstants.StoneType[stone])
                : (level ? `Lv. ${level}` : 'level up');
            const owned = App.game.party.alreadyCaughtPokemonByName(evo.basePokemon);
            const unmet = EvolutionInfo.conditions(evo).filter((r) => !r.isCompleted());
            add(`Evolve ${PokemonHelper.displayName(evo.basePokemon)} (${method})`, owned && !unmet.length, () => [
                ...(owned ? [] : [`${PokemonHelper.displayName(evo.basePokemon)} needs to be owned.`]),
                ...unmet.map((r) => r.hint()),
            ].join(' '));
        });

        PokemonLocations.getPokemonParents(name, maxRegion).forEach((parent: PokemonNameType) => add(`Breed ${PokemonHelper.displayName(parent)}`, App.game.party.alreadyCaughtPokemonByName(parent)));
        [...new Set(PokemonLocations.getPokemonEggs(name, maxRegion))].forEach((egg) => add(`${GameConstants.humanifyString(egg)} egg`));
        PokemonLocations.getPokemonShops(name, maxRegion).forEach((town) => add(`Shop: ${town}`, MissingPokemon.townUnlocked(town)));
        PokemonLocations.getPokemonRoamingRegions(name, maxRegion).forEach((r: { region: number, requirements?: Requirement, roamingGroup?: { name: string } }) => {
            add(`Roaming: ${r.roamingGroup?.name ?? regionName(r.region)}`, r.region <= maxRegion && MissingPokemon.req(r.requirements), () => r.requirements?.hint());
        });
        PokemonLocations.getPokemonGifts(name, maxRegion).forEach((g: { town: string, npc: string, requirements?: Requirement }) => {
            add(`Gift: ${g.npc} (${g.town})`, !!MissingPokemon.townUnlocked(g.town) && MissingPokemon.req(g.requirements),
                () => (MissingPokemon.townUnlocked(g.town) ? g.requirements?.hint() : 'Town not unlocked yet.'));
        });
        PokemonLocations.getPokemonTrades(name, maxRegion).forEach((town) => add(`Trade: ${town}`, MissingPokemon.townUnlocked(town)));
        PokemonLocations.getPokemonTempBattleReward(name).forEach((battle) => add(`Battle reward: ${battle}`));
        PokemonLocations.getPokemonGymReward(name).forEach((leader) => add(`Gym reward: ${leader}`));
        PokemonLocations.getPokemonDungeonReward(name).forEach((dungeon) => add(`Dungeon reward: ${dungeon}`));
        PokemonLocations.getPokemonQuestLineReward(name).forEach((quest) => add(`Quest: ${quest}`));

        Object.keys(PokemonLocations.getPokemonSafariChance(name) ?? {}).map(Number).filter((r) => r <= maxRegion)
            .forEach((r) => add(`Safari Zone (${regionName(r)})`));
        Object.keys(PokemonLocations.getPokemonSafariItem(name, maxRegion) ?? {}).forEach((r) => add(`Safari item (${regionName(+r)})`));
        PokemonLocations.getPokemonWandering(name, maxRegion).forEach((berry) => add(berry === 'Always' ? 'Farm wanderer' : `Farm wanderer (${berry} Berry)`));
        [...new Set(PokemonLocations.getPokemonDreamOrbs(name, maxRegion))].forEach((orb) => add(`Dream Orb: ${orb}`));
        if (Object.keys(PokemonLocations.getBattleCafeCombination(name, maxRegion) ?? {}).length) {
            add('Battle Café');
        }
        PokemonLocations.getPokemonBattleFrontier(name).forEach((stage) => add(`Battle Frontier stage ${stage}`));
        return sources;
    }
}
