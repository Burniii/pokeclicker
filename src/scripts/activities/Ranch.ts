/// <reference path="../../declarations/DataStore/common/Saveable.d.ts" />

type RanchResident = { id: number, since: number };

// M6: Pokémon living on the ranch produce resources by type over time instead of battling
class Ranch implements Saveable {
    saveKey = 'ranch';
    defaults: Record<string, any> = { residents: [] };

    public static readonly MAX_HOURS = 48;

    public residents: KnockoutObservableArray<RanchResident> = ko.observableArray([]);
    public lastReport: KnockoutObservableArray<string> = ko.observableArray([]);

    public residentIds = ko.pureComputed(() => new Set(this.residents().map((r) => r.id)));

    public slots = ko.pureComputed(() => 3 + Math.max(0, player.highestRegion() - GameConstants.Region.johto) + Research.slotBonus('ranch', Research.rank()));

    public add(id: number) {
        const pokemon = App.game.party.getPokemon(id);
        if (!Activities.ranchUnlocked() || !pokemon || pokemon.breeding || Activities.isAway(id) || this.residents().length >= this.slots()) {
            return;
        }
        this.residents.push({ id, since: Date.now() });
    }

    public remove(resident: RanchResident) {
        this.collect([resident]);
        this.residents.remove(resident);
    }

    public hours(resident: RanchResident): number {
        return Math.min(Ranch.MAX_HOURS, Math.max(0, (Activities.now() - resident.since) / 3600000));
    }

    public products(id: number): ActivityLoot[] {
        return pokemonMap[id].type.map((t) => ActivityData.ranchProduct(t));
    }

    public multiplier(id: number): number {
        const hearts = App.game.pokemonTraits.hearts(id);
        return (1 + 0.1 * hearts) * (App.game.pokemonTraits.hasNatureEffect(id, 'ranch') ? 1.15 : 1);
    }

    public collect(residents = this.residents()) {
        const report: string[] = [];
        const region = player.highestRegion();
        residents.forEach((resident) => {
            const hours = this.hours(resident);
            if (hours < 0.05) {
                return;
            }
            const products = this.products(resident.id);
            products.forEach((product) => {
                const amount = hours * this.multiplier(resident.id) / products.length;
                // items need whole amounts, keep the fraction for later
                if (product.kind === 'item' && amount * product.amount < 1) {
                    return;
                }
                report.push(`${PokemonHelper.displayName(pokemonMap[resident.id].name)}: ${ActivityData.give(product, amount, region)}`);
            });
            App.game.pokemonTraits.gainBond(resident.id, 10 * hours);
            resident.since = Date.now();
        });
        this.residents.valueHasMutated();
        if (report.length) {
            this.lastReport(report);
            Notifier.notify({
                title: 'Ranch',
                message: report.slice(0, 6).join('\n') + (report.length > 6 ? `\n… and ${report.length - 6} more` : ''),
                type: NotificationConstants.NotificationOption.success,
            });
        }
    }

    toJSON(): Record<string, any> {
        return { residents: this.residents() };
    }

    fromJSON(json: Record<string, any>): void {
        const residents = Array.isArray(json?.residents) ? json.residents : [];
        this.residents(residents.filter((r) => r && typeof r.id === 'number' && typeof r.since === 'number'));
    }
}
