/// <reference path="./AreaPokemonInfo.ts" />
// UI helpers of the Festival Archipelago window and map (same states and colours as the region maps)
class FestivalUI {
    public static hpPercent = ko.pureComputed(() => {
        const enemy = App.game.festivalWorld.enemy();
        return enemy ? Math.max(0, enemy.hp / enemy.maxHp * 100) : 0;
    });

    public static caughtCount = ko.pureComputed(() => FestivalData.allPokemon().filter((name) => App.game.party.alreadyCaughtPokemonByName(name)).length);

    public static battleClass = ko.pureComputed(() => {
        const area = App.game.festivalWorld.currentArea();
        return area?.kind === 'cave' ? 'cave' : FestivalData.stage(area?.stage ?? 1)?.background ?? '';
    });

    public static lockedText(area: FestivalArea): string {
        const world = App.game.festivalWorld;
        if (!world.stageUnlocked(area.stage)) {
            const stage = FestivalData.stage(area.stage);
            return `${area.name}: öffnet mit der Questreihe nach dem Champion von ${GameConstants.camelCaseToString(GameConstants.Region[stage.region])} (Festival-Bote in ${stage.town}).`;
        }
        const needed = area.unlockKills.kills - world.killsOn(area.unlockKills.area);
        return `${area.name}: noch ${needed} Siege auf ${FestivalData.area(area.unlockKills.area).name} nötig.`;
    }

    public static moveTo(area: FestivalArea) {
        if (!App.game.festivalWorld.areaUnlocked(area)) {
            Notifier.notify({ message: FestivalUI.lockedText(area), type: NotificationConstants.NotificationOption.warning });
            return;
        }
        App.game.festivalWorld.goTo(area.id);
    }

    public static areaCss(area: FestivalArea): string {
        const world = App.game.festivalWorld;
        if (!world.areaUnlocked(area)) {
            return 'locked';
        }
        if (area.kind === 'town') {
            return 'completed';
        }
        if (world.killsOn(area.id) < GameConstants.ROUTE_KILLS_NEEDED) {
            return 'incomplete';
        }
        const all = [...(area.pokemon ?? []), ...(area.rare ?? [])];
        return all.some((name) => !App.game.party.alreadyCaughtPokemonByName(name)) ? 'uncaughtPokemon' : 'completed';
    }

    public static areaTooltip(area: FestivalArea): string {
        if (!App.game.festivalWorld.areaUnlocked(area)) {
            return `🔒 ${FestivalUI.lockedText(area)}`;
        }
        if (!area.pokemon) {
            return area.name;
        }
        const all = [...area.pokemon, ...(area.rare ?? [])];
        const caught = all.filter((name) => App.game.party.alreadyCaughtPokemonByName(name)).length;
        return `${area.name} (${caught}/${all.length} gefangen)`;
    }

    public static showTooltip(text: string) {
        $('#festivalMapTooltip').text(text).css('visibility', 'visible');
    }

    public static hideTooltip() {
        $('#festivalMapTooltip').text('').css('visibility', 'hidden');
    }

    public static openAreaInfo() {
        const area = App.game.festivalWorld.currentArea();
        if (!area?.pokemon) {
            return;
        }
        const entry = (name: PokemonNameType, note?: string): AreaPokemonEntry => ({
            name: PokemonHelper.displayName(name),
            image: PokemonHelper.getImage(pokemonMap[name].id),
            caught: App.game.party.alreadyCaughtPokemonByName(name),
            note,
        });
        AreaPokemonInfo.open(area.name, [...area.pokemon.map((n) => entry(n)), ...(area.rare ?? []).map((n) => entry(n, 'selten (5 %)'))]);
    }
}
