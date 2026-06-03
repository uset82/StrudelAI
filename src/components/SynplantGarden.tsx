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
import { genomeFromAudio } from '@/lib/synplant/genopatch';
import {
    startTransitionSweep,
    cancelTransitionSweep,
    isTransitionSweepActive,
    getTransitionSweepProgress
} from '@/lib/strudel/engine';
import { ArrowUp, ArrowDown, ChevronDown, Flame, Radio, Shuffle, Skull, Sparkles, Sprout, Star, Upload, Zap, Waves, Gauge, Music2, Wand2 } from 'lucide-react';

// Quick one-click build-up/drop patterns for the FX track - Professional DJ tools
const BUILD_UP_PRESETS: Array<{ id: string; label: string; icon: React.ReactNode; pattern: string; description: string }> = [
    {
        id: 'riser',
        label: 'Riser',
        icon: <ArrowUp className="w-3 h-3" />,
        // Layered noise riser with evolving texture - builds over 8 bars
        pattern: "stack(s(\"pink\").hpf(sine.range(200, 15000).slow(8)).gain(sine.range(0.05, 0.55).slow(8)), note(m(\"c5 c5 c5 c5 c5 c5 c5 c5\")).s(\"square\").hpf(2000).decay(0.02).fast(sine.range(0.5, 8).slow(8)).gain(sine.range(0.05, 0.35).slow(8)))",
        description: 'Full noise riser - 8 bar build'
    },
    {
        id: 'drop',
        label: 'Drop',
        icon: <ArrowDown className="w-3 h-3" />,
        // Punchy sub hit with layered impact - plays once with long decay
        pattern: "stack(note(m(\"c1\")).s(\"sine\").att(0.001).decay(1.2).lpf(80).gain(1.0), note(m(\"c2\")).s(\"square\").att(0.001).decay(0.3).lpf(200).gain(0.5), s(\"pink\").hpf(50).lpf(200).decay(0.4).gain(0.6)).slow(8)",
        description: 'Sub bass impact - THE drop'
    },
    {
        id: 'sweep',
        label: 'Sweep',
        icon: <Waves className="w-3 h-3" />,
        // Classic resonant filter sweep - sounds like a DJ transition
        pattern: "note(m(\"c3 c3 c3 c3\")).s(\"sawtooth\").lpf(sine.range(150, 6000).slow(4)).resonance(18).distort(0.1).room(0.15).gain(0.45)",
        description: 'Resonant filter sweep'
    },
    {
        id: 'tension',
        label: 'Tension',
        icon: <Gauge className="w-3 h-3" />,
        // Accelerating snare roll for tension build
        pattern: "stack(note(m(\"c5*16\")).s(\"pink\").hpf(1500).decay(0.01).fast(sine.range(0.5, 4).slow(4)).gain(sine.range(0.2, 0.6).slow(4)), s(\"pink\").hpf(sine.range(400, 8000).slow(4)).gain(sine.range(0.1, 0.3).slow(4)))",
        description: 'Snare roll build-up'
    },
    {
        id: 'downlifter',
        label: 'Downlifter',
        icon: <ArrowDown className="w-3 h-3" />,
        // Reverse cymbal effect - smooth transition out
        pattern: "stack(s(\"pink\").hpf(sine.range(12000, 150).slow(2)).gain(sine.range(0.5, 0.05).slow(2)), note(m(\"c6\")).s(\"sine\").hpf(sine.range(8000, 200).slow(2)).decay(0.01).gain(sine.range(0.3, 0.05).slow(2)))",
        description: 'Reverse cymbal - 2 bar fade'
    },
    {
        id: 'pitchrise',
        label: 'Pitch Rise',
        icon: <ArrowUp className="w-3 h-3" />,
        // Musical pitch riser with filter - classic EDM tool
        pattern: "note(m(\"c3 d3 e3 f3 g3 a3 b3 c4 d4 e4 f4 g4 a4 b4 c5 c5\")).s(\"supersaw\").att(0.01).decay(0.1).lpf(sine.range(800, 8000).slow(4)).resonance(10).room(0.3).gain(sine.range(0.2, 0.55).slow(4)).slow(2)",
        description: 'Ascending pitch rise'
    },
];

interface SynplantGardenProps {
    state: SonicSessionState | null;
    onApplyPattern: (trackId: InstrumentType, pattern: string) => void;
}

const DEPTH_LABELS: Record<MutationDepth, { label: string; icon: React.ReactNode; className: string }> = {
    gentle: { label: 'Gentle', icon: <Sprout className="w-3 h-3" />, className: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
    wild: { label: 'Wild', icon: <Sparkles className="w-3 h-3" />, className: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10' },
    chaos: { label: 'Chaos', icon: <Skull className="w-3 h-3" />, className: 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10' },
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
const PAGE_TABS: Array<{ id: 'grow' | 'tweak' | 'dj'; label: string; icon: React.ReactNode }> = [
    { id: 'grow', label: 'Grow', icon: <Sprout className="w-3 h-3" /> },
    { id: 'tweak', label: 'Tweak', icon: <Gauge className="w-3 h-3" /> },
    { id: 'dj', label: 'DJ', icon: <Radio className="w-3 h-3" /> },
];
const FX_OPTIONS: Array<{ id: GenomeFx; label: string }> = [
    { id: 'filter', label: 'Filter' },
    { id: 'reverb', label: 'Reverb' },
    { id: 'delay', label: 'Delay' },
    { id: 'neuro', label: 'Neuro' },
];

function loadFavorites(): TrackGenome[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem('synplant:favorites');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as TrackGenome[];
        return [];
    } catch {
        return [];
    }
}

function saveFavorites(favs: TrackGenome[]) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem('synplant:favorites', JSON.stringify(favs));
    } catch { /* ignore */ }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function SynplantGarden({ state, onApplyPattern }: SynplantGardenProps) {
    const initialGarden = useMemo(() => {
        const seeded = randomGenome('voice', 'wild');
        const forest = Array.from({ length: 9 }, () => mutateGenome(seeded, 'wild'));
        const growthAll = 0.45;
        const bulbGrowth = NOTE_RING.map(() => growthAll);
        const bulbBranches = NOTE_RING.map(() => evolveGenome(seeded, growthAll));
        return { seeded, forest, bulbBranches, bulbGrowth, growthAll };
    }, []);

    const [page, setPage] = useState<'grow' | 'tweak' | 'dj'>('grow');
    const [activeTrack, setActiveTrack] = useState<InstrumentType>('voice');
    const [depth, setDepth] = useState<MutationDepth>('wild');
    const [parent, setParent] = useState<TrackGenome>(initialGarden.seeded);
    const [forest, setForest] = useState<TrackGenome[]>(initialGarden.forest);

    const [bulbBranches, setBulbBranches] = useState<TrackGenome[]>(initialGarden.bulbBranches);
    const [bulbGrowth, setBulbGrowth] = useState<number[]>(initialGarden.bulbGrowth);
    const [growthAll, setGrowthAll] = useState(initialGarden.growthAll);
    const [selectedBranch, setSelectedBranch] = useState(0);

    const [favorites, setFavorites] = useState<TrackGenome[]>(() => loadFavorites());
    const [breedPick, setBreedPick] = useState<TrackGenome | null>(null);
    const [sweepActive, setSweepActive] = useState(false);
    const [sweepProgress, setSweepProgress] = useState(0);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiMessage, setAiMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const previewRef = useRef<{ trackId: InstrumentType; pattern: string } | null>(null);
    const previewIdRef = useRef<string | null>(null);

    // Generate real audio using MusicGen AI
    const generateRealAudio = useCallback(async () => {
        if (aiGenerating) return;

        setAiGenerating(true);
        setAiMessage(`Generating real ${activeTrack} audio... (this may take 20-30 seconds)`);

        try {
            // Build a descriptive prompt based on track type
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
                body: JSON.stringify({
                    prompt: `real ${activeTrack}: ${promptMap[activeTrack]}`,
                }),
            });

            const data = await response.json();

            if (data.type === 'musicgen' && data.audio_base64) {
                setAiMessage(`✅ Generated real ${activeTrack}! Playing now...`);
                // The audio will be played by the socket handler
                setTimeout(() => setAiMessage(null), 5000);
            } else {
                setAiMessage(`⚠️ MusicGen server not available. Start it with: python tools/musicgen_server.py`);
                setTimeout(() => setAiMessage(null), 8000);
            }
        } catch (err) {
            console.error('[SynplantGarden] MusicGen error:', err);
            setAiMessage(`❌ Failed to generate audio. Is MusicGen server running?`);
            setTimeout(() => setAiMessage(null), 5000);
        } finally {
            setAiGenerating(false);
        }
    }, [activeTrack, aiGenerating]);

    // Track sweep state with polling
    useEffect(() => {
        const checkSweep = () => {
            const active = isTransitionSweepActive();
            setSweepActive(active);
            if (active) {
                setSweepProgress(getTransitionSweepProgress());
            } else {
                setSweepProgress(0);
            }
        };

        const id = setInterval(checkSweep, 100);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        saveFavorites(favorites);
    }, [favorites]);

    const growForest = useCallback((base: TrackGenome, depthOverride: MutationDepth = depth) => {
        const next = Array.from({ length: 9 }, () => mutateGenome(base, depthOverride));
        setForest(next);
    }, [depth]);

    const regenBulb = useCallback((base: TrackGenome, growthValue: number) => {
        const g = clamp(growthValue, 0, 1);
        const nextGrowth = NOTE_RING.map(() => g);
        const nextBranches = NOTE_RING.map(() => evolveGenome(base, g));
        setGrowthAll(g);
        setBulbGrowth(nextGrowth);
        setBulbBranches(nextBranches);
        setSelectedBranch(0);
    }, []);

    const applyGenome = useCallback((trackId: InstrumentType, g: TrackGenome) => {
        onApplyPattern(trackId, genomeToPattern(g));
    }, [onApplyPattern]);

    const cancelPreview = useCallback(() => {
        previewRef.current = null;
        previewIdRef.current = null;
    }, []);

    const previewGenome = useCallback((g: TrackGenome) => {
        if (!previewRef.current) {
            previewRef.current = {
                trackId: activeTrack,
                pattern: state?.tracks?.[activeTrack]?.pattern || genomeToPattern(parent),
            };
        }
        previewIdRef.current = g.id;
        // Gentle jitter on hover for that Synplant "alive" feel
        const jittered = mutateGenome(g, 'gentle');
        applyGenome(activeTrack, jittered);
    }, [activeTrack, state, parent, applyGenome]);

    const clearPreview = useCallback((id?: string) => {
        if (!previewRef.current) return;
        if (id && previewIdRef.current && previewIdRef.current !== id) return;
        onApplyPattern(previewRef.current.trackId, previewRef.current.pattern);
        previewRef.current = null;
        previewIdRef.current = null;
    }, [onApplyPattern]);

    const selectGenome = useCallback((g: TrackGenome, trackOverride: InstrumentType = activeTrack) => {
        cancelPreview();
        if (trackOverride !== activeTrack) {
            setActiveTrack(trackOverride);
        }
        setParent(g);
        applyGenome(trackOverride, g);
        growForest(g, depth);
        regenBulb(g, growthAll);
        setBreedPick(null);
    }, [activeTrack, applyGenome, growForest, depth, regenBulb, growthAll, cancelPreview]);

    const switchTrack = useCallback((t: InstrumentType) => {
        cancelPreview();
        const seeded = randomGenome(t, depth);
        setActiveTrack(t);
        setParent(seeded);
        applyGenome(t, seeded);
        growForest(seeded, depth);
        regenBulb(seeded, growthAll);
        setBreedPick(null);
    }, [depth, applyGenome, growForest, regenBulb, growthAll, cancelPreview]);

    const changeDepth = useCallback((d: MutationDepth) => {
        cancelPreview();
        setDepth(d);
        growForest(parent, d);
        regenBulb(parent, growthAll);
        setBreedPick(null);
    }, [growForest, parent, regenBulb, growthAll, cancelPreview]);

    const newSeed = useCallback(() => {
        cancelPreview();
        const seeded = randomGenome(activeTrack, depth);
        selectGenome(seeded, activeTrack);
    }, [activeTrack, depth, selectGenome, cancelPreview]);

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
            return;
        }
        const child = breedGenomes(breedPick, g);
        setBreedPick(null);
        selectGenome(child, activeTrack);
    }, [breedPick, selectGenome, activeTrack, cancelPreview]);

    const selectBranch = useCallback((idx: number) => {
        cancelPreview();
        setSelectedBranch(idx);
        applyGenome(activeTrack, bulbBranches[idx]);
    }, [applyGenome, activeTrack, bulbBranches, cancelPreview]);

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
    }, [bulbGrowth, bulbBranches, parent, applyGenome, activeTrack, cancelPreview]);

    const setAllGrowth = useCallback((value: number) => {
        cancelPreview();
        const g = clamp(value, 0, 1);
        setGrowthAll(g);
        const nextGrowth = NOTE_RING.map(() => g);
        const nextBranches = NOTE_RING.map(() => evolveGenome(parent, g));
        setBulbGrowth(nextGrowth);
        setBulbBranches(nextBranches);
        applyGenome(activeTrack, nextBranches[selectedBranch]);
    }, [parent, applyGenome, activeTrack, selectedBranch, cancelPreview]);

    const replantSelectedBranch = useCallback(() => {
        const branch = bulbBranches[selectedBranch];
        selectGenome(branch, activeTrack);
        setPage('grow');
    }, [bulbBranches, selectedBranch, selectGenome, activeTrack]);

    const updateParent = useCallback((patch: Partial<TrackGenome>) => {
        const next: TrackGenome = { ...parent, ...patch };
        setParent(next);
        applyGenome(activeTrack, next);
        growForest(next, depth);
        regenBulb(next, growthAll);
    }, [parent, applyGenome, activeTrack, growForest, depth, regenBulb, growthAll]);

    const handleGenopatchFile = useCallback(async (file: File) => {
        try {
            const buf = await file.arrayBuffer();
            const Ctx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Ctx) throw new Error('AudioContext not available');
            const ctx = new Ctx();
            const audioBuffer: AudioBuffer = await ctx.decodeAudioData(buf.slice(0));
            ctx.close?.();

            const seeded = genomeFromAudio(activeTrack, audioBuffer);
            selectGenome(seeded, activeTrack);
            setPage('grow');
        } catch (err) {
            console.error('[SynplantGarden] Genopatch failed:', err);
        }
    }, [activeTrack, selectGenome]);

    const parentSummary = useMemo(() => summarizeGenome(parent), [parent]);
    const currentTrackPattern = state?.tracks?.[activeTrack]?.pattern || '';
    const selectedGenome = bulbBranches[selectedBranch] ?? parent;
    const selectedSummary = useMemo(() => summarizeGenome(selectedGenome), [selectedGenome]);
    const selectedGrowth = bulbGrowth[selectedBranch] ?? growthAll;
    const activePatternPreview = currentTrackPattern.replace(/^expr:/, '');
    const activeFx = useMemo(
        () => parent.fx ?? defaultFx(parent.trackId),
        [parent.fx, parent.trackId]
    );
    const toggleFx = useCallback((tag: GenomeFx) => {
        const next = activeFx.includes(tag)
            ? activeFx.filter(f => f !== tag)
            : [...activeFx, tag];
        updateParent({ fx: next });
    }, [activeFx, updateParent]);

    return (
        <div className="studio-scrollbar h-full w-full overflow-y-auto bg-[radial-gradient(circle_at_50%_-10%,rgba(34,211,238,0.12),transparent_34%),linear-gradient(180deg,#10151c_0%,#0b0e12_100%)] p-4 text-slate-100 max-lg:p-3">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
                <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.12)]">
                            <Sprout className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold tracking-tight text-white">Synplant Garden</h3>
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Pattern genetics</p>
                        </div>
                    </div>

                    <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-white/10 bg-black/25 p-1 studio-scrollbar">
                        {TRACKS.map(t => {
                            const active = activeTrack === t;
                            return (
                                <button
                                    key={t}
                                    onClick={() => switchTrack(t)}
                                    className={`h-9 shrink-0 rounded-md px-3 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${active
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
                </header>

                <section className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap gap-2">
                        {PAGE_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setPage(tab.id)}
                                className={`flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${page === tab.id
                                    ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100'
                                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-cyan-300/30 hover:text-cyan-100'
                                    }`}
                                aria-pressed={page === tab.id}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {(Object.keys(DEPTH_LABELS) as MutationDepth[]).map(d => (
                            <button
                                key={d}
                                onClick={() => changeDepth(d)}
                                className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors ${depth === d
                                    ? DEPTH_LABELS[d].className
                                    : 'border-white/10 bg-white/[0.025] text-slate-500 hover:border-white/20 hover:text-slate-200'
                                    }`}
                            >
                                {DEPTH_LABELS[d].icon}
                                {DEPTH_LABELS[d].label}
                            </button>
                        ))}
                    </div>

                    <div className="ml-auto flex flex-wrap justify-end gap-2 max-lg:ml-0">
                        <button
                            onClick={newSeed}
                            className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-300 transition-colors hover:border-cyan-300/35 hover:text-cyan-100"
                        >
                            <Shuffle className="h-4 w-4" />
                            New Seed
                        </button>
                        <button
                            onClick={() => growForest(parent, depth)}
                            className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-300 transition-colors hover:border-fuchsia-300/35 hover:text-fuchsia-100"
                        >
                            <Zap className="h-4 w-4" />
                            Grow Forest
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-300 transition-colors hover:border-emerald-300/35 hover:text-emerald-100"
                            title="Genopatch from audio sample"
                        >
                            <Upload className="h-4 w-4" />
                            Genopatch
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleGenopatchFile(file);
                                e.currentTarget.value = '';
                            }}
                        />
                        <button
                            onClick={generateRealAudio}
                            disabled={aiGenerating}
                            className={`flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${aiGenerating
                                ? 'cursor-wait border-violet-300/50 bg-violet-300/15 text-violet-100'
                                : 'border-violet-300/30 bg-violet-300/10 text-violet-200 hover:border-violet-200/50 hover:bg-violet-300/15'
                                }`}
                            title="Generate real instrument audio using MusicGen AI"
                        >
                            <Wand2 className="h-4 w-4" />
                            {aiGenerating ? 'Generating' : 'Real Audio'}
                        </button>
                    </div>
                </section>

                {aiMessage && (
                    <div className="flex items-center gap-2 rounded-lg border border-violet-300/30 bg-violet-300/10 px-4 py-3 text-sm font-medium text-violet-100">
                        <Music2 className="h-4 w-4 animate-pulse" />
                        {aiMessage}
                    </div>
                )}

                <section className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0d1218] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,0.12),transparent_26%),radial-gradient(circle_at_88%_18%,rgba(217,70,239,0.14),transparent_28%)]" />
                    <div className="relative grid gap-4 lg:grid-cols-[1fr_auto]">
                        <div className="min-w-0">
                            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                                <Flame className="h-3.5 w-3.5 text-fuchsia-300" />
                                Parent Seed
                            </div>
                            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                                <h4 className="text-2xl font-semibold tracking-tight text-white max-sm:text-xl">
                                    {parentSummary.vibe} {parentSummary.synth}
                                </h4>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                                    {TRACK_LABELS[activeTrack]}
                                </span>
                            </div>
                            <div className="mt-4 grid gap-2 text-xs font-mono text-slate-400 sm:grid-cols-3">
                                <div className="rounded-md border border-white/8 bg-black/25 px-3 py-2">
                                    <span className="block text-slate-600">Voice</span>
                                    vowel {parentSummary.vowel} · dens {parentSummary.density}
                                </div>
                                <div className="rounded-md border border-white/8 bg-black/25 px-3 py-2">
                                    <span className="block text-slate-600">Motion</span>
                                    slow {parentSummary.slow} · lpf {parentSummary.lpf}
                                </div>
                                <div className="rounded-md border border-white/8 bg-black/25 px-3 py-2">
                                    <span className="block text-slate-600">Space</span>
                                    room {parentSummary.room} · delay {parentSummary.delay}
                                </div>
                            </div>
                            {activePatternPreview && (
                                <div className="mt-3 truncate rounded-md border border-white/8 bg-black/25 px-3 py-2 font-mono text-[11px] text-slate-500">
                                    {activePatternPreview}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 lg:flex-col">
                            <button
                                onClick={() => toggleFavorite(parent)}
                                className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${isFavorite(parent)
                                    ? 'border-amber-300/55 bg-amber-300/15 text-amber-100'
                                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-amber-300/45 hover:text-amber-100'
                                    }`}
                            >
                                <Star className="h-4 w-4" />
                                {isFavorite(parent) ? 'Saved' : 'Save'}
                            </button>
                            <button
                                onClick={() => handleBreed(parent)}
                                className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${breedPick?.id === parent.id
                                    ? 'border-fuchsia-300/55 bg-fuchsia-300/15 text-fuchsia-100'
                                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-fuchsia-300/45 hover:text-fuchsia-100'
                                    }`}
                            >
                                <Sparkles className="h-4 w-4" />
                                {breedPick ? 'Breed 2nd' : 'Pick to Breed'}
                            </button>
                        </div>
                    </div>
                </section>

                {page === 'grow' && (
                    <div className="grid gap-4 xl:grid-cols-[minmax(340px,0.9fr)_1.1fr]">
                        <section className="rounded-lg border border-white/10 bg-[#0d1218] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-white">Branch Organism</h4>
                                    <p className="text-xs text-slate-500">{NOTE_RING[selectedBranch]} · {selectedSummary.vibe} · growth {selectedGrowth.toFixed(2)}</p>
                                </div>
                                <button
                                    onClick={replantSelectedBranch}
                                    className="shrink-0 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:border-cyan-200/50"
                                >
                                    Replant
                                </button>
                            </div>

                            <div className="flex justify-center">
                                <div className="relative aspect-square w-full max-w-[430px] rounded-full border border-cyan-300/10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.13),transparent_18%),radial-gradient(circle_at_center,rgba(0,0,0,0.45),rgba(2,6,23,0.9)_68%)] shadow-[inset_0_0_80px_rgba(0,0,0,0.65),0_26px_60px_rgba(0,0,0,0.35)]">
                                    <div className="absolute inset-[10%] rounded-full border border-white/8" />
                                    <div className="absolute inset-[25%] rounded-full border border-white/6" />
                                    <button
                                        onClick={() => selectGenome(parent, activeTrack)}
                                        className="absolute left-1/2 top-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-cyan-300/55 bg-cyan-300/12 text-cyan-100 shadow-[0_0_34px_rgba(34,211,238,0.32)] transition-transform hover:scale-105 max-sm:h-16 max-sm:w-16"
                                    >
                                        <Sprout className="h-5 w-5" />
                                        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em]">Seed</span>
                                    </button>

                                    {bulbBranches.map((g, idx) => {
                                        const angle = (idx / NOTE_RING.length) * Math.PI * 2 - Math.PI / 2;
                                        const radius = 42;
                                        const x = 50 + radius * Math.cos(angle);
                                        const y = 50 + radius * Math.sin(angle);
                                        const s = summarizeGenome(g);
                                        const picked = idx === selectedBranch;
                                        const growth = bulbGrowth[idx] ?? 0;
                                        return (
                                            <button
                                                key={g.id}
                                                onClick={() => selectBranch(idx)}
                                                onMouseEnter={() => previewGenome(g)}
                                                onMouseLeave={() => clearPreview(g.id)}
                                                className={`absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border text-center transition-all max-sm:h-12 max-sm:w-12 ${picked
                                                    ? 'border-fuchsia-300 bg-fuchsia-300/16 text-fuchsia-50 shadow-[0_0_28px_rgba(217,70,239,0.42)]'
                                                    : 'border-white/12 bg-black/55 text-slate-400 hover:border-cyan-300/50 hover:text-cyan-100'
                                                    }`}
                                                style={{ left: `${x}%`, top: `${y}%` }}
                                                title={`${NOTE_RING[idx]} · ${s.vibe} ${s.synth}`}
                                            >
                                                <span className="text-[11px] font-semibold">{NOTE_RING[idx]}</span>
                                                <span className="max-w-[46px] truncate text-[9px] opacity-70">{s.vibe}</span>
                                                <span
                                                    className="absolute -bottom-1 h-1 rounded-full bg-fuchsia-300/70"
                                                    style={{ width: `${Math.max(10, growth * 38)}px` }}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>

                        <section className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[#0d1218] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                                <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-300">Selected Branch</div>
                                    <h4 className="mt-1 text-xl font-semibold text-white">{NOTE_RING[selectedBranch]} · {selectedSummary.vibe} {selectedSummary.synth}</h4>
                                    <p className="mt-1 truncate font-mono text-xs text-cyan-500">{selectedGenome.notes}</p>
                                </div>
                                <button
                                    onClick={() => selectGenome(selectedGenome, activeTrack)}
                                    className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
                                >
                                    Apply Branch
                                </button>
                            </div>

                            <label className="rounded-lg border border-white/8 bg-black/25 p-3">
                                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                    Branch Growth
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

                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-medium text-slate-500 transition-colors hover:text-slate-200"
                            >
                                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                                Advanced genetics
                            </button>

                            {showAdvanced && (
                                <div className="grid gap-3 rounded-lg border border-white/8 bg-black/20 p-3">
                                    <label className="text-xs font-medium text-slate-400">
                                        <div className="mb-2 flex justify-between">
                                            <span>Grow all branches</span>
                                            <span className="font-mono text-cyan-300">{growthAll.toFixed(2)}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={growthAll}
                                            onChange={(e) => setAllGrowth(parseFloat(e.currentTarget.value))}
                                            className="studio-range w-full accent-cyan-300"
                                        />
                                    </label>

                                    <div className="flex flex-wrap gap-2">
                                        {FX_OPTIONS.map(opt => {
                                            const enabled = activeFx.includes(opt.id);
                                            return (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => toggleFx(opt.id)}
                                                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${enabled
                                                        ? 'border-cyan-300/55 bg-cyan-300/12 text-cyan-100'
                                                        : 'border-white/10 bg-white/[0.03] text-slate-500 hover:border-cyan-300/35 hover:text-cyan-100'
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <label className="text-xs font-medium text-slate-400">
                                        <div className="mb-2 flex justify-between">
                                            <span>Neuro / Atonality</span>
                                            <span className="font-mono text-emerald-300">{parent.spice.toFixed(2)}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={parent.spice}
                                            onChange={(e) => updateParent({ spice: parseFloat(e.currentTarget.value) })}
                                            className="studio-range w-full accent-emerald-300"
                                        />
                                    </label>
                                </div>
                            )}

                            <div>
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-semibold text-white">Mutation Forest</h4>
                                    <span className="text-xs text-slate-500">{forest.length} variants</span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    {forest.map((g, idx) => {
                                        const s = summarizeGenome(g);
                                        const fav = isFavorite(g);
                                        const picked = breedPick?.id === g.id;
                                        return (
                                            <div
                                                key={g.id}
                                                className={`group relative cursor-pointer rounded-lg border p-3 transition-colors ${picked
                                                    ? 'border-fuchsia-300/60 bg-fuchsia-300/12'
                                                    : 'border-white/10 bg-black/24 hover:border-cyan-300/35 hover:bg-cyan-300/6'
                                                    }`}
                                                onClick={() => selectGenome(g)}
                                                onMouseEnter={() => previewGenome(g)}
                                                onMouseLeave={() => clearPreview(g.id)}
                                            >
                                                <div className="mb-3 flex items-center justify-between gap-2">
                                                    <span className="font-mono text-[10px] text-slate-600">#{idx + 1}</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleFavorite(g); }}
                                                        className={`rounded p-1 transition-colors ${fav ? 'text-amber-300' : 'text-slate-600 hover:text-amber-200'}`}
                                                        title={fav ? 'Saved' : 'Save'}
                                                    >
                                                        <Star className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                                <div className="text-base font-semibold text-white">{s.vibe}</div>
                                                <div className="mt-1 truncate font-mono text-[11px] text-cyan-500">{g.notes}</div>
                                                <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
                                                    <span>{s.synth}</span>
                                                    <span>s{s.slow} d{s.density} r{s.room}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleBreed(g); }}
                                                    className="mt-3 w-full rounded-md border border-fuchsia-300/25 bg-fuchsia-300/8 py-1.5 text-xs font-medium text-fuchsia-200 opacity-0 transition-opacity hover:border-fuchsia-200/50 group-hover:opacity-100 max-lg:opacity-100"
                                                >
                                                    {breedPick ? 'Breed with pick' : 'Mark for breed'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {page === 'tweak' && (
                    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                        <section className="rounded-lg border border-white/10 bg-[#0d1218] p-4">
                            <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">DNA Editor</div>
                            <label className="block text-xs font-medium text-slate-400">
                                Notes
                                <textarea
                                    value={parent.notes}
                                    onChange={(e) => updateParent({ notes: e.currentTarget.value })}
                                    rows={5}
                                    className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/45 p-3 font-mono text-sm text-white outline-none transition-colors focus:border-cyan-300/45"
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

                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    onClick={() => selectGenome(parent, activeTrack)}
                                    className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-200/50"
                                >
                                    Commit DNA
                                </button>
                                <button
                                    onClick={() => setPage('grow')}
                                    className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-fuchsia-300/35 hover:text-fuchsia-100"
                                >
                                    Back to Grow
                                </button>
                            </div>
                        </section>

                        <section className="rounded-lg border border-white/10 bg-[#0d1218] p-4">
                            <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-300">Macro Controls</div>
                            <div className="grid gap-4">
                                {([
                                    { key: 'slow', label: 'Slow', min: 0.25, max: 8, step: 0.01 },
                                    { key: 'gain', label: 'Gain', min: 0.1, max: 1.8, step: 0.01 },
                                    { key: 'room', label: 'Reverb', min: 0, max: 1, step: 0.01 },
                                    { key: 'delay', label: 'Delay', min: 0, max: 0.95, step: 0.01 },
                                    { key: 'lpf', label: 'LPF', min: 0, max: 1, step: 0.01 },
                                ] as const).map(({ key, label, min, max, step }) => {
                                    const value = parent[key];
                                    return (
                                        <label key={key} className="text-xs font-medium text-slate-400">
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
                                                className="studio-range w-full accent-cyan-300"
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                )}

                {page === 'dj' && (
                    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                        <section className="rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/6 p-4">
                            <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200">
                                <Zap className="h-4 w-4" />
                                Build-Ups / Drops
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {BUILD_UP_PRESETS.map(preset => (
                                    <button
                                        key={preset.id}
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

                        <section className="rounded-lg border border-orange-300/20 bg-orange-300/6 p-4">
                            <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-200">
                                <Radio className="h-4 w-4" />
                                Transition Sweep
                            </div>
                            {!sweepActive ? (
                                <button
                                    onClick={() => startTransitionSweep('main', 8, state?.bpm || 128)}
                                    title="Start HPF sweep"
                                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-orange-300/35 bg-orange-300/12 text-sm font-semibold text-orange-100 transition-colors hover:border-orange-200/60"
                                >
                                    <ArrowUp className="h-4 w-4" />
                                    Sweep Out
                                </button>
                            ) : (
                                <button
                                    onClick={() => cancelTransitionSweep()}
                                    title="Release the filter"
                                    className="flex h-12 w-full animate-pulse items-center justify-center gap-2 rounded-lg border border-red-300/55 bg-red-400/25 text-sm font-bold text-red-50 transition-colors hover:border-red-200/70"
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
                                onClick={() => setPage('grow')}
                                className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-cyan-300/35 hover:text-cyan-100"
                            >
                                Back to Grow
                            </button>
                        </section>
                    </div>
                )}

                {favorites.length > 0 && (
                    <section className="rounded-lg border border-white/10 bg-[#0d1218] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Garden Shelf</div>
                            <button
                                onClick={() => { setFavorites([]); saveFavorites([]); }}
                                className="text-xs font-medium text-slate-500 transition-colors hover:text-rose-300"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 studio-scrollbar">
                            {favorites.map((g) => {
                                const s = summarizeGenome(g);
                                const isActive = parent.id === g.id;
                                return (
                                    <button
                                        key={g.id}
                                        onClick={() => selectGenome(g, g.trackId)}
                                        onMouseEnter={() => previewGenome(g)}
                                        onMouseLeave={() => clearPreview(g.id)}
                                        className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${isActive
                                            ? 'border-cyan-300/55 bg-cyan-300/12 text-cyan-100'
                                            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-cyan-300/35 hover:text-cyan-100'
                                            }`}
                                    >
                                        <div className="text-sm font-semibold">{s.vibe} {s.synth}</div>
                                        <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-600">{TRACK_LABELS[g.trackId]}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
