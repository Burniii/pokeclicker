// "Übersicht" tab of the automation window: roaming Pokémon, useful evolution items, open quest lines and quick travel
class AutomationOverview {
    public static goToTarget: KnockoutObservable<string> = ko.observable('');

    public static roamers = ko.pureComputed(() => {
        const result: { region: string, group: string, route: string, pokemon: { name: string, caught: boolean, shiny: boolean }[] }[] = [];
        for (let region = 0; region <= player.highestRegion(); region++) {
            (RoamingPokemonList.roamerGroups[region] ?? []).forEach((group, index) => {
                const roamers = RoamingPokemonList.getSubRegionalGroupRoamers(region, index).filter((r) => r.isRoaming());
                if (!roamers.length) {
                    return;
                }
                const route = RoamingPokemonList.getIncreasedChanceRouteBySubRegionGroup(region, index)();
                result.push({
                    region: GameConstants.camelCaseToString(GameConstants.Region[region]),
                    group: group.name,
                    route: route ? Routes.getName(route.number, route.region) : '–',
                    pokemon: roamers.map((r) => ({
                        name: r.pokemon.name,
                        caught: App.game.party.alreadyCaughtPokemonByName(r.pokemon.name),
                        shiny: App.game.party.alreadyCaughtPokemonByName(r.pokemon.name, true),
                    })),
                });
            });
        }
        return result;
    });

    public static goToRoamers(region: string, route: string) {
        const target = Routes.regionRoutes.find((r) => Routes.getName(r.number, r.region) === route && GameConstants.camelCaseToString(GameConstants.Region[r.region]) === region);
        if (target && MapHelper.accessToRoute(target.number, target.region)) {
            MapHelper.moveToRoute(target.number, target.region);
        } else {
            Notifier.notify({ message: `${route} ist von hier aus nicht erreichbar.`, type: NotificationConstants.NotificationOption.warning });
        }
    }

    // Evolution items in the bag that would give a new (or new shiny) Pokémon
    public static stones = ko.pureComputed(() => {
        return Object.values(ItemList)
            .filter((item) => item instanceof EvolutionStone && player.itemList[item.name]?.() > 0)
            .map((item: EvolutionStone) => ({ item, status: item.getCaughtStatus() }))
            .filter(({ status }) => status !== undefined && status !== CaughtStatus.CaughtShiny)
            .map(({ item, status }) => ({
                name: item.displayName,
                image: item.image,
                amount: player.itemList[item.name](),
                text: status === CaughtStatus.NotCaught ? 'neues Pokémon möglich' : 'neues schillerndes Pokémon möglich',
            }));
    });

    public static questLines = ko.pureComputed(() => {
        const towns = Object.values(TownList).filter((t) => t.content.some((c) => c instanceof BulletinBoard));
        return App.game.quests.questLines()
            .filter((q) => q.state() === QuestLineState.inactive && q.bulletinBoard !== GameConstants.BulletinBoards.None
                && (!q.requirement || q.requirement.isCompleted()))
            .map((q) => {
                const where = towns.filter((t) => t.content.some((c) => c instanceof BulletinBoard
                    && (q.bulletinBoard === GameConstants.BulletinBoards.All || (c as BulletinBoard).board === q.bulletinBoard)) && t.isUnlocked());
                const town = where.find((t) => t.region === player.region) ?? where[0];
                return { name: q.name, town: town?.name };
            })
            .filter((q) => q.town);
    });

    public static towns = ko.pureComputed(() => Object.values(TownList)
        .filter((t) => t.region === player.region && t.isUnlocked() && MapHelper.accessToTown(t.name))
        .map((t) => t.name)
        .sort((a, b) => a.localeCompare(b)));

    public static goTo(name: string = AutomationOverview.goToTarget()) {
        if (name && MapHelper.accessToTown(name)) {
            MapHelper.moveToTown(name);
            $('#automationModal').modal('hide');
        }
    }
}
