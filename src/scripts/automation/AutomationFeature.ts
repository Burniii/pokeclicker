type AutomationGroup = 'basis' | 'farm' | 'instances' | 'focus';

type AutomationSettingOption = { value: any, text: string };

type AutomationSettingDef = {
    key: string,
    label: string,
    type: 'bool' | 'number' | 'select',
    default: any,
    options?: () => AutomationSettingOption[],
    min?: number,
    max?: number,
    hint?: string,
};

// One automation that can be switched on and off. The Automation engine calls run() every `interval` ms
// while the feature is enabled, unlocked and the automation is not paused.
abstract class AutomationFeature {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly icon: string;
    abstract readonly group: AutomationGroup;
    abstract readonly description: string;
    abstract readonly unlockHint: string;

    public interval = 1000;
    public settingDefs: AutomationSettingDef[] = [];
    // Optional knockout template for settings that don't fit the generic list
    public settingsTemplate: string = null;

    public enabled: KnockoutObservable<boolean> = ko.observable(false);
    public unlocked: KnockoutObservable<boolean> = ko.observable(false);
    public settings: Record<string, KnockoutObservable<any>> = {};
    public status: KnockoutObservable<string> = ko.observable('');
    public lastRun = 0;
    public errors = 0;
    public showSettings: KnockoutObservable<boolean> = ko.observable(false);

    // Only called once all subclass fields exist
    public init() {
        this.settingDefs.forEach((def) => {
            this.settings[def.key] = ko.observable(def.default);
        });
        this.enabled.subscribe((on) => {
            this.errors = 0;
            this.status('');
            on ? this.onEnable() : this.onDisable();
        });
    }

    public abstract isUnlocked(): boolean;
    public abstract run(): void;

    public onEnable() {}
    public onDisable() {}

    public active(): boolean {
        return this.enabled() && this.unlocked() && !App.game.automation.paused();
    }

    public setting<T = any>(key: string): T {
        return this.settings[key]?.();
    }

    public toggle() {
        if (!this.unlocked()) {
            return;
        }
        this.enabled(!this.enabled());
    }

    public toJSON(): Record<string, any> {
        const settings: Record<string, any> = {};
        Object.entries(this.settings).forEach(([key, obs]) => {
            settings[key] = obs();
        });
        return { enabled: this.enabled(), settings };
    }

    public fromJSON(json: Record<string, any>) {
        if (!json) {
            return;
        }
        Object.entries(json.settings ?? {}).forEach(([key, value]) => {
            this.settings[key]?.(value);
        });
        this.enabled(!!json.enabled);
    }
}
