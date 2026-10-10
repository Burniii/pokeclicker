/// <reference path="./Cutscenes.ts" />

// Region arrivals
([
    [GameConstants.Region.johto, 'johto.png', 'Professor Elm', ['Ho-Oh', 'Lugia'], 'Welcome to Johto! Legends say Ho-Oh and Lugia watch over this land of old traditions.', 'Professor Elm: Johto is full of Pokémon you have never seen before. Bring them to me when you find them!'],
    [GameConstants.Region.hoenn, 'hoenn.png', 'Professor Birch', ['Groudon', 'Kyogre'], 'Welcome to Hoenn, a region of sea and volcanoes, where Groudon and Kyogre once fought over land and ocean.', 'Professor Birch: Out in the field is where real research happens. Let\'s go!'],
    [GameConstants.Region.sinnoh, 'sinnoh.png', 'Professor Rowan', ['Dialga', 'Palkia'], 'Welcome to Sinnoh. Mount Coronet divides the region, and its peak is said to hold the secrets of time and space.', 'Professor Rowan: A Trainer who has come this far still has a lot to learn. Prove me wrong.'],
    [GameConstants.Region.unova, 'unova.png', 'Professor Juniper', ['Reshiram', 'Zekrom'], 'Welcome to Unova, far away from the regions you know. Truth and ideals clash in the legends of this land.', 'Professor Juniper: Almost every Pokémon here is new. Isn\'t that exciting?'],
    [GameConstants.Region.kalos, 'kalos.png', 'Sycamore', ['Xerneas', 'Yveltal'], 'Welcome to Kalos, the region of beauty, where life and destruction are told as two sides of one story.', 'Professor Sycamore: Have you heard of Mega Evolution? Kalos holds its secrets.'],
    [GameConstants.Region.alola, 'alola-melemele.png', 'Professor Kukui', ['Solgaleo', 'Lunala'], 'Alola! Four islands under sun and moon wait for your Island Challenge.', 'Professor Kukui: Woo! The trials here will push you and your Pokémon, yeah!'],
    [GameConstants.Region.galar, 'galar-south.png', 'Professor Magnolia', ['Zacian', 'Zamazenta'], 'Welcome to Galar, where Gym battles fill whole stadiums and Dynamax Pokémon tower over the crowd.', 'Professor Magnolia: The Darkest Day is only a legend. Or is it?'],
    [GameConstants.Region.hisui, 'hisui.png', 'Laventon', ['Dialga (Origin)', 'Palkia (Origin)'], 'A rift tears open in the sky. You fall through time and wake up on a beach in ancient Hisui.', 'Professor Laventon: A Trainer who fell from the sky? Well, the Galaxy Expedition Team could use help like yours!'],
    [GameConstants.Region.paldea, 'paldea.png', 'Sada', ['Koraidon', 'Miraidon'], 'Welcome to Paldea! Your treasure hunt begins at the academy, and somewhere in the Great Crater lies Area Zero.', 'The Professor: Every student has to find their own treasure. What will yours be?'],
] as Array<[GameConstants.Region, string, string, PokemonNameType[], string, string]>).forEach(([region, map, professor, legends, intro, words]) => {
    const id = `region-${region}`;
    const regionName = GameConstants.camelCaseToString(GameConstants.Region[region]);
    Cutscenes.add({
        id,
        title: `Arrival in ${regionName}`,
        frames: () => [
            {
                background: Cutscenes.regionBackground(map),
                text: Cutscenes.text(id, 0, intro),
                sprites: [
                    { image: Cutscenes.pokemonImage(legends[0]), position: 'left', size: 150, enter: 'slide-left', glow: '#ffffffaa' },
                    { image: Cutscenes.pokemonImage(legends[1]), position: 'right', size: 150, enter: 'slide-right', glow: '#ffffffaa' },
                ],
            },
            {
                background: Cutscenes.regionBackground(map),
                speaker: professor,
                text: Cutscenes.text(id, 1, words),
                sprites: [{ image: Cutscenes.npcImage(professor), position: 'center', size: 160, enter: 'rise' }],
            },
        ],
    });
});

// First Champion win of a region: the player and their strongest Pokémon in the Hall of Fame
const hallOfFame = (id: string, region: GameConstants.Region): CutsceneFrame[] => {
    const best = [...App.game.party.caughtPokemon].sort((a, b) => b.attack - a.attack).slice(0, 3);
    const background = 'radial-gradient(circle at 50% 40%, #fff7c2 0%, #e8b923 35%, #6b3e00 100%)';
    const regionName = GameConstants.camelCaseToString(GameConstants.Region[region]);
    return [
        {
            background,
            text: Cutscenes.text(id, 0, `You defeated the Champion of ${regionName}! Your name will be written in the Hall of Fame.`).replace('{region}', regionName),
            sprites: [{ image: `assets/images/profile/trainer-${App.game.profile.trainer()}.png`, position: 'center', size: 140, enter: 'rise', glow: '#ffd700' }],
        },
        {
            background,
            text: Cutscenes.text(id, 1, 'Your partners stood by your side all the way.'),
            sprites: best.map((p, i) => ({
                image: PokemonHelper.getImage(p.id, p.shiny),
                position: (['left', 'center', 'right'] as const)[i],
                size: 130,
                enter: 'fade' as const,
                glow: '#ffffffcc',
            })),
        },
    ];
};
GameHelper.enumNumbers(GameConstants.Region).filter((r) => r >= 0 && r < GameConstants.Region.final).forEach((region) => {
    const id = `champion-${region}`;
    Cutscenes.add({
        id,
        title: `${GameConstants.camelCaseToString(GameConstants.Region[region])} Hall of Fame`,
        frames: () => hallOfFame(id, region),
    });
});

// Story highlights after special battles
Cutscenes.add({
    id: 'tb:Arceus',
    title: 'The Original One',
    frames: () => [
        {
            background: 'radial-gradient(circle at 50% 35%, #ffffff 0%, #f5e6a8 30%, #3a2a5c 100%)',
            text: Cutscenes.text('tb:Arceus', 0, 'Light pours down from the top of Mount Coronet. Arceus, the Original One, accepts your strength.'),
            sprites: [{ image: Cutscenes.pokemonImage('Arceus (Normal)'), position: 'center', size: 190, enter: 'rise', glow: '#fff4b0' }],
        },
        {
            background: 'radial-gradient(circle at 50% 35%, #ffffff 0%, #f5e6a8 30%, #3a2a5c 100%)',
            text: Cutscenes.text('tb:Arceus', 1, 'The Plates begin to glow. Arceus may take on their powers once it has grown strong enough.'),
            sprites: [
                { image: Cutscenes.pokemonImage('Arceus (Fire)'), position: 'left', size: 110, enter: 'fade', glow: '#ff9d5c' },
                { image: Cutscenes.pokemonImage('Arceus (Water)'), position: 'center', size: 110, enter: 'fade', glow: '#7ab8ff' },
                { image: Cutscenes.pokemonImage('Arceus (Grass)'), position: 'right', size: 110, enter: 'fade', glow: '#8cff8c' },
            ],
        },
    ],
});
Cutscenes.add({
    id: 'tb:Paradise Protection Protocol',
    title: 'The Way Home',
    frames: () => [
        {
            background: 'linear-gradient(#0b1a33, #2b5876)',
            text: Cutscenes.text('tb:Paradise Protection Protocol', 0, 'The Zero Lab falls silent. The Professor\'s machine is finally switched off.'),
            sprites: [{ image: Cutscenes.npcImage('AI Sada'), position: 'left', size: 120, enter: 'fade' }, { image: Cutscenes.npcImage('AI Turo'), position: 'right', size: 120, enter: 'fade' }],
        },
        {
            background: 'linear-gradient(#ff9a5c, #6a3093)',
            text: Cutscenes.text('tb:Paradise Protection Protocol', 1, 'Koraidon and Miraidon look out over the Great Crater. They have found their way home, and so have you.'),
            sprites: [
                { image: Cutscenes.pokemonImage('Koraidon'), position: 'left', size: 160, enter: 'slide-left' },
                { image: Cutscenes.pokemonImage('Miraidon'), position: 'right', size: 160, enter: 'slide-right' },
            ],
        },
    ],
});
Cutscenes.add({
    id: 'tb:Terapagos',
    title: 'The Stellar Crown',
    frames: () => [
        {
            background: 'radial-gradient(circle at 50% 45%, #ffffff 0%, #a6e3ff 25%, #5b2a86 70%, #12001f 100%)',
            text: Cutscenes.text('tb:Terapagos', 0, 'Deep in the Area Zero Underdepths, Terapagos shines in all colors of the Terastal phenomenon.'),
            sprites: [{ image: Cutscenes.pokemonImage('Terapagos'), position: 'center', size: 180, enter: 'rise', glow: '#c9f3ff' }],
        },
        {
            background: 'radial-gradient(circle at 50% 45%, #ffffff 0%, #a6e3ff 25%, #5b2a86 70%, #12001f 100%)',
            speaker: 'Briar',
            text: Cutscenes.text('tb:Terapagos', 1, 'Briar: My great-great-great-grandmother\'s book was right all along. Thank you!'),
            sprites: [{ image: Cutscenes.npcImage('Briar'), position: 'center', size: 150, enter: 'fade' }],
        },
    ],
});
Cutscenes.add({
    id: 'tb:Monarch Ash',
    title: 'The Monarch',
    frames: () => [
        {
            background: 'linear-gradient(#ffcf6b, #e94e1b 60%, #2b0b00)',
            text: Cutscenes.text('tb:Monarch Ash', 0, 'In Pallet Town, where it all began, the Monarch finally lowers his cap.'),
            sprites: [
                { image: Cutscenes.npcImage('Ash Ketchum'), position: 'left', size: 140, enter: 'slide-left' },
                { image: `assets/images/profile/trainer-${App.game.profile.trainer()}.png`, position: 'right', size: 140, enter: 'slide-right', glow: '#ffd700' },
            ],
        },
        {
            background: 'linear-gradient(#ffcf6b, #e94e1b 60%, #2b0b00)',
            text: Cutscenes.text('tb:Monarch Ash', 1, 'You are the strongest Trainer in the world. But there are always new Pokémon to meet.'),
            sprites: [{ image: Cutscenes.pokemonImage('Pikachu'), position: 'center', size: 150, enter: 'rise' }],
        },
    ],
});
