import BadgeEnums from '../enums/Badges';
import { AchievementOption } from '../GameConstants';
import CaughtPokemonRequirement from '../requirements/CaughtPokemonRequirement';
import GymBadgeRequirement from '../requirements/GymBadgeRequirement';
import QuestLineCompletedRequirement from '../requirements/QuestLineCompletedRequirement';
import Requirement from '../requirements/Requirement';
import TemporaryBattleRequirement from '../requirements/TemporaryBattleRequirement';

class ShinySpeciesRequirement extends Requirement {
    constructor(amount: number) {
        super(amount, AchievementOption.more);
    }

    public getProgress() {
        const species = new Set(App.game.party.caughtPokemon.filter((p) => p.id > 0 && p.shiny).map((p) => Math.floor(p.id)));
        return Math.min(species.size, this.requiredValue);
    }

    public hint(): string {
        return `${this.requiredValue} different shiny Pokémon need to be caught.`;
    }
}

export type TrainerCardFrame = {
    id: number;
    name: string;
    animated: boolean;
    requirement?: Requirement;
};

// Frames for the trainer card, unlocked by progress (ids are saved, only append new ones)
export default class TrainerCardFrames {
    private static cached: TrainerCardFrame[];

    public static get list(): TrainerCardFrame[] {
        if (!TrainerCardFrames.cached) {
            TrainerCardFrames.cached = [
                { id: 0, name: 'None', animated: false },
                { id: 1, name: 'Bronze', animated: false, requirement: new CaughtPokemonRequirement(151) },
                { id: 2, name: 'Silver', animated: false, requirement: new CaughtPokemonRequirement(500) },
                { id: 3, name: 'Gold', animated: false, requirement: new CaughtPokemonRequirement(1000) },
                { id: 4, name: 'Champion', animated: false, requirement: new GymBadgeRequirement(BadgeEnums.Elite_KantoChampion) },
                { id: 5, name: 'Shimmering', animated: true, requirement: new ShinySpeciesRequirement(100) },
                { id: 6, name: 'Hisuian Noble', animated: true, requirement: new QuestLineCompletedRequirement('The Rift of Hisui') },
                { id: 7, name: 'Terastal', animated: true, requirement: new QuestLineCompletedRequirement('Blueberry: The Indigo Disk') },
                { id: 8, name: 'Masters', animated: true, requirement: new QuestLineCompletedRequirement('The Masters Eight') },
                { id: 9, name: 'Monarch', animated: true, requirement: new TemporaryBattleRequirement('Monarch Ash', 10) },
            ];
        }
        return TrainerCardFrames.cached;
    }

    public static isUnlocked(id: number): boolean {
        const frame = TrainerCardFrames.list.find((f) => f.id === id);
        return !!frame && (frame.requirement?.isCompleted() ?? true);
    }
}
