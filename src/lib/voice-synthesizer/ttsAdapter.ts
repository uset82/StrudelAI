import { VoiceStyle } from './types';

export interface TTSOptions {
    pitch?: number; // 0 to 2
    rate?: number;  // 0.1 to 10
    voiceName?: string;
    lang?: string;
}

/**
 * Native SpeechSynthesis TTS Adapter
 */
export class BrowserTTSAdapter {
    private synth: SpeechSynthesis | null = null;
    private currentUtterance: SpeechSynthesisUtterance | null = null;

    constructor() {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            this.synth = window.speechSynthesis;
        }
    }

    public isSupported(): boolean {
        return !!this.synth;
    }

    public getVoices(): SpeechSynthesisVoice[] {
        if (!this.synth) return [];
        return this.synth.getVoices();
    }

    /**
     * Synthesize and speak text.
     */
    public speak(
        text: string,
        style: VoiceStyle,
        onStart?: () => void,
        onEnd?: () => void,
        onError?: (err: unknown) => void
    ): void {
        if (!this.synth) {
            onError?.(new Error('SpeechSynthesis not supported in this browser.'));
            return;
        }

        this.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;

        // Map VoiceStyle to Web Speech API parameters
        const options = this.mapStyleToUtteranceOptions(style);
        
        utterance.pitch = options.pitch ?? 1.0;
        utterance.rate = options.rate ?? 1.0;
        utterance.lang = options.lang ?? 'en-US';

        const voices = this.getVoices();
        if (options.voiceName) {
            const voice = voices.find(v => v.name.toLowerCase().includes(options.voiceName!.toLowerCase()));
            if (voice) utterance.voice = voice;
        } else {
            // Default to an English voice if language is en-US
            const defaultVoice = voices.find(v => v.lang.startsWith('en') && v.default) || 
                                 voices.find(v => v.lang.startsWith('en'));
            if (defaultVoice) utterance.voice = defaultVoice;
        }

        utterance.onstart = () => onStart?.();
        utterance.onend = () => {
            this.currentUtterance = null;
            onEnd?.();
        };
        utterance.onerror = (e) => {
            this.currentUtterance = null;
            // Interrupted or canceled error codes are normal results of calling cancel()
            if (e.error === 'interrupted' || e.error === 'canceled') {
                onEnd?.();
                return;
            }
            onError?.(new Error(`Browser SpeechSynthesis error code: ${e.error}`));
        };

        this.synth.speak(utterance);
    }

    public cancel(): void {
        if (this.synth) {
            this.synth.cancel();
            this.currentUtterance = null;
        }
    }

    public pause(): void {
        if (this.synth) {
            this.synth.pause();
        }
    }

    public resume(): void {
        if (this.synth) {
            this.synth.resume();
        }
    }

    private mapStyleToUtteranceOptions(style: VoiceStyle): TTSOptions {
        switch (style) {
            case 'deep_cinematic':
                return { pitch: 0.5, rate: 0.85, voiceName: 'male' };
            case 'robotic':
                return { pitch: 1.0, rate: 0.95, voiceName: 'zira' };
            case 'alien':
                return { pitch: 1.6, rate: 1.1, voiceName: 'google' };
            case 'monster':
                return { pitch: 0.5, rate: 0.75, voiceName: 'male' };
            case 'lion':
                return { pitch: 0.5, rate: 0.8, voiceName: 'male' };
            case 'radio_announcer':
                return { pitch: 1.05, rate: 1.05, voiceName: 'natural' };
            case 'old_telephone':
                return { pitch: 1.2, rate: 0.95, voiceName: 'zira' };
            case 'glitch_ai':
                return { pitch: 1.4, rate: 1.3, voiceName: 'google' };
            case 'whisper':
                return { pitch: 0.8, rate: 0.75 };
            case 'thunder_god':
                return { pitch: 0.6, rate: 0.85, voiceName: 'male' };
            case 'demon':
                return { pitch: 0.5, rate: 0.8, voiceName: 'male' };
            case 'cartoon':
                return { pitch: 1.8, rate: 1.2, voiceName: 'female' };
            case 'emergency_broadcast':
                return { pitch: 1.0, rate: 1.1, voiceName: 'male' };
            case 'neutral':
            default:
                return { pitch: 1.0, rate: 1.0 };
        }
    }
}

export const ttsAdapter = new BrowserTTSAdapter();
