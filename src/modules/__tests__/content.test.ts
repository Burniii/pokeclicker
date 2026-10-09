/**
 * Static content checks for game data that lives in the legacy scripts (towns, battles, quests),
 * which cannot be executed inside the test environment. The source files are parsed as text.
 */
import fs from 'fs';
import path from 'path';
import {
    TemporaryBattles, RegionGyms, RegionDungeons,
} from '../GameConstants';
import BadgeEnums from '../enums/Badges';

const SRC = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(SRC, file), 'utf8');
const unescapeQuotes = (value: string) => value.replace(/\\'/g, '\'');
const STR = '\'((?:[^\'\\\\]|\\\\.)*)\'';
const matchAll = (text: string, pattern: string) => [...text.matchAll(new RegExp(pattern, 'g'))].map((m) => unescapeQuotes(m[1]));
const listFiles = (dir: string, ext: string): string[] => fs.readdirSync(path.join(SRC, dir), { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory()
        ? listFiles(path.join(dir, entry.name), ext)
        : (entry.name.endsWith(ext) ? [path.join(dir, entry.name)] : [])));

const townList = read('scripts/towns/TownList.ts');
const tempBattleList = read('scripts/temporaryBattle/TemporaryBattleList.ts');
// Block comments are stripped so commented-out content is ignored
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const questLineHelper = stripComments(read('scripts/quests/QuestLineHelper.ts'));
const routeData = read('modules/routes/RouteData.ts');
const regionMaps = listFiles('components/regionMaps', '.html').map(read).join('\n').replace(/\\'/g, '\'');
const sourceFiles = [...listFiles('scripts', '.ts'), ...listFiles('modules', '.ts')]
    .filter((file) => !file.includes('__tests__') && !file.endsWith('.test.ts'))
    .map((file) => ({ file, text: read(file) }));

const pokemonNames = new Set(matchAll(read('modules/pokemons/PokemonList.ts'), `'name': ${STR}`));
const tempBattleDefinitions = matchAll(tempBattleList, `new TemporaryBattle\\(\\s*${STR}`);
const gymNames = new Set(RegionGyms.flat());
const dungeonNames = new Set(RegionDungeons.flat());
const questLineNames = new Set(matchAll(questLineHelper, `new QuestLine\\(\\s*${STR}`));

// Split a file into `Key = new Constructor(...)` blocks
const blocks = (text: string, prefix: string) => {
    const result: Record<string, string> = {};
    const pattern = new RegExp(`^${prefix}(?:\\[${STR}\\]|\\.(\\w+)) = new \\w+\\(([\\s\\S]*?)^\\);`, 'gm');
    [...text.matchAll(pattern)].forEach((m) => {
        result[unescapeQuotes(m[1] ?? m[2])] = m[3];
    });
    return result;
};
const tempBattleBlocks = blocks(tempBattleList, 'TemporaryBattleList');
const townBlocks = blocks(townList, 'TownList');

const snapshotFile = path.join(__dirname, 'snapshots', 'saveIndexes.json');

describe('Content references', () => {
    const unknown = (pattern: string, valid: Set<string>) => sourceFiles.flatMap(({ file, text }) => matchAll(text, pattern)
        .filter((name) => !valid.has(name))
        .map((name) => `${file}: ${name}`));

    it('only references existing temporary battles', () => {
        const valid = new Set(TemporaryBattles);
        expect(unknown(`TemporaryBattleRequirement\\(${STR}`, valid)).toEqual([]);
        expect(unknown(`DefeatTemporaryBattleQuest\\(${STR}`, valid)).toEqual([]);
        expect(unknown(`TemporaryBattleList\\[${STR}\\]`, new Set(tempBattleDefinitions))).toEqual([]);
    });

    it('keeps the temporary battle list in sync with the definitions', () => {
        expect(tempBattleDefinitions.filter((t) => !TemporaryBattles.includes(t))).toEqual([]);
        expect(TemporaryBattles.filter((t) => !tempBattleDefinitions.includes(t))).toEqual([]);
    });

    it('only references existing gyms and dungeons', () => {
        expect(unknown(`getGymIndex\\(${STR}\\)`, gymNames)).toEqual([]);
        expect(unknown(`DefeatGymQuest\\(\\s*\\d+,\\s*\\d+,\\s*${STR}`, gymNames)).toEqual([]);
        expect(unknown(`getDungeonIndex\\(${STR}\\)`, dungeonNames)).toEqual([]);
        expect(unknown(`DefeatDungeonQuest\\(\\s*\\d+,\\s*\\d+,\\s*${STR}`, dungeonNames)).toEqual([]);
        const gymDefinitions = matchAll(read('scripts/gym/GymList.ts'), `new Gym\\(\\s*${STR},\\s*${STR}`.replace(`${STR},\\s*${STR}`, `'(?:[^'\\\\]|\\\\.)*',\\s*${STR}`));
        expect(gymDefinitions.filter((g) => !gymNames.has(g))).toEqual([]);
        const dungeonDefinitions = matchAll(read('scripts/dungeons/Dungeon.ts'), `new Dungeon\\(${STR}`);
        expect(dungeonDefinitions.filter((d) => !dungeonNames.has(d))).toEqual([]);
    });

    it('only references existing Pokémon', () => {
        ['new GymPokemon\\(', 'new DungeonBossPokemon\\(', 'CaptureSpecificPokemonQuest\\(', 'gainPokemonByName\\('].forEach((call) => {
            expect(unknown(`${call}${STR}`, pokemonNames)).toEqual([]);
        });
        const routePokemon = [...routeData.matchAll(/(?:land|water|headbutt):\s*\[([\s\S]*?)\]/g)]
            .flatMap((m) => matchAll(m[1], STR))
            .filter((name) => !pokemonNames.has(name));
        expect(routePokemon).toEqual([]);
    });

    it('only references existing quest lines', () => {
        expect(unknown(`QuestLine(?:StepCompleted|Completed|Started)Requirement\\(${STR}`, questLineNames)).toEqual([]);
        const nameType = new Set(matchAll(read('modules/quests/QuestLineNameType.ts'), STR));
        expect([...questLineNames].filter((name) => !nameType.has(name))).toEqual([]);
    });
});

describe('Save compatibility', () => {
    const current = {
        temporaryBattles: TemporaryBattles,
        gyms: RegionGyms.flat(),
        dungeons: RegionDungeons.flat(),
        badges: Object.keys(BadgeEnums).filter((key) => Number.isNaN(Number(key))),
    };

    it('only ever appends to lists that saves store by index', () => {
        expect(fs.existsSync(snapshotFile), `missing ${snapshotFile}`).toBe(true);
        const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
        Object.keys(snapshot).forEach((key) => {
            expect(current[key].slice(0, snapshot[key].length), `${key} must only be appended to`).toEqual(snapshot[key]);
        });
    });
});

describe('Content reachability', () => {
    // Older content from the original project that predates these checks
    const LEGACY_TOWNS_WITHOUT_IMAGE = [
        'Gyarados Galleon', 'Disguised Shop', 'Pirate Island', 'Hoppy Town', 'Hoppy Town Fishing Pond', 'Friend League', 'Quick League',
        'Heavy League', 'Great League', 'Fast League', 'Luxury League', 'Heal League', 'Ultra League', 'Elite Four League', 'Master League',
        'Magikarp\'s Eye', 'Master Dojo Battle Court',
    ];
    const LEGACY_HIDDEN_GATES = ['Battle Royal', 'Marnie 1'];
    const LEGACY_ONE_TIME_BATTLE_STEPS = [
        'Bill\'s Errand: Cue Ball Paxton',
        'Hollow Truth and Ideals: Team Plasma Grunt 1',
        'Hollow Truth and Ideals: Zinzolin 1',
        'Hollow Truth and Ideals: Zinzolin 2',
        'Hollow Truth and Ideals: Plasma Shadow 1',
        'Hollow Truth and Ideals: Ghetsis 2',
        'Eater of Light: Ultra Megalopolis',
        'Let\'s Go, Meltan!: Team Rainbow Leader Giovanni',
        'The Darkest Day: Hop 6',
        'The Darkest Day: Hop 7',
        'The Darkest Day: The Darkest Day',
    ];

    it('places every temporary battle in a town or on a map', () => {
        const placed = (name: string) => townList.includes(`TemporaryBattleList['${name.replace(/'/g, '\\\'')}']`)
            || townList.includes(`TemporaryBattleList.${name}`)
            || regionMaps.includes(`TemporaryBattleList['${name}']`);
        expect(tempBattleDefinitions.filter((t) => !placed(t))).toEqual([]);
    });

    it('gives every town a map entry and an image', () => {
        const images = new Set(fs.readdirSync(path.join(SRC, 'assets/images/towns')).map((file) => file.replace(/\.\w+$/, '')));
        const towns = Object.entries(townBlocks).filter(([, body]) => !body.includes('GameConstants.Region.final'));
        // Towns can also be entered from another town instead of the map
        const enteredFromTown = (name: string) => townList.includes(`MoveToDungeon(dungeonList['${name.replace(/'/g, '\\\'')}']`)
            || townList.includes(`MoveToTown('${name.replace(/'/g, '\\\'')}'`);
        expect(towns.filter(([name]) => !regionMaps.includes(`name: "${name}"`) && !enteredFromTown(name)).map(([name]) => name)).toEqual([]);
        expect(towns.filter(([name]) => !images.has(name) && !LEGACY_TOWNS_WITHOUT_IMAGE.includes(name)).map(([name]) => name)).toEqual([]);
    });

    it('does not hide temporary battles behind route kills their town does not require', () => {
        const routeKills = (text: string) => [...text.matchAll(/RouteKillRequirement\(10, (?:GameConstants\.)?Region\.(\w+), (\d+)\)/g)]
            .map((m) => `${m[1]}:${m[2]}`);
        // Route kills implied by unlocking a route (its own route kill requirements, recursively)
        const routePrerequisites: Record<string, string[]> = {};
        routeData.split('Routes.add(new RegionRoute(').slice(1).forEach((route) => {
            const m = route.match(/^\s*'(?:[^'\\]|\\.)*', Region\.(\w+), (\d+),/);
            if (m) {
                routePrerequisites[`${m[1]}:${m[2]}`] = routeKills(route.split('));')[0]);
            }
        });
        const implied = (kills: string[]) => {
            const result = new Set<string>();
            const visit = (kill: string) => {
                if (result.has(kill)) {
                    return;
                }
                result.add(kill);
                (routePrerequisites[kill] ?? []).forEach(visit);
            };
            kills.forEach(visit);
            return result;
        };
        const violations = Object.entries(townBlocks).flatMap(([town, body]) => {
            const townKills = implied(routeKills(body));
            return [...body.matchAll(new RegExp(`TemporaryBattleList(?:\\[${STR}\\]|\\.(\\w+))`, 'g'))]
                .map((m) => unescapeQuotes(m[1] ?? m[2]))
                .filter((battle) => !LEGACY_HIDDEN_GATES.includes(battle))
                .filter((battle) => routeKills(tempBattleBlocks[battle] ?? '').some((kill) => !townKills.has(kill)))
                .map((battle) => `${battle} (in ${town})`);
        });
        expect(violations).toEqual([]);
    });

    it('lets quest steps for one-time battles count victories from before the step started', () => {
        // A step that waits for a one-time battle must either start from 0 or the battle must be locked behind that quest line,
        // otherwise winning the battle before the step begins leaves the quest line stuck forever
        const violations: string[] = [];
        questLineHelper.split(/new QuestLine\(/).slice(1).forEach((section) => {
            const questLine = unescapeQuotes(section.match(new RegExp(`^\\s*${STR}`))[1]);
            const body = section.split('App.game.quests.questLines.push(')[0];
            [...body.matchAll(new RegExp(`new DefeatTemporaryBattleQuest\\(${STR}`, 'g'))].forEach((m) => {
                const battle = unescapeQuotes(m[1]);
                const rest = body.slice(m.index);
                const startsFromZero = /^[^;]*?\)\.withInitialValue\(0\)/.test(rest.slice(0, rest.indexOf(';') + 1).replace(/\n/g, ' '));
                const battleBlock = tempBattleBlocks[battle] ?? '';
                const lockedByQuestLine = battleBlock.includes(`Requirement('${questLine.replace(/'/g, '\\\'')}'`);
                const repeatable = battleBlock.includes('resetDaily: true');
                if (!startsFromZero && !lockedByQuestLine && !repeatable && !LEGACY_ONE_TIME_BATTLE_STEPS.includes(`${questLine}: ${battle}`)) {
                    violations.push(`${questLine}: ${battle}`);
                }
            });
        });
        expect(violations).toEqual([]);
    });
});
