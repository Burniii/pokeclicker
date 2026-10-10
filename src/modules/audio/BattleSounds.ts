import Settings from '../settings/Settings';
import Notifier from '../notifications/Notifier';
import AudioEngine, { Note } from './AudioEngine';

export type BattleSoundName = 'hit' | 'defeat' | 'throw' | 'shake' | 'caught' | 'escape' | 'victory' | 'badge';

const f = AudioEngine.freq;

const SOUNDS: Record<BattleSoundName, { name: string, minGap: number, idleQuiet: boolean, notes: () => Note[] }> = {
    hit: {
        name: 'Click attack hit',
        minGap: 70,
        idleQuiet: true,
        notes: () => [
            { freq: 0, start: 0, duration: 0.03, instrument: 'click', volume: 0.5 },
            { freq: 180, slideTo: 90, start: 0, duration: 0.06, instrument: 'kick', volume: 0.35 },
        ],
    },
    defeat: {
        name: 'Pokémon defeated',
        minGap: 150,
        idleQuiet: true,
        notes: () => [
            { freq: f(76), slideTo: f(64), start: 0, duration: 0.12, instrument: 'pluck', volume: 0.45 },
            { freq: 0, start: 0, duration: 0.12, instrument: 'whoosh', volume: 0.25 },
        ],
    },
    throw: {
        name: 'Poké Ball thrown',
        minGap: 150,
        idleQuiet: true,
        notes: () => [{ freq: 0, start: 0, duration: 0.18, instrument: 'whoosh', volume: 0.6 }],
    },
    shake: {
        name: 'Poké Ball shakes',
        minGap: 120,
        idleQuiet: true,
        notes: () => [
            { freq: 420, start: 0, duration: 0.03, instrument: 'click', volume: 0.6 },
            { freq: 360, start: 0.07, duration: 0.03, instrument: 'click', volume: 0.45 },
        ],
    },
    caught: {
        name: 'Pokémon caught',
        minGap: 200,
        idleQuiet: false,
        notes: () => [
            { freq: f(79), start: 0, duration: 0.3, instrument: 'bell', volume: 0.5 },
            { freq: f(83), start: 0.09, duration: 0.3, instrument: 'bell', volume: 0.5 },
            { freq: f(86), start: 0.18, duration: 0.5, instrument: 'bell', volume: 0.55 },
            { freq: f(67), start: 0, duration: 0.6, instrument: 'pad', volume: 0.6 },
        ],
    },
    escape: {
        name: 'Pokémon broke free',
        minGap: 200,
        idleQuiet: true,
        notes: () => [
            { freq: 0, start: 0, duration: 0.1, instrument: 'whoosh', volume: 0.4 },
            { freq: f(62), start: 0.02, duration: 0.15, instrument: 'pluck', volume: 0.4 },
            { freq: f(57), start: 0.12, duration: 0.25, instrument: 'pluck', volume: 0.35 },
        ],
    },
    victory: {
        name: 'Gym or battle won',
        minGap: 1000,
        idleQuiet: true,
        notes: () => [
            { freq: f(72), start: 0, duration: 0.15, instrument: 'brass', volume: 0.45 },
            { freq: f(76), start: 0.15, duration: 0.15, instrument: 'brass', volume: 0.45 },
            { freq: f(79), start: 0.3, duration: 0.6, instrument: 'brass', volume: 0.5 },
            { freq: f(84), start: 0.3, duration: 0.8, instrument: 'bell', volume: 0.35 },
            { freq: f(60), start: 0, duration: 1, instrument: 'pad', volume: 0.6 },
        ],
    },
    badge: {
        name: 'New badge earned',
        minGap: 1000,
        idleQuiet: false,
        notes: () => {
            const melody = [72, 72, 72, 76, 79, 77, 79, 84];
            const lengths = [0.12, 0.12, 0.12, 0.36, 0.18, 0.18, 0.18, 0.9];
            let t = 0;
            const notes: Note[] = [];
            melody.forEach((midi, i) => {
                notes.push({ freq: f(midi), start: t, duration: lengths[i] * 0.9, instrument: 'brass', volume: 0.45 });
                t += lengths[i];
            });
            notes.push({ freq: f(96), start: t - 0.9, duration: 1, instrument: 'bell', volume: 0.3 });
            [[48, 55, 64], [53, 57, 65], [55, 59, 67], [48, 55, 64]].forEach((chord, i) => chord.forEach((midi) => notes.push({
                freq: f(midi), start: i * 0.55, duration: 0.55, instrument: 'strings', volume: 0.4,
            })));
            return notes;
        },
    },
};

const IDLE_TIME = 60 * 1000;

export default class BattleSounds {
    private static lastPlayed: Partial<Record<BattleSoundName, number>> = {};

    public static readonly list = (Object.keys(SOUNDS) as BattleSoundName[]).map((key) => ({ key, name: SOUNDS[key].name }));

    public static play(sound: BattleSoundName, delaySeconds = 0) {
        const definition = SOUNDS[sound];
        if (!definition || !Settings.getSetting(`battleSound.${sound}`)?.value || !AudioEngine.isAudible('sfx')) {
            return;
        }
        if (definition.idleQuiet && Settings.getSetting('battleSound.quietWhenIdle')?.value
            && Date.now() - Notifier.lastInputTime() > IDLE_TIME) {
            return;
        }
        const now = Date.now() + delaySeconds * 1000;
        if (now - (BattleSounds.lastPlayed[sound] ?? 0) < definition.minGap) {
            return;
        }
        BattleSounds.lastPlayed[sound] = now;
        AudioEngine.play('sfx', definition.notes(), AudioEngine.currentTime + delaySeconds);
    }

    // Plays a sound from the settings, ignoring whether it is enabled
    public static preview(sound: BattleSoundName) {
        AudioEngine.resume().then(() => AudioEngine.play('sfx', SOUNDS[sound].notes()));
    }

    // Ball thrown, then up to three shakes spread over the catch time
    public static catchAttempt(catchTimeMs: number) {
        BattleSounds.play('throw');
        const shakes = Math.min(3, Math.max(1, Math.floor(catchTimeMs / 400)));
        for (let i = 1; i <= shakes; i++) {
            const delay = (catchTimeMs / 1000) * (i / (shakes + 1));
            setTimeout(() => BattleSounds.play('shake'), delay * 1000);
        }
    }
}
