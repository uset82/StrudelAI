'use client';

import React, { useState } from 'react';
import { StrudelLogo } from './StrudelLogo';
import { ThinkingOrb, OrbState } from './ui/ThinkingOrb';
import { BorderBeam } from './ui/BorderBeam';
import {
    Sparkles,
    Play,
    Square,
    Mic,
    Code,
    Layers,
    Sprout,
    Disc3,
    Brain,
    Radio,
    Volume2,
    ArrowRight,
    Music,
    Zap,
    Sliders,
    CheckCircle2
} from 'lucide-react';
import { SonicSessionState } from '@/types/sonic';

interface MainFrontUIProps {
    state: SonicSessionState | null;
    isConnected: boolean;
    isAudioReady: boolean;
    isThinking: boolean;
    isPlaying: boolean;
    bpm: number;
    onSelectView: (mode: 'simple' | 'arrangement' | 'garden' | 'djmixer' | 'ssnn' | 'voice') => void;
    onSendCommand: (prompt: string) => void;
    onInitAudio: () => void;
    onTogglePlayback: () => void;
    onApplyTemplate: (templateName: string) => void;
}

const GENRE_PILLS = [
    { label: 'Berlin Techno 909', prompt: 'dark underground berlin techno with heavy 909 kick, 16th-note rolling bassline, and filtered synth stabs at 136 bpm', icon: Zap, border: 'border-amber-500/30 text-amber-400 bg-amber-500/5' },
    { label: 'Acid House 303', prompt: 'play some 303 acid house with resonant baseline and 909 drums', icon: Sliders, border: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5' },
    { label: 'Deep Melodic House', prompt: 'deep melodic house with punchy kick, sub bass, and warm chords', icon: Disc3, border: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' },
    { label: 'Lo-Fi Chillhop', prompt: 'warm lofi hip hop beat with smooth vinyl chords and relaxed drums', icon: Music, border: 'border-blue-500/30 text-blue-400 bg-blue-500/5' },
    { label: 'Liquid Drum & Bass', prompt: 'fast liquid drum and bass with rolling breaks and reese bass at 174 bpm', icon: Radio, border: 'border-sky-500/30 text-sky-400 bg-sky-500/5' },
    { label: 'Ambient Drone Matrix', prompt: 'deep ambient meditation soundscape with slow evolving chords and no drums', icon: Sparkles, border: 'border-slate-400/30 text-slate-300 bg-slate-500/5' },
];

const STUDIO_ENGINES = [
    {
        id: 'simple' as const,
        title: 'Code Engine',
        subtitle: 'Live Pattern REPL',
        description: 'Algorithmic Strudel mini-notation live editor with real-time waveform stack and frequency spectrum analyzer.',
        icon: Code,
        accent: 'from-amber-500/15 via-transparent to-transparent border-amber-500/30 text-amber-400',
        badge: 'Live Coding'
    },
    {
        id: 'arrangement' as const,
        title: 'Arrangement DAW',
        subtitle: 'Timeline & Multi-Track Clips',
        description: 'Multi-track block sequencer to construct, arrange, and automate intro, verse, drop, and outro song sections.',
        icon: Layers,
        accent: 'from-blue-500/15 via-transparent to-transparent border-blue-500/30 text-blue-400',
        badge: 'DAW Sequencer'
    },
    {
        id: 'garden' as const,
        title: 'Synplant Garden',
        subtitle: 'Genetic Sound Evolution',
        description: 'Grow sonic branches, mutate pattern genomes, and extract musical strands from audio with Genopatch.',
        icon: Sprout,
        accent: 'from-emerald-500/15 via-transparent to-transparent border-emerald-500/30 text-emerald-400',
        badge: 'Genetic Synth'
    },
    {
        id: 'djmixer' as const,
        title: 'DJ Dual Decks',
        subtitle: 'Mixer & Performance',
        description: 'Dual Strudel turntables, interactive crossfader, stem high-pass/low-pass filters, and transition FX.',
        icon: Disc3,
        accent: 'from-orange-500/15 via-transparent to-transparent border-orange-500/30 text-orange-400',
        badge: 'DJ Performance'
    },
    {
        id: 'ssnn' as const,
        title: 'SSNN Neural Matrix',
        subtitle: '960-Neuron LIF Synthesizer',
        description: 'Spiking neural network with 32 layers, closed-loop FFT learning, comb/pulse DSP, and tape recording buffers.',
        icon: Brain,
        accent: 'from-rose-500/15 via-transparent to-transparent border-rose-500/30 text-rose-400',
        badge: 'Neural LIF'
    },
    {
        id: 'voice' as const,
        title: 'Voice Lab',
        subtitle: 'AI Vocal Synthesizer',
        description: 'Microphone speech-to-music AI, neural timbre transformations, formants, vocoder, and generative vocal soundscapes.',
        icon: Mic,
        accent: 'from-indigo-500/15 via-transparent to-transparent border-indigo-500/30 text-indigo-400',
        badge: 'Voice & Timbre'
    }
];

const STARTER_PRESETS = [
    {
        title: 'Berlin Industrial Techno',
        bpm: 136,
        tags: ['TR-909', 'Acid Bass', 'Peak-time'],
        prompt: 'dark underground berlin techno with heavy 909 kick, 16th-note rolling bassline, and filtered synth stabs at 136 bpm',
    },
    {
        title: 'Midnight Rhodes Chill',
        bpm: 86,
        tags: ['Vinyl', 'Rhodes', 'Boom-Bap'],
        prompt: 'dusty lofi hip hop with vinyl crackle, warm rhodes piano chords, lazy boom bap drums at 86 bpm',
    },
    {
        title: 'Analog Outrun 1984',
        bpm: 124,
        tags: ['Arpeggiator', 'Gated Snare', 'Bass'],
        prompt: 'retro 80s outrun synthwave with driving analog bass arpeggio, gated reverb snare, and neon synth lead',
    },
    {
        title: 'Deep Space Drone',
        bpm: 72,
        tags: ['Pads', 'Sub Harmonic', 'Evolving'],
        prompt: 'space ambient drone with slow evolving harmonic pads, pitch shimmer reverb, and subtle sub pulse',
    }
];

export function MainFrontUI({
    state,
    isConnected,
    isAudioReady,
    isThinking,
    isPlaying,
    bpm,
    onSelectView,
    onSendCommand,
    onInitAudio,
    onTogglePlayback,
    onApplyTemplate,
}: MainFrontUIProps) {
    const [inputPrompt, setInputPrompt] = useState('');
    const [justTriggered, setJustTriggered] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = inputPrompt.trim();
        if (!trimmed || isThinking) return;
        onSendCommand(trimmed);
        setInputPrompt('');
    };

    const handlePillClick = (prompt: string, label: string) => {
        if (isThinking) return;
        setJustTriggered(label);
        onSendCommand(prompt);
        setTimeout(() => setJustTriggered(null), 2500);
    };

    const activeTracksCount = state?.tracks
        ? Object.values(state.tracks).filter(t => Boolean(t.pattern?.trim()) && !t.muted).length
        : 0;

    const orbState: OrbState = isThinking ? 'working' : isPlaying ? 'composing' : 'idle';

    return (
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto studio-scrollbar bg-[#090b10] text-slate-100 p-4 sm:p-6 lg:p-8 select-none pb-24 lg:pb-8">
            <div className="max-w-6xl mx-auto w-full flex flex-col gap-6 sm:gap-8">
                
                {/* 1. Hardware Studio Header & Telemetry */}
                <header className="relative flex flex-col items-center justify-center pt-2 pb-2 text-center">
                    <div className="flex items-center justify-center mb-3">
                        <ThinkingOrb state={orbState} size="hero" showStatusText={false} />
                    </div>

                    <StrudelLogo variant="hero" isPlaying={isPlaying} size="lg" />

                    {/* Hardware Telemetry Strip */}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
                        <div className="flex items-center gap-2 rounded border border-white/10 bg-[#12151c] px-3 py-1 text-slate-300">
                            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
                            <span className="text-[11px] tracking-wider uppercase">{isConnected ? 'SOCKET LINKED' : 'OFFLINE'}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded border border-white/10 bg-[#12151c] px-3 py-1 text-slate-300">
                            <span className={`h-2 w-2 rounded-full ${isAudioReady ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-amber-400'}`} />
                            <span className="text-[11px] tracking-wider uppercase">{isAudioReady ? 'AUDIO ENGINE READY' : 'AUDIO SUSPENDED'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-amber-400 tabular-nums">
                            <span>{bpm || 120} BPM</span>
                        </div>
                        {activeTracksCount > 0 && (
                            <div className="flex items-center gap-1.5 rounded border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-blue-300">
                                <span>{activeTracksCount} ACTIVE CHANNELS</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* 2. Neural Prompt Console with BorderBeam */}
                <section className="relative flex flex-col gap-3.5 rounded-xl border border-white/10 bg-[#10141c] p-4 sm:p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
                    <BorderBeam size={240} duration={14} colorFrom="#f59e0b" colorTo="#3b82f6" borderWidth={1.5} />

                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <div className="flex items-center gap-2 font-medium">
                            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                            <span className="text-slate-200 font-semibold tracking-wide">Neural Music Prompt</span>
                            <span className="text-slate-500 hidden sm:inline">· Describe any genre, chord progression, tempo, or sonic structure</span>
                        </div>
                        {!isAudioReady && (
                            <button
                                type="button"
                                onClick={onInitAudio}
                                className="flex items-center gap-1.5 rounded bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-mono font-semibold text-amber-300 hover:bg-amber-500/20 tactile-interactive"
                            >
                                <Volume2 className="h-3.5 w-3.5" />
                                <span>INITIALIZE AUDIO</span>
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                            type="text"
                            value={inputPrompt}
                            onChange={(e) => setInputPrompt(e.target.value)}
                            placeholder="e.g. 'Acid techno 303 bass with 909 drums at 136 bpm', 'warm Rhodes lofi chords'..."
                            disabled={isThinking}
                            className="w-full rounded-lg border border-white/10 bg-[#0a0c10] px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
                        />
                        <button
                            type="submit"
                            disabled={isThinking || !inputPrompt.trim()}
                            className={`flex shrink-0 items-center justify-center gap-2 rounded-lg px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all min-h-[44px] tactile-interactive ${
                                isThinking
                                    ? 'bg-amber-500/40 text-slate-900 cursor-wait'
                                    : inputPrompt.trim()
                                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.35)]'
                                        : 'bg-white/[0.06] text-slate-400 hover:bg-white/10 border border-white/5'
                            }`}
                        >
                            {isThinking ? (
                                <>
                                    <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                                    <span>Synthesizing...</span>
                                </>
                            ) : (
                                <>
                                    <span>Synthesize</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Quick Style Selectors */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-mono text-slate-500 mr-1 uppercase">Quick Style:</span>
                        {GENRE_PILLS.map((pill) => {
                            const isPillActive = justTriggered === pill.label;
                            const Icon = pill.icon;
                            return (
                                <button
                                    key={pill.label}
                                    type="button"
                                    onClick={() => handlePillClick(pill.prompt, pill.label)}
                                    disabled={isThinking}
                                    className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-all tactile-interactive ${pill.border} ${
                                        isPillActive ? 'ring-1 ring-amber-400 brightness-125' : 'hover:brightness-110'
                                    }`}
                                >
                                    <Icon className="h-3 w-3 shrink-0" />
                                    <span>{pill.label}</span>
                                    {isPillActive && <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-0.5" />}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* 3. Studio Engine Workspaces (DAW Racks) */}
                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Sliders className="h-4 w-4 text-amber-400" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                                Studio Workspaces & Racks
                            </h2>
                        </div>
                        <span className="text-xs font-mono text-slate-500">6 DEDICATED MODULES</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {STUDIO_ENGINES.map((engine) => {
                            const Icon = engine.icon;
                            return (
                                <div
                                    key={engine.id}
                                    onClick={() => onSelectView(engine.id)}
                                    className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-[#10131a] hover:bg-[#151922] p-5 cursor-pointer tactile-interactive shadow-lg hover:border-white/20"
                                >
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className={`p-2 rounded-lg border bg-gradient-to-br ${engine.accent}`}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 border border-white/10 rounded px-2 py-0.5 bg-white/[0.02]">
                                                {engine.badge}
                                            </span>
                                        </div>

                                        <div>
                                            <h3 className="text-base font-bold text-slate-100 group-hover:text-white transition-colors">
                                                {engine.title}
                                            </h3>
                                            <p className="text-xs font-mono text-amber-400/90 mt-0.5">
                                                {engine.subtitle}
                                            </p>
                                        </div>

                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            {engine.description}
                                        </p>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 group-hover:text-amber-400 transition-colors">
                                        <span className="font-mono text-[11px]">LAUNCH WORKSPACE</span>
                                        <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 4. Production Master Presets */}
                <section className="flex flex-col gap-3 mb-6">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Music className="h-4 w-4 text-blue-400" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                                Production Template Presets
                            </h2>
                        </div>
                        <span className="text-xs font-mono text-slate-500">READY-TO-PLAY STEMS</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {STARTER_PRESETS.map((preset) => (
                            <div
                                key={preset.title}
                                onClick={() => handlePillClick(preset.prompt, preset.title)}
                                className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-[#10131a] hover:bg-[#141822] p-4 cursor-pointer tactile-interactive hover:border-amber-400/40"
                            >
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-mono font-bold text-amber-400">
                                            {preset.bpm} BPM
                                        </span>
                                        <Play className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-white">
                                        {preset.title}
                                    </h4>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {preset.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="text-[9px] font-mono uppercase bg-white/[0.04] text-slate-400 border border-white/5 rounded px-1.5 py-0.5"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500 group-hover:text-amber-300">
                                    <span>LOAD PRESET</span>
                                    <ArrowRight className="h-3 w-3" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );
}
