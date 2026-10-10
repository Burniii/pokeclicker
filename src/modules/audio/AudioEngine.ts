import Settings from '../settings/Settings';

export type AudioGroup = 'sfx' | 'music';
export type Instrument =
    | 'flute' // soft sine lead with vibrato
    | 'strings' // detuned saws through a low-pass filter, slow attack
    | 'brass' // brighter strings with a faster attack
    | 'pad' // wide, slow chord pad
    | 'pluck' // harp/guitar like pluck
    | 'bell' // bell/celesta with harmonics
    | 'piano' // soft piano like tone
    | 'bass' // soft round bass
    | 'kick'
    | 'snare'
    | 'hat'
    | 'whoosh' // filtered noise sweep
    | 'click'; // short wooden click
export type Note = {
    freq: number; // Hz, ignored for noise based instruments
    start: number; // seconds after "now"
    duration: number; // seconds
    instrument: Instrument;
    volume?: number; // 0..1
    slideTo?: number; // Hz at the end of the note
};

type Voice = {
    waves: Array<{ type: OscillatorType, detune?: number, ratio?: number, level?: number }>;
    noise?: boolean;
    filter?: { type: BiquadFilterType, freq: number, q?: number, to?: number };
    attack: number;
    decay: number; // time to fall to sustain
    sustain: number; // 0..1 of the peak
    release: number;
    vibrato?: number; // cents
    gain: number;
};

const VOICES: Record<Instrument, Voice> = {
    flute: { waves: [{ type: 'sine' }, { type: 'triangle', ratio: 2, level: 0.15 }], attack: 0.06, decay: 0.2, sustain: 0.8, release: 0.15, vibrato: 12, gain: 0.5 },
    strings: { waves: [{ type: 'sawtooth', detune: -7 }, { type: 'sawtooth', detune: 7 }], filter: { type: 'lowpass', freq: 1800, q: 0.5 }, attack: 0.18, decay: 0.3, sustain: 0.85, release: 0.35, vibrato: 6, gain: 0.22 },
    brass: { waves: [{ type: 'sawtooth', detune: -4 }, { type: 'sawtooth', detune: 4 }], filter: { type: 'lowpass', freq: 2600, q: 1 }, attack: 0.05, decay: 0.2, sustain: 0.75, release: 0.2, gain: 0.2 },
    pad: { waves: [{ type: 'sawtooth', detune: -10 }, { type: 'sawtooth', detune: 10 }, { type: 'sine', ratio: 0.5, level: 0.5 }], filter: { type: 'lowpass', freq: 900, q: 0.3 }, attack: 0.6, decay: 0.5, sustain: 0.8, release: 0.8, gain: 0.12 },
    pluck: { waves: [{ type: 'triangle' }, { type: 'sine', ratio: 2, level: 0.3 }], filter: { type: 'lowpass', freq: 3000, to: 700 }, attack: 0.005, decay: 0.35, sustain: 0.15, release: 0.25, gain: 0.45 },
    bell: { waves: [{ type: 'sine' }, { type: 'sine', ratio: 2.76, level: 0.35 }, { type: 'sine', ratio: 5.4, level: 0.12 }], attack: 0.003, decay: 0.6, sustain: 0.1, release: 0.5, gain: 0.35 },
    piano: { waves: [{ type: 'triangle' }, { type: 'sine', ratio: 2, level: 0.25 }, { type: 'sine', ratio: 3, level: 0.08 }], filter: { type: 'lowpass', freq: 2500, to: 1200 }, attack: 0.004, decay: 0.8, sustain: 0.25, release: 0.3, gain: 0.4 },
    bass: { waves: [{ type: 'sine' }, { type: 'triangle', level: 0.3 }], filter: { type: 'lowpass', freq: 420 }, attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.15, gain: 0.35 },
    kick: { waves: [{ type: 'sine' }], attack: 0.002, decay: 0.18, sustain: 0, release: 0.05, gain: 0.7 },
    snare: { waves: [], noise: true, filter: { type: 'bandpass', freq: 1800, q: 0.8 }, attack: 0.002, decay: 0.14, sustain: 0, release: 0.05, gain: 0.35 },
    hat: { waves: [], noise: true, filter: { type: 'highpass', freq: 7000 }, attack: 0.002, decay: 0.05, sustain: 0, release: 0.02, gain: 0.18 },
    whoosh: { waves: [], noise: true, filter: { type: 'bandpass', freq: 600, q: 1.5, to: 3500 }, attack: 0.05, decay: 0.1, sustain: 0.6, release: 0.1, gain: 0.5 },
    click: { waves: [{ type: 'sine' }], noise: true, filter: { type: 'bandpass', freq: 2200, q: 2 }, attack: 0.001, decay: 0.04, sustain: 0, release: 0.02, gain: 0.5 },
};

// Web Audio synthesizer with a few soft instruments and a reverb, no audio files needed
export default class AudioEngine {
    private static context: AudioContext;
    private static master: GainNode;
    private static groups: Partial<Record<AudioGroup, GainNode>> = {};
    private static noiseBuffer: AudioBuffer;
    private static initialized = false;
    private static samples = new Map<string, AudioBuffer | Promise<AudioBuffer | undefined>>();

    // Volume settings: overall volume (sound.volume) × group volume, muted by sound.muted
    private static groupVolume(group: AudioGroup): number {
        if (Settings.getSetting('sound.muted')?.value) {
            return 0;
        }
        const master = (Settings.getSetting('sound.volume')?.value ?? 100) / 100;
        const groupSetting = Settings.getSetting(group === 'music' ? 'audio.musicVolume' : 'audio.sfxVolume');
        return master * ((groupSetting?.value ?? 100) / 100);
    }

    private static createReverb(seconds: number, decay: number): ConvolverNode {
        const ctx = AudioEngine.context;
        const length = Math.floor(ctx.sampleRate * seconds);
        const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * ((1 - i / length) ** decay);
            }
        }
        const convolver = ctx.createConvolver();
        convolver.buffer = impulse;
        return convolver;
    }

    public static initialize() {
        if (AudioEngine.initialized || typeof window === 'undefined' || !(window.AudioContext || (window as any).webkitAudioContext)) {
            return;
        }
        AudioEngine.initialized = true;
        const Context = window.AudioContext || (window as any).webkitAudioContext;
        AudioEngine.context = new Context();
        const ctx = AudioEngine.context;

        // master -> gentle compressor -> speakers
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.ratio.value = 3;
        compressor.connect(ctx.destination);
        AudioEngine.master = ctx.createGain();
        AudioEngine.master.connect(compressor);

        // each group: dry signal + reverb send
        const reverbMix: Record<AudioGroup, number> = { music: 0.32, sfx: 0.15 };
        (['sfx', 'music'] as AudioGroup[]).forEach((group) => {
            const input = ctx.createGain();
            const dry = ctx.createGain();
            const wet = ctx.createGain();
            const reverb = AudioEngine.createReverb(group === 'music' ? 2.6 : 1.2, group === 'music' ? 2.5 : 3.5);
            dry.gain.value = 1;
            wet.gain.value = reverbMix[group];
            input.connect(dry).connect(AudioEngine.master);
            input.connect(reverb).connect(wet).connect(AudioEngine.master);
            AudioEngine.groups[group] = input;
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

    // Plays notes relative to "at" (audio context time, defaults to now). Returns the sources so music can stop them.
    public static play(group: AudioGroup, notes: Note[], at = AudioEngine.currentTime, destination?: AudioNode): AudioScheduledSourceNode[] {
        if (!AudioEngine.isAudible(group)) {
            return [];
        }
        const output = destination ?? AudioEngine.groups[group];
        return notes.flatMap((note) => AudioEngine.playNote(note, at + note.start, output));
    }

    private static playNote(note: Note, start: number, output: AudioNode): AudioScheduledSourceNode[] {
        const ctx = AudioEngine.context;
        const voice = VOICES[note.instrument] ?? VOICES.flute;
        const peak = (note.volume ?? 0.5) * voice.gain;
        const holdEnd = start + Math.max(note.duration, voice.attack + 0.01);
        const end = holdEnd + voice.release;

        // amplitude envelope (ADSR)
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0.0001, start);
        amp.gain.linearRampToValueAtTime(peak, start + voice.attack);
        amp.gain.setTargetAtTime(Math.max(peak * voice.sustain, 0.0001), start + voice.attack, voice.decay / 3);
        amp.gain.setTargetAtTime(0.0001, holdEnd, voice.release / 4);

        let chainInput: AudioNode = amp;
        if (voice.filter) {
            const filter = ctx.createBiquadFilter();
            filter.type = voice.filter.type;
            filter.Q.value = voice.filter.q ?? 0.7;
            filter.frequency.setValueAtTime(voice.filter.freq, start);
            if (voice.filter.to) {
                filter.frequency.exponentialRampToValueAtTime(voice.filter.to, holdEnd);
            }
            filter.connect(amp);
            chainInput = filter;
        }
        amp.connect(output);

        const sources: AudioScheduledSourceNode[] = [];
        voice.waves.forEach((wave) => {
            const osc = ctx.createOscillator();
            osc.type = wave.type;
            const freq = note.freq * (wave.ratio ?? 1);
            osc.frequency.setValueAtTime(freq, start);
            if (note.slideTo) {
                osc.frequency.exponentialRampToValueAtTime(note.slideTo * (wave.ratio ?? 1), holdEnd);
            } else if (note.instrument === 'kick') {
                osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq / 3), start + 0.15);
            }
            osc.detune.value = wave.detune ?? 0;
            if (voice.vibrato) {
                const lfo = ctx.createOscillator();
                const depth = ctx.createGain();
                lfo.frequency.value = 5;
                depth.gain.setValueAtTime(0, start);
                depth.gain.linearRampToValueAtTime(voice.vibrato, start + Math.min(0.4, note.duration));
                lfo.connect(depth).connect(osc.detune);
                lfo.start(start);
                lfo.stop(end);
                sources.push(lfo);
            }
            let target: AudioNode = chainInput;
            if (wave.level !== undefined && wave.level !== 1) {
                const level = ctx.createGain();
                level.gain.value = wave.level;
                level.connect(chainInput);
                target = level;
            }
            osc.connect(target);
            osc.start(start);
            osc.stop(end);
            sources.push(osc);
        });
        if (voice.noise) {
            const noise = ctx.createBufferSource();
            noise.buffer = AudioEngine.getNoiseBuffer();
            noise.loop = true;
            noise.connect(chainInput);
            noise.start(start, Math.random() * 0.5);
            noise.stop(end);
            sources.push(noise);
        }
        const last = sources[sources.length - 1];
        if (last) {
            last.onended = () => amp.disconnect();
        }
        return sources;
    }

    // Loads (and caches) an audio file from assets/sounds
    public static loadSample(file: string): Promise<AudioBuffer | undefined> {
        if (!AudioEngine.initialized) {
            return Promise.resolve(undefined);
        }
        const cached = AudioEngine.samples.get(file);
        if (cached) {
            return Promise.resolve(cached);
        }
        const loading = fetch(`assets/sounds/${file}`)
            .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(response.status)))
            .then((data) => AudioEngine.context.decodeAudioData(data))
            .then((buffer) => {
                AudioEngine.samples.set(file, buffer);
                return buffer;
            })
            .catch(() => {
                AudioEngine.samples.delete(file);
                return undefined;
            });
        AudioEngine.samples.set(file, loading);
        return loading;
    }

    // Plays a loaded sample, returns false if it isn't loaded (yet)
    public static playSample(group: AudioGroup, file: string, volume = 1, delay = 0): boolean {
        const buffer = AudioEngine.samples.get(file);
        if (!(buffer instanceof AudioBuffer)) {
            AudioEngine.loadSample(file);
            return false;
        }
        if (!AudioEngine.isAudible(group)) {
            return true;
        }
        const ctx = AudioEngine.context;
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = volume;
        source.connect(gain).connect(AudioEngine.groups[group]);
        source.onended = () => gain.disconnect();
        source.start(ctx.currentTime + delay);
        return true;
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
