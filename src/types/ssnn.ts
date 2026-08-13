export type SSNNEngineType = 'pulse' | 'modal' | 'synaptic' | 'granular' | 'fm' | 'comb' | 'tape' | 'arpeg';

export interface SSNNColumnSettings {
    activeEngine: SSNNEngineType;
    gain: number;
    pan: number;
    gainMod: boolean;
    pitchMod: boolean;
}

export interface SSNNState {
    // SSNN has an independent run switch. It must never start from the main
    // transport alone; the user explicitly enables it first.
    isEnabled: boolean;

    // SNN Network Parameters
    specListen: boolean;
    morph: number;       // 0.0 to 1.0 (random weights to learned weights)
    sweight: number;     // -1.0 to 1.0 (contrast scaling)
    inputGain: number;   // 0.0 to 20.0
    bernoulli: number;   // 0.0 to 1.0 (stochastic noise injection)
    tau: number;         // 0.1 to 10.0 (decay constant)
    spikeDec: number;    // 0.0 to 1.0 (decay rate of visual spikes)
    wCoef: number;       // 0.0 to 10.0 (weight coefficient multiplier)
    g4: number;          // 0.0 to 5.0 (output threshold/gain parameter)
    updateRate: number;  // 0.1 to 50.0 (neural simulation speed)
    buffLen: number;     // 1000 to 50000 (audio buffer length in samples)
    balanceTh: number;   // 0.0 to 1.0 (firing threshold)
    spikeVis: boolean;   // Enable visual spikes rendering
    voiceAlloc: boolean; // Enable voice allocation visualization

    // Global controls
    spectralShift: number; // 0 to 10 shift index
    mgain: number;         // Master gain: 0.0 to 1.5

    // SpikeQ / Quantization Settings
    spikeQth: number;    // Quantization threshold: 0.0 to 1.0
    spikeQ: boolean;     // Enable quantization
    envStq: number;      // Envelope sync / metronome division (e.g. 64)
    qntRnd: number;      // Quantization randomness index: 0 to 100

    // Scales & Global Sound Controls
    tuningScale: string; // Scale name e.g., 'pentatonic', 'diatonic', 'wholetone', 'xenakis_dial'
    tune: boolean;       // Pitch quantization enabled
    decay: number;       // Global voice decay: 0.0 to 1.0
    wetDry: number;      // Reverb/FX mix: 0.0 to 1.0

    // Synthesis Engines Settings
    activeEngines: SSNNEngineType[];
    freqs: number[];     // Four voice base frequencies [Freq1, Freq2, Freq3, Freq4]
    cfGain: number;      // Comb Filter Gain: 0.0 to 2.0
    reson: number;       // Comb resonance / filter resonance: 0.0 to 1.0
    loPass: boolean;     // Enable lowpass filter on comb
    modDepth: number;    // Modulation depth: 0.0 to 1.0
    decayFact: number;   // Decay factor: 0.0 to 1.0
    arpeggiatorPattern: string; // e.g. 'min-tri', 'octave', '5th'

    // Preset configurations
    activePreset: number; // 1 to 12
    presetName: string;

    // Per column routing configurations (4 columns)
    columns: SSNNColumnSettings[];
}

export interface SSNNPreset {
    id: number;
    name: string;
    state: Omit<SSNNState, 'activePreset' | 'presetName'>;
}
