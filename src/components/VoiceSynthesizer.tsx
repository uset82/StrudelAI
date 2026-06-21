/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Mic, Play, Pause, Square, Download, Send, 
    Trash2, Sparkles, RefreshCw, Volume2, Upload 
} from 'lucide-react';
import { VoiceClip, VoiceStyle, VoiceEffectSettings, AmbienceType, DEFAULT_EFFECT_SETTINGS } from '../lib/voice-synthesizer/types';
import { voicePresets, getPresetById } from '../lib/voice-synthesizer/presets';
import { ttsAdapter } from '../lib/voice-synthesizer/ttsAdapter';
import { checkVoiceSafety } from '../lib/voice-synthesizer/safety';
import { voiceEffectsManager } from '../lib/voice-synthesizer/effectsChain';
import { voiceAmbienceManager } from '../lib/voice-synthesizer/ambience';
import { renderProcessedAudio, downloadBlob } from '../lib/voice-synthesizer/audioExport';

// We import registerSound dynamically when sending to workspace
let registerSoundFn: any = null;
if (typeof window !== 'undefined') {
    import('superdough').then(m => {
        registerSoundFn = m.registerSound;
    }).catch(err => {
        console.warn('[VoiceSynthesizer] Failed to load superdough registerSound:', err);
    });
}

export function VoiceSynthesizer() {
    const [clips, setClips] = useState<VoiceClip[]>([]);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [selectedPresetId, setSelectedPresetId] = useState<VoiceStyle>('neutral');
    const [effects, setEffects] = useState<VoiceEffectSettings>({ ...DEFAULT_EFFECT_SETTINGS });
    const [activeAmbience, setActiveAmbience] = useState<AmbienceType>('none');
    const [ambienceVol, setAmbienceVol] = useState(0.15);

    // Audio & Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isPlayingProcessed, setIsPlayingProcessed] = useState(false);
    const [isPlayingClean, setIsPlayingClean] = useState(false);
    const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
    const [isTtsPlaying, setIsTtsPlaying] = useState(false);
    const [isRenderingExport, setIsRenderingExport] = useState(false);

    // Feedback messages
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Refs
    const waveContainerRef = useRef<HTMLDivElement | null>(null);
    const wavesurferRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<any>(null);
    const playheadIntervalRef = useRef<any>(null);

    const selectedClip = clips.find(c => c.id === selectedClipId) || null;

    // ── WaveSurfer.js Initialization ──────────────────────────────────────────
    const initWaveSurfer = useCallback(async () => {
        if (!waveContainerRef.current || typeof window === 'undefined') return;

        const WaveSurfer = (await import('wavesurfer.js')).default;
        
        // Destroy existing
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
        }

        const ws = WaveSurfer.create({
            container: waveContainerRef.current,
            waveColor: 'rgba(34, 211, 238, 0.25)', // Cyan tint
            progressColor: 'rgba(34, 211, 238, 0.85)',
            cursorColor: '#22d3ee',
            height: 100,
            barWidth: 2,
            barGap: 3,
            normalize: true,
            backend: 'WebAudio'
        });

        ws.on('ready', () => {
            setErrorMsg(null);
        });

        ws.on('finish', () => {
            setIsPlayingClean(false);
        });

        wavesurferRef.current = ws;
    }, []);

    useEffect(() => {
        initWaveSurfer();
        return () => {
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
            }
            if (playheadIntervalRef.current) {
                clearInterval(playheadIntervalRef.current);
            }
            voiceEffectsManager.stop();
            voiceAmbienceManager.stop();
        };
    }, [initWaveSurfer]);

    // Load active clip URL into WaveSurfer
    useEffect(() => {
        if (wavesurferRef.current && selectedClip) {
            wavesurferRef.current.load(selectedClip.url);
            // Load in Tone.js player as well
            voiceEffectsManager.loadClip(selectedClip.url).catch(err => {
                console.error('[VoiceSynthesizer] Tone.js load error:', err);
            });
        }
    }, [selectedClip]);

    // ── Safety & Feedback Timing ──────────────────────────────────────────────
    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 4000);
    };

    // ── Microphone Recording ──────────────────────────────────────────────────
    const startRecording = async () => {
        setErrorMsg(null);
        audioChunksRef.current = [];
        setRecordingTime(0);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);

                // Get audio duration
                const tempAudio = new Audio(audioUrl);
                tempAudio.addEventListener('loadedmetadata', () => {
                    const newClip: VoiceClip = {
                        id: `recorded_${Date.now()}`,
                        name: `recorded_voice_${clips.length + 1}`,
                        source: 'recorded',
                        blob: audioBlob,
                        url: audioUrl,
                        duration: tempAudio.duration || recordingTime,
                        createdAt: Date.now()
                    };

                    setClips(prev => [newClip, ...prev]);
                    setSelectedClipId(newClip.id);
                    showSuccess('Voice clip recorded successfully.');
                });

                // Stop all tracks in stream
                stream.getTracks().forEach(t => t.stop());
            };

            mediaRecorderRef.current = recorder;
            recorder.start(250); // Get chunks every 250ms
            setIsRecording(true);

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(t => t + 1);
            }, 1000);

        } catch (err) {
            console.error('[VoiceSynthesizer] Recording permission denied:', err);
            setErrorMsg('Microphone access denied or unavailable. Please check settings.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
    };

    // ── File Import ───────────────────────────────────────────────────────────
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const audioUrl = URL.createObjectURL(file);
        const tempAudio = new Audio(audioUrl);
        
        tempAudio.addEventListener('loadedmetadata', () => {
            const newClip: VoiceClip = {
                id: `imported_${Date.now()}`,
                name: file.name.split('.')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                source: 'imported',
                blob: file,
                url: audioUrl,
                duration: tempAudio.duration,
                createdAt: Date.now()
            };

            setClips(prev => [newClip, ...prev]);
            setSelectedClipId(newClip.id);
            showSuccess(`Audio file "${file.name}" imported successfully.`);
        });
    };

    // ── TTS Web Speech ────────────────────────────────────────────────────────
    const generateTTS = () => {
        if (!text.trim()) {
            setErrorMsg('Please enter some text to synthesize.');
            return;
        }

        setErrorMsg(null);
        const safety = checkVoiceSafety('', text);
        if (!safety.approved) {
            setErrorMsg(safety.reason || 'Impersonation blocked.');
            return;
        }

        setIsGeneratingTTS(true);
        setIsTtsPlaying(true);

        ttsAdapter.speak(
            text,
            selectedPresetId,
            () => {
                setIsGeneratingTTS(false);
            },
            () => {
                setIsTtsPlaying(false);
            },
            (err) => {
                console.error('[TTS] Error:', err);
                const msg = err instanceof Error ? err.message : 'Speech synthesis failed.';
                setErrorMsg(msg);
                setIsGeneratingTTS(false);
                setIsTtsPlaying(false);
            }
        );
    };

    const stopTTS = () => {
        ttsAdapter.cancel();
        setIsTtsPlaying(false);
        setIsGeneratingTTS(false);
    };

    // ── Tone.js Processed Playback ────────────────────────────────────────────
    const playProcessed = () => {
        if (!selectedClip) return;
        
        // Stop clean playback if running
        if (isPlayingClean && wavesurferRef.current) {
            wavesurferRef.current.pause();
            setIsPlayingClean(false);
        }

        setIsPlayingProcessed(true);

        // Play Tone.js chain
        voiceEffectsManager.play(effects, () => {
            setIsPlayingProcessed(false);
            if (playheadIntervalRef.current) {
                clearInterval(playheadIntervalRef.current);
            }
            if (wavesurferRef.current) {
                wavesurferRef.current.setTime(0);
            }
        });

        // Sync visual playhead scanning
        const startTime = Date.now();
        if (playheadIntervalRef.current) {
            clearInterval(playheadIntervalRef.current);
        }

        playheadIntervalRef.current = setInterval(() => {
            if (!wavesurferRef.current) return;
            const elapsed = (Date.now() - startTime) / 1000 * effects.speed;
            if (elapsed >= selectedClip.duration) {
                wavesurferRef.current.setTime(0);
                clearInterval(playheadIntervalRef.current);
            } else {
                wavesurferRef.current.setTime(elapsed);
            }
        }, 50);
    };

    const stopProcessed = () => {
        voiceEffectsManager.stop();
        setIsPlayingProcessed(false);
        if (playheadIntervalRef.current) {
            clearInterval(playheadIntervalRef.current);
        }
        if (wavesurferRef.current) {
            wavesurferRef.current.setTime(0);
        }
    };

    // ── WaveSurfer Clean Playback ─────────────────────────────────────────────
    const toggleClean = () => {
        if (!wavesurferRef.current || !selectedClip) return;

        if (isPlayingProcessed) {
            stopProcessed();
        }

        if (isPlayingClean) {
            wavesurferRef.current.pause();
            setIsPlayingClean(false);
        } else {
            wavesurferRef.current.play();
            setIsPlayingClean(true);
        }
    };

    // ── Ambience Control ──────────────────────────────────────────────────────
    const toggleAmbience = (type: AmbienceType) => {
        if (activeAmbience === type) {
            voiceAmbienceManager.stop();
            setActiveAmbience('none');
        } else {
            voiceAmbienceManager.start(type, ambienceVol);
            setActiveAmbience(type);
        }
    };

    const handleAmbienceVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setAmbienceVol(val);
        voiceAmbienceManager.setVolume(val);
    };

    // ── Presets Handler ───────────────────────────────────────────────────────
    const applyPreset = (presetId: VoiceStyle) => {
        setSelectedPresetId(presetId);
        const preset = getPresetById(presetId);
        setEffects({ ...preset.effects });
        
        if (preset.ambience) {
            toggleAmbience(preset.ambience);
        }
    };

    // ── Slider Adjustments ─────────────────────────────────────────────────────
    const handleSliderChange = (param: keyof VoiceEffectSettings, val: number) => {
        const updated = { ...effects, [param]: val };
        setEffects(updated);
        voiceEffectsManager.applySettings(updated);
    };

    // ── Clip Deletion ──────────────────────────────────────────────────────────
    const deleteClip = (id: string) => {
        const target = clips.find(c => c.id === id);
        if (target) {
            URL.revokeObjectURL(target.url);
        }

        const remaining = clips.filter(c => c.id !== id);
        setClips(remaining);

        if (selectedClipId === id) {
            setSelectedClipId(remaining.length > 0 ? remaining[0].id : null);
        }
    };

    // ── Export Audio File ─────────────────────────────────────────────────────
    const exportAudio = async () => {
        if (!selectedClip) return;
        
        setIsRenderingExport(true);
        setErrorMsg(null);

        try {
            const wavBlob = await renderProcessedAudio(selectedClip.url, effects);
            downloadBlob(wavBlob, `${selectedClip.name}_processed.wav`);
            showSuccess('WAV Audio rendered and exported.');
        } catch (err) {
            console.error('[Export] Rendering error:', err);
            setErrorMsg('Failed to render and export audio with effects.');
        } finally {
            setIsRenderingExport(false);
        }
    };

    // ── Send to Workspace ─────────────────────────────────────────────────────
    const sendToWorkspace = async () => {
        if (!selectedClip) return;

        try {
            let bufferToRegister: AudioBuffer | null = null;
            const wavBlob = await renderProcessedAudio(selectedClip.url, effects);
            const arrayBuffer = await wavBlob.arrayBuffer();

            // Decode array buffer
            if (typeof window !== 'undefined') {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                const ctx = new AudioCtx();
                bufferToRegister = await ctx.decodeAudioData(arrayBuffer);
            }

            const name = `voice_${selectedClip.name}`;

            if (registerSoundFn && bufferToRegister) {
                // Register AudioBuffer directly in Superdough
                registerSoundFn(name, bufferToRegister);
                showSuccess(`Registered "${name}" sample. Try using s("${name}") in Code Workspace!`);
            } else {
                // Fallback to Blob URL registration
                const finalWavUrl = URL.createObjectURL(wavBlob);
                if (registerSoundFn) {
                    registerSoundFn(name, finalWavUrl);
                    showSuccess(`Registered "${name}" sample via URL. Try using s("${name}") in Code Workspace!`);
                } else {
                    throw new Error('Strudel sample register function not loaded.');
                }
            }

        } catch (err) {
            console.error('[Workspace] Registration error:', err);
            setErrorMsg('Could not register sample to workstation workspace.');
        }
    };

    // ── AI Voice Command Event Handler ────────────────────────────────────────
    useEffect(() => {
        const handleVoiceCommand = (e: Event) => {
            const command = (e as CustomEvent).detail;
            if (!command) return;

            console.log('[VoiceSynthesizer] Applying AI structured command:', command);

            if (command.voiceStyle) {
                applyPreset(command.voiceStyle);
            }

            if (command.effects) {
                setEffects(prev => {
                    const updated = { ...prev, ...command.effects };
                    voiceEffectsManager.applySettings(updated);
                    return updated;
                });
            }

            if (command.ambience && command.ambience.length > 0) {
                toggleAmbience(command.ambience[0]);
            }

            if (command.text) {
                setText(command.text);
            }

            showSuccess(`Applied voice preset "${command.voiceStyle || 'custom'}" from chat command.`);
        };

        window.addEventListener('aether:voice_command', handleVoiceCommand);
        return () => {
            window.removeEventListener('aether:voice_command', handleVoiceCommand);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effects, activeAmbience]);

    return (
        <div className="flex h-full flex-col gap-5 p-5 max-lg:p-3 overflow-y-auto studio-scrollbar text-slate-100 bg-[#0d1117]">
            {/* Header Banner */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div>
                    <h2 className="text-xl font-bold tracking-wide text-cyan-400 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-cyan-400 animate-pulse" />
                        Aether Voice Lab
                    </h2>
                    <p className="text-xs text-slate-400">Perform real-time browser-native voice recording, preset morphs, and FX synthesis.</p>
                </div>
                
                {/* Warning notice */}
                <div className="text-[10px] text-slate-500 bg-white/[0.03] px-3 py-1.5 rounded border border-white/5 max-sm:hidden">
                    ⚠ Fictional character clone presets only. Real-world impersonation blocked.
                </div>
            </div>

            {/* Error/Success Feedbacks */}
            {errorMsg && (
                <div className="rounded border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-300 animate-shake">
                    {errorMsg}
                </div>
            )}
            {successMsg && (
                <div className="rounded border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-300 animate-pulse">
                    {successMsg}
                </div>
            )}

            {/* Main Workbench Layout */}
            <div className="grid grid-cols-3 gap-5 max-xl:grid-cols-1">
                {/* Column 1: Record / TTS Input / Clip List */}
                <div className="flex flex-col gap-4 col-span-1">
                    {/* Recording Zone */}
                    <div className="rounded-lg border border-white/[0.08] bg-[#161b22] p-4 flex flex-col gap-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                        <h3 className="text-sm font-semibold tracking-wide text-cyan-200">Microphone Input</h3>
                        <div className="flex items-center gap-3">
                            {isRecording ? (
                                <button
                                    onClick={stopRecording}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-xs font-semibold rounded-md shadow-md text-white transition-all"
                                >
                                    <Square className="h-4.5 w-4.5 fill-current" />
                                    Stop ({recordingTime}s)
                                </button>
                            ) : (
                                <button
                                    onClick={startRecording}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-slate-950 active:scale-95 text-xs font-bold rounded-md shadow-md transition-all"
                                >
                                    <Mic className="h-4.5 w-4.5" />
                                    Record Voice
                                </button>
                            )}

                            {/* Drag & Drop Import */}
                            <label className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] cursor-pointer text-xs text-slate-300 font-semibold rounded-md transition-colors">
                                <Upload className="h-4 w-4" />
                                Import Audio
                                <input
                                    type="file"
                                    accept="audio/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Text to Speech Input */}
                    <div className="rounded-lg border border-white/[0.08] bg-[#161b22] p-4 flex flex-col gap-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                        <h3 className="text-sm font-semibold tracking-wide text-cyan-200">Text-to-Speech (TTS Preview)</h3>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Type a voice transcript here..."
                            rows={3}
                            className="w-full bg-[#0d1117] border border-white/10 rounded p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50 resize-none"
                        />
                        <div className="flex gap-2">
                            {isTtsPlaying ? (
                                <button
                                    onClick={stopTTS}
                                    className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 active:scale-95 text-xs font-semibold rounded-md shadow text-white transition-all"
                                >
                                    <Square className="h-3.5 w-3.5 fill-current" />
                                    Stop Speech
                                </button>
                            ) : (
                                <button
                                    onClick={generateTTS}
                                    disabled={isGeneratingTTS}
                                    className="flex items-center gap-2 px-4 py-2 bg-cyan-400 hover:bg-cyan-500 text-slate-950 disabled:bg-slate-700 disabled:text-slate-500 active:scale-95 text-xs font-bold rounded-md shadow transition-all"
                                >
                                    <Volume2 className="h-4 w-4" />
                                    {isGeneratingTTS ? 'Synthesizing...' : 'Speak text'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Clips List */}
                    <div className="rounded-lg border border-white/[0.08] bg-[#161b22] p-4 flex flex-col gap-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)] max-h-[220px] overflow-y-auto studio-scrollbar">
                        <h3 className="text-sm font-semibold tracking-wide text-cyan-200">Voice Playlist</h3>
                        {clips.length === 0 ? (
                            <p className="text-xs text-slate-500 italic text-center py-4">No recorded or imported voice clips.</p>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {clips.map((clip) => (
                                    <div 
                                        key={clip.id}
                                        onClick={() => setSelectedClipId(clip.id)}
                                        className={`flex items-center justify-between p-2 rounded cursor-pointer border text-xs transition-colors ${clip.id === selectedClipId 
                                            ? 'border-cyan-400/40 bg-cyan-400/5 text-cyan-200' 
                                            : 'border-white/5 bg-white/[0.015] hover:bg-white/[0.04] text-slate-300'
                                        }`}
                                    >
                                        <span className="truncate pr-2 font-mono">{clip.name}</span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] text-slate-500">{(clip.duration).toFixed(1)}s</span>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteClip(clip.id);
                                                }}
                                                className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                                                title="Delete clip"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Waveform display and controls */}
                <div className="flex flex-col gap-4 col-span-2 max-xl:col-span-1">
                    {/* Waveform Panel */}
                    <div className="rounded-lg border border-white/[0.08] bg-[#161b22] p-4 flex flex-col gap-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold tracking-wide text-cyan-200">Waveform Analyzer</h3>
                            {selectedClip && (
                                <span className="text-[10px] text-slate-500 font-mono">Format: WAV/WebM | Duration: {selectedClip.duration.toFixed(2)}s</span>
                            )}
                        </div>

                        {/* Waveform Container */}
                        <div 
                            ref={waveContainerRef} 
                            className="w-full bg-[#0d1117] rounded border border-white/5 min-h-[100px] flex items-center justify-center relative p-1"
                        >
                            {!selectedClip && (
                                <span className="text-xs text-slate-600 italic">Select a voice clip from playlist to analyze waveform.</span>
                            )}
                        </div>

                        {/* Transport Buttons */}
                        {selectedClip && (
                            <div className="flex items-center gap-2">
                                {/* Raw Clean Play */}
                                <button
                                    onClick={toggleClean}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border transition-all ${isPlayingClean 
                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30' 
                                        : 'bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/[0.06]'
                                    }`}
                                >
                                    {isPlayingClean ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                                    Play Clean
                                </button>

                                {/* Processed FX Play */}
                                <button
                                    onClick={isPlayingProcessed ? stopProcessed : playProcessed}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border transition-all ${isPlayingProcessed 
                                        ? 'bg-cyan-400/15 text-cyan-300 border-cyan-400/40 animate-pulse' 
                                        : 'bg-cyan-400 text-slate-950 border-cyan-400 font-bold hover:bg-cyan-500'
                                    }`}
                                >
                                    {isPlayingProcessed ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                                    Play Processed
                                </button>

                                <div className="h-4 w-px bg-white/10 mx-1" />

                                {/* Send to Workspace */}
                                <button
                                    onClick={sendToWorkspace}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-xs font-semibold rounded border border-violet-500/40 transition-colors"
                                    title="Registers sample so you can write s('voice_filename') in live-code"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                    Send to Workspace
                                </button>

                                {/* Export WAV */}
                                <button
                                    onClick={exportAudio}
                                    disabled={isRenderingExport}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] text-xs font-semibold rounded disabled:opacity-50 transition-all ml-auto"
                                >
                                    {isRenderingExport ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                    {isRenderingExport ? 'Rendering WAV...' : 'Export WAV'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Presets Grid */}
                    <div className="rounded-lg border border-white/[0.08] bg-[#161b22] p-4 flex flex-col gap-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                        <h3 className="text-sm font-semibold tracking-wide text-cyan-200">Creative Presets</h3>
                        <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2 max-sm:grid-cols-1">
                            {voicePresets.map((preset) => (
                                <button
                                    key={preset.id}
                                    onClick={() => applyPreset(preset.id)}
                                    className={`p-2.5 rounded border text-left flex flex-col gap-1 transition-all ${preset.id === selectedPresetId 
                                        ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200 shadow-md scale-[1.01]' 
                                        : 'border-white/5 bg-white/[0.015] hover:bg-white/[0.04] text-slate-300'
                                    }`}
                                >
                                    <span className="text-xs font-bold tracking-wide">{preset.label}</span>
                                    <span className="text-[9px] text-slate-500 leading-tight line-clamp-2">{preset.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Parameter Controls & Ambience Selector */}
            <div className="grid grid-cols-3 gap-5 max-xl:grid-cols-1">
                {/* Column 1 & 2: Real-time FX sliders */}
                <div className="rounded-lg border border-white/[0.08] bg-[#161b22] p-4 flex flex-col gap-4 col-span-2 max-xl:col-span-1 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                    <h3 className="text-sm font-semibold tracking-wide text-cyan-200">Synthesis / FX Parameters</h3>
                    
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
                        {/* Pitch Slider */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">Pitch Shift</span>
                                <span className="text-cyan-300 font-mono">{effects.pitch > 0 ? `+${effects.pitch}` : effects.pitch} st</span>
                            </div>
                            <input 
                                type="range" 
                                min="-12" 
                                max="12" 
                                step="1"
                                value={effects.pitch} 
                                onChange={(e) => handleSliderChange('pitch', parseInt(e.target.value))}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Speed Slider */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">Playback Speed</span>
                                <span className="text-cyan-300 font-mono">{effects.speed.toFixed(2)}x</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.5" 
                                max="2.0" 
                                step="0.05"
                                value={effects.speed} 
                                onChange={(e) => handleSliderChange('speed', parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* EQ: Low Cut */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">EQ Low Cut (HPF)</span>
                                <span className="text-cyan-300 font-mono">{effects.lowCut} Hz</span>
                            </div>
                            <input 
                                type="range" 
                                min="40" 
                                max="1000" 
                                step="10"
                                value={effects.lowCut} 
                                onChange={(e) => handleSliderChange('lowCut', parseInt(e.target.value))}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* EQ: High Cut */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">EQ High Cut (LPF)</span>
                                <span className="text-cyan-300 font-mono">{effects.highCut} Hz</span>
                            </div>
                            <input 
                                type="range" 
                                min="2000" 
                                max="16000" 
                                step="100"
                                value={effects.highCut} 
                                onChange={(e) => handleSliderChange('highCut', parseInt(e.target.value))}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Distortion */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">Saturation / Drive</span>
                                <span className="text-cyan-300 font-mono">{Math.round(effects.distortion * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="1.0" 
                                step="0.01"
                                value={effects.distortion} 
                                onChange={(e) => handleSliderChange('distortion', parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Reverb */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">Space (Reverb)</span>
                                <span className="text-cyan-300 font-mono">{Math.round(effects.reverb * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="0.9" 
                                step="0.01"
                                value={effects.reverb} 
                                onChange={(e) => handleSliderChange('reverb', parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Delay */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">Echo (Delay)</span>
                                <span className="text-cyan-300 font-mono">{Math.round(effects.delay * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="0.8" 
                                step="0.01"
                                value={effects.delay} 
                                onChange={(e) => handleSliderChange('delay', parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Chorus */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">Modulation (Chorus)</span>
                                <span className="text-cyan-300 font-mono">{Math.round(effects.chorus * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="0.9" 
                                step="0.01"
                                value={effects.chorus} 
                                onChange={(e) => handleSliderChange('chorus', parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Bitcrusher */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">Digital Crush (Bitcrusher)</span>
                                <span className="text-cyan-300 font-mono">{Math.round(effects.bitcrusher * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="0.95" 
                                step="0.01"
                                value={effects.bitcrusher} 
                                onChange={(e) => handleSliderChange('bitcrusher', parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Gain volume */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">Vocal Gain</span>
                                <span className="text-cyan-300 font-mono">{effects.gain.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.0" 
                                max="1.5" 
                                step="0.05"
                                value={effects.gain} 
                                onChange={(e) => handleSliderChange('gain', parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Column 3: Ambient layer environment selection */}
                <div className="rounded-lg border border-white/[0.08] bg-[#161b22] p-4 flex flex-col gap-4 col-span-1 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                    <h3 className="text-sm font-semibold tracking-wide text-cyan-200">Atmosphere Layer</h3>
                    
                    <div className="flex flex-col gap-4">
                        {/* Ambience Volume */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-slate-400">Atmosphere Volume</span>
                                <span className="text-cyan-300 font-mono">{Math.round(ambienceVol * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="0.4" 
                                step="0.01"
                                value={ambienceVol} 
                                onChange={handleAmbienceVolChange}
                                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Ambience buttons */}
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'rain', label: '🌧 Rain' },
                                { id: 'wind', label: '💨 Wind' },
                                { id: 'thunder', label: '⚡ Thunder' },
                                { id: 'cave', label: '🕳 Cave' },
                                { id: 'space_ambience', label: '🌌 Space' },
                                { id: 'electronic_hum', label: '🔌 Hum' },
                                { id: 'relay_clicks', label: '⌨ Clicks' },
                                { id: 'robotic_servo', label: '⚙ Servo' },
                                { id: 'glitch_particles', label: '👾 Glitch' },
                                { id: 'alarm', label: '🚨 Alarm' },
                                { id: 'siren', label: '📢 Siren' },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => toggleAmbience(item.id as AmbienceType)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors ${activeAmbience === item.id 
                                        ? 'bg-cyan-400/15 text-cyan-300 border-cyan-400/40' 
                                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] text-slate-400'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
export default VoiceSynthesizer;
