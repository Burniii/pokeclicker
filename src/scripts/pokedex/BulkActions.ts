// Applies categories, vitamins and held items to all caught Pokémon matching the current Pokédex filters
class BulkActions {
    public static category = ko.observable<number>(undefined);
    public static vitaminTargets: Record<number, KnockoutObservable<string>> = Object.fromEntries(
        GameHelper.enumNumbers(GameConstants.VitaminType).map((v) => [v, ko.observable('')])
    );
    public static heldItemName = ko.observable<string>(undefined);
    public static onlyWithoutHeldItem = ko.observable(true);

    public static selection(): PartyPokemon[] {
        return PokedexHelper.filteredListPartyPokemon();
    }

    public static selectionCount = ko.pureComputed(() => BulkActions.selection().length);

    private static done(action: string, changed: number) {
        Notifier.notify({
            message: `${action}: ${changed.toLocaleString('en-US')} of ${BulkActions.selection().length.toLocaleString('en-US')} Pokémon changed.`,
            type: changed ? NotificationConstants.NotificationOption.success : NotificationConstants.NotificationOption.info,
        });
    }

    public static setCategory(add: boolean) {
        const id = BulkActions.category();
        if (id == undefined) {
            return;
        }
        let changed = 0;
        BulkActions.selection().forEach((p) => {
            if (p.category.includes(id) !== add) {
                p.toggleCategory(id);
                changed++;
            }
        });
        const name = PokemonCategories.categories().find((c) => c.id === id)?.name() ?? '';
        BulkActions.done(`${add ? 'Added to' : 'Removed from'} category ${name}`, changed);
    }

    public static applyVitamins() {
        if (App.game.challenges.list.disableVitamins.active()) {
            return Notifier.notify({ message: 'Vitamins are disabled by a challenge.', type: NotificationConstants.NotificationOption.danger });
        }
        const targets = GameHelper.enumNumbers(GameConstants.VitaminType)
            .map((v) => [v, BulkActions.vitaminTargets[v]()] as [GameConstants.VitaminType, string])
            .filter(([, value]) => value !== '' && !isNaN(Number(value)))
            .map(([v, value]) => [v, Math.max(0, Math.floor(Number(value)))] as [GameConstants.VitaminType, number]);
        if (!targets.length) {
            return;
        }
        let changed = 0;
        let outOfStock = false;
        BulkActions.selection().filter((p) => !p.breeding).forEach((p) => {
            let pokemonChanged = false;
            // Remove first so freed slots can be used by the other vitamins
            [...targets].sort(([va, a], [vb, b]) => (a - p.vitaminsUsed[va]()) - (b - p.vitaminsUsed[vb]())).forEach(([vitamin, amount]) => {
                const current = p.vitaminsUsed[vitamin]();
                let target = Math.min(amount, current + p.vitaminUsesRemaining());
                if (target > current) {
                    const stock = player.itemList[GameConstants.VitaminType[vitamin]]();
                    if (stock < target - current) {
                        outOfStock = true;
                        target = current + stock;
                    }
                }
                if (target !== current) {
                    p.setVitaminAmount(vitamin, target);
                    pokemonChanged = true;
                }
            });
            changed += pokemonChanged ? 1 : 0;
        });
        BulkActions.done('Vitamins applied', changed);
        if (outOfStock) {
            Notifier.notify({ message: 'You ran out of some vitamins, not every Pokémon got all of them.', type: NotificationConstants.NotificationOption.warning });
        }
    }

    public static heldItems(): HeldItem[] {
        return (Object.values(ItemList).filter((i) => i instanceof HeldItem) as HeldItem[])
            .filter((i) => player.amountOfItem(i.name) > 0)
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    public static giveHeldItem() {
        const item = ItemList[BulkActions.heldItemName()] as HeldItem;
        if (!(item instanceof HeldItem)) {
            return;
        }
        let changed = 0;
        BulkActions.selection().forEach((p) => {
            if (player.amountOfItem(item.name) < 1 || p.heldItem()?.name === item.name || !item.canUse(p)) {
                return;
            }
            if (p.heldItem() && BulkActions.onlyWithoutHeldItem()) {
                return;
            }
            // Replacing an item discards the old one, same as giving it by hand
            p.heldItem(undefined);
            p.giveHeldItem(item);
            changed++;
        });
        BulkActions.done(`Gave ${item.displayName}`, changed);
    }

    public static removeHeldItems() {
        const holding = BulkActions.selection().filter((p) => p.heldItem());
        if (!holding.length) {
            return BulkActions.done('Removed held items', 0);
        }
        Notifier.confirm({
            title: 'Remove held items',
            message: `Held items are one time use only.\nThe items of ${holding.length.toLocaleString('en-US')} Pokémon will be lost.\nAre you sure?`,
            confirm: 'Remove',
            type: NotificationConstants.NotificationOption.warning,
        }).then((confirmed) => {
            if (confirmed) {
                holding.forEach((p) => p.heldItem(undefined));
                BulkActions.done('Removed held items', holding.length);
            }
        });
    }
}
