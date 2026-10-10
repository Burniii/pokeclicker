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

    public static ranchCandidates = ko.pureComputed(() => Activities.available()
        .filter((p) => ActivitiesUI.matches(p))
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
