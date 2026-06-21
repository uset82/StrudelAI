import { SSNNState } from '../../types/ssnn';
import { SSNN_NEURONS_PER_LAYER, SSNN_LAYERS } from './engine';

// Helper to map index to frequencies in various musical scales
export function getScaleFrequencies(scaleName: string, rootFreq = 130.81 /* C3 */): number[] {
    const freqs: number[] = [];
    
    // Scale patterns (semitone offsets from root)
    let pattern: number[] = [];
    switch (scaleName.toLowerCase()) {
        case 'pentatonic':
            pattern = [0, 2, 4, 7, 9]; // Major Pentatonic
            break;
        case 'diatonic':
            pattern = [0, 2, 4, 5, 7, 9, 11]; // Major
            break;
        case 'wholetone':
            pattern = [0, 2, 4, 6, 8, 10]; // Whole tone
            break;
        case 'xenakis_dial':
            // Custom non-tempered Xenakis-inspired scale
            pattern = [0, 1.5, 3.8, 5.1, 7.3, 8.9, 11.2]; 
            break;
        case '5th':
            pattern = [0, 7]; // Perfect fifths
            break;
        default:
            pattern = [0, 2, 4, 7, 9]; // default to pentatonic
    }

    const patternLen = pattern.length;
    for (let i = 0; i < SSNN_NEURONS_PER_LAYER; i++) {
        const octave = Math.floor(i / patternLen);
        const noteIdx = i % patternLen;
        const semitones = octave * 12 + pattern[noteIdx];
        // Calculate frequency: f = root * 2^(semitones/12)
        const freq = rootFreq * Math.pow(2.0, semitones / 12.0);
        freqs.push(parseFloat(freq.toFixed(2)));
    }

    return freqs;
}

export class SSNNSynthManager {
    private ctx: AudioContext;
    private outputNode: GainNode;
    private state: SSNNState;
    private scaleFreqs: number[] = [];
    
    // Tape & Granular Recording Buffer
    private recordBuffer: AudioBuffer | null = null;
    private recordBufferSamples = 44100 * 2; // 2 seconds default
    private isRecording = false;
    private activeVoiceEvents = 0;
    private readonly maxVoiceEvents = 24;
    private noiseBuffer: AudioBuffer | null = null;

    constructor(ctx: AudioContext, outputNode: GainNode, initialState: SSNNState) {
        this.ctx = ctx;
        this.outputNode = outputNode;
        this.state = initialState;
        
        this.updateScale();
        this.initializeRecordBuffer();
        this.initializeNoiseBuffer();
    }

    public updateState(newState: Partial<SSNNState>) {
        const oldScale = this.state.tuningScale;
        const oldBufferLength = this.state.buffLen;
        this.state = { ...this.state, ...newState };
        if (oldScale !== this.state.tuningScale) {
            this.updateScale();
        }
        if (oldBufferLength !== this.state.buffLen) {
            this.initializeRecordBuffer();
        }
    }

    private updateScale() {
        // Base root frequency for scale mapping (e.g. C3 = 130.81Hz)
        const root = 130.81;
        this.scaleFreqs = getScaleFrequencies(this.state.tuningScale, root);
    }

    private initializeNoiseBuffer() {
        const sampleRate = this.ctx.sampleRate || 44100;
        const bufferSize = sampleRate * 2; // 2 seconds of noise
        try {
            this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2.0 - 1.0;
            }
        } catch (e) {
            console.error('[SSNNSynthManager] Failed to create noiseBuffer:', e);
        }
    }

    private initializeRecordBuffer() {
        const sampleRate = this.ctx.sampleRate || 44100;
        this.recordBufferSamples = this.state.buffLen;
        try {
            this.recordBuffer = this.ctx.createBuffer(1, this.recordBufferSamples, sampleRate);
            
            // Fill with a brief sine wave / noise as initial seed material
            const data = this.recordBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.sin(2.0 * Math.PI * 440.0 * (i / sampleRate)) * 0.2 * Math.exp(-3.0 * i / sampleRate);
            }
        } catch (e) {
            console.error('[SSNNSynthManager] Failed to create AudioBuffer:', e);
        }
    }

    /**
     * Write new incoming audio samples into the circular granular/tape record buffer.
     */
    public writeToRecordBuffer(samples: Float32Array) {
        if (!this.recordBuffer) return;
        const channelData = this.recordBuffer.getChannelData(0);
        
        // Circular buffer shift and write
        const incomingLen = samples.length;
        if (incomingLen >= channelData.length) {
            channelData.set(samples.subarray(incomingLen - channelData.length));
        } else {
            // Shift left and append at the end
            channelData.copyWithin(0, incomingLen);
            channelData.set(samples, channelData.length - incomingLen);
        }
    }

    /**
     * Returns the current record buffer for visualization
     */
    public getRecordBuffer(): AudioBuffer | null {
        return this.recordBuffer;
    }

    /**
     * Trigger a sound event when a neuron spikes
     * @param neuronIndex 0 to 959 (indicates which neuron spiked)
     * @param intensity Firing strength/membrane potential (0.0 to 1.0)
     * @param bpm The current BPM of the session for quantization calculations
     */
    public triggerSpike(neuronIndex: number, intensity = 1.0, bpm = 128, scheduledTime?: number): boolean {
        if (this.activeVoiceEvents >= this.maxVoiceEvents) return false;

        const layer = Math.floor(neuronIndex / SSNN_NEURONS_PER_LAYER);
        const col = neuronIndex % SSNN_NEURONS_PER_LAYER;
        
        // Find matching engine from per-column or global settings
        const colSettings = this.state.columns[layer % 4];
        
        // Check if this engine is active globally
        const engine = colSettings?.activeEngine || 'pulse';
        if (!this.state.activeEngines.includes(engine)) {
            return false; // Skip if engine is not enabled in activeEngines list
        }

        // 1. Determine base pitch/frequency
        let baseFreq = this.scaleFreqs[col] || 220.0;
        
        // Apply pitch quantization tuning
        if (this.state.tune) {
            const snapIndex = Math.min(Math.max(0, col), this.scaleFreqs.length - 1);
            baseFreq = this.scaleFreqs[snapIndex];
        }

        // Apply global arpeggiator patterns if active
        if (this.state.activeEngines.includes('arpeg')) {
            baseFreq = this.applyArpeggiatorPattern(baseFreq, col, layer);
        }

        // Apply pitch modulation from columns if active
        if (colSettings?.pitchMod) {
            baseFreq *= (1.0 + (Math.random() - 0.5) * this.state.modDepth * 0.15);
        }

        // Adjust layer volume
        const layerVol = colSettings ? colSettings.gain : 0.8;
        const pan = colSettings ? colSettings.pan : 0.0;

        // 2. Quantization logic
        const now = this.ctx.currentTime;
        let triggerTime = Math.max(now, scheduledTime ?? now);
        if (this.state.spikeQ) {
            const division = this.state.envStq || 16;
            const stepSec = 240.0 / (bpm * division);
            
            // Snap to the next quantized division
            let scheduled = Math.ceil(triggerTime / stepSec) * stepSec;

            // Apply metronome quantization randomness
            if (this.state.qntRnd > 0) {
                const jitter = (Math.random() - 0.5) * stepSec * (this.state.qntRnd / 100.0);
                scheduled += jitter;
            }
            triggerTime = Math.max(now, scheduled);
        }
        
        // Trigger specific synthesis model
        switch (engine) {
            case 'pulse':
                this.triggerPulseEngine(baseFreq, layerVol, pan, intensity, triggerTime);
                break;
            case 'modal':
                this.triggerModalEngine(baseFreq, layerVol, pan, intensity, triggerTime);
                break;
            case 'synaptic':
                this.triggerSynapticFMEngine(baseFreq, layerVol, pan, intensity, triggerTime);
                break;
            case 'granular':
                this.triggerGranularEngine(baseFreq, layerVol, pan, intensity, layer, triggerTime);
                break;
            case 'fm':
                this.triggerFMEngine(baseFreq, layerVol, pan, intensity, triggerTime);
                break;
            case 'comb':
                this.triggerCombEngine(baseFreq, layerVol, pan, intensity, triggerTime);
                break;
            case 'tape':
                this.triggerTapeEngine(baseFreq, layerVol, pan, intensity, layer, triggerTime);
                break;
            default:
                this.triggerPulseEngine(baseFreq, layerVol, pan, intensity, triggerTime);
                break;
        }

        this.activeVoiceEvents += 1;
        const releaseSeconds = engine === 'tape'
            ? Math.max(0.15, this.state.decayFact * 1.5)
            : Math.max(0.12, this.state.decay * 0.55);
        window.setTimeout(() => {
            this.activeVoiceEvents = Math.max(0, this.activeVoiceEvents - 1);
        }, Math.ceil((triggerTime - now + releaseSeconds + 0.08) * 1000));
        return true;
    }

    private applyArpeggiatorPattern(freq: number, col: number, layer: number): number {
        const pattern = this.state.arpeggiatorPattern;
        let semitoneOffset = 0;
        const tick = (layer + col) % 8;

        if (pattern === 'min-tri') {
            const minChord = [0, 3, 7, 12];
            semitoneOffset = minChord[tick % 4];
        } else if (pattern === 'octave') {
            semitoneOffset = (tick % 3) * 12;
        } else if (pattern === '5th') {
            semitoneOffset = (tick % 2 === 0) ? 0 : 7;
        }
        
        return freq * Math.pow(2.0, semitoneOffset / 12.0);
    }

    /**
     * Create voice panning node
     */
    private createPanNode(panVal: number): StereoPannerNode | null {
        if (this.ctx.createStereoPanner) {
            const panner = this.ctx.createStereoPanner();
            panner.pan.value = Math.max(-1.0, Math.min(1.0, panVal));
            return panner;
        }
        return null;
    }

    /**
     * Pulse Engine: Mimics capacitors discharging, relay click sounds, and noise ticks.
     */
    private triggerPulseEngine(freq: number, layerVol: number, pan: number, intensity: number, time: number) {
        const decayTime = Math.max(0.01, this.state.decay * 0.12);

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, time);
        
        osc.frequency.exponentialRampToValueAtTime(freq * 3.5, time + 0.005);
        osc.frequency.exponentialRampToValueAtTime(freq, time + 0.02);

        gainNode.gain.setValueAtTime(0.0, time);
        gainNode.gain.linearRampToValueAtTime(intensity * layerVol * 0.25, time + 0.002);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + decayTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2.0, time);
        filter.frequency.exponentialRampToValueAtTime(freq * 0.2, time + decayTime);

        osc.connect(filter);
        filter.connect(gainNode);

        const panner = this.createPanNode(pan);
        if (panner) {
            gainNode.connect(panner);
            panner.connect(this.outputNode);
        } else {
            gainNode.connect(this.outputNode);
        }

        // Spark transient static discharge click
        let noiseSource: AudioBufferSourceNode | null = null;
        let noiseGain: GainNode | null = null;
        let noiseFilter: BiquadFilterNode | null = null;
        
        if (this.noiseBuffer) {
            noiseSource = this.ctx.createBufferSource();
            noiseSource.buffer = this.noiseBuffer;
            const offset = Math.random() * (this.noiseBuffer.duration - 0.015);
            
            noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.0, time);
            noiseGain.gain.linearRampToValueAtTime(intensity * layerVol * 0.42, time + 0.001);
            noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.008);
            
            noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.setValueAtTime(4500.0, time);
            
            noiseSource.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            
            if (panner) {
                noiseGain.connect(panner);
            } else {
                noiseGain.connect(this.outputNode);
            }
            
            noiseSource.start(time, offset);
            noiseSource.stop(time + 0.015);
        }

        osc.start(time);
        osc.stop(time + decayTime + 0.05);

        // Explicit cleanup to avoid any potential nodes leakage
        window.setTimeout(() => {
            try {
                osc.disconnect();
                gainNode.disconnect();
                filter.disconnect();
                panner?.disconnect();
                if (noiseSource) noiseSource.disconnect();
                if (noiseGain) noiseGain.disconnect();
                if (noiseFilter) noiseFilter.disconnect();
            } catch {}
        }, Math.ceil((decayTime + 0.1) * 1000));
    }

    /**
     * Modal Synthesis Engine: Mimics wood percussions and metal tines.
     */
    private triggerModalEngine(freq: number, layerVol: number, pan: number, intensity: number, time: number) {
        const decayTime = Math.max(0.05, this.state.decay * 0.35);

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        const partialRatios = [2.5, 5.4];
        
        gainNode.gain.setValueAtTime(0.0, time);
        gainNode.gain.linearRampToValueAtTime(intensity * layerVol * 0.25, time + 0.003);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + decayTime);

        osc.connect(gainNode);

        const panner = this.createPanNode(pan);
        const target = panner ? panner : this.outputNode;
        if (panner) {
            gainNode.connect(panner);
            panner.connect(this.outputNode);
        } else {
            gainNode.connect(this.outputNode);
        }

        // Mallet excitation click tick
        let noiseSource: AudioBufferSourceNode | null = null;
        let noiseGain: GainNode | null = null;
        let noiseFilter: BiquadFilterNode | null = null;
        
        if (this.noiseBuffer) {
            noiseSource = this.ctx.createBufferSource();
            noiseSource.buffer = this.noiseBuffer;
            const offset = Math.random() * (this.noiseBuffer.duration - 0.01);
            
            noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.0, time);
            noiseGain.gain.linearRampToValueAtTime(intensity * layerVol * 0.38, time + 0.001);
            noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.005);
            
            noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(2800.0, time);
            noiseFilter.Q.setValueAtTime(5.0, time);
            
            noiseSource.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(target);
            
            noiseSource.start(time, offset);
            noiseSource.stop(time + 0.01);
        }

        osc.start(time);
        osc.stop(time + decayTime + 0.05);

        // Partial resonators
        const resonators: Array<{ pOsc: OscillatorNode; pGain: GainNode }> = [];
        partialRatios.forEach((ratio, i) => {
            const pOsc = this.ctx.createOscillator();
            const pGain = this.ctx.createGain();
            
            pOsc.type = 'sine';
            pOsc.frequency.setValueAtTime(freq * ratio, time);

            pGain.gain.setValueAtTime(0.0, time);
            pGain.gain.linearRampToValueAtTime(intensity * layerVol * 0.08 * (1.0 / (i + 1)), time + 0.002);
            pGain.gain.exponentialRampToValueAtTime(0.0001, time + decayTime * (0.3 / (i + 1)));

            pOsc.connect(pGain);
            pGain.connect(target);

            pOsc.start(time);
            pOsc.stop(time + decayTime + 0.05);
            resonators.push({ pOsc, pGain });
        });

        // Cleanup resources
        window.setTimeout(() => {
            try {
                osc.disconnect();
                gainNode.disconnect();
                panner?.disconnect();
                if (noiseSource) noiseSource.disconnect();
                if (noiseGain) noiseGain.disconnect();
                if (noiseFilter) noiseFilter.disconnect();
                resonators.forEach(res => {
                    res.pOsc.disconnect();
                    res.pGain.disconnect();
                });
            } catch {}
        }, Math.ceil((decayTime + 0.1) * 1000));
    }

    /**
     * SYNaptic FM Synthesis: FM synthesis driven directly by the spiking neuron activations.
     */
    private triggerSynapticFMEngine(freq: number, layerVol: number, pan: number, intensity: number, time: number) {
        const decayTime = Math.max(0.05, this.state.decay * 0.28);

        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const mainGain = this.ctx.createGain();

        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(freq, time);

        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(freq * 1.414, time);

        const modAmount = freq * this.state.modDepth * 3.5;
        modGain.gain.setValueAtTime(modAmount, time);
        modGain.gain.exponentialRampToValueAtTime(0.01, time + decayTime);

        mainGain.gain.setValueAtTime(0.0, time);
        mainGain.gain.linearRampToValueAtTime(intensity * layerVol * 0.25, time + 0.004);
        mainGain.gain.exponentialRampToValueAtTime(0.0001, time + decayTime);

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(mainGain);

        const panner = this.createPanNode(pan);
        if (panner) {
            mainGain.connect(panner);
            panner.connect(this.outputNode);
        } else {
            mainGain.connect(this.outputNode);
        }

        carrier.start(time);
        modulator.start(time);
        carrier.stop(time + decayTime + 0.05);
        modulator.stop(time + decayTime + 0.05);
    }

    /**
     * Granular Synthesis: Reads slices from the circular buffer with per-layer offsets.
     */
    private triggerGranularEngine(freq: number, layerVol: number, pan: number, intensity: number, layerIndex: number, time: number) {
        if (!this.recordBuffer) return;

        const duration = this.recordBuffer.duration;
        const grainSize = Math.max(0.02, this.state.decay * 0.2);

        const offsetPercent = layerIndex / SSNN_LAYERS;
        const startOffset = offsetPercent * (duration - grainSize);

        const bufferSource = this.ctx.createBufferSource();
        const gainNode = this.ctx.createGain();

        bufferSource.buffer = this.recordBuffer;
        
        const originalFreq = 220.0;
        const speed = freq / originalFreq;
        bufferSource.playbackRate.setValueAtTime(speed, time);

        gainNode.gain.setValueAtTime(0.0, time);
        gainNode.gain.linearRampToValueAtTime(intensity * layerVol * 0.35, time + 0.008);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + grainSize);

        bufferSource.connect(gainNode);

        const panner = this.createPanNode(pan);
        if (panner) {
            gainNode.connect(panner);
            panner.connect(this.outputNode);
        } else {
            gainNode.connect(this.outputNode);
        }

        try {
            bufferSource.start(time, startOffset, grainSize);
        } catch {
            bufferSource.start(time, 0, grainSize);
        }
    }

    /**
     * Standard FM Synthesis Engine (Carrier + Modulator).
     */
    private triggerFMEngine(freq: number, layerVol: number, pan: number, intensity: number, time: number) {
        const decayTime = Math.max(0.05, this.state.decay * 0.3);

        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const mainGain = this.ctx.createGain();

        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(freq, time);

        modulator.type = 'sawtooth';
        modulator.frequency.setValueAtTime(freq * 2.00, time);

        const index = freq * this.state.modDepth * 2.0;
        modGain.gain.setValueAtTime(index, time);
        modGain.gain.linearRampToValueAtTime(0, time + decayTime);

        mainGain.gain.setValueAtTime(0.0, time);
        mainGain.gain.linearRampToValueAtTime(intensity * layerVol * 0.22, time + 0.005);
        mainGain.gain.exponentialRampToValueAtTime(0.0001, time + decayTime);

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(mainGain);

        const panner = this.createPanNode(pan);
        if (panner) {
            mainGain.connect(panner);
            panner.connect(this.outputNode);
        } else {
            mainGain.connect(this.outputNode);
        }

        carrier.start(time);
        modulator.start(time);
        carrier.stop(time + decayTime + 0.05);
        modulator.stop(time + decayTime + 0.05);
    }

    /**
     * Comb Filter Resonator: Physical-modeling feedback delay line.
     */
    private triggerCombEngine(freq: number, layerVol: number, pan: number, intensity: number, time: number) {
        const decayTime = Math.max(0.05, this.state.decay * 0.5);

        const bufferSize = this.ctx.sampleRate * 0.01;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        // Double energy and saturate the excitation buffer for "explosive metallic shock"
        for (let i = 0; i < bufferSize; i++) {
            const rawNoise = (Math.random() * 2.0 - 1.0) * 2.2 * Math.exp(-80.0 * i / bufferSize);
            data[i] = Math.tanh(rawNoise); // soft clipping saturation
        }

        const exciter = this.ctx.createBufferSource();
        exciter.buffer = buffer;

        const delayTime = 1.0 / freq;
        const delayNode = this.ctx.createDelay(0.1);
        delayNode.delayTime.setValueAtTime(delayTime, time);

        const feedbackGain = this.ctx.createGain();
        const fbVal = Math.min(0.995, this.state.cfGain * this.state.reson);
        feedbackGain.gain.setValueAtTime(fbVal, time);
        feedbackGain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

        const lpFilter = this.ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.setValueAtTime(this.state.loPass ? freq * 3.0 : 20000.0, time);

        exciter.connect(delayNode);
        delayNode.connect(lpFilter);
        lpFilter.connect(feedbackGain);
        feedbackGain.connect(delayNode);

        const mainGain = this.ctx.createGain();
        mainGain.gain.setValueAtTime(intensity * layerVol * 0.38, time);
        mainGain.gain.exponentialRampToValueAtTime(0.0001, time + decayTime);

        delayNode.connect(mainGain);

        const panner = this.createPanNode(pan);
        if (panner) {
            mainGain.connect(panner);
            panner.connect(this.outputNode);
        } else {
            mainGain.connect(this.outputNode);
        }

        exciter.start(time);
        exciter.stop(time + 0.05);
        window.setTimeout(() => {
            try {
                exciter.disconnect();
                delayNode.disconnect();
                lpFilter.disconnect();
                feedbackGain.disconnect();
                mainGain.disconnect();
                panner?.disconnect();
            } catch { /* nodes may already be disconnected */ }
        }, Math.ceil((time - this.ctx.currentTime + decayTime + 0.1) * 1000));
    }

    /**
     * Tape Looper: 32-layer circular delay line with layer-dependent pitch shifting.
     */
    private triggerTapeEngine(freq: number, layerVol: number, pan: number, intensity: number, layerIndex: number, time: number) {
        if (!this.recordBuffer) return;

        const duration = this.recordBuffer.duration;
        const loopTime = Math.max(0.1, this.state.decayFact * 1.5);
        const playableDuration = Math.max(0.02, Math.min(loopTime, duration));
        const startOffset = ((layerIndex * 0.03) % 1.0) * Math.max(0, duration - playableDuration);

        const source = this.ctx.createBufferSource();
        const mainGain = this.ctx.createGain();

        source.buffer = this.recordBuffer;
        source.loop = loopTime > playableDuration;
        source.loopStart = startOffset;
        source.loopEnd = Math.min(duration, startOffset + playableDuration);
        
        const speed = freq / 220.0;
        source.playbackRate.setValueAtTime(speed, time);

        mainGain.gain.setValueAtTime(0.0, time);
        mainGain.gain.linearRampToValueAtTime(intensity * layerVol * 0.35, time + 0.01);
        mainGain.gain.exponentialRampToValueAtTime(0.0001, time + loopTime);

        source.connect(mainGain);

        const panner = this.createPanNode(pan);
        if (panner) {
            mainGain.connect(panner);
            panner.connect(this.outputNode);
        } else {
            mainGain.connect(this.outputNode);
        }

        try {
            source.start(time, startOffset);
            source.stop(time + loopTime);
        } catch {
            source.start(time, 0);
            source.stop(time + loopTime);
        }
    }
}
