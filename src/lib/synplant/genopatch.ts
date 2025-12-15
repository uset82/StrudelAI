import { InstrumentType } from '@/types/sonic';
import { TrackGenome, randomGenome } from './genome';

export interface AudioFeatures {
    rms: number;
    centroid: number;
    zcr: number;
    duration: number;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Very lightweight spectral analysis for short samples (no deps)
export function extractAudioFeatures(buffer: AudioBuffer): AudioFeatures {
    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // RMS
    let sumSq = 0;
    for (let i = 0; i < channel.length; i++) {
        const x = channel[i];
        sumSq += x * x;
    }
    const rms = Math.sqrt(sumSq / channel.length);

    // Zero crossing rate
    let crossings = 0;
    for (let i = 1; i < channel.length; i++) {
        if ((channel[i - 1] >= 0 && channel[i] < 0) || (channel[i - 1] < 0 && channel[i] >= 0)) {
            crossings++;
        }
    }
    const zcr = crossings / channel.length;

    // Spectral centroid via small DFT window
    const N = 1024;
    const start = Math.max(0, Math.floor(channel.length / 2 - N / 2));
    const windowed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); // Hann
        windowed[i] = (channel[start + i] || 0) * w;
    }

    let magSum = 0;
    let weightedSum = 0;
    for (let k = 0; k < N / 2; k++) {
        let re = 0;
        let im = 0;
        for (let n = 0; n < N; n++) {
            const phase = (2 * Math.PI * k * n) / N;
            re += windowed[n] * Math.cos(phase);
            im -= windowed[n] * Math.sin(phase);
        }
        const mag = Math.sqrt(re * re + im * im);
        const freq = (k * sampleRate) / N;
        magSum += mag;
        weightedSum += freq * mag;
    }

    const centroid = magSum > 0 ? weightedSum / magSum : 0;

    return {
        rms,
        centroid,
        zcr,
        duration: buffer.duration,
    };
}

export function genomeFromAudio(trackId: InstrumentType, buffer: AudioBuffer): TrackGenome {
    const base = randomGenome(trackId, 'gentle');
    const feats = extractAudioFeatures(buffer);

    const brightness = clamp(feats.centroid / 8000, 0, 1);
    const noisiness = clamp(feats.zcr * 12, 0, 1);
    const loudness = clamp(feats.rms * 3, 0, 1);

    // Map features into genes
    const density =
        trackId === 'drums'
            ? brightness > 0.6 ? 16 : brightness > 0.35 ? 8 : 4
            : brightness > 0.6 ? 8 : brightness > 0.35 ? 4 : 2;

    const synth =
        noisiness > 0.6 && (trackId === 'drums' || trackId === 'fx')
            ? 'pink'
            : brightness < 0.25 && (trackId === 'bass' || trackId === 'voice')
                ? 'triangle'
                : base.synth;

    return {
        ...base,
        trackId,
        synth,
        density,
        spice: clamp(0.2 + noisiness * 0.6 + brightness * 0.4, 0, 1),
        gain: clamp(0.35 + loudness * 0.9, 0.2, 1.6),
        lpf: clamp(1 - brightness + noisiness * 0.2, 0, 1),
        room: clamp(0.2 + (1 - loudness) * 0.6 + (1 - brightness) * 0.2, 0, 1),
        delay: clamp(brightness * 0.6 + noisiness * 0.2, 0, 0.9),
        slow: clamp(0.7 + (1 - brightness) * 4, 0.5, 8),
    };
}

