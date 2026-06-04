'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InstrumentType, SonicSessionState } from '@/types/sonic';
import {
    TrackGenome,
    MutationDepth,
    GenomeFx,
    randomGenome,
    mutateGenome,
    evolveGenome,
    breedGenomes,
    genomeToPattern,
    summarizeGenome,
    defaultFx,
} from '@/lib/synplant/genome';
import { AudioFeatures, extractAudioFeatures, genomeFromAudio } from '@/lib/synplant/genopatch';
import {
    startTransitionSweep,
    cancelTransitionSweep,
    isTransitionSweepActive,
    getTransitionSweepProgress
} from '@/lib/strudel/engine';
import {
    ArrowDown,
    ArrowUp,
    Dna,
    Gauge,
    Music2,
    Radio,
    Save,
    Shuffle,
    Skull,
    Sparkles,
    Sprout,
    Star,
    Upload,
    Wand2,
    Waves,
    Zap
} from 'lucide-react';

const BUILD_UP_PRESETS: Array<{ id: string; label: string; icon: React.ReactNode; pattern: string; description: string }> = [
    {
        id: 'riser',
        label: 'Riser',
        icon: <ArrowUp className="h-3.5 w-3.5" />,
        pattern: "stack(s(\"pink\").hpf(sine.range(200, 15000).slow(8)).gain(sine.range(0.05, 0.55).slow(8)), note(m(\"c5 c5 c5 c5 c5 c5 c5 c5\")).s(\"square\").hpf(2000).decay(0.02).fast(sine.range(0.5, 8).slow(8)).gain(sine.range(0.05, 0.35).slow(8)))",
        description: 'Full noise riser - 8 bar build'
    },
    {
        id: 'drop',
        label: 'Drop',
        icon: <ArrowDown className="h-3.5 w-3.5" />,
        pattern: "stack(note(m(\"c1\")).s(\"sine\").att(0.001).decay(1.2).lpf(80).gain(1.0), note(m(\"c2\")).s(\"square\").att(0.001).decay(0.3).lpf(200).gain(0.5), s(\"pink\").hpf(50).lpf(200).decay(0.4).gain(0.6)).slow(8)",
        description: 'Sub bass impact'
    },
    {
        id: 'sweep',
        label: 'Sweep',
        icon: <Waves className="h-3.5 w-3.5" />,
        pattern: "note(m(\"c3 c3 c3 c3\")).s(\"sawtooth\").lpf(sine.range(150, 6000).slow(4)).resonance(18).distort(0.1).room(0.15).gain(0.45)",
        description: 'Resonant filter sweep'
    },
    {
        id: 'tension',
        label: 'Tension',
        icon: <Gauge className="h-3.5 w-3.5" />,
        pattern: "stack(note(m(\"c5*16\")).s(\"pink\").hpf(1500).decay(0.01).fast(sine.range(0.5, 4).slow(4)).gain(sine.range(0.2, 0.6).slow(4)), s(\"pink\").hpf(sine.range(400, 8000).slow(4)).gain(sine.range(0.1, 0.3).slow(4)))",
        description: 'Snare roll build-up'
    },
    {
        id: 'downlifter',
        label: 'Downlifter',
        icon: <ArrowDown className="h-3.5 w-3.5" />,
        pattern: "stack(s(\"pink\").hpf(sine.range(12000, 150).slow(2)).gain(sine.range(0.5, 0.05).slow(2)), note(m(\"c6\")).s(\"sine\").hpf(sine.range(8000, 200).slow(2)).decay(0.01).gain(sine.range(0.3, 0.05).slow(2)))",
        description: 'Reverse cymbal fade'
    },
    {
        id: 'pitchrise',
        label: 'Pitch Rise',
        icon: <ArrowUp className="h-3.5 w-3.5" />,
        pattern: "note(m(\"c3 d3 e3 f3 g3 a3 b3 c4 d4 e4 f4 g4 a4 b4 c5 c5\")).s(\"supersaw\").att(0.01).decay(0.1).lpf(sine.range(800, 8000).slow(4)).resonance(10).room(0.3).gain(sine.range(0.2, 0.55).slow(4)).slow(2)",
        description: 'Ascending pitch rise'
    },
];

interface SynplantGardenProps {
    state: SonicSessionState | null;
    onApplyPattern: (trackId: InstrumentType, pattern: string) => void;
}

type GardenPage = 'grow' | 'dna' | 'genopatch' | 'perform';

interface GenopatchCandidate {
    id: string;
    label: string;
    genome: TrackGenome;
    depth: MutationDepth | 'source';
}

interface FeatureMeter {
    label: string;
    value: number;
    readout: string;
}

const DEPTH_META: Record<MutationDepth, { label: string; icon: React.ReactNode; accent: string; description: string }> = {
    gentle: {
        label: 'Gentle',
        icon: <Sprout className="h-3.5 w-3.5" />,
        accent: 'border-emerald-300/55 bg-emerald-300/12 text-emerald-100',
        description: 'close to parent'
    },
    wild: {
        label: 'Wild',
        icon: <Sparkles className="h-3.5 w-3.5" />,
        accent: 'border-cyan-300/55 bg-cyan-300/12 text-cyan-100',
        description: 'musical drift'
    },
    chaos: {
        label: 'Chaos',
        icon: <Skull className="h-3.5 w-3.5" />,
        accent: 'border-fuchsia-300/55 bg-fuchsia-300/12 text-fuchsia-100',
        description: 'far mutations'
    },
};

const TRACKS: InstrumentType[] = ['drums', 'bass', 'melody', 'voice', 'fx'];
const TRACK_LABELS: Record<InstrumentType, string> = {
    drums: 'Drums',
    bass: 'Bass',
    melody: 'Melody',
    voice: 'Voice',
    fx: 'FX',
};

const NOTE_RING = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PAGE_TABS: Array<{ id: GardenPage; label: string; icon: React.ReactNode }> = [
    { id: 'grow', label: 'Grow', icon: <Sprout className="h-3.5 w-3.5" /> },
    { id: 'dna', label: 'DNA', icon: <Dna className="h-3.5 w-3.5" /> },
    { id: 'genopatch', label: 'Genopatch', icon: <Upload className="h-3.5 w-3.5" /> },
    { id: 'perform', label: 'Perform', icon: <Radio className="h-3.5 w-3.5" /> },
];

const FX_OPTIONS: Array<{ id: GenomeFx; label: string }> = [
    { id: 'filter', label: 'Filter' },
    { id: 'reverb', label: 'Reverb' },
    { id: 'delay', label: 'Delay' },
    { id: 'neuro', label: 'Neuro' },
];

const MACRO_CONTROLS: Array<{ key: keyof Pick<TrackGenome, 'slow' | 'gain' | 'room' | 'delay' | 'lpf' | 'spice'>; label: string; min: number; max: number; step: number; accent: string }> = [
    { key: 'slow', label: 'Time', min: 0.25, max: 8, step: 0.01, accent: 'accent-cyan-300' },
    { key: 'gain', label: 'Volume', min: 0.1, max: 1.8, step: 0.01, accent: 'accent-emerald-300' },
    { key: 'room', label: 'Effect', min: 0, max: 1, step: 0.01, accent: 'accent-violet-300' },
    { key: 'delay', label: 'Delay', min: 0, max: 0.95, step: 0.01, accent: 'accent-sky-300' },
    { key: 'lpf', label: 'Filter', min: 0, max: 1, step: 0.01, accent: 'accent-amber-300' },
    { key: 'spice', label: 'Atonality', min: 0, max: 1, step: 0.01, accent: 'accent-fuchsia-300' },
];

function loadFavorites(): TrackGenome[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem('synplant:favorites');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed as TrackGenome[] : [];
    } catch {
        return [];
    }
}

function saveFavorites(favs: TrackGenome[]) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem('synplant:favorites', JSON.stringify(favs));
    } catch {
        // Local persistence should never block sound design.
    }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function makeForest(base: TrackGenome, depth: MutationDepth) {
    return Array.from({ length: 9 }, () => mutateGenome(base, depth));
}

function makeBulbBranches(base: TrackGenome, growth: number) {
    return NOTE_RING.map(() => evolveGenome(base, growth));
}

function meter(value: number) {
    return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function featureMeters(features: AudioFeatures | null): FeatureMeter[] {
    if (!features) return [];
    const brightness = clamp(features.centroid / 8000, 0, 1);
    const noisiness = clamp(features.zcr * 12, 0, 1);
    const loudness = clamp(features.rms * 3, 0, 1);
    return [
        { label: 'Brightness', value: brightness, readout: `${Math.round(features.centroid)} Hz` },
        { label: 'Loudness', value: loudness, readout: meter(loudness) },
        { label: 'Noisiness', value: noisiness, readout: meter(noisiness) },
        { label: 'Duration', value: clamp(features.duration / 2, 0, 1), readout: `${features.duration.toFixed(2)}s` },
    ];
}

function miniPattern(g: TrackGenome) {
    return g.notes.length > 56 ? `${g.notes.slice(0, 56)}...` : g.notes;
}

export function SynplantGarden({ state, onApplyPattern }: SynplantGardenProps) {
    const initialGarden = useMemo(() => {
        const seeded = randomGenome('voice', 'wild');
        const growthAll = 0.45;
        return {
            seeded,
            forest: makeForest(seeded, 'wild'),
            bulbBranches: makeBulbBranches(seeded, growthAll),
            bulbGrowth: NOTE_RING.map(() => growthAll),
            growthAll,
        };
    }, []);

    const [page, setPage] = useState<GardenPage>('grow');
    const [activeTrack, setActiveTrack] = useState<InstrumentType>('voice');
    const [depth, setDepth] = useState<MutationDepth>('wild');
    const [parent, setParent] = useState<TrackGenome>(initialGarden.seeded);
    const [forest, setForest] = useState<TrackGenome[]>(initialGarden.forest);
    const [selectedForestId, setSelectedForestId] = useState<string | null>(initialGarden.forest[0]?.id ?? null);
    const [bulbBranches, setBulbBranches] = useState<TrackGenome[]>(initialGarden.bulbBranches);
    const [bulbGrowth, setBulbGrowth] = useState<number[]>(initialGarden.bulbGrowth);
    const [growthAll, setGrowthAll] = useState(initialGarden.growthAll);
    const [selectedBranch, setSelectedBranch] = useState(0);
    const [favorites, setFavorites] = useState<TrackGenome[]>(() => loadFavorites());
    const [breedPick, setBreedPick] = useState<TrackGenome | null>(null);
    const [sweepActive, setSweepActive] = useState(false);
    const [sweepProgress, setSweepProgress] = useState(0);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiMessage, setAiMessage] = useState<string | null>(null);
    const [actionStatus, setActionStatus] = useState('Wild forest ready');
    const [genopatchStatus, setGenopatchStatus] = useState('Load a short audio sample to grow candidate strands.');
    const [genopatchFeatures, setGenopatchFeatures] = useState<AudioFeatures | null>(null);
    const [genopatchCandidates, setGenopatchCandidates] = useState<GenopatchCandidate[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const previewRef = useRef<{ trackId: InstrumentType; pattern: string } | null>(null);
    const previewIdRef = useRef<string | null>(null);

    useEffect(() => {
        const id = setInterval(() => {
            const active = isTransitionSweepActive();
            setSweepActive(active);
            setSweepProgress(active ? getTransitionSweepProgress() : 0);
        }, 100);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        saveFavorites(favorites);
    }, [favorites]);

    const showStatus = useCallback((message: string) => {
        setActionStatus(message);
    }, []);

    const applyGenome = useCallback((trackId: InstrumentType, g: TrackGenome) => {
        onApplyPattern(trackId, genomeToPattern({ ...g, trackId }));
    }, [onApplyPattern]);

    const cancelPreview = useCallback(() => {
        previewRef.current = null;
        previewIdRef.current = null;
    }, []);

    const previewGenome = useCallback((g: TrackGenome, trackOverride?: InstrumentType) => {
        const targetTrack = trackOverride ?? g.trackId ?? activeTrack;
        if (!previewRef.current) {
            previewRef.current = {
                trackId: targetTrack,
                pattern: state?.tracks?.[targetTrack]?.pattern || genomeToPattern({ ...parent, trackId: targetTrack }),
            };
        }
        previewIdRef.current = g.id;
        applyGenome(targetTrack, mutateGenome({ ...g, trackId: targetTrack }, 'gentle'));
    }, [activeTrack, applyGenome, parent, state]);

    const clearPreview = useCallback((id?: string) => {
        if (!previewRef.current) return;
        if (id && previewIdRef.current && previewIdRef.current !== id) return;
        onApplyPattern(previewRef.current.trackId, previewRef.current.pattern);
        previewRef.current = null;
        previewIdRef.current = null;
    }, [onApplyPattern]);

    const regenerateBulb = useCallback((base: TrackGenome, growthValue: number, selectedIdx = 0) => {
        const g = clamp(growthValue, 0, 1);
        setGrowthAll(g);
        setBulbGrowth(NOTE_RING.map(() => g));
        setBulbBranches(makeBulbBranches(base, g));
        setSelectedBranch(selectedIdx);
    }, []);

    const selectGenome = useCallback((g: TrackGenome, trackOverride: InstrumentType = g.trackId ?? activeTrack) => {
        cancelPreview();
        const nextGenome = { ...g, trackId: trackOverride };
        if (trackOverride !== activeTrack) setActiveTrack(trackOverride);
        setParent(nextGenome);
        applyGenome(trackOverride, nextGenome);
        const nextForest = makeForest(nextGenome, depth);
        setForest(nextForest);
        setSelectedForestId(nextForest[0]?.id ?? null);
        regenerateBulb(nextGenome, growthAll);
        setBreedPick(null);
        showStatus(`${TRACK_LABELS[trackOverride]} seed planted`);
    }, [activeTrack, applyGenome, cancelPreview, depth, growthAll, regenerateBulb, showStatus]);

    const switchTrack = useCallback((t: InstrumentType) => {
        cancelPreview();
        const seeded = randomGenome(t, depth);
        setActiveTrack(t);
        setParent(seeded);
        applyGenome(t, seeded);
        const nextForest = makeForest(seeded, depth);
        setForest(nextForest);
        setSelectedForestId(nextForest[0]?.id ?? null);
        regenerateBulb(seeded, growthAll);
        setBreedPick(null);
        showStatus(`${TRACK_LABELS[t]} seed generated`);
    }, [applyGenome, cancelPreview, depth, growthAll, regenerateBulb, showStatus]);

    const growForestAction = useCallback((base: TrackGenome = parent, depthOverride: MutationDepth = depth) => {
        cancelPreview();
        const nextForest = makeForest(base, depthOverride);
        setForest(nextForest);
        const first = nextForest[0];
        setSelectedForestId(first?.id ?? null);
        if (first) applyGenome(activeTrack, first);
        showStatus(`${DEPTH_META[depthOverride].label} forest grown and previewing #1`);
    }, [activeTrack, applyGenome, cancelPreview, depth, parent, showStatus]);

    const changeDepth = useCallback((d: MutationDepth) => {
        setDepth(d);
        growForestAction(parent, d);
        setBreedPick(null);
    }, [growForestAction, parent]);

    const newSeed = useCallback(() => {
        const seeded = randomGenome(activeTrack, depth);
        selectGenome(seeded, activeTrack);
        showStatus('New random seed planted');
    }, [activeTrack, depth, selectGenome, showStatus]);

    const toggleFavorite = useCallback((g: TrackGenome) => {
        setFavorites(prev => {
            const exists = prev.some(f => f.id === g.id);
            if (exists) return prev.filter(f => f.id !== g.id);
            return [g, ...prev].slice(0, 32);
        });
    }, []);

    const isFavorite = useCallback((g: TrackGenome) => favorites.some(f => f.id === g.id), [favorites]);

    const handleBreed = useCallback((g: TrackGenome) => {
        cancelPreview();
        if (!breedPick) {
            setBreedPick(g);
            showStatus('First parent marked for breeding');
            return;
        }
        const child = breedGenomes(breedPick, g);
        setBreedPick(null);
        selectGenome(child, activeTrack);
        showStatus('Bred seed planted');
    }, [activeTrack, breedPick, cancelPreview, selectGenome, showStatus]);

    const selectBranch = useCallback((idx: number) => {
        cancelPreview();
        setSelectedBranch(idx);
        const branch = bulbBranches[idx];
        if (branch) {
            applyGenome(activeTrack, branch);
            showStatus(`${NOTE_RING[idx]} branch applied`);
        }
    }, [activeTrack, applyGenome, bulbBranches, cancelPreview, showStatus]);

    const setBranchGrowth = useCallback((idx: number, value: number) => {
        cancelPreview();
        const g = clamp(value, 0, 1);
        const nextGrowth = bulbGrowth.slice();
        nextGrowth[idx] = g;
        const nextBranches = bulbBranches.slice();
        nextBranches[idx] = evolveGenome(parent, g);
        setBulbGrowth(nextGrowth);
        setBulbBranches(nextBranches);
        applyGenome(activeTrack, nextBranches[idx]);
        showStatus(`${NOTE_RING[idx]} branch growth ${g.toFixed(2)}`);
    }, [activeTrack, applyGenome, bulbBranches, bulbGrowth, cancelPreview, parent, showStatus]);

    const replantSelectedBranch = useCallback(() => {
        const branch = bulbBranches[selectedBranch];
        if (!branch) return;
        selectGenome(branch, activeTrack);
        setPage('grow');
        showStatus(`${NOTE_RING[selectedBranch]} replanted as seed`);
    }, [activeTrack, bulbBranches, selectGenome, selectedBranch, showStatus]);

    const updateParent = useCallback((patch: Partial<TrackGenome>) => {
        const next: TrackGenome = { ...parent, ...patch };
        setParent(next);
        applyGenome(activeTrack, next);
        const nextForest = makeForest(next, depth);
        setForest(nextForest);
        setSelectedForestId(nextForest[0]?.id ?? null);
        regenerateBulb(next, growthAll, selectedBranch);
        showStatus('DNA committed to seed');
    }, [activeTrack, applyGenome, depth, growthAll, parent, regenerateBulb, selectedBranch, showStatus]);

    const selectForestVariant = useCallback((g: TrackGenome) => {
        cancelPreview();
        setSelectedForestId(g.id);
        applyGenome(activeTrack, g);
        showStatus('Forest variant applied');
    }, [activeTrack, applyGenome, cancelPreview, showStatus]);

    const handleGenopatchFile = useCallback(async (file: File) => {
        setGenopatchStatus(`Analyzing ${file.name}...`);
        try {
            const buf = await file.arrayBuffer();
            const Ctx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Ctx) throw new Error('AudioContext not available');
            const ctx = new Ctx();
            let audioBuffer: AudioBuffer;
            try {
                audioBuffer = await ctx.decodeAudioData(buf.slice(0));
            } finally {
                void ctx.close?.();
            }

            const features = extractAudioFeatures(audioBuffer);
            const seeded = genomeFromAudio(activeTrack, audioBuffer);
            const candidates: GenopatchCandidate[] = [
                { id: `${seeded.id}_source`, label: 'Strand A', genome: seeded, depth: 'source' },
                { id: `${seeded.id}_gentle`, label: 'Strand B', genome: mutateGenome(seeded, 'gentle'), depth: 'gentle' },
                { id: `${seeded.id}_wild`, label: 'Strand C', genome: mutateGenome(seeded, 'wild'), depth: 'wild' },
                { id: `${seeded.id}_chaos`, label: 'Strand D', genome: mutateGenome(seeded, 'chaos'), depth: 'chaos' },
            ];
            setGenopatchFeatures(features);
            setGenopatchCandidates(candidates);
            setGenopatchStatus('Generated 4 candidate strands');
            applyGenome(activeTrack, seeded);
        } catch (err) {
            console.error('[SynplantGarden] Genopatch failed:', err);
            setGenopatchFeatures(null);
            setGenopatchCandidates([]);
            setGenopatchStatus('Could not decode that file. Try a short WAV, AIFF, MP3, or browser-supported audio file.');
        }
    }, [activeTrack, applyGenome]);

    const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) void handleGenopatchFile(file);
    }, [handleGenopatchFile]);

    const generateRealAudio = useCallback(async () => {
        if (aiGenerating) return;
        setAiGenerating(true);
        setAiMessage(`Generating real ${activeTrack} audio...`);
        try {
            const promptMap: Record<InstrumentType, string> = {
                drums: 'real drums electronic techno 909 kick snare hihat',
                bass: 'real bass synth deep sub bass electronic',
                melody: 'real melody synth lead electronic arpeggios',
                voice: 'real choir angelic voices ethereal orchestral strings',
                fx: 'real ambient pad atmospheric textures',
            };
            const response = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: `real ${activeTrack}: ${promptMap[activeTrack]}` }),
            });
            const data = await response.json();
            if (data.type === 'musicgen' && data.audio_base64) {
                setAiMessage(`Generated real ${activeTrack}.`);
                setTimeout(() => setAiMessage(null), 5000);
            } else {
                setAiMessage('MusicGen server is not available.');
                setTimeout(() => setAiMessage(null), 8000);
            }
        } catch (err) {
            console.error('[SynplantGarden] MusicGen error:', err);
            setAiMessage('Real audio generation failed.');
            setTimeout(() => setAiMessage(null), 5000);
        } finally {
            setAiGenerating(false);
        }
    }, [activeTrack, aiGenerating]);

    const parentSummary = useMemo(() => summarizeGenome(parent), [parent]);
    const selectedGenome = bulbBranches[selectedBranch] ?? parent;
    const selectedSummary = useMemo(() => summarizeGenome(selectedGenome), [selectedGenome]);
    const selectedGrowth = bulbGrowth[selectedBranch] ?? growthAll;
    const currentTrackPattern = state?.tracks?.[activeTrack]?.pattern || genomeToPattern(parent);
    const activePatternPreview = currentTrackPattern.replace(/^expr:/, '');
    const activeFx = useMemo(() => parent.fx ?? defaultFx(parent.trackId), [parent.fx, parent.trackId]);
    const meters = useMemo(() => featureMeters(genopatchFeatures), [genopatchFeatures]);

    const toggleFx = useCallback((tag: GenomeFx) => {
        const next = activeFx.includes(tag)
            ? activeFx.filter(f => f !== tag)
            : [...activeFx, tag];
        updateParent({ fx: next });
    }, [activeFx, updateParent]);

    return (
        <div className="h-full min-h-0 w-full overflow-hidden bg-[#0b0e12] text-slate-100">
            <div className="flex h-full min-h-0 flex-col">
                <header className="shrink-0 border-b border-white/10 bg-[#10151c] px-4 py-3 max-sm:px-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                                <Sprout className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="truncate text-base font-semibold tracking-tight text-white">Synplant Garden</h3>
                                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    {parentSummary.vibe} {parentSummary.synth} seed
                                </p>
                            </div>
                        </div>

                        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-white/10 bg-black/25 p-1 studio-scrollbar">
                            {TRACKS.map(t => {
                                const active = activeTrack === t;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => switchTrack(t)}
                                        className={`h-8 shrink-0 rounded-md px-3 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${active
                                            ? 'bg-cyan-300 text-slate-950'
                                            : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
                                            }`}
                                        aria-pressed={active}
                                    >
                                        {TRACK_LABELS[t]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <nav className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-white/10 bg-black/25 p-1 studio-scrollbar" aria-label="Garden workflow">
                            {PAGE_TABS.map(tab => {
                                const active = page === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setPage(tab.id)}
                                        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors ${active
                                            ? 'bg-slate-100 text-slate-950'
                                            : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
                                            }`}
                                        aria-pressed={active}
                                    >
                                        {tab.icon}
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>

                        <div className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 max-md:w-full max-md:flex-none">
                            {actionStatus}
                        </div>
                    </div>
                </header>

                <main className="min-h-0 flex-1 overflow-hidden p-3">
                    {page === 'grow' && (
                        <div className="studio-scrollbar grid h-full min-h-0 gap-3 overflow-y-auto md:grid-cols-[minmax(290px,0.82fr)_minmax(340px,1.18fr)] md:overflow-hidden">
                            <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0d1218] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] md:min-h-0">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Seed bulb</div>
                                        <h4 className="truncate text-sm font-semibold text-white">
                                            {TRACK_LABELS[activeTrack]} / {parentSummary.vibe} {parentSummary.synth}
                                        </h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={newSeed}
                                        className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
                                    >
                                        <Shuffle className="h-3.5 w-3.5" />
                                        New Seed
                                    </button>
                                </div>

                                <div className="flex min-h-0 flex-1 items-center justify-center">
                                    <div className="relative aspect-square w-full max-w-[390px] rounded-full border border-cyan-300/10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.15),transparent_18%),radial-gradient(circle_at_center,rgba(0,0,0,0.45),rgba(2,6,23,0.94)_68%)] shadow-[inset_0_0_80px_rgba(0,0,0,0.7),0_24px_50px_rgba(0,0,0,0.32)]">
                                        <div className="absolute inset-[10%] rounded-full border border-white/8" />
                                        <div className="absolute inset-[26%] rounded-full border border-white/6" />
                                        <button
                                            type="button"
                                            onClick={() => selectGenome(parent, activeTrack)}
                                            className="absolute left-1/2 top-1/2 z-10 flex h-18 w-18 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-cyan-300/55 bg-cyan-300/12 text-cyan-100 shadow-[0_0_34px_rgba(34,211,238,0.3)] transition-transform hover:scale-105 max-sm:h-16 max-sm:w-16"
                                        >
                                            <Sprout className="h-5 w-5" />
                                            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em]">Seed</span>
                                        </button>

                                        {bulbBranches.map((g, idx) => {
                                            const angle = (idx / NOTE_RING.length) * Math.PI * 2 - Math.PI / 2;
                                            const radius = 42;
                                            const x = 50 + radius * Math.cos(angle);
                                            const y = 50 + radius * Math.sin(angle);
                                            const summary = summarizeGenome(g);
                                            const picked = idx === selectedBranch;
                                            const growth = bulbGrowth[idx] ?? 0;
                                            return (
                                                <button
                                                    key={`${g.id}-${idx}`}
                                                    type="button"
                                                    onClick={() => selectBranch(idx)}
                                                    onMouseEnter={() => previewGenome(g, activeTrack)}
                                                    onMouseLeave={() => clearPreview(g.id)}
                                                    className={`absolute flex h-13 w-13 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border text-center transition-all max-sm:h-11 max-sm:w-11 ${picked
                                                        ? 'border-fuchsia-300 bg-fuchsia-300/16 text-fuchsia-50 shadow-[0_0_28px_rgba(217,70,239,0.42)]'
                                                        : 'border-white/12 bg-black/55 text-slate-400 hover:border-cyan-300/50 hover:text-cyan-100'
                                                        }`}
                                                    style={{ left: `${x}%`, top: `${y}%` }}
                                                    title={`${NOTE_RING[idx]} ${summary.vibe} ${summary.synth}`}
                                                >
                                                    <span className="text-[11px] font-semibold">{NOTE_RING[idx]}</span>
                                                    <span className="max-w-[44px] truncate text-[9px] opacity-70">{summary.vibe}</span>
                                                    <span
                                                        className="absolute -bottom-1 h-1 rounded-full bg-fuchsia-300/70"
                                                        style={{ width: `${Math.max(10, growth * 36)}px` }}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section>

                            <section className="flex min-h-[520px] flex-col gap-3 overflow-hidden md:min-h-0">
                                <div className="shrink-0 rounded-lg border border-white/10 bg-[#0d1218] p-3">
                                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-300">Selected branch</div>
                                            <h4 className="mt-1 truncate text-lg font-semibold text-white">
                                                {NOTE_RING[selectedBranch]} / {selectedSummary.vibe} {selectedSummary.synth}
                                            </h4>
                                            <p className="mt-1 truncate font-mono text-xs text-cyan-500">{selectedGenome.notes}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => selectBranch(selectedBranch)}
                                                className="h-9 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-100 transition-colors hover:border-cyan-200/50"
                                            >
                                                Apply
                                            </button>
                                            <button
                                                type="button"
                                                onClick={replantSelectedBranch}
                                                className="h-9 rounded-md border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 text-xs font-semibold text-fuchsia-100 transition-colors hover:border-fuchsia-200/50"
                                            >
                                                Replant
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                                        <label className="rounded-md border border-white/8 bg-black/25 p-3">
                                            <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                                Branch growth
                                                <span className="font-mono text-fuchsia-200">{selectedGrowth.toFixed(2)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={selectedGrowth}
                                                onChange={(e) => setBranchGrowth(selectedBranch, parseFloat(e.currentTarget.value))}
                                                className="studio-range w-full accent-fuchsia-300"
                                            />
                                        </label>

                                        <div className="rounded-md border border-white/8 bg-black/25 p-3">
                                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Mutation depth</div>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {(Object.keys(DEPTH_META) as MutationDepth[]).map(d => (
                                                    <button
                                                        key={d}
                                                        type="button"
                                                        onClick={() => changeDepth(d)}
                                                        title={DEPTH_META[d].description}
                                                        className={`flex h-8 items-center justify-center gap-1 rounded-md border text-xs font-semibold transition-colors ${depth === d
                                                            ? DEPTH_META[d].accent
                                                            : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-200'
                                                            }`}
                                                    >
                                                        {DEPTH_META[d].icon}
                                                        {DEPTH_META[d].label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0d1218] p-3">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-sm font-semibold text-white">Mutation Forest</h4>
                                            <p className="text-xs text-slate-500">{forest.length} variants / {DEPTH_META[depth].label.toLowerCase()} depth</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => growForestAction(parent, depth)}
                                            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-300/35 hover:text-cyan-100"
                                        >
                                            <Zap className="h-3.5 w-3.5" />
                                            Grow Forest
                                        </button>
                                    </div>

                                    <div className="studio-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                                        <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                                            {forest.map((g, idx) => {
                                                const summary = summarizeGenome(g);
                                                const fav = isFavorite(g);
                                                const picked = selectedForestId === g.id;
                                                const breedSelected = breedPick?.id === g.id;
                                                return (
                                                    <div
                                                        key={g.id}
                                                        className={`group rounded-lg border bg-black/24 p-2.5 transition-colors ${picked
                                                            ? 'border-cyan-300/60 bg-cyan-300/10'
                                                            : breedSelected
                                                                ? 'border-fuchsia-300/60 bg-fuchsia-300/12'
                                                                : 'border-white/10 hover:border-cyan-300/35 hover:bg-cyan-300/6'
                                                            }`}
                                                    >
                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                            <span className="font-mono text-[10px] text-slate-600">#{idx + 1}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleFavorite(g)}
                                                                className={`rounded p-1 transition-colors ${fav ? 'text-amber-300' : 'text-slate-600 hover:text-amber-200'}`}
                                                                title={fav ? 'Saved' : 'Save'}
                                                            >
                                                                <Star className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => selectForestVariant(g)}
                                                            onMouseEnter={() => previewGenome(g, activeTrack)}
                                                            onMouseLeave={() => clearPreview(g.id)}
                                                            className="block w-full text-left"
                                                        >
                                                            <div className="truncate text-sm font-semibold text-white">{summary.vibe} {summary.synth}</div>
                                                            <div className="mt-1 truncate font-mono text-[11px] text-cyan-500">{miniPattern(g)}</div>
                                                            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
                                                                <span>density {summary.density}</span>
                                                                <span>room {summary.room}</span>
                                                            </div>
                                                        </button>
                                                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleBreed(g)}
                                                                className="rounded-md border border-fuchsia-300/25 bg-fuchsia-300/8 py-1.5 text-[11px] font-semibold text-fuchsia-200 transition-colors hover:border-fuchsia-200/50"
                                                            >
                                                                {breedPick ? 'Breed' : 'Mark'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => selectGenome(g, activeTrack)}
                                                                className="rounded-md border border-white/10 bg-white/[0.03] py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:border-cyan-300/35 hover:text-cyan-100"
                                                            >
                                                                Plant
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {page === 'dna' && (
                        <div className="studio-scrollbar grid h-full min-h-0 gap-3 overflow-y-auto lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
                            <section className="rounded-lg border border-white/10 bg-[#0d1218] p-4">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">DNA editor</div>
                                        <h4 className="mt-1 text-lg font-semibold text-white">{parentSummary.vibe} {parentSummary.synth}</h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => selectGenome(parent, activeTrack)}
                                        className="h-9 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-100 transition-colors hover:border-cyan-200/50"
                                    >
                                        Commit DNA
                                    </button>
                                </div>

                                <label className="block text-xs font-medium text-slate-400">
                                    Notes
                                    <textarea
                                        value={parent.notes}
                                        onChange={(e) => updateParent({ notes: e.currentTarget.value })}
                                        rows={5}
                                        className="studio-scrollbar mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/45 p-3 font-mono text-sm text-white outline-none transition-colors focus:border-cyan-300/45"
                                    />
                                </label>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <label className="text-xs font-medium text-slate-400">
                                        Synth
                                        <select
                                            value={parent.synth}
                                            onChange={(e) => updateParent({ synth: e.currentTarget.value })}
                                            className="mt-2 w-full rounded-lg border border-white/10 bg-black/45 p-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/45"
                                        >
                                            {['sine', 'triangle', 'square', 'sawtooth', 'pink'].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </label>

                                    {(activeTrack === 'voice' || activeTrack === 'fx') && (
                                        <label className="text-xs font-medium text-slate-400">
                                            Vowel
                                            <select
                                                value={parent.vowel}
                                                onChange={(e) => updateParent({ vowel: e.currentTarget.value })}
                                                className="mt-2 w-full rounded-lg border border-white/10 bg-black/45 p-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/45"
                                            >
                                                {['a', 'e', 'i', 'o', 'u'].map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                </div>

                                <div className="mt-4">
                                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-300">FX genes</div>
                                    <div className="flex flex-wrap gap-2">
                                        {FX_OPTIONS.map(opt => {
                                            const enabled = activeFx.includes(opt.id);
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => toggleFx(opt.id)}
                                                    className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${enabled
                                                        ? 'border-cyan-300/55 bg-cyan-300/12 text-cyan-100'
                                                        : 'border-white/10 bg-white/[0.03] text-slate-500 hover:border-cyan-300/35 hover:text-cyan-100'
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-lg border border-white/10 bg-[#0d1218] p-4">
                                <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-300">Macro genes</div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {MACRO_CONTROLS.map(({ key, label, min, max, step, accent }) => {
                                        const value = parent[key];
                                        return (
                                            <label key={key} className="rounded-lg border border-white/8 bg-black/24 p-3 text-xs font-medium text-slate-400">
                                                <div className="mb-2 flex justify-between">
                                                    <span>{label}</span>
                                                    <span className="font-mono text-slate-500">{value.toFixed(2)}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={min}
                                                    max={max}
                                                    step={step}
                                                    value={value}
                                                    onChange={(e) => updateParent({ [key]: parseFloat(e.currentTarget.value) } as Partial<TrackGenome>)}
                                                    className={`studio-range w-full ${accent}`}
                                                />
                                            </label>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 rounded-lg border border-white/8 bg-black/24 p-3">
                                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Current pattern</div>
                                    <div className="studio-scrollbar max-h-32 overflow-y-auto font-mono text-xs leading-5 text-slate-500">
                                        {activePatternPreview}
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {page === 'genopatch' && (
                        <div className="studio-scrollbar grid h-full min-h-0 gap-3 overflow-y-auto xl:grid-cols-[minmax(300px,0.78fr)_1.22fr]">
                            <section className="rounded-lg border border-white/10 bg-[#0d1218] p-4">
                                <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                                    <Upload className="h-4 w-4" />
                                    Genopatch
                                </div>
                                <label
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={handleDrop}
                                    className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-cyan-300/35 bg-cyan-300/8 p-5 text-center transition-colors hover:border-cyan-200/60 hover:bg-cyan-300/12"
                                >
                                    <Upload className="h-8 w-8 text-cyan-200" />
                                    <span className="mt-3 text-sm font-semibold text-white">Load reference audio</span>
                                    <span className="mt-1 text-xs leading-5 text-slate-500">Drop a short sample here or browse from disk.</span>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="audio/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) void handleGenopatchFile(file);
                                            e.currentTarget.value = '';
                                        }}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-3 h-9 w-full rounded-md border border-white/10 bg-white/[0.03] text-sm font-semibold text-slate-300 transition-colors hover:border-cyan-300/35 hover:text-cyan-100"
                                >
                                    Browse Audio
                                </button>

                                <div className="mt-4 rounded-lg border border-white/8 bg-black/24 p-3 text-sm text-slate-400">
                                    {genopatchStatus}
                                </div>

                                {meters.length > 0 && (
                                    <div className="mt-4 grid gap-2">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Feature summary</div>
                                        {meters.map(item => (
                                            <div key={item.label}>
                                                <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                                    <span>{item.label}</span>
                                                    <span>{item.readout}</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-black/45">
                                                    <div className="h-full rounded-full bg-cyan-300" style={{ width: meter(item.value) }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="flex min-h-[360px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0d1218] p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-semibold text-white">Candidate strands</h4>
                                        <p className="text-xs text-slate-500">{genopatchCandidates.length || 0} generated patches</p>
                                    </div>
                                </div>
                                <div className="studio-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                                    {genopatchCandidates.length === 0 ? (
                                        <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-sm text-slate-500">
                                            Candidate strands appear here after audio analysis.
                                        </div>
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {genopatchCandidates.map(candidate => {
                                                const summary = summarizeGenome(candidate.genome);
                                                const fav = isFavorite(candidate.genome);
                                                return (
                                                    <div key={candidate.id} className="rounded-lg border border-white/10 bg-black/24 p-3">
                                                        <div className="mb-3 flex items-start justify-between gap-3">
                                                            <div>
                                                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">{candidate.label}</div>
                                                                <div className="mt-1 text-base font-semibold text-white">{summary.vibe} {summary.synth}</div>
                                                                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                                                    {candidate.depth === 'source' ? 'Source strand' : `${DEPTH_META[candidate.depth].label} mutation`}
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleFavorite(candidate.genome)}
                                                                className={`rounded p-1 transition-colors ${fav ? 'text-amber-300' : 'text-slate-600 hover:text-amber-200'}`}
                                                                title={fav ? 'Saved' : 'Save'}
                                                            >
                                                                <Star className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        <div className="truncate font-mono text-[11px] text-cyan-500">{miniPattern(candidate.genome)}</div>
                                                        <div className="mt-3 grid grid-cols-3 gap-2">
                                                            <button
                                                                type="button"
                                                                onMouseEnter={() => previewGenome(candidate.genome, activeTrack)}
                                                                onMouseLeave={() => clearPreview(candidate.genome.id)}
                                                                onClick={() => {
                                                                    applyGenome(activeTrack, candidate.genome);
                                                                    setGenopatchStatus(`${candidate.label} applied to ${TRACK_LABELS[activeTrack]}`);
                                                                }}
                                                                className="rounded-md border border-cyan-300/30 bg-cyan-300/10 py-2 text-[11px] font-semibold text-cyan-100 transition-colors hover:border-cyan-200/50"
                                                            >
                                                                Preview
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleFavorite(candidate.genome)}
                                                                className="rounded-md border border-amber-300/25 bg-amber-300/10 py-2 text-[11px] font-semibold text-amber-100 transition-colors hover:border-amber-200/50"
                                                            >
                                                                {fav ? 'Saved' : 'Save'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    selectGenome(candidate.genome, activeTrack);
                                                                    setPage('grow');
                                                                }}
                                                                className="rounded-md border border-fuchsia-300/30 bg-fuchsia-300/10 py-2 text-[11px] font-semibold text-fuchsia-100 transition-colors hover:border-fuchsia-200/50"
                                                            >
                                                                Replant
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {page === 'perform' && (
                        <div className="studio-scrollbar grid h-full min-h-0 gap-3 overflow-y-auto xl:grid-cols-[1fr_0.9fr]">
                            <section className="rounded-lg border border-fuchsia-300/20 bg-[#0d1218] p-4">
                                <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200">
                                    <Zap className="h-4 w-4" />
                                    Build-ups / drops
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {BUILD_UP_PRESETS.map(preset => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => onApplyPattern('fx', `expr:${preset.pattern}`)}
                                            title={preset.description}
                                            className="rounded-lg border border-fuchsia-300/25 bg-black/24 p-3 text-left transition-colors hover:border-fuchsia-200/50 hover:bg-fuchsia-300/10"
                                        >
                                            <div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-100">
                                                {preset.icon}
                                                {preset.label}
                                            </div>
                                            <div className="mt-1 text-xs text-fuchsia-200/55">{preset.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-lg border border-orange-300/20 bg-[#0d1218] p-4">
                                <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-200">
                                    <Radio className="h-4 w-4" />
                                    Transition tools
                                </div>
                                {!sweepActive ? (
                                    <button
                                        type="button"
                                        onClick={() => startTransitionSweep('main', 8, state?.bpm || 128)}
                                        title="Start HPF sweep"
                                        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-orange-300/35 bg-orange-300/12 text-sm font-semibold text-orange-100 transition-colors hover:border-orange-200/60"
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                        Sweep Out
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => cancelTransitionSweep()}
                                        title="Release the filter"
                                        className="flex h-11 w-full animate-pulse items-center justify-center gap-2 rounded-lg border border-red-300/55 bg-red-400/25 text-sm font-bold text-red-50 transition-colors hover:border-red-200/70"
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                        Drop It
                                    </button>
                                )}

                                <div className="mt-4 flex items-center gap-3">
                                    <div className="h-3 flex-1 overflow-hidden rounded-full border border-white/10 bg-black/35">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-orange-400 via-fuchsia-400 to-red-400 transition-all duration-100"
                                            style={{ width: `${sweepProgress * 100}%` }}
                                        />
                                    </div>
                                    <span className="w-12 text-right font-mono text-sm text-orange-200 tabular-nums">{Math.round(sweepProgress * 100)}%</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={generateRealAudio}
                                    disabled={aiGenerating}
                                    className={`mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors ${aiGenerating
                                        ? 'cursor-wait border-violet-300/50 bg-violet-300/15 text-violet-100'
                                        : 'border-violet-300/30 bg-violet-300/10 text-violet-200 hover:border-violet-200/50 hover:bg-violet-300/15'
                                        }`}
                                    title="Generate real instrument audio using MusicGen AI"
                                >
                                    <Wand2 className="h-4 w-4" />
                                    {aiGenerating ? 'Generating' : 'Real Audio'}
                                </button>

                                {aiMessage && (
                                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-violet-300/30 bg-violet-300/10 px-3 py-2 text-sm font-medium text-violet-100">
                                        <Music2 className="h-4 w-4 animate-pulse" />
                                        {aiMessage}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </main>

                {favorites.length > 0 && (
                    <footer className="shrink-0 border-t border-white/10 bg-[#10151c] px-3 py-2">
                        <div className="flex items-center gap-3">
                            <div className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300 sm:block">Garden Shelf</div>
                            <div className="studio-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                                {favorites.map((g) => {
                                    const summary = summarizeGenome(g);
                                    const isActive = parent.id === g.id;
                                    return (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => selectGenome(g, g.trackId)}
                                            onMouseEnter={() => previewGenome(g, g.trackId)}
                                            onMouseLeave={() => clearPreview(g.id)}
                                            className={`shrink-0 rounded-md border px-2.5 py-1.5 text-left transition-colors ${isActive
                                                ? 'border-cyan-300/55 bg-cyan-300/12 text-cyan-100'
                                                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-cyan-300/35 hover:text-cyan-100'
                                                }`}
                                        >
                                            <div className="text-xs font-semibold">{summary.vibe} {summary.synth}</div>
                                            <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-slate-600">{TRACK_LABELS[g.trackId]}</div>
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={() => { setFavorites([]); saveFavorites([]); }}
                                className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs font-semibold text-slate-500 transition-colors hover:border-rose-300/30 hover:text-rose-300"
                            >
                                <Save className="h-3.5 w-3.5" />
                                Clear
                            </button>
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
}
