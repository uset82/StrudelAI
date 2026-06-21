import { SSNN_NEURONS_PER_LAYER } from './engine';

export class SSNNAudioAnalyser {
    private analyser: AnalyserNode | null = null;
    private audioContext: AudioContext | null = null;
    private sourceNode: AudioNode | null = null;
    private dataArray: Float32Array = new Float32Array(0);
    private outputSpectrum: Float32Array;

    // Frequencies of our 30 neuron columns, mapped logarithmically from 50Hz to 8000Hz
    private bandBoundaries: number[] = [];

    constructor() {
        this.outputSpectrum = new Float32Array(SSNN_NEURONS_PER_LAYER);
        this.calculateLogBands();
    }

    /**
     * Map 30 frequency bands logarithmically between 50Hz and 8000Hz
     */
    private calculateLogBands() {
        const minFreq = 50.0;
        const maxFreq = 8000.0;
        const count = SSNN_NEURONS_PER_LAYER;

        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        const step = (logMax - logMin) / count;

        this.bandBoundaries = [];
        for (let i = 0; i <= count; i++) {
            this.bandBoundaries.push(Math.pow(10, logMin + i * step));
        }
    }

    /**
     * Set up Web Audio Analyser node with an existing source node
     */
    public setup(audioContext: AudioContext, sourceNode: AudioNode) {
        this.audioContext = audioContext;
        this.sourceNode = sourceNode;

        const fftSize = 1024;
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = fftSize;
        this.analyser.smoothingTimeConstant = 0.6; // Moderate smoothing for neural mapping stability
        
        this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
        this.sourceNode.connect(this.analyser);
    }

    /**
     * Retrieve the AnalyserNode instance
     */
    public getAnalyserNode(): AnalyserNode | null {
        return this.analyser;
    }

    /**
     * Disconnect and clean up resources
     */
    public cleanup() {
        if (this.sourceNode && this.analyser) {
            try {
                this.sourceNode.disconnect(this.analyser);
            } catch {
                // Ignore disconnect errors
            }
        }
        this.analyser = null;
        this.sourceNode = null;
        this.audioContext = null;
    }

    /**
     * Runs frequency analysis and returns a 30-element Float32Array containing
     * normalized spectral energy (0.0 to 1.0) for each neuron column frequency band.
     */
    public analyze(): Float32Array {
        if (!this.analyser || !this.audioContext) {
            this.outputSpectrum.fill(0);
            return this.outputSpectrum;
        }

        // Get raw FFT frequency energy
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.analyser.getFloatFrequencyData(this.dataArray as any);

        const sampleRate = this.audioContext.sampleRate;
        const binCount = this.analyser.frequencyBinCount;
        const binHz = sampleRate / this.analyser.fftSize;

        // Group the linear FFT bins into our 30 logarithmic bands
        for (let bandIdx = 0; bandIdx < SSNN_NEURONS_PER_LAYER; bandIdx++) {
            const startFreq = this.bandBoundaries[bandIdx];
            const endFreq = this.bandBoundaries[bandIdx + 1];

            let sumEnergy = 0;
            let count = 0;

            for (let bin = 0; bin < binCount; bin++) {
                const freq = bin * binHz;
                if (freq >= startFreq && freq < endFreq) {
                    // Raw value is in decibels (dB), ranging from -100dB (silent) to 0dB (peak)
                    const db = this.dataArray[bin];
                    // Convert dB to a normalized linear amplitude scale (0.0 to 1.0)
                    // -80dB is treated as floor, -3dB as maximum peak threshold
                    const floorDb = -80.0;
                    const peakDb = -3.0;
                    const normalized = Math.max(0.0, Math.min(1.0, (db - floorDb) / (peakDb - floorDb)));
                    
                    sumEnergy += normalized;
                    count++;
                }
            }

            if (count > 0) {
                this.outputSpectrum[bandIdx] = sumEnergy / count;
            } else {
                // Fallback: interpolate value if band is too narrow for bins at lower frequencies
                this.outputSpectrum[bandIdx] = this.outputSpectrum[Math.max(0, bandIdx - 1)] * 0.5;
            }
        }

        return this.outputSpectrum;
    }
}
