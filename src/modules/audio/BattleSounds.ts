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
            { freq: f(84), slideTo: f(72), start: 0, duration: 0.05, wave: 'square', volume: 0.25 },
            { freq: 0, start: 0, duration: 0.03, wave: 'noise', volume: 0.12 },
        ],
    },
    defeat: {
        name: 'Pokémon defeated',
        minGap: 150,
        idleQuiet: true,
        notes: () => [
            { freq: f(76), slideTo: f(52), start: 0, duration: 0.14, wave: 'square', volume: 0.3 },
            { freq: 0, start: 0.02, duration: 0.1, wave: 'noise', volume: 0.15 },
        ],
    },
    throw: {
        name: 'Poké Ball thrown',
        minGap: 150,
        idleQuiet: true,
        notes: () => [{ freq: f(60), slideTo: f(84), start: 0, duration: 0.12, wave: 'triangle', volume: 0.45 }],
    },
    shake: {
        name: 'Poké Ball shakes',
        minGap: 120,
        idleQuiet: true,
        notes: () => [
            { freq: f(55), start: 0, duration: 0.05, wave: 'triangle', volume: 0.5 },
            { freq: f(50), start: 0.06, duration: 0.05, wave: 'triangle', volume: 0.4 },
        ],
    },
    caught: {
        name: 'Pokémon caught',
        minGap: 200,
        idleQuiet: false,
        notes: () => [
            { freq: f(72), start: 0, duration: 0.08, wave: 'square', volume: 0.35 },
            { freq: f(76), start: 0.08, duration: 0.08, wave: 'square', volume: 0.35 },
            { freq: f(79), start: 0.16, duration: 0.08, wave: 'square', volume: 0.35 },
            { freq: f(84), start: 0.24, duration: 0.2, wave: 'square', volume: 0.35 },
            { freq: f(60), start: 0, duration: 0.44, wave: 'triangle', volume: 0.4 },
        ],
    },
    escape: {
        name: 'Pokémon broke free',
        minGap: 200,
        idleQuiet: true,
        notes: () => [
            { freq: f(67), start: 0, duration: 0.08, wave: 'square', volume: 0.3 },
            { freq: f(62), start: 0.09, duration: 0.14, wave: 'square', volume: 0.3 },
        ],
    },
    victory: {
        name: 'Gym or battle won',
        minGap: 1000,
        idleQuiet: true,
        notes: () => [
            { freq: f(67), start: 0, duration: 0.1, wave: 'square', volume: 0.35 },
            { freq: f(72), start: 0.1, duration: 0.1, wave: 'square', volume: 0.35 },
            { freq: f(76), start: 0.2, duration: 0.3, wave: 'square', volume: 0.35 },
            { freq: f(48), start: 0, duration: 0.5, wave: 'triangle', volume: 0.4 },
        ],
    },
    badge: {
        name: 'New badge earned',
        minGap: 1000,
        idleQuiet: false,
        notes: () => {
            const melody = [72, 72, 72, 76, 79, 77, 79, 84];
            const lengths = [0.1, 0.1, 0.1, 0.3, 0.15, 0.15, 0.15, 0.5];
            let t = 0;
            const notes: Note[] = [];
            melody.forEach((midi, i) => {
                notes.push({ freq: f(midi), start: t, duration: lengths[i] * 0.95, wave: 'square', volume: 0.35 });
                t += lengths[i];
            });
            [48, 52, 55, 60].forEach((midi, i) => notes.push({ freq: f(midi), start: i * 0.4, duration: 0.4, wave: 'triangle', volume: 0.4 }));
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
