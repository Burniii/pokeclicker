/// <reference path="../AutomationFeature.ts" />

// Levels up Oak Items as soon as they have enough experience and the player can pay for it
class AutoOakUpgrade extends AutomationFeature {
    id = 'oakUpgrade';
    name = 'Oak-Items aufwerten';
    icon = '🎒';
    group: AutomationGroup = 'basis';
    description = 'Wertet Oak-Items automatisch auf, sobald genug Erfahrung und Geld vorhanden sind.';
    unlockHint = 'Erhalte die Oak-Items und den Erdorden (Earth Badge).';
    interval = 10 * 1000;

    settingDefs: AutomationSettingDef[] = [{ key: 'reserve', label: 'Mindestens so viel Geld behalten', type: 'number', default: 0, min: 0 }];

    public isUnlocked(): boolean {
        return App.game.oakItems.canAccess() && App.game.badgeCase.hasBadge(BadgeEnums.Earth);
    }

    public run() {
        const reserve = Math.max(0, +this.setting('reserve') || 0);
        App.game.oakItems.itemList.forEach((item) => {
            if (!item.isUnlocked() || item.isMaxLevel() || !item.hasEnoughExp()) {
                return;
            }
            const cost = item.calculateCost();
            if (App.game.wallet.currencies[cost.currency]() - cost.amount < reserve || !item.canBuy()) {
                return;
            }
            item.buy();
            App.game.automation.notify(`${item.displayName} wurde auf Stufe ${item.level} aufgewertet.`);
        });
        const left = App.game.oakItems.itemList.filter((i) => !i.isMaxLevel()).length;
        this.status(left ? `${left} Oak-Items noch nicht auf Maximalstufe` : 'Alle Oak-Items sind auf Maximalstufe.');
    }
}

// Buys gem upgrades (type effectiveness) whenever enough gems are available
class AutoGemUpgrade extends AutomationFeature {
    id = 'gemUpgrade';
    name = 'Edelstein-Upgrades';
    icon = '💎';
    group: AutomationGroup = 'basis';
    description = 'Kauft automatisch Edelstein-Verbesserungen für die Typ-Effektivität.';
    unlockHint = 'Schalte die Edelsteine frei und besiege den Johto-Champion.';
    interval = 10 * 1000;

    settingDefs: AutomationSettingDef[] = [{ key: 'reserve', label: 'Mindestens so viele Edelsteine je Typ behalten', type: 'number', default: 0, min: 0 }];

    public isUnlocked(): boolean {
        return App.game.gems.canAccess() && App.game.badgeCase.hasBadge(BadgeEnums.Elite_JohtoChampion);
    }

    public run() {
        const gems = App.game.gems;
        const reserve = Math.max(0, +this.setting('reserve') || 0);
        let open = 0;
        for (let type = 0; type < Gems.nTypes; type++) {
            // Upgrade the strongest effect first (super effective before neutral before not very effective)
            for (let effect = Gems.nEffects - 1; effect >= 0; effect--) {
                if (!gems.isValidUpgrade(type, effect) || gems.hasMaxUpgrade(type, effect)) {
                    continue;
                }
                open++;
                while (gems.canBuyGemUpgrade(type, effect) && gems.gemWallet[type]() - gems.getGemUpgradeCost(type, effect) >= reserve) {
                    gems.buyGemUpgrade(type, effect);
                }
            }
        }
        this.status(open ? `${open} Verbesserungen noch nicht auf Maximum` : 'Alle Edelstein-Verbesserungen sind auf Maximum.');
    }
}
