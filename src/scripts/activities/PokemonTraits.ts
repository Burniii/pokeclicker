/// <reference path="../../declarations/DataStore/common/Saveable.d.ts" />

type NatureEffect = 'none' | 'attack' | 'breeding' | 'expedition' | 'ranch' | 'bond';
type Nature = { name: string, effect: NatureEffect };

// Bond, nature and Tera type of caught Pokémon. Natures default to a value derived from the trainer id,
// only changes (mints) are saved.
class PokemonTraits implements Saveable {
    saveKey = 'pokemonTraits';
    defaults: Record<string, any> = {};

    public static readonly natures: Nature[] = [
        { name: 'Hardy', effect: 'none' }, { name: 'Docile', effect: 'none' }, { name: 'Serious', effect: 'none' },
        { name: 'Bashful', effect: 'none' }, { name: 'Quirky', effect: 'none' },
        { name: 'Adamant', effect: 'attack' }, { name: 'Brave', effect: 'attack' }, { name: 'Lonely', effect: 'attack' }, { name: 'Naughty', effect: 'attack' },
        { name: 'Modest', effect: 'breeding' }, { name: 'Mild', effect: 'breeding' }, { name: 'Quiet', effect: 'breeding' }, { name: 'Rash', effect: 'breeding' },
        { name: 'Jolly', effect: 'expedition' }, { name: 'Hasty', effect: 'expedition' }, { name: 'Naive', effect: 'expedition' }, { name: 'Timid', effect: 'expedition' },
        { name: 'Bold', effect: 'ranch' }, { name: 'Impish', effect: 'ranch' }, { name: 'Lax', effect: 'ranch' }, { name: 'Relaxed', effect: 'ranch' },
        { name: 'Calm', effect: 'bond' }, { name: 'Gentle', effect: 'bond' }, { name: 'Careful', effect: 'bond' }, { name: 'Sassy', effect: 'bond' },
    ];

    public static readonly natureDescriptions: Record<NatureEffect, string> = {
        none: 'No special effect',
        attack: '+10% attack',
        breeding: 'Eggs hatch 10% faster',
        expedition: '+15% expedition power',
        ranch: '+15% ranch production',
        bond: '+25% bond gain',
    };

    // Bond points needed for 1..5 hearts
    public static readonly bondThresholds = [100, 300, 700, 1500, 3000];

    public bond: KnockoutObservable<Record<number, number>> = ko.observable({});
    public natureOverrides: KnockoutObservable<Record<number, number>> = ko.observable({});
    public tera: KnockoutObservable<Record<number, PokemonType>> = ko.observable({});
    public mints: KnockoutObservable<number> = ko.observable(0);
    public teraShards: KnockoutObservable<Record<number, number>> = ko.observable({});

    public natureIndex(id: number): number {
        const override = this.natureOverrides()[id];
        if (override !== undefined) {
            return override;
        }
        const seed = GameHelper.hash(`${player.trainerId}:${id}`);
        return Math.abs(seed) % PokemonTraits.natures.length;
    }

    public nature(id: number): Nature {
        return PokemonTraits.natures[this.natureIndex(id)];
    }

    public hasNatureEffect(id: number, effect: NatureEffect): boolean {
        return this.nature(id).effect === effect;
    }

    public bondPoints(id: number): number {
        return this.bond()[id] ?? 0;
    }

    public hearts(id: number): number {
        const points = this.bondPoints(id);
        return PokemonTraits.bondThresholds.filter((t) => points >= t).length;
    }

    public gainBond(id: number, amount: number) {
        if (amount <= 0 || !App.game.party.alreadyCaughtPokemon(id)) {
            return;
        }
        const before = this.hearts(id);
        const gain = amount * (this.hasNatureEffect(id, 'bond') ? 1.25 : 1);
        this.bond({ ...this.bond(), [id]: Math.min(PokemonTraits.bondThresholds[4], this.bondPoints(id) + gain) });
        const after = this.hearts(id);
        if (after > before) {
            Notifier.notify({
                message: `Your bond with ${PokemonHelper.displayName(pokemonMap[id].name)} grew to ${'❤'.repeat(after)}!`,
                pokemonImage: PokemonHelper.getImage(id),
                type: NotificationConstants.NotificationOption.success,
                setting: NotificationConstants.NotificationSetting.General.new_catch,
            });
        }
    }

    public teraType(id: number): PokemonType | undefined {
        return this.tera()[id];
    }

    public static teraUnlocked(): boolean {
        return player.highestRegion() >= GameConstants.Region.paldea;
    }

    public static readonly TERA_COST = 50;

    public setTera(id: number, type: PokemonType): boolean {
        const shards = this.teraShards()[type] ?? 0;
        if (!PokemonTraits.teraUnlocked() || shards < PokemonTraits.TERA_COST || !App.game.party.alreadyCaughtPokemon(id)) {
            return false;
        }
        this.teraShards({ ...this.teraShards(), [type]: shards - PokemonTraits.TERA_COST });
        this.tera({ ...this.tera(), [id]: type });
        return true;
    }

    public gainShards(type: PokemonType, amount: number) {
        if (type === PokemonType.None || amount <= 0) {
            return;
        }
        this.teraShards({ ...this.teraShards(), [type]: (this.teraShards()[type] ?? 0) + amount });
    }

    public gainMints(amount: number) {
        this.mints(this.mints() + amount);
    }

    public useMint(id: number, natureIndex: number): boolean {
        if (this.mints() < 1 || !App.game.party.alreadyCaughtPokemon(id) || this.natureIndex(id) === natureIndex) {
            return false;
        }
        this.mints(this.mints() - 1);
        this.natureOverrides({ ...this.natureOverrides(), [id]: natureIndex });
        return true;
    }

    // Combined attack bonus from bond, nature and research
    public attackMultiplier(id: number): number {
        Research.version();
        let multiplier = 1 + 0.02 * this.hearts(id);
        if (this.hasNatureEffect(id, 'attack')) {
            multiplier *= 1.1;
        }
        multiplier *= 1 + 0.01 * Research.stars(id);
        return multiplier;
    }

    toJSON(): Record<string, any> {
        return {
            bond: this.bond(),
            natureOverrides: this.natureOverrides(),
            tera: this.tera(),
            mints: this.mints(),
            teraShards: this.teraShards(),
        };
    }

    fromJSON(json: Record<string, any>): void {
        this.bond(json?.bond ?? {});
        this.natureOverrides(json?.natureOverrides ?? {});
        this.tera(json?.tera ?? {});
        this.mints(json?.mints ?? 0);
        this.teraShards(json?.teraShards ?? {});
    }
}
