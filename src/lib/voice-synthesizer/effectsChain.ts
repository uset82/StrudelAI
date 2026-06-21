/* eslint-disable @typescript-eslint/no-explicit-any */
import { VoiceEffectSettings } from './types';

/**
 * Manages the Tone.js audio effects chain client-side.
 */
export class EffectsChainManager {
    private Tone: typeof import('tone') | null = null;
    private player: any = null;
    private pitchShift: any = null;
    private lowpassFilter: any = null;
    private highpassFilter: any = null;
    private distortion: any = null;
    private delay: any = null;
    private reverb: any = null;
    private chorus: any = null;
    private tremolo: any = null;
    private bitcrusher: any = null;
    private limiter: any = null;
    private outputVolume: any = null;
    private isPlaying = false;

    constructor() {
        // Dynamic load Tone.js client-side only
        if (typeof window !== 'undefined') {
            import('tone').then((T) => {
                this.Tone = T;
                this.initChain();
            });
        }
    }

    private initChain() {
        if (!this.Tone) return;

        const T = this.Tone;

        // Create player
        this.player = new T.Player();

        // Create effects nodes
        this.pitchShift = new T.PitchShift({ pitch: 0 });
        this.highpassFilter = new T.Filter({ frequency: 80, type: 'highpass' });
        this.lowpassFilter = new T.Filter({ frequency: 12000, type: 'lowpass' });
        this.distortion = new T.Distortion({ distortion: 0.4, wet: 0 });
        this.bitcrusher = new T.BitCrusher({ bits: 8 });
        this.bitcrusher.wet.value = 0;
        this.chorus = new T.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7 }).start();
        this.chorus.wet.value = 0;
        this.tremolo = new T.Tremolo({ frequency: 5, depth: 0.75 }).start();
        this.tremolo.wet.value = 0;
        
        // Delay (1/8th note delay fallback)
        this.delay = new T.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 0 });
        
        // Reverb
        this.reverb = new T.Reverb({ decay: 1.8 });
        this.reverb.wet.value = 0;
        
        // Safe output nodes
        this.limiter = new T.Limiter({ threshold: -1 });
        this.outputVolume = new T.Volume({ volume: 0 });

        // Connect the chain:
        // Player -> PitchShift -> HP Filter -> LP Filter -> Distortion -> Bitcrusher -> Chorus -> Tremolo -> Delay -> Reverb -> Limiter -> OutputVolume -> Destination
        this.player.connect(this.pitchShift);
        this.pitchShift.connect(this.highpassFilter);
        this.highpassFilter.connect(this.lowpassFilter);
        this.lowpassFilter.connect(this.distortion);
        this.distortion.connect(this.bitcrusher);
        this.bitcrusher.connect(this.chorus);
        this.chorus.connect(this.tremolo);
        this.tremolo.connect(this.delay);
        this.delay.connect(this.reverb);
        this.reverb.connect(this.limiter);
        this.limiter.connect(this.outputVolume);
        this.outputVolume.toDestination();
    }

    /**
     * Loads an audio file or recorded Blob into the Tone.js Player.
     */
    public async loadClip(url: string): Promise<void> {
        if (!this.player) {
            // Re-try initialization if Tone is not ready
            if (this.Tone) {
                this.initChain();
            } else {
                throw new Error('Tone.js is not loaded yet');
            }
        }
        await this.player.load(url);
    }

    /**
     * Plays the loaded clip with the specified effects applied.
     */
    public play(settings: VoiceEffectSettings, onEnd?: () => void): void {
        if (!this.player || !this.player.buffer.loaded) return;

        this.stop();
        this.applySettings(settings);

        if (this.Tone) {
            this.Tone.start();
        }

        this.player.onstop = () => {
            this.isPlaying = false;
            onEnd?.();
        };

        this.isPlaying = true;
        this.player.start();
    }

    /**
     * Stops playback of the current clip.
     */
    public stop(): void {
        if (this.player) {
            this.player.stop();
        }
        this.isPlaying = false;
    }

    /**
     * Updates settings in real-time.
     */
    public applySettings(settings: VoiceEffectSettings): void {
        if (!this.player || !this.Tone) return;

        const T = this.Tone;

        // Apply pitch (-12 to +12)
        if (this.pitchShift) {
            this.pitchShift.pitch = settings.pitch;
        }

        // Apply speed/playbackRate (0.5 to 2.0)
        if (this.player) {
            this.player.playbackRate = settings.speed;
        }

        // Apply EQ
        if (this.highpassFilter) {
            this.highpassFilter.frequency.value = settings.lowCut;
        }
        if (this.lowpassFilter) {
            this.lowpassFilter.frequency.value = settings.highCut;
        }

        // Apply Distortion (wet mix 0 to 1)
        if (this.distortion) {
            this.distortion.wet.value = settings.distortion;
            this.distortion.distortion = 0.4 + settings.distortion * 0.6; // Scale distortion depth
        }

        // Apply Bitcrusher (bits from 16 down to 2, wet mix 0 to 1)
        if (this.bitcrusher) {
            this.bitcrusher.wet.value = settings.bitcrusher;
            // 0 crushing means 16 bits, 1.0 crushing means 3 bits
            const bits = Math.max(3, Math.round(16 - settings.bitcrusher * 13));
            this.bitcrusher.bits.value = bits;
        }

        // Apply Chorus
        if (this.chorus) {
            this.chorus.wet.value = settings.chorus;
        }

        // Apply Tremolo
        if (this.tremolo) {
            this.tremolo.wet.value = settings.tremolo;
        }

        // Apply Delay
        if (this.delay) {
            this.delay.wet.value = settings.delay;
        }

        // Apply Reverb
        if (this.reverb) {
            this.reverb.wet.value = settings.reverb;
        }

        // Apply gain (dB conversion)
        if (this.outputVolume) {
            // gain: 0 to 1.5. Convert to decibels safely.
            const db = T.gainToDb(settings.gain * settings.wetDry);
            this.outputVolume.volume.value = isFinite(db) ? db : -Infinity;
        }
    }

    /**
     * Cleans up and disposes all Tone.js audio nodes.
     */
    public dispose(): void {
        this.stop();
        
        const nodes = [
            this.player,
            this.pitchShift,
            this.highpassFilter,
            this.lowpassFilter,
            this.distortion,
            this.bitcrusher,
            this.chorus,
            this.tremolo,
            this.delay,
            this.reverb,
            this.limiter,
            this.outputVolume
        ];

        for (const node of nodes) {
            if (node) {
                try {
                    node.dispose();
                } catch (e) {
                    console.warn('[ToneManager] Node dispose error:', e);
                }
            }
        }

        this.player = null;
        this.pitchShift = null;
        this.highpassFilter = null;
        this.lowpassFilter = null;
        this.distortion = null;
        this.bitcrusher = null;
        this.chorus = null;
        this.tremolo = null;
        this.delay = null;
        this.reverb = null;
        this.limiter = null;
        this.outputVolume = null;
    }
}

// Global instance helper, or can instantiate per components
export const voiceEffectsManager = new EffectsChainManager();
