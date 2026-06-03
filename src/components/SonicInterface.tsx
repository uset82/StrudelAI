'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSonicSocket } from '@/hooks/useSonicSocket';
import { Mic, MicOff, Play, Square, Code, Layers, LayoutGrid, Sprout, Disc3, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { SpectrumAnalyzer } from './SpectrumAnalyzer';
import { StrudelCodeView } from './StrudelCodeView';
import { DJMixerView } from './DJMixerView';
import { SynplantGarden } from './SynplantGarden';
import { evalStrudelCode, buildArrangementCode, buildStrudelCode } from '@/lib/strudel/engine';
import { TrackStrip } from './TrackStrip';
import { ArrangementView, createDefaultArrangement } from './ArrangementView';
import { ArrangementState } from '@/types/sonic';

const RIGHT_PANEL_DEFAULT_WIDTH = 520;
const RIGHT_PANEL_MAX_WIDTH = 900;
const RIGHT_PANEL_MIN_WIDTH = 320;
const RIGHT_PANEL_COLLAPSED_WIDTH = 44;
const SPLITTER_WIDTH = 10;
const UI_STORAGE_KEYS = {
    rightPanelWidth: 'aether:rightPanelWidth',
    rightPanelCollapsed: 'aether:rightPanelCollapsed',
} as const;

type ViewMode = 'simple' | 'arrangement' | 'garden' | 'djmixer';

const VIEW_MODE_META: Record<ViewMode, {
    label: string;
    title: string;
    subtitle: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = {
    simple: {
        label: 'Code',
        title: 'Strudel Engine',
        subtitle: 'Live pattern workspace',
        Icon: LayoutGrid,
    },
    arrangement: {
        label: 'Arrange',
        title: 'Arrangement',
        subtitle: 'Timeline and clips',
        Icon: Layers,
    },
    garden: {
        label: 'Garden',
        title: 'Synplant Garden',
        subtitle: 'Pattern shaping',
        Icon: Sprout,
    },
    djmixer: {
        label: 'DJ',
        title: 'DJ Mixer',
        subtitle: 'Decks and performance',
        Icon: Disc3,
    },
};

function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

type ChatMessage = {
    role: 'user' | 'assistant' | 'system' | 'error';
    label: string;
    body: string;
};

function toChatMessage(raw: string): ChatMessage | null {
    const text = raw.trim();
    if (!text) return null;

    if (text.startsWith('You:')) {
        return { role: 'user', label: 'You', body: text.replace(/^You:\s*/, '') };
    }

    if (text.startsWith('AI Thought:')) {
        return { role: 'assistant', label: 'Aether thought', body: text.replace(/^AI Thought:\s*/, '') };
    }

    if (text.startsWith('AI:')) {
        return { role: 'assistant', label: 'Aether', body: text.replace(/^AI:\s*/, '') };
    }

    if (/^(Error:|Syntax error:|Error persists:)/.test(text)) {
        return { role: 'error', label: 'Error', body: text.replace(/^(Error:|Syntax error:|Error persists:)\s*/, '') };
    }

    if (text.startsWith('Fixed code:')) {
        return { role: 'assistant', label: 'Aether fix', body: text.replace(/^Fixed code:\s*/, '') };
    }

    if (text.startsWith('System:')) {
        const body = text.replace(/^System:\s*/, '');
        if (/^(Reconnecting|Connected|Disconnected|WebSocket unavailable|Engine applied)/.test(body)) {
            return null;
        }
        return { role: 'system', label: 'Status', body };
    }

    return { role: 'system', label: 'Status', body: text };
}

type BrowserRecognitionEvent = {
    results: Array<Array<{ transcript: string }>>;
};

type BrowserRecognitionErrorEvent = {
    error: string;
};

type BrowserSpeechRecognition = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onstart: (() => void) | null;
    onresult: ((event: BrowserRecognitionEvent) => void) | null;
    onerror: ((event: BrowserRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window &
    typeof globalThis & {
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
        SpeechRecognition?: SpeechRecognitionConstructor;
    };

type AudioWindow = Window &
    typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
    };

export default function SonicInterface() {
    const {
        state,
        isConnected,
        messages,
        sendCommand,
        startSession,
        togglePlayback,
        currentCode,
        analyser,
        isAudioReady,
        isThinking,
        setCurrentCode,
        toggleMute,
        toggleSolo: toggleSoloTrack,
        setVolume,
        setTrackFx,
        setBpm,
        setTrackPattern,
    } = useSonicSocket();

    const [isRecording, setIsRecording] = useState(false);
    const [, setTranscript] = useState('');
    const [speechError, setSpeechError] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        const speechWindow = window as SpeechWindow;
        const supported = Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
        return supported ? null : 'Web Speech API not supported. Please use Chrome or Edge.';
    });
    const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
    const isRecordingRef = useRef(false);
    const logRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // View mode: 'simple' (tracks), 'arrangement' (Ableton-style), 'garden' (Synplant), or 'djmixer' (DJ mode)
    const [viewMode, setViewMode] = useState<ViewMode>('simple');
    const [arrangement, setArrangement] = useState<ArrangementState>(() => createDefaultArrangement());
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isCompactViewport, setIsCompactViewport] = useState(false);
    const lastLiveCodeRef = useRef<string | null>(null);

    const clampRightPanelWidth = useCallback((width: number) => {
        if (typeof window === 'undefined') return clampNumber(width, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH);

        const minForViewport = Math.min(
            RIGHT_PANEL_MIN_WIDTH,
            Math.max(240, Math.round(window.innerWidth * 0.28))
        );
        const maxForViewport = Math.min(
            RIGHT_PANEL_MAX_WIDTH,
            Math.max(minForViewport, window.innerWidth - 420 - SPLITTER_WIDTH)
        );

        return clampNumber(width, minForViewport, maxForViewport);
    }, []);

    const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
        if (typeof window === 'undefined') return RIGHT_PANEL_DEFAULT_WIDTH;
        const stored = window.localStorage.getItem(UI_STORAGE_KEYS.rightPanelWidth);
        const storedValue = stored ? Number(stored) : Number.NaN;
        const defaultForViewport = Math.round(Math.min(RIGHT_PANEL_DEFAULT_WIDTH, window.innerWidth * 0.46));
        const raw = Number.isFinite(storedValue) ? storedValue : defaultForViewport;
        return clampRightPanelWidth(raw);
    });
    const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem(UI_STORAGE_KEYS.rightPanelCollapsed) === '1';
    });
    const rightPanelResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
    const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(UI_STORAGE_KEYS.rightPanelWidth, String(Math.round(rightPanelWidth)));
    }, [rightPanelWidth]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(UI_STORAGE_KEYS.rightPanelCollapsed, isRightPanelCollapsed ? '1' : '0');
    }, [isRightPanelCollapsed]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(max-width: 1023px)');
        const update = () => setIsCompactViewport(media.matches);

        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleResize = () => {
            if (isRightPanelCollapsed) return;
            setRightPanelWidth((current) => clampRightPanelWidth(current));
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampRightPanelWidth, isRightPanelCollapsed]);

    useEffect(() => {
        if (!isResizingRightPanel) return;
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        return () => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
        };
    }, [isResizingRightPanel]);

    // Sync arrangement playback with audio
    useEffect(() => {
        if (viewMode !== 'arrangement' || !isAudioReady) return;

        if (arrangement.isPlaying) {
            if (!lastLiveCodeRef.current) {
                const fallback = state ? buildStrudelCode(state) : currentCode;
                lastLiveCodeRef.current = currentCode && !currentCode.startsWith('//') ? currentCode : fallback;
            }
            const code = buildArrangementCode(arrangement);
            setCurrentCode(code);
            evalStrudelCode(code);
            return;
        }

        // When paused in arrangement view, restore whatever was playing before we entered arrangement playback.
        if (lastLiveCodeRef.current) {
            const restore = lastLiveCodeRef.current;
            lastLiveCodeRef.current = null;
            setCurrentCode(restore);
            evalStrudelCode(restore);
        }
    }, [arrangement, viewMode, isAudioReady, currentCode, state, setCurrentCode]);

    const handleArrangementUpdate = useCallback((newArrangement: ArrangementState) => {
        setArrangement(newArrangement);
    }, []);

    const handleRunCode = useCallback((code: string) => {
        console.log('[SonicInterface] Running code manually:', code);
        evalStrudelCode(code);
    }, []);

    // Simple Web Speech API wrapper
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const speechWindow = window as SpeechWindow;
        const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) {
            console.error('Web Speech API not supported in this browser');
            return;
        }

        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = false;  // Single utterance mode - waits for pause
        recognition.interimResults = true;  // Show interim results while speaking
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log('[Speech] Recognition started');
            setSpeechError(null);
        };

        recognition.onresult = (event: BrowserRecognitionEvent) => {
            console.log('[Speech] Result received:', event);
            // Get the latest result (last in the array)
            const lastResultIndex = event.results.length - 1;
            const result = event.results[lastResultIndex];
            const transcript = result?.[0]?.transcript ?? '';
            const isFinal = (result as unknown as { isFinal?: boolean })?.isFinal ?? true;

            console.log('[Speech] Transcript:', transcript, 'isFinal:', isFinal);
            setTranscript(transcript);

            // Fill the input field with the transcript - user will press Enter to send
            if (inputRef.current) {
                inputRef.current.value = transcript;
            }

            // When final, stop recording but don't send - user reviews and sends manually
            if (isFinal) {
                console.log('[Speech] Final transcript, filling input:', transcript);
                setIsRecording(false);
                isRecordingRef.current = false;
                // Focus the input so user can edit or press Enter to send
                inputRef.current?.focus({ preventScroll: true });
            }
        };

        recognition.onerror = (event: BrowserRecognitionErrorEvent) => {
            console.warn('[Speech] Error:', event.error);
            if (event.error === 'network') {
                setSpeechError('Speech service unreachable. Check your internet connection and try again.');
                isRecordingRef.current = false;
                setIsRecording(false);
                try {
                    recognition.stop();
                } catch (e) {
                    console.warn('[Speech] Failed to stop after network error:', e);
                }
            } else if (event.error === 'no-speech') {
                setSpeechError('No speech detected. Still listening...');
            } else if (event.error === 'audio-capture') {
                setSpeechError('Microphone not found. Plug in or enable a microphone.');
                setIsRecording(false);
                isRecordingRef.current = false;
            } else if (event.error === 'not-allowed') {
                setSpeechError('Microphone access denied. Please allow microphone access.');
                setIsRecording(false);
                isRecordingRef.current = false;
            } else {
                setSpeechError('Speech recognition encountered a problem. Please retry.');
                setIsRecording(false);
                isRecordingRef.current = false;
                try {
                    recognition.stop();
                } catch (e) {
                    console.warn('[Speech] Failed to stop after generic error:', e);
                }
            }
        };

        recognition.onend = () => {
            console.log('[Speech] Recognition ended');
            // In single utterance mode, recognition ends after user stops speaking
            // Don't auto-restart - user can click mic again for another command
            setIsRecording(false);
            isRecordingRef.current = false;
        };

        recognitionRef.current = recognition;

        return () => {
            try {
                recognition.stop();
            } catch {
                // ignore
            }
            recognitionRef.current = null;
        };
    }, [sendCommand]);

    const chatMessages = useMemo(
        () => messages.map(toChatMessage).filter((message): message is ChatMessage => Boolean(message)).slice(-40),
        [messages]
    );

    // Always keep chat scrolled to the latest message after layout settles.
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const el = logRef.current;
            if (!el) return;
            el.scrollTop = el.scrollHeight;
        });
        return () => window.cancelAnimationFrame(frame);
    }, [chatMessages.length, isThinking]);

    // Auto-focus input when audio becomes ready
    useEffect(() => {
        if (isAudioReady && inputRef.current) {
            console.log('[SonicInterface] Audio ready, focusing input');
            setTimeout(() => {
                inputRef.current?.focus({ preventScroll: true });
            }, 100);
        }
    }, [isAudioReady]);

    useEffect(() => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        if (isRecording) {
            isRecordingRef.current = true;
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                queueMicrotask(() => {
                    setSpeechError('You appear to be offline. Speech recognition needs an internet connection.');
                    setIsRecording(false);
                });
                return;
            }
            try {
                recognition.start();
                console.log('[Speech] Called start()');
            } catch {
                console.warn('[Speech] Failed to start');
                queueMicrotask(() => {
                    setSpeechError('Unable to access the microphone. Check permissions and try again.');
                    setIsRecording(false);
                });
            }
        } else {
            isRecordingRef.current = false;
            try {
                recognition.stop();
            } catch {
                console.warn('[Speech] Failed to stop');
            }
        }
    }, [isRecording]);

    const toggleRecording = useCallback(async () => {
        setSpeechError(null);
        if (!isRecording) {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                setIsRecording(true);
            } catch {
                console.warn('[Speech] Mic permission denied or unavailable');
                setSpeechError('Microphone permission is required to listen. Please allow mic access.');
                setIsRecording(false);
            }
            return;
        }
        setIsRecording(false);
    }, [isRecording]);

    const testAudio = () => {
        const audioWindow = window as AudioWindow;
        const Ctx = audioWindow.AudioContext || audioWindow.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
        console.log('Test beep played');
    };

    const beginResizeRightPanel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        if (isRightPanelCollapsed) setIsRightPanelCollapsed(false);
        rightPanelResizeRef.current = { startX: e.clientX, startWidth: rightPanelWidth };
        setIsResizingRightPanel(true);
    }, [isRightPanelCollapsed, rightPanelWidth]);

    const updateResizeRightPanel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!isResizingRightPanel || !rightPanelResizeRef.current) return;
        const dx = e.clientX - rightPanelResizeRef.current.startX;
        const next = rightPanelResizeRef.current.startWidth - dx;
        setRightPanelWidth(clampRightPanelWidth(next));
    }, [clampRightPanelWidth, isResizingRightPanel]);

    const endResizeRightPanel = useCallback(() => {
        if (!isResizingRightPanel) return;
        setIsResizingRightPanel(false);
        rightPanelResizeRef.current = null;
    }, [isResizingRightPanel]);

    const activeView = VIEW_MODE_META[viewMode];
    const ActiveViewIcon = activeView.Icon;
    const trackEntries = state?.tracks ? Object.entries(state.tracks) : [];
    const activeTrackCount = trackEntries.filter(([, track]) => Boolean(track.pattern?.trim()) && !track.muted).length;
    const isPlaying = Boolean(state?.isPlaying);
    const bpm = state?.bpm ?? 0;
    const shouldCollapseRightPanel = isRightPanelCollapsed && !isCompactViewport;

    return (
        <div className="min-h-dvh w-full overflow-x-hidden bg-[#101216] text-slate-200 selection:bg-cyan-400/20 selection:text-cyan-50 lg:h-screen lg:overflow-hidden">
            <div className="flex min-h-dvh min-w-0 flex-col lg:h-full lg:flex-row lg:overflow-hidden">
                <section className="order-5 flex min-w-0 flex-1 flex-col border-r border-white/10 bg-[#12161d] max-lg:w-full max-lg:border-b max-lg:border-r-0 lg:order-1 lg:h-screen">
                    <header className="flex min-h-16 shrink-0 items-center justify-between gap-5 border-b border-white/10 bg-[#171c24] px-5 max-lg:w-full max-lg:max-w-full max-lg:flex-wrap max-lg:gap-3 max-lg:px-3 max-lg:py-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-300">
                                <ActiveViewIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="truncate text-sm font-semibold tracking-wide text-slate-50">{activeView.title}</h2>
                                <p className="truncate text-xs text-slate-500">{activeView.subtitle}</p>
                            </div>
                        </div>

                        <div className="flex min-w-0 flex-1 items-center justify-center max-lg:order-3 max-lg:w-full max-lg:flex-none max-lg:justify-start max-lg:overflow-x-auto studio-scrollbar">
                            <div className="flex rounded-lg border border-white/10 bg-[#0d1117] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                {(Object.entries(VIEW_MODE_META) as Array<[ViewMode, typeof activeView]>).map(([mode, meta]) => {
                                    const Icon = meta.Icon;
                                    const active = viewMode === mode;
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setViewMode(mode)}
                                            className={`flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors ${active
                                                ? 'bg-slate-100 text-slate-950 shadow-sm'
                                                : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
                                                }`}
                                            aria-pressed={active}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {meta.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 max-lg:hidden">
                            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                                <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                                <span className="text-xs font-medium text-slate-400">{isConnected ? 'Linked' : 'Offline'}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsRightPanelCollapsed((v) => !v)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
                                aria-label={isRightPanelCollapsed ? 'Show control panel' : 'Hide control panel'}
                                title={isRightPanelCollapsed ? 'Show control panel' : 'Hide control panel'}
                            >
                                {isRightPanelCollapsed ? (
                                    <ChevronLeft className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </header>

                    <div className="min-h-0 bg-[#11151b] max-lg:w-full max-lg:max-w-full lg:flex-1">
                        <div className={`min-h-0 flex-col gap-4 p-5 max-lg:w-full max-lg:max-w-full max-lg:p-3 lg:h-full ${viewMode === 'simple' ? 'flex' : 'hidden'}`}>
                            <section className="flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0e1218] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] max-lg:h-[430px] max-lg:w-full max-lg:max-w-full max-sm:h-[390px] lg:flex-1">
                                <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Code className="h-4 w-4 text-cyan-300" />
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-100">Code Workspace</h3>
                                            <p className="text-xs text-slate-500">Live Strudel pattern</p>
                                        </div>
                                    </div>
                                    <div className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-400 max-sm:hidden">
                                        {isConnected ? 'Socket linked' : 'Standalone mode'}
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 p-4 max-sm:p-3">
                                    <StrudelCodeView
                                        code={currentCode}
                                        tracks={state?.tracks}
                                        isConnected={isConnected}
                                        onCodeChange={setCurrentCode}
                                        onRun={handleRunCode}
                                    />
                                </div>
                            </section>

                            <section className="flex h-[32%] min-h-[220px] min-w-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0e1218] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] max-lg:h-[180px] max-lg:min-h-0 max-lg:w-full max-lg:max-w-full max-lg:flex-none max-sm:h-[150px]">
                                <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-100">Frequency Spectrum</h3>
                                        <p className="text-xs text-slate-500">Output monitor</p>
                                    </div>
                                    <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-200 max-sm:hidden">
                                        Analyzer
                                    </span>
                                </div>
                                <div className="min-h-0 flex-1">
                                    <SpectrumAnalyzer analyser={analyser} />
                                </div>
                            </section>
                        </div>

                        <div className={`min-h-[620px] overflow-hidden lg:h-full lg:min-h-0 ${viewMode === 'arrangement' ? '' : 'hidden'}`}>
                            <ArrangementView
                                arrangement={arrangement}
                                onUpdate={handleArrangementUpdate}
                                onBuildCode={buildArrangementCode}
                            />
                        </div>

                        <div className={`min-h-[620px] overflow-hidden lg:h-full lg:min-h-0 ${viewMode === 'garden' ? '' : 'hidden'}`}>
                            <SynplantGarden
                                state={state}
                                onApplyPattern={setTrackPattern}
                            />
                        </div>

                        <div className={`min-h-[620px] overflow-y-auto overflow-x-hidden lg:h-full lg:min-h-0 ${viewMode === 'djmixer' ? '' : 'hidden'}`}>
                            <DJMixerView bpm={bpm || 120} />
                        </div>
                    </div>
                </section>

                <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize control panel"
                    className="group relative h-screen shrink-0 cursor-col-resize select-none border-x border-white/10 bg-[#0b0e12] transition-colors hover:bg-[#151a21] max-lg:hidden"
                    style={{ width: SPLITTER_WIDTH, touchAction: 'none' }}
                    onPointerDown={beginResizeRightPanel}
                    onPointerMove={updateResizeRightPanel}
                    onPointerUp={endResizeRightPanel}
                    onPointerCancel={endResizeRightPanel}
                    onDoubleClick={() => {
                        setIsRightPanelCollapsed(false);
                        setRightPanelWidth(clampRightPanelWidth(RIGHT_PANEL_DEFAULT_WIDTH));
                    }}
                >
                    <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10" aria-hidden="true" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-[#171c24] px-0.5 py-2 opacity-60 transition-opacity group-hover:opacity-100">
                        <GripVertical className="h-4 w-4 text-slate-500" />
                    </div>
                </div>

                <aside
                    className={`relative order-1 flex shrink-0 flex-col border-l border-white/10 bg-[#0b0e12] transition-[width] duration-200 ease-out max-lg:contents lg:order-2 lg:h-screen ${shouldCollapseRightPanel ? 'overflow-hidden p-0' : 'p-5 lg:overflow-x-hidden lg:overflow-y-auto'}`}
                    style={{
                        width: shouldCollapseRightPanel
                            ? RIGHT_PANEL_COLLAPSED_WIDTH
                            : isCompactViewport
                                ? '100%'
                                : `min(${rightPanelWidth}px, 100vw)`,
                    }}
                >
                    {shouldCollapseRightPanel ? (
                        <button
                            type="button"
                            className="flex h-full w-full items-center justify-center text-slate-500 transition-colors hover:text-cyan-200"
                            onClick={() => setIsRightPanelCollapsed(false)}
                            aria-label="Show control panel"
                            title="Show control panel"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                    ) : (
                        <>
                            <header className="order-1 shrink-0 border-b border-white/10 pb-5 max-lg:w-full max-lg:bg-[#0b0e12] max-lg:px-3 max-lg:pt-3 max-lg:pb-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 max-sm:h-10 max-sm:w-10">
                                            <Mic className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h1 className="truncate text-2xl font-semibold tracking-tight text-white max-sm:text-xl">Aether</h1>
                                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 max-sm:text-[10px]">Sonic workstation</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsHelpOpen(true)}
                                        className="shrink-0 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-cyan-300/30 hover:text-cyan-100 max-sm:hidden"
                                    >
                                        Voice guide
                                    </button>
                                </div>

                                <div className="mt-5 grid grid-cols-3 gap-2 max-lg:mt-4 max-sm:gap-1.5">
                                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 max-sm:px-2">
                                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">System</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                                            <span className="text-sm font-medium text-slate-200 max-sm:text-xs">{isConnected ? 'Linked' : 'Offline'}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={togglePlayback}
                                        className={`rounded-lg border px-3 py-2 text-left transition-colors max-sm:px-2 ${isPlaying
                                            ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100'
                                            }`}
                                        aria-label={isPlaying ? 'Stop playback' : 'Start playback'}
                                    >
                                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Transport</p>
                                        <div className="mt-1 flex items-center gap-2 text-sm font-medium max-sm:text-xs">
                                            {isPlaying ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                                            {isPlaying ? 'Playing' : 'Idle'}
                                        </div>
                                    </button>
                                    <div
                                        className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 max-sm:px-2"
                                        onWheel={(e) => {
                                            if (state?.bpm) {
                                                const delta = e.deltaY > 0 ? -5 : 5;
                                                setBpm(Math.max(60, Math.min(240, state.bpm + delta)));
                                            }
                                        }}
                                        title="Scroll to change BPM"
                                    >
                                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Tempo</p>
                                        <p className="mt-1 text-sm font-semibold tabular-nums text-slate-100 max-sm:text-xs">{bpm} BPM</p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={testAudio}
                                    className="mt-3 text-xs font-medium text-slate-500 transition-colors hover:text-cyan-200"
                                >
                                    Test system audio
                                </button>
                            </header>

                            {!isAudioReady && (
                                <section className="order-2 shrink-0 border-b border-white/10 py-5 max-lg:w-full max-lg:bg-[#0b0e12] max-lg:px-3 max-lg:py-4">
                                    <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 max-sm:p-3">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-300/15 text-cyan-100 max-sm:h-9 max-sm:w-9">
                                                <Mic className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h2 className="text-sm font-semibold text-white">Start audio engine</h2>
                                                <p className="mt-1 text-sm leading-5 text-slate-400 max-sm:text-xs">Enable playback, voice input, and live code evaluation.</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 max-sm:grid-cols-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    startSession();
                                                }}
                                                className="min-h-11 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
                                            >
                                                Initialize session
                                            </button>
                                            <button
                                                type="button"
                                                onClick={testAudio}
                                                className="min-h-11 rounded-lg border border-white/10 px-3 py-2.5 text-xs font-medium text-slate-400 transition-colors hover:text-cyan-100"
                                            >
                                                Test
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            )}

                            <section
                                className="order-4 flex min-h-0 flex-1 flex-col border-b border-white/10 py-5 lg:min-h-[360px] max-lg:h-[360px] max-lg:w-full max-lg:flex-none max-lg:bg-[#0b0e12] max-lg:px-3 max-lg:py-4 max-sm:h-[340px]"
                                style={{ overflowAnchor: 'none' }}
                            >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold text-slate-100">Chat</h2>
                                    <span className="text-xs text-slate-500">{chatMessages.length > 0 ? `${chatMessages.length} messages` : 'Ready'}</span>
                                </div>

                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-cyan-300/25 bg-[#07090c] shadow-[0_0_34px_rgba(34,211,238,0.05)]">
                                    <div
                                        ref={logRef}
                                        className="studio-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
                                    >
                                        <div className="flex flex-col gap-3">
                                            {chatMessages.length === 0 && !isThinking && (
                                                <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.025] px-4 py-6 text-sm leading-6 text-slate-500">
                                                    Ask for a groove, remix a track, or paste Strudel code.
                                                </div>
                                            )}

                                            {chatMessages.map((message, i) => {
                                                const isUser = message.role === 'user';
                                                const isAssistant = message.role === 'assistant';
                                                const isError = message.role === 'error';
                                                return (
                                                    <div
                                                        key={`${message.label}-${i}`}
                                                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div className={`max-w-[88%] rounded-lg border px-3 py-2 text-sm leading-6 ${isUser
                                                            ? 'border-cyan-300/35 bg-cyan-300/12 text-cyan-50'
                                                            : isAssistant
                                                                ? 'border-white/10 bg-white/[0.04] text-slate-100'
                                                                : isError
                                                                    ? 'border-rose-300/30 bg-rose-400/10 text-rose-100'
                                                                    : 'border-white/8 bg-white/[0.025] text-slate-400'
                                                            }`}
                                                        >
                                                            <div className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${isUser
                                                                ? 'text-cyan-200/70'
                                                                : isAssistant
                                                                    ? 'text-violet-200/80'
                                                                    : isError
                                                                        ? 'text-rose-200/80'
                                                                        : 'text-slate-600'
                                                                }`}
                                                            >
                                                                {message.label}
                                                            </div>
                                                            <div className="whitespace-pre-wrap break-words">{message.body}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {isThinking && (
                                                <div className="flex justify-start">
                                                    <div className="max-w-[88%] animate-pulse rounded-lg border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-sm leading-6 text-violet-100">
                                                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/80">Aether</div>
                                                        Thinking...
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="border-t border-white/10 p-3">
                                        <div className={`group relative flex items-center gap-3 rounded-lg border bg-[#10151b] px-3 py-3 transition-colors ${isAudioReady ? 'border-cyan-300/25 focus-within:border-cyan-200/50' : 'border-white/10 focus-within:border-cyan-300/35'}`}>
                                            <button
                                                type="button"
                                                onClick={() => toggleRecording()}
                                                disabled={!isAudioReady}
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${isRecording
                                                    ? 'bg-rose-500/15 text-rose-300'
                                                    : 'bg-white/[0.04] text-cyan-200 hover:bg-cyan-300/10'
                                                    } ${!isAudioReady ? 'cursor-not-allowed opacity-50' : ''}`}
                                                aria-label={isRecording ? 'Stop listening' : 'Start voice input'}
                                            >
                                                {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                                            </button>

                                            <div className="relative min-w-0 flex-1">
                                                {isRecording && (
                                                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-medium text-rose-300">Listening...</span>
                                                )}
                                                <input
                                                    ref={inputRef}
                                                    id="command-input"
                                                    name="command"
                                                    type="text"
                                                    autoComplete="off"
                                                    aria-label="Chat command input"
                                                    aria-describedby="command-hint"
                                                    className="w-full border-none bg-transparent pr-20 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none max-sm:pr-8 max-sm:text-base"
                                                    placeholder={isAudioReady ? 'Describe a pattern...' : 'Type a prompt...'}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            console.log('[Input] Enter pressed, sending:', e.currentTarget.value);
                                                            const value = e.currentTarget.value.trim();
                                                            if (value) {
                                                                sendCommand(value);
                                                                e.currentTarget.value = '';
                                                            }
                                                        }
                                                    }}
                                                    onFocus={() => console.log('[Input] Focused')}
                                                    onChange={(e) => console.log('[Input] Changed:', e.target.value)}
                                                    onClick={() => console.log('[Input] Clicked')}
                                                />
                                            </div>
                                            <div id="command-hint" className="pointer-events-none hidden rounded bg-white/[0.04] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500 group-focus-within:block max-sm:hidden">
                                                Enter
                                            </div>
                                        </div>
                                        {speechError && (
                                            <p className="mt-3 text-xs font-medium text-rose-300">{speechError}</p>
                                        )}
                                        {isAudioReady && !speechError && (
                                            <p className="mt-3 text-center text-xs text-slate-500">Audio engine ready</p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="order-3 shrink-0 border-b border-white/10 py-5 max-lg:w-full max-lg:bg-[#0b0e12] max-lg:px-3 max-lg:py-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold text-slate-100">Mixer Channels</h2>
                                    <span className="text-xs text-slate-500">{activeTrackCount} active</span>
                                </div>
                                {trackEntries.length > 0 ? (
                                    <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-2 studio-scrollbar">
                                        {trackEntries.map(([trackId, track]) => (
                                            <TrackStrip
                                                key={trackId}
                                                track={track}
                                                onMute={toggleMute}
                                                onSolo={toggleSoloTrack}
                                                onVolumeChange={setVolume}
                                                onTrackFx={setTrackFx}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.025] px-3 py-4 text-sm text-slate-500">
                                        Start the audio session to populate channel controls.
                                    </div>
                                )}
                            </section>

                            {isHelpOpen && (
                                <div className="absolute inset-0 z-50 overflow-y-auto bg-[#0b0e12]/95 p-6 backdrop-blur-xl">
                                    <div className="mx-auto max-w-2xl">
                                        <div className="mb-6 flex items-center justify-between gap-4">
                                            <div>
                                                <h2 className="text-xl font-semibold text-white">Voice Effects Guide</h2>
                                                <p className="text-sm text-slate-500">Useful phrases and mapped sound treatments.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsHelpOpen(false)}
                                                className="rounded-md border border-white/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-400 transition-colors hover:text-white"
                                            >
                                                Close
                                            </button>
                                        </div>

                                        <div className="space-y-5 text-sm leading-6 text-slate-300">
                                            <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                                <h3 className="mb-2 font-semibold text-slate-100">Voice Synthesis</h3>
                                                <ul className="space-y-2">
                                                    <li><strong className="text-white">Formant vowels:</strong> Add vowel sounds with .vowel(&quot;a e i o u&quot;).</li>
                                                    <li><strong className="text-white">Robot voice:</strong> Combine crush and vowel shaping.</li>
                                                    <li><strong className="text-white">Vocoder:</strong> Use moving band filters for synthetic voice color.</li>
                                                </ul>
                                            </section>

                                            <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                                <h3 className="mb-2 font-semibold text-slate-100">Effects</h3>
                                                <ul className="space-y-2">
                                                    <li><strong className="text-white">Filters:</strong> Low pass, high pass, and band pass movements.</li>
                                                    <li><strong className="text-white">Distortion:</strong> Bit crush, lo-fi, and drive treatments.</li>
                                                    <li><strong className="text-white">Spatial:</strong> Reverb, delay, and panning changes.</li>
                                                    <li><strong className="text-white">Modulation:</strong> Phaser, chorus, and tremolo.</li>
                                                </ul>
                                            </section>

                                            <section>
                                                <h3 className="mb-3 font-semibold text-slate-100">Style Presets</h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {['Robot Voice', 'Space Pad', 'Acid Bass', 'Lo-Fi Drums'].map((preset) => (
                                                        <div key={preset} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                                            <strong className="block text-slate-100">{preset}</strong>
                                                            <span className="text-xs text-slate-500">Ready voice command</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}
