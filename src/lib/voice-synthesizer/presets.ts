import { VoicePreset, DEFAULT_EFFECT_SETTINGS } from './types';

export const voicePresets: VoicePreset[] = [
    {
        id: 'neutral',
        label: 'Neutral (Clean)',
        description: 'Dry, unaltered recording of your voice.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS
        },
        ambience: 'none'
    },
    {
        id: 'deep_cinematic',
        label: 'Deep Cinematic',
        description: 'Low, dark, trailer-style voice with subtle saturation and space.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: -5,
            speed: 0.9,
            lowCut: 60,
            highCut: 8000,
            distortion: 0.15,
            reverb: 0.35,
            delay: 0.08,
            chorus: 0.05,
            vibrato: 0.03,
            wetDry: 0.8,
            gain: 1.1,
            stereoWidth: 0.7
        },
        ambience: 'none'
    },
    {
        id: 'robotic',
        label: 'Robotic Voice',
        description: 'Synthesized, metallic vocoder style with ring modulation and bitcrushing.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: -2,
            speed: 1.0,
            lowCut: 120,
            highCut: 6000,
            distortion: 0.25,
            reverb: 0.25,
            delay: 0.15,
            chorus: 0.45,
            tremolo: 0.35,
            bitcrusher: 0.4,
            noiseLayer: 0.1,
            wetDry: 1.0,
            gain: 1.0,
            stereoWidth: 0.8
        },
        ambience: 'mechanical_noise'
    },
    {
        id: 'alien',
        label: 'Alien Lifeform',
        description: 'Ethereal pitch shifts, modulation, and spacey delays.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: 5,
            speed: 1.1,
            lowCut: 200,
            highCut: 10000,
            reverb: 0.45,
            delay: 0.35,
            chorus: 0.5,
            tremolo: 0.2,
            vibrato: 0.4,
            wetDry: 0.85,
            gain: 0.9,
            stereoWidth: 0.9
        },
        ambience: 'space_ambience'
    },
    {
        id: 'monster',
        label: 'Monster Growl',
        description: 'Enormous pitch drop with heavy tube saturation and slow tempo.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: -8,
            speed: 0.8,
            lowCut: 40,
            highCut: 5000,
            distortion: 0.4,
            reverb: 0.4,
            delay: 0.1,
            chorus: 0.2,
            wetDry: 0.9,
            gain: 1.2,
            stereoWidth: 0.6
        },
        ambience: 'cave'
    },
    {
        id: 'lion',
        label: 'Lion Roar',
        description: 'Aggressive low guttural resonance with sharp clipping overdrive.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: -10,
            speed: 0.75,
            lowCut: 50,
            highCut: 4500,
            distortion: 0.5,
            reverb: 0.3,
            tremolo: 0.15,
            wetDry: 0.95,
            gain: 1.3,
            stereoWidth: 0.5
        },
        ambience: 'forest'
    },
    {
        id: 'radio_announcer',
        label: 'Radio Announcer',
        description: 'Crisp mid-range emphasis with dry slapback, clean broadcast compression.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: 0,
            speed: 1.0,
            lowCut: 180,
            highCut: 6500,
            distortion: 0.1,
            reverb: 0.1,
            delay: 0.05,
            wetDry: 1.0,
            gain: 1.25,
            stereoWidth: 0.4
        },
        ambience: 'none'
    },
    {
        id: 'old_telephone',
        label: 'Old Telephone',
        description: 'Highly bandpassed, retro speaker carbon-mic crunch.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: 2,
            speed: 1.0,
            lowCut: 450,
            highCut: 3000,
            distortion: 0.3,
            reverb: 0.05,
            noiseLayer: 0.25,
            wetDry: 1.0,
            gain: 1.1,
            stereoWidth: 0.1
        },
        ambience: 'relay_clicks'
    },
    {
        id: 'glitch_ai',
        label: 'Glitchy AI',
        description: 'Fragmented bits, high pitch fluctuations, and digital decay.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: 6,
            speed: 1.25,
            lowCut: 150,
            highCut: 9000,
            distortion: 0.25,
            reverb: 0.2,
            delay: 0.25,
            tremolo: 0.4,
            bitcrusher: 0.55,
            noiseLayer: 0.2,
            wetDry: 0.95,
            gain: 0.95,
            stereoWidth: 0.8
        },
        ambience: 'glitch_particles'
    },
    {
        id: 'whisper',
        label: 'Whisper Voice',
        description: 'Breath-focused vocal dynamic with high noise-layer masking.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: 0,
            speed: 0.9,
            lowCut: 250,
            highCut: 12000,
            reverb: 0.35,
            noiseLayer: 0.7, // High air/noise layer
            wetDry: 0.85,
            gain: 1.35,
            stereoWidth: 0.6
        },
        ambience: 'none'
    },
    {
        id: 'thunder_god',
        label: 'Thunder God',
        description: 'Mighty booming voice coupled with lightning-like delays and dark reverberations.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: -4,
            speed: 0.9,
            lowCut: 60,
            highCut: 8500,
            distortion: 0.2,
            reverb: 0.6,
            delay: 0.3,
            chorus: 0.15,
            wetDry: 0.9,
            gain: 1.15,
            stereoWidth: 0.8
        },
        ambience: 'thunder'
    },
    {
        id: 'demon',
        label: 'Demon Lord',
        description: 'Terrifying twin pitch drop, intense digital crunch, and deep cavern depth.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: -9,
            speed: 0.85,
            lowCut: 40,
            highCut: 4000,
            distortion: 0.45,
            reverb: 0.55,
            delay: 0.2,
            chorus: 0.35,
            vibrato: 0.15,
            wetDry: 1.0,
            gain: 1.1,
            stereoWidth: 0.7
        },
        ambience: 'cave'
    },
    {
        id: 'cartoon',
        label: 'Cartoon Chipmunk',
        description: 'High-pitched, sped-up playful voice with zero grit.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: 8,
            speed: 1.25,
            lowCut: 150,
            highCut: 14000,
            reverb: 0.15,
            chorus: 0.2,
            vibrato: 0.1,
            wetDry: 0.9,
            gain: 1.0,
            stereoWidth: 0.5
        },
        ambience: 'none'
    },
    {
        id: 'emergency_broadcast',
        label: 'Emergency Alert',
        description: 'High-power, highly saturated broadcast announcer with alert tone overlay.',
        effects: {
            ...DEFAULT_EFFECT_SETTINGS,
            pitch: 1,
            speed: 1.0,
            lowCut: 500,
            highCut: 3500,
            distortion: 0.4,
            delay: 0.15,
            noiseLayer: 0.2,
            wetDry: 1.0,
            gain: 1.2,
            stereoWidth: 0.2
        },
        ambience: 'alarm'
    }
];

export function getPresetById(id: string): VoicePreset {
    return voicePresets.find(p => p.id === id) || voicePresets[0];
}
