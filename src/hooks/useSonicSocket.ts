import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, SonicSessionState, InstrumentType } from '@/types/sonic';
import { updateStrudel, initAudio, buildStrudelCode, evalStrudelCode, refreshAnalyser, addMusicGenSample, playMusicGenSample } from '../lib/strudel/engine';

function resolveSocketUrl() {
    const fallback = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (typeof window === 'undefined') {
        return fallback;
    }

    try {
        const current = new URL(window.location.href);
        const envUrl = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : null;
        const isHttp = current.protocol === 'http:' || current.protocol === 'https:';

        // When running from file:// or other non-HTTP origins (e.g., VSCode preview),
        // always prefer the configured URL or localhost so the socket has a valid host.
        if (!isHttp) {
            if (envUrl) {
                return envUrl.origin;
            }
            console.warn('[SonicSocket] Non-HTTP origin detected, defaulting to localhost:3000 for socket.');
            return 'http://localhost:3000';
        }

        if (envUrl) {
            if (envUrl.host !== current.host) {
                console.warn('[SonicSocket] NEXT_PUBLIC_APP_URL differs from current host. Using window location.');
                return current.origin;
            }
            return envUrl.origin;
        }

        return current.origin;
    } catch (err) {
        console.warn('[SonicSocket] Invalid socket URL, falling back to env/default.', err);
        return fallback;
    }
}

function resolveApiUrl(path: string) {
    const base = resolveSocketUrl();
    try {
        return new URL(path, base).toString();
    } catch {
        return path;
    }
}

function resolveRoomId() {
    if (typeof window === 'undefined') return 'default';

    try {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        const fromUrl = (params.get('room') || params.get('roomId') || '').trim();
        if (fromUrl) {
            try {
                window.localStorage?.setItem('sonic_room', fromUrl);
            } catch { /* ignore */ }
            return fromUrl;
        }

        try {
            const fromStorage = (window.localStorage?.getItem('sonic_room') || '').trim();
            return fromStorage || 'default';
        } catch {
            return 'default';
        }
    } catch {
        return 'default';
    }
}

export function useSonicSocket() {
    const [state, setState] = useState<SonicSessionState | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState<string[]>([]);
    const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
    const [currentCode, setCurrentCode] = useState<string>('');
    const currentCodeRef = useRef<string>('');
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const [isAudioReady, setIsAudioReady] = useState(false);
    const audioInitRef = useRef(false);
    const lastAppliedRef = useRef<string>('');
    const lastMessageTimeRef = useRef<number>(0);
    const stateRef = useRef<SonicSessionState | null>(null);
    const socketErrorNotifiedRef = useRef(false);

    // Frequency analysis state for AI context
    const [frequencyData, setFrequencyData] = useState({
        rms: 0,
        peakFrequency: 0,
        spectralCentroid: 0,
        lowEnergy: 0,
        midEnergy: 0,
        highEnergy: 0
    });
    const frequencyDataRef = useRef(frequencyData);

    // Keep stateRef in sync
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Keep currentCodeRef in sync
    useEffect(() => {
        currentCodeRef.current = currentCode;
    }, [currentCode]);

    // Helper: ensure audio is ready
    // Removed 'state' from dependency by using stateRef
    const ensureAudioReady = useCallback(async () => {
        if (audioInitRef.current && isAudioReady) return;
        audioInitRef.current = true;
        try {
            await initAudio();
            setIsAudioReady(true);
            // The useEffect will handle updateStrudel when isAudioReady changes
            import('@/lib/strudel/engine').then(async ({ getAnalyser }) => {
                const node = await getAnalyser();
                setAnalyser(node);
            });
        } catch (e) {
            audioInitRef.current = false;
            throw e;
        }
    }, [isAudioReady]);

    // Effect 1: socket connection
    useEffect(() => {
        // Prevent multiple socket instances
        if (socketRef.current?.connected) {
            console.log('[SonicSocket] Socket already connected, skipping initialization');
            return;
        }

        console.log('[SonicSocket] Initializing socket...');
        const socketUrl = resolveSocketUrl();
        const roomId = resolveRoomId();
        console.log('[SonicSocket] Connecting to:', socketUrl);
        console.log('[SonicSocket] Room:', roomId);

        const socket = io(socketUrl, {
            query: { room: roomId },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10,
            timeout: 20000,
            autoConnect: true
        });
        socketRef.current = socket;

        socket.on('connect', async () => {
            console.log('[SonicSocket] ✅ Connected to server');
            setIsConnected(true);
            setMessages(prev => [...prev, 'System: Connected to server']);
        });

        socket.on('disconnect', () => {
            console.log('[SonicSocket] ❌ Disconnected from server');
            setIsConnected(false);
            setMessages(prev => [...prev, 'System: Disconnected from server']);
        });

        socket.on('connect_error', (err) => {
            const msg = (err as { message?: string })?.message || String(err);
            setIsConnected(false);
            // On some hosts or when using next dev without the custom server,
            // the socket server won't exist. Treat this as a warning and fall back.
            if (!socketErrorNotifiedRef.current) {
                console.warn('[SonicSocket] WebSocket unavailable, running in standalone mode:', msg);
                setMessages(prev => [...prev, 'System: WebSocket unavailable, running in standalone mode.']);
                socketErrorNotifiedRef.current = true;
            }
        });

        socket.io.on('reconnect_attempt', (attempt) => {
            console.log('[SonicSocket] Reconnect attempt', attempt);
            setMessages(prev => [...prev, `System: Reconnecting... (attempt ${attempt})`]);
        });

        socket.on('sonic:state', (newState) => {
            console.log('[SonicSocket] 📡 Received state:', newState);
            setState(newState);
        });

        socket.on('sonic:message', (msg) => {
            console.log('[SonicSocket] 🤖 Received message:', msg);
            setMessages(prev => [...prev, `AI: ${msg}`]);
        });

        socket.on('sonic:error', (err) => {
            console.error('[SonicSocket] Server error:', err);
            setMessages(prev => [...prev, `Error: ${err}`]);
        });

        return () => {
            console.log('[SonicSocket] Cleaning up socket');
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []); // Run once on mount - socket connection is stable

    // Separate    // Effect to handle audio init when connected (but only once)
    // REMOVED: Automatic initialization causes AudioContext to hang if no user gesture.
    // Audio will be initialized on first user interaction (Start Session, Command, or Play).
    /*
    useEffect(() => {
        if (isConnected && !isAudioReady && !audioInitRef.current) {
            console.log('[SonicSocket] Initializing audio after connection...');
            ensureAudioReady().catch(e => console.error('[SonicSocket] Audio init failed:', e));
        }
    }, [isConnected]); 
    */

    // Effect 2: sync engine when state changes
    useEffect(() => {
        if (!state) return;

        // Build code for display (but don't trigger re-renders until we need to)
        const displayCode = state.isPlaying ? buildStrudelCode(state) : '// Audio Paused';

        if (isAudioReady) {
            try {
                // Create a stable hash from essential properties only
                const trackPatterns = Object.entries(state.tracks || {})
                    .map(([k, v]) => {
                        const fxHash = v.fx ? `${v.fx.lpf ?? 0}:${v.fx.reverb ?? 0}:${v.fx.delay ?? 0}:${v.fx.speed ?? 0.5}:${v.fx.pitch ?? 0.5}` : '0:0:0:0.5:0.5';
                        return `${k}:${v?.pattern || ''}:${v?.muted}:${v?.solo}:${v?.volume?.toFixed(2)}:${fxHash}`;
                    })
                    .sort()
                    .join('|');
                const hash = `${state.bpm}:${state.isPlaying}:${trackPatterns}`;

                // Only update if hash changed
                if (hash !== lastAppliedRef.current) {
                    lastAppliedRef.current = hash;

                    // Update display code only when hash changes
                    setCurrentCode(displayCode);

                    // Apply to Strudel engine (don't pass setCurrentCode - we already set it)
                    updateStrudel(state);

                    // Throttle "Engine applied" messages heavily to avoid spam (5 second minimum)
                    const now = Date.now();
                    if (now - lastMessageTimeRef.current > 5000) {
                        lastMessageTimeRef.current = now;
                        setMessages(prev => [...prev, `System: Engine applied (bpm ${state.bpm}, ${state.isPlaying ? 'playing' : 'stopped'})`]);
                    }

                    // Refresh analyser after pattern update (analyze(1) creates it)
                    setTimeout(async () => {
                        const node = await refreshAnalyser();
                        if (node) setAnalyser(node);
                    }, 200);
                }
            } catch {
                console.warn('[SonicSocket] Strudel not ready yet.');
            }
        }
    }, [state, isAudioReady]); // ensureAudioReady removed as it's not needed here

    // Effect 3: analyser loop
    useEffect(() => {
        if (!analyser) return;
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const timeData = new Uint8Array(analyser.fftSize);
        let raf: number;
        let lastEmit = 0;
        const update = () => {
            analyser.getByteFrequencyData(freqData);
            analyser.getByteTimeDomainData(timeData);

            // Calculate RMS (amplitude)
            let sumSquares = 0;
            for (let i = 0; i < timeData.length; i++) {
                const sample = (timeData[i] - 128) / 128;
                sumSquares += sample * sample;
            }
            const rms = Math.sqrt(sumSquares / timeData.length);

            // Find peak frequency
            let peakIndex = 0;
            for (let i = 1; i < freqData.length; i++) {
                if (freqData[i] > freqData[peakIndex]) peakIndex = i;
            }
            const peakFrequency = (peakIndex * analyser.context.sampleRate) / (2 * freqData.length);

            // Calculate spectral centroid (weighted average frequency)
            let weightedSum = 0;
            let magnitudeSum = 0;
            for (let i = 0; i < freqData.length; i++) {
                const freq = (i * analyser.context.sampleRate) / (2 * freqData.length);
                weightedSum += freq * freqData[i];
                magnitudeSum += freqData[i];
            }
            const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;

            // Calculate energy in different frequency bands
            const thirdLength = Math.floor(freqData.length / 3);
            let lowEnergy = 0, midEnergy = 0, highEnergy = 0;

            for (let i = 0; i < thirdLength; i++) {
                lowEnergy += freqData[i];
            }
            for (let i = thirdLength; i < 2 * thirdLength; i++) {
                midEnergy += freqData[i];
            }
            for (let i = 2 * thirdLength; i < freqData.length; i++) {
                highEnergy += freqData[i];
            }

            // Normalize energies
            lowEnergy /= thirdLength;
            midEnergy /= thirdLength;
            highEnergy /= (freqData.length - 2 * thirdLength);

            // Store frequency data for AI (throttled updates)
            const now = performance.now();
            if (now - lastEmit > 500) {  // Update every 500ms
                const newFreqData = {
                    rms,
                    peakFrequency,
                    spectralCentroid,
                    lowEnergy,
                    midEnergy,
                    highEnergy
                };
                frequencyDataRef.current = newFreqData;
                setFrequencyData(newFreqData);

                // Also emit to socket
                if (socketRef.current?.connected) {
                    socketRef.current.emit('sonic:analysis', newFreqData);
                }
                lastEmit = now;
            }

            raf = requestAnimationFrame(update);
        };
        raf = requestAnimationFrame(update);
        return () => cancelAnimationFrame(raf);
    }, [analyser]);

    const normalizeQuotes = (text: string) => text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    const [isThinking, setIsThinking] = useState(false);

    // Base client state (used when socket/server state isn't available yet)
    const createBaseState = useCallback((prevState: SonicSessionState | null): SonicSessionState => {
        if (prevState) return prevState;
        return {
            bpm: 120,
            scale: 'C minor',
            isPlaying: true,
            tracks: {
                drums: { id: 'drums', name: 'Drums', pattern: '', muted: false, solo: false, volume: 1 },
                bass: { id: 'bass', name: 'Bass', pattern: '', muted: false, solo: false, volume: 1 },
                melody: { id: 'melody', name: 'Melody', pattern: '', muted: false, solo: false, volume: 1 },
                voice: { id: 'voice', name: 'Voice', pattern: '', muted: false, solo: false, volume: 1 },
                fx: { id: 'fx', name: 'FX', pattern: '', muted: false, solo: false, volume: 1 },
            },
        };
    }, []);

    const normalizeLocalPattern = useCallback((_trackId: InstrumentType, pattern: string) => {
        const p = pattern.trim();
        if (!p) return '';
        if (/^expr:/i.test(p)) return p;
        if (/^(s\(|note\(|stack\(|silence|sound\(|sample\(|n\(|m\()/.test(p)) {
            return `expr:${p}`;
        }
        return p;
    }, []);

    // ... (existing code)

    const sendCommand = useCallback(async (text: string) => {
        const trimmed = normalizeQuotes(text).trim();
        if (!trimmed) return;
        setMessages(prev => [...prev, `You: ${trimmed}`]);

        // Ensure audio is ready before doing anything
        if (!isAudioReady) {
            console.log('[SonicSocket] Audio not ready, attempting init...');
            try {
                await ensureAudioReady();
            } catch {
                console.warn('[SonicSocket] Audio init failed before sending command');
                // We continue anyway, as the agent might just generate code
            }
        }

        // Check if it's a direct command (track: pattern or bpm: number)
        // or if it looks like raw Strudel code (s("..."), note(...), etc.)
        const isDirectCommand = /^(drums|bass|melody|fx|voice|bpm):/i.test(trimmed);
        const isRawCode = /^(s\(|note\(|stack\(|silence|sound\(|sample\(|n\(|m\(|\(\(\)\s*=>)/.test(trimmed);

        if (isDirectCommand) {
            console.log('[SonicSocket] Applying direct command locally:', trimmed);
            setState(prev => {
                const base = createBaseState(prev);
                const next: SonicSessionState = {
                    ...base,
                    tracks: { ...base.tracks },
                    isPlaying: true,
                };

                const bpmMatch = trimmed.match(/^bpm\s*:\s*(\d{2,3})/i);
                if (bpmMatch) {
                    const bpm = parseInt(bpmMatch[1], 10);
                    if (!Number.isNaN(bpm)) next.bpm = bpm;
                    return next;
                }

                const trackMatch = trimmed.match(/^(drums|bass|melody|fx|voice)\s*:\s*(.+)$/i);
                if (trackMatch) {
                    const trackId = trackMatch[1].toLowerCase() as InstrumentType;
                    const pattern = trackMatch[2];
                    next.tracks[trackId] = {
                        ...next.tracks[trackId],
                        pattern: normalizeLocalPattern(trackId, pattern),
                        muted: false,
                        solo: false,
                    };
                    return next;
                }

                return base;
            });

            // Best-effort sync to server if available
            if (socketRef.current?.connected) {
                socketRef.current.emit('sonic:command', trimmed);
            } else {
                socketRef.current?.connect();
                socketRef.current?.emit('sonic:command', trimmed);
            }
            return;
        }

        if (isRawCode) {
            console.log('[SonicSocket] Evaluating raw Strudel code locally');
            setCurrentCode(trimmed);
            try {
                await evalStrudelCode(trimmed);
                setMessages(prev => [...prev, 'System: Code executed successfully']);
            } catch (evalErr: unknown) {
                const errorMsg = evalErr instanceof Error ? evalErr.message : 'Invalid code syntax';
                console.error('[SonicSocket] Raw code evaluation error:', evalErr);
                setMessages(prev => [...prev, `Syntax error: ${errorMsg}`]);
            }

            // Also send to server if it later connects (optional)
            if (socketRef.current?.connected) {
                socketRef.current.emit('sonic:command', trimmed);
            }
            return;
        }

        // Otherwise, treat as natural language and ask the AI
        setIsThinking(true);
        try {
            const response = await fetch(resolveApiUrl('/api/agent'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: trimmed,
                    currentCode: currentCodeRef.current,
                    frequencyData: frequencyDataRef.current  // Send frequency analysis to AI
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                const message = data?.error || 'Agent failed';
                // Provide a clearer hint when rate limited
                if (response.status === 429) {
                    setMessages(prev => [...prev, 'System: Rate limited by the provider. Please wait a moment and try again.']);
                } else {
                    setMessages(prev => [...prev, `System: Agent error - ${message}`]);
                }
                return;
            }

            // Handle different response types
            if (data.type === 'chat') {
                setMessages(prev => [...prev, `AI: ${data.message}`]);
            } else if (data.type === 'musicgen') {
                // MusicGen AI-generated audio response
                setMessages(prev => [...prev, `AI: ${data.message || 'Generating AI audio...'}`]);
                
                if (data.audio_base64) {
                    try {
                        // Add the sample to the cache
                        const sampleName = `musicgen_${data.stemType || 'sample'}`;
                        await addMusicGenSample(
                            sampleName,
                            `Generated ${data.stemType} stem`,
                            data.audio_base64,
                            data.duration || 8
                        );
                        
                        // Play the generated sample
                        await playMusicGenSample(sampleName, { loop: true, gain: 0.8 });
                        
                        setMessages(prev => [...prev, 
                            `System: Playing AI-generated ${data.stemType} (${data.duration}s, generated in ${data.generation_time?.toFixed(1)}s)`
                        ]);
                    } catch (playErr) {
                        console.error('[SonicSocket] Failed to play MusicGen sample:', playErr);
                        setMessages(prev => [...prev, `Error: Failed to play generated audio`]);
                    }
                }
            } else if (data.type === 'update_tracks') {
                if (data.thought) {
                    setMessages(prev => [...prev, `AI Thought: ${data.thought}`]);
                }

                // Update local state with new tracks
                setState(prevState => {
                    // Initialize default state if null
                    const baseState: SonicSessionState = prevState || {
                        bpm: 120,
                        scale: 'C minor',
                        isPlaying: true,
                        tracks: {
                            drums: { id: 'drums', name: 'Drums', pattern: '', muted: false, solo: false, volume: 1 },
                            bass: { id: 'bass', name: 'Bass', pattern: '', muted: false, solo: false, volume: 1 },
                            melody: { id: 'melody', name: 'Melody', pattern: '', muted: false, solo: false, volume: 1 },
                            voice: { id: 'voice', name: 'Voice', pattern: '', muted: false, solo: false, volume: 1 },
                            fx: { id: 'fx', name: 'FX', pattern: '', muted: false, solo: false, volume: 1 }
                        }
                    };

                    const nextState = {
                        ...baseState,
                        tracks: { ...baseState.tracks },
                        trackDescription: data.thought || baseState.trackDescription
                    };

                    // Optional tempo update (keeps the engine locked to a stable BPM)
                    if (typeof data.bpm === 'number' && Number.isFinite(data.bpm)) {
                        nextState.bpm = Math.max(40, Math.min(240, Math.round(data.bpm)));
                    }

                    // Apply updates - tracks with patterns get updated, tracks with null get cleared
                    if (data.tracks) {
                        Object.entries(data.tracks).forEach(([key, pattern]) => {
                            const trackId = key as keyof SonicSessionState['tracks'];
                            if (nextState.tracks[trackId]) {
                                if (pattern !== null && pattern !== undefined && pattern !== '') {
                                    // Update track with new pattern
                                    nextState.tracks[trackId] = {
                                        ...nextState.tracks[trackId],
                                        pattern: pattern as string,
                                        muted: false // Unmute if updated
                                    };
                                }
                                // Note: We don't clear patterns for null tracks - 
                                // this preserves existing patterns when user adds new layers
                                // If user wants to clear, they should say "clear" or "stop"
                            }
                        });
                    }

                    // Ensure playing
                    nextState.isPlaying = true;

                    console.log('[useSonicSocket] Updated state from tracks:', nextState);
                    return nextState;
                });

                // Check if this was a YouTube analysis
                if (data.youtube) {
                    setMessages(prev => [...prev, 
                        `🎵 YouTube Analysis: "${data.youtube.title}" by ${data.youtube.artist}`,
                        `   BPM: ${data.youtube.bpm} | Key: ${data.youtube.key} ${data.youtube.mode}`,
                        `System: Generated Strudel patterns from audio analysis!`
                    ]);
                } else {
                    setMessages(prev => [...prev, `System: Tracks updated successfully`]);
                }

            } else if (data.type === 'code') {
                // Show reasoning if available
                if (data.thought) {
                    setMessages(prev => [...prev, `AI Thought: ${data.thought}`]);
                }

                const generatedCode = data.code;
                console.log('[useSonicSocket] Received code:', generatedCode);

                // Update editor state
                if (setCurrentCode) {
                    setCurrentCode(generatedCode);
                }

                // Execute locally with error handling
                try {
                    await evalStrudelCode(generatedCode);
                    setMessages(prev => [...prev, `System: Code executed successfully`]);
                } catch (evalErr: unknown) {
                    const errorMsg = evalErr instanceof Error ? evalErr.message : 'Invalid code syntax';
                    console.error('[SonicSocket] Code evaluation error:', evalErr);
                    setMessages(prev => [...prev, `Syntax error: ${errorMsg}`]);

                    // Automatically ask AI to fix the error
                    setIsThinking(true);
                    setMessages(prev => [...prev, `AI: Analyzing error and attempting fix...`]);
                    try {
                    const fixPrompt = `Syntax error: ${errorMsg}\n\nProblematic code:\n${generatedCode}\n\nPlease fix this code.`;
                    console.log('[SonicSocket] Sending error to AI for fixing:', fixPrompt);

                        const fixResponse = await fetch(resolveApiUrl('/api/agent'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                prompt: fixPrompt,
                                currentCode: generatedCode,
                                frequencyData: frequencyDataRef.current
                            }),
                        });

                        if (fixResponse.ok) {
                            const fixData = await fixResponse.json();
                            console.log('[SonicSocket] AI fix response:', fixData);

                            if (fixData.type === 'code') {
                                const fixedCode = fixData.code;
                                setMessages(prev => [...prev, `AI: Fixed the error, trying again...`]);
                                setCurrentCode(fixedCode);

                                try {
                                    await evalStrudelCode(fixedCode);
                                    setMessages(prev => [...prev, `System: Fixed code executed successfully ✓`]);
                                } catch (secondErr: unknown) {
                                    const errMsg = secondErr instanceof Error ? secondErr.message : 'Unknown error';
                                    console.error('[SonicSocket] Fixed code still has error:', secondErr);
                                    setMessages(prev => [...prev, `Error persists: ${errMsg}`]);
                                    setMessages(prev => [...prev, `Fixed code: ${fixedCode.slice(0, 150)}...`]);
                                }
                            } else {
                                setMessages(prev => [...prev, fixData.message || 'AI could not fix the error']);
                            }
                        }
                    } catch (fixErr: unknown) {
                        console.error('[SonicSocket] Auto-fix failed:', fixErr);
                    } finally {
                        setIsThinking(false);
                    }
                }
            }

            // Optional: Send to server if we had a way to sync full code
            // socketRef.current?.emit('sonic:code', generatedCode);

        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error('[SonicSocket] Agent error:', err);
            setMessages(prev => [...prev, `Error: ${errMsg}`]);
        } finally {
            setIsThinking(false);
        }
    }, [ensureAudioReady, isAudioReady, createBaseState, normalizeLocalPattern]);

    const startSession = useCallback(async () => {
        try {
            await ensureAudioReady();
        } catch {
            console.warn('[SonicSocket] Audio init failed');
        }
    }, [ensureAudioReady]);

    const togglePlayback = useCallback(() => {
        // Control local Strudel scheduler
        // @ts-expect-error Strudel scheduler is attached to window by the engine
        const scheduler = window.scheduler || window.__strudelScheduler__;
        if (scheduler) {
            if (scheduler.started) {
                if (typeof scheduler.stop === 'function') scheduler.stop();
                else if (typeof scheduler.pause === 'function') scheduler.pause();
            } else {
                if (typeof scheduler.start === 'function') scheduler.start();
            }

            // Optimistically update UI state
            setState(prev => prev ? { ...prev, isPlaying: !prev.isPlaying } : null);
        } else {
            console.warn('[SonicSocket] No scheduler found to toggle');
        }
    }, []);

    const toggleMute = useCallback((trackId: InstrumentType) => {
        setState(prev => {
            if (!prev) return null;
            const track = prev.tracks[trackId];

            // When manually muting/unmuting, clear all solo states
            const newTracks = { ...prev.tracks };
            Object.keys(newTracks).forEach((key) => {
                const id = key as InstrumentType;
                newTracks[id] = { ...newTracks[id], solo: false };
            });
            newTracks[trackId] = { ...newTracks[trackId], muted: !track.muted };

            return { ...prev, tracks: newTracks };
        });
    }, []);

    const toggleSolo = useCallback((trackId: InstrumentType) => {
        setState(prev => {
            if (!prev) return null;
            const track = prev.tracks[trackId];
            const wasSolo = track.solo;

            // Toggle solo state and update mute accordingly
            const newTracks = { ...prev.tracks };
            Object.keys(newTracks).forEach((key) => {
                const id = key as InstrumentType;
                if (wasSolo) {
                    // Un-solo: restore all tracks to unmuted
                    newTracks[id] = { ...newTracks[id], solo: false, muted: false };
                } else {
                    // Solo: mute all except target, mark target as solo
                    newTracks[id] = {
                        ...newTracks[id],
                        solo: id === trackId,
                        muted: id !== trackId
                    };
                }
            });
            return { ...prev, tracks: newTracks };
        });
    }, []);

    const setVolume = useCallback((trackId: InstrumentType, val: number) => {
        setState(prev => {
            if (!prev) return null;
            return {
                ...prev,
                tracks: {
                    ...prev.tracks,
                    [trackId]: { ...prev.tracks[trackId], volume: val }
                }
            };
        });
    }, []);

    const setTrackFx = useCallback((trackId: InstrumentType, fxType: 'lpf' | 'reverb' | 'delay' | 'speed' | 'pitch', val: number) => {
        console.log(`[useSonicSocket] setTrackFx: ${trackId} ${fxType} = ${val}`);
        setState(prev => {
            if (!prev) return null;
            const track = prev.tracks[trackId];
            const currentFx = track.fx || { lpf: 0, reverb: 0, delay: 0, speed: 0.5, pitch: 0.5 };

            return {
                ...prev,
                tracks: {
                    ...prev.tracks,
                    [trackId]: {
                        ...track,
                        fx: { ...currentFx, [fxType]: val }
                    }
                }
            };
        });
    }, []);

    const setBpm = useCallback((bpm: number) => {
        setState(prev => {
            if (!prev) return null;
            return { ...prev, bpm };
        });
    }, []);

    const setTrackPattern = useCallback((trackId: InstrumentType, pattern: string) => {
        // UI-triggered pattern changes should be treated as a user gesture: ensure audio is initialized so
        // actions like Synplant "Quick Build-Ups / Drops" actually make sound even if the user started in DJ mode.
        if (!isAudioReady) {
            ensureAudioReady().catch((err) => {
                console.warn('[SonicSocket] Audio init failed (setTrackPattern):', err);
            });
        }

        setState(prev => {
            const base = createBaseState(prev);
            const next: SonicSessionState = {
                ...base,
                tracks: { ...base.tracks },
                isPlaying: true,
            };

            next.tracks[trackId] = {
                ...next.tracks[trackId],
                pattern: normalizeLocalPattern(trackId, pattern),
                muted: false,
                solo: false,
            };

            return next;
        });
    }, [createBaseState, ensureAudioReady, isAudioReady, normalizeLocalPattern]);

    return {
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
        setCurrentCode, // Expose setter for manual editing
        toggleMute,
        toggleSolo,
        setVolume,
        setTrackFx,
        setBpm,
        setTrackPattern,
    };
}
