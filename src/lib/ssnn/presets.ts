import { SSNNPreset } from '../../types/ssnn';
import { createDefaultSSNNState } from './engine';

// Factory Preset 1: Clean/Default state
const presetFactory: SSNNPreset = {
    id: 1,
    name: 'SSNN_factory',
    state: createDefaultSSNNState()
};

// Factory Preset 2: Pulses and Percussions (highly rhythmic and organic clicks)
const presetPulsesNPercsState = createDefaultSSNNState();
presetPulsesNPercsState.bernoulli = 0.8;
presetPulsesNPercsState.tau = 4.2;
presetPulsesNPercsState.decay = 0.35;
presetPulsesNPercsState.activeEngines = ['pulse', 'modal', 'arpeg'];
presetPulsesNPercsState.arpeggiatorPattern = 'min-tri';
presetPulsesNPercsState.tuningScale = 'pentatonic';
presetPulsesNPercsState.columns = [
    { activeEngine: 'pulse', gain: 0.9, pan: -0.6, gainMod: true, pitchMod: false },
    { activeEngine: 'modal', gain: 0.8, pan: 0.6, gainMod: false, pitchMod: true },
    { activeEngine: 'pulse', gain: 0.5, pan: -0.1, gainMod: true, pitchMod: false },
    { activeEngine: 'modal', gain: 0.4, pan: 0.1, gainMod: false, pitchMod: false }
];
const presetPulsesNPercs: SSNNPreset = {
    id: 2,
    name: 'PulsesNPercs',
    state: presetPulsesNPercsState
};

// Factory Preset 3: Acid/Sci-Fi (highly FM-modulated, comb-resonated ambient textures)
const presetLM12State = createDefaultSSNNState();
presetLM12State.bernoulli = 0.4;
presetLM12State.tau = 7.5;
presetLM12State.decay = 0.85;
presetLM12State.modDepth = 0.72;
presetLM12State.cfGain = 1.05;
presetLM12State.reson = 0.92;
presetLM12State.activeEngines = ['synaptic', 'fm', 'comb'];
presetLM12State.tuningScale = 'wholetone';
presetLM12State.columns = [
    { activeEngine: 'synaptic', gain: 0.85, pan: -0.3, gainMod: true, pitchMod: true },
    { activeEngine: 'fm', gain: 0.75, pan: 0.3, gainMod: false, pitchMod: false },
    { activeEngine: 'comb', gain: 0.8, pan: -0.7, gainMod: true, pitchMod: true },
    { activeEngine: 'synaptic', gain: 0.5, pan: 0.7, gainMod: false, pitchMod: false }
];
const presetLM12: SSNNPreset = {
    id: 3,
    name: 'LM12',
    state: presetLM12State
};

const FACTORY_PRESETS: SSNNPreset[] = [
    presetFactory,
    presetPulsesNPercs,
    presetLM12
];

export function getFactoryPresets(): SSNNPreset[] {
    return FACTORY_PRESETS;
}

export function loadAllPresets(): SSNNPreset[] {
    if (typeof window === 'undefined') {
        return FACTORY_PRESETS;
    }

    try {
        const stored = window.localStorage.getItem('aether:ssnn_presets');
        if (!stored) {
            return FACTORY_PRESETS;
        }

        const parsed = JSON.parse(stored) as SSNNPreset[];
        // Merge factory presets with saved ones
        const merged = [...FACTORY_PRESETS];
        
        parsed.forEach(userPreset => {
            const existingIdx = merged.findIndex(p => p.id === userPreset.id);
            if (existingIdx !== -1) {
                // If it is a user override, replace it
                merged[existingIdx] = userPreset;
            } else {
                merged.push(userPreset);
            }
        });

        return merged.sort((a, b) => a.id - b.id);
    } catch (e) {
        console.error('[SSNNPresets] Failed to load presets from localStorage:', e);
        return FACTORY_PRESETS;
    }
}

export function savePreset(preset: SSNNPreset) {
    if (typeof window === 'undefined') return;

    try {
        const allPresets = loadAllPresets();
        const existingIdx = allPresets.findIndex(p => p.id === preset.id);

        if (existingIdx !== -1) {
            allPresets[existingIdx] = preset;
        } else {
            allPresets.push(preset);
        }

        // Only save user modifications/custom additions to local storage
        // (to keep local storage tiny, we can filter out unchanged factory presets, or save all)
        const userPresets = allPresets.filter(p => {
            const isFactory = FACTORY_PRESETS.some(fp => fp.id === p.id && fp.name === p.name && JSON.stringify(fp.state) === JSON.stringify(p.state));
            return !isFactory;
        });

        window.localStorage.setItem('aether:ssnn_presets', JSON.stringify(userPresets));
    } catch (e) {
        console.error('[SSNNPresets] Failed to save preset to localStorage:', e);
    }
}
