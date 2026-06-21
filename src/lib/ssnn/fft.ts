import { SSNN_NEURONS_PER_LAYER } from './engine';

export function mapFftDecibelsToSsnnBands(
    decibels: Float32Array<ArrayBufferLike>,
    sampleRate: number,
    fftSize: number,
    output: Float32Array<ArrayBufferLike> = new Float32Array(SSNN_NEURONS_PER_LAYER),
): Float32Array<ArrayBufferLike> {
    const minFreq = 50;
    const maxFreq = Math.min(8000, sampleRate / 2);
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const binHz = sampleRate / fftSize;

    for (let bandIndex = 0; bandIndex < SSNN_NEURONS_PER_LAYER; bandIndex++) {
        const startFreq = Math.pow(10, logMin + (bandIndex / SSNN_NEURONS_PER_LAYER) * (logMax - logMin));
        const endFreq = Math.pow(10, logMin + ((bandIndex + 1) / SSNN_NEURONS_PER_LAYER) * (logMax - logMin));
        const startBin = Math.max(0, Math.floor(startFreq / binHz));
        const endBin = Math.min(decibels.length, Math.max(startBin + 1, Math.ceil(endFreq / binHz)));
        let energy = 0;

        for (let bin = startBin; bin < endBin; bin++) {
            const db = Number.isFinite(decibels[bin]) ? decibels[bin] : -100;
            energy += Math.max(0, Math.min(1, (db + 80) / 77));
        }

        output[bandIndex] = endBin > startBin
            ? energy / (endBin - startBin)
            : (bandIndex > 0 ? output[bandIndex - 1] * 0.5 : 0);
    }

    return output;
}

export class SSNNAudioAnalyser {
    private analyser: AnalyserNode | null = null;
    private audioContext: AudioContext | null = null;
    private sourceNode: AudioNode | null = null;
    private dataArray: Float32Array = new Float32Array(0);
    private outputSpectrum: Float32Array;

    constructor() {
        this.outputSpectrum = new Float32Array(SSNN_NEURONS_PER_LAYER);
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

        this.analyser.getFloatFrequencyData(this.dataArray as Float32Array<ArrayBuffer>);
        return mapFftDecibelsToSsnnBands(
            this.dataArray,
            this.audioContext.sampleRate,
            this.analyser.fftSize,
            this.outputSpectrum,
        );
    }

    /** Read the analyser already attached to the main Strudel mix. */
    public analyzeNode(analyser: AnalyserNode): Float32Array {
        if (this.dataArray.length !== analyser.frequencyBinCount) {
            this.dataArray = new Float32Array(analyser.frequencyBinCount);
        }
        analyser.getFloatFrequencyData(this.dataArray as Float32Array<ArrayBuffer>);
        return mapFftDecibelsToSsnnBands(
            this.dataArray,
            analyser.context.sampleRate,
            analyser.fftSize,
            this.outputSpectrum,
        );
    }
}
