import ItemOwnedRequirement from '../requirements/ItemOwnedRequirement';
import QuestLineCompletedRequirement from '../requirements/QuestLineCompletedRequirement';
import { EvoData, LevelEvolution, restrict } from './evolutions/Base';
import { pokemonMap } from './PokemonList';
import { PokemonNameType } from './PokemonNameType';
import { ItemNameType } from '../items/ItemNameType';

// Evolutions that need requirements which can't be imported into PokemonList without an import cycle

const addEvolution = (evo: EvoData) => {
    const pokemon = pokemonMap[evo.basePokemon];
    pokemon.evolutions = [...(pokemon.evolutions ?? []), evo];
};

// Arceus takes the form of every Plate it owns once it reaches level 100 after the Arceus quest line
const arceusPlates: Record<string, ItemNameType> = {
    Fire: 'Flame_plate',
    Water: 'Splash_plate',
    Electric: 'Zap_plate',
    Grass: 'Meadow_plate',
    Ice: 'Icicle_plate',
    Fighting: 'Fist_plate',
    Poison: 'Toxic_plate',
    Ground: 'Earth_plate',
    Flying: 'Sky_plate',
    Psychic: 'Mind_plate',
    Bug: 'Insect_plate',
    Rock: 'Stone_plate',
    Ghost: 'Spooky_plate',
    Dragon: 'Draco_plate',
    Dark: 'Dread_plate',
    Steel: 'Iron_plate',
    Fairy: 'Pixie_plate',
};
Object.entries(arceusPlates).forEach(([type, plate]) => addEvolution(restrict(
    LevelEvolution('Arceus (Normal)', `Arceus (${type})` as PokemonNameType, 100, true),
    new ItemOwnedRequirement(plate),
    new QuestLineCompletedRequirement('Arceus: The Deified Pokémon'),
)));

// Palafin becomes a hero once it is strong enough
addEvolution(LevelEvolution('Palafin (Zero)', 'Palafin (Hero)', 50, true));

export default arceusPlates;
