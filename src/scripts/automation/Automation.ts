/// <reference path="../../declarations/DataStore/common/Saveable.d.ts" />
/// <reference path="./AutomationFeature.ts" />

// In-game automation (inspired by the pokeclicker-automation user script). Every feature unlocks with story
// progress, can be switched on and off separately and is stored in the save file.
class Automation implements Saveable {
    saveKey = 'automation';
    defaults: Record<string, any> = {};

    public static readonly groups: { id: AutomationGroup, name: string }[] = [
        { id: 'basis', name: 'Basis' },
        { id: 'farm', name: 'Farm' },
        { id: 'instances', name: 'Kämpfe' },
        { id: 'focus', name: 'Fokus' },
    ];

    public features: AutomationFeature[] = [];
    public paused: KnockoutObservable<boolean> = ko.observable(false);
    public showNotifications: KnockoutObservable<boolean> = ko.observable(false);
    public selectedGroup: KnockoutObservable<AutomationGroup | 'overview'> = ko.observable('basis');
    private announced = new Set<string>();
    private unlockCheckCounter = 0;
    private started = false;

    constructor() {
        this.features = [
            new AutoClick(),
            new AutoHatchery(),
            new AutoMine(),
            new AutoOakUpgrade(),
            new AutoGemUpgrade(),
            new AutoShop(),
            new AutoFarm(),
            new AutoGym(),
            new AutoDungeon(),
            new AutoBattleFrontier(),
            new AutoSafari(),
            new AutoFocus(),
        ];
        this.features.forEach((f) => f.init());
    }

    public feature<T extends AutomationFeature>(id: string): T {
        return this.features.find((f) => f.id === id) as T;
    }

    public featuresOf(group: AutomationGroup | 'overview'): AutomationFeature[] {
        return this.features.filter((f) => f.group === group);
    }

    public unlockedCount = ko.pureComputed(() => this.features.filter((f) => f.unlocked()).length);
    public enabledCount = ko.pureComputed(() => this.features.filter((f) => f.unlocked() && f.enabled()).length);

    public initialize() {
        // A catch filter left over from the focus automation is added again when needed
        this.feature<AutoFocus>('focus')?.removeFilter();
        this.refreshUnlocks(true);
        this.started = true;
    }

    // Called every game tick (also while the page is hidden thanks to the web worker)
    public tick() {
        if (!this.started) {
            return;
        }
        if (++this.unlockCheckCounter >= 20) {
            this.unlockCheckCounter = 0;
            this.refreshUnlocks(false);
        }
        if (this.paused()) {
            return;
        }
        const now = Date.now();
        for (const feature of this.features) {
            if (!feature.enabled() || !feature.unlocked() || now - feature.lastRun < feature.interval) {
                continue;
            }
            feature.lastRun = now;
            try {
                feature.run();
                feature.errors = 0;
            } catch (e) {
                console.error(`[Automation] ${feature.id}`, e);
                if (++feature.errors >= 5) {
                    feature.enabled(false);
                    this.notify(`${feature.name} wurde nach wiederholten Fehlern pausiert.`, NotificationConstants.NotificationOption.danger);
                }
            }
        }
    }

    private refreshUnlocks(silent: boolean) {
        this.features.forEach((feature) => {
            let unlocked = false;
            try {
                unlocked = feature.isUnlocked();
            } catch {
                unlocked = false;
            }
            feature.unlocked(unlocked);
            if (unlocked && !this.announced.has(feature.id)) {
                this.announced.add(feature.id);
                if (!silent) {
                    Notifier.notify({
                        title: 'Neue Automatik freigeschaltet',
                        message: `${feature.icon} <b>${feature.name}</b>\n${feature.description}\n<i>Öffne „Automatik“ (🤖) zum Einschalten.</i>`,
                        type: NotificationConstants.NotificationOption.info,
                        timeout: 30 * 1000,
                    });
                }
            }
        });
        this.feature<AutoFocus>('focus')?.refreshModes(silent);
    }

    public notify(message: string, type = NotificationConstants.NotificationOption.primary, timeout = 3000) {
        if (!this.showNotifications() && type !== NotificationConstants.NotificationOption.danger) {
            return;
        }
        Notifier.notify({ title: '🤖 Automatik', message, type, timeout });
    }

    public toggleAll(on: boolean) {
        this.features.filter((f) => f.unlocked()).forEach((f) => f.enabled(on));
    }

    public static open() {
        $('#automationModal').modal('show');
    }

    toJSON(): Record<string, any> {
        const features: Record<string, any> = {};
        this.features.forEach((f) => {
            features[f.id] = f.toJSON();
        });
        return {
            paused: this.paused(),
            showNotifications: this.showNotifications(),
            announced: [...this.announced],
            features,
        };
    }

    fromJSON(json: Record<string, any>): void {
        if (!json) {
            return;
        }
        this.paused(!!json.paused);
        this.showNotifications(json.showNotifications ?? false);
        this.announced = new Set(json.announced ?? []);
        Object.entries(json.features ?? {}).forEach(([id, data]) => {
            this.feature(id)?.fromJSON(data as Record<string, any>);
        });
    }
}
