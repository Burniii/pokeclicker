// View helpers for the Activities modal
class ActivitiesUI {
    public static search = ko.observable('');
    public static careId = ko.observable<number>(undefined);
    public static careNature = ko.observable<number>(0);
    public static careTera = ko.observable<number>(0);

    private static matches(p: PartyPokemon): boolean {
        const text = ActivitiesUI.search().trim();
        if (!text) {
            return true;
        }
        if (/^\d+$/.test(text)) {
            return Math.floor(p.id) === +text;
        }
        return PokemonHelper.matchPokemonByNames(GameHelper.safelyBuildRegex(text), p.name, p);
    }

    // Available Pokémon for expeditions, strongest for the chosen destination first
    public static expeditionCandidates = ko.pureComputed(() => {
        const destination = App.game.expeditions.destination();
        return Activities.available()
            .filter((p) => ActivitiesUI.matches(p))
            .map((p) => ({ pokemon: p, power: App.game.expeditions.power([p.id], destination), match: pokemonMap[p.id].type.some((t) => destination.types.includes(t)) }))
            .sort((a, b) => b.power - a.power)
            .slice(0, 40);
    });

    // Ranch category filter (a loot key like 'berry' or 'Heart_scale'), empty for all
    public static ranchCategory = ko.observable<string>('');

    public static toggleRanchCategory(key: string) {
        ActivitiesUI.ranchCategory(ActivitiesUI.ranchCategory() === key ? '' : key);
    }

    private static producesCategory(id: number): boolean {
        const key = ActivitiesUI.ranchCategory();
        return !key || App.game.ranch.products(id).some((p) => ActivityData.lootKey(p) === key);
    }

    public static ranchCandidates = ko.pureComputed(() => Activities.available()
        .filter((p) => ActivitiesUI.matches(p) && ActivitiesUI.producesCategory(p.id))
        .sort((a, b) => App.game.pokemonTraits.hearts(b.id) - App.game.pokemonTraits.hearts(a.id) || a.id - b.id)
        .slice(0, 40));

    public static carePokemon = ko.pureComputed(() => App.game.party.caughtPokemon
        .filter((p) => p.id > 0 && ActivitiesUI.matches(p))
        .slice(0, 60));

    public static researchList = ko.pureComputed(() => {
        Research.version();
        return App.game.party.caughtPokemon
            .filter((p) => p.id > 0 && ActivitiesUI.matches(p))
            .map((p) => ({ pokemon: p, stars: Research.stars(p.id) }))
            .sort((a, b) => a.stars - b.stars || a.pokemon.id - b.pokemon.id)
            .slice(0, 60);
    });

    public static formatAmount(value: number): string {
        if (value >= 100) {
            return Math.round(value).toLocaleString('en-US');
        }
        return (Math.round(value * 10) / 10).toLocaleString('en-US');
    }

    // Products of a ranch Pokémon with the amount per hour (with its current bond and nature)
    public static ranchProducts(id: number): { loot: ActivityLoot, name: string, image: string, emoji: string, perHour: string }[] {
        const products = App.game.ranch.products(id);
        const region = player.highestRegion();
        return products.map((loot) => ({
            loot,
            name: ActivityData.productName(loot),
            image: ActivityData.lootImage(loot),
            emoji: ActivityData.lootEmoji(loot),
            perHour: ActivitiesUI.formatAmount(ActivityData.rate(loot, App.game.ranch.multiplier(id) / products.length, region)),
        }));
    }

    // Reward pool of the chosen expedition: chance per roll, amount per roll and the expected total on success
    public static expeditionPool = ko.pureComputed(() => {
        const destination = App.game.expeditions.destination();
        const loot = ActivityData.lootFor(destination);
        const total = loot.reduce((sum, l) => sum + l.weight, 0);
        const rolls = App.game.expeditions.hours() * 2;
        // Same loot can appear twice (e.g. a stone in the common pool and the destination pool)
        const entries: { key: string, name: string, image: string, emoji: string, chance: number, amount: number, expected: number }[] = [];
        loot.forEach((l) => {
            const key = ActivityData.lootKey(l);
            const chance = l.weight / total;
            const amount = ActivityData.amount(l, 1, destination.region);
            const entry = entries.find((e) => e.key === key);
            if (entry) {
                entry.chance += chance;
                entry.expected += rolls * chance * amount;
                return;
            }
            entries.push({ key, name: ActivityData.productName(l), image: ActivityData.lootImage(l), emoji: ActivityData.lootEmoji(l), chance, amount, expected: rolls * chance * amount });
        });
        return entries.sort((a, b) => b.chance - a.chance);
    });

    public static productText(id: number): string {
        return App.game.ranch.products(id).map((p) => ActivityData.productName(p)).join(' + ');
    }

    public static hearts(id: number): string {
        const hearts = App.game.pokemonTraits.hearts(id);
        return '❤'.repeat(hearts) + '♡'.repeat(5 - hearts);
    }

    public static selectCare(id: number) {
        ActivitiesUI.careId(id);
        ActivitiesUI.careNature(App.game.pokemonTraits.natureIndex(id));
    }

    public static applyMint() {
        const id = ActivitiesUI.careId();
        if (id !== undefined && App.game.pokemonTraits.useMint(id, +ActivitiesUI.careNature())) {
            Notifier.notify({ message: `${PokemonHelper.displayName(pokemonMap[id].name)} is now ${App.game.pokemonTraits.nature(id).name}.`, type: NotificationConstants.NotificationOption.success });
        }
    }

    public static applyTera() {
        const id = ActivitiesUI.careId();
        if (id !== undefined && App.game.pokemonTraits.setTera(id, +ActivitiesUI.careTera() as PokemonType)) {
            Notifier.notify({ message: `${PokemonHelper.displayName(pokemonMap[id].name)} now has the ${PokemonType[+ActivitiesUI.careTera()]} Tera type.`, type: NotificationConstants.NotificationOption.success });
        }
    }

    public static readonly types = GameHelper.enumNumbers(PokemonType).filter((t) => t >= 0);

    public static researchProgress(id: number): string {
        return Research.tasks.map((t) => `${t.progress(id) >= t.goal ? '★' : '☆'} ${t.name}: ${Math.min(t.progress(id), t.goal).toLocaleString('en-US')}/${t.goal}`).join('<br/>');
    }
}
