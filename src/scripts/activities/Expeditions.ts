/// <reference path="../../declarations/DataStore/common/Saveable.d.ts" />

type ActiveExpedition = {
    destination: string,
    members: number[],
    start: number,
    hours: number,
    chance: number,
    notified?: boolean,
};

// M1: send Pokémon that are not needed in battle on timed missions for items, currencies and bond
class Expeditions implements Saveable {
    saveKey = 'expeditions';
    defaults: Record<string, any> = { active: [] };

    public static readonly durations = [1, 4, 12];
    public static readonly TEAM_SIZE = 3;

    public active: KnockoutObservableArray<ActiveExpedition> = ko.observableArray([]);
    public selected: KnockoutObservableArray<number> = ko.observableArray([]);
    public destinationId: KnockoutObservable<string> = ko.observable(ActivityData.destinations[0].id);
    public hours: KnockoutObservable<number> = ko.observable(1);
    public lastReport: KnockoutObservableArray<string> = ko.observableArray([]);

    public awayIds = ko.pureComputed(() => new Set(this.active().flatMap((e) => e.members)));

    public slots = ko.pureComputed(() => {
        let slots = 1;
        if (player.highestRegion() >= GameConstants.Region.johto) {
            slots++;
        }
        if (player.highestRegion() >= GameConstants.Region.sinnoh) {
            slots++;
        }
        return slots + Research.slotBonus('expedition', Research.rank());
    });

    public availableDestinations = ko.pureComputed(() => ActivityData.destinations.filter((d) => d.region <= player.highestRegion()));

    public destination(id = this.destinationId()): ExpeditionDestination {
        return ActivityData.destinations.find((d) => d.id === id) ?? ActivityData.destinations[0];
    }

    public static difficulty(destination: ExpeditionDestination): number {
        return ActivityData.regionScale(destination.region) * 0.09;
    }

    public power(members: number[], destination: ExpeditionDestination): number {
        return members.reduce((sum, id) => {
            const pokemon = App.game.party.getPokemon(id);
            if (!pokemon) {
                return sum;
            }
            const data = pokemonMap[id];
            const typeMatch = data.type.some((t) => destination.types.includes(t)) ? 1.25 : 1;
            const nature = App.game.pokemonTraits.hasNatureEffect(id, 'expedition') ? 1.15 : 1;
            return sum + Activities.attackOf(pokemon) * typeMatch * nature;
        }, 0);
    }

    public chance(members: number[], destination: ExpeditionDestination): number {
        if (!members.length) {
            return 0;
        }
        return Math.max(0.2, Math.min(1, this.power(members, destination) / Expeditions.difficulty(destination)));
    }

    public previewChance = ko.pureComputed(() => this.chance(this.selected(), this.destination()));

    public toggleMember(id: number) {
        if (this.selected().includes(id)) {
            this.selected.remove(id);
        } else if (this.selected().length < Expeditions.TEAM_SIZE) {
            this.selected.push(id);
        }
    }

    // Suggests the strongest available Pokémon, preferring matching types
    public autoSelect() {
        const destination = this.destination();
        const ranked = Activities.available()
            .map((p) => ({ id: p.id, power: this.power([p.id], destination) }))
            .sort((a, b) => b.power - a.power)
            .slice(0, Expeditions.TEAM_SIZE)
            .map((p) => p.id);
        this.selected(ranked);
    }

    public canStart = ko.pureComputed(() => Activities.expeditionsUnlocked() && this.active().length < this.slots() && this.selected().length > 0
        && this.selected().every((id) => !Activities.isAway(id) && !App.game.party.getPokemon(id)?.breeding));

    public start() {
        if (!this.canStart()) {
            return;
        }
        const destination = this.destination();
        this.active.push({
            destination: destination.id,
            members: [...this.selected()],
            start: Date.now(),
            hours: this.hours(),
            chance: this.chance(this.selected(), destination),
        });
        this.selected([]);
    }

    public remaining(expedition: ActiveExpedition): number {
        return expedition.start + expedition.hours * 3600 * 1000 - Activities.now();
    }

    public checkFinished() {
        this.active().forEach((e) => {
            if (!e.notified && this.remaining(e) <= 0) {
                e.notified = true;
                Notifier.notify({
                    title: 'Expedition returned',
                    message: `Your team is back from ${this.destination(e.destination).name}. Collect the rewards in Activities.`,
                    type: NotificationConstants.NotificationOption.info,
                    setting: NotificationConstants.NotificationSetting.General.new_catch,
                });
            }
        });
    }

    public claim(expedition: ActiveExpedition) {
        if (this.remaining(expedition) > 0) {
            return;
        }
        const destination = this.destination(expedition.destination);
        const success = Math.random() < expedition.chance;
        const rolls = success ? expedition.hours * 2 : 1;
        const loot = ActivityData.lootFor(destination);
        const report: string[] = [];
        const shardType = () => Rand.fromArray(destination.types);
        for (let i = 0; i < rolls; i++) {
            report.push(ActivityData.give(ActivityData.pick(loot), 1, destination.region, shardType()));
        }
        expedition.members.forEach((id) => App.game.pokemonTraits.gainBond(id, (success ? 15 : 5) * expedition.hours));
        this.active.remove(expedition);
        this.lastReport([`${destination.name}: ${success ? 'success!' : 'the team came back early.'}`, ...report]);
        Notifier.notify({
            title: success ? 'Expedition successful' : 'Expedition failed',
            message: report.slice(0, 6).join('\n') + (report.length > 6 ? `\n… and ${report.length - 6} more` : ''),
            type: success ? NotificationConstants.NotificationOption.success : NotificationConstants.NotificationOption.warning,
        });
    }

    public claimAll() {
        this.active().filter((e) => this.remaining(e) <= 0).forEach((e) => this.claim(e));
    }

    toJSON(): Record<string, any> {
        return { active: this.active() };
    }

    fromJSON(json: Record<string, any>): void {
        const active = Array.isArray(json?.active) ? json.active : [];
        this.active(active.filter((e) => e && Array.isArray(e.members) && typeof e.start === 'number'));
    }
}
