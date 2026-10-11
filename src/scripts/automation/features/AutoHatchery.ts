/// <reference path="../AutomationFeature.ts" />

// Hatches finished eggs and refills the free egg slots with the best Pokémon according to the chosen priorities
class AutoHatchery extends AutomationFeature {
    id = 'hatchery';
    name = 'Brutstätte';
    icon = '🥚';
    group: AutomationGroup = 'basis';
    description = 'Brütet fertige Eier aus und füllt freie Plätze mit Lv100-Pokémon oder Eiern aus dem Inventar.';
    unlockHint = 'Schalte die Brutstätte frei und besiege den Kanto-Champion.';
    interval = 1000;

    settingDefs: AutomationSettingDef[] = [
        { key: 'useEggs', label: 'Eier aus dem Inventar nutzen (nur wenn sie neue Pokémon bringen können)', type: 'bool', default: true },
        {
            key: 'sortBy',
            label: 'Sortieren nach',
            type: 'select',
            default: SortOptions.breedingEfficiency,
            options: () => Object.keys(SortOptionConfigs).map((k) => ({ value: +k, text: SortOptionConfigs[k].text })),
        },
        { key: 'descending', label: 'Absteigend sortieren', type: 'bool', default: true },
        {
            key: 'type',
            label: 'Typ bevorzugen',
            type: 'select',
            default: -1,
            options: () => [{ value: -1, text: 'Egal' }, ...GameHelper.enumNumbers(PokemonType).filter((t) => t >= 0).map((t) => ({ value: t, text: PokemonType[t] }))],
        },
        {
            key: 'category',
            label: 'Kategorie bevorzugen',
            type: 'select',
            default: -1,
            options: () => [{ value: -1, text: 'Egal' }, ...PokemonCategories.categories().map((c) => ({ value: c.id, text: c.name() }))],
        },
        {
            key: 'region',
            label: 'Herkunftsregion bevorzugen',
            type: 'select',
            default: -1,
            options: () => [
                { value: -1, text: 'Egal' }, ...GameHelper.enumNumbers(GameConstants.Region)
                    .filter((r) => r >= 0 && r <= GameConstants.MAX_AVAILABLE_REGION)
                    .map((r) => ({ value: r, text: GameConstants.camelCaseToString(GameConstants.Region[r]) })),
            ],
        },
        { key: 'notShinyFirst', label: 'Noch nicht schillernde Pokémon zuerst', type: 'bool', default: false },
        { key: 'alternateFormsLast', label: 'Alternative Formen zuletzt', type: 'bool', default: false },
        { key: 'megaFirst', label: 'Pokémon mit noch fehlender Mega-Entwicklung zuerst', type: 'bool', default: false },
        { key: 'spreadPokerus', label: 'Pokérus verbreiten (ansteckende + passende Pokémon zusammen brüten)', type: 'bool', default: true },
        { key: 'useQueue', label: 'Auch die Warteschlange füllen', type: 'bool', default: false },
    ];

    public isUnlocked(): boolean {
        return App.game.breeding.canAccess() && App.game.badgeCase.hasBadge(BadgeEnums.Elite_KantoChampion);
    }

    public run() {
        const breeding = App.game.breeding;
        for (let i = breeding.eggList.length - 1; i >= 0; i--) {
            breeding.hatchPokemonEgg(i);
        }
        if (this.setting('useEggs')) {
            this.addEggs();
        }
        const hasSlot = () => breeding.hasFreeEggSlot() || (this.setting('useQueue') && breeding.hasFreeQueueSlot());
        if (!hasSlot()) {
            return;
        }
        const added: string[] = [];
        for (const pokemon of this.pokemonToBreed()) {
            if (!hasSlot()) {
                break;
            }
            if (breeding.addPokemonToHatchery(pokemon)) {
                added.push(pokemon.displayName);
            }
        }
        if (added.length) {
            this.status(`Zuletzt hinzugefügt: ${added.join(', ')}`);
            App.game.automation.notify(`${added.join(', ')} ${added.length > 1 ? 'wurden' : 'wurde'} in die Brutstätte gelegt.`);
        }
    }

    private eggTypesBreeding(): Set<number> {
        const types = new Set<number>();
        App.game.breeding.eggList.forEach((e) => {
            const egg = e();
            if (!egg.isNone()) {
                types.add(egg.pokemonType1);
                types.add(egg.pokemonType2);
            }
        });
        return types;
    }

    private addEggs() {
        GameHelper.enumStrings(GameConstants.EggItemType).forEach((name) => {
            const item = ItemList[name] as EggItem;
            if (!item || !App.game.breeding.hasFreeEggSlot() || player.itemList[name]() <= 0) {
                return;
            }
            if (item.getCaughtStatus() !== CaughtStatus.NotCaught || !item.checkCanUse()) {
                return;
            }
            const type = PokemonType[name.split('_')[0]];
            if (type !== undefined && this.eggTypesBreeding().has(type)) {
                return;
            }
            if (item.use()) {
                App.game.automation.notify(`${item.displayName} in die Brutstätte gelegt.`);
            }
        });
    }

    private hasMissingMega(p: PartyPokemon): boolean {
        return !!p.evolutions?.some((evo) => evo.restrictions?.some((r) => r instanceof MegaEvolveRequirement)
            && !App.game.party.alreadyCaughtPokemonByName(evo.evolvedPokemon));
    }

    private sorted(list: PartyPokemon[]): PartyPokemon[] {
        const config = SortOptionConfigs[this.setting('sortBy')] ?? SortOptionConfigs[SortOptions.breedingEfficiency];
        const direction = this.setting('descending') ? -1 : 1;
        const type = +this.setting('type');
        const category = +this.setting('category');
        const region = +this.setting('region');
        const score = (p: PartyPokemon): number[] => [
            type >= 0 && (pokemonMap[p.name].type as PokemonType[]).includes(type) ? 0 : 1,
            category >= 0 && p.category.includes(category) ? 0 : 1,
            region >= 0 && PokemonHelper.calcNativeRegion(p.name) === region ? 0 : 1,
            this.setting('megaFirst') && this.hasMissingMega(p) ? 0 : 1,
            this.setting('notShinyFirst') && !p.shiny ? 0 : 1,
            this.setting('alternateFormsLast') && !Number.isInteger(p.id) ? 1 : 0,
        ];
        const values = new Map(list.map((p) => [p, { score: score(p), value: config.getValue(p) }]));
        return [...list].sort((a, b) => {
            const va = values.get(a);
            const vb = values.get(b);
            for (let i = 0; i < va.score.length; i++) {
                if (va.score[i] !== vb.score[i]) {
                    return va.score[i] - vb.score[i];
                }
            }
            if (va.value === vb.value) {
                return 0;
            }
            return (va.value > vb.value ? 1 : -1) * direction;
        });
    }

    private pokemonToBreed(): PartyPokemon[] {
        const breedable = App.game.party.caughtPokemon.filter((p) => !p.breeding && p.level >= 100 && !Activities.isAway(p.id));
        const sorted = this.sorted(breedable);
        const pokerusUnlocked = App.game.keyItems.hasKeyItem(KeyItemType.Pokerus_virus);
        if (!pokerusUnlocked || !this.setting('spreadPokerus')) {
            return sorted;
        }
        const uninfected = sorted.filter((p) => p.pokerus === GameConstants.Pokerus.Uninfected);
        const spreaders = sorted.filter((p) => p.pokerus >= GameConstants.Pokerus.Contagious);
        if (!uninfected.length) {
            return sorted;
        }
        const typesOf = (p: PartyPokemon) => pokemonMap[p.name].type as PokemonType[];
        const shares = (a: PartyPokemon, b: PartyPokemon) => typesOf(a).some((t) => typesOf(b).includes(t));
        // A contagious Pokémon already in the hatchery keeps spreading, otherwise pick the one reaching most uninfected Pokémon
        const inHatchery = App.game.breeding.eggList.map((e) => e().partyPokemon()).filter((p) => p && p.pokerus >= GameConstants.Pokerus.Contagious);
        let spreader: PartyPokemon = inHatchery[0];
        const result: PartyPokemon[] = [];
        if (!spreader) {
            spreader = spreaders
                .map((s) => ({ s, n: uninfected.filter((u) => shares(s, u)).length }))
                .filter((x) => x.n > 0)
                .sort((a, b) => b.n - a.n)[0]?.s;
            if (spreader) {
                result.push(spreader);
            }
        }
        if (spreader) {
            result.push(...uninfected.filter((u) => shares(spreader, u)));
        }
        return [...new Set([...result, ...sorted])];
    }
}
