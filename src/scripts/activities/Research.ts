/// <reference path="../../declarations/DataStore/common/Saveable.d.ts" />

type ResearchTask = { name: string, progress: (id: number) => number, goal: number };
type ResearchReward = { description: string, give: () => void };

// Research tasks per species (Legends: Arceus style). Stars give a small attack bonus to that Pokémon,
// the sum of all stars is the Research Rank which unlocks activity slots and rewards.
class Research implements Saveable {
    saveKey = 'research';
    defaults: Record<string, any> = { claimedRank: 0 };

    public static readonly tasks: ResearchTask[] = [
        { name: 'Catch', goal: 10, progress: (id) => App.game.statistics.pokemonCaptured[id]?.peek() ?? 0 },
        { name: 'Defeat', goal: 100, progress: (id) => App.game.statistics.pokemonDefeated[id]?.peek() ?? 0 },
        { name: 'Hatch', goal: 5, progress: (id) => App.game.statistics.pokemonHatched[id]?.peek() ?? 0 },
        { name: 'Bond (hearts)', goal: 3, progress: (id) => App.game.pokemonTraits.hearts(id) },
        { name: 'Catch or hatch a shiny', goal: 1, progress: (id) => (App.game.statistics.shinyPokemonCaptured[id]?.peek() ?? 0) + (App.game.statistics.shinyPokemonHatched[id]?.peek() ?? 0) },
    ];

    // Stars needed for a rank grow with every rank: 20, 60, 120, 200, ...
    public static starsForRank(rank: number): number {
        return 10 * rank * (rank + 1);
    }
    private static cache: Record<number, number> = {};
    public static version: KnockoutObservable<number> = ko.observable(0);
    public static totalStars: KnockoutObservable<number> = ko.observable(0);

    public claimedRank: KnockoutObservable<number> = ko.observable(0);

    public static stars(id: number): number {
        return Research.cache[id] ?? 0;
    }

    public static starsFor(id: number): number {
        return Research.tasks.filter((t) => t.progress(id) >= t.goal).length;
    }

    // Recalculates all stars, cheap enough to run once a minute
    public static refresh() {
        const cache: Record<number, number> = {};
        let total = 0;
        App.game.party.caughtPokemon.forEach((p) => {
            if (p.id <= 0) {
                return;
            }
            const stars = Research.starsFor(p.id);
            cache[p.id] = stars;
            total += stars;
        });
        const changed = total !== Research.totalStars.peek();
        Research.cache = cache;
        if (changed) {
            Research.totalStars(total);
            Research.version(Research.version.peek() + 1);
        }
    }

    public static rank: KnockoutComputed<number> = ko.pureComputed(() => {
        let rank = 0;
        while (Research.starsForRank(rank + 1) <= Research.totalStars()) {
            rank++;
        }
        return rank;
    });

    public static progressToNextRank: KnockoutComputed<{ current: number, needed: number }> = ko.pureComputed(() => {
        const rank = Research.rank();
        const base = Research.starsForRank(rank);
        return { current: Research.totalStars() - base, needed: Research.starsForRank(rank + 1) - base };
    });

    public static reward(rank: number): ResearchReward {
        if ([3, 8, 15, 24].includes(rank)) {
            return { description: '+1 expedition slot', give: () => {} };
        }
        if ([5, 12, 20, 26].includes(rank)) {
            return { description: '+1 ranch slot', give: () => {} };
        }
        if (rank % 4 === 0) {
            return { description: '3 Mints', give: () => App.game.pokemonTraits.gainMints(3) };
        }
        if (rank % 4 === 1) {
            return { description: `${5 + rank} Rare Candies`, give: () => player.gainItem('Rare_Candy', 5 + rank) };
        }
        if (rank % 4 === 2) {
            return { description: `${(2 + Math.floor(rank / 5))} of each vitamin`, give: () => ['Protein', 'Calcium', 'Carbos'].forEach((v) => player.gainItem(v, 2 + Math.floor(rank / 5))) };
        }
        return { description: '1 Mint and 10 Tera Shards of a random type', give: () => {
            App.game.pokemonTraits.gainMints(1);
            App.game.pokemonTraits.gainShards(Rand.intBetween(0, 17) as PokemonType, 10);
        } };
    }

    public static slotBonus(kind: 'expedition' | 'ranch', rank: number): number {
        const ranks = kind === 'expedition' ? [3, 8, 15, 24] : [5, 12, 20, 26];
        return ranks.filter((r) => rank >= r).length;
    }

    public claimRewards() {
        const rank = Research.rank();
        while (this.claimedRank() < rank) {
            const next = this.claimedRank() + 1;
            const reward = Research.reward(next);
            reward.give();
            this.claimedRank(next);
            Notifier.notify({
                title: `Research Rank ${next}`,
                message: `Reward: ${reward.description}`,
                type: NotificationConstants.NotificationOption.success,
            });
        }
    }

    public initialize() {
        Research.refresh();
        setInterval(() => Research.refresh(), 60 * 1000);
    }

    toJSON(): Record<string, any> {
        return { claimedRank: this.claimedRank() };
    }

    fromJSON(json: Record<string, any>): void {
        this.claimedRank(json?.claimedRank ?? 0);
    }
}
