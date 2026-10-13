// UI helpers of the Fusion world: the Fusion map, the Fusion battle/town view and the Fusion dex.
// The modules themselves are normal sortable, collapsible cards like the Town Map or the Pokémon List.
class FusionUI {
    public static hpPercent = ko.pureComputed(() => {
        const enemy = App.game.fusionWorld.enemy();
        return enemy ? Math.max(0, enemy.hp / enemy.maxHp * 100) : 0;
    });

    public static typeNames(id: string): string {
        return FusionData.types(id).map((t) => PokemonType[t]).join(' / ');
    }

    public static mapAreas = FusionData.areas.filter((a) => a.map);

    public static moveTo(area: FusionArea) {
        const world = App.game.fusionWorld;
        if (!world.starter()) {
            Notifier.notify({ message: 'Wähle zuerst im Fusionslabor deinen ersten Fusionspartner.', type: NotificationConstants.NotificationOption.warning });
            return;
        }
        if (!world.areaUnlocked(area)) {
            Notifier.notify({ message: FusionUI.lockedText(area), type: NotificationConstants.NotificationOption.warning });
            return;
        }
        world.goTo(area.id);
    }

    public static lockedText(area: FusionArea): string {
        if (area.unlock.badge) {
            return `${area.name}: benötigt den ${area.unlock.badge}.`;
        }
        const needed = area.unlock.kills - App.game.fusionWorld.killsOn(area.unlock.area);
        return `${area.name}: noch ${needed} Siege auf ${FusionData.area(area.unlock.area).name} nötig.`;
    }

    // Same colour states as the region maps (locked, incomplete, uncaught Pokémon, completed)
    public static areaCss(area: FusionArea): string {
        const world = App.game.fusionWorld;
        if (!world.areaUnlocked(area)) {
            return 'locked';
        }
        if (area.kind === 'town') {
            const gym = area.gym ? FusionData.area(area.gym) : undefined;
            return gym && !world.badges().includes(gym.badge) ? 'incomplete' : 'completed';
        }
        if (world.killsOn(area.id) < GameConstants.ROUTE_KILLS_NEEDED) {
            return 'incomplete';
        }
        if (area.pokemon.some((id) => !world.isCaught(id))) {
            return 'uncaughtPokemon';
        }
        return 'completed';
    }

    public static areaTooltip(area: FusionArea): string {
        const world = App.game.fusionWorld;
        if (!world.areaUnlocked(area)) {
            return `🔒 ${FusionUI.lockedText(area)}`;
        }
        if (!area.pokemon) {
            return area.name;
        }
        const caught = area.pokemon.filter((id) => world.isCaught(id)).length;
        return `${area.name} (${caught}/${area.pokemon.length} gefangen)`;
    }

    public static showTooltip(text: string) {
        $('#fusionMapTooltip').text(text).css('visibility', 'visible');
    }

    public static hideTooltip() {
        $('#fusionMapTooltip').text('').css('visibility', 'hidden');
    }

    public static battleClass = ko.pureComputed(() => App.game.fusionWorld.currentArea()?.background ?? '');

    public static teamList = ko.pureComputed(() => App.game.fusionWorld.caught().slice().sort((a, b) => b.exp - a.exp));

    // Fusions of the current area (or the team of the gym), like the route info of the base game
    public static openAreaInfo() {
        const world = App.game.fusionWorld;
        const area = world.currentArea();
        const ids = area?.pokemon ?? area?.team?.map((m) => m.id) ?? [];
        if (!ids.length) {
            return;
        }
        AreaPokemonInfo.open(`${area.name} · ${FusionData.REGION}`, ids.map((id) => ({
            name: FusionData.speciesById(id).name,
            image: FusionData.image(id),
            caught: world.isCaught(id),
            note: FusionData.partNames(id),
        })));
    }

    public static openDex() {
        $('#fusionDexModal').modal('show');
    }
}
