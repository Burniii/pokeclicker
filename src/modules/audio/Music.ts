import Settings from '../settings/Settings';
import AudioEngine, { Instrument, Note } from './AudioEngine';

export type MusicStyle = 'calm' | 'route' | 'battle' | 'dungeon' | 'boss' | 'champion' | 'legendary';
export type MusicSituation = { kind: 'town' | 'route' | Exclude<MusicStyle, 'calm' | 'route'>, region: number };

type TrackConfig = {
    seed: number;
    root: number; // midi note of the key
    mode: number[]; // scale intervals
    tempo: number; // beats per minute
    progression: number[]; // scale degrees (0-based), 2 bars each
    style: MusicStyle;
    lead: Instrument;
    accompaniment: Instrument;
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];

// One theme per region (index = Region), plus a fallback
const REGION_THEMES: Array<Omit<TrackConfig, 'style'>> = [
    { seed: 101, root: 60, mode: MAJOR, tempo: 104, progression: [0, 3, 4, 0], lead: 'flute', accompaniment: 'pluck' }, // Kanto
    { seed: 202, root: 62, mode: MAJOR, tempo: 96, progression: [0, 5, 3, 4], lead: 'flute', accompaniment: 'piano' }, // Johto
    { seed: 303, root: 65, mode: MIXOLYDIAN, tempo: 108, progression: [0, 6, 3, 0], lead: 'strings', accompaniment: 'pluck' }, // Hoenn
    { seed: 404, root: 57, mode: DORIAN, tempo: 90, progression: [0, 3, 6, 4], lead: 'piano', accompaniment: 'bell' }, // Sinnoh
    { seed: 505, root: 63, mode: MAJOR, tempo: 110, progression: [5, 3, 0, 4], lead: 'brass', accompaniment: 'piano' }, // Unova
    { seed: 606, root: 64, mode: MAJOR, tempo: 94, progression: [0, 4, 5, 3], lead: 'strings', accompaniment: 'piano' }, // Kalos
    { seed: 707, root: 67, mode: MIXOLYDIAN, tempo: 100, progression: [0, 3, 0, 6], lead: 'flute', accompaniment: 'pluck' }, // Alola
    { seed: 808, root: 58, mode: MAJOR, tempo: 106, progression: [0, 5, 1, 4], lead: 'brass', accompaniment: 'strings' }, // Galar
    { seed: 909, root: 55, mode: DORIAN, tempo: 86, progression: [0, 6, 3, 4], lead: 'flute', accompaniment: 'bell' }, // Hisui
    { seed: 1010, root: 61, mode: MAJOR, tempo: 112, progression: [3, 4, 2, 5], lead: 'strings', accompaniment: 'pluck' }, // Paldea
];

const BATTLE_THEMES: Record<Exclude<MusicStyle, 'calm' | 'route'>, Omit<TrackConfig, 'style'>> = {
    battle: { seed: 11, root: 57, mode: MINOR, tempo: 140, progression: [0, 5, 6, 4], lead: 'strings', accompaniment: 'pluck' },
    dungeon: { seed: 12, root: 52, mode: DORIAN, tempo: 84, progression: [0, 0, 6, 4], lead: 'flute', accompaniment: 'bell' },
    boss: { seed: 13, root: 50, mode: HARMONIC_MINOR, tempo: 148, progression: [0, 5, 3, 4], lead: 'brass', accompaniment: 'strings' },
    champion: { seed: 14, root: 55, mode: MINOR, tempo: 152, progression: [0, 6, 5, 4], lead: 'brass', accompaniment: 'strings' },
    legendary: { seed: 15, root: 49, mode: HARMONIC_MINOR, tempo: 120, progression: [0, 1, 5, 4], lead: 'strings', accompaniment: 'bell' },
};

const STEPS_PER_BAR = 16;
const BARS = 8;

const random = (seed: number) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// Builds one 8 bar loop of notes
export const composeLoop = (config: TrackConfig): { notes: Note[], duration: number } => {
    const rand = random(config.seed);
    const step = 60 / config.tempo / 4;
    const notes: Note[] = [];
    const f = AudioEngine.freq;
    const scaleNote = (degree: number, octave = 0) => {
        const d = ((degree % 7) + 7) % 7;
        const octaves = Math.floor(degree / 7) + octave;
        return config.root + config.mode[d] + 12 * octaves;
    };
    const intense = ['battle', 'boss', 'champion', 'legendary'].includes(config.style);
    const calm = config.style === 'calm';

    // Melody: four bars of motifs, repeated with a cadence to the tonic at the end
    const rhythms = intense
        ? [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 8, 10, 12], [0, 2, 3, 4, 8, 11, 12, 14]]
        : [[0, 4, 8, 12], [0, 2, 4, 8, 12], [0, 6, 8, 12, 14], [0, 4, 6, 8]];
    const motif: Array<Array<{ step: number, degree: number, length: number }>> = [];
    let degree = 2;
    for (let bar = 0; bar < 4; bar++) {
        const chord = config.progression[Math.floor(bar / 2) % config.progression.length];
        const rhythm = rhythms[Math.floor(rand() * rhythms.length)];
        const barNotes: Array<{ step: number, degree: number, length: number }> = [];
        for (let i = 0; i < rhythm.length; i++) {
            const s = rhythm[i];
            const next = rhythm[i + 1] ?? STEPS_PER_BAR;
            if (s % 8 === 0) {
                // strong beats land on a chord tone
                degree = chord + [0, 2, 4][Math.floor(rand() * 3)];
            } else {
                degree += [-2, -1, 1, 2][Math.floor(rand() * 4)];
            }
            degree = Math.max(0, Math.min(11, degree));
            barNotes.push({ step: s, degree, length: next - s });
        }
        motif.push(barNotes);
    }
    for (let bar = 0; bar < BARS; bar++) {
        const source = motif[bar % 4];
        source.forEach((n, i) => {
            const isLast = bar === BARS - 1 && i === source.length - 1;
            notes.push({
                freq: f(scaleNote(isLast ? 7 : n.degree, 1)),
                start: (bar * STEPS_PER_BAR + n.step) * step,
                duration: n.length * step * 0.92,
                instrument: config.lead,
                volume: calm ? 0.4 : 0.45,
            });
        });
    }

    // Harmony: pad chords, accompaniment, a soft bass and light drums (each chord lasts 2 bars)
    for (let bar = 0; bar < BARS; bar++) {
        const chord = config.progression[Math.floor(bar / 2) % config.progression.length];
        const barStart = bar * STEPS_PER_BAR * step;
        if (bar % 2 === 0) {
            [0, 2, 4].forEach((tone) => notes.push({
                freq: f(scaleNote(chord + tone, 0)),
                start: barStart,
                duration: 2 * STEPS_PER_BAR * step,
                instrument: 'pad',
                volume: calm ? 0.45 : 0.4,
            }));
        }
        // accompaniment: broken chords
        const pattern = [0, 2, 4, 7, 4, 2];
        const every = calm ? 4 : 2;
        for (let s = 0, i = 0; s < STEPS_PER_BAR; s += every, i++) {
            notes.push({
                freq: f(scaleNote(chord + pattern[(i + bar) % pattern.length], 0)),
                start: barStart + s * step,
                duration: every * step * 0.9,
                instrument: config.accompaniment,
                volume: intense ? 0.3 : 0.26,
            });
        }
        // bass: soft and sparse
        const bassSteps = intense ? [0, 4, 8, 12] : (calm ? [0] : [0, 8]);
        bassSteps.forEach((s, i) => notes.push({
            freq: f(scaleNote(chord + (intense && i % 2 ? 4 : 0), -1)),
            start: barStart + s * step,
            duration: (STEPS_PER_BAR / bassSteps.length) * step * 0.85,
            instrument: 'bass',
            volume: 0.35,
        }));
        // drums
        if (!calm && config.style !== 'dungeon') {
            [0, 8].forEach((s) => notes.push({ freq: 110, start: barStart + s * step, duration: 0.1, instrument: 'kick', volume: intense ? 0.5 : 0.3 }));
            for (let s = 2; s < STEPS_PER_BAR; s += 4) {
                notes.push({ freq: 0, start: barStart + s * step, duration: 0.04, instrument: 'hat', volume: intense ? 0.35 : 0.25 });
            }
            if (intense) {
                [4, 12].forEach((s) => notes.push({ freq: 0, start: barStart + s * step, duration: 0.1, instrument: 'snare', volume: 0.4 }));
            }
        }
    }
    return { notes, duration: BARS * STEPS_PER_BAR * step };
};

export const trackConfig = (trackId: string): TrackConfig | undefined => {
    const [kind, value] = trackId.split(':');
    if (kind === 'region' || kind === 'town') {
        const theme = REGION_THEMES[+value] ?? REGION_THEMES[0];
        return { ...theme, style: kind === 'town' ? 'calm' : 'route' };
    }
    const battle = BATTLE_THEMES[kind];
    return battle ? { ...battle, style: kind as MusicStyle } : undefined;
};

export default class Music {
    private static currentTrack: string;
    private static channel: GainNode;
    private static sources: AudioScheduledSourceNode[] = [];
    private static nextLoopAt = 0;
    private static loop: { notes: Note[], duration: number };
    private static timer: ReturnType<typeof setInterval>;
    private static situation: () => MusicSituation | undefined;

    // situation() tells where the player is; undefined means silence
    public static initialize(situation: () => MusicSituation | undefined) {
        Music.situation = situation;
        clearInterval(Music.timer);
        Music.timer = setInterval(() => Music.update(), 250);
    }

    public static wantedTrack(): string | undefined {
        if (!Settings.getSetting('music.enabled')?.value || !AudioEngine.isAudible('music')) {
            return undefined;
        }
        const current = Music.situation?.();
        if (!current) {
            return undefined;
        }
        const regionMusic = Settings.getSetting('music.region')?.value;
        if (current.kind === 'town' || current.kind === 'route') {
            return regionMusic ? `${current.kind === 'town' ? 'town' : 'region'}:${current.region}` : undefined;
        }
        if (Settings.getSetting('music.battle')?.value) {
            return current.kind;
        }
        // Without battle music the region theme keeps playing
        return regionMusic ? `region:${current.region}` : undefined;
    }

    private static update() {
        const wanted = Music.wantedTrack();
        if (wanted !== Music.currentTrack) {
            Music.switchTo(wanted);
        }
        if (Music.currentTrack && Music.loop && AudioEngine.currentTime + 0.5 > Music.nextLoopAt) {
            Music.sources.push(...AudioEngine.play('music', Music.loop.notes, Music.nextLoopAt, Music.channel));
            Music.nextLoopAt += Music.loop.duration;
            // forget finished nodes
            Music.sources = Music.sources.slice(-2000);
        }
    }

    private static switchTo(track?: string) {
        // fade out the old track
        const oldChannel = Music.channel;
        const oldSources = Music.sources;
        if (oldChannel) {
            const now = AudioEngine.currentTime;
            oldChannel.gain.setValueAtTime(oldChannel.gain.value, now);
            oldChannel.gain.linearRampToValueAtTime(0, now + 1);
            setTimeout(() => {
                oldSources.forEach((s) => {
                    try {
                        s.stop();
                    } catch {
                        // already stopped
                    }
                });
                oldChannel.disconnect();
            }, 1200);
        }
        Music.channel = undefined;
        Music.sources = [];
        Music.loop = undefined;
        Music.currentTrack = track;
        const config = track ? trackConfig(track) : undefined;
        if (!config) {
            return;
        }
        Music.channel = AudioEngine.createGroupChannel('music');
        if (!Music.channel) {
            return;
        }
        const now = AudioEngine.currentTime;
        Music.channel.gain.setValueAtTime(0, now);
        Music.channel.gain.linearRampToValueAtTime(1, now + 1);
        Music.loop = composeLoop(config);
        Music.nextLoopAt = now + 0.1;
    }
}
