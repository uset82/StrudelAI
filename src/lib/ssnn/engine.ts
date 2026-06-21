import { SSNNState } from '../../types/ssnn';

export const SSNN_LAYERS = 32;
export const SSNN_NEURONS_PER_LAYER = 30;
export const SSNN_TOTAL_NEURONS = SSNN_LAYERS * SSNN_NEURONS_PER_LAYER; // 960

export function createDefaultSSNNState(): SSNNState {
    return {
        specListen: false,
        morph: 0.0,
        sweight: 0.0,
        inputGain: 2.0,
        bernoulli: 0.5,
        tau: 5.0,
        spikeDec: 0.5,
        wCoef: 1.0,
        g4: 1.8,
        updateRate: 2.0,
        buffLen: 30000,
        balanceTh: 0.8,
        spikeVis: true,
        voiceAlloc: false,
        spectralShift: 0,
        mgain: 0.7,
        spikeQth: 0.5,
        spikeQ: false,
        envStq: 64,
        qntRnd: 20,
        tuningScale: 'pentatonic',
        tune: true,
        decay: 0.6,
        wetDry: 0.8,
        activeEngines: ['pulse', 'comb'],
        freqs: [220.0, 330.0, 440.0, 550.0],
        cfGain: 0.63,
        reson: 0.98,
        loPass: true,
        modDepth: 0.38,
        decayFact: 0.78,
        arpeggiatorPattern: 'min-tri',
        activePreset: 1,
        presetName: 'SSNN_factory',
        columns: [
            { activeEngine: 'pulse', gain: 0.8, pan: -0.5, gainMod: true, pitchMod: false },
            { activeEngine: 'comb', gain: 0.7, pan: 0.5, gainMod: false, pitchMod: true },
            { activeEngine: 'pulse', gain: 0.0, pan: -0.2, gainMod: false, pitchMod: false },
            { activeEngine: 'pulse', gain: 0.0, pan: 0.2, gainMod: false, pitchMod: false }
        ]
    };
}

export class SSNNEngine {
    public potentials: Float32Array;
    public spikes: Uint8Array;
    public visualSpikes: Float32Array;
    
    // Weights representation:
    // 31 boundary steps, each has 30 pre-synaptic neurons, each connected to 30 post-synaptic neurons
    // Total connections: 31 * 30 * 30 = 27,900 weights
    public weights: Float32Array;
    public learnedWeights: Float32Array;
    public randomWeights: Float32Array;

    private state: SSNNState;
    private weightSize = (SSNN_LAYERS - 1) * SSNN_NEURONS_PER_LAYER * SSNN_NEURONS_PER_LAYER; // 27,900

    constructor(initialState: SSNNState = createDefaultSSNNState()) {
        this.state = initialState;
        this.potentials = new Float32Array(SSNN_TOTAL_NEURONS);
        this.spikes = new Uint8Array(SSNN_TOTAL_NEURONS);
        this.visualSpikes = new Float32Array(SSNN_TOTAL_NEURONS);

        this.weights = new Float32Array(this.weightSize);
        this.learnedWeights = new Float32Array(this.weightSize);
        this.randomWeights = new Float32Array(this.weightSize);

        this.initializeRandomWeights();
        this.initializeLearnedWeights();
        this.morphWeights();
    }

    private initializeRandomWeights() {
        for (let i = 0; i < this.weightSize; i++) {
            this.randomWeights[i] = Math.random();
        }
    }

    private initializeLearnedWeights() {
        // Initially set learned weights to a standard identity-like matrix or random distribution
        for (let i = 0; i < this.weightSize; i++) {
            this.learnedWeights[i] = 0.2 + 0.8 * Math.random();
        }
    }

    public updateState(newState: Partial<SSNNState>) {
        this.state = { ...this.state, ...newState };
        this.morphWeights();
    }

    public getState(): SSNNState {
        return this.state;
    }

    /**
     * Morph weights between random weights and learned weights based on this.state.morph
     */
    public morphWeights() {
        const morph = this.state.morph;
        const shift = this.state.spectralShift;
        const sweight = this.state.sweight;

        for (let i = 0; i < this.weightSize; i++) {
            // Apply spectral shift if we're dealing with learned weights
            let learnedIndex = i;
            if (shift > 0) {
                // Apply a wrap-around shift on connection indices
                learnedIndex = (i + shift * SSNN_NEURONS_PER_LAYER) % this.weightSize;
            }

            const rawLearned = this.learnedWeights[learnedIndex];
            const rawRandom = this.randomWeights[i];

            // Apply contrast scaling (sweight) to learned weight
            // Positive sweight strengthens high weights, negative sweight does the opposite
            let processedLearned = rawLearned;
            if (sweight > 0) {
                processedLearned = Math.pow(rawLearned, 1 + sweight * 2.0);
            } else if (sweight < 0) {
                processedLearned = Math.pow(rawLearned, 1 / (1 + Math.abs(sweight) * 2.0));
            }

            const morphed = morph * processedLearned + (1.0 - morph) * rawRandom;
            this.weights[i] = morphed * this.state.wCoef;
        }
    }

    /**
     * Set learned weights from continuous FFT input
     * spectrum: array of size 30 (representing 30 frequency bands)
     */
    public learnFromFFT(spectrum: Float32Array) {
        // Write the spectral profile directly into the connection weights
        // We project the 30 spectrum bands to reinforce layer-to-layer connections.
        // For each layer transition L -> L+1:
        // We set learnedWeights based on the spectrum energy of pre and post neurons.
        let weightIdx = 0;
        for (let layer = 0; layer < SSNN_LAYERS - 1; layer++) {
            for (let pre = 0; pre < SSNN_NEURONS_PER_LAYER; pre++) {
                // Use spectrum index for pre-neuron
                const preFreqEnergy = spectrum[pre] || 0.0;
                for (let post = 0; post < SSNN_NEURONS_PER_LAYER; post++) {
                    const postFreqEnergy = spectrum[post] || 0.0;
                    
                    // The weight is reinforced if both pre and post frequencies are active
                    // This creates a temporal associative learning rule (Heber-like identity)
                    const association = preFreqEnergy * postFreqEnergy * this.state.inputGain;
                    
                    // Leaky integrator update for connection memory
                    const leak = 0.05; // Learning retention rate
                    this.learnedWeights[weightIdx] = (1.0 - leak) * this.learnedWeights[weightIdx] + leak * association;
                    
                    weightIdx++;
                }
            }
        }
        
        // Remorph weights with updated learned weights
        this.morphWeights();
    }

    /**
     * Executes a single time step of the Leaky-Integrate-and-Fire simulation.
     * Returns an array of indexes representing the neurons that spiked in this step.
     */
    public step(externalInputCurrent?: Float32Array): number[] {
        const threshold = this.state.balanceTh;
        const decay = 1.0 / this.state.tau;
        const bernoulliProb = this.state.bernoulli;
        const visualDecay = this.state.spikeDec;
        const spikedNeurons: number[] = [];

        // 1. Calculate pre-synaptic input currents from last step's spikes
        const layerInputs = new Float32Array(SSNN_TOTAL_NEURONS);
        let weightIdx = 0;

        for (let layer = 0; layer < SSNN_LAYERS - 1; layer++) {
            const preOffset = layer * SSNN_NEURONS_PER_LAYER;
            const postOffset = (layer + 1) * SSNN_NEURONS_PER_LAYER;

            for (let pre = 0; pre < SSNN_NEURONS_PER_LAYER; pre++) {
                const preNeuronIdx = preOffset + pre;
                const didSpike = this.spikes[preNeuronIdx] === 1;

                if (!didSpike) {
                    weightIdx += SSNN_NEURONS_PER_LAYER;
                    continue;
                }

                for (let post = 0; post < SSNN_NEURONS_PER_LAYER; post++) {
                    const postNeuronIdx = postOffset + post;
                    // Propagate spike current to the next layer.
                    layerInputs[postNeuronIdx] += this.weights[weightIdx];
                    weightIdx++;
                }
            }
        }

        // Reset spike registers for this step
        this.spikes.fill(0);

        // 2. Update membrane potential for each neuron
        for (let idx = 0; idx < SSNN_TOTAL_NEURONS; idx++) {
            // Leakage equation: V(t) = V(t-1) * (1 - lambda)
            let v = this.potentials[idx] * (1.0 - decay);

            // Add internal layer-to-layer current
            v += layerInputs[idx];

            // Add external input (e.g. from FFT analysis mapped to first layer)
            if (externalInputCurrent && idx < SSNN_NEURONS_PER_LAYER) {
                v += externalInputCurrent[idx] * this.state.inputGain;
            }

            // Stochastic Bernoulli noise injection
            if (Math.random() < bernoulliProb * 0.1) {
                v += Math.random() * 0.5; // Random voltage spike injection
            }

            // 3. Firing Decision
            if (v >= threshold) {
                this.spikes[idx] = 1;
                this.visualSpikes[idx] = 1.0; // Reset visual decay peak
                spikedNeurons.push(idx);
                this.potentials[idx] = 0.0; // Reset membrane potential
            } else {
                this.potentials[idx] = Math.max(0.0, v); // Ensure positive voltage
                // Decay visual spikes smoothly for the UI frame rate
                this.visualSpikes[idx] = Math.max(0.0, this.visualSpikes[idx] * (1.0 - visualDecay * 0.15));
            }
        }

        return spikedNeurons;
    }
}
