// Builds farm layouts that make a berry mutation possible. The layouts are found with a small randomised
// hill climb over the unlocked plots, using the mutation rules of the game itself, so every berry added
// later is supported automatically as long as its mutation uses one of the known rule types.

type FarmPlan = {
    target: BerryType,
    mutation: Mutation,
    // Berry to plant per plot index, BerryType.None = keep the plot empty
    layout: Record<number, BerryType>,
    // Number of plots where the mutation can happen with this layout
    spots: number,
    needed: Partial<Record<BerryType, number>>,
};

class FarmPlanner {
    private static readonly EMPTY = BerryType.None;
    private static cache = new Map<string, FarmPlan | null>();

    public static clearCache() {
        FarmPlanner.cache.clear();
    }

    public static unlockedPlots(): number[] {
        return App.game.farming.plotList.map((p, i) => (p.isUnlocked && !p.isSafeLocked ? i : -1)).filter((i) => i >= 0);
    }

    public static lockedBerries(): BerryType[] {
        return GameHelper.enumNumbers(BerryType)
            .filter((b) => b >= 0 && !App.game.farming.unlockedBerries[b]())
            .sort((a, b) => a - b);
    }

    public static mutationsFor(berry: BerryType): Mutation[] {
        return App.game.farming.mutations.filter((m) => m.mutatedBerry === berry && FarmPlanner.isSupported(m));
    }

    public static isSupported(m: Mutation): boolean {
        return m instanceof GrowNearBerryMutation || m instanceof GrowNearBerryStrictMutation || m instanceof GrowNearFlavorMutation
            || m instanceof EvolveNearBerryMutation || m instanceof EvolveNearBerryStrictMutation || m instanceof EvolveNearBerryMinMutation
            || m instanceof EvolveNearFlavorMutation || m instanceof FieldMutation || m instanceof FieldFlavorMutation;
    }

    public static plan(target: BerryType): FarmPlan | null {
        const plots = FarmPlanner.unlockedPlots();
        const key = `${target}:${plots.join(',')}`;
        if (FarmPlanner.cache.has(key)) {
            return FarmPlanner.cache.get(key);
        }
        let best: FarmPlan = null;
        for (const mutation of FarmPlanner.mutationsFor(target)) {
            let unlocked = false;
            try {
                unlocked = mutation.unlocked;
            } catch {
                unlocked = false;
            }
            if (!unlocked) {
                continue;
            }
            const plan = FarmPlanner.planMutation(mutation, plots);
            if (plan && plan.spots > 0 && (!best || plan.spots > best.spots)) {
                best = plan;
            }
        }
        FarmPlanner.cache.set(key, best);
        return best;
    }

    private static available(): BerryType[] {
        return GameHelper.enumNumbers(BerryType).filter((b) => b >= 0 && App.game.farming.unlockedBerries[b]());
    }

    private static flavors(berry: BerryType): number[] {
        return BerryList[berry].flavors.map((f) => f.value);
    }

    private static planMutation(m: Mutation, plots: number[]): FarmPlan | null {
        if (m instanceof FieldMutation) {
            return FarmPlanner.planField(m, plots);
        }
        if (m instanceof FieldFlavorMutation) {
            return FarmPlanner.planFieldFlavor(m, plots);
        }

        // Neighbour based mutations: target plots are empty (grow) or hold the original berry (evolve)
        const evolve = m instanceof EvolveNearBerryMutation || m instanceof EvolveNearBerryStrictMutation
            || m instanceof EvolveNearBerryMinMutation || m instanceof EvolveNearFlavorMutation;
        const original: BerryType = evolve ? (m as EvolveMutation).originalBerry : FarmPlanner.EMPTY;
        if (evolve && (original === undefined || !App.game.farming.unlockedBerries[original]())) {
            return null;
        }
        let options: BerryType[];
        let fits: (neighbours: BerryType[]) => boolean;
        if (m instanceof GrowNearBerryMutation || m instanceof EvolveNearBerryMutation) {
            const reqs = m.berryReqs;
            options = [...reqs];
            fits = (n) => reqs.every((r) => n.includes(r));
        } else if (m instanceof GrowNearBerryStrictMutation || m instanceof EvolveNearBerryStrictMutation) {
            const reqs = m.berryReqs;
            options = Object.keys(reqs).map((k) => +k);
            fits = (n) => {
                const counts: Record<number, number> = {};
                n.filter((b) => b !== FarmPlanner.EMPTY).forEach((b) => {
                    counts[b] = (counts[b] ?? 0) + 1;
                });
                return GameHelper.shallowEqual(reqs, counts);
            };
        } else if (m instanceof EvolveNearBerryMinMutation) {
            const reqs = m.berryReqs;
            options = Object.keys(reqs).map((k) => +k);
            fits = (n) => Object.entries(reqs).every(([b, c]) => n.filter((x) => x === +b).length >= c);
        } else {
            return FarmPlanner.planFlavorNear(m as GrowNearFlavorMutation | EvolveNearFlavorMutation, plots, evolve ? original : FarmPlanner.EMPTY);
        }
        if (options.some((b) => !App.game.farming.unlockedBerries[b]())) {
            return null;
        }
        // Plots holding the original berry also count as neighbours for strict and flavor rules
        const cellOptions = [FarmPlanner.EMPTY, ...options.filter((b) => b !== original)];
        if (evolve) {
            cellOptions.push(original);
        }
        const isTarget = (b: BerryType) => (evolve ? b === original : b === FarmPlanner.EMPTY);
        const plotSet = new Set(plots);
        const score = (layout: Record<number, BerryType>): number => {
            let spots = 0;
            plots.forEach((i) => {
                if (!isTarget(layout[i])) {
                    return;
                }
                const near = Plot.findNearPlots(i).map((j) => (plotSet.has(j) ? layout[j] : FarmPlanner.EMPTY));
                if (fits(near)) {
                    spots++;
                }
            });
            return spots;
        };
        const layout = FarmPlanner.hillClimb(plots, cellOptions, score, m.mutatedBerry);
        const spots = score(layout);
        return spots > 0 ? FarmPlanner.finish(m, layout, spots) : null;
    }

    // Deterministic pseudo random numbers so the same farm always gets the same layout
    private static random(seed: number): () => number {
        let s = seed >>> 0 || 1;
        return () => {
            s ^= s << 13;
            s ^= s >>> 17;
            s ^= s << 5;
            return ((s >>> 0) % 100000) / 100000;
        };
    }

    private static hillClimb(plots: number[], options: BerryType[], score: (l: Record<number, BerryType>) => number, seed: number): Record<number, BerryType> {
        const rand = FarmPlanner.random(seed * 7919 + plots.length);
        const pick = () => options[Math.floor(rand() * options.length)];
        let best: Record<number, BerryType> = null;
        let bestScore = -1;
        for (let restart = 0; restart < 4; restart++) {
            const layout: Record<number, BerryType> = {};
            plots.forEach((i) => {
                layout[i] = pick();
            });
            let current = score(layout);
            for (let step = 0; step < 2500; step++) {
                const i = plots[Math.floor(rand() * plots.length)];
                const before = layout[i];
                layout[i] = pick();
                const next = score(layout);
                if (next >= current) {
                    current = next;
                } else {
                    layout[i] = before;
                }
            }
            if (current > bestScore) {
                bestScore = current;
                best = { ...layout };
            }
        }
        return best;
    }

    // Finds a small set of berries whose summed flavors fit the ranges, then puts as many separate
    // "target + neighbours" groups on the farm as possible
    private static planFlavorNear(m: GrowNearFlavorMutation | EvolveNearFlavorMutation, plots: number[], original: BerryType): FarmPlan | null {
        const ranges = m.flavorReqs;
        const candidates = FarmPlanner.available()
            .filter((b) => b !== m.mutatedBerry && b !== original && App.game.farming.berryInventory[b]() > 0)
            .filter((b) => FarmPlanner.flavors(b).every((v, i) => v <= ranges[i][1]))
            .sort((a, b) => FarmPlanner.flavors(b).reduce((s, v) => s + v, 0) - FarmPlanner.flavors(a).reduce((s, v) => s + v, 0));
        const base = [0, 0, 0, 0, 0];
        let budget = 200000;
        let found: BerryType[] = null;
        const search = (start: number, chosen: BerryType[], sum: number[]) => {
            if (found || --budget < 0) {
                return;
            }
            if (chosen.length && ranges.every((r, i) => r[0] <= sum[i] && sum[i] <= r[1])) {
                found = [...chosen];
                return;
            }
            if (chosen.length >= 8) {
                return;
            }
            for (let c = start; c < candidates.length; c++) {
                const next = sum.map((v, i) => v + FarmPlanner.flavors(candidates[c])[i]);
                if (next.some((v, i) => v > ranges[i][1])) {
                    continue;
                }
                chosen.push(candidates[c]);
                search(c, chosen, next);
                chosen.pop();
                if (found) {
                    return;
                }
            }
        };
        search(0, [], base);
        if (!found) {
            return null;
        }
        const group = found as BerryType[];
        const plotSet = new Set(plots);
        const layout: Record<number, BerryType> = {};
        plots.forEach((i) => {
            layout[i] = FarmPlanner.EMPTY;
        });
        const used = new Set<number>();
        const centers = [...plots].sort((a, b) => FarmPlanner.distanceToCentre(a) - FarmPlanner.distanceToCentre(b));
        const fits = (i: number) => {
            const sum = [0, 0, 0, 0, 0];
            Plot.findNearPlots(i).filter((j) => plotSet.has(j) && layout[j] !== FarmPlanner.EMPTY).forEach((j) => {
                FarmPlanner.flavors(layout[j]).forEach((v, k) => {
                    sum[k] += v;
                });
            });
            return ranges.every((r, k) => r[0] <= sum[k] && sum[k] <= r[1]);
        };
        const isTarget = (i: number) => layout[i] === original;
        const countSpots = () => plots.filter((i) => isTarget(i) && fits(i)).length;
        let spots = 0;
        for (const center of centers) {
            const free = Plot.findNearPlots(center).filter((j) => plotSet.has(j) && !used.has(j));
            if (used.has(center) || free.length < group.length) {
                continue;
            }
            const before = { ...layout };
            layout[center] = original;
            free.slice(0, group.length).forEach((j, k) => {
                layout[j] = group[k];
            });
            const next = countSpots();
            if (next > spots) {
                spots = next;
                used.add(center);
                Plot.findNearPlots(center).forEach((j) => used.add(j));
            } else {
                Object.assign(layout, before);
            }
        }
        return spots > 0 ? FarmPlanner.finish(m, layout, spots) : null;
    }

    private static planField(m: FieldMutation, plots: number[]): FarmPlan | null {
        const fieldBerries = (m as any).fieldBerries as FieldMutationFieldBerry[];
        const total = fieldBerries.reduce((s, fb) => s + fb.amountRequired, 0);
        if (total >= plots.length) {
            return null;
        }
        const layout: Record<number, BerryType> = {};
        const queue: BerryType[] = fieldBerries.flatMap((fb) => Array(fb.amountRequired).fill(fb.berry));
        // Fill from the borders, so the empty plots are in the middle
        const ordered = [...plots].sort((a, b) => FarmPlanner.distanceToCentre(b) - FarmPlanner.distanceToCentre(a));
        ordered.forEach((i) => {
            layout[i] = queue.shift() ?? FarmPlanner.EMPTY;
        });
        return FarmPlanner.finish(m, layout, plots.length - total);
    }

    private static planFieldFlavor(m: FieldFlavorMutation, plots: number[]): FarmPlan | null {
        const need = [...m.fieldFlavor];
        const options = FarmPlanner.available().filter((b) => App.game.farming.berryInventory[b]() > 0);
        const chosen: BerryType[] = [];
        const missing = () => need.reduce((s, v) => s + Math.max(0, v), 0);
        while (missing() > 0 && chosen.length < plots.length - 1) {
            let bestBerry: BerryType = null;
            let bestGain = 0;
            options.forEach((b) => {
                const gain = FarmPlanner.flavors(b).reduce((s, v, i) => s + Math.min(v, Math.max(0, need[i])), 0);
                if (gain > bestGain) {
                    bestGain = gain;
                    bestBerry = b;
                }
            });
            if (bestBerry === null) {
                return null;
            }
            chosen.push(bestBerry);
            FarmPlanner.flavors(bestBerry).forEach((v, i) => {
                need[i] -= v;
            });
        }
        if (missing() > 0) {
            return null;
        }
        const layout: Record<number, BerryType> = {};
        const ordered = [...plots].sort((a, b) => FarmPlanner.distanceToCentre(b) - FarmPlanner.distanceToCentre(a));
        ordered.forEach((i) => {
            layout[i] = chosen.shift() ?? FarmPlanner.EMPTY;
        });
        const spots = Object.values(layout).filter((b) => b === FarmPlanner.EMPTY).length;
        return FarmPlanner.finish(m, layout, spots);
    }

    private static distanceToCentre(index: number): number {
        const x = index % GameConstants.FARM_PLOT_WIDTH;
        const y = Math.floor(index / GameConstants.FARM_PLOT_WIDTH);
        return Math.abs(x - 2) + Math.abs(y - 2);
    }

    private static finish(m: Mutation, layout: Record<number, BerryType>, spots: number): FarmPlan {
        const needed: Partial<Record<BerryType, number>> = {};
        Object.values(layout).filter((b) => b !== FarmPlanner.EMPTY).forEach((b) => {
            needed[b] = (needed[b] ?? 0) + 1;
        });
        return { target: m.mutatedBerry, mutation: m, layout, spots, needed };
    }
}
