// PokemonList has to be loaded first to avoid an import cycle with the evolution helpers
import { pokemonList, pokemonMap } from './PokemonList';
import arceusPlates from './ExtraEvolutions';
import { MegaStoneType, StoneType } from '../GameConstants';
import { DummyEvolution, LevelEvolution, StoneEvolution } from './evolutions/Base';
import { MegaEvolution, DayTimedLevelEvolution } from './evolutions/Methods';
import EvolutionInfo from './EvolutionInfo';
import ObtainedPokemonRequirement from '../requirements/ObtainedPokemonRequirement';
import PokemonLevelRequirement from '../requirements/PokemonLevelRequirement';

describe('EvolutionInfo', () => {
    it('ignores dummy and mega evolutions', () => {
        expect(EvolutionInfo.isRelevant(DummyEvolution('Pichu', 'Pikachu'))).toBe(false);
        expect(EvolutionInfo.isRelevant(MegaEvolution(MegaStoneType.Venusaurite, 'Venusaur', 'Mega Venusaur'))).toBe(false);
        expect(EvolutionInfo.isRelevant(LevelEvolution('Bulbasaur', 'Ivysaur', 16))).toBe(true);
        expect(EvolutionInfo.isRelevant(StoneEvolution('Pikachu', 'Raichu', StoneType.Thunder_stone))).toBe(true);
    });

    it('reads the required level', () => {
        expect(EvolutionInfo.requiredLevel(LevelEvolution('Bulbasaur', 'Ivysaur', 16))).toBe(16);
        expect(EvolutionInfo.requiredLevel(StoneEvolution('Pikachu', 'Raichu', StoneType.Thunder_stone))).toBeUndefined();
    });

    it('hides implicit conditions but keeps special ones', () => {
        const plain = EvolutionInfo.conditions(LevelEvolution('Bulbasaur', 'Ivysaur', 16));
        expect(plain.some((r) => r instanceof ObtainedPokemonRequirement || r instanceof PokemonLevelRequirement)).toBe(false);
        const timed = DayTimedLevelEvolution('Eevee', 'Espeon', 1);
        expect(EvolutionInfo.conditions(timed).length).toBeGreaterThan(plain.length);
    });

    it('finds prevolutions from the Pokémon list', () => {
        const prevos = EvolutionInfo.prevolutionsOf('Ivysaur', pokemonList);
        expect(prevos.map((e) => e.basePokemon)).toContain('Bulbasaur');
        expect(EvolutionInfo.prevolutionsOf('Bulbasaur', pokemonList)).toHaveLength(0);
    });
});

describe('Extra evolutions', () => {
    it('makes every Arceus form, Palafin (Hero) and Pawmot obtainable', () => {
        const arceusForms = pokemonMap['Arceus (Normal)'].evolutions.map((e) => e.evolvedPokemon);
        Object.keys(arceusPlates).forEach((type) => expect(arceusForms).toContain(`Arceus (${type})`));
        expect(arceusForms).toHaveLength(17);
        expect(pokemonMap['Palafin (Zero)'].evolutions.map((e) => e.evolvedPokemon)).toContain('Palafin (Hero)');
        expect(EvolutionInfo.requiredLevel(pokemonMap.Pawmo.evolutions[0])).toBe(32);
    });
});
