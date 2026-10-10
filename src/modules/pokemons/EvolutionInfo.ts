import { AchievementOption, StoneType } from '../GameConstants';
import ObtainedPokemonRequirement from '../requirements/ObtainedPokemonRequirement';
import PokemonLevelRequirement from '../requirements/PokemonLevelRequirement';
import Requirement from '../requirements/Requirement';
import { EvoData, EvoTrigger, StoneEvoData } from './evolutions/Base';
import { PokemonNameType } from './PokemonNameType';

// Helpers to explain evolutions to the player (Pokédex details)
export default class EvolutionInfo {
    // Evolutions the player can trigger (no dummy evolutions or mega evolutions)
    public static isRelevant(evo: EvoData): boolean {
        if (evo.trigger === EvoTrigger.NONE) {
            return false;
        }
        return !(evo.trigger === EvoTrigger.STONE && (evo as StoneEvoData).stone === StoneType.Key_stone);
    }

    public static evolutionsFrom(evolutions: ReadonlyArray<EvoData> | undefined): EvoData[] {
        return (evolutions ?? []).filter((evo) => EvolutionInfo.isRelevant(evo));
    }

    public static prevolutionsOf(pokemon: PokemonNameType, allPokemon: ReadonlyArray<{ name: string, evolutions?: ReadonlyArray<EvoData> }>): EvoData[] {
        return allPokemon.flatMap((p) => EvolutionInfo.evolutionsFrom(p.evolutions).filter((evo) => evo.evolvedPokemon === pokemon));
    }

    public static requiredLevel(evo: EvoData): number | undefined {
        const req = evo.restrictions.find((r) => r instanceof PokemonLevelRequirement
            && r.pokemon === evo.basePokemon
            && r.option === AchievementOption.more);
        return req?.requiredValue;
    }

    // Restrictions worth showing; owning the base Pokémon, the level and
    // "evolved Pokémon not owned yet" are explained separately
    public static conditions(evo: EvoData): Requirement[] {
        return evo.restrictions.filter((r) => {
            if (r instanceof ObtainedPokemonRequirement) {
                return !(r.pokemon === evo.basePokemon || r.pokemon === evo.evolvedPokemon);
            }
            if (r instanceof PokemonLevelRequirement && r.pokemon === evo.basePokemon && r.option === AchievementOption.more) {
                return false;
            }
            return true;
        });
    }
}
