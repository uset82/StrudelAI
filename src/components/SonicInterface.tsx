'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSonicSocket } from '@/hooks/useSonicSocket';
import { Mic, MicOff, Play, Square, Code, Layers, LayoutGrid } from 'lucide-react';
import { SpectrumAnalyzer } from './SpectrumAnalyzer';
import { StrudelCodeView } from './StrudelCodeView';
import { evalStrudelCode, buildArrangementCode } from '@/lib/strudel/engine';
import { TrackStrip } from './TrackStrip';
import { ArrangementView, createDefaultArrangement } from './ArrangementView';
import { ArrangementState } from '@/types/sonic';

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
        setBpm
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

    // View mode: 'simple' (tracks) or 'arrangement' (Ableton-style)
    const [viewMode, setViewMode] = useState<'simple' | 'arrangement'>('simple');
    const [arrangement, setArrangement] = useState<ArrangementState>(() => createDefaultArrangement());
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    // Sync arrangement playback with audio
    useEffect(() => {
        if (viewMode === 'arrangement' && isAudioReady) {
            if (arrangement.isPlaying) {
                const code = buildArrangementCode(arrangement);
                setCurrentCode(code);
                evalStrudelCode(code);
            } else {
                // Ensure audio stops when paused in arrangement mode
                evalStrudelCode('silence');
            }
        }
    }, [arrangement, viewMode, isAudioReady, setCurrentCode]);

    const handleArrangementUpdate = useCallback((newArrangement: ArrangementState) => {
        setArrangement(newArrangement);
        if (isAudioReady) {
            if (newArrangement.isPlaying) {
                const code = buildArrangementCode(newArrangement);
                setCurrentCode(code);
                evalStrudelCode(code);
            } else {
                evalStrudelCode('silence');
            }
        }
    }, [isAudioReady, setCurrentCode]);

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
                inputRef.current?.focus();
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

    // Always keep chat scrolled to the latest message
    useEffect(() => {
        queueMicrotask(() => {
            const el = logRef.current;
            if (!el) return;
            el.scrollTop = el.scrollHeight;
        });
    }, [messages]);

    // Auto-focus input when audio becomes ready
    useEffect(() => {
        if (isAudioReady && inputRef.current) {
            console.log('[SonicInterface] Audio ready, focusing input');
            setTimeout(() => {
                inputRef.current?.focus();
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

    return (
        <div className="min-h-screen bg-black text-cyan-500 font-sans selection:bg-cyan-900 selection:text-cyan-100 overflow-hidden flex">
            {/* LEFT PANEL: CODE & VISUALS or ARRANGEMENT */}
            <div className="w-1/2 h-screen border-r border-cyan-900/30 flex flex-col bg-gray-900/50 backdrop-blur-sm">
                {/* Header with View Toggle */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold tracking-widest text-cyan-400 flex items-center gap-2">
                            {viewMode === 'simple' ? (
                                <>
                                    <Code className="w-5 h-5" />
                                    STRUDEL ENGINE
                                </>
                            ) : (
                                <>
                                    <Layers className="w-5 h-5" />
                                    ARRANGEMENT
                                </>
                            )}
                        </h2>

                        {/* View Toggle Buttons */}
                        <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-700">
                            <button
                                onClick={() => setViewMode('simple')}
                                className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1
                                    ${viewMode === 'simple'
                                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                                        : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <LayoutGrid className="w-3 h-3" />
                                Simple
                            </button>
                            <button
                                onClick={() => setViewMode('arrangement')}
                                className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1
                                    ${viewMode === 'arrangement'
                                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                                        : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Layers className="w-3 h-3" />
                                Arrange
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`} />
                        <span className="text-xs font-mono text-cyan-700">{isConnected ? 'LINKED' : 'OFFLINE'}</span>
                    </div>
                </div>

                {/* Content Area */}
                {viewMode === 'simple' ? (
                    <div className="flex-1 flex flex-col p-4 overflow-hidden">
                        {/* Code Display Area */}
                        <StrudelCodeView
                            code={currentCode}
                            tracks={state?.tracks}
                            isConnected={isConnected}
                            onCodeChange={setCurrentCode}
                            onRun={handleRunCode}
                        />

                        {/* Spectrum Analyzer Area */}
                        <div className="h-1/3 mt-4 bg-black/60 rounded-lg border border-cyan-900/30 relative overflow-hidden">
                            <div className="absolute top-2 left-2 z-10">
                                <span className="text-xs font-mono text-cyan-400 bg-black/80 px-2 py-1 rounded border border-cyan-500/30">
                                    FREQUENCY SPECTRUM
                                </span>
                            </div>
                            <SpectrumAnalyzer analyser={analyser} />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden">
                        <ArrangementView
                            arrangement={arrangement}
                            onUpdate={handleArrangementUpdate}
                            onBuildCode={buildArrangementCode}
                        />
                    </div>
                )}
            </div>

            {/* RIGHT PANEL: CONTROLS & CHAT */}
            <div className="w-1/2 h-screen flex flex-col p-6 overflow-y-auto relative">
                {/* Header */}
                <header className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-900/20 rounded-lg border border-cyan-500/30">
                            <Mic className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tighter text-white">AETHER</h1>
                            <p className="text-xs text-cyan-600 tracking-widest">SONIC INTERFACE</p>
                            {state?.trackDescription && (
                                <div className="mt-2 px-3 py-1 bg-cyan-900/30 border-l-2 border-cyan-500 rounded-r">
                                    <p className="text-xs text-cyan-300 font-mono italic">
                                        {state.trackDescription}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <p className="text-xs text-cyan-700 uppercase tracking-widest mb-1">System Status</p>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsHelpOpen(true)}
                                className="text-xs text-cyan-500 hover:text-cyan-300 mr-4 underline"
                            >
                                Voice Effects Guide
                            </button>
                            <button
                                onClick={togglePlayback}
                                className={`p-2 rounded-full border transition-all ${state?.isPlaying
                                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                                    : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-cyan-700 hover:text-cyan-600'
                                    }`}
                            >
                                {state?.isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                            </button>
                            <div className="flex items-center gap-2 text-sm font-mono text-cyan-400">
                                <span>{state?.isPlaying ? 'PLAYING' : 'IDLE'} - </span>
                                <div
                                    className="flex items-center gap-1 cursor-ew-resize select-none group bg-cyan-900/20 px-2 py-0.5 rounded hover:bg-cyan-900/40 border border-transparent hover:border-cyan-500/30 transition-all"
                                    onWheel={(e) => {
                                        if (state?.bpm) {
                                            const delta = e.deltaY > 0 ? -5 : 5; // +/- 5 BPM per scroll
                                            setBpm(Math.max(60, Math.min(240, state.bpm + delta)));
                                        }
                                    }}
                                    title="Scroll to change BPM"
                                >
                                    <span className="group-hover:text-white transition-colors font-bold">
                                        {state?.bpm || 0} BPM
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button onClick={testAudio} className="mt-2 text-[10px] text-cyan-600 hover:text-cyan-300 underline">
                            Test System Audio
                        </button>
                    </div>
                </header>

                {/* Compact Track Controls - Horizontal Row */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {state && Object.values(state.tracks).map((track) => (
                        <TrackStrip
                            key={track.id}
                            track={track}
                            onMute={toggleMute}
                            onSolo={toggleSoloTrack}
                            onVolumeChange={setVolume}
                            onTrackFx={setTrackFx}
                        />
                    ))}
                </div>

                {/* Chat / Log Area */}
                <div className="flex-1 bg-black/40 rounded-2xl border border-cyan-900/30 p-4 mb-6 overflow-hidden flex flex-col backdrop-blur-md">
                    <div
                        ref={logRef}
                        className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-cyan-900"
                    >
                        {messages.map((msg, i) => (
                            <div key={i} className="text-sm font-mono border-l-2 border-cyan-800 pl-3 py-1 animate-fade-in">
                                <span className="text-cyan-600 text-xs mr-2">[{new Date().toLocaleTimeString()}]</span>
                                <span className="text-cyan-100">{msg}</span>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="text-sm font-mono border-l-2 border-purple-500 pl-3 py-1 animate-pulse">
                                <span className="text-purple-400 text-xs mr-2">[{new Date().toLocaleTimeString()}]</span>
                                <span className="text-purple-300">AI: Thinking...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Input Area */}
                <div className="relative group z-10">
                    <div className={`absolute -inset-1 rounded-lg blur transition duration-1000 pointer-events-none ${isAudioReady ? 'bg-linear-to-r from-cyan-600 to-blue-600 opacity-20 group-hover:opacity-40' : 'bg-gray-600 opacity-10'}`}></div>
                    <div className={`relative bg-black border rounded-lg p-4 flex items-center gap-4 shadow-2xl ${isAudioReady ? 'border-cyan-800/50' : 'border-gray-800/50'}`}>
                        <button
                            onClick={() => toggleRecording()}
                            disabled={!isAudioReady}
                            className={`p-3 rounded-full transition-all duration-300 ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-cyan-900/20 text-cyan-400 hover:bg-cyan-900/40'} ${!isAudioReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        <div className="flex-1 relative">
                            {isRecording && (
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-400 animate-pulse text-xs">🎤 Listening...</span>
                            )}
                            <input
                                ref={inputRef}
                                id="command-input"
                                name="command"
                                type="text"
                                autoComplete="off"
                                disabled={!isAudioReady}
                                aria-label="Voice command input"
                                aria-describedby="command-hint"
                                className="bg-transparent border-none focus:ring-0 text-white w-full font-mono text-sm placeholder-cyan-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder={isAudioReady ? 'Type command or use mic, then press Enter to send' : 'Initialize audio first...'}
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
                        <div id="command-hint" className="hidden group-hover:block text-[10px] text-cyan-700 font-mono absolute right-4 top-2 pointer-events-none">
                            PRESS ENTER
                        </div>
                    </div>
                </div>
                {speechError && (
                    <p className="mt-3 text-xs text-red-400 font-mono">{speechError}</p>
                )}
                {isAudioReady && (
                    <p className="mt-3 text-xs text-cyan-600 font-mono text-center">
                        Audio engine ready - Type commands and press Enter
                    </p>
                )}

                {/* Initialization Overlay */}
                {!isAudioReady && (
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center">
                        <button
                            onClick={() => {
                                startSession();
                            }}
                            className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-none border border-cyan-400 font-mono tracking-[0.2em] transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]"
                        >
                            INITIALIZE SESSION
                        </button>
                        <p className="mt-4 text-cyan-800 text-xs font-mono">CLICK TO START AUDIO ENGINE</p>
                        <button onClick={testAudio} className="mt-8 px-4 py-2 text-xs text-cyan-600 border border-cyan-900 hover:bg-cyan-900/20">
                            TEST SYSTEM AUDIO (BEEP)
                        </button>
                    </div>
                )}

                {/* Help Modal */}
                {isHelpOpen && (
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 p-8 overflow-y-auto">
                        <div className="max-w-2xl mx-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-cyan-400">Voice Effects Guide</h2>
                                <button onClick={() => setIsHelpOpen(false)} className="text-cyan-600 hover:text-white">CLOSE</button>
                            </div>

                            <div className="space-y-6 text-sm font-mono text-cyan-100">
                                <section>
                                    <h3 className="text-lg text-cyan-300 mb-2">🗣️ Voice Synthesis</h3>
                                    <ul className="list-disc pl-5 space-y-2">
                                        <li><strong className="text-white">Formant Vowels:</strong> Add vowel sounds (uses .vowel(&quot;a e i o u&quot;))</li>
                                        <li><strong className="text-white">Robot Voice:</strong> Make it sound like a robot (uses .crush(4).vowel(&quot;o&quot;))</li>
                                        <li><strong className="text-white">Vocoder:</strong> Add a vocoder effect (uses .bandf(sine.range(400, 2000)))</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-lg text-cyan-300 mb-2">🎛️ Effects</h3>
                                    <ul className="list-disc pl-5 space-y-2">
                                        <li><strong className="text-white">Filters:</strong> Low pass filter, High pass filter, Band pass</li>
                                        <li><strong className="text-white">Distortion:</strong> Bit crush, Distort, Lo-fi</li>
                                        <li><strong className="text-white">Spatial:</strong> Add reverb, Add delay, Pan it around</li>
                                        <li><strong className="text-white">Modulation:</strong> Phaser, Chorus, Tremolo</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-lg text-cyan-300 mb-2">🎵 Style Presets</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-cyan-900/20 p-3 rounded border border-cyan-800">
                                            <strong className="block text-cyan-400 mb-1">Robot Voice</strong>
                                            Add a robot voice melody
                                        </div>
                                        <div className="bg-cyan-900/20 p-3 rounded border border-cyan-800">
                                            <strong className="block text-cyan-400 mb-1">Space Pad</strong>
                                            Add a space pad with reverb
                                        </div>
                                        <div className="bg-cyan-900/20 p-3 rounded border border-cyan-800">
                                            <strong className="block text-cyan-400 mb-1">Acid Bass</strong>
                                            Make an acid bassline
                                        </div>
                                        <div className="bg-cyan-900/20 p-3 rounded border border-cyan-800">
                                            <strong className="block text-cyan-400 mb-1">Lo-Fi Drums</strong>
                                            Make the drums lo-fi
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
