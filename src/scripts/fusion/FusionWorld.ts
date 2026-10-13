/// <reference path="../../declarations/DataStore/common/Saveable.d.ts" />
/// <reference path="./FusionData.ts" />

type FusionMon = { id: string, exp: number };
type FusionEnemy = { id: string, level: number, hp: number, maxHp: number };
type FusionTutorialEvent = 'defeat' | 'newCatch' | 'buyBalls';
type FusionTutorialStep = { title: string, text: string, event: FusionTutorialEvent, goal: number, reward: string, give: (world: FusionWorld) => void };

// A second, completely separate little game that runs next to the base game in its own window.
// It has its own team, levels, Pokédex, currency and progress and never changes anything of the base game.
class FusionWorld implements Saveable {
    saveKey = 'fusionWorld';
    defaults: Record<string, any> = {};

    public static readonly QUEST_LINE = 'The Fusion Experiment';
    // Short tutorial of the Fusion world. It has its own progress and rewards, like everything here.
    public static readonly TUTORIAL: FusionTutorialStep[] = [
        {
            title: 'Kämpfen in der Fusionswelt',
            text: 'Besiege 10 wilde Fusionen, z. B. auf Fusionspfad 1 (auf der Fusionskarte anklicken). Dein Fusions-Team greift von selbst an – mit Klicks auf die wilde Fusion hilfst du nach. Für jeden Sieg gibt es Fusionsenergie ⚡ und Erfahrung für das ganze Team.',
            event: 'defeat', goal: 10, reward: '10 Fusionsbälle',
            give: (world) => GameHelper.incrementObservable(world.balls.fusion, 10),
        },
        {
            title: 'Fusionen fangen',
            text: 'Fange 2 neue Fusionen. Nach einem Sieg wird automatisch ein Fusionsball geworfen. Im Modul „Fusions-Team“ wählst du Ball und Fangmodus. Im Fusionsdex siehst du Kopf und Körper jeder Fusion: der Kopf bestimmt Typ 1, der Körper Typ 2.',
            event: 'newCatch', goal: 2, reward: '100 ⚡ Fusionsenergie',
            give: (world) => GameHelper.incrementObservable(world.energy, 100),
        },
        {
            title: 'Energie und Fortschritt',
            text: 'Fusionsenergie gilt nur in der Fusionswelt. Kaufe im Fusions-Shop im Fusionslabor 10 Fusionsbälle. 25 Siege auf einem Fusionspfad öffnen den nächsten – so geht es bis zur Fusionsarena in Helixstadt.',
            event: 'buyBalls', goal: 10, reward: '3 Superfusionsbälle',
            give: (world) => GameHelper.incrementObservable(world.balls.super, 3),
        },
    ];

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
    public area: KnockoutObservable<string> = ko.observable('t1');
    // Fusions that have been met in battle (seen in the Fusion dex)
    public seen: KnockoutObservableArray<string> = ko.observableArray([]);
    public kills: KnockoutObservable<Record<string, number>> = ko.observable({});
    public badges: KnockoutObservableArray<string> = ko.observableArray([]);
    public announced = false;
    public tutorialStep: KnockoutObservable<number> = ko.observable(0);
    public tutorialProgress: KnockoutObservable<number> = ko.observable(0);

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
        if (!area) {
            return false;
        }
        if (area.unlock.badge && !this.badges().includes(area.unlock.badge)) {
            return false;
        }
        if (area.unlock.area && (this.kills()[area.unlock.area] ?? 0) < (area.unlock.kills ?? 0)) {
            return false;
        }
        return true;
    }

    public currentArea = ko.pureComputed(() => FusionData.area(this.area()));
    public inTown = ko.pureComputed(() => this.currentArea()?.kind === 'town');
    public inBattle = ko.pureComputed(() => this.started() && !this.inTown());

    public isSeen(id: string): boolean {
        return this.isCaught(id) || this.seen().includes(id);
    }

    public killsOn(id: string): number {
        return this.kills()[id] ?? 0;
    }

    // Town of a gym, to return there after the fight
    private gymTown(gymId: string): string {
        return FusionData.areas.find((a) => a.gym === gymId)?.id ?? 't1';
    }

    public startGym(gymId: string) {
        this.goTo(gymId);
    }
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
        this.counter = 0;
        if (area.kind === 'town') {
            this.enemy(null);
            return;
        }
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
            if (!this.seen().includes(member.id)) {
                this.seen.push(member.id);
            }
            this.enemy({ id: member.id, level: member.level, hp: member.hp, maxHp: member.hp });
            return;
        }
        if (!area.pokemon) {
            this.enemy(null);
            return;
        }
        const id = area.pokemon[Math.floor(Math.random() * area.pokemon.length)];
        if (!this.seen().includes(id)) {
            this.seen.push(id);
        }
        const level = area.levels[0] + Math.floor(Math.random() * (area.levels[1] - area.levels[0] + 1));
        const hp = Math.round(area.hp * (0.9 + Math.random() * 0.2));
        this.enemy({ id, level, hp, maxHp: hp });
    }

    public click() {
        if (!this.inBattle() || this.catching()) {
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
                this.goTo(this.gymTown(area.id));
                return;
            }
            this.spawn();
            return;
        }
        GameHelper.incrementObservable(this.energy, area.energy);
        const kills = { ...this.kills() };
        kills[area.id] = (kills[area.id] ?? 0) + 1;
        this.kills(kills);
        this.tutorialEvent('defeat');
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

    public catchChance(id: string): number {
        return Math.min(0.95, FusionData.catchRate(id) / 255 * 0.6 + 0.1 + FusionWorld.BALLS[this.ballChoice()].bonus);
    }

    private finishCatch() {
        const enemy = this.enemy();
        const chance = this.catchChance(enemy.id);
        const species = FusionData.speciesById(enemy.id);
        if (Math.random() < chance) {
            if (this.isCaught(enemy.id)) {
                GameHelper.incrementObservable(this.energy, enemy.level);
                this.addLog(`${species.name} gefangen – schon im Team, ${enemy.level} Fusionsenergie erhalten.`);
            } else {
                this.caught.push({ id: enemy.id, exp: Math.pow(enemy.level, 3) });
                this.addLog(`Neu: ${species.name} gefangen! (${this.dexCount()} / ${FusionData.species.length})`);
                this.tutorialEvent('newCatch');
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
        if (ball === 'fusion') {
            this.tutorialEvent('buyBalls', amount);
        }
    }

    public tutorial = ko.pureComputed(() => FusionWorld.TUTORIAL[this.tutorialStep()]);

    private tutorialEvent(event: FusionTutorialEvent, amount = 1) {
        const step = this.tutorial();
        if (!step || step.event !== event) {
            return;
        }
        this.tutorialProgress(Math.min(step.goal, this.tutorialProgress() + amount));
        // Nothing left to catch: the catching step cannot be done any more
        if (this.tutorialProgress() >= step.goal || (event === 'newCatch' && this.dexCount() >= FusionData.species.length)) {
            step.give(this);
            Notifier.notify({
                title: `🧬 Tutorial ${this.tutorialStep() + 1}/${FusionWorld.TUTORIAL.length} erledigt`,
                message: `${step.title} – Belohnung: ${step.reward}`,
                type: NotificationConstants.NotificationOption.success,
            });
            this.addLog(`Tutorial erledigt: ${step.title} (${step.reward})`);
            this.tutorialStep(this.tutorialStep() + 1);
            this.tutorialProgress(0);
        }
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
                message: 'Bills Experiment ist geglückt – willkommen in der Fusionsregion Helixia! Unter der Town Map gibt es jetzt die Fusionskarte und das Fusionsfenster. Wähle dort im Fusionslabor deinen ersten Fusionspartner.',
                type: NotificationConstants.NotificationOption.info,
                timeout: 60 * 1000,
            });
        }
        if (!this.starter() || this.inTown()) {
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
                this.goTo(this.gymTown(area.id));
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
            seen: this.seen(),
            kills: this.kills(),
            badges: this.badges(),
            announced: this.announced,
            tutorialStep: this.tutorialStep(),
            tutorialProgress: this.tutorialProgress(),
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
        this.area(!area ? 't1' : area.kind === 'gym' ? this.gymTown(area.id) : area.id);
        this.seen((json.seen ?? []).filter((id: string) => FusionData.speciesById(id)));
        this.kills(json.kills ?? {});
        this.badges(json.badges ?? []);
        this.announced = !!json.announced;
        this.tutorialStep(Math.min(json.tutorialStep ?? 0, FusionWorld.TUTORIAL.length));
        this.tutorialProgress(json.tutorialProgress ?? 0);
    }
}
