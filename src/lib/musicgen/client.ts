/**
 * MusicGen Client - AI Music Generation Integration
 * 
 * Connects to the MusicGen Python server to generate AI music
 * from text prompts.
 */

const MUSICGEN_SERVER_URL = process.env.NEXT_PUBLIC_MUSICGEN_URL || 'http://localhost:5001';

export interface MusicGenRequest {
    prompt: string;
    duration?: number; // seconds (default: 8, max: 30)
}

export interface MusicGenStemRequest {
    type: 'drums' | 'bass' | 'melody' | 'voice' | 'fx';
    style?: string;
    mood?: string;
    key?: string;
    bpm?: number;
    duration?: number;
}

export interface MusicGenResponse {
    success: boolean;
    prompt: string;
    duration: number;
    sampling_rate: number;
    audio_base64: string;
    generation_time: number;
}

export interface MusicGenHealth {
    status: string;
    device: string;
    model_loaded: boolean;
}

/**
 * Check if MusicGen server is available
 */
export async function checkMusicGenHealth(): Promise<MusicGenHealth | null> {
    try {
        const response = await fetch(`${MUSICGEN_SERVER_URL}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.warn('[MusicGen] Server not available:', error);
        return null;
    }
}

/**
 * Generate music from a text prompt
 */
export async function generateMusic(request: MusicGenRequest): Promise<MusicGenResponse> {
    const response = await fetch(`${MUSICGEN_SERVER_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: request.prompt,
            duration: request.duration || 8,
            format: 'base64'
        }),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate music');
    }
    
    return await response.json();
}

/**
 * Generate a specific instrument stem
 */
export async function generateStem(request: MusicGenStemRequest): Promise<MusicGenResponse> {
    const response = await fetch(`${MUSICGEN_SERVER_URL}/generate_stem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: request.type,
            style: request.style || 'electronic',
            mood: request.mood || 'energetic',
            key: request.key || 'C minor',
            bpm: request.bpm || 128,
            duration: request.duration || 8,
        }),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate stem');
    }
    
    return await response.json();
}

/**
 * Convert base64 audio to AudioBuffer
 */
export async function base64ToAudioBuffer(
    base64Audio: string,
    audioContext: AudioContext
): Promise<AudioBuffer> {
    // Decode base64 to binary
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Decode audio data
    return await audioContext.decodeAudioData(bytes.buffer);
}

/**
 * Play generated audio
 */
export async function playGeneratedAudio(
    base64Audio: string,
    audioContext?: AudioContext
): Promise<AudioBufferSourceNode> {
    const ctx = audioContext || new AudioContext();
    const audioBuffer = await base64ToAudioBuffer(base64Audio, ctx);
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
    
    return source;
}

/**
 * Download generated audio as WAV file
 */
export function downloadGeneratedAudio(base64Audio: string, filename: string = 'musicgen_output.wav') {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Build a prompt from session context
 */
export function buildMusicPrompt(options: {
    style?: string;
    mood?: string;
    key?: string;
    bpm?: number;
    instruments?: string[];
    userRequest?: string;
}): string {
    const parts: string[] = [];
    
    if (options.mood) parts.push(options.mood);
    if (options.style) parts.push(options.style);
    if (options.instruments?.length) {
        parts.push(`with ${options.instruments.join(', ')}`);
    }
    if (options.key) parts.push(`in ${options.key}`);
    if (options.bpm) parts.push(`${options.bpm} bpm`);
    if (options.userRequest) parts.push(options.userRequest);
    
    return parts.join(', ') || 'electronic music';
}
