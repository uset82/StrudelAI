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
        <div className="h-full w-full p-4 flex flex-col gap-4 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sprout className="w-5 h-5 text-cyan-300" />
                    <h3 className="text-sm font-mono tracking-widest text-cyan-200">SYNPLANT GARDEN</h3>
                </div>

                <div className="flex items-center gap-1">
                    {TRACKS.map(t => (
                        <button
                            key={t}
                            onClick={() => switchTrack(t)}
                            className={`px-2 py-1 rounded text-[10px] font-mono uppercase border transition
                                ${activeTrack === t
                                    ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200'
                                    : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main tabs */}
            <div className="flex items-center gap-2">
                {PAGE_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setPage(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition flex items-center gap-1.5
                            ${page === tab.id
                                ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={newSeed}
                        className="px-3 py-1 rounded text-xs font-mono border border-gray-700 text-gray-300 hover:border-cyan-500/60 hover:text-cyan-200 flex items-center gap-1"
                    >
                        <Shuffle className="w-3 h-3" />
                        New Seed
                    </button>
                    <button
                        onClick={() => growForest(parent, depth)}
                        className="px-3 py-1 rounded text-xs font-mono border border-gray-700 text-gray-300 hover:border-fuchsia-500/60 hover:text-fuchsia-200 flex items-center gap-1"
                    >
                        <Zap className="w-3 h-3" />
                        Grow Forest
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1 rounded text-xs font-mono border border-gray-700 text-gray-300 hover:border-emerald-500/60 hover:text-emerald-200 flex items-center gap-1"
                        title="Genopatch from audio sample"
                    >
                        <Upload className="w-3 h-3" />
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
                        className={`px-4 py-1.5 rounded text-xs font-mono border flex items-center gap-1.5 transition
                            ${aiGenerating
                                ? 'border-purple-500/60 bg-purple-500/20 text-purple-200 animate-pulse cursor-wait'
                                : 'border-purple-500/50 text-purple-300 bg-purple-500/10 hover:border-purple-400 hover:bg-purple-500/20 hover:text-purple-100'}`}
                        title="Generate real instrument audio using MusicGen AI"
                    >
                        <Wand2 className="w-3.5 h-3.5" />
                        {aiGenerating ? 'Generating...' : '✨ Real Audio (AI)'}
                    </button>
                </div>
            </div>

            {/* AI Generation Message */}
            {aiMessage && (
                <div className="px-4 py-2 rounded-lg border border-purple-500/40 bg-purple-500/10 text-sm font-mono text-purple-200 flex items-center gap-2">
                    <Music2 className="w-4 h-4 animate-pulse" />
                    {aiMessage}
                </div>
            )}

            {/* Depth controls */}
            <div className="flex items-center gap-2">
                {(Object.keys(DEPTH_LABELS) as MutationDepth[]).map(d => (
                    <button
                        key={d}
                        onClick={() => changeDepth(d)}
                        className={`px-3 py-1 rounded-full text-xs font-mono border flex items-center gap-1 transition
                            ${depth === d ? DEPTH_LABELS[d].className : 'text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200'}`}
                    >
                        {DEPTH_LABELS[d].icon}
                        {DEPTH_LABELS[d].label}
                    </button>
                ))}
            </div>

            {/* Parent seed summary */}
            <div className="relative rounded-xl border border-cyan-900/40 bg-black/70 p-4 shadow-[0_0_40px_rgba(6,182,212,0.15)]">
                <div className="absolute -inset-1 rounded-xl blur-lg bg-linear-to-r from-cyan-500/20 to-fuchsia-500/20 pointer-events-none" />
                <div className="relative flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-mono uppercase text-cyan-400 tracking-widest">Parent Seed</div>
                        <div className="mt-1 text-white font-semibold tracking-wide flex items-center gap-2">
                            <Flame className="w-4 h-4 text-fuchsia-300" />
                            {parentSummary.vibe.toUpperCase()} {parentSummary.synth.toUpperCase()}
                        </div>
                        <div className="mt-2 text-xs font-mono text-cyan-700">
                            vowel {parentSummary.vowel} · slow {parentSummary.slow} · dens {parentSummary.density}
                        </div>
                        <div className="mt-1 text-xs font-mono text-cyan-700">
                            room {parentSummary.room} · delay {parentSummary.delay} · lpf {parentSummary.lpf}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <button
                            onClick={() => toggleFavorite(parent)}
                            className={`p-2 rounded border text-xs font-mono flex items-center gap-1 transition
                                ${isFavorite(parent)
                                    ? 'border-yellow-500/60 text-yellow-300 bg-yellow-500/10'
                                    : 'border-gray-700 text-gray-300 hover:border-yellow-500/60 hover:text-yellow-200'}`}
                        >
                            <Star className="w-3 h-3" />
                            {isFavorite(parent) ? 'Saved' : 'Save'}
                        </button>
                        <button
                            onClick={() => handleBreed(parent)}
                            className={`p-2 rounded border text-xs font-mono flex items-center gap-1 transition
                                ${breedPick?.id === parent.id
                                    ? 'border-fuchsia-500/60 text-fuchsia-200 bg-fuchsia-500/10'
                                    : 'border-gray-700 text-gray-300 hover:border-fuchsia-500/60 hover:text-fuchsia-200'}`}
                        >
                            {breedPick ? 'Breed 2nd' : 'Pick to Breed'}
                        </button>
                    </div>
                </div>
                {currentTrackPattern && (
                    <div className="relative mt-3 text-[10px] font-mono text-gray-500 truncate">
                        current track: {currentTrackPattern}
                    </div>
                )}
            </div>

            {/* Grow view (Bulb wheel + Forest grid) */}
            {page === 'grow' && (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-center">
                        <div className="relative w-[320px] h-[320px] rounded-full border border-gray-800 bg-black/60 shadow-inner">
                            <div className="absolute inset-6 rounded-full border border-gray-900/70" />
                            {/* Center seed */}
                            <button
                                onClick={() => selectGenome(parent, activeTrack)}
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border border-cyan-500/60 bg-cyan-500/10 text-cyan-200 font-mono text-xs flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.35)]"
                            >
                                SEED
                            </button>

                            {bulbBranches.map((g, idx) => {
                                const angle = (idx / NOTE_RING.length) * Math.PI * 2 - Math.PI / 2;
                                const radius = 135;
                                const x = 160 + radius * Math.cos(angle);
                                const y = 160 + radius * Math.sin(angle);
                                const s = summarizeGenome(g);
                                const picked = idx === selectedBranch;
                                return (
                                    <button
                                        key={g.id}
                                        onClick={() => selectBranch(idx)}
                                        onMouseEnter={() => previewGenome(g)}
                                        onMouseLeave={() => clearPreview(g.id)}
                                        className={`absolute w-10 h-10 rounded-full border text-[9px] font-mono flex flex-col items-center justify-center transition
                                            ${picked
                                                ? 'border-fuchsia-500/80 bg-fuchsia-500/15 text-fuchsia-100 shadow-[0_0_15px_rgba(217,70,239,0.4)]'
                                                : 'border-gray-700 bg-black/70 text-gray-300 hover:border-cyan-500/70 hover:text-cyan-100'}`}
                                        style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
                                        title={`${NOTE_RING[idx]} · ${s.vibe} ${s.synth}`}
                                    >
                                        <div className="text-[10px]">{NOTE_RING[idx]}</div>
                                        <div className="opacity-60">{s.vibe}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>


                    {/* Simplified Branch Controls */}
                    <div className="rounded-lg border border-gray-800 bg-black/60 p-3 flex flex-col gap-2">
                        {/* Main control: Branch + Growth (always visible) */}
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-gray-300 w-20">Branch {NOTE_RING[selectedBranch]}</span>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={bulbGrowth[selectedBranch]}
                                onChange={(e) => setBranchGrowth(selectedBranch, parseFloat(e.currentTarget.value))}
                                className="flex-1 accent-fuchsia-500 cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{bulbGrowth[selectedBranch].toFixed(2)}</span>
                        </div>

                        {/* Collapsible Advanced Section */}
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-[10px] font-mono text-gray-500 hover:text-gray-300 transition py-1"
                        >
                            <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                            Advanced Settings
                        </button>

                        {showAdvanced && (
                            <div className="flex flex-col gap-3 pt-2 border-t border-gray-800">
                                {/* Grow all slider */}
                                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
                                    <span>Grow all</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={growthAll}
                                        onChange={(e) => setAllGrowth(parseFloat(e.currentTarget.value))}
                                        className="flex-1 accent-cyan-500 cursor-pointer"
                                    />
                                </div>

                                {/* Plant as Seed button */}
                                <button
                                    onClick={replantSelectedBranch}
                                    className="px-3 py-1 rounded text-xs font-mono border border-gray-700 text-gray-300 hover:border-cyan-500/60 hover:text-cyan-200 w-fit"
                                >
                                    Plant Branch as Seed
                                </button>

                                {/* Effects */}
                                <div className="flex flex-col gap-1">
                                    <div className="text-[9px] font-mono uppercase tracking-widest text-gray-500">Effects</div>
                                    <div className="flex flex-wrap gap-1">
                                        {FX_OPTIONS.map(opt => {
                                            const enabled = activeFx.includes(opt.id);
                                            return (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => toggleFx(opt.id)}
                                                    className={`px-2 py-0.5 rounded border text-[10px] font-mono transition
                                                        ${enabled
                                                            ? 'border-cyan-500/70 text-cyan-200 bg-cyan-500/10'
                                                            : 'border-gray-700 text-gray-400 hover:border-cyan-500/60 hover:text-cyan-200'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Neuro / Atonality */}
                                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
                                    <span className="whitespace-nowrap">Neuro / Atonality</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={parent.spice}
                                        onChange={(e) => updateParent({ spice: parseFloat(e.currentTarget.value) })}
                                        className="flex-1 accent-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-gray-500 w-8 text-right">{parent.spice.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Forest grid - Compact */}
                    <div className="grid grid-cols-3 gap-2">
                        {forest.map((g, idx) => {
                            const s = summarizeGenome(g);
                            const fav = isFavorite(g);
                            const picked = breedPick?.id === g.id;
                            return (
                                <div
                                    key={g.id}
                                    className={`group relative rounded-lg border p-2 cursor-pointer transition
                                        ${picked
                                            ? 'border-fuchsia-500/70 bg-fuchsia-500/10'
                                            : 'border-gray-800 bg-black/60 hover:border-cyan-500/60 hover:bg-cyan-500/5'}`}
                                    onClick={() => selectGenome(g)}
                                    onMouseEnter={() => previewGenome(g)}
                                    onMouseLeave={() => clearPreview(g.id)}
                                >
                                    {/* Clean minimal view - just vibe name */}
                                    <div className="text-sm font-medium text-white text-center py-1">
                                        {s.vibe}
                                    </div>

                                    {/* Hover overlay with details */}
                                    <div className="absolute inset-0 rounded-lg bg-black/95 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between pointer-events-none group-hover:pointer-events-auto">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] font-mono text-gray-500">#{idx + 1}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(g); }}
                                                    className={`p-0.5 rounded transition ${fav ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-300'}`}
                                                >
                                                    <Star className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className="text-xs font-bold text-white">{s.vibe} · {s.synth}</div>
                                            <div className="text-[9px] font-mono text-cyan-600 truncate mt-0.5">{g.notes}</div>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                            <div className="text-[8px] font-mono text-gray-500">
                                                s{s.slow} d{s.density} r{s.room}
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleBreed(g); }}
                                                className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-fuchsia-500/50 text-fuchsia-300 hover:bg-fuchsia-500/20"
                                            >
                                                {breedPick ? '✕' : '♥'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tweak view (DNA Editor + Effects) */}
            {page === 'tweak' && (
                <div className="rounded-xl border border-gray-800 bg-black/60 p-4 flex flex-col gap-4">
                    <div className="text-xs font-mono text-cyan-300 tracking-widest uppercase">DNA Editor</div>

                    <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                        Notes (mini-notation)
                        <textarea
                            value={parent.notes}
                            onChange={(e) => updateParent({ notes: e.currentTarget.value })}
                            rows={3}
                            className="mt-1 w-full bg-black/80 border border-gray-700 rounded p-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/60"
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                            Synth
                            <select
                                value={parent.synth}
                                onChange={(e) => updateParent({ synth: e.currentTarget.value })}
                                className="mt-1 w-full bg-black/80 border border-gray-700 rounded p-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/60"
                            >
                                {['sine', 'triangle', 'square', 'sawtooth', 'pink'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </label>

                        {(activeTrack === 'voice' || activeTrack === 'fx') && (
                            <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                                Vowel
                                <select
                                    value={parent.vowel}
                                    onChange={(e) => updateParent({ vowel: e.currentTarget.value })}
                                    className="mt-1 w-full bg-black/80 border border-gray-700 rounded p-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/60"
                                >
                                    {['a', 'e', 'i', 'o', 'u'].map(v => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>

                    {([
                        { key: 'slow', label: 'Slow', min: 0.25, max: 8, step: 0.01 },
                        { key: 'gain', label: 'Gain', min: 0.1, max: 1.8, step: 0.01 },
                        { key: 'room', label: 'Reverb', min: 0, max: 1, step: 0.01 },
                        { key: 'delay', label: 'Delay', min: 0, max: 0.95, step: 0.01 },
                        { key: 'lpf', label: 'LPF', min: 0, max: 1, step: 0.01 },
                    ] as const).map(({ key, label, min, max, step }) => {
                        const value = parent[key];
                        return (
                            <label key={key} className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                                <div className="flex justify-between">
                                    <span>{label}</span>
                                    <span className="text-gray-500">{value.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={min}
                                    max={max}
                                    step={step}
                                    value={value}
                                    onChange={(e) => updateParent({ [key]: parseFloat(e.currentTarget.value) } as Partial<TrackGenome>)}
                                    className="w-full accent-cyan-500 cursor-pointer"
                                />
                            </label>
                        );
                    })}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => selectGenome(parent, activeTrack)}
                            className="px-3 py-1 rounded text-xs font-mono border border-gray-700 text-gray-300 hover:border-cyan-500/60 hover:text-cyan-200"
                        >
                            Commit DNA to Seed
                        </button>
                        <button
                            onClick={() => setPage('grow')}
                            className="px-3 py-1 rounded text-xs font-mono border border-gray-700 text-gray-300 hover:border-fuchsia-500/60 hover:text-fuchsia-200"
                        >
                            Back to Grow
                        </button>
                    </div>
                </div>
            )}

            {/* DJ tab (Performance tools) */}
            {page === 'dj' && (
                <div className="flex flex-col gap-6">
                    {/* Quick Build-Up Actions */}
                    <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-4">
                        <div className="text-xs font-mono uppercase tracking-widest text-fuchsia-300 mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Quick Build-Ups / Drops
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {BUILD_UP_PRESETS.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => onApplyPattern('fx', `expr:${preset.pattern}`)}
                                    title={preset.description}
                                    className="px-3 py-2 rounded-lg border text-xs font-mono flex items-center gap-2 transition
                                        border-fuchsia-500/40 text-fuchsia-200 bg-fuchsia-500/10 hover:border-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-100"
                                >
                                    {preset.icon}
                                    <div className="text-left">
                                        <div>{preset.label}</div>
                                        <div className="text-[9px] text-fuchsia-400/70 truncate max-w-[120px]">{preset.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* DJ Transition Sweep */}
                    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                        <div className="text-xs font-mono uppercase tracking-widest text-orange-300 mb-3 flex items-center gap-2">
                            <Radio className="w-4 h-4" />
                            DJ Transition Sweep
                        </div>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                {!sweepActive ? (
                                    <button
                                        onClick={() => startTransitionSweep('main', 8, state?.bpm || 128)}
                                        title="Start HPF sweep - gradually removes bass over 8 bars"
                                        className="px-4 py-2 rounded-lg border text-sm font-mono flex items-center gap-2 transition
                                            border-orange-500/50 text-orange-200 bg-orange-500/15 hover:border-orange-400 hover:bg-orange-500/25 hover:text-orange-100"
                                    >
                                        <ArrowUp className="w-4 h-4" />
                                        Sweep Out (8 bars)
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => cancelTransitionSweep()}
                                        title="DROP IT! Release the filter and bring back the bass!"
                                        className="px-4 py-2 rounded-lg border text-sm font-mono font-bold flex items-center gap-2 transition animate-pulse
                                            border-red-500/80 text-red-100 bg-red-500/40 hover:border-red-400 hover:bg-red-500/60 hover:text-white"
                                    >
                                        <ArrowDown className="w-4 h-4" />
                                        💥 DROP IT!
                                    </button>
                                )}
                            </div>

                            {sweepActive && (
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                                        <div
                                            className="h-full bg-gradient-to-r from-orange-500 via-red-500 to-red-600 transition-all duration-100"
                                            style={{ width: `${sweepProgress * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-mono text-orange-300 w-12 tabular-nums">
                                        {Math.round(sweepProgress * 100)}%
                                    </span>
                                </div>
                            )}

                            <p className="text-[10px] font-mono text-gray-500">
                                {sweepActive
                                    ? "HPF sweeping up... The bass is fading. Hit DROP when ready!"
                                    : "Sweep gradually removes bass over 8 bars for smooth DJ-style transitions. Hit DROP to bring back the bass with impact!"}
                            </p>
                        </div>
                    </div>

                    {/* Back to Grow button */}
                    <div className="flex justify-center">
                        <button
                            onClick={() => setPage('grow')}
                            className="px-4 py-2 rounded-lg text-xs font-mono border border-gray-700 text-gray-300 hover:border-cyan-500/60 hover:text-cyan-200 flex items-center gap-2"
                        >
                            <Sprout className="w-3 h-3" />
                            Back to Grow
                        </button>
                    </div>
                </div>
            )}

            {/* Favorites shelf */}
            {favorites.length > 0 && (
                <div className="mt-2">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-500 mb-2">
                        Garden Shelf (click to load)
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {favorites.map((g) => {
                            const s = summarizeGenome(g);
                            const isActive = parent.id === g.id;
                            return (
                                <button
                                    key={g.id}
                                    onClick={() => selectGenome(g, g.trackId)}
                                    onMouseEnter={() => previewGenome(g)}
                                    onMouseLeave={() => clearPreview(g.id)}
                                    className={`px-2 py-1 rounded border text-[10px] font-mono flex items-center gap-1 transition
                                        ${isActive
                                            ? 'border-cyan-500/60 text-cyan-200 bg-cyan-500/10'
                                            : 'border-gray-700 text-gray-400 hover:border-cyan-500/60 hover:text-cyan-200'}`}
                                >
                                    {s.vibe} {s.synth}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => { setFavorites([]); saveFavorites([]); }}
                            className="px-2 py-1 rounded border border-gray-700 text-[10px] font-mono text-gray-500 hover:text-red-300 hover:border-red-500/60"
                        >
                            Clear Shelf
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
