// Small "catchable Pokémon" list for the side worlds (Festival Archipelago, Fusion world),
// opened from the encounter button in their windows like the route info of the base game.
type AreaPokemonEntry = { name: string, image: string, caught: boolean, note?: string };

class AreaPokemonInfo {
    public static title: KnockoutObservable<string> = ko.observable('');
    public static entries: KnockoutObservableArray<AreaPokemonEntry> = ko.observableArray([]);

    public static open(title: string, entries: AreaPokemonEntry[]) {
        AreaPokemonInfo.title(title);
        AreaPokemonInfo.entries(entries);
        $('#areaPokemonModal').modal('show');
    }
}
