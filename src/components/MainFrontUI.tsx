'use client';

import React, { useState } from 'react';
import { StrudelLogo } from './StrudelLogo';
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
    Flame,
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
    { label: 'Acid House 303', prompt: 'play some 303 acid house with resonant baseline and 909 drums', icon: Flame, color: 'text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20' },
    { label: 'Lo-Fi Chillhop', prompt: 'warm lofi hip hop beat with smooth vinyl chords and relaxed drums', icon: Music, color: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20' },
    { label: 'Cyberpunk Synthwave', prompt: 'dark cyberpunk synthwave with driving bassline and gated snares', icon: Zap, color: 'text-purple-300 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20' },
    { label: 'Deep House Groove', prompt: 'deep melodic house with punchy kick, sub bass, and warm chords', icon: Disc3, color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20' },
    { label: 'Liquid Drum & Bass', prompt: 'fast liquid drum and bass with rolling breaks and reese bass at 174 bpm', icon: Radio, color: 'text-rose-300 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20' },
    { label: 'Ambient Drone Matrix', prompt: 'deep ambient meditation soundscape with slow evolving chords and no drums', icon: Sparkles, color: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20' },
    { label: 'Indie Rock Riff', prompt: 'rock beat with tight drums, driving bass, and distorted guitar lead', icon: Flame, color: 'text-orange-300 border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20' },
];

const STUDIO_ENGINES = [
    {
        id: 'simple' as const,
        title: 'Code Engine',
        subtitle: 'Live Pattern Editor',
        description: 'Algorithmic Strudel mini-notation live editor with real-time waveform stack and frequency spectrum analyzer.',
        icon: Code,
        accent: 'from-lime-500/20 to-emerald-500/5 border-lime-500/30 text-lime-300',
        badge: 'Live Coding'
    },
    {
        id: 'arrangement' as const,
        title: 'Arrangement DAW',
        subtitle: 'Timeline & Clips',
        description: 'Multi-track block sequencer to build, arrange, and automate intro, verse, drop, and outro song sections.',
        icon: Layers,
        accent: 'from-cyan-500/20 to-blue-500/5 border-cyan-500/30 text-cyan-300',
        badge: 'Sequencer'
    },
    {
        id: 'garden' as const,
        title: 'Synplant Garden',
        subtitle: 'Genetic Sound Breeding',
        description: 'Grow sonic branches, mutate pattern genomes, and extract musical strands from audio with Genopatch.',
        icon: Sprout,
        accent: 'from-emerald-500/20 to-teal-500/5 border-emerald-500/30 text-emerald-300',
        badge: 'Evolutionary'
    },
    {
        id: 'djmixer' as const,
        title: 'DJ Dual Decks',
        subtitle: 'Mixer & Performance',
        description: 'Dual Strudel turntables, interactive crossfader, stem high-pass/low-pass filters, and transition FX.',
        icon: Disc3,
        accent: 'from-amber-500/20 to-orange-500/5 border-amber-500/30 text-amber-300',
        badge: 'Performance'
    },
    {
        id: 'ssnn' as const,
        title: 'SSNN Neural Matrix',
        subtitle: '960-Neuron LIF Synth',
        description: 'Spiking neural network with 32 layers, closed-loop FFT learning, comb/pulse DSP, and tape recording buffers.',
        icon: Brain,
        accent: 'from-amber-500/20 to-rose-500/5 border-amber-500/30 text-amber-400',
        badge: 'Neural Engine'
    },
    {
        id: 'voice' as const,
        title: 'Voice Lab',
        subtitle: 'AI Vocal Synthesizer',
        description: 'Microphone speech-to-music AI, neural timbre transformations, formants, vocoder, and generative vocal soundscapes.',
        icon: Mic,
        accent: 'from-sky-500/20 to-indigo-500/5 border-sky-500/30 text-sky-300',
        badge: 'Speech & Timbre'
    }
];

const STARTER_PRESETS = [
    {
        title: 'Berlin Techno Club',
        bpm: 136,
        tags: ['TR-909', 'Acid Bass', 'Peak-time'],
        prompt: 'dark underground berlin techno with heavy 909 kick, 16th-note rolling bassline, and filtered synth stabs at 136 bpm',
        color: 'border-cyan-500/20 hover:border-cyan-400/50'
    },
    {
        title: 'Midnight Lo-Fi Study',
        bpm: 86,
        tags: ['Vinyl Beats', 'Rhodes', 'Chill'],
        prompt: 'dusty lofi hip hop with vinyl crackle, warm rhodes piano chords, lazy boom bap drums at 86 bpm',
        color: 'border-amber-500/20 hover:border-amber-400/50'
    },
    {
        title: 'Cyberwave 1984',
        bpm: 124,
        tags: ['Synthwave', 'Arpeggio', 'Retro'],
        prompt: 'retro 80s outrun synthwave with driving analog bass arpeggio, gated reverb snare, and neon synth lead',
        color: 'border-purple-500/20 hover:border-purple-400/50'
    },
    {
        title: 'Interstellar Ambient',
        bpm: 72,
        tags: ['Drone', 'Shimmer', 'Zero-G'],
        prompt: 'space ambient drone with slow evolving harmonic pads, pitch shimmer reverb, and subtle sub pulse',
        color: 'border-blue-500/20 hover:border-blue-400/50'
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

    return (
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto studio-scrollbar bg-[#090b10] text-slate-100 p-3 sm:p-6 lg:p-8 select-none pb-24 lg:pb-8">
            {/* Top Brand Banner & Hero */}
            <div className="max-w-6xl mx-auto w-full flex flex-col gap-6 sm:gap-8">
                
                {/* 1. Hero Section */}
                <header className="relative flex flex-col items-center justify-center pt-2 sm:pt-4 pb-2 text-center">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[420px] h-[200px] sm:h-[260px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <StrudelLogo variant="hero" isPlaying={isPlaying} size="lg" />

                    {/* Quick System Status Pills */}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 sm:px-3 py-1 text-slate-400">
                            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                            <span>{isConnected ? 'Socket Linked' : 'Standalone'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 sm:px-3 py-1 text-slate-400">
                            <span className={`h-2 w-2 rounded-full ${isAudioReady ? 'bg-cyan-400' : 'bg-amber-400'}`} />
                            <span>{isAudioReady ? 'Audio Active' : 'Audio Suspended'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 sm:px-3 py-1 text-cyan-300 tabular-nums font-mono">
                            <span>{bpm || 120} BPM</span>
                        </div>
                        {activeTracksCount > 0 && (
                            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 sm:px-3 py-1 text-emerald-300 font-mono">
                                <span>{activeTracksCount} Active Tracks</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* 2. Interactive AI Prompt Bar */}
                <section className="relative flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#12161f] p-3.5 sm:p-5 shadow-[0_4px_28px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <div className="flex items-center gap-2 font-medium">
                            <Sparkles className="h-4 w-4 text-cyan-400 shrink-0 animate-pulse" />
                            <span className="text-slate-200">AI Prompt Generator</span>
                            <span className="text-slate-500 hidden sm:inline">· Type any genre, instrument, BPM, or music vibe</span>
                        </div>
                        {!isAudioReady && (
                            <button
                                type="button"
                                onClick={onInitAudio}
                                className="flex items-center gap-1.5 rounded-md bg-cyan-400/10 border border-cyan-400/30 px-2.5 py-1 text-[11px] font-bold text-cyan-300 hover:bg-cyan-400/20 transition-colors shrink-0"
                            >
                                <Volume2 className="h-3.5 w-3.5" />
                                <span>Init Audio</span>
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                            type="text"
                            value={inputPrompt}
                            onChange={(e) => setInputPrompt(e.target.value)}
                            placeholder="e.g. 'Acid techno 303', 'warm lofi chords', 'rock beat'..."
                            disabled={isThinking}
                            className="w-full rounded-xl border border-white/10 bg-[#090b0f] px-3.5 sm:px-4 py-3 sm:py-3.5 text-base sm:text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 transition-all font-sans"
                        />
                        <button
                            type="submit"
                            disabled={isThinking || !inputPrompt.trim()}
                            className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 sm:py-3.5 text-sm font-bold transition-all min-h-[44px] ${
                                isThinking
                                    ? 'bg-cyan-500/50 text-slate-900 cursor-wait'
                                    : inputPrompt.trim()
                                        ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                                        : 'bg-white/10 text-slate-400 hover:bg-white/15'
                            }`}
                        >
                            {isThinking ? (
                                <>
                                    <div className="h-4 w-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    <span>Generate</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Quick 1-Click Genre Pills - Mobile Scrollable Carousel */}
                    <div className="flex items-center gap-1.5 pt-1 overflow-x-auto studio-scrollbar pb-1 -mx-1 px-1">
                        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider shrink-0 mr-1">Starters:</span>
                        {GENRE_PILLS.map((pill) => {
                            const PillIcon = pill.icon;
                            const isSelected = justTriggered === pill.label;
                            return (
                                <button
                                    key={pill.label}
                                    type="button"
                                    onClick={() => handlePillClick(pill.prompt, pill.label)}
                                    disabled={isThinking}
                                    className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${pill.color} ${
                                        isSelected ? 'ring-2 ring-cyan-400 scale-95' : ''
                                    }`}
                                >
                                    {isSelected ? <CheckCircle2 className="h-3 w-3" /> : <PillIcon className="h-3 w-3" />}
                                    <span>{pill.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* 3. Studio Engines Showcase Grid */}
                <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold tracking-tight text-white">Studio Engines</h2>
                            <p className="text-xs text-slate-400">Integrated suite of generative, algorithmic, and live performance tools</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onSelectView('simple')}
                            className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
                        >
                            <span>Open Code Workspace</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {STUDIO_ENGINES.map((engine) => {
                            const IconComponent = engine.icon;
                            return (
                                <div
                                    key={engine.id}
                                    onClick={() => onSelectView(engine.id)}
                                    className={`group relative flex flex-col justify-between rounded-xl border bg-gradient-to-b ${engine.accent} p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]`}
                                >
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-slate-100 group-hover:scale-110 transition-transform">
                                                <IconComponent className="h-5 w-5" />
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                                {engine.badge}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-white group-hover:text-cyan-200 transition-colors">
                                                {engine.title}
                                            </h3>
                                            <p className="text-xs font-medium text-slate-400 mt-0.5">
                                                {engine.subtitle}
                                            </p>
                                        </div>
                                        <p className="text-xs leading-relaxed text-slate-400">
                                            {engine.description}
                                        </p>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5 text-xs font-semibold text-slate-300 group-hover:text-white">
                                        <span>Launch Tool</span>
                                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 4. Curated Production Starter Kits */}
                <section className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-white">Curated Production Kits</h2>
                        <p className="text-xs text-slate-400">Instant one-click session templates ready for editing, live coding, and jamming</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {STARTER_PRESETS.map((preset) => (
                            <div
                                key={preset.title}
                                className={`flex flex-col justify-between rounded-xl border bg-[#11151d] p-4 transition-all ${preset.color} hover:bg-[#151a24]`}
                            >
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-mono text-cyan-300 font-bold">{preset.bpm} BPM</span>
                                        <div className="flex gap-1">
                                            {preset.tags.map(tag => (
                                                <span key={tag} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-400 font-medium">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <h4 className="text-sm font-bold text-white">{preset.title}</h4>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setJustTriggered(preset.title);
                                        onApplyTemplate(preset.prompt);
                                        setTimeout(() => setJustTriggered(null), 2500);
                                    }}
                                    disabled={isThinking}
                                    className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-2 text-xs font-semibold text-slate-200 hover:bg-cyan-400/10 hover:border-cyan-400/40 hover:text-cyan-200 transition-all"
                                >
                                    <Play className="h-3 w-3 fill-current" />
                                    <span>Load Session</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 5. Bottom Transport & Direct DAW CTA Bar */}
                <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#12161f] p-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onTogglePlayback}
                            className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold transition-all ${
                                isPlaying
                                    ? 'bg-rose-500 text-white shadow-[0_0_16px_rgba(244,63,94,0.4)]'
                                    : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.3)]'
                            }`}
                            title={isPlaying ? 'Stop Playback' : 'Start Playback'}
                        >
                            {isPlaying ? <Square className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                        </button>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">
                                {isPlaying ? 'Studio Engine Playing' : 'Master Engine Idle'}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                                {bpm} BPM · {activeTracksCount} active stems
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onSelectView('simple')}
                            className="flex items-center gap-2 rounded-xl bg-cyan-400/10 border border-cyan-400/40 px-4 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/20 transition-all"
                        >
                            <span>Enter Full Studio DAW</span>
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </section>

            </div>
        </div>
    );
}
