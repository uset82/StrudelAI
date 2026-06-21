'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SSNNState, SSNNPreset, SSNNEngineType } from '../types/ssnn';
import { SSNNEngine, SSNN_LAYERS, SSNN_NEURONS_PER_LAYER, SSNN_TOTAL_NEURONS, createDefaultSSNNState } from '../lib/ssnn/engine';
import { SSNNSynthManager } from '../lib/ssnn/dsp';
import { SSNNAudioAnalyser } from '../lib/ssnn/fft';
import { loadAllPresets, savePreset } from '../lib/ssnn/presets';
import { Brain, Save, FileAudio, RefreshCw } from 'lucide-react';

interface SSNNSynthesizerProps {
    sessionBpm: number;
    isPlaying: boolean;
    ssnnState?: SSNNState;
    onStateChange?: (state: Partial<SSNNState>) => void;
}

export function SSNNSynthesizer({ sessionBpm, isPlaying, ssnnState, onStateChange }: SSNNSynthesizerProps) {
    // 1. Core Synthesis State
    const [presets, setPresets] = useState<SSNNPreset[]>([]);
    const [state, setState] = useState<SSNNState>(() => {
        const list = loadAllPresets();
        return {
            ...list[0].state,
            activePreset: 1,
            presetName: list[0].name
        };
    });

    // Synchronize parent SSNN state updates (such as AI commands)
    useEffect(() => {
        if (ssnnState) {
            setState(prev => ({
                ...prev,
                ...ssnnState
            }));
        }
    }, [ssnnState]);

    const [activeEngineConfig, setActiveEngineConfig] = useState<SSNNEngineType>('pulse');
    const [infoText, setInfoText] = useState<string>('Ready');

    // Audio & Neural Engine References
    const engineRef = useRef<SSNNEngine | null>(null);
    const synthRef = useRef<SSNNSynthManager | null>(null);
    const analyserRef = useRef<SSNNAudioAnalyser | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const recorderNodeRef = useRef<ScriptProcessorNode | null>(null);
    const mainOutputGainRef = useRef<GainNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const spikeCountRef = useRef<HTMLSpanElement | null>(null);
    const feedbackRecorderRef = useRef<ScriptProcessorNode | null>(null);
    const learningFrameCounterRef = useRef<number>(0);

    // Load presets on mount
    useEffect(() => {
        const loaded = loadAllPresets();
        setPresets(loaded);
    }, []);

    // 2. Initialize Audio Context and DSP Manager
    const initializeAudio = useCallback(async () => {
        if (audioContextRef.current) return;

        try {
            const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const ctx = new Ctx();
            audioContextRef.current = ctx;

            // Output gain
            const output = ctx.createGain();
            output.gain.value = state.mgain;
            output.connect(ctx.destination);
            mainOutputGainRef.current = output;

            // Neural engine
            const engine = new SSNNEngine(state);
            engineRef.current = engine;

            // Synthesis manager
            const synth = new SSNNSynthManager(ctx, output, state);
            synthRef.current = synth;

            // Audio input analyser
            const analyser = new SSNNAudioAnalyser();
            analyserRef.current = analyser;

            // Set up feedback recorder node to continuously record the synth's output into the granular/tape buffer
            const feedbackRecorder = ctx.createScriptProcessor(2048, 1, 1);
            feedbackRecorder.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                // Only record feedback when NOT listening to microphone
                if (synthRef.current && !engineRef.current?.getState().specListen) {
                    synthRef.current.writeToRecordBuffer(inputData);
                }
            };
            output.connect(feedbackRecorder);
            feedbackRecorder.connect(ctx.destination);
            feedbackRecorderRef.current = feedbackRecorder;

            console.log('[SSNNSynthesizer] Web Audio & LIF Engine successfully initialized.');
        } catch (e) {
            console.error('[SSNNSynthesizer] Failed to initialize Web Audio:', e);
        }
    }, [state]);

    // Handle play state sync
    useEffect(() => {
        if (isPlaying) {
            void initializeAudio().then(() => {
                if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                    void audioContextRef.current.resume();
                }
            });
        }
    }, [isPlaying, initializeAudio]);

    // Cleanup audio context on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (microphoneSourceRef.current) {
                try { microphoneSourceRef.current.disconnect(); } catch {}
            }
            if (recorderNodeRef.current) {
                try { recorderNodeRef.current.disconnect(); } catch {}
            }
            if (feedbackRecorderRef.current) {
                try { feedbackRecorderRef.current.disconnect(); } catch {}
            }
            if (analyserRef.current) {
                analyserRef.current.cleanup();
            }
            if (audioContextRef.current) {
                void audioContextRef.current.close();
            }
        };
    }, []);

    // 3. Spiking Simulation & Learning Loop (60Hz requestAnimationFrame)
    useEffect(() => {
        if (!isPlaying || !engineRef.current || !synthRef.current) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        const runLoop = () => {
            const engine = engineRef.current;
            const synth = synthRef.current;
            const analyser = analyserRef.current;

            if (!engine || !synth) return;

            let externalInput: Float32Array | undefined = undefined;

            // A. If SpecListen is enabled, capture microphone spectral profile
            if (state.specListen && analyser) {
                const spectrum = analyser.analyze();
                externalInput = spectrum; // feed as input currents into the first layer
                
                // Learn from FFT only once every 6 frames (~10Hz) to save CPU cycles
                learningFrameCounterRef.current = (learningFrameCounterRef.current + 1) % 6;
                if (learningFrameCounterRef.current === 0) {
                    engine.learnFromFFT(spectrum);
                }
            }

            // B. Step SNN model based on updateRate parameter
            // We scale updates inside the frame block
            const stepsCount = Math.max(1, Math.round(state.updateRate));
            let spikesThisFrame: number[] = [];

            for (let i = 0; i < stepsCount; i++) {
                const stepSpikes = engine.step(externalInput);
                spikesThisFrame = [...spikesThisFrame, ...stepSpikes];
            }

            // C. Trigger sound events for fired spikes (limited to prevent Web Audio thread from choking)
            // Group spikes by layer to ensure a balanced pitch/layer distribution
            const spikesByLayer: { [key: number]: number[] } = {};
            spikesThisFrame.forEach(idx => {
                const layer = Math.floor(idx / 30); // 30 neurons per layer
                if (!spikesByLayer[layer]) spikesByLayer[layer] = [];
                spikesByLayer[layer].push(idx);
            });

            const selectedSpikes: number[] = [];
            const layers = Object.keys(spikesByLayer).map(Number);
            
            // Round-robin selection across layers until we hit the polyphony limit
            const maxVoicesPerFrame = 12;
            let added = true;
            while (selectedSpikes.length < maxVoicesPerFrame && added) {
                added = false;
                for (const layer of layers) {
                    if (spikesByLayer[layer].length > 0 && selectedSpikes.length < maxVoicesPerFrame) {
                        const list = spikesByLayer[layer];
                        const randIdx = Math.floor(Math.random() * list.length);
                        selectedSpikes.push(list.splice(randIdx, 1)[0]);
                        added = true;
                    }
                }
            }

            selectedSpikes.forEach(neuronIdx => {
                synth.triggerSpike(neuronIdx, 1.0, sessionBpm);
            });

            // D. Draw wave canvas (Middle Panel 2)
            drawWaveformCanvas();

            // E. Draw SNN Visualizer Grid on Canvas (Middle Panel 1)
            drawGridCanvas();

            // F. Directly update the spikes count counter without React re-render overhead
            if (spikeCountRef.current) {
                spikeCountRef.current.textContent = String(spikesThisFrame.length);
            }

            animationFrameRef.current = requestAnimationFrame(runLoop);
        };

        animationFrameRef.current = requestAnimationFrame(runLoop);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying, state.specListen, state.updateRate, sessionBpm]);

    // Handle micro/audio source connection on SpecListen toggles
    useEffect(() => {
        const toggleMicInput = async () => {
            if (!state.specListen || !audioContextRef.current || !analyserRef.current) {
                if (microphoneSourceRef.current) {
                    try { microphoneSourceRef.current.disconnect(); } catch {}
                    microphoneSourceRef.current = null;
                }
                if (recorderNodeRef.current) {
                    try { recorderNodeRef.current.disconnect(); } catch {}
                    recorderNodeRef.current = null;
                }
                if (analyserRef.current) {
                    analyserRef.current.cleanup();
                }
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                const ctx = audioContextRef.current;
                const source = ctx.createMediaStreamSource(stream);
                microphoneSourceRef.current = source;
                analyserRef.current.setup(ctx, source);

                // Set up script recorder node to populate granular/tape loop buffers in real-time
                const recorderNode = ctx.createScriptProcessor(2048, 1, 1);
                recorderNode.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    if (synthRef.current) {
                        synthRef.current.writeToRecordBuffer(inputData);
                    }
                };
                source.connect(recorderNode);
                recorderNode.connect(ctx.destination);
                recorderNodeRef.current = recorderNode;

                console.log('[SSNNSynthesizer] Microphone source connected for FFT learning & recording.');
            } catch (e) {
                console.warn('[SSNNSynthesizer] Microphone access denied or unavailable:', e);
                setState(prev => ({ ...prev, specListen: false }));
            }
        };

        void toggleMicInput();
    }, [state.specListen]);

    // Sync volume with gain node
    useEffect(() => {
        if (mainOutputGainRef.current) {
            mainOutputGainRef.current.gain.setValueAtTime(state.mgain, audioContextRef.current?.currentTime || 0);
        }
    }, [state.mgain]);

    // Sync parameters to engine & synth refs
    useEffect(() => {
        if (engineRef.current) engineRef.current.updateState(state);
        if (synthRef.current) synthRef.current.updateState(state);
    }, [state]);

    // 4. Waveform Canvas Drawer
    const drawWaveformCanvas = () => {
        const canvas = waveCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = '#0f1218';
        ctx.fillRect(0, 0, w, h);

        const synth = synthRef.current;
        const engine = engineRef.current;
        if (!synth || !engine) return;

        const buffer = synth.getRecordBuffer();
        if (!buffer) return;

        const data = buffer.getChannelData(0);
        const bufferLen = data.length;

        // Render 32 layers of horizontal offset slices
        const rowHeight = h / SSNN_LAYERS;
        
        ctx.lineWidth = 1.0;
        
        for (let layer = 0; layer < SSNN_LAYERS; layer++) {
            const y = layer * rowHeight + rowHeight / 2.0;

            // Offset of layer
            const offsetPercent = layer / SSNN_LAYERS;
            const startIdx = Math.floor(offsetPercent * (bufferLen - 500));

            // Draw layer grid line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            // Draw visual waveforms slice
            ctx.beginPath();
            ctx.strokeStyle = state.activeEngines.includes('granular') || state.activeEngines.includes('tape')
                ? 'rgba(245, 158, 11, 0.65)' // orange waveform
                : 'rgba(6, 182, 212, 0.45)'; // cyan waveform

            for (let i = 0; i < w; i++) {
                const sampleIdx = startIdx + Math.floor((i / w) * 500);
                const sampleVal = data[sampleIdx] || 0.0;
                const offset = sampleVal * (rowHeight * 1.5);
                
                if (i === 0) {
                    ctx.moveTo(i, y + offset);
                } else {
                    ctx.lineTo(i, y + offset);
                }
            }
            ctx.stroke();

            // Render a flashing playback point if spike visual is active
            // Find if any neuron in this layer spiked
            let layerSpiked = false;
            const layerOffset = layer * SSNN_NEURONS_PER_LAYER;
            for (let col = 0; col < SSNN_NEURONS_PER_LAYER; col++) {
                if (engine.visualSpikes[layerOffset + col] > 0.6) {
                    layerSpiked = true;
                    break;
                }
            }

            if (layerSpiked) {
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(w * 0.15 + Math.random() * w * 0.7, y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    };

    // Draw SNN Activity Matrix Grid directly on HTML5 2D Canvas for 60Hz performance without React re-renders
    const drawGridCanvas = () => {
        const canvas = gridCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#0e1116';
        ctx.fillRect(0, 0, w, h);

        const engine = engineRef.current;
        if (!engine) return;

        // Draw layers
        for (let layerIdx = 0; layerIdx < SSNN_LAYERS; layerIdx++) {
            const y = 20 + layerIdx * 19;

            // Draw layer baseline indicator
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(35, y);
            ctx.lineTo(310, y);
            ctx.stroke();

            // Draw layer label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.font = '8px monospace';
            ctx.fillText(`L${layerIdx + 1}`, 12, y + 3);

            // Draw 30 neurons per layer
            for (let colIdx = 0; colIdx < SSNN_NEURONS_PER_LAYER; colIdx++) {
                const x = 38 + colIdx * 9.2;
                const neuronIdx = layerIdx * SSNN_NEURONS_PER_LAYER + colIdx;
                
                const spikeGlow = state.spikeVis ? engine.visualSpikes[neuronIdx] : 0.0;
                
                if (spikeGlow > 0.05) {
                    ctx.fillStyle = `rgba(245, 158, 11, ${0.2 + spikeGlow * 0.8})`;
                } else {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                }

                ctx.fillRect(x - 1.5, y - 1.5, 3, 3);

                // Add a border if it spiked intensely
                if (spikeGlow > 0.7) {
                    ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x - 1.5, y - 1.5, 3, 3);
                }
            }
        }
    };

    // Resumes Web Audio Context if suspended by browser autoplay policies
    const ensureAudioContextActive = async () => {
        if (!audioContextRef.current) {
            await initializeAudio();
        }
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
            setInfoText('Audio Engine Active');
            console.log('[SSNNSynthesizer] Web Audio Context resumed successfully.');
        }
    };

    // 5. Preset operations
    const applyPreset = (preset: SSNNPreset) => {
        const next = {
            ...preset.state,
            activePreset: preset.id,
            presetName: preset.name
        };
        setState(next);
        if (onStateChange) {
            setTimeout(() => onStateChange(next), 0);
        }
        setInfoText(`Loaded Preset ${preset.id}: ${preset.name}`);
    };

    const handleSavePreset = () => {
        const customName = state.presetName.trim() || `SSNN_preset_${state.activePreset}`;
        const newPreset: SSNNPreset = {
            id: state.activePreset,
            name: customName,
            state: { ...state }
        };
        savePreset(newPreset);
        
        // Reload presets
        const updated = loadAllPresets();
        setPresets(updated);
        setInfoText(`Successfully saved Preset ${state.activePreset} as: "${customName}"`);
    };

    const handleDuplicatePreset = () => {
        // Find next empty preset ID or add to end
        const nextId = presets.length + 1;
        const newPreset: SSNNPreset = {
            id: nextId,
            name: `${state.presetName}_dup`,
            state: { ...state }
        };
        savePreset(newPreset);
        
        const updated = loadAllPresets();
        setPresets(updated);
        applyPreset(newPreset);
        setInfoText(`Duplicated preset to Slot ${nextId}`);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParameterChange = (key: keyof SSNNState, val: any) => {
        const next = { ...state, [key]: val };
        setState(next);
        if (onStateChange) {
            setTimeout(() => onStateChange(next), 0);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleColumnChange = (colIdx: number, key: keyof typeof state.columns[0], val: any) => {
        const nextCols = [...state.columns];
        nextCols[colIdx] = { ...nextCols[colIdx], [key]: val };
        const next = { ...state, columns: nextCols };
        setState(next);
        if (onStateChange) {
            setTimeout(() => onStateChange(next), 0);
        }
    };

    const toggleEngine = (engine: SSNNEngineType) => {
        const active = state.activeEngines.includes(engine)
            ? state.activeEngines.filter(e => e !== engine)
            : [...state.activeEngines, engine];
        const next = { ...state, activeEngines: active };
        setState(next);
        if (onStateChange) {
            setTimeout(() => onStateChange(next), 0);
        }
    };

    // Render helper for dials
    const renderCircularDial = (label: string, value: number, min: number, max: number, onChange: (v: number) => void, colorClass = 'stroke-amber-500') => {
        const radius = 24;
        const circ = 2 * Math.PI * radius;
        const percent = (value - min) / (max - min);
        const strokeDashoffset = circ - percent * circ;

        return (
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-black/15 border border-white/5 w-20 text-center">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-[0.08em]">{label}</span>
                <div 
                    className="relative mt-2 h-14 w-14 cursor-pointer select-none"
                    onMouseDown={(e) => {
                        const startY = e.clientY;
                        const startVal = value;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                            const dy = startY - moveEvent.clientY;
                            const sensitivity = (max - min) / 120.0; // drag distance
                            const next = Math.max(min, Math.min(max, startVal + dy * sensitivity));
                            onChange(parseFloat(next.toFixed(2)));
                        };
                        const handleMouseUp = () => {
                            window.removeEventListener('mousemove', handleMouseMove);
                            window.removeEventListener('mouseup', handleMouseUp);
                        };
                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('mouseup', handleMouseUp);
                    }}
                >
                    <svg className="h-full w-full transform -rotate-90" viewBox="0 0 60 60">
                        {/* Background track */}
                        <circle cx="30" cy="30" r={radius} fill="none" className="stroke-white/10" strokeWidth="4.5" />
                        {/* Active value */}
                        <circle 
                            cx="30" 
                            cy="30" 
                            r={radius} 
                            fill="none" 
                            className={colorClass} 
                            strokeWidth="4.5" 
                            strokeDasharray={circ}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-semibold text-white">
                        {value.toFixed(2)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div 
            onClick={ensureAudioContextActive}
            className="flex flex-col h-full min-h-0 bg-[#12151b] text-slate-200 select-none overflow-y-auto studio-scrollbar max-lg:h-auto"
        >
            {/* Header / Info bar */}
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-[#171c24] px-4 py-2.5">
                <div className="flex items-center gap-3">
                    <Brain className="h-5 w-5 text-amber-500 animate-pulse" />
                    <div>
                        <h2 className="text-sm font-semibold tracking-wide text-amber-400">SSNN — Spiking and Sounding Neural Network</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">960 Neurons · 32 Layers · Closed-Loop Learning</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 text-xs">
                    {infoText && (
                        <div className="text-[11px] text-amber-500/80 font-mono italic max-md:hidden mr-2">
                            {infoText}
                        </div>
                    )}
                    <div className="rounded-lg bg-black/35 border border-white/10 px-3 py-1.5 font-mono text-amber-300">
                        Active Spikes: <span ref={spikeCountRef} className="font-bold">0</span>
                    </div>
                    <div className="rounded-lg bg-black/35 border border-white/10 px-3 py-1.5 font-mono text-cyan-300">
                        BPM: <span className="font-bold">{sessionBpm}</span>
                    </div>
                </div>
            </header>

            {/* main synthesiser layout split in grid */}
            <main className="grid flex-1 min-h-0 grid-cols-[260px_1fr_210px_340px] divide-x divide-white/5 max-xl:grid-cols-[240px_1fr_300px] max-lg:grid-cols-1 max-lg:divide-y max-lg:divide-x-0">
                
                {/* 1. Left Controller Panel */}
                <section className="flex flex-col gap-4 p-4 overflow-y-auto studio-scrollbar bg-[#111319]">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 border-b border-white/5 pb-2">
                        Network Controllers
                    </div>

                    {/* SpecListen Toggle */}
                    <div className="flex flex-col gap-1">
                        <button
                            type="button"
                            onClick={() => handleParameterChange('specListen', !state.specListen)}
                            onMouseEnter={() => setInfoText('SpecListen: Enable microphone learning. FFT writes incoming audio frequencies into connection weights.')}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold tracking-wide transition-colors ${
                                state.specListen
                                    ? 'border-amber-500 bg-amber-500/10 text-amber-200'
                                    : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/[0.04]'
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <FileAudio className="h-4 w-4" />
                                SpecListen
                            </span>
                            <span className={`h-2 w-2 rounded-full ${state.specListen ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`} />
                        </button>
                    </div>

                    {/* Left sliders */}
                    <div className="flex flex-col gap-3">
                        {[
                            { key: 'morph', label: 'Morph', min: 0.0, max: 1.0, step: 0.01, desc: 'Morph: Interpolates weights between a randomly distributed network (0.0) and the FFT-learned network (1.0).' },
                            { key: 'sweight', label: 'Sweight', min: -1.0, max: 1.0, step: 0.02, desc: 'Sweight: Adjusts spectral contrast. Positive values strengthen strong frequencies; negative values vice versa.' },
                            { key: 'inputGain', label: 'InputGain', min: 0.0, max: 20.0, step: 0.1, desc: 'InputGain: Scales amplification of the incoming audio signal fed into the network.' },
                            { key: 'bernoulli', label: 'Bernoulli', min: 0.0, max: 1.0, step: 0.01, desc: 'Bernoulli: Controls probability threshold of random stochastic voltage spikes injected into neurons.' },
                            { key: 'tau', label: 'Tau', min: 0.5, max: 10.0, step: 0.1, desc: 'Tau: The decay time constant of the membrane voltage leak in the Leaky-Integrate-and-Fire equation.' },
                            { key: 'spikeDec', label: 'SpikeDec', min: 0.0, max: 1.0, step: 0.01, desc: 'SpikeDec: Sets visual fade rate of active spike overlays on the visualizers.' },
                            { key: 'wCoef', label: 'wCoef', min: 0.0, max: 10.0, step: 0.1, desc: 'wCoef: Scalar multiplier coefficient for synaptic connection weights.' },
                            { key: 'g4', label: 'G4', min: 0.0, max: 5.0, step: 0.05, desc: 'G4: Overall output multiplier scaling spikes output triggering synthesis engines.' },
                            { key: 'updateRate', label: 'UpdateRate', min: 0.5, max: 20.0, step: 0.1, desc: 'UpdateRate: Simulating speeds of SNN updates per execution step (visual speed).' },
                            { key: 'buffLen', label: 'BuffLen', min: 5000, max: 50000, step: 1000, desc: 'BuffLen: Sample buffer lengths allocated for the granular and tape synthesis loopers.' },
                            { key: 'balanceTh', label: 'BalanceTh', min: 0.1, max: 1.0, step: 0.01, desc: 'BalanceTh: Membrane potential threshold required for a neuron to fire a spike.' }
                        ].map(slider => (
                            <label 
                                key={slider.key} 
                                className="flex flex-col gap-1 rounded bg-black/15 border border-white/5 p-2"
                                onMouseEnter={() => setInfoText(slider.desc)}
                            >
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                                    <span>{slider.label}</span>
                                    <span className="font-mono text-slate-300">
                                        {(() => {
                                            const val = state[slider.key as keyof SSNNState];
                                            return typeof val === 'number' ? val : String(val);
                                        })()}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={slider.min}
                                    max={slider.max}
                                    step={slider.step}
                                    value={state[slider.key as keyof SSNNState] as number}
                                    onChange={(e) => handleParameterChange(slider.key as keyof SSNNState, parseFloat(e.target.value))}
                                    className="studio-range w-full accent-amber-500 cursor-ew-resize h-1"
                                />
                            </label>
                        ))}
                    </div>

                    {/* Overlays toggles */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                            type="button"
                            onClick={() => handleParameterChange('spikeVis', !state.spikeVis)}
                            onMouseEnter={() => setInfoText('SpikeVis: Toggles the 60Hz visual rendering of spikes flashing in the central grid.')}
                            className={`rounded-md border py-1.5 text-[11px] font-semibold transition-colors ${
                                state.spikeVis ? 'border-amber-500 bg-amber-500/10 text-amber-200' : 'border-white/10 text-slate-500'
                            }`}
                        >
                            SpikeVis
                        </button>
                        <button
                            type="button"
                            onClick={() => handleParameterChange('voiceAlloc', !state.voiceAlloc)}
                            onMouseEnter={() => setInfoText('VoiceAlloc: Renders highlight lines showing active synthesis voice assignments.')}
                            className={`rounded-md border py-1.5 text-[11px] font-semibold transition-colors ${
                                state.voiceAlloc ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200' : 'border-white/10 text-slate-500'
                            }`}
                        >
                            VoiceAlloc
                        </button>
                    </div>

                    {/* Spiking Model Diagram */}
                    <div className="mt-4 rounded-lg border border-white/5 bg-[#0f1218] p-3 text-[10px]">
                        <div className="font-bold text-amber-500/80 mb-2 uppercase tracking-wider text-center">Leaky Integrate-and-Fire Model</div>
                        <div className="relative border border-dashed border-white/10 rounded h-24 flex items-center justify-center bg-black/30 overflow-hidden">
                            {/* Hand-drawn style LIF schema */}
                            <svg className="w-full h-full p-2" viewBox="0 0 200 100">
                                <line x1="10" y1="50" x2="60" y2="50" stroke="#f59e0b" strokeWidth="1.5" />
                                <text x="15" y="42" fill="#888" fontSize="8">Input I(t)</text>
                                
                                <circle cx="85" cy="50" r="18" fill="none" stroke="#666" strokeWidth="2" />
                                <text x="73" y="53" fill="#fff" fontSize="10" fontWeight="bold">V(t)</text>
                                
                                <line x1="85" y1="68" x2="85" y2="85" stroke="#888" strokeWidth="1" strokeDasharray="2" />
                                <text x="90" y="80" fill="#666" fontSize="8">Leakage</text>
                                
                                <line x1="103" y1="50" x2="160" y2="50" stroke="#f59e0b" strokeWidth="1.5" />
                                <text x="110" y="42" fill="#f59e0b" fontSize="8">Threshold V_th</text>
                                
                                <path d="M160,50 L170,40 M170,40 L180,60 M180,60 L190,50" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                                <text x="165" y="35" fill="#f59e0b" fontSize="8" fontWeight="bold">Spike!</text>
                            </svg>
                        </div>
                    </div>
                </section>

                {/* 2. Middle Panel 1: Neural network activity grid */}
                <section className="flex flex-col p-4 bg-[#0e1116] overflow-hidden min-w-0">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 border-b border-white/5 pb-2 mb-3">
                        SPIKING NEURAL NETWORK GRID (960 NEURONS)
                    </div>
                    <div className="flex-1 overflow-auto studio-scrollbar border border-white/5 bg-black/45 rounded-lg flex items-center justify-center p-3">
                        <canvas
                            ref={gridCanvasRef}
                            width={320}
                            height={660}
                            className="w-full h-full block bg-[#0e1116] rounded-lg max-h-[640px] max-w-[600px] min-h-[380px]"
                        />
                    </div>
                </section>

                {/* 3. Middle Panel 2: 32-Channel Wave slices */}
                <section className="flex flex-col p-4 bg-[#111319] min-w-0 max-xl:hidden">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 border-b border-white/5 pb-2 mb-3">
                        Neural Tape Loop Buffers
                    </div>
                    
                    <div className="flex-1 rounded-lg overflow-hidden border border-white/5 relative">
                        <canvas 
                            ref={waveCanvasRef} 
                            width={190} 
                            height={620}
                            className="w-full h-full block bg-[#0f1218]"
                        />
                        {/* Overlay info */}
                        <div className="absolute top-2 left-2 pointer-events-none rounded bg-black/60 border border-white/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-slate-400">
                            Layer slices mapping
                        </div>
                    </div>
                </section>

                {/* 4. Right Engine Settings Panel */}
                <section className="flex flex-col gap-4 p-4 overflow-y-auto studio-scrollbar bg-[#141822]">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 border-b border-white/5 pb-2">
                        SSNN Engine Editor
                    </div>

                    {/* SpikeQ (Quantization Settings) */}
                    <div className="rounded-lg border border-white/5 bg-black/25 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Spike Quantize (SpikeQ)</span>
                            <button
                                type="button"
                                onClick={() => handleParameterChange('spikeQ', !state.spikeQ)}
                                className={`rounded px-2.5 py-0.5 text-[10px] font-bold transition-colors ${
                                    state.spikeQ 
                                        ? 'bg-amber-500 text-slate-950' 
                                        : 'bg-white/5 text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {state.spikeQ ? 'spikeQ ON' : 'spikeQ OFF'}
                            </button>
                        </div>
                        
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <label className="flex flex-col gap-0.5">
                                <span className="text-[8px] font-bold uppercase text-slate-500">SpikeQth</span>
                                <input 
                                    type="number" 
                                    min={0.01} 
                                    max={1.0} 
                                    step={0.05} 
                                    value={state.spikeQth} 
                                    onChange={e => handleParameterChange('spikeQth', parseFloat(e.target.value))}
                                    className="rounded border border-white/10 bg-black/45 px-1 py-0.5 font-mono text-[10px] text-amber-200 w-full text-center"
                                />
                            </label>
                            <label className="flex flex-col gap-0.5">
                                <span className="text-[8px] font-bold uppercase text-slate-500">EnvSTq</span>
                                <input 
                                    type="number" 
                                    min={1} 
                                    max={64} 
                                    value={state.envStq} 
                                    onChange={e => handleParameterChange('envStq', parseInt(e.target.value, 10))}
                                    className="rounded border border-white/10 bg-black/45 px-1 py-0.5 font-mono text-[10px] text-amber-200 w-full text-center"
                                />
                            </label>
                            <label className="flex flex-col gap-0.5">
                                <span className="text-[8px] font-bold uppercase text-slate-500">QntRnd</span>
                                <input 
                                    type="number" 
                                    min={0} 
                                    max={100} 
                                    value={state.qntRnd} 
                                    onChange={e => handleParameterChange('qntRnd', parseInt(e.target.value, 10))}
                                    className="rounded border border-white/10 bg-black/45 px-1 py-0.5 font-mono text-[10px] text-amber-200 w-full text-center"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Global Dials (Tuning, Decay, WetDry) */}
                    <div className="flex gap-2 justify-around">
                        {renderCircularDial('Decay', state.decay, 0.05, 1.0, (v) => handleParameterChange('decay', v), 'stroke-amber-500')}
                        {renderCircularDial('Dry Wet', state.wetDry, 0.0, 1.0, (v) => handleParameterChange('wetDry', v), 'stroke-cyan-500')}
                    </div>

                    {/* Scale Selector */}
                    <label className="flex flex-col gap-1 rounded bg-black/15 border border-white/5 p-2.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Scala Scale Selection</span>
                        <div className="flex gap-2 items-center mt-1">
                            <select
                                value={state.tuningScale}
                                onChange={e => handleParameterChange('tuningScale', e.target.value)}
                                className="flex-1 rounded border border-white/10 bg-black/45 px-2 py-1 text-xs text-slate-300 font-semibold"
                            >
                                <option value="pentatonic">Pentatonic Scale (5 notes)</option>
                                <option value="diatonic">Diatonic Major (7 notes)</option>
                                <option value="wholetone">WholeTone scale (6 notes)</option>
                                <option value="xenakis_dial">Xenakis dial (non-octave)</option>
                                <option value="5th">Perfect Fifths (2 notes)</option>
                            </select>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={state.tune} 
                                    onChange={e => handleParameterChange('tune', e.target.checked)}
                                    className="accent-amber-500 h-3.5 w-3.5 rounded border border-white/10 bg-black"
                                />
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Tune</span>
                            </label>
                        </div>
                    </label>

                    {/* 8 Synthesis Engines Selectors */}
                    <div className="rounded-lg border border-white/5 bg-black/15 p-3">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2.5 tracking-wide">DSP Engine Router</div>
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                { id: 'pulse', label: 'Pulse Oscillator' },
                                { id: 'modal', label: 'Modal (Wood)' },
                                { id: 'synaptic', label: 'SYNaptic FM' },
                                { id: 'granular', label: 'Granular' },
                                { id: 'fm', label: 'Classic FM' },
                                { id: 'comb', label: 'Comb Filter' },
                                { id: 'tape', label: 'Tape Looper' },
                                { id: 'arpeg', label: 'Arpeggiator' }
                            ] as Array<{ id: SSNNEngineType; label: string }>).map(eng => {
                                const active = state.activeEngines.includes(eng.id);
                                const selectedInConfig = activeEngineConfig === eng.id;
                                
                                return (
                                    <div 
                                        key={eng.id} 
                                        className={`flex items-center justify-between rounded px-2.5 py-1.5 transition-colors cursor-pointer border ${
                                            selectedInConfig 
                                                ? 'border-amber-500 bg-[#282015]' 
                                                : 'border-white/5 bg-black/35 hover:bg-white/[0.02]'
                                        }`}
                                        onClick={() => setActiveEngineConfig(eng.id)}
                                    >
                                        <span className="text-[11px] font-semibold truncate text-slate-300">{eng.id.toUpperCase()}</span>
                                        
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleEngine(eng.id);
                                            }}
                                            className={`h-4.5 w-4.5 rounded-full flex items-center justify-center border transition-colors ${
                                                active 
                                                    ? 'border-amber-500 bg-amber-500 text-slate-950 font-extrabold text-[8px]' 
                                                    : 'border-white/10 bg-white/5'
                                            }`}
                                        >
                                            {active && '✓'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Active Engine Parameters Editor */}
                    <div className="rounded-lg border border-white/5 bg-[#12151d] p-3 flex-1 flex flex-col min-h-[180px]">
                        <div className="text-[10px] font-bold text-amber-500 uppercase mb-3 border-b border-white/5 pb-1">
                            Engine Params: {activeEngineConfig.toUpperCase()}
                        </div>
                        
                        <div className="flex flex-col gap-2.5 flex-1 justify-start">
                            {/* Render different parameter sliders depending on selected config */}
                            {activeEngineConfig === 'pulse' && (
                                <>
                                    <div className="text-[10px] text-slate-400 leading-normal">
                                        Simulates resistor-capacitor discharge rates, transistor decay shapes, and click events.
                                    </div>
                                    {renderParamSlider('decay', 'Capacitor Decay', 0.05, 1.0, 0.01)}
                                </>
                            )}

                            {activeEngineConfig === 'modal' && (
                                <>
                                    <div className="text-[10px] text-slate-400 leading-normal">
                                        Mimics wooden percussive mallets utilizing resonant filter sweeps.
                                    </div>
                                    {renderParamSlider('reson', 'Modal Resonator Q', 0.01, 1.0, 0.01)}
                                </>
                            )}

                            {activeEngineConfig === 'synaptic' && (
                                <>
                                    <div className="text-[10px] text-slate-400 leading-normal">
                                        FM operator modulated by neural potential rates and connection weights.
                                    </div>
                                    {renderParamSlider('modDepth', 'Modulation Index', 0.0, 1.0, 0.01)}
                                </>
                            )}

                            {activeEngineConfig === 'granular' && (
                                <>
                                    <div className="text-[10px] text-slate-400 leading-normal">
                                        Per-layer grain offsets reading different regions of captured loops.
                                    </div>
                                    {renderParamSlider('buffLen', 'Grain Window size', 1000, 50000, 500)}
                                </>
                            )}

                            {activeEngineConfig === 'fm' && (
                                <>
                                    <div className="text-[10px] text-slate-400 leading-normal">
                                        Traditional frequency modulation synthesis with variable mod depth index.
                                    </div>
                                    {renderParamSlider('modDepth', 'Frequency Mod Index', 0.0, 1.0, 0.01)}
                                </>
                            )}

                            {activeEngineConfig === 'comb' && (
                                <>
                                    <div className="text-[10px] text-slate-400 leading-normal">
                                        Feedback delay resonator modeling physical string and tube resonances.
                                    </div>
                                    {renderParamSlider('cfGain', 'Comb Feedback Gain', 0.0, 2.0, 0.05)}
                                    {renderParamSlider('reson', 'Feedback Damping Q', 0.01, 1.0, 0.01)}
                                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                                        <input 
                                            type="checkbox" 
                                            checked={state.loPass} 
                                            onChange={e => handleParameterChange('loPass', e.target.checked)}
                                            className="accent-amber-500 h-3.5 w-3.5 rounded border border-white/10 bg-black"
                                        />
                                        <span className="text-[10px] text-slate-500 uppercase font-bold">Resonant Lowpass Filter</span>
                                    </label>
                                </>
                            )}

                            {activeEngineConfig === 'tape' && (
                                <>
                                    <div className="text-[10px] text-slate-400 leading-normal">
                                        32-layer circular delay line with layer-dependent pitch shifting.
                                    </div>
                                    {renderParamSlider('decayFact', 'Delay feedback factor', 0.01, 1.5, 0.01)}
                                </>
                            )}

                            {activeEngineConfig === 'arpeg' && (
                                <>
                                    <div className="text-[10px] text-slate-400 leading-normal">
                                        Arpeggiation chord mapper. snap note steps dynamically.
                                    </div>
                                    <label className="flex flex-col gap-1 mt-1">
                                        <span className="text-[8px] font-bold uppercase text-slate-500">Chord Pattern</span>
                                        <select
                                            value={state.arpeggiatorPattern}
                                            onChange={e => handleParameterChange('arpeggiatorPattern', e.target.value)}
                                            className="rounded border border-white/10 bg-black/45 px-2 py-1 text-xs text-slate-300 font-semibold"
                                        >
                                            <option value="min-tri">Minor Triad (Arp 1)</option>
                                            <option value="octave">Octaves Jump (Arp 2)</option>
                                            <option value="5th">Perfect Fifths (Arp 3)</option>
                                        </select>
                                    </label>
                                </>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* Bottom Dashboard Area */}
            <footer className="grid grid-cols-[1fr_340px] border-t border-white/5 divide-x divide-white/5 bg-[#0e1116] shrink-0 p-4 max-lg:grid-cols-1 max-lg:divide-y max-lg:divide-x-0">
                
                {/* A. Bottom left controls: Column parameters and spectral shift */}
                <div className="flex flex-col gap-3 pr-4 max-lg:pr-0 max-lg:pb-3">
                    
                    {/* Shift & stepped diagrams */}
                    <div className="flex gap-4 items-center max-sm:flex-wrap">
                        <label className="flex flex-col gap-0.5 w-60 max-sm:w-full">
                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                <span>Spectral Shift</span>
                                <span className="font-mono text-amber-500">{state.spectralShift}</span>
                            </div>
                            <input 
                                type="range" 
                                min={0} 
                                max={10} 
                                step={1}
                                value={state.spectralShift}
                                onChange={e => handleParameterChange('spectralShift', parseInt(e.target.value, 10))}
                                className="studio-range w-full accent-amber-500 cursor-ew-resize h-1"
                            />
                        </label>
                        
                        {/* Stepped visualization bar */}
                        <div className="flex gap-1.5 items-end h-8 bg-black/40 px-3 py-1 rounded border border-white/5">
                            {[1, 2, 4, 6, 8].map(step => {
                                const active = state.spectralShift >= step;
                                return (
                                    <div 
                                        key={step} 
                                        className={`w-3 rounded-t-sm transition-colors ${active ? 'bg-amber-500' : 'bg-white/5'}`} 
                                        style={{ height: `${step * 10}%` }}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Column faders */}
                    <div className="flex gap-4 items-center mt-2 overflow-x-auto studio-scrollbar max-sm:gap-2">
                        {Array.from({ length: 4 }).map((_, idx) => {
                            const col = state.columns[idx];
                            if (!col) return null;
                            
                            return (
                                <div key={idx} className="flex items-center gap-3 bg-black/15 border border-white/5 rounded-lg px-3 py-2 min-w-[140px]">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[9px] font-bold text-slate-500 mb-1">COL {idx + 1}</span>
                                        <input 
                                            type="range"
                                            min={0.0}
                                            max={1.5}
                                            step={0.05}
                                            value={col.gain}
                                            onChange={e => handleColumnChange(idx, 'gain', parseFloat(e.target.value))}
                                            {...({ orient: "vertical" } as Record<string, unknown>)}
                                            className="h-16 w-3 accent-amber-500 cursor-ns-resize"
                                            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as unknown as React.CSSProperties}
                                        />
                                        <span className="font-mono text-[9px] text-slate-300 mt-1">{col.gain.toFixed(2)}</span>
                                    </div>

                                    <div className="flex-1 flex flex-col gap-1.5">
                                        <label className="flex flex-col">
                                            <span className="text-[8px] font-bold uppercase text-slate-500">Engine</span>
                                            <select
                                                value={col.activeEngine}
                                                onChange={e => handleColumnChange(idx, 'activeEngine', e.target.value)}
                                                className="rounded border border-white/10 bg-black/55 px-1 py-0.5 text-[10px] text-slate-300"
                                            >
                                                <option value="pulse">PULSE</option>
                                                <option value="modal">MODAL</option>
                                                <option value="synaptic">SYNFM</option>
                                                <option value="granular">GRAN</option>
                                                <option value="fm">FM</option>
                                                <option value="comb">COMB</option>
                                                <option value="tape">TAPE</option>
                                            </select>
                                        </label>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleColumnChange(idx, 'gainMod', !col.gainMod)}
                                                className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${
                                                    col.gainMod ? 'bg-amber-500/10 text-amber-200 border border-amber-500/30' : 'bg-white/5 text-slate-600 border border-transparent'
                                                }`}
                                            >
                                                GM
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnChange(idx, 'pitchMod', !col.pitchMod)}
                                                className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${
                                                    col.pitchMod ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-500/30' : 'bg-white/5 text-slate-600 border border-transparent'
                                                }`}
                                            >
                                                PM
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Master gain vertical slider */}
                        <div className="flex flex-col items-center justify-center bg-black/25 border border-amber-500/20 rounded-lg px-4 py-2 ml-auto min-w-[70px]">
                            <span className="text-[9px] font-bold text-amber-500 mb-1 uppercase">Mgain</span>
                            <input 
                                type="range"
                                min={0.0}
                                max={1.5}
                                step={0.02}
                                value={state.mgain}
                                onChange={e => handleParameterChange('mgain', parseFloat(e.target.value))}
                                {...({ orient: "vertical" } as Record<string, unknown>)}
                                className="h-16 w-3.5 accent-amber-500 cursor-ns-resize"
                                style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as unknown as React.CSSProperties}
                            />
                            <span className="font-mono text-[9px] text-amber-300 font-bold mt-1">{state.mgain.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* B. Bottom right controls: Preset grid */}
                <div className="flex flex-col gap-2.5 pl-4 max-lg:pl-0 max-lg:pt-3">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">SSNN Preset Memory bank</div>
                    
                    <div className="grid grid-cols-6 gap-1.5">
                        {Array.from({ length: 12 }).map((_, idx) => {
                            const presetNum = idx + 1;
                            const isCurrent = state.activePreset === presetNum;
                            const hasPresetDefined = presets.some(p => p.id === presetNum);
                            
                            return (
                                <button
                                    key={presetNum}
                                    type="button"
                                    onClick={() => {
                                        const p = presets.find(pr => pr.id === presetNum);
                                        if (p) {
                                            applyPreset(p);
                                        } else {
                                            // Instantiate default layout on empty slots
                                            const emptyPreset = {
                                                id: presetNum,
                                                name: `UserPreset_${presetNum}`,
                                                state: createDefaultSSNNState()
                                            };
                                            savePreset(emptyPreset);
                                            setPresets(loadAllPresets());
                                            applyPreset(emptyPreset);
                                        }
                                    }}
                                    className={`h-7 rounded text-[10px] font-bold font-mono transition-colors border ${
                                        isCurrent 
                                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.25)]' 
                                            : hasPresetDefined
                                                ? 'bg-black/35 text-slate-300 border-white/10 hover:border-amber-500/50'
                                                : 'bg-white/[0.01] text-slate-600 border-white/5 hover:border-white/10'
                                    }`}
                                >
                                    {presetNum}
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={handleSavePreset}
                            className="flex items-center justify-center gap-1 rounded bg-[#1e2535] hover:bg-[#252f44] py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 border border-white/5"
                        >
                            <Save className="h-3 w-3" />
                            IMP
                        </button>
                        <button
                            type="button"
                            onClick={handleSavePreset}
                            className="flex items-center justify-center gap-1 rounded bg-[#1e2535] hover:bg-[#252f44] py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 border border-white/5"
                        >
                            <Save className="h-3 w-3" />
                            EXP
                        </button>
                        <button
                            type="button"
                            onClick={handleDuplicatePreset}
                            className="flex items-center justify-center gap-1 rounded bg-[#2c1d1a] hover:bg-[#382622] py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200 border border-white/5"
                        >
                            <RefreshCw className="h-3 w-3" />
                            DUP
                        </button>
                    </div>

                    {/* Preset Name field */}
                    <div className="flex gap-2 items-center">
                        <input
                            type="text"
                            value={state.presetName}
                            onChange={e => handleParameterChange('presetName', e.target.value)}
                            placeholder="Preset Name..."
                            className="flex-1 rounded border border-white/10 bg-black/45 px-2 py-1 text-[11px] text-slate-300 font-mono"
                        />
                        <span className="text-[10px] text-[#06b6d4] font-bold uppercase font-sans tracking-widest shrink-0">SONIC LAB</span>
                    </div>
                </div>
            </footer>
        </div>
    );

    // Helper for rendering parameters slider inside details block
    function renderParamSlider(key: keyof SSNNState, label: string, min: number, max: number, step: number) {
        return (
            <label className="flex flex-col gap-0.5 rounded bg-black/25 border border-white/5 p-2 w-full">
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                    <span>{label}</span>
                    <span className="font-mono text-slate-300">{(state[key] as number).toFixed(2)}</span>
                </div>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={state[key] as number}
                    onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
                    className="studio-range w-full accent-amber-500 cursor-ew-resize h-1"
                />
            </label>
        );
    }
}
