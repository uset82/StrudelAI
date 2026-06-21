export type VoiceClipSource = 'recorded' | 'generated' | 'imported';

export type VoiceProvider =
    | 'browser_speech'
    | 'chatterbox'
    | 'openvoice'
    | 'llvc'
    | 'rvc'
    | 'none';

export type VoiceStyle =
    | 'neutral'
    | 'deep_cinematic'
    | 'robotic'
    | 'alien'
    | 'monster'
    | 'lion'
    | 'radio_announcer'
    | 'old_telephone'
    | 'glitch_ai'
    | 'whisper'
    | 'thunder_god'
    | 'demon'
    | 'cartoon'
    | 'emergency_broadcast';

export type AmbienceType =
    | 'none'
    | 'rain'
    | 'thunder'
    | 'wind'
    | 'fire'
    | 'cave'
    | 'forest'
    | 'mechanical_noise'
    | 'electronic_hum'
    | 'relay_clicks'
    | 'capacitor_charge'
    | 'robotic_servo'
    | 'glitch_particles'
    | 'siren'
    | 'alarm'
    | 'space_ambience';

export interface VoiceClip {
    id: string;
    name: string;
    source: VoiceClipSource;
    blob?: Blob;
    url: string;
    duration: number;
    createdAt: number;
    text?: string;
    style?: VoiceStyle;
}

export interface VoiceEffectSettings {
    pitch: number;      // -12 to +12 semitones
    speed: number;      // 0.5x to 2.0x
    formant: number;    // -1.0 to +1.0 (for future expansion)
    lowCut: number;     // Hz
    highCut: number;    // Hz
    distortion: number; // 0.0 to 1.0
    reverb: number;     // 0.0 to 1.0
    delay: number;      // 0.0 to 1.0
    chorus: number;     // 0.0 to 1.0
    tremolo: number;    // 0.0 to 1.0
    vibrato: number;    // 0.0 to 1.0
    bitcrusher: number; // 0.0 to 1.0 (0 means off/16-bit)
    noiseLayer: number; // 0.0 to 1.0
    wetDry: number;     // 0.0 to 1.0
    gain: number;       // 0.0 to 1.5
    stereoWidth: number;// 0.0 to 1.0
}

export interface VoicePreset {
    id: VoiceStyle;
    label: string;
    description: string;
    effects: VoiceEffectSettings;
    ambience?: AmbienceType;
}

export interface VoiceGenerationCommand {
    mode: 'voice_generation' | 'voice_transform' | 'ambience_mix';
    text?: string;
    targetClipId?: string;
    voiceStyle: VoiceStyle;
    effects?: Partial<VoiceEffectSettings>;
    ambience?: AmbienceType[];
    provider: VoiceProvider;
    target: 'voice_workspace' | 'main_workspace';
}

export const DEFAULT_EFFECT_SETTINGS: VoiceEffectSettings = {
    pitch: 0,
    speed: 1,
    formant: 0,
    lowCut: 80,
    highCut: 12000,
    distortion: 0,
    reverb: 0,
    delay: 0,
    chorus: 0,
    tremolo: 0,
    vibrato: 0,
    bitcrusher: 0,
    noiseLayer: 0,
    wetDry: 1,
    gain: 1,
    stereoWidth: 0.5,
};
