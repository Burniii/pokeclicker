/// <reference path="../../declarations/DataStore/common/Saveable.d.ts" />
/// <reference path="./FusionData.ts" />

type FusionMon = { id: string, exp: number };
type FusionEnemy = { id: string, level: number, hp: number, maxHp: number };

// A second, completely separate little game that runs next to the base game in its own window.
// It has its own team, levels, Pokédex, currency and progress and never changes anything of the base game.
class FusionWorld implements Saveable {
    saveKey = 'fusionWorld';
    defaults: Record<string, any> = {};

    public static readonly QUEST_LINE = 'The Fusion Experiment';
    public static readonly BALLS = {
        fusion: { name: 'Fusionsball', price: 10, bonus: 0 },
        super: { name: 'Superfusionsball', price: 40, bonus: 0.15 },
    };

    public starter: KnockoutObservable<string> = ko.observable(null);
    public caught: KnockoutObservableArray<FusionMon> = ko.observableArray([]);
    public energy: KnockoutObservable<number> = ko.observable(0);
    public balls: Record<'fusion' | 'super', KnockoutObservable<number>> = { fusion: ko.observable(0), super: ko.observable(0) };
    public ballChoice: KnockoutObservable<'fusion' | 'super'> = ko.observable('fusion');
    public catchMode: KnockoutObservable<'new' | 'all' | 'none'> = ko.observable('new');
    public area: KnockoutObservable<string> = ko.observable('f1');
    public kills: KnockoutObservable<Record<string, number>> = ko.observable({});
    public badges: KnockoutObservableArray<string> = ko.observableArray([]);
    public announced = false;

    // Runtime state (not saved)
    public enemy: KnockoutObservable<FusionEnemy> = ko.observable(null);
    public catching: KnockoutObservable<boolean> = ko.observable(false);
    public log: KnockoutObservableArray<string> = ko.observableArray([]);
    public gymIndex = 0;
    public gymTimeLeft: KnockoutObservable<number> = ko.observable(0);
    private counter = 0;
    private catchCountdown = 0;

    public unlocked = ko.pureComputed(() => App.game.quests.getQuestLine(FusionWorld.QUEST_LINE)?.state() === QuestLineState.ended);
    public started = ko.pureComputed(() => this.unlocked() && !!this.starter());

    public static levelOf(mon: FusionMon): number {
        return Math.max(1, Math.min(100, Math.floor(Math.cbrt(mon.exp))));
    }

    public isCaught(id: string): boolean {
        return this.caught().some((m) => m.id === id);
    }

    public teamAttack(target: string = this.enemy()?.id): number {
        const defender = target ? FusionData.types(target) : [PokemonType.None];
        return Math.max(1, Math.round(this.caught().reduce((sum, mon) => {
            const types = FusionData.types(mon.id);
            const modifier = TypeHelper.getAttackModifier(types[0], types[1] ?? PokemonType.None, defender[0], defender[1] ?? PokemonType.None);
            return sum + FusionData.attack(mon.id) * FusionWorld.levelOf(mon) / 100 * modifier;
        }, 0)));
    }

    public clickDamage = ko.pureComputed(() => 1 + this.caught().length + Math.round(this.teamAttack() * 0.05));

    public areaUnlocked(area: FusionArea): boolean {
        if (area.unlock.badge && !this.badges().includes(area.unlock.badge)) {
            return false;
        }
        if (area.unlock.area && (this.kills()[area.unlock.area] ?? 0) < (area.unlock.kills ?? 0)) {
            return false;
        }
        return true;
    }

    public currentArea = ko.pureComputed(() => FusionData.area(this.area()));
    public dexCount = ko.pureComputed(() => new Set(this.caught().map((m) => m.id)).size);

    public addLog(text: string) {
        this.log.unshift(text);
        if (this.log().length > 6) {
            this.log.pop();
        }
    }

    public chooseStarter(id: string) {
        if (this.starter() || !FusionData.starters.includes(id)) {
            return;
        }
        this.starter(id);
        this.caught.push({ id, exp: 125 });
        this.balls.fusion(20);
        this.addLog(`${FusionData.speciesById(id).name} ist dein erster Fusionspartner!`);
        this.goTo('f1');
    }

    public goTo(id: string) {
        const area = FusionData.area(id);
        if (!area || !this.areaUnlocked(area)) {
            return;
        }
        this.area(id);
        this.catching(false);
        if (area.kind === 'gym') {
            this.gymIndex = 0;
            this.gymTimeLeft(area.timeLimit);
            this.addLog(`${area.leader} fordert dich heraus!`);
        }
        this.spawn();
    }

    private spawn() {
        const area = this.currentArea();
        if (area.kind === 'gym') {
            const member = area.team[this.gymIndex];
            this.enemy({ id: member.id, level: member.level, hp: member.hp, maxHp: member.hp });
            return;
        }
        const id = area.pokemon[Math.floor(Math.random() * area.pokemon.length)];
        const level = area.levels[0] + Math.floor(Math.random() * (area.levels[1] - area.levels[0] + 1));
        const hp = Math.round(area.hp * (0.9 + Math.random() * 0.2));
        this.enemy({ id, level, hp, maxHp: hp });
    }

    public click() {
        if (!this.started() || this.catching()) {
            return;
        }
        this.damage(this.clickDamage());
    }

    private damage(amount: number) {
        const enemy = this.enemy();
        if (!enemy) {
            return;
        }
        enemy.hp = Math.max(0, enemy.hp - amount);
        this.enemy.valueHasMutated();
        if (enemy.hp <= 0) {
            this.defeated(enemy);
        }
    }

    private gainExp(amount: number) {
        const before = this.caught().map((m) => FusionWorld.levelOf(m));
        this.caught().forEach((m) => {
            m.exp += amount;
        });
        this.caught().forEach((m, i) => {
            if (FusionWorld.levelOf(m) > before[i] && FusionWorld.levelOf(m) % 10 === 0) {
                this.addLog(`${FusionData.speciesById(m.id).name} hat Level ${FusionWorld.levelOf(m)} erreicht!`);
            }
        });
        this.caught.valueHasMutated();
    }

    private defeated(enemy: FusionEnemy) {
        const area = this.currentArea();
        this.gainExp(enemy.level * 8);
        if (area.kind === 'gym') {
            this.gymIndex++;
            if (this.gymIndex >= area.team.length) {
                if (!this.badges().includes(area.badge)) {
                    this.badges.push(area.badge);
                    this.addLog(`Du hast den ${area.badge} erhalten! Ein neues Gebiet ist offen.`);
                    Notifier.notify({ title: '🧬 Fusionswelt', message: `${area.leader} besiegt – ${area.badge} erhalten!`, type: NotificationConstants.NotificationOption.success });
                } else {
                    this.addLog(`${area.leader} erneut besiegt.`);
                }
                GameHelper.incrementObservable(this.energy, area.reward);
                this.goTo(area.unlock.area ?? 'f4');
                return;
            }
            this.spawn();
            return;
        }
        GameHelper.incrementObservable(this.energy, area.energy);
        const kills = { ...this.kills() };
        kills[area.id] = (kills[area.id] ?? 0) + 1;
        this.kills(kills);
        const mode = this.catchMode();
        const wanted = mode === 'all' || (mode === 'new' && !this.isCaught(enemy.id));
        const ball = this.ballChoice();
        if (wanted && this.balls[ball]() > 0) {
            this.balls[ball](this.balls[ball]() - 1);
            this.catching(true);
            this.catchCountdown = 10;
            return;
        }
        this.spawn();
    }

    private finishCatch() {
        const enemy = this.enemy();
        const chance = Math.min(0.95, FusionData.catchRate(enemy.id) / 255 * 0.6 + 0.1 + FusionWorld.BALLS[this.ballChoice()].bonus);
        const species = FusionData.speciesById(enemy.id);
        if (Math.random() < chance) {
            if (this.isCaught(enemy.id)) {
                GameHelper.incrementObservable(this.energy, enemy.level);
                this.addLog(`${species.name} gefangen – schon im Team, ${enemy.level} Fusionsenergie erhalten.`);
            } else {
                this.caught.push({ id: enemy.id, exp: Math.pow(enemy.level, 3) });
                this.addLog(`Neu: ${species.name} gefangen! (${this.dexCount()} / ${FusionData.species.length})`);
                Notifier.notify({ title: '🧬 Fusionswelt', message: `${species.name} gefangen!`, image: FusionData.image(enemy.id), type: NotificationConstants.NotificationOption.success });
            }
        } else {
            this.addLog(`${species.name} ist entkommen.`);
        }
        this.catching(false);
        this.spawn();
    }

    public buy(ball: 'fusion' | 'super', amount: number) {
        const price = FusionWorld.BALLS[ball].price * amount;
        if (this.energy() < price) {
            return;
        }
        GameHelper.incrementObservable(this.energy, -price);
        GameHelper.incrementObservable(this.balls[ball], amount);
    }

    // Called from the base game tick (100 ms), but uses only its own state
    public tick() {
        if (!this.unlocked()) {
            return;
        }
        if (!this.announced) {
            this.announced = true;
            Notifier.notify({
                title: '🧬 Fusionswelt freigeschaltet',
                message: 'Bills Experiment ist geglückt! Öffne die Fusionswelt über den 🧬-Knopf unten links und wähle deinen ersten Fusionspartner.',
                type: NotificationConstants.NotificationOption.info,
                timeout: 60 * 1000,
            });
        }
        if (!this.starter()) {
            return;
        }
        if (!this.enemy()) {
            this.spawn();
        }
        if (this.catching()) {
            if (--this.catchCountdown <= 0) {
                this.finishCatch();
            }
            return;
        }
        if (++this.counter < 10) {
            return;
        }
        this.counter = 0;
        const area = this.currentArea();
        if (area.kind === 'gym') {
            this.gymTimeLeft(this.gymTimeLeft() - 1);
            if (this.gymTimeLeft() <= 0) {
                this.addLog(`Zeit abgelaufen – ${area.leader} war zu stark. Trainiere weiter!`);
                this.goTo(area.unlock.area ?? 'f4');
                return;
            }
        }
        this.damage(this.teamAttack());
    }

    toJSON(): Record<string, any> {
        return {
            starter: this.starter(),
            caught: this.caught(),
            energy: this.energy(),
            balls: { fusion: this.balls.fusion(), super: this.balls.super() },
            ballChoice: this.ballChoice(),
            catchMode: this.catchMode(),
            area: this.area(),
            kills: this.kills(),
            badges: this.badges(),
            announced: this.announced,
        };
    }

    fromJSON(json: Record<string, any>): void {
        if (!json) {
            return;
        }
        this.starter(json.starter ?? null);
        this.caught((json.caught ?? []).filter((m: FusionMon) => FusionData.speciesById(m.id)));
        this.energy(json.energy ?? 0);
        this.balls.fusion(json.balls?.fusion ?? 0);
        this.balls.super(json.balls?.super ?? 0);
        this.ballChoice(json.ballChoice ?? 'fusion');
        this.catchMode(json.catchMode ?? 'new');
        const area = FusionData.area(json.area);
        this.area(area && area.kind === 'route' ? json.area : 'f1');
        this.kills(json.kills ?? {});
        this.badges(json.badges ?? []);
        this.announced = !!json.announced;
    }
}
