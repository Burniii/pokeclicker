import Settings from '../settings/Settings';

export type AudioGroup = 'sfx' | 'music';
export type Wave = OscillatorType | 'noise';
export type Note = {
    freq: number; // Hz, ignored for noise
    start: number; // seconds after "now"
    duration: number; // seconds
    wave?: Wave;
    volume?: number; // 0..1
    slideTo?: number; // Hz at the end of the note
};

// Small Web Audio synthesizer for chiptune style sounds and music, no audio files needed
export default class AudioEngine {
    private static context: AudioContext;
    private static master: GainNode;
    private static groups: Partial<Record<AudioGroup, GainNode>> = {};
    private static noiseBuffer: AudioBuffer;
    private static initialized = false;

    // Volume settings: overall volume (sound.volume) × group volume, muted by sound.muted
    private static groupVolume(group: AudioGroup): number {
        if (Settings.getSetting('sound.muted')?.value) {
            return 0;
        }
        const master = (Settings.getSetting('sound.volume')?.value ?? 100) / 100;
        const groupSetting = Settings.getSetting(group === 'music' ? 'audio.musicVolume' : 'audio.sfxVolume');
        return master * ((groupSetting?.value ?? 100) / 100);
    }

    public static initialize() {
        if (AudioEngine.initialized || typeof window === 'undefined' || !(window.AudioContext || (window as any).webkitAudioContext)) {
            return;
        }
        AudioEngine.initialized = true;
        const Context = window.AudioContext || (window as any).webkitAudioContext;
        AudioEngine.context = new Context();
        AudioEngine.master = AudioEngine.context.createGain();
        AudioEngine.master.connect(AudioEngine.context.destination);
        (['sfx', 'music'] as AudioGroup[]).forEach((group) => {
            const gain = AudioEngine.context.createGain();
            gain.connect(AudioEngine.master);
            AudioEngine.groups[group] = gain;
        });
        AudioEngine.updateVolumes();
        ['sound.muted', 'sound.volume', 'audio.sfxVolume', 'audio.musicVolume'].forEach((name) => {
            Settings.getSetting(name)?.observableValue.subscribe(() => AudioEngine.updateVolumes());
        });

        // Browsers only allow audio after a user gesture
        const resume = () => {
            if (AudioEngine.context.state === 'suspended') {
                AudioEngine.context.resume().catch(() => {});
            }
        };
        ['click', 'keydown', 'touchstart'].forEach((event) => document.addEventListener(event, resume, { passive: true }));
    }

    private static updateVolumes() {
        (Object.keys(AudioEngine.groups) as AudioGroup[]).forEach((group) => {
            AudioEngine.groups[group].gain.setTargetAtTime(AudioEngine.groupVolume(group), AudioEngine.context.currentTime, 0.05);
        });
    }

    public static resume(): Promise<void> {
        if (!AudioEngine.initialized) {
            return Promise.resolve();
        }
        return AudioEngine.context.state === 'suspended' ? AudioEngine.context.resume().catch(() => {}) : Promise.resolve();
    }

    public static isAudible(group: AudioGroup): boolean {
        return AudioEngine.initialized && AudioEngine.context.state === 'running' && AudioEngine.groupVolume(group) > 0;
    }

    public static get currentTime(): number {
        return AudioEngine.context?.currentTime ?? 0;
    }

    private static getNoiseBuffer(): AudioBuffer {
        if (!AudioEngine.noiseBuffer) {
            const length = AudioEngine.context.sampleRate;
            AudioEngine.noiseBuffer = AudioEngine.context.createBuffer(1, length, AudioEngine.context.sampleRate);
            const data = AudioEngine.noiseBuffer.getChannelData(0);
            for (let i = 0; i < length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
        return AudioEngine.noiseBuffer;
    }

    // Plays notes relative to "at" (audio context time, defaults to now). Returns the nodes so music can stop them.
    public static play(group: AudioGroup, notes: Note[], at = AudioEngine.currentTime, destination?: AudioNode): AudioScheduledSourceNode[] {
        if (!AudioEngine.isAudible(group)) {
            return [];
        }
        const ctx = AudioEngine.context;
        const output = destination ?? AudioEngine.groups[group];
        return notes.map((note) => {
            const start = at + note.start;
            const end = start + note.duration;
            const gain = ctx.createGain();
            const volume = (note.volume ?? 0.5) * 0.3;
            // short attack and release so notes don't click
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.01, note.duration / 4));
            gain.gain.setValueAtTime(volume, Math.max(start, end - Math.min(0.03, note.duration / 3)));
            gain.gain.linearRampToValueAtTime(0, end);
            gain.connect(output);

            let source: AudioScheduledSourceNode;
            if (note.wave === 'noise') {
                const noise = ctx.createBufferSource();
                noise.buffer = AudioEngine.getNoiseBuffer();
                noise.loop = true;
                source = noise;
            } else {
                const osc = ctx.createOscillator();
                osc.type = note.wave ?? 'square';
                osc.frequency.setValueAtTime(note.freq, start);
                if (note.slideTo) {
                    osc.frequency.exponentialRampToValueAtTime(note.slideTo, end);
                }
                source = osc;
            }
            source.connect(gain);
            source.start(start);
            source.stop(end + 0.02);
            source.onended = () => gain.disconnect();
            return source;
        });
    }

    public static createGroupChannel(group: AudioGroup): GainNode | undefined {
        if (!AudioEngine.initialized) {
            return undefined;
        }
        const gain = AudioEngine.context.createGain();
        gain.connect(AudioEngine.groups[group]);
        return gain;
    }

    // MIDI note number to frequency
    public static freq(midi: number): number {
        return 440 * (2 ** ((midi - 69) / 12));
    }
}
