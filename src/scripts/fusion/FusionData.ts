// Data of the separate Fusion world: fusion Pokémon (sprites from the Pokémon Infinite Fusion community,
// credited per artist) and the first Fusion region. Nothing here touches the base game.

type FusionSpecies = { id: string, name: string, head: number, body: number, artist: string };

type FusionArea = {
    id: string,
    name: string,
    kind: 'town' | 'route' | 'cave' | 'gym',
    // Kills needed on another area (or a badge) to open this one
    unlock: { area?: string, kills?: number, badge?: string },
    // Position on the Fusion map in map tiles (16px), like the region maps
    map?: { x: number, y: number, w: number, h: number },
    // Battle background (same classes as the base game battle view)
    background?: string,
    // Towns: gym that can be challenged here
    gym?: string,
    levels?: [number, number],
    hp?: number,
    energy?: number,
    pokemon?: string[],
    // Gyms
    leader?: string,
    team?: { id: string, level: number, hp: number }[],
    timeLimit?: number,
    badge?: string,
    reward?: number,
};

class FusionData {
    public static readonly species: FusionSpecies[] = [
        { id: '6.149', name: 'Gluragoran', head: 6, body: 149, artist: 'gnose_' },
        { id: '149.6', name: 'Dragurak', head: 149, body: 6, artist: 'solivmon' },
        { id: '94.150', name: 'Gengtu', head: 94, body: 150, artist: 'toad900' },
        { id: '150.94', name: 'Mewgar', head: 150, body: 94, artist: 'knuckles3andknuckles' },
        { id: '25.133', name: 'Pikoli', head: 25, body: 133, artist: 'frebbo' },
        { id: '133.25', name: 'Evochu', head: 133, body: 25, artist: 'xyloldi' },
        { id: '9.130', name: 'Turados', head: 9, body: 130, artist: 'beespoon' },
        { id: '130.9', name: 'Garatok', head: 130, body: 9, artist: 'mammuth_89' },
        { id: '3.143', name: 'Bisalaxo', head: 3, body: 143, artist: 'dngotchi' },
        { id: '143.3', name: 'Relaflor', head: 143, body: 3, artist: 'malxire' },
        { id: '59.38', name: 'Arknona', head: 59, body: 38, artist: 'elementalheroshadow' },
        { id: '38.59', name: 'Vulkani', head: 38, body: 59, artist: 'gdei' },
        { id: '131.148', name: 'Lapranir', head: 131, body: 148, artist: 'firetra' },
        { id: '148.131', name: 'Dragopras', head: 148, body: 131, artist: 'toad0892' },
        { id: '151.150', name: 'Mewewtu', head: 151, body: 150, artist: 'mammuth_89' },
        { id: '150.151', name: 'Mewtumew', head: 150, body: 151, artist: 'mbcmechachu' },
        { id: '65.94', name: 'Simsagar', head: 65, body: 94, artist: 'mammuth_89' },
        { id: '145.146', name: 'Zaplados', head: 145, body: 146, artist: 'theblackboots' },
        { id: '144.145', name: 'Arkzapdos', head: 144, body: 145, artist: 'milchik' },
        { id: '146.144', name: 'Lavarktos', head: 146, body: 144, artist: 'toad900' },
        { id: '142.6', name: 'Aerorak', head: 142, body: 6, artist: 'universez_' },
        { id: '132.25', name: 'Dittochu', head: 132, body: 25, artist: 'cr1st1en' },
        { id: '94.6', name: 'Gengurak', head: 94, body: 6, artist: 'richcareylol' },
        { id: '25.6', name: 'Pikarak', head: 25, body: 6, artist: 'toad900' },
        { id: '6.25', name: 'Glurachu', head: 6, body: 25, artist: 'phoenix99125' },
        { id: '1.4', name: 'Bisamanda', head: 1, body: 4, artist: 'el_keks' },
        { id: '7.1', name: 'Schiggysam', head: 7, body: 1, artist: 'funkytomate' },
        { id: '4.7', name: 'Gluggy', head: 4, body: 7, artist: 'unclaimedpuppy5082' },
        { id: '143.149', name: 'Relaxoran', head: 143, body: 149, artist: 'stan.__.' },
        { id: '149.143', name: 'Dragolaxo', head: 149, body: 143, artist: 'silverperseus' },
        { id: '68.76', name: 'Machowaz', head: 68, body: 76, artist: 'knuckles3andknuckles' },
        { id: '123.127', name: 'Sichsir', head: 123, body: 127, artist: 'toad900' },
        { id: '135.136', name: 'Blitzmara', head: 135, body: 136, artist: 'blaquaza' },
        { id: '134.131', name: 'Aquapras', head: 134, body: 131, artist: 'sploox101' },
        { id: '115.128', name: 'Kangauros', head: 115, body: 128, artist: 'iamconnell' },
        { id: '54.79', name: 'Entmon', head: 54, body: 79, artist: 'aquaticpanic' },
        { id: '129.130', name: 'Karpados', head: 129, body: 130, artist: 'knuckles3andknuckles' },
        { id: '36.40', name: 'Pixiluff', head: 36, body: 40, artist: 'funkytomate' },
        { id: '52.133', name: 'Mauzoli', head: 52, body: 133, artist: 'bizmythe' },
    ];

    public static readonly starters = ['1.4', '7.1', '4.7'];

    public static readonly areas: FusionArea[] = [
        {
            id: 't1', name: 'Fusionslabor', kind: 'town', unlock: {}, background: 'power-plant',
            map: { x: 10, y: 37, w: 6, h: 6 },
        },
        {
            id: 'f1', name: 'Fusionspfad 1', kind: 'route', unlock: {}, levels: [3, 8], hp: 30, energy: 1, background: 'forest',
            map: { x: 16, y: 38.5, w: 18, h: 3 },
            pokemon: ['25.133', '133.25', '132.25', '52.133', '54.79', '36.40'],
        },
        {
            id: 'f2', name: 'Fusionspfad 2', kind: 'route', unlock: { area: 'f1', kills: 25 }, levels: [10, 18], hp: 200, energy: 3, background: 'water',
            map: { x: 34, y: 18, w: 3, h: 23.5 },
            pokemon: ['129.130', '115.128', '135.136', '134.131', '123.127', '68.76'],
        },
        {
            id: 'f3', name: 'Fusionspfad 3', kind: 'route', unlock: { area: 'f2', kills: 25 }, levels: [20, 30], hp: 1100, energy: 8, background: 'fire',
            map: { x: 37, y: 18, w: 26, h: 3 },
            pokemon: ['59.38', '38.59', '3.143', '143.3', '9.130', '130.9', '25.6', '6.25'],
        },
        {
            id: 'f4', name: 'Fusionspfad 4', kind: 'route', unlock: { area: 'f3', kills: 25 }, levels: [35, 45], hp: 4500, energy: 20, background: 'desert',
            map: { x: 63, y: 18, w: 3, h: 21 },
            pokemon: ['131.148', '148.131', '94.6', '142.6', '65.94', '143.149', '149.143', '6.149', '149.6'],
        },
        {
            id: 't2', name: 'Helixstadt', kind: 'town', unlock: { area: 'f4', kills: 25 }, background: 'battlefield', gym: 'gym1',
            map: { x: 61.5, y: 39, w: 6, h: 6 },
        },
        {
            id: 'gym1', name: 'Fusionsarena', kind: 'gym', unlock: { area: 'f4', kills: 25 }, background: 'battlefield',
            leader: 'Forscherin Fiona', timeLimit: 60, badge: 'Fusionsorden', reward: 500,
            team: [
                { id: '6.149', level: 50, hp: 30000 },
                { id: '94.6', level: 52, hp: 34000 },
                { id: '149.6', level: 55, hp: 40000 },
            ],
        },
        {
            id: 'f5', name: 'Mysteriöse Höhle', kind: 'cave', unlock: { badge: 'Fusionsorden' }, levels: [60, 70], hp: 25000, energy: 50, background: 'cave',
            map: { x: 80, y: 37, w: 5, h: 5 },
            pokemon: ['94.150', '150.94', '151.150', '150.151', '145.146', '144.145', '146.144'],
        },
    ];

    // Decorative paths on the map that connect locations without being an area themselves
    public static readonly mapPaths: { x: number, y: number, w: number, h: number }[] = [{ x: 67.5, y: 40.5, w: 12.5, h: 2 }];

    public static speciesById(id: string): FusionSpecies {
        return FusionData.species.find((s) => s.id === id);
    }

    public static area(id: string): FusionArea {
        return FusionData.areas.find((a) => a.id === id);
    }

    // Head gives the first type, body the second (as in Pokémon Infinite Fusion)
    public static types(id: string): PokemonType[] {
        const s = FusionData.speciesById(id);
        const head = pokemonMap[s.head].type as PokemonType[];
        const body = pokemonMap[s.body].type as PokemonType[];
        const second = body[1] ?? body[0];
        return second === head[0] ? [head[0]] : [head[0], second];
    }

    // Average attack of both parts plus a small fusion bonus
    public static attack(id: string): number {
        const s = FusionData.speciesById(id);
        return Math.round((pokemonMap[s.head].attack + pokemonMap[s.body].attack) / 2 * 1.1);
    }

    public static catchRate(id: string): number {
        const s = FusionData.speciesById(id);
        return (pokemonMap[s.head].catchRate + pokemonMap[s.body].catchRate) / 2;
    }

    public static partNames(id: string): string {
        const s = FusionData.speciesById(id);
        return `${PokemonHelper.displayName(pokemonMap[s.head].name)} / ${PokemonHelper.displayName(pokemonMap[s.body].name)}`;
    }

    // Where a fusion can be found (first matching area), used by the Fusion dex
    public static foundIn(id: string): FusionArea[] {
        return FusionData.areas.filter((a) => a.pokemon?.includes(id) || a.team?.some((m) => m.id === id));
    }

    public static image(id: string): string {
        return `assets/images/fusion/${id}.png`;
    }
}
