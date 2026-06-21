import { VoiceEffectSettings } from './types';

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV Blob.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    let result;
    if (numOfChan === 2) {
        result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        result = buffer.getChannelData(0);
    }
    
    const bufferLength = result.length * 2;
    const bufferArray = new ArrayBuffer(44 + bufferLength);
    const view = new DataView(bufferArray);
    
    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + bufferLength, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, format, true);
    /* channel count */
    view.setUint16(22, numOfChan, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, numOfChan * (bitDepth / 8), true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, bufferLength, true);
    
    // Write audio samples
    floatTo16BitPCM(view, 44, result);
    
    return new Blob([bufferArray], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    
    let index = 0;
    let inputIndex = 0;
    
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Renders the AudioBuffer offline with Tone.js effects applied.
 */
export async function renderProcessedAudio(
    audioUrl: string,
    settings: VoiceEffectSettings
): Promise<Blob> {
    const Tone = await import('tone');
    
    // Load buffer to know duration
    const tempBuffer = new Tone.ToneAudioBuffer();
    await tempBuffer.load(audioUrl);
    
    const duration = tempBuffer.duration * (1 / settings.speed);
    
    // Render offline
    const renderedBuffer = await Tone.Offline(async () => {
        // Reconstruct the exact chain inside the offline context
        const player = new Tone.Player(tempBuffer);
        const pitchShift = new Tone.PitchShift({ pitch: settings.pitch });
        const highpassFilter = new Tone.Filter({ frequency: settings.lowCut, type: 'highpass' });
        const lowpassFilter = new Tone.Filter({ frequency: settings.highCut, type: 'lowpass' });
        const distortion = new Tone.Distortion({ distortion: 0.4 + settings.distortion * 0.6, wet: settings.distortion });
        const bitcrusher = new Tone.BitCrusher({ 
            bits: Math.max(3, Math.round(16 - settings.bitcrusher * 13))
        });
        bitcrusher.wet.value = settings.bitcrusher;
        const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: settings.chorus }).start();
        const tremolo = new Tone.Tremolo({ frequency: 5, depth: 0.75, wet: settings.tremolo }).start();
        const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: settings.delay });
        const reverb = new Tone.Reverb({ decay: 1.5, wet: settings.reverb });
        const outputVolume = new Tone.Volume({ volume: Tone.gainToDb(settings.gain * settings.wetDry) });
        
        // Connect
        player.connect(pitchShift);
        pitchShift.connect(highpassFilter);
        highpassFilter.connect(lowpassFilter);
        lowpassFilter.connect(distortion);
        distortion.connect(bitcrusher);
        bitcrusher.connect(chorus);
        chorus.connect(tremolo);
        tremolo.connect(delay);
        delay.connect(reverb);
        reverb.connect(outputVolume);
        outputVolume.toDestination();
        
        player.start(0);
    }, duration);
    
    return audioBufferToWav(renderedBuffer.get() as AudioBuffer);
}

/**
 * Triggers a browser file download.
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
