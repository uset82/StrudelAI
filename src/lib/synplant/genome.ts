import { InstrumentType } from '@/types/sonic';

export interface TrackGenome {
    id: string;
    trackId: InstrumentType;
    notes: string;   // mini-notation body (no expr: prefix)
    synth: string;   // Strudel synth or noise type
    vowel: string;   // vowel/formant string
    fx?: GenomeFx[]; // enabled effect tags
    slow: number;    // time stretch
    gain: number;    // amplitude
    room: number;    // reverb amount
    delay: number;   // delay amount
    lpf: number;     // 0..1 low-pass amount
    density: number; // rhythmic density hint
    spice: number;   // extra chaos dial (0..1)
}

export type MutationDepth = 'gentle' | 'wild' | 'chaos';
export type GenomeFx = 'filter' | 'reverb' | 'delay' | 'neuro';

const VOWELS = ['a', 'e', 'i', 'o', 'u'];

const DEFAULT_FX: Record<InstrumentType, GenomeFx[]> = {
    drums: ['filter', 'reverb', 'delay'],
    bass: ['filter', 'reverb'],
    melody: ['filter', 'reverb', 'delay'],
    voice: ['filter', 'reverb', 'delay', 'neuro'],
    fx: ['filter', 'reverb', 'delay', 'neuro'],
};

export function defaultFx(trackId: InstrumentType): GenomeFx[] {
    return DEFAULT_FX[trackId] ?? ['filter', 'reverb'];
}

function normalizeFx(trackId: InstrumentType, fx?: GenomeFx[]): GenomeFx[] {
    if (!fx || fx.length === 0) return defaultFx(trackId);
    const valid = fx.filter((f): f is GenomeFx => f === 'filter' || f === 'reverb' || f === 'delay' || f === 'neuro');
    return valid.length > 0 ? Array.from(new Set(valid)) : defaultFx(trackId);
}

const SYNTHS: Record<InstrumentType, string[]> = {
    drums: ['square', 'pink', 'triangle'],
    bass: ['triangle', 'sawtooth', 'square'],
    melody: ['sawtooth', 'square', 'sine'],
    voice: ['sawtooth', 'sine', 'triangle'],
    fx: ['sine', 'pink', 'sawtooth'],
};

const NOTE_POOLS: Record<InstrumentType, string[]> = {
    drums: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'g1', 'g2'],
    bass: ['c1', 'c2', 'eb1', 'eb2', 'g1', 'g2', 'bb1', 'bb2'],
    melody: ['c4', 'd4', 'eb4', 'f4', 'g4', 'bb4', 'c5', 'd5', 'eb5', 'g5'],
    voice: ['c4', 'eb4', 'f4', 'g4', 'bb4', 'c5', 'd5', 'eb5', 'f5', 'g5'],
    fx: ['c5', 'eb5', 'g5', 'bb5', 'c6', 'eb6', 'g6'],
};

const DENSITIES = [1, 2, 3, 4, 6, 8, 12, 16];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const choice = <T,>(arr: T[]) => arr[randInt(0, arr.length - 1)];

function sanitizeVowel(v: string) {
    const token = v.toLowerCase().trim();
    if (VOWELS.includes(token)) return token;
    const match = token.match(/[aeiou]/);
    return match ? match[0] : 'a';
}

function makeId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeMini(src: string) {
    return src.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function randomNotes(trackId: InstrumentType, density?: number) {
    const pool = NOTE_POOLS[trackId];
    const steps = randInt(3, 8);
    const chordChance = trackId === 'melody' || trackId === 'voice' ? 0.35 : 0.15;
    const restChance = trackId === 'drums' ? 0.15 : 0.25;

    const tokens: string[] = [];
    for (let i = 0; i < steps; i++) {
        if (Math.random() < restChance) {
            tokens.push('~');
            continue;
        }
        if (Math.random() < chordChance) {
            const chordSize = randInt(2, 4);
            const chordNotes = Array.from({ length: chordSize }, () => choice(pool));
            tokens.push(`<${chordNotes.join(' ')}>`); // mini chord literal
        } else {
            tokens.push(choice(pool));
        }
    }

    const dens = density ?? choice(DENSITIES);
    if (dens > 1 && tokens[0] !== '~') {
        tokens[0] = `${tokens[0]}*${dens}`;
    }

    return tokens.join(' ');
}

export function randomGenome(trackId: InstrumentType, depth: MutationDepth = 'wild'): TrackGenome {
    const density = choice(DENSITIES);
    const spice = depth === 'gentle' ? rand(0, 0.3) : depth === 'wild' ? rand(0.2, 0.7) : rand(0.6, 1);

    return {
        id: makeId(),
        trackId,
        notes: randomNotes(trackId, density),
        synth: choice(SYNTHS[trackId]),
        vowel: sanitizeVowel(choice(VOWELS)),
        fx: defaultFx(trackId),
        slow: choice([0.5, 1, 2, 4, 6]) * rand(0.8, 1.25),
        gain: rand(0.25, 0.9) + spice * 0.5,
        room: clamp(rand(0.1, 0.8) + spice * 0.4, 0, 1),
        delay: clamp(rand(0, 0.6) + spice * 0.3, 0, 0.9),
        lpf: clamp(rand(0, 0.9) + spice * 0.5, 0, 1),
        density,
        spice,
    };
}

function jitter(v: number, amt: number, min: number, max: number) {
    return clamp(v + rand(-amt, amt), min, max);
}

export function mutateGenome(parent: TrackGenome, depth: MutationDepth = 'wild'): TrackGenome {
    const d = depth === 'gentle' ? 0.12 : depth === 'wild' ? 0.35 : 0.75;
    const spice = clamp(jitter(parent.spice, d, 0, 1), 0, 1);

    const regenNotes = Math.random() < d * 0.8;
    const regenSynth = Math.random() < d * 0.5;
    const regenVowel = parent.trackId === 'voice' || parent.trackId === 'fx'
        ? Math.random() < d * 0.8
        : Math.random() < d * 0.35;

    const density = Math.random() < d * 0.5 ? choice(DENSITIES) : parent.density;

    return {
        ...parent,
        id: makeId(),
        notes: regenNotes ? randomNotes(parent.trackId, density) : parent.notes,
        synth: regenSynth ? choice(SYNTHS[parent.trackId]) : parent.synth,
        vowel: regenVowel ? sanitizeVowel(choice(VOWELS)) : sanitizeVowel(parent.vowel),
        slow: jitter(parent.slow, d * 2, 0.25, 10),
        gain: jitter(parent.gain, d * 0.6, 0.1, 1.5),
        room: jitter(parent.room, d * 0.7, 0, 1),
        delay: jitter(parent.delay, d * 0.6, 0, 0.95),
        lpf: jitter(parent.lpf, d * 0.9, 0, 1),
        density,
        spice,
    };
}

// Continuous evolution used for Bulb growth (0=center, 1=outer chaos)
export function evolveGenome(parent: TrackGenome, growth: number): TrackGenome {
    const g = clamp(growth, 0, 1);
    const depth: MutationDepth =
        g < 0.33 ? 'gentle' :
            g < 0.66 ? 'wild' : 'chaos';

    let child = mutateGenome(parent, depth);

    // Push spice proportional to growth for more dramatic outer branches
    child = {
        ...child,
        spice: clamp(parent.spice + g * 0.9 + rand(-0.08, 0.08), 0, 1),
        gain: jitter(parent.gain, g * 0.9, 0.1, 1.8),
        room: jitter(parent.room, g * 0.9, 0, 1),
        delay: jitter(parent.delay, g * 0.7, 0, 0.95),
        lpf: jitter(parent.lpf, g * 1.2, 0, 1),
        slow: jitter(parent.slow, g * 3, 0.25, 12),
    };

    return child;
}

export function breedGenomes(a: TrackGenome, b: TrackGenome): TrackGenome {
    if (a.trackId !== b.trackId) {
        // Cross-track breeding: fall back to a mutated clone of a
        return mutateGenome(a, 'wild');
    }

    const pick = <T,>(x: T, y: T) => (Math.random() < 0.5 ? x : y);
    const mergedFx = Array.from(new Set([
        ...normalizeFx(a.trackId, a.fx),
        ...normalizeFx(b.trackId, b.fx),
    ]));

    return {
        id: makeId(),
        trackId: a.trackId,
        notes: pick(a.notes, b.notes),
        synth: pick(a.synth, b.synth),
        vowel: sanitizeVowel(pick(a.vowel, b.vowel)),
        fx: mergedFx,
        slow: (a.slow + b.slow) / 2,
        gain: (a.gain + b.gain) / 2,
        room: (a.room + b.room) / 2,
        delay: (a.delay + b.delay) / 2,
        lpf: (a.lpf + b.lpf) / 2,
        density: pick(a.density, b.density),
        spice: clamp((a.spice + b.spice) / 2, 0, 1),
    };
}

export function genomeToPattern(genome: TrackGenome): string {
    const mini = escapeMini(genome.notes);
    const fx = normalizeFx(genome.trackId, genome.fx);
    const hasFx = (tag: GenomeFx) => fx.includes(tag);

    let expr: string;

    // Build track-specific sound design
    switch (genome.trackId) {
        case 'drums': {
            // Drums: Use layered noise + short envelope for realistic percussion
            // Layer 1: Body (low freq thump)
            // Layer 2: Attack (noise burst for "crack")
            const bodyDecay = 0.08 + genome.spice * 0.04;
            const attackDecay = 0.02 + genome.spice * 0.01;
            const body = `note(m("${mini}")).s("triangle").att(0.001).decay(${bodyDecay.toFixed(3)}).lpf(${150 + genome.spice * 50})`;
            const attack = `note(m("${mini}")).s("pink").att(0.001).decay(${attackDecay.toFixed(3)}).hpf(${2000 + genome.spice * 2000}).gain(0.6)`;
            expr = `stack(${body}, ${attack})`;
            break;
        }

        case 'bass': {
            // Bass: Low octave sawtooth with proper sub character
            const subGain = 0.7 + genome.spice * 0.3;
            const harmonicGain = 0.3 + genome.spice * 0.2;
            const decay = 0.2 + genome.slow * 0.1;
            // Layer 1: Sub (pure sine for deep bass)
            // Layer 2: Harmonic content (saw/square for grit)
            const sub = `note(m("${mini}")).s("sine").att(0.005).decay(${decay.toFixed(2)}).lpf(120).gain(${subGain.toFixed(2)})`;
            const harmonic = `note(m("${mini}")).s("${genome.synth}").att(0.01).decay(${(decay * 0.7).toFixed(2)}).lpf(${400 + genome.spice * 400}).gain(${harmonicGain.toFixed(2)})`;
            expr = `stack(${sub}, ${harmonic})`;
            break;
        }

        case 'melody': {
            // Melody: Synth lead with proper attack/release
            const attack = 0.01 + (1 - genome.spice) * 0.05;
            const decay = 0.1 + genome.slow * 0.2;
            expr = `note(m("${mini}")).s("${genome.synth}").att(${attack.toFixed(3)}).decay(${decay.toFixed(2)})`;

            // Add slight detune for richness on supersaw/sawtooth
            if (genome.synth === 'sawtooth' || genome.synth === 'supersaw') {
                expr += `.detune(${(genome.spice * 15).toFixed(1)})`;
            }
            break;
        }

        case 'voice': {
            // Voice: Choir-like pad with formant and slow attack
            const attack = 0.05 + (1 - genome.spice) * 0.1;
            const decay = 0.3 + genome.slow * 0.3;
            // Use multiple oscillators for choir effect
            const voice1 = `note(m("${mini}")).s("${genome.synth}").vowel("${sanitizeVowel(genome.vowel)}").att(${attack.toFixed(2)}).decay(${decay.toFixed(2)})`;
            const voice2 = `note(m("${mini}")).s("sine").vowel("${sanitizeVowel(genome.vowel === 'a' ? 'o' : genome.vowel === 'e' ? 'i' : 'a')}").att(${(attack * 1.2).toFixed(2)}).decay(${(decay * 1.1).toFixed(2)}).gain(0.4)`;
            expr = `stack(${voice1}, ${voice2})`;
            break;
        }

        case 'fx': {
            // FX: Atmospheric pad/texture
            const attack = 0.1 + genome.slow * 0.2;
            const decay = 0.4 + genome.slow * 0.4;
            expr = `note(m("${mini}")).s("${genome.synth}").vowel("${sanitizeVowel(genome.vowel)}").att(${attack.toFixed(2)}).decay(${decay.toFixed(2)})`;
            break;
        }

        default:
            expr = `note(m("${mini}")).s("${genome.synth}")`;
    }

    // Apply common FX chain
    // Neuro-plant FX: when spice is high, use slow modulators for living timbre
    if (hasFx('filter') && genome.lpf > 0.02) {
        const cutoff = 20000 - genome.lpf * 19500;
        if (hasFx('neuro') && genome.spice > 0.55) {
            const span = Math.max(200, cutoff * (0.35 + genome.spice * 0.35));
            const low = clamp(cutoff - span, 120, cutoff);
            const high = clamp(cutoff, low + 50, 20000);
            const rate = clamp(2 + genome.spice * 6, 1.5, 10);
            expr = `(${expr}).lpf(sine.range(${low.toFixed(0)}, ${high.toFixed(0)}).slow(${rate.toFixed(2)}))`;
        } else {
            expr = `(${expr}).lpf(${cutoff.toFixed(0)})`;
        }
    }
    if (hasFx('reverb') && genome.room > 0.02) {
        expr = `(${expr}).room(${genome.room.toFixed(2)})`;
    }
    if (hasFx('delay') && genome.delay > 0.02) {
        expr = `(${expr}).delay(${genome.delay.toFixed(2)})`;
    }
    if (genome.slow && Math.abs(genome.slow - 1) > 0.05) {
        expr = `(${expr}).slow(${genome.slow.toFixed(2)})`;
    }
    if (genome.gain && Math.abs(genome.gain - 1) > 0.05) {
        if (hasFx('neuro') && genome.spice > 0.7) {
            const base = genome.gain;
            const low = clamp(base * (0.6 - genome.spice * 0.15), 0.05, base);
            const high = clamp(base * (1.1 + genome.spice * 0.25), base, 2);
            const rate = clamp(1.5 + genome.spice * 5, 1, 8);
            expr = `(${expr}).gain(sine.range(${low.toFixed(2)}, ${high.toFixed(2)}).slow(${rate.toFixed(2)}))`;
        } else {
            expr = `(${expr}).gain(${genome.gain.toFixed(2)})`;
        }
    }

    return `expr:${expr}`;
}

export function summarizeGenome(genome: TrackGenome) {
    // Generate varied vibe names based on multiple parameters for more diversity
    const vibesBySpice = [
        // Low spice (0-0.2): calm names
        ['zen', 'soft', 'gentle', 'calm'],
        // Low-mid spice (0.2-0.4): warm names  
        ['lush', 'warm', 'mellow', 'dreamy'],
        // Mid spice (0.4-0.6): active names
        ['bright', 'groove', 'punchy', 'alive'],
        // Mid-high spice (0.6-0.8): intense names
        ['wild', 'fierce', 'bold', 'fire'],
        // High spice (0.8-1.0): extreme names
        ['chaos', 'brutal', 'insane', 'riot']
    ];

    // Pick category based on spice level
    const spiceIndex = Math.min(4, Math.floor(genome.spice * 5));
    const category = vibesBySpice[spiceIndex];

    // Use room+delay+lpf to pick within category for more variety
    const subIndex = Math.floor((genome.room + genome.delay + genome.lpf) * 1.33) % category.length;
    const vibe = category[subIndex];

    return {
        vibe,
        synth: genome.synth,
        vowel: genome.vowel,
        slow: genome.slow.toFixed(2),
        room: genome.room.toFixed(2),
        delay: genome.delay.toFixed(2),
        lpf: genome.lpf.toFixed(2),
        density: genome.density,
    };
}
