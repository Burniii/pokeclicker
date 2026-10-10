/// <reference path="../../declarations/TemporaryScriptTypes.d.ts" />

type QuestTarget = {
    name: string,
    town?: Town,
    route?: { region: GameConstants.Region, route: number },
};

// Finds where quests take place, highlights them on the map and explains locked targets
class QuestNavigation {
    // Daily quests plus the current (unfinished) steps of active quest lines
    public static activeQuests: KnockoutComputed<Quest[]> = ko.pureComputed(() => {
        const quests: Quest[] = [...App.game.quests.currentQuests()];
        if (!Settings.getSetting('mapHighlightQuestLineTargets').observableValue()) {
            return quests;
        }
        App.game.quests.questLines().filter((ql) => ql.state() == QuestLineState.started).forEach((ql) => {
            const quest = ql.curQuestObject();
            if (quest instanceof MultipleQuestsQuest) {
                quests.push(...quest.quests.filter((q) => !q.isCompleted()));
            } else if (quest instanceof Quest && !quest.isCompleted()) {
                quests.push(quest);
            }
        });
        return quests;
    });

    public static isTemporaryBattleTarget(battleName: string): boolean {
        return QuestNavigation.activeQuests().some((q) => q instanceof DefeatTemporaryBattleQuest && q.temporaryBattle == battleName);
    }

    public static isNPCTarget(town: Town): boolean {
        return !!town.npcs?.length && QuestNavigation.activeQuests().some((q) => q instanceof TalkToNPCQuest && town.npcs.includes(q.npc));
    }

    public static isCaptureTarget(pokemon: PokemonNameType[]): boolean {
        return QuestNavigation.activeQuests().some((q) => q instanceof CaptureSpecificPokemonQuest && pokemon.includes(q.pokemon.name));
    }

    private static townOfNPC(npc: NPC): Town | undefined {
        return Object.values(TownList).find((t) => t.npcs?.includes(npc));
    }

    private static gymTown(gymTown: string): Town | undefined {
        return GymList[gymTown]?.parent ?? TownList[gymTown];
    }

    public static getTargets(quest: Quest): QuestTarget[] {
        if (quest instanceof MultipleQuestsQuest) {
            return quest.quests.filter((q) => !q.isCompleted()).flatMap((q) => QuestNavigation.getTargets(q));
        }
        if (quest instanceof DefeatTemporaryBattleQuest) {
            const town = TemporaryBattleList[quest.temporaryBattle]?.getTown();
            return town ? [{ name: town.name, town }] : [];
        }
        if (quest instanceof TalkToNPCQuest) {
            const town = QuestNavigation.townOfNPC(quest.npc);
            return town ? [{ name: town.name, town }] : [];
        }
        if (quest instanceof DefeatGymQuest) {
            const town = QuestNavigation.gymTown(quest.gymTown);
            return town ? [{ name: town.name, town }] : [];
        }
        if (quest instanceof DefeatDungeonQuest || quest instanceof DefeatDungeonBossQuest) {
            const town = TownList[(quest as DefeatDungeonQuest).dungeon];
            return town ? [{ name: town.name, town }] : [];
        }
        if (quest instanceof DefeatPokemonsQuest) {
            return [{ name: Routes.getName(quest.route, quest.region), route: { region: quest.region, route: quest.route } }];
        }
        if (quest instanceof CaptureSpecificPokemonQuest) {
            const name = quest.pokemon.name;
            const routes = (Object.entries(PokemonLocations.getPokemonRegionRoutes(name, player.highestRegion()) ?? {}) as [string, Array<{ route: number }>][])
                .flatMap(([region, list]) => list.map(({ route }) => ({ region: +region, route })));
            const dungeons = [
                ...PokemonLocations.getPokemonDungeons(name, player.highestRegion()),
                ...PokemonLocations.getPokemonBossDungeons(name, player.highestRegion()),
            ].map((d: { dungeon: string }) => TownList[d.dungeon]).filter((t) => t);
            return [
                ...routes.map((r) => ({ name: Routes.getName(r.route, r.region), route: r })),
                ...dungeons.map((town) => ({ name: town.name, town })),
            ];
        }
        return [];
    }

    private static isUnlocked(target: QuestTarget): boolean {
        if (target.route) {
            return MapHelper.accessToRoute(target.route.route, target.route.region);
        }
        return !!target.town?.isUnlocked();
    }

    // The thing the quest itself waits for (battle, gym) can be locked even if its town is open
    private static questRequirements(quest: Quest): Requirement[] {
        if (quest instanceof DefeatTemporaryBattleQuest) {
            const battle = TemporaryBattleList[quest.temporaryBattle];
            return battle && !battle.isUnlocked() ? battle.requirements : [];
        }
        if (quest instanceof DefeatGymQuest) {
            const gym = GymList[quest.gymTown];
            return gym && !gym.isUnlocked() ? gym.requirements : [];
        }
        return [];
    }

    // Describes the first thing the player has to do before the quest can progress, or '' if nothing blocks it
    public static getBlocker(quest: Quest): string {
        if (!quest || quest.isCompleted?.()) {
            return '';
        }
        const quests = quest instanceof MultipleQuestsQuest ? quest.quests.filter((q) => !q.isCompleted()) : [quest];
        for (const q of quests) {
            const targets = QuestNavigation.getTargets(q);
            if (targets.length && !targets.some((t) => QuestNavigation.isUnlocked(t))) {
                const target = targets[0];
                const requirements = target.route
                    ? Routes.getRoute(target.route.region, target.route.route)?.requirements ?? []
                    : target.town.requirements;
                const step = QuestNavigation.resolve(requirements, 0);
                if (step) {
                    return step;
                }
            }
            const step = QuestNavigation.resolve(QuestNavigation.questRequirements(q), 0);
            if (step) {
                return step;
            }
        }
        return '';
    }

    private static resolve(requirements: Requirement[], depth: number): string {
        const unmet = requirements.find((r) => !r.isCompleted());
        if (!unmet) {
            return '';
        }
        return QuestNavigation.describe(unmet, depth);
    }

    private static describe(req: Requirement, depth: number): string {
        if (depth > 300) {
            return req.hint();
        }
        try {
            if (req instanceof MultiRequirement) {
                return QuestNavigation.resolve(req.requirements, depth + 1);
            }
            if (req instanceof TemporaryBattleRequirement) {
                const battle = TemporaryBattleList[req.battleName];
                const town = battle?.getTown();
                if (town && !town.isUnlocked()) {
                    return QuestNavigation.resolve(town.requirements, depth + 1) || req.hint();
                }
                if (battle && !battle.isUnlocked()) {
                    return QuestNavigation.resolve(battle.requirements, depth + 1) || req.hint();
                }
                return `Defeat ${battle?.getDisplayName() ?? req.battleName}${town ? ` in ${town.name}` : ''}.`;
            }
            if (req instanceof RouteKillRequirement) {
                const route = Routes.getRoute(req.region, req.route);
                if (route && !route.isUnlocked()) {
                    return QuestNavigation.resolve(route.requirements, depth + 1) || req.hint();
                }
                return `Defeat ${GameConstants.ROUTE_KILLS_NEEDED} Pokémon on ${Routes.getName(req.route, req.region, true)}.`;
            }
            if (req instanceof ClearDungeonRequirement) {
                const dungeonName = GameConstants.RegionDungeons.flat()[req.dungeonIndex];
                const town = TownList[dungeonName];
                if (town && !town.isUnlocked()) {
                    return QuestNavigation.resolve(town.requirements, depth + 1) || req.hint();
                }
                return `Clear the ${dungeonName} dungeon.`;
            }
            if (req instanceof GymBadgeRequirement) {
                const gym = Object.values(GymList).find((g) => g.badgeReward === req.badge);
                if (gym) {
                    const town = QuestNavigation.gymTown(gym.town);
                    if (town && !town.isUnlocked()) {
                        return QuestNavigation.resolve(town.requirements, depth + 1) || req.hint();
                    }
                    if (!gym.isUnlocked()) {
                        return QuestNavigation.resolve(gym.requirements, depth + 1) || req.hint();
                    }
                    return `Defeat ${gym.leaderName}${town && town.name !== gym.leaderName ? ` at ${town.name}` : ''}.`;
                }
            }
            return req.hint();
        } catch {
            return '';
        }
    }

    public static canNavigate(quest: Quest): boolean {
        return QuestNavigation.getTargets(quest).length > 0;
    }

    // Travels to the first reachable target in the current region, otherwise explains why that's not possible
    public static navigate(quest: Quest) {
        const targets = QuestNavigation.getTargets(quest);
        const open = targets.filter((t) => QuestNavigation.isUnlocked(t));
        const regionOf = (t: QuestTarget) => t.route?.region ?? t.town?.region;
        const subRegionOf = (t: QuestTarget) => (t.route ? Routes.getRoute(t.route.region, t.route.route)?.subRegion ?? 0 : t.town?.subRegion ?? 0);
        const here = open.find((t) => regionOf(t) == player.region && subRegionOf(t) == player.subregion);
        if (here) {
            if (here.route) {
                MapHelper.moveToRoute(here.route.route, here.route.region);
            } else {
                MapHelper.moveToTown(here.town.name);
            }
            return;
        }
        if (open.length) {
            const target = open[0];
            const region = GameConstants.camelCaseToString(GameConstants.Region[regionOf(target)]);
            const subRegion = SubRegions.getSubRegionById(regionOf(target), subRegionOf(target))?.name;
            return Notifier.notify({
                message: `${target.name} is in ${subRegion && subRegion !== region ? `${subRegion} (${region})` : region}. Travel there first.`,
                type: NotificationConstants.NotificationOption.info,
            });
        }
        const blocker = QuestNavigation.getBlocker(quest);
        Notifier.notify({
            message: targets.length
                ? `${targets[0].name} is not accessible yet.${blocker ? `\n<i>${blocker}</i>` : ''}`
                : 'This quest has no specific location.',
            type: NotificationConstants.NotificationOption.warning,
        });
    }
}
