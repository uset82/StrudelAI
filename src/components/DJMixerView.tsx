'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { updateAudioLayer, initAudio, getSampleAudioContext } from '@/lib/strudel/engine';
import { AudioDeck } from '@/lib/dj/audio-deck';

type DeckId = 'A' | 'B';
type PadMode = 'hotcue' | 'loop' | 'fx' | 'sampler';
type PadFx = 'reverb' | 'echo' | 'roll' | 'filter';

const PAD_FX_ORDER: PadFx[] = ['reverb', 'echo', 'roll', 'filter'];
const PAD_FX_LABEL: Record<PadFx, string> = {
    reverb: 'RV',
    echo: 'DL',
    roll: 'RL',
    filter: 'FX',
};

function nextPadFx(current: PadFx): PadFx {
    const idx = PAD_FX_ORDER.indexOf(current);
    return PAD_FX_ORDER[(idx + 1) % PAD_FX_ORDER.length];
}

function applyPadFx(expr: string, fx: PadFx) {
    switch (fx) {
        case 'reverb':
            return `(${expr}).room(0.7).roomsize(12).release(0.8)`;
        case 'echo':
            return `(${expr}).delay(0.55).delaytime(0.25).delayfeedback(0.35)`;
        case 'roll':
            return `(${expr}).fast(2)`;
        case 'filter':
            return `(${expr}).lpf(900)`;
        default:
            return expr;
    }
}

// Browseable "tracks" (synthetic only — no external samples required).
const TRACK_LIBRARY: Array<{ name: string; bpm: number; pattern: string }> = [
    {
        name: 'Techno Tool',
        bpm: 128,
        pattern:
            'stack(' +
            'note("c2*4").s("square").decay(0.12).lpf(140).gain(1.1),' +
            'note("~ c4 ~ c4").s("pink").hpf(1400).decay(0.04).gain(0.45),' +
            'note("c6*8").s("pink").hpf(7500).decay(0.02).gain(0.35),' +
            'note("c2 ~ c2 ~").s("sawtooth").lpf(260).decay(0.2).gain(0.55)' +
            ')',
    },
    {
        name: 'Hard Groove',
        bpm: 132,
        pattern:
            'stack(' +
            'note("c2*4").s("square").decay(0.11).lpf(150).gain(1.1),' +
            'note("~ ~ c3 ~ ~ ~ c3 ~").s("square").hpf(500).decay(0.08).gain(0.55),' +
            'note("c6*16").s("pink").hpf(9000).decay(0.01).gain(0.25),' +
            'note("c2 eb2 g2 bb2").s("sawtooth").lpf(320).decay(0.18).gain(0.5)' +
            ')',
    },
    {
        name: 'Electro Pulse',
        bpm: 124,
        pattern:
            'stack(' +
            'note("c2 ~ c2 c2").s("square").decay(0.12).lpf(140).gain(1.1),' +
            'note("~ c3 ~ c3").s("square").hpf(500).decay(0.08).gain(0.6),' +
            'note("c6*16").s("pink").hpf(8000).decay(0.01).gain(0.35),' +
            'note("c4 ~ e4 ~ g4 ~ e4 ~").s("triangle").decay(0.05).hpf(500).gain(0.28)' +
            ')',
    },
    {
        name: 'Acid Driver',
        bpm: 140,
        pattern:
            'stack(' +
            'note("c2*4").s("square").decay(0.12).lpf(140).gain(1.1),' +
            'note("c6*16").s("pink").hpf(8500).decay(0.01).gain(0.3),' +
            'note("c3 c3 g3 c4").s("sawtooth").lpf(sine.range(300, 2200).slow(2)).decay(0.12).gain(0.45).distort(0.22),' +
            'note("~ ~ c5 ~ ~ ~ c5 ~").s("pink").hpf(1800).decay(0.02).gain(0.18)' +
            ')',
    },
];

type SyntheticLibraryItem = { kind: 'synthetic'; id: string; name: string; bpm: number; pattern: string };
type UploadedLibraryItem = {
    kind: 'uploaded';
    id: string;
    name: string;
    bpm: number | null;
    downbeatSec: number | null;
    audioBuffer: AudioBuffer;
};
type LibraryItem = SyntheticLibraryItem | UploadedLibraryItem;
type DeckSource = { kind: 'synthetic'; index: number } | { kind: 'uploaded'; id: string };

const SYNTH_LIBRARY: SyntheticLibraryItem[] = TRACK_LIBRARY.map((t, idx) => ({
    kind: 'synthetic',
    id: `synth_${idx}`,
    name: t.name,
    bpm: t.bpm,
    pattern: t.pattern,
}));

type DjChannel = {
    input: GainNode;
    low: BiquadFilterNode;
    mid: BiquadFilterNode;
    high: BiquadFilterNode;
    filter: BiquadFilterNode;
    out: GainNode;
    deck: AudioDeck;
};

type DjAudio = {
    ctx: AudioContext;
    master: GainNode;
    deckA: DjChannel;
    deckB: DjChannel;
};

// Synthetic pad sounds (full expressions, not sample names)
const PADS_A = [
    'note("c2").s("square").decay(0.08).lpf(180)',     // Kick
    'note("c3").s("square").decay(0.06).hpf(400)',     // Snare
    'note("c5").s("square").decay(0.02).hpf(6000)',    // Hi-hat
    'note("c4").s("square").decay(0.04).hpf(800)',     // Clap
];
const PADS_B = [
    'note("c2").s("triangle").decay(0.1).lpf(150)',    // Kick 2
    'note("d3").s("square").decay(0.05).hpf(500)',     // Snare 2
    'note("d5").s("square").decay(0.02).hpf(7000)',    // Hi-hat 2
    'note("d4").s("square").decay(0.04).hpf(900)',     // Clap 2
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clampIndex = (i: number, length: number) => Math.max(0, Math.min(i, Math.max(0, length - 1)));

function makeId(prefix: string) {
    try {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
            return `${prefix}_${(crypto as Crypto).randomUUID()}`;
        }
    } catch { /* ignore */ }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type BeatgridImport = {
    bpm: number | null;
    downbeatSec: number | null;
};

function parseBeatgridImport(payload: unknown): BeatgridImport | null {
    if (!payload || typeof payload !== 'object') return null;
    const obj = payload as Record<string, unknown>;

    const rawBpm = obj.bpm;
    const bpm =
        typeof rawBpm === 'number' && Number.isFinite(rawBpm) && rawBpm > 0
            ? clamp(rawBpm, 40, 240)
            : null;

    const rawDownbeat =
        (typeof obj.downbeatSec === 'number' ? obj.downbeatSec : null) ??
        (typeof obj.downbeat === 'number' ? obj.downbeat : null) ??
        (typeof obj.downbeatMs === 'number' ? obj.downbeatMs / 1000 : null);

    const downbeatSec =
        typeof rawDownbeat === 'number' && Number.isFinite(rawDownbeat) && rawDownbeat >= 0
            ? rawDownbeat
            : null;

    if (bpm === null && downbeatSec === null) return null;
    return { bpm, downbeatSec };
}

function eqToGain(v: number) {
    const d = v - 0.5;
    if (Math.abs(d) < 0.03) return 1;
    return clamp(1 + d * 2.2, 0, 2.5);
}

function applyEq(expr: string, low: number, mid: number, high: number) {
    const gLow = eqToGain(low);
    const gMid = eqToGain(mid);
    const gHigh = eqToGain(high);

    if (gLow === 1 && gMid === 1 && gHigh === 1) return expr;

    const base = `(${expr})`;
    const lowBand = `${base}.lpf(300).gain(${gLow.toFixed(2)})`;
    const midBand = `${base}.bandf(1200).gain(${gMid.toFixed(2)})`;
    const highBand = `${base}.hpf(2500).gain(${gHigh.toFixed(2)})`;
    return `stack(${lowBand}, ${midBand}, ${highBand})`;
}

function eqToDb(v: number) {
    if (v <= 0.02) return -80;
    const d = v - 0.5;
    if (Math.abs(d) < 0.03) return 0;
    return clamp(d * 24, -24, 12);
}

function applyFilterToNode(node: BiquadFilterNode, filter: number) {
    const d = filter - 0.5;
    if (Math.abs(d) < 0.02) {
        node.type = 'lowpass';
        node.frequency.setValueAtTime(20000, node.context.currentTime);
        node.Q.setValueAtTime(0.7, node.context.currentTime);
        return;
    }

    if (filter < 0.5) {
        const t = filter / 0.5;
        const cutoff = lerp(300, 20000, t);
        node.type = 'lowpass';
        node.frequency.setValueAtTime(cutoff, node.context.currentTime);
        node.Q.setValueAtTime(0.7, node.context.currentTime);
        return;
    }

    const t = (filter - 0.5) / 0.5;
    const cutoff = lerp(40, 9000, t);
    node.type = 'highpass';
    node.frequency.setValueAtTime(cutoff, node.context.currentTime);
    node.Q.setValueAtTime(0.7, node.context.currentTime);
}

function applyFilter(expr: string, filter: number) {
    const d = filter - 0.5;
    if (Math.abs(d) < 0.02) return expr;

    if (filter < 0.5) {
        const t = filter / 0.5;
        const cutoff = lerp(300, 20000, t);
        return `(${expr}).lpf(${cutoff.toFixed(0)})`;
    }

    const t = (filter - 0.5) / 0.5;
    const cutoff = lerp(40, 9000, t);
    return `(${expr}).hpf(${cutoff.toFixed(0)})`;
}

function stripGain(src: string) {
    // Preserve per-voice gains inside stack(...), but remove a trailing gain(...) so we can apply deck gain consistently.
    return src.replace(/\.gain\([^)]+\)\s*$/g, '').trim();
}

function buildDeckExpr(base: string, opts: {
    gain: number;
    speed: number;
    filter: number;
    eqLow: number;
    eqMid: number;
    eqHigh: number;
}) {
    let expr = stripGain(base);

    if (Math.abs(opts.speed - 1) > 0.01) {
        // Use .fast() to change pattern tempo (DJ pitch/tempo). This keeps the global scheduler BPM locked.
        expr = `(${expr}).fast(${opts.speed.toFixed(3)})`;
    }

    expr = applyFilter(expr, opts.filter);
    expr = applyEq(expr, opts.eqLow, opts.eqMid, opts.eqHigh);

    expr = `(${expr}).gain(${opts.gain.toFixed(3)})`;
    return expr;
}

interface DJMixerViewProps {
    bpm?: number;
}

export function DJMixerView({ bpm = 120 }: DJMixerViewProps) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [fitScale, setFitScale] = useState(1);
    const [beatMatchStatus, setBeatMatchStatus] = useState<string | null>(null);

    const [crossfader, setCrossfader] = useState(0);

    const [deckAPlaying, setDeckAPlaying] = useState(false);
    const [deckBPlaying, setDeckBPlaying] = useState(false);

    const [deckAVolume, setDeckAVolume] = useState(0.8);
    const [deckBVolume, setDeckBVolume] = useState(0.8);
    const [deckAFader, setDeckAFader] = useState(1);
    const [deckBFader, setDeckBFader] = useState(1);
    const [masterVolume, setMasterVolume] = useState(1);
    const [masterPitch, setMasterPitch] = useState(0.5);
    const [browseIndex, setBrowseIndex] = useState(0);
    const [uploadedTracks, setUploadedTracks] = useState<UploadedLibraryItem[]>([]);
    const [djAudioVersion, setDjAudioVersion] = useState(0);

    const [deckASource, setDeckASource] = useState<DeckSource>({ kind: 'synthetic', index: 0 });
    const [deckBSource, setDeckBSource] = useState<DeckSource>({ kind: 'synthetic', index: 1 });

    const [deckASpeed, setDeckASpeed] = useState(1);
    const [deckBSpeed, setDeckBSpeed] = useState(1);

    const [deckAEqLow, setDeckAEqLow] = useState(0.5);
    const [deckAEqMid, setDeckAEqMid] = useState(0.5);
    const [deckAEqHigh, setDeckAEqHigh] = useState(0.5);
    const [deckBEqLow, setDeckBEqLow] = useState(0.5);
    const [deckBEqMid, setDeckBEqMid] = useState(0.5);
    const [deckBEqHigh, setDeckBEqHigh] = useState(0.5);

    const [deckAFilter, setDeckAFilter] = useState(0.5);
    const [deckBFilter, setDeckBFilter] = useState(0.5);

    const [reverbExitA, setReverbExitA] = useState(false);
    const [reverbExitB, setReverbExitB] = useState(false);

    const [deckARotation, setDeckARotation] = useState(0);
    const [deckBRotation, setDeckBRotation] = useState(0);

    const [padModeA, setPadModeA] = useState<PadMode>('sampler');
    const [padModeB, setPadModeB] = useState<PadMode>('sampler');
    const [shiftA, setShiftA] = useState(false);
    const [shiftB, setShiftB] = useState(false);
    const [tempoSyncA, setTempoSyncA] = useState(false);
    const [tempoSyncB, setTempoSyncB] = useState(false);
    const [pitchPlayCentsA, setPitchPlayCentsA] = useState(0);
    const [pitchPlayCentsB, setPitchPlayCentsB] = useState(0);
    const [hotcuesA, setHotcuesA] = useState<Array<number | null>>([null, null, null, null]);
    const [hotcuesB, setHotcuesB] = useState<Array<number | null>>([null, null, null, null]);
    const [loopPadA, setLoopPadA] = useState<number | null>(null);
    const [loopPadB, setLoopPadB] = useState<number | null>(null);
    const [samplerPadsA, setSamplerPadsA] = useState<boolean[]>([false, false, false, false]);
    const [samplerPadsB, setSamplerPadsB] = useState<boolean[]>([false, false, false, false]);
    const [fxPadsA, setFxPadsA] = useState<boolean[]>([false, false, false, false]);
    const [fxPadsB, setFxPadsB] = useState<boolean[]>([false, false, false, false]);
    const [padFxAssignA, setPadFxAssignA] = useState<PadFx[]>(['reverb', 'echo', 'roll', 'filter']);
    const [padFxAssignB, setPadFxAssignB] = useState<PadFx[]>(['reverb', 'echo', 'roll', 'filter']);
    const [cueDeck, setCueDeck] = useState<DeckId | null>(null);
    const pendingEvalRef = useRef<number | null>(null);
    const desiredCodeRef = useRef<string>('');
    const appliedCodeRef = useRef<string>('');
    const applySeqRef = useRef(0);
    const audioInitPromiseRef = useRef<Promise<void> | null>(null);
    const importAudioRef = useRef<HTMLInputElement | null>(null);
    const importBeatgridRef = useRef<HTMLInputElement | null>(null);
    const djAudioRef = useRef<DjAudio | null>(null);
    const djAudioInitPromiseRef = useRef<Promise<DjAudio> | null>(null);
    const loadedUploadARef = useRef<string | null>(null);
    const loadedUploadBRef = useRef<string | null>(null);

    const beginAudioInit = useCallback(() => {
        if (audioInitPromiseRef.current) return audioInitPromiseRef.current;

        const promise = initAudio().catch((err) => {
            console.error('[DJ] Audio init error:', err);
            audioInitPromiseRef.current = null;
            throw err;
        });

        audioInitPromiseRef.current = promise;
        return promise;
    }, []);

    const ensureDjAudio = useCallback(async () => {
        await beginAudioInit();
        if (djAudioRef.current) return djAudioRef.current;
        if (djAudioInitPromiseRef.current) return djAudioInitPromiseRef.current;

        const promise = (async () => {
            const ctx = await getSampleAudioContext();
            const master = ctx.createGain();
            master.gain.value = 1;
            master.connect(ctx.destination);

            const createChannel = (): DjChannel => {
                const input = ctx.createGain();

                const low = ctx.createBiquadFilter();
                low.type = 'lowshelf';
                low.frequency.value = 300;
                low.gain.value = 0;

                const mid = ctx.createBiquadFilter();
                mid.type = 'peaking';
                mid.frequency.value = 1200;
                mid.Q.value = 0.7;
                mid.gain.value = 0;

                const high = ctx.createBiquadFilter();
                high.type = 'highshelf';
                high.frequency.value = 2500;
                high.gain.value = 0;

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 20000;
                filter.Q.value = 0.7;

                const out = ctx.createGain();
                out.gain.value = 0;

                input.connect(low);
                low.connect(mid);
                mid.connect(high);
                high.connect(filter);
                filter.connect(out);
                out.connect(master);

                const deck = new AudioDeck(ctx, input);
                return { input, low, mid, high, filter, out, deck };
            };

            const engine: DjAudio = {
                ctx,
                master,
                deckA: createChannel(),
                deckB: createChannel(),
            };

            djAudioRef.current = engine;
            setDjAudioVersion((v) => v + 1);
            return engine;
        })();

        djAudioInitPromiseRef.current = promise;
        try {
            return await promise;
        } finally {
            djAudioInitPromiseRef.current = null;
        }
    }, [beginAudioInit]);

    const toggleDeckAPlay = useCallback(() => {
        void beginAudioInit();
        setDeckAPlaying(p => !p);
    }, [beginAudioInit]);

    const toggleDeckBPlay = useCallback(() => {
        void beginAudioInit();
        setDeckBPlaying(p => !p);
    }, [beginAudioInit]);

    useEffect(() => {
        if (!beatMatchStatus) return;
        const t = window.setTimeout(() => setBeatMatchStatus(null), 1400);
        return () => window.clearTimeout(t);
    }, [beatMatchStatus]);

    const libraryItems = useMemo<LibraryItem[]>(() => {
        const merged: LibraryItem[] = [...SYNTH_LIBRARY, ...uploadedTracks];
        return merged.length > 0 ? merged : [...SYNTH_LIBRARY];
    }, [uploadedTracks]);

    const browseItem = useMemo(() => {
        return libraryItems[clampIndex(browseIndex, libraryItems.length)];
    }, [browseIndex, libraryItems]);

    const deckAItem = useMemo<LibraryItem>(() => {
        if (deckASource.kind === 'synthetic') {
            return SYNTH_LIBRARY[clampIndex(deckASource.index, SYNTH_LIBRARY.length)];
        }
        return uploadedTracks.find(t => t.id === deckASource.id) ?? SYNTH_LIBRARY[0];
    }, [deckASource, uploadedTracks]);

    const deckBItem = useMemo<LibraryItem>(() => {
        if (deckBSource.kind === 'synthetic') {
            return SYNTH_LIBRARY[clampIndex(deckBSource.index, SYNTH_LIBRARY.length)];
        }
        return uploadedTracks.find(t => t.id === deckBSource.id) ?? SYNTH_LIBRARY[Math.min(1, SYNTH_LIBRARY.length - 1)];
    }, [deckBSource, uploadedTracks]);

    const deckABaseBpm = deckAItem.kind === 'uploaded' ? (deckAItem.bpm ?? bpm) : deckAItem.bpm;
    const deckBBaseBpm = deckBItem.kind === 'uploaded' ? (deckBItem.bpm ?? bpm) : deckBItem.bpm;
    const deckAName = deckAItem.name;
    const deckBName = deckBItem.name;
    const bpmA = deckABaseBpm * deckASpeed;
    const bpmB = deckBBaseBpm * deckBSpeed;
    const deckAIsUploaded = deckASource.kind === 'uploaded' && deckAItem.kind === 'uploaded';
    const deckBIsUploaded = deckBSource.kind === 'uploaded' && deckBItem.kind === 'uploaded';

    useEffect(() => {
        if (!tempoSyncA) return;
        const targetBpm = deckBBaseBpm * deckBSpeed;
        const next = clamp(targetBpm / deckABaseBpm, 0.5, 2);
        const snapped = clamp(Math.round(next / 0.001) * 0.001, 0.5, 2);
        setDeckASpeed((prev) => (Math.abs(prev - snapped) < 0.0009 ? prev : snapped));
    }, [deckABaseBpm, deckBBaseBpm, deckBSpeed, tempoSyncA]);

    useEffect(() => {
        if (!tempoSyncB) return;
        const targetBpm = deckABaseBpm * deckASpeed;
        const next = clamp(targetBpm / deckBBaseBpm, 0.5, 2);
        const snapped = clamp(Math.round(next / 0.001) * 0.001, 0.5, 2);
        setDeckBSpeed((prev) => (Math.abs(prev - snapped) < 0.0009 ? prev : snapped));
    }, [deckABaseBpm, deckASpeed, deckBBaseBpm, tempoSyncB]);

    useEffect(() => {
        if (!deckAIsUploaded || padModeA !== 'hotcue' || !shiftA) {
            setPitchPlayCentsA(0);
        }
    }, [deckAIsUploaded, padModeA, shiftA]);

    useEffect(() => {
        if (!deckBIsUploaded || padModeB !== 'hotcue' || !shiftB) {
            setPitchPlayCentsB(0);
        }
    }, [deckBIsUploaded, padModeB, shiftB]);

    useEffect(() => {
        const audio = djAudioRef.current;

        if (deckASource.kind !== 'uploaded') {
            loadedUploadARef.current = null;
            if (audio) audio.deckA.deck.load(null);
            return;
        }

        if (deckAItem.kind !== 'uploaded') return;
        if (loadedUploadARef.current === deckAItem.id && audio?.deckA.deck.isLoaded()) return;
        loadedUploadARef.current = deckAItem.id;

        void ensureDjAudio().then((engine) => {
            engine.deckA.deck.load(deckAItem.audioBuffer);
            if (deckAPlaying) engine.deckA.deck.play();
        });
    }, [deckAItem, deckAPlaying, deckASource.kind, ensureDjAudio]);

    useEffect(() => {
        const audio = djAudioRef.current;

        if (deckBSource.kind !== 'uploaded') {
            loadedUploadBRef.current = null;
            if (audio) audio.deckB.deck.load(null);
            return;
        }

        if (deckBItem.kind !== 'uploaded') return;
        if (loadedUploadBRef.current === deckBItem.id && audio?.deckB.deck.isLoaded()) return;
        loadedUploadBRef.current = deckBItem.id;

        void ensureDjAudio().then((engine) => {
            engine.deckB.deck.load(deckBItem.audioBuffer);
            if (deckBPlaying) engine.deckB.deck.play();
        });
    }, [deckBItem, deckBPlaying, deckBSource.kind, ensureDjAudio]);

    useEffect(() => {
        if (deckASource.kind !== 'uploaded') return;
        void ensureDjAudio().then((engine) => {
            if (deckAPlaying) engine.deckA.deck.play();
            else engine.deckA.deck.pause();
        });
    }, [deckAPlaying, deckASource.kind, ensureDjAudio]);

    useEffect(() => {
        if (deckBSource.kind !== 'uploaded') return;
        void ensureDjAudio().then((engine) => {
            if (deckBPlaying) engine.deckB.deck.play();
            else engine.deckB.deck.pause();
        });
    }, [deckBPlaying, deckBSource.kind, ensureDjAudio]);

    useEffect(() => {
        const audio = djAudioRef.current;
        if (!audio) return;

        if (deckASource.kind === 'uploaded') {
            audio.deckA.deck.setPlaybackRate(deckASpeed);
        }
        if (deckBSource.kind === 'uploaded') {
            audio.deckB.deck.setPlaybackRate(deckBSpeed);
        }
    }, [deckASource.kind, deckASpeed, deckBSource.kind, deckBSpeed, djAudioVersion]);

    useEffect(() => {
        const audio = djAudioRef.current;
        if (!audio) return;

        const detuneBaseCents = Math.round((masterPitch - 0.5) * 2400);
        if (deckASource.kind === 'uploaded') {
            audio.deckA.deck.setDetuneCents(detuneBaseCents + pitchPlayCentsA);
        }
        if (deckBSource.kind === 'uploaded') {
            audio.deckB.deck.setDetuneCents(detuneBaseCents + pitchPlayCentsB);
        }
    }, [deckASource.kind, deckBSource.kind, masterPitch, pitchPlayCentsA, pitchPlayCentsB, djAudioVersion]);

    // Animate platters while playing (speed affects rotation rate)
    useEffect(() => {
        const interval = setInterval(() => {
            const baseA = bpm > 0 ? deckABaseBpm / bpm : 1;
            const baseB = bpm > 0 ? deckBBaseBpm / bpm : 1;
            const speedA = clamp(baseA * deckASpeed, 0.25, 4);
            const speedB = clamp(baseB * deckBSpeed, 0.25, 4);
            if (deckAPlaying) setDeckARotation(r => (r + 2.2 * speedA) % 360);
            if (deckBPlaying) setDeckBRotation(r => (r + 2.2 * speedB) % 360);
        }, 50);
        return () => clearInterval(interval);
    }, [bpm, deckAPlaying, deckABaseBpm, deckASpeed, deckBPlaying, deckBBaseBpm, deckBSpeed]);

    // Build and evaluate the mixed Strudel code (throttled so fast drags don't glitch).
    useEffect(() => {
        if (pendingEvalRef.current !== null) {
            cancelAnimationFrame(pendingEvalRef.current);
        }

        pendingEvalRef.current = requestAnimationFrame(() => {
            pendingEvalRef.current = null;

            const t = (crossfader + 1) / 2; // 0..1
            let xfA = Math.cos(t * Math.PI / 2);
            let xfB = Math.sin(t * Math.PI / 2);

            const gainA = deckAVolume * deckAFader * masterVolume * xfA;
            const gainB = deckBVolume * deckBFader * masterVolume * xfB;

            const exitA = reverbExitA ? 1 : 0;
            const exitB = reverbExitB ? 1 : 0;
            const exitGainA = gainA * (exitA ? 0.35 : 1);
            const exitGainB = gainB * (exitB ? 0.35 : 1);

            const parts: string[] = [];

            const deckAPads = PADS_A.filter((_, i) => samplerPadsA[i]);
            const deckAHasPattern = deckAPlaying && deckAItem.kind === 'synthetic';
            if ((deckAHasPattern || deckAPads.length > 0) && exitGainA > 0.001) {
                const baseA = bpm > 0 ? deckABaseBpm / bpm : 1;
                const speedA = clamp(baseA * deckASpeed, 0.25, 4);
                const exprs: string[] = [];

                if (deckAHasPattern) {
                    let expr = buildDeckExpr(deckAItem.pattern, {
                        gain: exitGainA,
                        speed: speedA,
                        filter: deckAFilter,
                        eqLow: deckAEqLow,
                        eqMid: deckAEqMid,
                        eqHigh: deckAEqHigh,
                    });
                    if (exitA) {
                        expr = `(${expr}).room(0.85).roomsize(14).release(0.9)`;
                    }
                    exprs.push(expr);
                }

                for (const expr of deckAPads) {
                    let out = buildDeckExpr(expr, {
                        gain: exitGainA * 0.9,
                        speed: speedA,
                        filter: deckAFilter,
                        eqLow: deckAEqLow,
                        eqMid: deckAEqMid,
                        eqHigh: deckAEqHigh,
                    });
                    if (exitA) {
                        out = `(${out}).room(0.85).roomsize(14).release(0.9)`;
                    }
                    exprs.push(out);
                }

                if (exprs.length > 0) {
                    let deckOut = exprs.length === 1 ? exprs[0] : `stack(${exprs.join(', ')})`;
                    for (let i = 0; i < fxPadsA.length; i++) {
                        if (!fxPadsA[i]) continue;
                        deckOut = applyPadFx(deckOut, padFxAssignA[i] ?? 'reverb');
                    }
                    parts.push(deckOut);
                }
            }

            const deckBPads = PADS_B.filter((_, i) => samplerPadsB[i]);
            const deckBHasPattern = deckBPlaying && deckBItem.kind === 'synthetic';
            if ((deckBHasPattern || deckBPads.length > 0) && exitGainB > 0.001) {
                const baseB = bpm > 0 ? deckBBaseBpm / bpm : 1;
                const speedB = clamp(baseB * deckBSpeed, 0.25, 4);
                const exprs: string[] = [];

                if (deckBHasPattern) {
                    let expr = buildDeckExpr(deckBItem.pattern, {
                        gain: exitGainB,
                        speed: speedB,
                        filter: deckBFilter,
                        eqLow: deckBEqLow,
                        eqMid: deckBEqMid,
                        eqHigh: deckBEqHigh,
                    });
                    if (exitB) {
                        expr = `(${expr}).room(0.85).roomsize(14).release(0.9)`;
                    }
                    exprs.push(expr);
                }

                for (const expr of deckBPads) {
                    let out = buildDeckExpr(expr, {
                        gain: exitGainB * 0.9,
                        speed: speedB,
                        filter: deckBFilter,
                        eqLow: deckBEqLow,
                        eqMid: deckBEqMid,
                        eqHigh: deckBEqHigh,
                    });
                    if (exitB) {
                        out = `(${out}).room(0.85).roomsize(14).release(0.9)`;
                    }
                    exprs.push(out);
                }

                if (exprs.length > 0) {
                    let deckOut = exprs.length === 1 ? exprs[0] : `stack(${exprs.join(', ')})`;
                    for (let i = 0; i < fxPadsB.length; i++) {
                        if (!fxPadsB[i]) continue;
                        deckOut = applyPadFx(deckOut, padFxAssignB[i] ?? 'reverb');
                    }
                    parts.push(deckOut);
                }
            }

            let code =
                parts.length === 0 ? 'silence' :
                    parts.length === 1 ? parts[0] :
                        `stack(${parts.join(', ')})`;

            const detuneCents = Math.round((masterPitch - 0.5) * 2400);
            if (code !== 'silence' && detuneCents !== 0) {
                code = `(${code}).detune(${detuneCents})`;
            }

            desiredCodeRef.current = code;
            const seq = ++applySeqRef.current;

            const apply = async () => {
                const initPromise = audioInitPromiseRef.current;
                if (code !== 'silence' && initPromise) {
                    try {
                        await initPromise;
                    } catch {
                        return;
                    }
                }

                if (seq !== applySeqRef.current) return;
                const latest = desiredCodeRef.current;
                if (latest === appliedCodeRef.current) return;

                appliedCodeRef.current = latest;
                updateAudioLayer('dj', latest)
                    .catch((e) => console.error('[DJ] Eval error:', e));
            };

            void apply();
        });

        return () => {
            if (pendingEvalRef.current !== null) {
                cancelAnimationFrame(pendingEvalRef.current);
                pendingEvalRef.current = null;
            }
        };
    }, [
        bpm,
        crossfader,
        deckAPlaying,
        deckBPlaying,
        deckAVolume,
        deckBVolume,
        deckAFader,
        deckBFader,
        masterVolume,
        deckASpeed,
        deckBSpeed,
        deckAFilter,
        deckBFilter,
        deckAEqLow,
        deckAEqMid,
        deckAEqHigh,
        deckBEqLow,
        deckBEqMid,
        deckBEqHigh,
        deckAItem,
        deckBItem,
        deckABaseBpm,
        deckBBaseBpm,
        samplerPadsA,
        samplerPadsB,
        fxPadsA,
        fxPadsB,
        padFxAssignA,
        padFxAssignB,
        masterPitch,
        reverbExitA,
        reverbExitB,
    ]);

    // Apply the same mixer controls to uploaded audio decks (WebAudio) when present.
    useEffect(() => {
        const audio = djAudioRef.current;
        if (!audio) return;

        const now = audio.ctx.currentTime;
        const t = (crossfader + 1) / 2; // 0..1
        const xfA = Math.cos(t * Math.PI / 2);
        const xfB = Math.sin(t * Math.PI / 2);

        const gainA = deckAVolume * deckAFader * masterVolume * xfA;
        const gainB = deckBVolume * deckBFader * masterVolume * xfB;
        const exitGainA = gainA * (reverbExitA ? 0.35 : 1);
        const exitGainB = gainB * (reverbExitB ? 0.35 : 1);

        audio.deckA.out.gain.setTargetAtTime(deckASource.kind === 'uploaded' ? exitGainA : 0, now, 0.01);
        audio.deckB.out.gain.setTargetAtTime(deckBSource.kind === 'uploaded' ? exitGainB : 0, now, 0.01);

        audio.deckA.low.gain.setValueAtTime(eqToDb(deckAEqLow), now);
        audio.deckA.mid.gain.setValueAtTime(eqToDb(deckAEqMid), now);
        audio.deckA.high.gain.setValueAtTime(eqToDb(deckAEqHigh), now);
        applyFilterToNode(audio.deckA.filter, deckAFilter);

        audio.deckB.low.gain.setValueAtTime(eqToDb(deckBEqLow), now);
        audio.deckB.mid.gain.setValueAtTime(eqToDb(deckBEqMid), now);
        audio.deckB.high.gain.setValueAtTime(eqToDb(deckBEqHigh), now);
        applyFilterToNode(audio.deckB.filter, deckBFilter);
    }, [
        crossfader,
        deckAFader,
        deckAFilter,
        deckAEqHigh,
        deckAEqLow,
        deckAEqMid,
        deckAVolume,
        deckASource.kind,
        deckBFader,
        deckBFilter,
        deckBEqHigh,
        deckBEqLow,
        deckBEqMid,
        deckBVolume,
        deckBSource.kind,
        masterVolume,
        reverbExitA,
        reverbExitB,
        djAudioVersion,
    ]);

    const clearDeckPads = useCallback((deck: DeckId) => {
        if (deck === 'A') {
            setSamplerPadsA([false, false, false, false]);
            setFxPadsA([false, false, false, false]);
            return;
        }
        setSamplerPadsB([false, false, false, false]);
        setFxPadsB([false, false, false, false]);
    }, []);

    const setPadMode = useCallback((deck: DeckId, mode: PadMode) => {
        clearDeckPads(deck);
        if (deck === 'A') {
            setPadModeA(mode);
        } else {
            setPadModeB(mode);
        }
    }, [clearDeckPads]);

    const cyclePadFxAssign = useCallback((deck: DeckId, padIndex: number) => {
        if (deck === 'A') {
            setPadFxAssignA(prev => {
                const next = [...prev];
                next[padIndex] = nextPadFx(next[padIndex] ?? 'reverb');
                return next;
            });
            return;
        }
        setPadFxAssignB(prev => {
            const next = [...prev];
            next[padIndex] = nextPadFx(next[padIndex] ?? 'reverb');
            return next;
        });
    }, []);

    const handlePadPress = useCallback((deck: DeckId, padIndex: number) => {
        void beginAudioInit();

        const mode = deck === 'A' ? padModeA : padModeB;
        const isShift = deck === 'A' ? shiftA : shiftB;
        const isUploaded = deck === 'A' ? deckAIsUploaded : deckBIsUploaded;
        const baseBpm = deck === 'A' ? deckABaseBpm : deckBBaseBpm;

        const toggle = (arr: boolean[]) => arr.map((v, i) => (i === padIndex ? !v : v));
        const setPlaying = (playing: boolean) => {
            if (deck === 'A') setDeckAPlaying(playing);
            else setDeckBPlaying(playing);
        };

        if (mode === 'sampler') {
            if (deck === 'A') setSamplerPadsA(toggle);
            else setSamplerPadsB(toggle);
            return;
        }

        if (mode === 'hotcue') {
            if (!isUploaded) {
                if (deck === 'A') {
                    setDeckASource({ kind: 'synthetic', index: clamp(padIndex, 0, Math.max(0, SYNTH_LIBRARY.length - 1)) });
                    setDeckAPlaying(true);
                } else {
                    setDeckBSource({ kind: 'synthetic', index: clamp(padIndex, 0, Math.max(0, SYNTH_LIBRARY.length - 1)) });
                    setDeckBPlaying(true);
                }
                return;
            }

            const cue = deck === 'A' ? hotcuesA[padIndex] : hotcuesB[padIndex];
            const pitchPlay = isShift && cue != null;
            if (pitchPlay) {
                const centsByPad = [0, 300, 700, 1200] as const;
                const cents = centsByPad[clamp(padIndex, 0, centsByPad.length - 1)];
                if (deck === 'A') setPitchPlayCentsA(cents);
                else setPitchPlayCentsB(cents);
            }

            void ensureDjAudio().then((engine) => {
                const audioDeck = deck === 'A' ? engine.deckA.deck : engine.deckB.deck;
                if (!audioDeck.isLoaded()) return;
                const now = audioDeck.getCurrentTimeSec();

                if (cue == null) {
                    if (deck === 'A') {
                        setHotcuesA((prev) => prev.map((v, i) => (i === padIndex ? now : v)));
                    } else {
                        setHotcuesB((prev) => prev.map((v, i) => (i === padIndex ? now : v)));
                    }
                    return;
                }

                if (pitchPlay) {
                    audioDeck.seek(cue);
                    audioDeck.play();
                    return;
                }

                if (!isShift) {
                    audioDeck.seek(cue);
                    audioDeck.play();
                }
            });

            if (cue != null || !isShift) setPlaying(true);
            return;
        }

        if (mode === 'loop') {
            if (!isUploaded) return;

            const beatsByPad = [1, 2, 4, 8] as const;
            const beats = beatsByPad[clamp(padIndex, 0, beatsByPad.length - 1)];

            void ensureDjAudio().then((engine) => {
                const audioDeck = deck === 'A' ? engine.deckA.deck : engine.deckB.deck;
                if (!audioDeck.isLoaded()) return;

                const beatLenSec = baseBpm > 0 ? 60 / baseBpm : 0.5;
                const t = audioDeck.getCurrentTimeSec();
                const item = deck === 'A' ? deckAItem : deckBItem;
                const downbeat = item.kind === 'uploaded' ? item.downbeatSec : null;

                let start = t;
                if (typeof downbeat === 'number') {
                    const beatsFromDownbeat = (t - downbeat) / beatLenSec;
                    start = downbeat + Math.round(beatsFromDownbeat) * beatLenSec;
                } else {
                    start = t - (t % beatLenSec);
                }

                const end = start + beats * beatLenSec;
                audioDeck.setLoop({ enabled: true, startSec: start, endSec: end });
            });

            if (deck === 'A') setLoopPadA(padIndex);
            else setLoopPadB(padIndex);
            setPlaying(true);
            return;
        }

        if (mode === 'fx') {
            if (!isUploaded) {
                if (deck === 'A') setFxPadsA(toggle);
                else setFxPadsB(toggle);
                return;
            }

            void ensureDjAudio().then((engine) => {
                const audioDeck = deck === 'A' ? engine.deckA.deck : engine.deckB.deck;
                if (!audioDeck.isLoaded()) return;

                const beatLenSec = baseBpm > 0 ? 60 / baseBpm : 0.5;
                const t = audioDeck.getCurrentTimeSec();
                const item = deck === 'A' ? deckAItem : deckBItem;
                const downbeat = item.kind === 'uploaded' && item.downbeatSec != null ? item.downbeatSec : 0;

                const beatsFromDownbeat = (t - downbeat) / beatLenSec;
                const bar = Math.floor(beatsFromDownbeat / 4);
                const barStart = downbeat + bar * 4 * beatLenSec;
                const target = barStart + clamp(padIndex, 0, 3) * beatLenSec;

                audioDeck.seek(target);
                audioDeck.play();
            });

            setPlaying(true);
        }
    }, [
        beginAudioInit,
        deckAIsUploaded,
        deckABaseBpm,
        deckAItem,
        deckBIsUploaded,
        deckBBaseBpm,
        deckBItem,
        ensureDjAudio,
        hotcuesA,
        hotcuesB,
        padModeA,
        padModeB,
        shiftA,
        shiftB,
    ]);

    const handlePadRelease = useCallback((deck: DeckId, padIndex: number) => {
        const mode = deck === 'A' ? padModeA : padModeB;
        const isUploaded = deck === 'A' ? deckAIsUploaded : deckBIsUploaded;
        if (mode === 'hotcue' && isUploaded) {
            if (deck === 'A') setPitchPlayCentsA(0);
            else setPitchPlayCentsB(0);
        }

        if (mode !== 'loop') return;
        if (!isUploaded) return;

        const isActive = deck === 'A' ? loopPadA === padIndex : loopPadB === padIndex;
        if (!isActive) return;

        if (deck === 'A') setLoopPadA(null);
        else setLoopPadB(null);

        void ensureDjAudio().then((engine) => {
            const audioDeck = deck === 'A' ? engine.deckA.deck : engine.deckB.deck;
            if (!audioDeck.isLoaded()) return;
            audioDeck.setLoop({ enabled: false, startSec: 0, endSec: audioDeck.getDurationSec() });
        });
    }, [deckAIsUploaded, deckBIsUploaded, ensureDjAudio, loopPadA, loopPadB, padModeA, padModeB]);

    const triggerReverbExit = useCallback((deck: DeckId) => {
        void beginAudioInit();

        const stopDelayMs = 360;
        const resetDelayMs = 1500;

        if (deck === 'A') {
            setReverbExitA(true);
            window.setTimeout(() => clearDeckPads('A'), stopDelayMs);
            window.setTimeout(() => setReverbExitA(false), resetDelayMs);
            return;
        }

        setReverbExitB(true);
        window.setTimeout(() => clearDeckPads('B'), stopDelayMs);
        window.setTimeout(() => setReverbExitB(false), resetDelayMs);
    }, [beginAudioInit, clearDeckPads]);

    const syncA = useCallback(() => {
        void beginAudioInit();
        const targetBpm = deckBBaseBpm * deckBSpeed;
        const next = clamp(targetBpm / deckABaseBpm, 0.5, 2);
        setDeckASpeed(clamp(Math.round(next / 0.001) * 0.001, 0.5, 2));
    }, [beginAudioInit, deckABaseBpm, deckBBaseBpm, deckBSpeed]);

    const syncB = useCallback(() => {
        void beginAudioInit();
        const targetBpm = deckABaseBpm * deckASpeed;
        const next = clamp(targetBpm / deckBBaseBpm, 0.5, 2);
        setDeckBSpeed(clamp(Math.round(next / 0.001) * 0.001, 0.5, 2));
    }, [beginAudioInit, deckABaseBpm, deckASpeed, deckBBaseBpm]);

    const toggleTempoSyncA = useCallback(() => {
        void beginAudioInit();
        setTempoSyncB(false);
        setTempoSyncA((prev) => {
            const next = !prev;
            if (!prev) syncA();
            return next;
        });
    }, [beginAudioInit, syncA]);

    const toggleTempoSyncB = useCallback(() => {
        void beginAudioInit();
        setTempoSyncA(false);
        setTempoSyncB((prev) => {
            const next = !prev;
            if (!prev) syncB();
            return next;
        });
    }, [beginAudioInit, syncB]);

    const setDeckASpeedFromUi = useCallback((v: number) => {
        void beginAudioInit();
        setTempoSyncA(false);
        setDeckASpeed(v);
    }, [beginAudioInit]);

    const setDeckBSpeedFromUi = useCallback((v: number) => {
        void beginAudioInit();
        setTempoSyncB(false);
        setDeckBSpeed(v);
    }, [beginAudioInit]);

    const aiBeatMatch = useCallback(() => {
        void beginAudioInit();

        const t = (crossfader + 1) / 2; // 0..1
        let xfA = Math.cos(t * Math.PI / 2);
        let xfB = Math.sin(t * Math.PI / 2);

        if (cueDeck === 'A') {
            xfA = 1;
            xfB = 0;
        } else if (cueDeck === 'B') {
            xfA = 0;
            xfB = 1;
        }

        const gainA = deckAVolume * deckAFader * masterVolume * xfA;
        const gainB = deckBVolume * deckBFader * masterVolume * xfB;

        const pickMaster = (): DeckId => {
            if (deckAPlaying && !deckBPlaying) return 'A';
            if (deckBPlaying && !deckAPlaying) return 'B';
            if (deckAPlaying && deckBPlaying) return gainA >= gainB ? 'A' : 'B';
            return gainA >= gainB ? 'A' : 'B';
        };

        const master = pickMaster();

        const masterBpm = master === 'A' ? deckABaseBpm * deckASpeed : deckBBaseBpm * deckBSpeed;
        const otherTrackBpm = master === 'A' ? deckBBaseBpm : deckABaseBpm;
        const otherCurrent = master === 'A' ? deckBSpeed : deckASpeed;

        const inRange = (v: number) => v >= 0.5 && v <= 2;
        const exact = masterBpm / otherTrackBpm;
        const halfTime = (masterBpm * 0.5) / otherTrackBpm;
        const doubleTime = (masterBpm * 2) / otherTrackBpm;

        let next = exact;
        if (!inRange(next)) {
            const candidates = [halfTime, doubleTime].filter(inRange);
            if (candidates.length === 1) {
                next = candidates[0];
            } else if (candidates.length === 2) {
                next = Math.abs(candidates[0] - otherCurrent) <= Math.abs(candidates[1] - otherCurrent) ? candidates[0] : candidates[1];
            }
        }

        const snapped = clamp(Math.round(clamp(next, 0.5, 2) / 0.001) * 0.001, 0.5, 2);
        const other: DeckId = master === 'A' ? 'B' : 'A';
        const otherBefore = other === 'A' ? deckASpeed : deckBSpeed;
        const changed = Math.abs(otherBefore - snapped) > 0.0009;

        if (master === 'A') setDeckBSpeed(snapped);
        else setDeckASpeed(snapped);

        if (deckASource.kind === 'uploaded' && deckBSource.kind === 'uploaded') {
            void ensureDjAudio().then(() => {
                const audio = djAudioRef.current;
                if (!audio) return;

                const masterItem = master === 'A' ? deckAItem : deckBItem;
                const otherItem = master === 'A' ? deckBItem : deckAItem;
                if (masterItem.kind !== 'uploaded' || otherItem.kind !== 'uploaded') return;
                if (!masterItem.bpm || !otherItem.bpm) return;
                if (masterItem.downbeatSec == null || otherItem.downbeatSec == null) return;

                const masterDeck = master === 'A' ? audio.deckA.deck : audio.deckB.deck;
                const otherDeck = master === 'A' ? audio.deckB.deck : audio.deckA.deck;

                const frac = (x: number) => ((x % 1) + 1) % 1;
                const masterBeats = (masterDeck.getCurrentTimeSec() - masterItem.downbeatSec) * masterItem.bpm / 60;
                const otherBeats = (otherDeck.getCurrentTimeSec() - otherItem.downbeatSec) * otherItem.bpm / 60;

                let delta = frac(masterBeats) - frac(otherBeats);
                if (delta > 0.5) delta -= 1;
                if (delta < -0.5) delta += 1;

                if (Math.abs(delta) > 0.0005) {
                    const deltaSec = delta * (60 / otherItem.bpm);
                    otherDeck.seek(otherDeck.getCurrentTimeSec() + deltaSec);
                }
            });
        }

        setBeatMatchStatus(changed ? `${master}\u2192${other} @ ${Math.round(masterBpm)} BPM` : `Already matched @ ${Math.round(masterBpm)} BPM`);
    }, [
        beginAudioInit,
        crossfader,
        cueDeck,
        deckAPlaying,
        deckBPlaying,
        deckASpeed,
        deckBSpeed,
        deckAVolume,
        deckBVolume,
        deckAFader,
        deckBFader,
        masterVolume,
        deckABaseBpm,
        deckBBaseBpm,
        deckASource.kind,
        deckBSource.kind,
        deckAItem,
        deckBItem,
        ensureDjAudio,
    ]);

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        const content = contentRef.current;
        if (!viewport || !content) return;

        const padding = 16;
        let raf = 0;

        const compute = () => {
            raf = 0;
            const vw = Math.max(0, viewport.clientWidth - padding * 2);
            const vh = Math.max(0, viewport.clientHeight - padding * 2);
            // Use untransformed layout metrics (offset*) so our scale-to-fit works even when the content is already scaled.
            const cw = content.offsetWidth;
            const ch = content.offsetHeight;
            if (vw === 0 || vh === 0 || cw === 0 || ch === 0) return;

            const next = Math.min(1, vw / cw, vh / ch);
            setFitScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
        };

        const schedule = () => {
            if (raf) return;
            raf = window.requestAnimationFrame(compute);
        };

        const ro = new ResizeObserver(schedule);
        ro.observe(viewport);
        ro.observe(content);
        schedule();

        return () => {
            ro.disconnect();
            if (raf) window.cancelAnimationFrame(raf);
        };
    }, []);

    const deckAHotcueIndex = deckASource.kind === 'synthetic' ? deckASource.index : -1;
    const deckBHotcueIndex = deckBSource.kind === 'synthetic' ? deckBSource.index : -1;

    const browseCount = libraryItems.length;
    const browseLabel = browseItem?.name ?? 'Track';
    const browseTrackBpm = browseItem.kind === 'uploaded' ? (browseItem.bpm ?? bpm) : browseItem.bpm;

    const openImportAudio = useCallback(() => {
        importAudioRef.current?.click();
    }, []);

    const openImportBeatgrid = useCallback(() => {
        if (browseItem.kind !== 'uploaded') return;
        importBeatgridRef.current?.click();
    }, [browseItem.kind]);

    const importAudioFile = useCallback(async (file: File) => {
        const newBrowseIndex = SYNTH_LIBRARY.length + uploadedTracks.length;
        try {
            await beginAudioInit();
            const ctx = await getSampleAudioContext();
            const buf = await file.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(buf.slice(0));
            const name = file.name.replace(/\.[^/.]+$/, '');

            const nextTrack: UploadedLibraryItem = {
                kind: 'uploaded',
                id: makeId('upload'),
                name,
                bpm: null,
                downbeatSec: null,
                audioBuffer,
            };

            setUploadedTracks(prev => [...prev, nextTrack]);
            setBrowseIndex(newBrowseIndex);
        } catch (err) {
            console.error('[DJ] Failed to import audio track:', err);
        }
    }, [beginAudioInit, uploadedTracks.length]);

    const importBeatgridFile = useCallback(async (file: File) => {
        if (browseItem.kind !== 'uploaded') return;

        try {
            const text = await file.text();
            const parsedJson = JSON.parse(text) as unknown;
            const parsed = parseBeatgridImport(parsedJson);
            if (!parsed) return;

            setUploadedTracks(prev => prev.map(t => {
                if (t.id !== browseItem.id) return t;
                return {
                    ...t,
                    bpm: parsed.bpm ?? t.bpm,
                    downbeatSec: parsed.downbeatSec ?? t.downbeatSec,
                };
            }));
        } catch (err) {
            console.error('[DJ] Failed to import beatgrid JSON:', err);
        }
    }, [browseItem, setUploadedTracks]);

    const loadBrowseToDeckA = useCallback(() => {
        void beginAudioInit();
        if (browseItem.kind === 'synthetic') {
            setDeckASource({ kind: 'synthetic', index: clampIndex(browseIndex, SYNTH_LIBRARY.length) });
        } else {
            setDeckASource({ kind: 'uploaded', id: browseItem.id });
        }
    }, [beginAudioInit, browseIndex, browseItem]);

    const loadBrowseToDeckB = useCallback(() => {
        void beginAudioInit();
        if (browseItem.kind === 'synthetic') {
            setDeckBSource({ kind: 'synthetic', index: clampIndex(browseIndex, SYNTH_LIBRARY.length) });
        } else {
            setDeckBSource({ kind: 'uploaded', id: browseItem.id });
        }
    }, [beginAudioInit, browseIndex, browseItem]);

    return (
        <div ref={viewportRef} className="relative w-full h-full overflow-hidden">
            <input
                ref={importAudioRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importAudioFile(file);
                    e.currentTarget.value = '';
                }}
            />
            <input
                ref={importBeatgridRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importBeatgridFile(file);
                    e.currentTarget.value = '';
                }}
            />
            <div className="absolute inset-0 p-4 flex justify-center items-start">
                <div
                    ref={contentRef}
                    className="relative inline-block w-max p-3 sm:p-4 text-zinc-900 rounded-2xl border border-zinc-300 shadow-[0_18px_45px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-18px_45px_rgba(0,0,0,0.18)] transition-transform duration-150"
                    style={{
                        transform: `scale(${fitScale})`,
                        transformOrigin: 'top center',
                        backgroundImage:
                            'linear-gradient(180deg, #f8fafc 0%, #d1d5db 38%, #f1f5f9 100%), ' +
                            'repeating-linear-gradient(0deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 1px, rgba(0,0,0,0.03) 1px, rgba(0,0,0,0.03) 3px)',
                        backgroundBlendMode: 'overlay',
                    }}
                >
                    <div
                        className="pointer-events-none absolute top-4 right-4 w-10 h-10 rounded-full border border-zinc-500 bg-gradient-to-b from-zinc-50 to-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_20px_rgba(0,0,0,0.25)]"
                        aria-hidden="true"
                    >
                        <div className="absolute inset-[18%] rounded-full bg-gradient-to-b from-zinc-800 to-zinc-900 shadow-[inset_0_0_16px_rgba(0,0,0,0.85)]" />
                        <div className="absolute left-1/2 top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.65)]" />
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2 xl:gap-4 2xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)] 2xl:gap-6 items-start">
                        <div className="order-1 min-w-0">
                            <DeckPanel
                                deckId="A"
                                accent="#06b6d4"
                                rotation={deckARotation}
                                isPlaying={deckAPlaying}
                                bpm={bpmA}
                                trackName={deckAName}
                                patternIndex={deckAHotcueIndex}
                                onTogglePlay={toggleDeckAPlay}
                                speed={deckASpeed}
                                onSpeedChange={setDeckASpeedFromUi}
                                onSync={toggleTempoSyncA}
                                onReverbExit={() => triggerReverbExit('A')}
                                tempoSync={tempoSyncA}
                                shift={shiftA}
                                onToggleShift={() => setShiftA((v) => !v)}
                                padMode={padModeA}
                                onPadModeChange={(m) => setPadMode('A', m)}
                                samplerPads={samplerPadsA}
                                fxPads={fxPadsA}
                                padFxAssign={padFxAssignA}
                                onCyclePadFx={(i) => cyclePadFxAssign('A', i)}
                                isUploaded={deckAIsUploaded}
                                hotcues={hotcuesA}
                                loopPad={loopPadA}
                                isCueActive={cueDeck === 'A'}
                                onToggleCue={() => setCueDeck(c => c === 'A' ? null : 'A')}
                                onPadPress={(i) => handlePadPress('A', i)}
                                onPadRelease={(i) => handlePadRelease('A', i)}
                            />
                        </div>

                        <div className="order-2 xl:order-3 xl:col-span-2 2xl:order-2 2xl:col-span-1 min-w-0">
                            <MixerPanel
                                accentA="#06b6d4"
                                accentB="#d946ef"
                                trimA={deckAVolume}
                                trimB={deckBVolume}
                                onTrimA={setDeckAVolume}
                                onTrimB={setDeckBVolume}
                                faderA={deckAFader}
                                faderB={deckBFader}
                                onFaderA={setDeckAFader}
                                onFaderB={setDeckBFader}
                                eqA={{ low: deckAEqLow, mid: deckAEqMid, high: deckAEqHigh }}
                                eqB={{ low: deckBEqLow, mid: deckBEqMid, high: deckBEqHigh }}
                                onEqA={{ low: setDeckAEqLow, mid: setDeckAEqMid, high: setDeckAEqHigh }}
                                onEqB={{ low: setDeckBEqLow, mid: setDeckBEqMid, high: setDeckBEqHigh }}
                                filterA={deckAFilter}
                                filterB={deckBFilter}
                                onFilterA={setDeckAFilter}
                                onFilterB={setDeckBFilter}
                                master={masterVolume}
                                onMaster={setMasterVolume}
                                masterPitch={masterPitch}
                                onMasterPitch={setMasterPitch}
                                crossfader={crossfader}
                                onCrossfader={setCrossfader}
                                tempoBpm={bpm}
                                onAiBeatMatch={aiBeatMatch}
                                beatMatchStatus={beatMatchStatus}
                                browseCount={browseCount}
                                browseIndex={browseIndex}
                                browseLabel={browseLabel}
                                browseTrackBpm={browseTrackBpm}
                                onBrowseIndex={setBrowseIndex}
                                onLoadA={loadBrowseToDeckA}
                                onLoadB={loadBrowseToDeckB}
                                onImportAudio={openImportAudio}
                                onImportBeatgrid={openImportBeatgrid}
                                canImportBeatgrid={browseItem.kind === 'uploaded'}
                            />
                        </div>

                        <div className="order-3 xl:order-2 2xl:order-3 min-w-0">
                            <DeckPanel
                                deckId="B"
                                accent="#d946ef"
                                rotation={deckBRotation}
                                isPlaying={deckBPlaying}
                                bpm={bpmB}
                                trackName={deckBName}
                                patternIndex={deckBHotcueIndex}
                                onTogglePlay={toggleDeckBPlay}
                                speed={deckBSpeed}
                                onSpeedChange={setDeckBSpeedFromUi}
                                onSync={toggleTempoSyncB}
                                onReverbExit={() => triggerReverbExit('B')}
                                tempoSync={tempoSyncB}
                                shift={shiftB}
                                onToggleShift={() => setShiftB((v) => !v)}
                                padMode={padModeB}
                                onPadModeChange={(m) => setPadMode('B', m)}
                                samplerPads={samplerPadsB}
                                fxPads={fxPadsB}
                                padFxAssign={padFxAssignB}
                                onCyclePadFx={(i) => cyclePadFxAssign('B', i)}
                                isUploaded={deckBIsUploaded}
                                hotcues={hotcuesB}
                                loopPad={loopPadB}
                                isCueActive={cueDeck === 'B'}
                                onToggleCue={() => setCueDeck(c => c === 'B' ? null : 'B')}
                                onPadPress={(i) => handlePadPress('B', i)}
                                onPadRelease={(i) => handlePadRelease('B', i)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DeckPanel({
    deckId,
    accent,
    rotation,
    isPlaying,
    bpm,
    trackName,
    patternIndex,
    onTogglePlay,
    speed,
    onSpeedChange,
    onSync,
    onReverbExit,
    tempoSync,
    shift,
    onToggleShift,
    padMode,
    onPadModeChange,
    samplerPads,
    fxPads,
    padFxAssign,
    onCyclePadFx,
    isUploaded,
    hotcues,
    loopPad,
    isCueActive,
    onToggleCue,
    onPadPress,
    onPadRelease,
}: {
    deckId: DeckId;
    accent: string;
    rotation: number;
    isPlaying: boolean;
    bpm: number;
    trackName: string;
    patternIndex: number;
    onTogglePlay: () => void;
    speed: number;
    onSpeedChange: (v: number) => void;
    onSync: () => void;
    onReverbExit: () => void;
    tempoSync: boolean;
    shift: boolean;
    onToggleShift: () => void;
    padMode: PadMode;
    onPadModeChange: (mode: PadMode) => void;
    samplerPads: boolean[];
    fxPads: boolean[];
    padFxAssign: PadFx[];
    onCyclePadFx: (padIndex: number) => void;
    isUploaded: boolean;
    hotcues: Array<number | null>;
    loopPad: number | null;
    isCueActive: boolean;
    onToggleCue: () => void;
    onPadPress: (i: number) => void;
    onPadRelease: (i: number) => void;
}) {
    const deckNumber = deckId === 'A' ? '1' : '2';
    const tempoPercent = Math.round((speed - 1) * 100);
    const tempoKnob = clamp((speed - 0.5) / 1.5, 0, 1);

    const modeButton = (mode: PadMode, label: string) => {
        const active = padMode === mode;
        return (
            <button
                key={mode}
                onClick={() => onPadModeChange(mode)}
                className={`px-2 py-1 rounded-md border text-[9px] font-mono uppercase tracking-widest transition
                    ${active
                        ? 'border-zinc-900 bg-gradient-to-b from-zinc-900 to-zinc-700 text-white shadow-[0_0_14px_rgba(0,0,0,0.35)]'
                        : 'border-zinc-400 bg-gradient-to-b from-zinc-200/80 to-zinc-100/50 text-zinc-700 hover:brightness-110'}`}
            >
                {label}
            </button>
        );
    };

    return (
        <div
            className="relative w-full max-w-[300px] min-w-0 mx-auto flex flex-col items-center gap-3 p-3 rounded-2xl border border-zinc-300/80 shadow-[0_16px_36px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.7)]"
            style={{
                backgroundImage:
                    'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.26) 100%), ' +
                    'repeating-linear-gradient(0deg, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.16) 1px, rgba(0,0,0,0.03) 1px, rgba(0,0,0,0.03) 4px)',
                backgroundBlendMode: 'overlay',
            }}
        >
            <div className="w-full flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold tracking-[0.28em] text-zinc-700">
                        DECK {deckNumber}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-600">
                        BPM <span className="font-bold tabular-nums" style={{ color: accent }}>{Math.round(bpm)}</span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-600">
                        TEMPO <span className="font-bold tabular-nums" style={{ color: accent }}>
                            {tempoPercent >= 0 ? '+' : ''}{tempoPercent}%
                        </span>
                    </div>
                </div>

                <Knob
                    label=""
                    ariaLabel={`${deckId} tempo`}
                    accent={accent}
                    value={tempoKnob}
                    onChange={(v) => onSpeedChange(0.5 + clamp(v, 0, 1) * 1.5)}
                    size={52}
                />
            </div>

            <div className="relative w-full flex items-center justify-center">
                <div
                    className="absolute left-3 top-3 w-2 h-2 rounded-full"
                    style={{ background: accent, boxShadow: `0 0 18px ${accent}` }}
                    aria-hidden="true"
                />
                <Platter
                    deckId={deckId}
                    accent={accent}
                    rotation={rotation}
                    isPlaying={isPlaying}
                    bpm={bpm}
                    trackName={trackName}
                    patternIndex={patternIndex}
                    onTogglePlay={onTogglePlay}
                />
            </div>

            <div className="w-full max-w-[240px] rounded-xl border border-zinc-300 bg-white/45 shadow-[inset_0_0_18px_rgba(0,0,0,0.12)] p-2.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
                        Performance Pads
                    </span>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                        <button
                            onClick={onToggleShift}
                            className={`px-2 py-1 rounded-md border text-[9px] font-mono uppercase tracking-widest transition
                                ${shift
                                    ? 'border-zinc-900 bg-gradient-to-b from-zinc-900 to-zinc-700 text-white shadow-[0_0_14px_rgba(0,0,0,0.35)]'
                                    : 'border-zinc-400 bg-gradient-to-b from-zinc-200/80 to-zinc-100/50 text-zinc-700 hover:brightness-110'}`}
                            aria-label={`${deckId} shift`}
                            title="Shift (toggle)"
                        >
                            Shift
                        </button>
                        {modeButton('hotcue', 'Hot Cue')}
                        {modeButton('loop', 'Loop')}
                        {modeButton('fx', 'FX')}
                        {modeButton('sampler', 'Neural Mix')}
                    </div>
                </div>

                {padMode === 'fx' && !isUploaded ? (
                    <div className="grid grid-cols-4 gap-1 mb-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => onCyclePadFx(i)}
                                className="py-1 rounded border border-zinc-400 bg-gradient-to-b from-zinc-100 to-zinc-200 text-[9px] font-mono uppercase tracking-widest text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:brightness-110"
                                aria-label={`${deckId} pad ${i + 1} fx assignment`}
                                title="Cycle pad effect"
                            >
                                {PAD_FX_LABEL[padFxAssign[i] ?? 'reverb']}
                            </button>
                        ))}
                    </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => {
                        const active = (() => {
                            if (padMode === 'sampler') return Boolean(samplerPads[i]);
                            if (padMode === 'loop') return loopPad === i;
                            if (padMode === 'fx') return isUploaded ? false : Boolean(fxPads[i]);
                            if (padMode === 'hotcue') {
                                return isUploaded ? hotcues[i] != null : patternIndex === i;
                            }
                            return false;
                        })();

                        const label = (() => {
                            if (padMode === 'loop') return ['1', '2', '4', '8'][i] ?? String(i + 1);
                            if (padMode === 'fx') return isUploaded ? String(i + 1) : PAD_FX_LABEL[padFxAssign[i] ?? 'reverb'];
                            return String(i + 1);
                        })();

                        const hint = (() => {
                            if (!isUploaded) return 'Trigger';
                            if (padMode === 'hotcue') return shift ? 'Pitch play' : 'Hot cue';
                            if (padMode === 'loop') return 'Bounce loop';
                            if (padMode === 'fx') return 'Slicer';
                            return 'Trigger';
                        })();

                        return (
                            <button
                                key={i}
                                onPointerDown={() => onPadPress(i)}
                                onPointerUp={() => onPadRelease(i)}
                                onPointerLeave={() => onPadRelease(i)}
                                onPointerCancel={() => onPadRelease(i)}
                                className={`aspect-square rounded-md border-2 transition select-none
                                    ${active
                                        ? 'bg-gradient-to-b from-red-500 to-red-700 border-red-900 shadow-[0_0_22px_rgba(239,68,68,0.65),inset_0_1px_0_rgba(255,255,255,0.25)]'
                                        : 'bg-gradient-to-b from-zinc-950/90 to-zinc-900/70 border-red-600/70 shadow-[inset_0_0_18px_rgba(0,0,0,0.75)] hover:brightness-110'}`}
                                aria-label={`${deckId} pad ${i + 1}`}
                                title={hint}
                            >
                                <span className="text-red-100/90 text-base font-black drop-shadow-[0_1px_0_rgba(0,0,0,0.8)]">
                                    {label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="w-full flex items-center justify-center gap-3 pt-1">
                <button
                    onClick={onSync}
                    className={`px-4 py-2 rounded-md border text-xs font-mono uppercase tracking-widest transition shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]
                        ${tempoSync
                            ? 'border-cyan-900 bg-gradient-to-b from-cyan-300/80 to-cyan-800/55 text-cyan-950 shadow-[0_0_18px_rgba(6,182,212,0.35),inset_0_1px_0_rgba(255,255,255,0.35)]'
                            : 'border-cyan-700/70 bg-gradient-to-b from-cyan-200/70 to-cyan-900/35 text-cyan-950 hover:brightness-110 shadow-[0_0_18px_rgba(6,182,212,0.22)]'}`}
                >
                    Tempo Sync
                </button>
                <button
                    onClick={onReverbExit}
                    className="px-4 py-2 rounded-md border border-fuchsia-800/70 bg-gradient-to-b from-fuchsia-200/60 to-fuchsia-950/30 text-fuchsia-950 text-[11px] font-mono uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_0_18px_rgba(217,70,239,0.18)] hover:brightness-110"
                >
                    Reverb Exit
                </button>
                <button
                    onClick={onToggleCue}
                    className={`px-5 py-2 rounded-md border text-xs font-mono uppercase tracking-widest transition shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]
                        ${isCueActive
                            ? 'border-amber-900 bg-gradient-to-b from-amber-400/80 to-amber-700/70 text-amber-950 shadow-[0_0_18px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.3)]'
                            : 'border-amber-700/70 bg-gradient-to-b from-amber-300/35 to-amber-900/25 text-amber-950 hover:brightness-110'}`}
                >
                    {isCueActive ? 'Cue On' : 'Cue'}
                </button>
                <button
                    onClick={onTogglePlay}
                    className={`px-6 py-2 rounded-md border text-xs font-mono uppercase tracking-widest transition shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]
                        ${isPlaying
                            ? 'border-emerald-900 bg-gradient-to-b from-emerald-300/70 to-emerald-800/55 text-emerald-950 shadow-[0_0_18px_rgba(16,185,129,0.28)]'
                            : 'border-emerald-700/70 bg-gradient-to-b from-emerald-200/30 to-emerald-900/20 text-emerald-950 hover:brightness-110'}`}
                >
                    {isPlaying ? 'Pause' : 'Play'}
                </button>
            </div>
        </div>
    );
}

function Platter({
    deckId,
    accent,
    rotation,
    isPlaying,
    bpm,
    trackName,
    patternIndex,
    onTogglePlay,
}: {
    deckId: DeckId;
    accent: string;
    rotation: number;
    isPlaying: boolean;
    bpm: number;
    trackName: string;
    patternIndex: number;
    onTogglePlay: () => void;
}) {
    const trackLabel = trackName || `Track ${String(patternIndex + 1).padStart(2, '0')}`;

    return (
        <div
            onClick={onTogglePlay}
            className="relative aspect-square w-full max-w-[240px] rounded-full cursor-pointer select-none"
            style={{
                filter: isPlaying ? `drop-shadow(0 0 30px ${accent}55)` : undefined,
            }}
            aria-label={`${deckId} platter`}
        >
            {/* Outer housing */}
            <div
                className="absolute inset-0 rounded-full"
                style={{
                    background: 'radial-gradient(circle at 30% 25%, #f8fafc 0%, #e5e7eb 32%, #a1a1aa 62%, #52525b 100%)',
                    boxShadow:
                        'inset 0 12px 26px rgba(255,255,255,0.45), ' +
                        'inset 0 -18px 34px rgba(0,0,0,0.45), ' +
                        '0 16px 34px rgba(0,0,0,0.35)',
                }}
            />

            {/* Rivet ring impression */}
            <div
                className="absolute inset-[1.5%] rounded-full opacity-55"
                style={{
                    background:
                        'repeating-conic-gradient(from 10deg, rgba(255,255,255,0.85) 0deg 4deg, rgba(0,0,0,0.25) 4deg 12deg)',
                    filter: 'blur(0.25px)',
                }}
                aria-hidden="true"
            />

            {/* LED ring */}
            <div className="absolute inset-[4%] rounded-full border-[6px] border-blue-500/60 shadow-[0_0_22px_rgba(59,130,246,0.75)]" />

            {/* Rotating disc */}
            <div
                className="absolute inset-[8%] rounded-full"
                style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: isPlaying ? 'transform 50ms linear' : undefined,
                }}
                aria-hidden="true"
            >
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background: 'radial-gradient(circle at 35% 30%, #f9fafb 0%, #d1d5db 34%, #a1a1aa 62%, #3f3f46 100%)',
                        boxShadow: 'inset 0 18px 30px rgba(255,255,255,0.25), inset 0 -22px 36px rgba(0,0,0,0.55)',
                    }}
                />
                <div
                    className="absolute inset-[6%] rounded-full opacity-25"
                    style={{
                        background: 'repeating-conic-gradient(rgba(0,0,0,0.55) 0deg 1.2deg, transparent 1.2deg 5.5deg)',
                        filter: 'blur(0.3px)',
                    }}
                />
                <div
                    className="absolute inset-[20%] rounded-full"
                    style={{
                        background: 'radial-gradient(circle at 40% 40%, #0f172a 0%, #070a10 62%, #000 100%)',
                        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.9)',
                    }}
                />
            </div>

            {/* Decorative arcs */}
            <div
                className="absolute top-0 right-6 w-24 h-24 rounded-full border-[6px] border-black/45 border-l-transparent border-b-transparent"
                aria-hidden="true"
            />
            <div
                className="absolute bottom-0 left-6 w-28 h-28 rounded-full border-[6px] border-black/45 border-r-transparent border-t-transparent"
                aria-hidden="true"
            />

            {/* Red LED glow */}
            <div
                className="absolute left-1/2 bottom-[9%] -translate-x-1/2 w-[66%] h-[12%] rounded-full opacity-70"
                style={{
                    background: 'radial-gradient(closest-side, rgba(239,68,68,0.55), transparent 72%)',
                }}
                aria-hidden="true"
            />

            {/* Center screen */}
            <div className="absolute inset-[34%] rounded-full bg-gradient-to-b from-black/95 to-black border border-zinc-700/90 shadow-[inset_0_0_18px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center text-white">
                <div className="text-[10px] font-mono text-zinc-300">{trackLabel}</div>
                <div className="text-[9px] font-mono text-zinc-500 -mt-0.5">Track info</div>
                <div className="mt-1">
                    <MiniWaveform accent={accent} isPlaying={isPlaying} />
                </div>
                <div className="mt-1 text-[10px] font-mono text-zinc-300">
                    <span className="text-[9px] text-zinc-500 mr-1">BPM</span>
                    <span className="font-bold tabular-nums" style={{ color: accent }}>
                        {bpm.toFixed(1)}
                    </span>
                </div>
            </div>
        </div>
    );
}

function MiniWaveform({ accent, isPlaying }: { accent: string; isPlaying: boolean }) {
    const [bars, setBars] = useState<number[]>(() => Array.from({ length: 30 }, () => 0.15 + Math.random() * 0.8));

    useEffect(() => {
        if (!isPlaying) return;
        const id = setInterval(() => {
            setBars(prev =>
                prev.map((_, i) => 0.12 + Math.abs(Math.sin(Date.now() / 190 + i * 0.45)) * 0.6 + Math.random() * 0.18)
            );
        }, 90);
        return () => clearInterval(id);
    }, [isPlaying]);

    return (
        <div className="relative w-24 h-9">
            <div
                className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage:
                        'linear-gradient(transparent 0%, transparent 48%, rgba(255,255,255,0.18) 48%, rgba(255,255,255,0.18) 52%, transparent 52%, transparent 100%),' +
                        'repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 10px)',
                }}
                aria-hidden="true"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-[1px]">
                {bars.map((h, i) => {
                    const amp = clamp(h, 0.05, 1);
                    const color = i % 9 === 0 ? '#ef4444' : accent;
                    return (
                        <div key={i} className="w-[2px] h-full flex flex-col justify-center">
                            <div
                                className="rounded-sm"
                                style={{
                                    height: `${amp * 45}%`,
                                    background: `linear-gradient(to top, ${color}, ${color}55)`,
                                }}
                            />
                            <div className="h-[1px] bg-white/10 my-[1px]" aria-hidden="true" />
                            <div
                                className="rounded-sm"
                                style={{
                                    height: `${amp * 45}%`,
                                    background: `linear-gradient(to bottom, ${color}, ${color}55)`,
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function MixerPanel({
    accentA,
    accentB,
    trimA,
    trimB,
    onTrimA,
    onTrimB,
    faderA,
    faderB,
    onFaderA,
    onFaderB,
    eqA,
    eqB,
    onEqA,
    onEqB,
    filterA,
    filterB,
    onFilterA,
    onFilterB,
    master,
    onMaster,
    masterPitch,
    onMasterPitch,
    crossfader,
    onCrossfader,
    tempoBpm,
    onAiBeatMatch,
    beatMatchStatus,
    browseCount,
    browseIndex,
    browseLabel,
    browseTrackBpm,
    onBrowseIndex,
    onLoadA,
    onLoadB,
    onImportAudio,
    onImportBeatgrid,
    canImportBeatgrid,
}: {
    accentA: string;
    accentB: string;
    trimA: number;
    trimB: number;
    onTrimA: (v: number) => void;
    onTrimB: (v: number) => void;
    faderA: number;
    faderB: number;
    onFaderA: (v: number) => void;
    onFaderB: (v: number) => void;
    eqA: { low: number; mid: number; high: number };
    eqB: { low: number; mid: number; high: number };
    onEqA: { low: (v: number) => void; mid: (v: number) => void; high: (v: number) => void };
    onEqB: { low: (v: number) => void; mid: (v: number) => void; high: (v: number) => void };
    filterA: number;
    filterB: number;
    onFilterA: (v: number) => void;
    onFilterB: (v: number) => void;
    master: number;
    onMaster: (v: number) => void;
    masterPitch: number;
    onMasterPitch: (v: number) => void;
    crossfader: number;
    onCrossfader: (v: number) => void;
    tempoBpm: number;
    onAiBeatMatch: () => void;
    beatMatchStatus: string | null;
    browseCount: number;
    browseIndex: number;
    browseLabel: string;
    browseTrackBpm: number;
    onBrowseIndex: (idx: number) => void;
    onLoadA: () => void;
    onLoadB: () => void;
    onImportAudio: () => void;
    onImportBeatgrid: () => void;
    canImportBeatgrid: boolean;
}) {
    const safeBrowseCount = Math.max(1, browseCount);
    const browseValue = safeBrowseCount <= 1 ? 0 : clamp(browseIndex / (safeBrowseCount - 1), 0, 1);

    return (
        <div className="relative w-full max-w-[340px] mx-auto flex flex-col items-center gap-3 p-3 rounded-2xl bg-gradient-to-b from-zinc-100 to-zinc-200 border border-zinc-300 shadow-[0_16px_34px_rgba(0,0,0,0.2),inset_0_0_22px_rgba(0,0,0,0.18)]">
            {/* Tabs */}
            <div className="w-full rounded-xl border border-zinc-400 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                <div className="grid grid-cols-2 text-[10px] font-black tracking-[0.22em] uppercase">
                    <div className="py-1.5 text-center bg-gradient-to-b from-zinc-300 to-zinc-200 text-zinc-700">
                        Producer
                    </div>
                    <div className="py-1.5 text-center bg-gradient-to-b from-zinc-200 to-zinc-100 text-zinc-950 border-l border-zinc-400 shadow-[inset_0_0_18px_rgba(0,0,0,0.12)]">
                        DJ Mixer
                    </div>
                </div>
            </div>

            {/* Browse / Load */}
            <div className="w-full flex flex-col items-center gap-2 rounded-xl border border-zinc-300 bg-white/35 shadow-[inset_0_0_18px_rgba(0,0,0,0.12)] p-2.5">
                <div className="w-full flex items-center justify-between gap-2">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-700">Browse</div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onImportAudio}
                            className="px-2 py-1 rounded-md border border-zinc-400 bg-gradient-to-b from-zinc-100/80 to-zinc-200/60 text-[9px] font-mono uppercase tracking-widest text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:brightness-110"
                            title="Import audio track"
                        >
                            Import
                        </button>
                        <button
                            type="button"
                            onClick={onImportBeatgrid}
                            disabled={!canImportBeatgrid}
                            className={`px-2 py-1 rounded-md border text-[9px] font-mono uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]
                                ${canImportBeatgrid
                                    ? 'border-zinc-400 bg-gradient-to-b from-zinc-100/80 to-zinc-200/60 text-zinc-800 hover:brightness-110'
                                    : 'border-zinc-300 bg-zinc-200/40 text-zinc-500 opacity-60 cursor-not-allowed'}`}
                            title={canImportBeatgrid ? 'Import beatgrid JSON for selected track' : 'Select an uploaded track to import beatgrid'}
                        >
                            Grid
                        </button>
                    </div>
                </div>
                <Knob
                    label=""
                    accent="#0f172a"
                    value={browseValue}
                    onChange={(v) => onBrowseIndex(clamp(Math.round(v * (safeBrowseCount - 1)), 0, safeBrowseCount - 1))}
                    size={66}
                    ariaLabel="Browse"
                />
                <div className="text-center leading-tight">
                    <div className="text-[11px] font-mono text-zinc-800 truncate max-w-[260px]">
                        {browseLabel || `Track ${String(clamp(browseIndex, 0, safeBrowseCount - 1) + 1).padStart(2, '0')}`}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-600 tabular-nums">
                        {Math.round(browseTrackBpm)} BPM
                    </div>
                </div>
                <div className="flex items-end gap-5">
                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={onLoadA}
                            className="w-11 h-11 rounded-full border border-zinc-600 bg-gradient-to-b from-zinc-100 to-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_18px_rgba(0,0,0,0.22)] hover:brightness-110"
                            aria-label="Load deck 1"
                        >
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/85 text-white font-black shadow-[0_0_14px_rgba(6,182,212,0.25)]">
                                1
                            </span>
                        </button>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-700">Load</div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={onLoadB}
                            className="w-11 h-11 rounded-full border border-zinc-600 bg-gradient-to-b from-zinc-100 to-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_18px_rgba(0,0,0,0.22)] hover:brightness-110"
                            aria-label="Load deck 2"
                        >
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/85 text-white font-black shadow-[0_0_14px_rgba(217,70,239,0.25)]">
                                2
                            </span>
                        </button>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-700">Load</div>
                    </div>
                </div>
            </div>

            {/* Channels */}
            <div className="grid grid-cols-2 gap-3 w-full">
                <ChannelStrip
                    label="1"
                    accent={accentA}
                    trim={trimA}
                    onTrim={onTrimA}
                    fader={faderA}
                    onFader={onFaderA}
                    eq={eqA}
                    onEq={onEqA}
                    filter={filterA}
                    onFilter={onFilterA}
                />
                <ChannelStrip
                    label="2"
                    accent={accentB}
                    trim={trimB}
                    onTrim={onTrimB}
                    fader={faderB}
                    onFader={onFaderB}
                    eq={eqB}
                    onEq={onEqB}
                    filter={filterB}
                    onFilter={onFilterB}
                />
            </div>

            {/* Master / Crossfader */}
            <div className="w-full grid grid-cols-[auto_auto_1fr] gap-3 items-end pt-1">
                <Knob label="Main" accent="#0f172a" value={master} onChange={onMaster} size={50} />
                <div className="flex flex-col items-center gap-1">
                    <Knob label="Pitch" accent="#0f172a" value={masterPitch} onChange={onMasterPitch} size={50} ariaLabel="Master pitch" />
                    <div className="text-[10px] font-mono text-zinc-700 tabular-nums -mt-1">
                        {(() => {
                            const semis = Math.round((masterPitch - 0.5) * 24);
                            return `${semis >= 0 ? '+' : ''}${semis} st`;
                        })()}
                    </div>
                </div>
                <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
                            Crossfade Mixer
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                            <button
                                type="button"
                                onClick={onAiBeatMatch}
                                className="px-2.5 py-1 rounded-md border border-emerald-700/70 bg-gradient-to-b from-emerald-200/55 to-emerald-900/25 text-emerald-950 text-[10px] font-mono uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_16px_rgba(16,185,129,0.18)] hover:brightness-110"
                            >
                                AI Beat Match
                            </button>
                            {beatMatchStatus ? (
                                <div className="text-[9px] font-mono text-emerald-900/80 tabular-nums">
                                    {beatMatchStatus}
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600 mb-2">
                        <span className="uppercase tracking-widest">Tempo Lock</span>
                        <span className="tabular-nums text-zinc-800">{Math.round(tempoBpm)} BPM</span>
                    </div>
                    <Crossfader
                        value={crossfader}
                        onChange={onCrossfader}
                        accentA={accentA}
                        accentB={accentB}
                        compact
                    />
                </div>
            </div>
        </div>
    );
}

function ChannelStrip({
    label,
    accent,
    trim,
    onTrim,
    fader,
    onFader,
    eq,
    onEq,
    filter,
    onFilter,
}: {
    label: string;
    accent: string;
    trim: number;
    onTrim: (v: number) => void;
    fader: number;
    onFader: (v: number) => void;
    eq: { low: number; mid: number; high: number };
    onEq: { low: (v: number) => void; mid: (v: number) => void; high: (v: number) => void };
    filter: number;
    onFilter: (v: number) => void;
}) {
    return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-300 bg-white/35 shadow-[inset_0_0_18px_rgba(0,0,0,0.12)] px-2 py-2.5">
            <div className="text-[10px] font-mono text-zinc-700">CH {label}</div>

            <Knob label="Level" accent={accent} value={trim} onChange={onTrim} size={36} />

            <div className="flex flex-col items-center gap-2">
                <Knob label="Treble" accent={accent} value={eq.high} onChange={onEq.high} size={34} />
                <Knob label="Mid" accent={accent} value={eq.mid} onChange={onEq.mid} size={34} />
                <Knob label="Bass" accent={accent} value={eq.low} onChange={onEq.low} size={34} />
            </div>

            <Knob label="Filter" accent={accent} value={filter} onChange={onFilter} size={48} />

            <VerticalFader
                label="Fader"
                value={fader}
                onChange={onFader}
                min={0}
                max={1}
                step={0.01}
                accent={accent}
                height={140}
                ariaLabel={`Channel ${label} fader`}
            />
        </div>
    );
}

function Knob({
    value,
    onChange,
    label,
    accent,
    size = 40,
    ariaLabel,
}: {
    value: number;
    onChange: (v: number) => void;
    label: string;
    accent: string;
    size?: number;
    ariaLabel?: string;
}) {
    const knobRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);
    const angle = -135 + value * 270;
    const keyboardStep = 0.02;

    const updateFromPointer = useCallback((clientX: number, clientY: number) => {
        const el = knobRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = clientX - cx;
        const dy = clientY - cy;
        const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = up, +90 = right
        const clamped = clamp(degrees, -135, 135);
        const next = (clamped + 135) / 270;
        onChange(clamp(next, 0, 1));
    }, [onChange]);

    return (
        <div className="flex flex-col items-center gap-1 select-none">
            <div
                ref={knobRef}
                role="slider"
                tabIndex={0}
                aria-label={ariaLabel || label || 'knob'}
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={Number(value.toFixed(3))}
                className="relative rounded-full outline-none focus:ring-2 focus:ring-black/30"
                style={{ width: size, height: size, touchAction: 'none' }}
                onDoubleClick={() => onChange(0.5)}
                onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                    draggingRef.current = true;
                    updateFromPointer(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                    if (!draggingRef.current) return;
                    updateFromPointer(e.clientX, e.clientY);
                }}
                onPointerUp={() => {
                    draggingRef.current = false;
                }}
                onPointerCancel={() => {
                    draggingRef.current = false;
                }}
                onKeyDown={(e) => {
                    const step = e.shiftKey ? keyboardStep * 4 : keyboardStep;
                    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        onChange(clamp(value + step, 0, 1));
                    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        onChange(clamp(value - step, 0, 1));
                    } else if (e.key === 'Home') {
                        e.preventDefault();
                        onChange(0);
                    } else if (e.key === 'End') {
                        e.preventDefault();
                        onChange(1);
                    }
                }}
            >
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle at 30% 25%, #f8fafc 0%, #e5e7eb 35%, #a1a1aa 70%, #4b5563 100%)',
                        boxShadow:
                            'inset 0 12px 18px rgba(255,255,255,0.35), ' +
                            'inset 0 -18px 24px rgba(0,0,0,0.45), ' +
                            '0 6px 12px rgba(0,0,0,0.25)',
                    }}
                />
                <div
                    className="absolute inset-[10%] rounded-full opacity-60"
                    style={{
                        background:
                            'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.55) 0deg 3deg, rgba(0,0,0,0.18) 3deg 9deg)',
                        filter: 'blur(0.25px)',
                    }}
                    aria-hidden="true"
                />
                <div
                    className="absolute inset-[18%] rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle at 35% 30%, #111827 0%, #0b0f16 60%, #020617 100%)',
                        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.85)',
                    }}
                />
                <div
                    className="absolute left-1/2 top-1/2 w-[2px] h-[40%] origin-bottom"
                    style={{
                        background: accent,
                        transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                        boxShadow: `0 0 10px ${accent}`,
                    }}
                />
            </div>
            {label ? (
                <div className="text-[8px] font-mono uppercase tracking-widest text-zinc-600">
                    {label}
                </div>
            ) : null}
        </div>
    );
}

function VerticalFader({
    label,
    value,
    onChange,
    min,
    max,
    step,
    accent,
    height = 170,
    ariaLabel,
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    accent: string;
    height?: number;
    ariaLabel: string;
}) {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);

    const commit = useCallback((next: number) => {
        const stepped = step > 0 ? Math.round(next / step) * step : next;
        onChange(clamp(stepped, min, max));
    }, [max, min, onChange, step]);

    const updateFromPointer = useCallback((clientY: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const t = 1 - (clientY - rect.top) / rect.height;
        const next = min + clamp(t, 0, 1) * (max - min);
        commit(next);
    }, [commit, max, min]);

    const normalized = max === min ? 0 : clamp((value - min) / (max - min), 0, 1);

    return (
        <div className="flex flex-col items-center gap-1 select-none">
            <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label={ariaLabel}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={Number(value.toFixed(3))}
                className="relative w-12 rounded-xl border border-zinc-500 bg-gradient-to-b from-zinc-950/70 to-zinc-900/60 shadow-[inset_0_0_18px_rgba(0,0,0,0.7)] outline-none focus:ring-2 focus:ring-black/30"
                style={{ height, touchAction: 'none' }}
                onPointerDown={(e) => {
                    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                    draggingRef.current = true;
                    updateFromPointer(e.clientY);
                }}
                onPointerMove={(e) => {
                    if (!draggingRef.current) return;
                    updateFromPointer(e.clientY);
                }}
                onPointerUp={() => {
                    draggingRef.current = false;
                }}
                onPointerCancel={() => {
                    draggingRef.current = false;
                }}
                onKeyDown={(e) => {
                    const fineStep = step > 0 ? step : 0.01;
                    const delta = (e.shiftKey ? fineStep * 10 : fineStep);
                    if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        commit(value + delta);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        commit(value - delta);
                    } else if (e.key === 'PageUp') {
                        e.preventDefault();
                        commit(value + delta * 4);
                    } else if (e.key === 'PageDown') {
                        e.preventDefault();
                        commit(value - delta * 4);
                    } else if (e.key === 'Home') {
                        e.preventDefault();
                        commit(min);
                    } else if (e.key === 'End') {
                        e.preventDefault();
                        commit(max);
                    }
                }}
            >
                <div
                    className="absolute inset-0 rounded-xl opacity-40"
                    style={{
                        background:
                            'repeating-linear-gradient(0deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 2px, transparent 2px, transparent 11px)',
                    }}
                    aria-hidden="true"
                />
                <div
                    className="absolute left-1/2 top-2 bottom-2 w-[10px] -translate-x-1/2 rounded-full bg-black/70 border border-zinc-700 shadow-[inset_0_0_12px_rgba(0,0,0,0.9)]"
                    aria-hidden="true"
                />
                <div
                    className="absolute left-1/2 w-14 h-5 -translate-x-1/2 -translate-y-1/2 rounded-md border border-zinc-400 shadow-[0_8px_16px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.65)]"
                    style={{
                        top: `${(1 - normalized) * 100}%`,
                        background: 'linear-gradient(180deg, #f8fafc 0%, #d1d5db 55%, #9ca3af 100%)',
                    }}
                >
                    <div
                        className="absolute inset-1 rounded"
                        style={{
                            background:
                                'repeating-linear-gradient(90deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 4px)',
                            opacity: 0.55,
                        }}
                        aria-hidden="true"
                    />
                    <div
                        className="absolute left-1/2 top-1 bottom-1 w-[2px] -translate-x-1/2 rounded-full"
                        style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
                        aria-hidden="true"
                    />
                </div>
            </div>
            {label ? (
                <div className="text-[8px] font-mono uppercase tracking-widest text-zinc-600">
                    {label}
                </div>
            ) : null}
        </div>
    );
}

function Crossfader({
    value,
    onChange,
    accentA,
    accentB,
    compact = false,
}: {
    value: number;
    onChange: (v: number) => void;
    accentA: string;
    accentB: string;
    compact?: boolean;
}) {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);

    const commit = useCallback((next: number) => {
        const stepped = Math.round(next / 0.01) * 0.01;
        onChange(clamp(stepped, -1, 1));
    }, [onChange]);

    const updateFromPointer = useCallback((clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const t = (clientX - rect.left) / rect.width;
        const next = -1 + clamp(t, 0, 1) * 2;
        commit(next);
    }, [commit]);

    const normalized = clamp((value + 1) / 2, 0, 1);

    return (
        <div className={`w-full rounded-xl border border-zinc-400 bg-white/35 shadow-[inset_0_0_14px_rgba(0,0,0,0.18)] ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
            {compact ? null : (
                <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 text-center mb-2">
                    Crossfader
                </div>
            )}
            <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold tabular-nums" style={{ color: accentA }}>1</span>
                <div
                    ref={trackRef}
                    role="slider"
                    tabIndex={0}
                    aria-label="crossfader"
                    aria-valuemin={-1}
                    aria-valuemax={1}
                    aria-valuenow={Number(value.toFixed(3))}
                    className="relative flex-1 h-8 rounded-full border border-zinc-700 bg-gradient-to-b from-zinc-950/80 to-zinc-900/70 shadow-[inset_0_0_18px_rgba(0,0,0,0.75)] outline-none focus:ring-2 focus:ring-black/30"
                    style={{ touchAction: 'none' }}
                    onPointerDown={(e) => {
                        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                        draggingRef.current = true;
                        updateFromPointer(e.clientX);
                    }}
                    onPointerMove={(e) => {
                        if (!draggingRef.current) return;
                        updateFromPointer(e.clientX);
                    }}
                    onPointerUp={() => {
                        draggingRef.current = false;
                    }}
                    onPointerCancel={() => {
                        draggingRef.current = false;
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            commit(value - 0.03);
                        } else if (e.key === 'ArrowRight') {
                            e.preventDefault();
                            commit(value + 0.03);
                        } else if (e.key === 'Home') {
                            e.preventDefault();
                            commit(-1);
                        } else if (e.key === 'End') {
                            e.preventDefault();
                            commit(1);
                        }
                    }}
                >
                    <div
                        className="absolute inset-0 rounded-full opacity-40"
                        style={{
                            background:
                                'repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0px, rgba(255,255,255,0.2) 2px, transparent 2px, transparent 12px)',
                        }}
                        aria-hidden="true"
                    />
                    <div className="absolute left-1/2 top-1/2 w-[2px] h-8 -translate-x-1/2 -translate-y-1/2 bg-white/25" aria-hidden="true" />
                    <div
                        className="absolute top-1/2"
                        style={{ left: `${normalized * 100}%`, transform: 'translate(-50%, -50%)' }}
                        aria-hidden="true"
                    >
                        <div className="relative w-12 h-6 rounded-md border border-zinc-400 bg-gradient-to-b from-zinc-50 to-zinc-300 shadow-[0_10px_18px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.65)]">
                            <div
                                className="absolute inset-1 rounded"
                                style={{
                                    background:
                                        'repeating-linear-gradient(90deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 4px)',
                                    opacity: 0.55,
                                }}
                            />
                        </div>
                    </div>
                </div>
                <span className="text-xs font-mono font-bold tabular-nums" style={{ color: accentB }}>2</span>
            </div>
        </div>
    );
}

export default DJMixerView;
