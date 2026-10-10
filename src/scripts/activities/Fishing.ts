/// <reference path="../../declarations/DataStore/common/Saveable.d.ts" />

type FishingState = 'idle' | 'waiting' | 'bite' | 'result';

// M7: fishing mini game on routes with water Pokémon
class Fishing implements Saveable {
    saveKey = 'fishing';
    defaults: Record<string, any> = { caught: 0 };

    public caught: KnockoutObservable<number> = ko.observable(0);
    public state: KnockoutObservable<FishingState> = ko.observable('idle');
    public message: KnockoutObservable<string> = ko.observable('');
    public resultImage: KnockoutObservable<string> = ko.observable('');
    private timer: ReturnType<typeof setTimeout>;
    private biteAt = 0;

    public static waterPokemon(region = player.region, route = player.route): PokemonNameType[] {
        const data = Routes.getRoute(region, route);
        return (data?.pokemon.water ?? []).filter((name) => pokemonMap[name]?.id > 0);
    }

    public canFishHere = ko.pureComputed(() => Activities.rod() > 0 && App.game.gameState === GameConstants.GameState.fighting
        && Fishing.waterPokemon(player.region, player.route).length > 0);

    public static shinyChance(rod: number): number {
        return [0, 2048, 1024, 512][rod];
    }

    public open() {
        this.reset();
        $('#fishingModal').modal('show');
    }

    public reset() {
        clearTimeout(this.timer);
        this.state('idle');
        this.message('Cast your line and reel in when something bites!');
        this.resultImage('');
    }

    public cast() {
        if (!this.canFishHere()) {
            return;
        }
        clearTimeout(this.timer);
        const rod = Activities.rod();
        const wait = (rod === 3 ? 1 + Math.random() * 2 : rod === 2 ? 1.5 + Math.random() * 3 : 2 + Math.random() * 4) * 1000;
        this.state('waiting');
        this.message('Waiting for a bite…');
        this.resultImage('');
        this.timer = setTimeout(() => {
            this.state('bite');
            this.message('!! Something is biting – reel it in!');
            this.biteAt = Date.now();
            BattleSounds.play('shake');
            const window = [0, 1000, 1400, 1800][rod];
            this.timer = setTimeout(() => {
                if (this.state() === 'bite') {
                    this.state('result');
                    this.message('It got away… try again!');
                }
            }, window);
        }, wait);
    }

    public reel() {
        if (this.state() === 'waiting') {
            clearTimeout(this.timer);
            this.state('result');
            this.message('Too early, nothing is biting yet.');
            return;
        }
        if (this.state() !== 'bite') {
            return;
        }
        clearTimeout(this.timer);
        const rod = Activities.rod();
        const name = Rand.fromArray(Fishing.waterPokemon());
        const id = pokemonMap[name].id;
        const shiny = Rand.chance(1 / Fishing.shinyChance(rod));
        App.game.party.gainPokemonById(id, shiny);
        App.game.pokemonTraits.gainBond(id, 5);
        this.caught(this.caught() + 1);
        const extra: string[] = [];
        if (Rand.chance(0.2)) {
            const loot: ActivityLoot[] = [
                { kind: 'item', name: 'Heart_scale', amount: 1, weight: 10 },
                { kind: 'berry', amount: 2, weight: 10 },
                { kind: 'mint', weight: 4 },
            ];
            if (player.region >= GameConstants.Region.paldea) {
                loot.push({ kind: 'shards', amount: 3, weight: 14 });
            }
            extra.push(ActivityData.give(ActivityData.pick(loot), 1, player.region, pokemonMap[id].type[0]));
        }
        this.state('result');
        this.resultImage(PokemonHelper.getImage(id, shiny));
        this.message(`You fished up ${shiny ? 'a shiny ' : ''}${PokemonHelper.displayName(name)}!${extra.length ? ` Also found: ${extra.join(', ')}.` : ''}`);
        BattleSounds.play('caught');
    }

    toJSON(): Record<string, any> {
        return { caught: this.caught() };
    }

    fromJSON(json: Record<string, any>): void {
        this.caught(json?.caught ?? 0);
    }
}
