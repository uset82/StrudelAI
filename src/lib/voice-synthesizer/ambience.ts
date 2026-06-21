/* eslint-disable @typescript-eslint/no-explicit-any */
import { AmbienceType } from './types';

/**
 * Procedural ambience generators using Tone.js.
 */
export class AmbienceManager {
    private Tone: typeof import('tone') | null = null;
    private activeAmbience: AmbienceType = 'none';
    private sourceNode: any = null;
    private filterNode: any = null;
    private lfoNode: any = null;
    private gainNode: any = null;
    private secondaryNode: any = null;
    private intervalId: any = null;

    constructor() {
        if (typeof window !== 'undefined') {
            import('tone').then((T) => {
                this.Tone = T;
            });
        }
    }

    /**
     * Start playing a specific ambience.
     */
    public start(type: AmbienceType, volume: number = 0.15): void {
        if (!this.Tone) return;
        this.stop();

        this.activeAmbience = type;
        if (type === 'none') return;

        const T = this.Tone;

        // Base output gain
        this.gainNode = new T.Gain({ gain: volume }).toDestination();

        try {
            switch (type) {
                case 'rain':
                    // Rain: Lowpass filtered pink noise
                    this.sourceNode = new T.Noise('pink');
                    this.filterNode = new T.Filter({ frequency: 1200, type: 'lowpass' });
                    this.sourceNode.connect(this.filterNode);
                    this.filterNode.connect(this.gainNode);
                    this.sourceNode.start();
                    break;

                case 'wind':
                    // Wind: Bandpass filtered pink noise modulated by slow LFO
                    this.sourceNode = new T.Noise('pink');
                    this.filterNode = new T.Filter({ frequency: 600, Q: 3, type: 'bandpass' });
                    this.lfoNode = new T.LFO({ frequency: 0.15, min: 250, max: 900 }).start();
                    
                    this.lfoNode.connect(this.filterNode.frequency);
                    this.sourceNode.connect(this.filterNode);
                    this.filterNode.connect(this.gainNode);
                    this.sourceNode.start();
                    break;

                case 'electronic_hum':
                    // 60Hz hum + harmonics
                    this.sourceNode = new T.Oscillator({ frequency: 60, type: 'sine' });
                    this.secondaryNode = new T.Oscillator({ frequency: 120, type: 'triangle' });
                    this.filterNode = new T.Filter({ frequency: 150, type: 'lowpass' });

                    const secondaryGain = new T.Gain({ gain: 0.2 });
                    this.secondaryNode.connect(secondaryGain);

                    this.sourceNode.connect(this.filterNode);
                    secondaryGain.connect(this.filterNode);
                    this.filterNode.connect(this.gainNode);

                    this.sourceNode.start();
                    this.secondaryNode.start();
                    break;

                case 'relay_clicks':
                    // Clicks at random intervals
                    this.intervalId = setInterval(() => {
                        if (!this.Tone || !this.gainNode) return;
                        const clickOsc = new this.Tone.Oscillator({ frequency: 1200, type: 'sine' });
                        const clickGain = new this.Tone.Gain({ gain: 0.8 });
                        clickOsc.connect(clickGain);
                        clickGain.connect(this.gainNode);

                        clickOsc.start();
                        // Extremely short spike
                        clickGain.gain.setValueAtTime(0.8, this.Tone.now());
                        clickGain.gain.exponentialRampToValueAtTime(0.001, this.Tone.now() + 0.012);

                        clickOsc.stop(this.Tone.now() + 0.02);
                        setTimeout(() => {
                            clickOsc.dispose();
                            clickGain.dispose();
                        }, 50);
                    }, 800);
                    break;

                case 'robotic_servo':
                    // Periodic servo motor sweeps
                    this.intervalId = setInterval(() => {
                        if (!this.Tone || !this.gainNode) return;
                        const sweepNoise = new this.Tone.Noise('white');
                        const sweepFilter = new this.Tone.Filter({ frequency: 800, Q: 5, type: 'bandpass' });
                        const sweepGain = new this.Tone.Gain({ gain: 0 });
                        
                        sweepNoise.connect(sweepFilter);
                        sweepFilter.connect(sweepGain);
                        sweepGain.connect(this.gainNode);

                        sweepNoise.start();
                        
                        const now = this.Tone.now();
                        sweepFilter.frequency.setValueAtTime(200, now);
                        sweepFilter.frequency.exponentialRampToValueAtTime(2500, now + 0.35);
                        sweepFilter.frequency.exponentialRampToValueAtTime(200, now + 0.7);

                        sweepGain.gain.setValueAtTime(0, now);
                        sweepGain.gain.linearRampToValueAtTime(0.25, now + 0.1);
                        sweepGain.gain.linearRampToValueAtTime(0.25, now + 0.5);
                        sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

                        sweepNoise.stop(now + 0.75);
                        setTimeout(() => {
                            sweepNoise.dispose();
                            sweepFilter.dispose();
                            sweepGain.dispose();
                        }, 900);
                    }, 2400);
                    break;

                case 'glitch_particles':
                    // Random tiny digital pops
                    this.intervalId = setInterval(() => {
                        if (!this.Tone || !this.gainNode) return;
                        const freq = 1000 + Math.random() * 4000;
                        const popOsc = new this.Tone.Oscillator({ frequency: freq, type: 'square' });
                        const popGain = new this.Tone.Gain({ gain: 0.15 });

                        popOsc.connect(popGain);
                        popGain.connect(this.gainNode);

                        popOsc.start();
                        popGain.gain.setValueAtTime(0.15, this.Tone.now());
                        popGain.gain.exponentialRampToValueAtTime(0.001, this.Tone.now() + 0.008);

                        popOsc.stop(this.Tone.now() + 0.015);
                        setTimeout(() => {
                            popOsc.dispose();
                            popGain.dispose();
                        }, 50);
                    }, 350);
                    break;

                case 'space_ambience':
                    // Slow sweeping resonant pad drone
                    this.sourceNode = new T.Oscillator({ frequency: 82.41, type: 'sawtooth' }); // E2 root
                    this.secondaryNode = new T.Oscillator({ frequency: 83.1, type: 'sawtooth' }); // detuned
                    this.filterNode = new T.Filter({ frequency: 200, Q: 4, type: 'lowpass' });
                    this.lfoNode = new T.LFO({ frequency: 0.05, min: 120, max: 800 }).start();

                    const verb = new T.Reverb({ decay: 2.5, wet: 0.6 });
                    const spaceGain = new T.Gain({ gain: 0.55 });

                    this.sourceNode.connect(spaceGain);
                    this.secondaryNode.connect(spaceGain);
                    spaceGain.connect(this.filterNode);
                    this.lfoNode.connect(this.filterNode.frequency);

                    this.filterNode.connect(verb);
                    verb.connect(this.gainNode);

                    this.sourceNode.start();
                    this.secondaryNode.start();
                    break;

                case 'alarm':
                    // Two alternating alarm frequencies (beep... beep...)
                    this.sourceNode = new T.Oscillator({ frequency: 950, type: 'sawtooth' });
                    this.filterNode = new T.Filter({ frequency: 1500, type: 'lowpass' });
                    
                    this.sourceNode.connect(this.filterNode);
                    this.filterNode.connect(this.gainNode);

                    this.sourceNode.start();
                    
                    let toggle = false;
                    this.intervalId = setInterval(() => {
                        if (!this.sourceNode) return;
                        toggle = !toggle;
                        this.sourceNode.frequency.value = toggle ? 950 : 850;
                        if (this.gainNode) {
                            this.gainNode.gain.setValueAtTime(toggle ? volume : 0, T.now());
                        }
                    }, 400);
                    break;

                case 'siren':
                    // Pitch sweeping siren
                    this.sourceNode = new T.Oscillator({ frequency: 440, type: 'sawtooth' });
                    this.lfoNode = new T.LFO({ frequency: 0.35, min: 400, max: 900 }).start();
                    
                    this.lfoNode.connect(this.sourceNode.frequency);
                    this.sourceNode.connect(this.gainNode);
                    this.sourceNode.start();
                    break;

                case 'cave':
                    // Low rumble + echo delay
                    this.sourceNode = new T.Noise('pink');
                    this.filterNode = new T.Filter({ frequency: 180, type: 'lowpass' });
                    
                    const echo = new T.FeedbackDelay({ delayTime: 0.5, feedback: 0.6, wet: 0.4 });
                    const caveVerb = new T.Reverb({ decay: 3.5, wet: 0.55 });

                    this.sourceNode.connect(this.filterNode);
                    this.filterNode.connect(echo);
                    echo.connect(caveVerb);
                    caveVerb.connect(this.gainNode);

                    this.sourceNode.start();
                    break;

                case 'thunder':
                case 'fire':
                case 'forest':
                    // Atmospheric pink noise rumble/crackle helper
                    this.sourceNode = new T.Noise('pink');
                    this.filterNode = new T.Filter({ 
                        frequency: type === 'thunder' ? 80 : type === 'fire' ? 800 : 1500, 
                        type: 'lowpass' 
                    });
                    this.sourceNode.connect(this.filterNode);
                    this.filterNode.connect(this.gainNode);
                    this.sourceNode.start();

                    // Randomized crackle/rumble envelopes
                    this.intervalId = setInterval(() => {
                        if (!this.Tone || !this.gainNode) return;
                        const randVol = Math.random() * volume;
                        this.gainNode.gain.exponentialRampToValueAtTime(randVol, T.now() + 0.1);
                    }, type === 'thunder' ? 1200 : type === 'fire' ? 80 : 300);
                    break;

                default:
                    break;
            }
        } catch (e) {
            console.error('[AmbienceManager] Failed to start voice ambience:', e);
        }
    }

    /**
     * Set the current ambience volume.
     */
    public setVolume(volume: number): void {
        if (this.gainNode) {
            this.gainNode.gain.value = volume;
        }
    }

    /**
     * Stop the active ambience and dispose nodes.
     */
    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        const nodes = [
            this.sourceNode,
            this.filterNode,
            this.lfoNode,
            this.secondaryNode,
            this.gainNode
        ];

        for (const node of nodes) {
            if (node) {
                try {
                    node.dispose();
                } catch {
                    // Ignore
                }
            }
        }

        this.sourceNode = null;
        this.filterNode = null;
        this.lfoNode = null;
        this.secondaryNode = null;
        this.gainNode = null;
        this.activeAmbience = 'none';
    }

    public getActiveAmbience(): AmbienceType {
        return this.activeAmbience;
    }
}

export const voiceAmbienceManager = new AmbienceManager();
