/// <reference path="../AutomationFeature.ts" />

// Clicks the current enemy on routes, in gyms, dungeons and temporary battles
class AutoClick extends AutomationFeature {
    id = 'click';
    name = 'Auto-Klick';
    icon = '👆';
    group: AutomationGroup = 'basis';
    description = 'Greift automatisch per Klick an (Routen, Arenen, Dungeons, Sonderkämpfe).';
    unlockHint = 'Erhalte den Felsorden (Boulder Badge). Schnellere Stufen nach dem Kanto- und Johto-Champion.';
    interval = 60 * 60 * 1000; // has its own timer
    private timer: ReturnType<typeof setInterval> = null;

    settingDefs: AutomationSettingDef[] = [
        {
            key: 'clicksPerSecond',
            label: 'Klicks pro Sekunde',
            type: 'select',
            default: 5,
            options: () => [1, 2, 5, 10, 20].filter((c) => c <= AutoClick.maxClicksPerSecond()).map((c) => ({ value: c, text: `${c}/s` })),
            hint: 'Höhere Stufen: 10/s nach dem Kanto-Champion, 20/s nach dem Johto-Champion.',
        },
    ];

    public static maxClicksPerSecond(): number {
        if (App.game.badgeCase.hasBadge(BadgeEnums.Elite_JohtoChampion)) {
            return 20;
        }
        if (App.game.badgeCase.hasBadge(BadgeEnums.Elite_KantoChampion)) {
            return 10;
        }
        return 5;
    }

    public init() {
        super.init();
        this.settings.clicksPerSecond.subscribe(() => this.restart());
    }

    public isUnlocked(): boolean {
        return App.game.badgeCase.hasBadge(BadgeEnums.Boulder);
    }

    public onEnable() {
        this.restart();
    }

    public onDisable() {
        clearInterval(this.timer);
        this.timer = null;
    }

    private restart() {
        clearInterval(this.timer);
        this.timer = null;
        if (!this.enabled()) {
            return;
        }
        const cps = Math.max(1, Math.min(+this.setting('clicksPerSecond') || 1, 20));
        this.timer = setInterval(() => this.click(), Math.floor(1000 / cps));
    }

    private click() {
        if (!App.game || !this.active()) {
            return;
        }
        const cps = +this.setting('clicksPerSecond');
        if (cps > AutoClick.maxClicksPerSecond()) {
            this.settings.clicksPerSecond(AutoClick.maxClicksPerSecond());
            return;
        }
        Battle.autoClicking = true;
        try {
            this.run();
        } finally {
            Battle.autoClicking = false;
        }
    }

    public run() {
        switch (App.game.gameState) {
            case GameConstants.GameState.fighting:
                if (!Battle.catching()) {
                    Battle.clickAttack();
                }
                break;
            case GameConstants.GameState.gym:
                GymBattle.clickAttack();
                break;
            case GameConstants.GameState.dungeon:
                if (DungeonRunner.fighting() && !DungeonBattle.catching()) {
                    DungeonBattle.clickAttack();
                }
                break;
            case GameConstants.GameState.temporaryBattle:
                TemporaryBattleBattle.clickAttack();
                break;
        }
    }
}
