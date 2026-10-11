/// <reference path="../AutomationFeature.ts" />
/// <reference path="./FarmPlanner.ts" />

// Plants, harvests and - once unlocked - works on new berry mutations on its own
class AutoFarm extends AutomationFeature {
    id = 'farm';
    name = 'Farm';
    icon = '🌱';
    group: AutomationGroup = 'farm';
    description = 'Erntet, pflanzt nach, fängt Pokémon auf der Farm und kauft neue Felder.';
    unlockHint = 'Schalte die Farm frei und erreiche Johto. Mutations-Strategien nach dem Johto-Champion.';
    interval = 1000;
    settingsTemplate = 'automationFarmSettingsTemplate';
    private gatheringFor: BerryType = null;
    private lastPlanReset = Date.now();

    settingDefs: AutomationSettingDef[] = [
        {
            key: 'berry',
            label: 'Diese Beere anbauen',
            type: 'select',
            default: BerryType.Cheri,
            options: () => [
                { value: -2, text: 'Automatisch (Beere mit dem kleinsten Vorrat)' },
                ...GameHelper.enumNumbers(BerryType).filter((b) => b >= 0 && App.game.farming.unlockedBerries[b]())
                    .map((b) => ({ value: b, text: `${BerryType[b]} (${App.game.farming.berryInventory[b]().toLocaleString('de-DE')})` })),
            ],
        },
        { key: 'harvestLate', label: 'So spät wie möglich ernten (lockt mehr wilde Pokémon und Mutationen an)', type: 'bool', default: false },
        { key: 'richMulch', label: 'Vor dem Ernten Reichmulch auftragen', type: 'bool', default: false },
        { key: 'shovel', label: 'Unerwünschte Beeren mit der Schaufel entfernen (wichtig für Mutationen)', type: 'bool', default: true },
        { key: 'catchWanderers', label: 'Wilde Pokémon auf der Farm fangen', type: 'bool', default: true },
        { key: 'unlockPlots', label: 'Neue Felder kaufen, sobald genug Beeren da sind', type: 'bool', default: true },
        { key: 'mutations', label: 'Neue Beeren per Mutation freischalten (hat Vorrang vor dem normalen Anbau)', type: 'bool', default: false },
        { key: 'minStock', label: 'Für Mutationen mindestens so viele Beeren jeder benötigten Sorte vorrätig halten', type: 'number', default: 25, min: 1 },
    ];

    public plan: KnockoutObservable<FarmPlan | null> = ko.observable(null);

    public isUnlocked(): boolean {
        return App.game.farming.canAccess() && player.highestRegion() >= GameConstants.Region.johto;
    }

    public static mutationsUnlocked(): boolean {
        return App.game.badgeCase.hasBadge(BadgeEnums.Elite_JohtoChampion);
    }

    public run() {
        const farming = App.game.farming;
        if (this.setting('catchWanderers')) {
            farming.plotList.forEach((plot) => {
                if (!plot.isEmpty() && plot.canCatchWanderer()) {
                    farming.handleWanderer(plot);
                }
            });
        }
        if (this.setting('unlockPlots')) {
            farming.plotList.forEach((plot, index) => {
                if (!plot.isUnlocked && farming.canBuyPlot(index)) {
                    farming.unlockPlot(index);
                    FarmPlanner.clearCache();
                }
            });
        }
        // Flavor layouts depend on the berry stock, so plans are recalculated from time to time
        if (Date.now() - this.lastPlanReset > 30 * 60 * 1000) {
            this.lastPlanReset = Date.now();
            FarmPlanner.clearCache();
        }
        if (this.setting('mutations') && AutoFarm.mutationsUnlocked() && this.workOnMutation()) {
            return;
        }
        this.plan(null);
        this.gatheringFor = null;
        this.plantMode(this.chosenBerry());
    }

    private chosenBerry(): BerryType {
        const selected = +this.setting('berry');
        if (selected >= 0 && App.game.farming.unlockedBerries[selected]?.()) {
            return selected;
        }
        const unlocked = GameHelper.enumNumbers(BerryType).filter((b) => b >= 0 && App.game.farming.unlockedBerries[b]());
        return unlocked.sort((a, b) => App.game.farming.berryInventory[a]() - App.game.farming.berryInventory[b]())[0] ?? BerryType.Cheri;
    }

    private secondsUntilWither(plot: Plot): number {
        const left = plot.berryData.growthTime[PlotStage.Berry] - plot.age;
        return left / (plot.getGrowthMultiplier() * App.game.farming.getGrowthMultiplier());
    }

    private harvest(index: number, mulch: boolean) {
        const plot = App.game.farming.plotList[index];
        if (plot.wanderer?.catching?.()) {
            return;
        }
        if (mulch && plot.mulch === MulchType.None && App.game.farming.hasMulch(MulchType.Rich_Mulch)) {
            App.game.farming.addMulch(index, MulchType.Rich_Mulch);
        }
        App.game.farming.harvest(index);
    }

    private removeBerry(index: number) {
        const plot = App.game.farming.plotList[index];
        // Rare berries (e.g. a fresh mutation) are never shovelled away, they are harvested once ripe
        const scarce = App.game.farming.berryInventory[plot.berry]() < Math.max(1, +this.setting('minStock') || 1);
        if (plot.stage() === PlotStage.Berry) {
            this.harvest(index, false);
        } else if (!scarce && this.setting('shovel') && App.game.farming.shovelAmt() > 0) {
            App.game.farming.shovel(index);
        }
    }

    private plantMode(berry: BerryType) {
        const farming = App.game.farming;
        const late = this.setting('harvestLate');
        let planted = 0;
        farming.plotList.forEach((plot, index) => {
            if (!plot.isUnlocked || plot.isSafeLocked) {
                return;
            }
            if (!plot.isEmpty()) {
                if (plot.berry !== berry && this.setting('shovel') && plot.stage() !== PlotStage.Berry) {
                    this.removeBerry(index);
                }
                if (plot.stage() === PlotStage.Berry && (!late || plot.berry !== berry || this.secondsUntilWither(plot) < 15)) {
                    this.harvest(index, this.setting('richMulch'));
                }
            }
            if (plot.isEmpty() && farming.hasBerry(berry)) {
                farming.plant(index, berry);
                planted++;
            }
        });
        this.status(`Baut ${BerryType[berry]} an${planted ? ` · ${planted} neu gepflanzt` : ''}`);
    }

    // Returns true while the farm is busy with a mutation (or with gathering the berries for it)
    private workOnMutation(): boolean {
        const farming = App.game.farming;
        // Only aim for berries whose ingredients are all at least partly available
        const target = FarmPlanner.lockedBerries().find((b) => {
            const p = FarmPlanner.plan(b);
            return p && Object.keys(p.needed).every((n) => farming.berryInventory[n]() + this.planted(+n) > 0);
        });
        if (target === undefined) {
            this.status('Keine weitere Beere lässt sich mit den aktuellen Beeren per Mutation freischalten.');
            return false;
        }
        const plan = FarmPlanner.plan(target);
        this.plan(plan);
        const minStock = Math.max(1, +this.setting('minStock') || 1);

        // Gather berries first when the stock is too low (one at a time, so the farm stays productive)
        const missing = (Object.entries(plan.needed) as [string, number][])
            .map(([b, n]) => ({ berry: +b as BerryType, need: Math.max(n, minStock) }))
            .filter(({ berry, need }) => farming.berryInventory[berry]() + this.planted(berry) < need);
        if (missing.length) {
            const berry = this.gatheringFor !== null && missing.some((m) => m.berry === this.gatheringFor) ? this.gatheringFor : missing[0].berry;
            this.gatheringFor = berry;
            this.plantMode(berry);
            this.status(`Ziel: <b>${BerryType[target]}</b> · sammle erst ${BerryType[berry]} (${farming.berryInventory[berry]()} / ${missing.find((m) => m.berry === berry).need})`);
            return true;
        }
        this.gatheringFor = null;

        // All helper berries of the layout are planted so they become ripe at the same time and harvested together
        // right before the first one withers, so every mutation spot sees all its neighbours ripe at once.
        const global = farming.getGrowthMultiplier();
        const ripeIn = (plot: Plot) => Math.max(0, (plot.berryData.growthTime[PlotStage.Bloom] - plot.age) / (plot.getGrowthMultiplier() * global));
        const growTime = (berry: BerryType) => BerryList[berry].growthTime[PlotStage.Bloom] / global;
        const planCells = Object.keys(plan.layout).map((i) => +i).filter((i) => plan.layout[i] !== BerryType.None);

        farming.plotList.forEach((plot, index) => {
            if (!plot.isUnlocked || plot.isSafeLocked || plot.isEmpty()) {
                return;
            }
            const wanted = plan.layout[index] ?? BerryType.None;
            if (plot.berry === target) {
                // The mutation happened, keep it until it can be harvested
                if (plot.stage() === PlotStage.Berry) {
                    this.harvest(index, false);
                }
            } else if (plot.berry !== wanted) {
                this.removeBerry(index);
            } else if (plot.stage() === PlotStage.Berry && this.secondsUntilWither(plot) < 4) {
                // Keep helper berries ripe as long as possible, harvest right before they wither
                this.harvest(index, false);
            }
        });

        // The slowest helper berry in the ground (the anchor) sets the pace: other berries are planted so they
        // become ripe together with it and, once it is ripe, short berries are replanted as long as they can
        // ripen again before the anchor withers. When nothing is planted a new round starts with the slowest berry.
        const planted = planCells.filter((i) => farming.plotList[i].berry === plan.layout[i]);
        const anchor = planted.sort((a, b) => growTime(plan.layout[b]) - growTime(plan.layout[a])
            || ripeIn(farming.plotList[b]) - ripeIn(farming.plotList[a]))[0];
        const longest = Math.max(...planCells.map((i) => growTime(plan.layout[i])));
        planCells.forEach((i) => {
            const plot = farming.plotList[i];
            const wanted = plan.layout[i];
            if (!plot.isEmpty() || !farming.hasBerry(wanted)) {
                return;
            }
            const grow = growTime(wanted);
            let plant: boolean;
            if (anchor === undefined) {
                plant = grow + 1 >= longest;
            } else {
                const anchorPlot = farming.plotList[anchor];
                const anchorRipeIn = ripeIn(anchorPlot);
                plant = anchorRipeIn > 0
                    ? grow + 1 >= anchorRipeIn && grow <= anchorRipeIn + 5
                    : grow + 5 < this.secondsUntilWither(anchorPlot);
            }
            if (plant) {
                farming.plant(i, wanted);
            }
        });
        const helpers = Object.keys(plan.needed).map((b) => BerryType[b]).join(', ');
        const blocked = Object.keys(plan.layout).map((i) => +i)
            .some((i) => plan.layout[i] === BerryType.None && !farming.plotList[i].isEmpty() && farming.plotList[i].berry !== target);
        const hint = blocked && farming.shovelAmt() <= 0 ? ' · ⚠️ Mutationsfelder blockiert – Schaufeln kaufen beschleunigt das' : '';
        this.status(`Ziel: <b>${BerryType[target]}</b> · Mutationsfelder: ${plan.spots} · benötigt: ${helpers}${hint}`);
        return true;
    }

    private planted(berry: BerryType): number {
        return App.game.farming.plotList.filter((p) => p.berry === berry).length;
    }

    public layoutPreview = ko.pureComputed(() => {
        const plan = this.plan();
        return App.game.farming.plotList.map((plot, index) => {
            const wanted = plan ? plan.layout[index] ?? BerryType.None : null;
            return {
                locked: !plot.isUnlocked,
                berry: wanted !== null && wanted !== BerryType.None ? BerryType[wanted] : null,
                target: plan && wanted === BerryType.None && plot.isUnlocked,
            };
        });
    });
}
