/// <reference path="../AutomationFeature.ts" />

type AutoShopItemSettings = { enabled: boolean, target: number, buyAmount: number, maxPrice: number };
type AutoShopEntry = { item: Item, towns: Town[], group: string };

// Keeps configured shop items stocked up to a target amount
class AutoShop extends AutomationFeature {
    id = 'shop';
    name = 'Einkaufen';
    icon = '🛒';
    group: AutomationGroup = 'basis';
    description = 'Kauft eingestellte Gegenstände nach, bis die Zielmenge erreicht ist (nur aus freigeschalteten Läden).';
    unlockHint = 'Erhalte den Vulkanorden (Volcano Badge).';
    interval = 10 * 1000;
    settingsTemplate = 'automationShopSettingsTemplate';

    settingDefs: AutomationSettingDef[] = [
        { key: 'reserveMoney', label: 'Mindestens so viele Pokédollar behalten', type: 'number', default: 100000, min: 0 },
        { key: 'reserveQuestPoints', label: 'Mindestens so viele Questpunkte behalten', type: 'number', default: 0, min: 0 },
        { key: 'reserveFarmPoints', label: 'Mindestens so viele Farmpunkte behalten', type: 'number', default: 0, min: 0 },
        { key: 'items', label: '', type: 'number', default: {} },
    ];

    public static readonly defaultItems: Record<string, AutoShopItemSettings> = {
        Ultraball: { enabled: true, target: 1000, buyAmount: 100, maxPrice: 1200 },
        Greatball: { enabled: true, target: 1000, buyAmount: 100, maxPrice: 600 },
        Pokeball: { enabled: true, target: 1000, buyAmount: 100, maxPrice: 100 },
    };

    public isUnlocked(): boolean {
        return App.game.badgeCase.hasBadge(BadgeEnums.Volcano);
    }

    private static entryCache: AutoShopEntry[] = null;

    public static entries(): AutoShopEntry[] {
        if (AutoShop.entryCache) {
            return AutoShop.entryCache;
        }
        const map = new Map<string, AutoShopEntry>();
        Object.values(TownList).forEach((town) => {
            town.content.filter((c) => c instanceof Shop).forEach((shop: Shop) => {
                shop.items.forEach((item) => {
                    const group = AutoShop.groupOf(item);
                    if (!group) {
                        return;
                    }
                    const entry = map.get(item.name) ?? { item, towns: [], group };
                    entry.towns.push(town);
                    map.set(item.name, entry);
                });
            });
        });
        AutoShop.entryCache = [...map.values()];
        return AutoShop.entryCache;
    }

    private static groupOf(item: Item): string | null {
        if (item instanceof PokeballItem) {
            return item.currency === GameConstants.Currency.money ? 'Pokébälle' : null;
        }
        if (item instanceof BattleItem || item instanceof EnergyRestore || item instanceof Vitamin) {
            return 'Kampf & Vitamine';
        }
        if (item instanceof EggItem) {
            return 'Eier';
        }
        if (item instanceof MulchItem || item instanceof ShovelItem || item instanceof MulchShovelItem) {
            return 'Farm';
        }
        return null;
    }

    public static quantity(item: Item): number {
        if (item instanceof PokeballItem) {
            return App.game.pokeballs.getBallQuantity(item.type);
        }
        if (item instanceof MulchShovelItem) {
            return App.game.farming.mulchShovelAmt();
        }
        if (item instanceof ShovelItem) {
            return App.game.farming.shovelAmt();
        }
        if (item instanceof MulchItem) {
            return App.game.farming.mulchList[item.type]();
        }
        return player.itemList[item.name]?.() ?? 0;
    }

    public static purchasable(entry: AutoShopEntry): boolean {
        return entry.towns.some((t) => t.isUnlocked()) && entry.item.isAvailable() && !entry.item.isSoldOut();
    }

    public itemSettings(name: string): AutoShopItemSettings {
        const items = this.setting<Record<string, AutoShopItemSettings>>('items') ?? {};
        return items[name] ?? AutoShop.defaultItems[name] ?? { enabled: false, target: 100, buyAmount: 10, maxPrice: 0 };
    }

    public updateItem(name: string, key: keyof AutoShopItemSettings, value: any) {
        const items = { ...(this.setting<Record<string, AutoShopItemSettings>>('items') ?? {}) };
        const current = { ...this.itemSettings(name) };
        (current as any)[key] = key === 'enabled' ? !!value : Math.max(0, Math.floor(+value || 0));
        items[name] = current;
        this.settings.items(items);
    }

    public visibleEntries = ko.pureComputed(() => {
        this.settings.items?.();
        return AutoShop.entries().filter((e) => e.towns.some((t) => t.isUnlocked()));
    });

    private reserve(currency: GameConstants.Currency): number {
        switch (currency) {
            case GameConstants.Currency.money: return +this.setting('reserveMoney') || 0;
            case GameConstants.Currency.questPoint: return +this.setting('reserveQuestPoints') || 0;
            case GameConstants.Currency.farmPoint: return +this.setting('reserveFarmPoints') || 0;
            default: return 0;
        }
    }

    public run() {
        const spent: Record<number, number> = {};
        AutoShop.entries().forEach((entry) => {
            const settings = this.itemSettings(entry.item.name);
            if (!settings.enabled || !AutoShop.purchasable(entry)) {
                return;
            }
            const missing = settings.target - AutoShop.quantity(entry.item);
            const amount = Math.min(missing, settings.buyAmount || missing);
            if (amount <= 0) {
                return;
            }
            if (settings.maxPrice > 0 && entry.item.totalPrice(1) > settings.maxPrice) {
                return;
            }
            const price = entry.item.totalPrice(amount);
            const currency = entry.item.currency;
            if (App.game.wallet.currencies[currency]() - price < this.reserve(currency)) {
                return;
            }
            entry.item.buy(amount);
            spent[currency] = (spent[currency] ?? 0) + price;
        });
        const parts = Object.entries(spent).map(([currency, amount]) => `${amount.toLocaleString('de-DE')} <img src="assets/images/currency/${GameConstants.Currency[currency]}.svg" height="20px">`);
        if (parts.length) {
            this.status(`Zuletzt eingekauft für ${parts.join(', ')}`);
            App.game.automation.notify(`Eingekauft für ${parts.join(', ')}`);
        }
    }
}
