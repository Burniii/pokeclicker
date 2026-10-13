// Data of the Festival Archipelago: a small event region with costume Pokémon (original Pokémon GO sprites).
// Every island opens with a quest line after the Champion of one main region; caught Pokémon go into the normal Pokédex.

type FestivalArea = {
    id: string,
    name: string,
    // Island stage 1-9 (stage n opens after the Champion of region n)
    stage: number,
    kind: 'town' | 'route' | 'cave',
    // Clickable area on the Festival map in map tiles (16px)
    map: { x: number, y: number, w: number, h: number },
    pokemon?: PokemonNameType[],
    // Rare Pokémon (5% of the encounters)
    rare?: PokemonNameType[],
    // Caves open after enough defeats on their island
    unlockKills?: { area: string, kills: number },
};

type FestivalStage = {
    questLine: QuestLineNameType,
    region: GameConstants.Region,
    badge: BadgeEnums,
    board: GameConstants.BulletinBoards,
    island: string,
    town: string,
    background: string,
};

class FestivalData {
    public static readonly STAGES: FestivalStage[] = [
        { questLine: 'The Festival Archipelago', region: GameConstants.Region.kanto, badge: BadgeEnums.Elite_KantoChampion, board: GameConstants.BulletinBoards.Kanto, island: 'Party-Insel', town: 'Vermilion City', background: '' },
        { questLine: 'Festival: Lantern Night', region: GameConstants.Region.johto, badge: BadgeEnums.Elite_JohtoChampion, board: GameConstants.BulletinBoards.Johto, island: 'Laternen-Insel', town: 'Olivine City', background: 'forest' },
        { questLine: 'Festival: Millennium Comet', region: GameConstants.Region.hoenn, badge: BadgeEnums.Elite_HoennChampion, board: GameConstants.BulletinBoards.Hoenn, island: 'Kometen-Insel', town: 'Slateport City', background: '' },
        { questLine: 'Festival: Contest Gala', region: GameConstants.Region.sinnoh, badge: BadgeEnums.Elite_SinnohChampion, board: GameConstants.BulletinBoards.Sinnoh, island: 'Wettbewerbs-Insel', town: 'Hearthome City', background: 'forest' },
        { questLine: 'Festival: Amusement Park', region: GameConstants.Region.unova, badge: BadgeEnums.Elite_UnovaChampion, board: GameConstants.BulletinBoards.Unova, island: 'Freizeitpark-Insel', town: 'Castelia City', background: '' },
        { questLine: 'Festival: Spooky Night', region: GameConstants.Region.kalos, badge: BadgeEnums.Elite_KalosChampion, board: GameConstants.BulletinBoards.Kalos, island: 'Grusel-Insel', town: 'Lumiose City', background: 'graveyard' },
        { questLine: 'Festival: Beach Party', region: GameConstants.Region.alola, badge: BadgeEnums.Champion_Stamp, board: GameConstants.BulletinBoards.Alola, island: 'Strand-Insel', town: 'Hau\'oli City', background: 'water' },
        { questLine: 'Festival: Stadium Party', region: GameConstants.Region.galar, badge: BadgeEnums.Elite_GalarChampion, board: GameConstants.BulletinBoards.Galar, island: 'Stadion-Insel', town: 'Hulbury', background: 'battlefield' },
        { questLine: 'Festival: Crown Parade', region: GameConstants.Region.paldea, badge: BadgeEnums.Elite_PaldeaChampion, board: GameConstants.BulletinBoards.Paldea, island: 'Kronen-Insel', town: 'Mesagoza', background: '' },
    ];

    public static readonly areas: FestivalArea[] = [
        { id: 'plaza', name: 'Festplatz', stage: 1, kind: 'town', map: { x: 44, y: 27, w: 12, h: 6 } },
        { id: 'r1', name: 'Party-Insel', stage: 1, kind: 'route', map: { x: 2, y: 29, w: 20, h: 2 }, pokemon: ['Bulbasaur (Party Hat)', 'Ivysaur (Party Hat)', 'Venusaur (Party Hat)', 'Squirtle (Sunglasses)', 'Wartortle (Sunglasses)', 'Blastoise (Sunglasses)', 'Detective Pikachu', 'Jigglypuff (Ribbon)', 'Wigglytuff (Ribbon)', 'Diglett (Bowler Hat)', 'Dugtrio (Bowler Hat)', 'Psyduck (Concierge)', 'Lapras (Scarf)', 'Snorlax (Studded Jacket)', 'Dragonite (Fashion)'] },
        { id: 'r2', name: 'Laternen-Insel', stage: 2, kind: 'route', map: { x: 4, y: 6, w: 18, h: 2 }, pokemon: ['Pichu (Party Hat)', 'Togepi (Flowering Crown)', 'Togetic (Flowering Crown)', 'Hoothoot (New Year Hat)', 'Noctowl (New Year Hat)', 'Wooper (Beanie)', 'Quagsire (Beanie)', 'Delibird (Holiday)', 'Stantler (Bells)', 'Smoochum (Bow)', 'Sneasel (Fashion)', 'Espeon (Day Scarf)', 'Umbreon (Night Scarf)'], rare: ['Lugia (Apex)', 'Ho-Oh (Apex)'] },
        { id: 'r3', name: 'Kometen-Insel', stage: 3, kind: 'route', map: { x: 25, y: 6, w: 22, h: 2 }, pokemon: ['Wurmple (Party Hat)', 'Kirlia (Bowler Hat)', 'Gardevoir (Meloetta Hat)', 'Slakoth (Visor)', 'Vigoroth (Visor)', 'Slaking (Visor)', 'Sableye (Litwick Hat)', 'Flygon (Meloetta Hat)', 'Duskull (Cempasuchil Crown)', 'Dusclops (Cempasuchil Crown)', 'Dusknoir (Cempasuchil Crown)', 'Absol (Fashion)', 'Spheal (Holiday)'] },
        { id: 'r4', name: 'Wettbewerbs-Insel', stage: 4, kind: 'route', map: { x: 51, y: 6, w: 22, h: 2 }, pokemon: ['Turtwig (Lucas Hat)', 'Chimchar (Lucas Hat)', 'Piplup (Lucas Hat)', 'Drifblim (Halloween)', 'Buneary (Flower Crown)', 'Lopunny (Flower Crown)', 'Croagunk (Cap)', 'Toxicroak (Cap)', 'Elekid (Spark Bracelet)', 'Electabuzz (Spark Bracelet)', 'Electivire (Spark Bracelet)', 'Togekiss (Flower Crown)', 'Leafeon (Explorer Hat)', 'Glaceon (Explorer Hat)'] },
        { id: 'r5', name: 'Freizeitpark-Insel', stage: 5, kind: 'route', map: { x: 76, y: 6, w: 11, h: 2 }, pokemon: ['Blitzle (Fashion)', 'Minccino (Fashion)', 'Cinccino (Fashion)', 'Cottonee (Flower Crown)', 'Whimsicott (Flower Crown)', 'Cubchoo (Holiday)', 'Beartic (Holiday)'] },
        { id: 'c5', name: 'Achterbahn-Höhle', stage: 5, kind: 'cave', map: { x: 79, y: 13, w: 3, h: 3 }, pokemon: ['Eevee (Explorer Hat)', 'Vaporeon (Explorer Hat)', 'Jolteon (Explorer Hat)', 'Flareon (Explorer Hat)', 'Sylveon (Explorer Hat)'], unlockKills: { area: 'r5', kills: 50 } },
        { id: 'r6', name: 'Grusel-Insel', stage: 6, kind: 'route', map: { x: 87, y: 22, w: 2, h: 19 }, pokemon: ['Froakie (Halloween)', 'Frogadier (Halloween)', 'Greninja (Halloween)', 'Dedenne (Holiday)', 'Pumpkaboo (Spooky Festival)', 'Gourgeist (Spooky Festival)', 'Vulpix (Spooky Festival)', 'Ninetales (Spooky Festival)', 'Gengar (Spooky Festival)', 'Pikachu (Witch)', 'Raichu (Witch)'] },
        { id: 'r7', name: 'Strand-Insel', stage: 7, kind: 'route', map: { x: 74, y: 52, w: 13, h: 2 }, pokemon: ['Rowlet (Halloween)', 'Dartrix (Halloween)', 'Decidueye (Halloween)', 'Charjabug (Holiday)', 'Vikavolt (Holiday)', 'Bewear (Cape)', 'Pichu (Summer)', 'Pikachu (Summer)', 'Raichu (Summer)', 'Pikachu (Kariyushi)', 'Pikachu (Straw Hat)'] },
        { id: 'r8', name: 'Stadion-Insel', stage: 8, kind: 'route', map: { x: 48, y: 52, w: 23, h: 2 }, pokemon: ['Wooloo (Holiday)', 'Dubwool (Holiday)', 'Falinks (Train)', 'Cubone (Cempasuchil Crown)', 'Marowak (Cempasuchil Crown)'] },
        { id: 'c8', name: 'Stadion-Höhle', stage: 8, kind: 'cave', map: { x: 65, y: 49, w: 3, h: 3 }, pokemon: ['Charmander (Party Hat)', 'Charmeleon (Party Hat)', 'Charizard (Party Hat)', 'Pikachu (Worlds 2022)', 'Raichu (World Cap)', 'Pikachu (Calem Hat)'], unlockKills: { area: 'r8', kills: 50 } },
        { id: 'r9', name: 'Kronen-Insel', stage: 9, kind: 'route', map: { x: 21, y: 52, w: 22, h: 2 }, pokemon: ['Floragato (Liko Hat)', 'Eevee (Sun Crown)', 'Eevee (Moon Crown)', 'Pikachu (Amethyst Crown)', 'Pikachu (Aquamarine Crown)', 'Pikachu (Malachite Crown)', 'Pikachu (Pyrite Crown)', 'Pikachu (Quartz Crown)', 'Pikachu (TCG)', 'Pikachu (Worlds 2024)'] },
        { id: 'c9', name: 'Geheimhöhle', stage: 9, kind: 'cave', map: { x: 8, y: 49, w: 3, h: 3 }, pokemon: ['Armored Mewtwo'], unlockKills: { area: 'r9', kills: 100 } },
    ];

    // Costume Pokémon to catch for the quest of an island
    public static readonly CATCH_GOAL = 5;

    public static area(id: string): FestivalArea {
        return FestivalData.areas.find((a) => a.id === id);
    }

    public static stage(n: number): FestivalStage {
        return FestivalData.STAGES[n - 1];
    }

    // All costume Pokémon of an island (route and caves)
    public static stagePokemon(n: number): PokemonNameType[] {
        return FestivalData.areas.filter((a) => a.stage === n).flatMap((a) => [...(a.pokemon ?? []), ...(a.rare ?? [])]);
    }

    public static allPokemon(): PokemonNameType[] {
        return FestivalData.areas.flatMap((a) => [...(a.pokemon ?? []), ...(a.rare ?? [])]);
    }
}
