import { initAudio as initStrudelAudio, webaudioRepl } from '@strudel/webaudio';
import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import * as superdough from 'superdough';
import { registerSynthSounds, soundAlias, getAnalyserById } from 'superdough';
import { workletUrl as supradoughWorkletUrl } from 'supradough';
import { InstrumentType, SonicSessionState, ArrangementState, Lane, Clip, LaneGroup } from '@/types/sonic';

interface StrudelWindow extends Window {
    __strudelEvaluate__?: (code: string) => Promise<unknown>;
    __strudelScheduler__?: { start: () => void, stop: () => void, started: boolean };
    getAnalyserById?: (id: number, fftSize: number, smoothing: number) => AnalyserNode | null;
    superdough?: {
        getAnalyserById?: (id: number, fftSize: number, smoothing: number) => AnalyserNode | null;
    };
    m?: unknown;
    scheduler?: { start: () => void, stop: () => void, started: boolean };
    __strudel__?: {
        scheduler?: { start: () => void, stop: () => void, started: boolean };
    }
}

const EXPR_PREFIX = 'expr:';
const DEFAULT_BEATS_PER_CYCLE = 4;

// const TRACK_DEFAULTS: Record<InstrumentType, string> = {
//     drums: 'expr:note(m("c3 ~ c3 ~")).s("square").decay(0.05).fast(2).gain(0.8)',
//     bass: 'expr:note(m("c2 g1 c2 g1")).s("triangle").sustain(0.2).gain(0.7)',
//     melody: 'expr:note(m("c4 e4 g4 b4")).s("sawtooth").slow(2).gain(0.6)',
//     fx: 'expr:note(m("<c5 g5> ~")).s("sine").slow(4).gain(0.4)',
//     voice: 'expr:note(m("c4 ~")).s("sine").vowel("a").slow(4).gain(0.5)',
// };

// ═══════════════════════════════════════════════════════════════════════════
// MUSICGEN SAMPLE CACHE - Store and reuse AI-generated samples
// ═══════════════════════════════════════════════════════════════════════════

export interface MusicGenSample {
    id: string;
    name: string;
    prompt: string;
    audioBuffer: AudioBuffer | null;
    base64: string;
    duration: number;
    createdAt: number;
}

// In-memory cache of generated samples
const musicGenCache = new Map<string, MusicGenSample>();

// Audio context for playing samples
let sampleAudioContext: AudioContext | null = null;

/**
 * Get or create the audio context for samples
 */
export async function getSampleAudioContext(): Promise<AudioContext> {
    if (sampleAudioContext && sampleAudioContext.state !== 'closed') {
        if (sampleAudioContext.state === 'suspended') {
            await sampleAudioContext.resume();
        }
        return sampleAudioContext;
    }

    // Try to use Strudel's audio context
    try {
        const { getAudioContext } = await import('@strudel/webaudio');
        const ctx = getAudioContext();
        if (ctx) {
            sampleAudioContext = ctx;
            return ctx;  // Return ctx directly since we just verified it's not null
        }
        throw new Error('Strudel AudioContext not available');
    } catch {
        sampleAudioContext = new AudioContext();
        return sampleAudioContext;
    }
}

/**
 * Add a MusicGen sample to the cache
 */
export async function addMusicGenSample(
    name: string,
    prompt: string,
    base64Audio: string,
    duration: number
): Promise<MusicGenSample> {
    const ctx = await getSampleAudioContext();

    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode audio data
    let audioBuffer: AudioBuffer | null = null;
    try {
        audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
    } catch (err) {
        console.error('[MusicGen] Failed to decode audio:', err);
    }

    const sample: MusicGenSample = {
        id: `musicgen_${Date.now()}`,
        name: name.toLowerCase().replace(/\s+/g, '_'),
        prompt,
        audioBuffer,
        base64: base64Audio,
        duration,
        createdAt: Date.now(),
    };

    musicGenCache.set(sample.name, sample);
    console.log(`[MusicGen] Cached sample: ${sample.name} (${duration}s)`);

    return sample;
}

/**
 * Get a cached MusicGen sample
 */
export function getMusicGenSample(name: string): MusicGenSample | undefined {
    return musicGenCache.get(name.toLowerCase().replace(/\s+/g, '_'));
}

/**
 * Get all cached MusicGen samples
 */
export function getAllMusicGenSamples(): MusicGenSample[] {
    return Array.from(musicGenCache.values());
}

/**
 * Play a MusicGen sample
 */
export async function playMusicGenSample(
    name: string,
    options: { loop?: boolean; gain?: number } = {}
): Promise<AudioBufferSourceNode | null> {
    const sample = getMusicGenSample(name);
    if (!sample || !sample.audioBuffer) {
        console.warn(`[MusicGen] Sample not found: ${name}`);
        return null;
    }

    const ctx = await getSampleAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = sample.audioBuffer;
    source.loop = options.loop ?? false;

    // Create gain node for volume control
    const gainNode = ctx.createGain();
    gainNode.gain.value = options.gain ?? 1;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();

    console.log(`[MusicGen] Playing sample: ${name}`);
    return source;
}

/**
 * Stop all MusicGen samples
 */
let activeSources: AudioBufferSourceNode[] = [];

export function stopAllMusicGenSamples(): void {
    for (const source of activeSources) {
        try {
            source.stop();
        } catch { /* already stopped */ }
    }
    activeSources = [];
}

/**
 * Clear the MusicGen sample cache
 */
export function clearMusicGenCache(): void {
    musicGenCache.clear();
    console.log('[MusicGen] Cache cleared');
}

let isInitialized = false;
let analyser: AnalyserNode | null = null;
let synthsRegistered = false;
let drumSamplesLoaded = false;
let pianoSamplesLoaded = false;
let tempoLockBpm: number | null = null;
let tempoLockTimer: number | null = null;

function escapePattern(pattern: string) {
    return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function bpmToCps(bpm: number, beatsPerCycle = DEFAULT_BEATS_PER_CYCLE) {
    return bpm / 60 / beatsPerCycle;
}

function getScheduler() {
    if (typeof window === 'undefined') return null;
    // @ts-expect-error - Strudel scheduler is attached to window at runtime
    return window.scheduler || window.__strudelScheduler__ || (window.__strudel__ && window.__strudel__.scheduler) || null;
}

export function setTempoBpm(bpm: number) {
    const scheduler = getScheduler();
    if (!scheduler || typeof scheduler.setCps !== 'function') return;

    const clampedBpm = clampNumber(bpm, 40, 240);
    const cps = bpmToCps(clampedBpm);

    try {
        const current = typeof scheduler.cps === 'number' ? scheduler.cps : null;
        if (current !== null && Math.abs(current - cps) < 0.00001) return;
        scheduler.setCps(cps);
    } catch (err) {
        console.warn('[tempo] Failed to set CPS:', err);
    }
}

export function lockTempoBpm(bpm: number) {
    tempoLockBpm = bpm;
    setTempoBpm(bpm);

    if (typeof window === 'undefined') return;
    if (tempoLockTimer !== null) return;

    tempoLockTimer = window.setInterval(() => {
        if (tempoLockBpm == null) return;
        setTempoBpm(tempoLockBpm);
    }, 1000);
}

export function unlockTempoBpm() {
    tempoLockBpm = null;
    if (typeof window === 'undefined') return;
    if (tempoLockTimer !== null) {
        window.clearInterval(tempoLockTimer);
        tempoLockTimer = null;
    }
}

function formatTrack(track: SonicSessionState['tracks'][keyof SonicSessionState['tracks']]): string {
    if (!track) return '';
    if (track.muted) return '';
    const raw = (track.pattern ?? '').trim();

    // If no pattern, return empty (will be filtered out)
    if (!raw) return '';
    const applyMix = (expr: string) => {
        let out = expr;
        const vol = typeof track.volume === 'number' ? track.volume : 1;
        if (!Number.isNaN(vol) && vol !== 1) {
            out = `(${out}).gain(${vol.toFixed(3)})`;
        }

        // Apply FX if present
        if (track.fx) {
            if (track.fx.lpf && track.fx.lpf > 0) {
                // Map 0-1 to 20000Hz-200Hz (inverted for intuitive feel? No, usually 0=open, 1=closed? 
                // Let's do standard: 0 = no filter (open), 1 = max filtering (low cutoff)
                // Actually, standard UI is usually Cutoff Frequency. 
                // Let's map 0-1 slider to 200Hz - 20000Hz. 
                // But wait, "Filter Amount" usually implies applying the filter.
                // Let's assume the slider is "Cutoff": 1.0 = Open (20kHz), 0.0 = Closed (200Hz)
                // Default should be 1.0 (Open).
                // If the slider is "Low Pass Amount", then 0 = Open, 1 = Closed.
                // Let's go with "Low Pass Amount" (0 = no effect, 1 = heavy muffling)
                // So cutoff = 20000 - (val * 19800)
                const cutoff = 20000 - (track.fx.lpf * 19500);
                out = `(${out}).lpf(${cutoff.toFixed(0)})`;
            }
            if (track.fx.reverb && track.fx.reverb > 0) {
                out = `(${out}).room(${track.fx.reverb.toFixed(2)})`;
            }
            if (track.fx.delay && track.fx.delay > 0) {
                out = `(${out}).delay(${track.fx.delay.toFixed(2)})`;
            }

            // Speed control: affects pattern tempo
            // Map 0-1 to 0.5x-2x (center 0.5 = normal speed)
            if (track.fx.speed !== undefined && track.fx.speed !== 0.5) {
                // speed slider: 0 = 0.5x, 0.5 = 1x, 1 = 2x
                const speedMultiplier = Math.pow(2, (track.fx.speed - 0.5) * 2);
                out = `(${out}).fast(${speedMultiplier.toFixed(3)})`;
            }

            // Pitch control: transpose notes up/down
            // Map 0-1 to -12..+12 semitones (center 0.5 = no transpose)
            if (track.fx.pitch !== undefined && track.fx.pitch !== 0.5) {
                // pitch slider: 0 = -12 semitones, 0.5 = 0, 1 = +12 semitones
                const semitones = Math.round((track.fx.pitch - 0.5) * 24);
                if (semitones !== 0) {
                    // Use .add(note(n)) to transpose - works with both samples and synths
                    out = `(${out}).add(note(${semitones}))`;
                }
            }
        }
        console.log(`[engine] formatTrack ${track.name}: ${out}`);
        return out;
    };

    if (raw.startsWith(EXPR_PREFIX)) {
        let expr = raw.slice(EXPR_PREFIX.length).trim();
        // If the expression is empty, return empty (will be filtered out)
        if (!expr) return '';

        // Fallback: Replace common sample calls with synthetic equivalents to ensure sound 
        // if samples fail to load (common in some network environments).
        // We use a more robust regex to handle whitespace and quotes.
        if (!drumSamplesLoaded) {
            expr = expr
                .replace(/\bs\s*\(\s*['"]bd['"]\s*\)/g, 's("triangle").lpf(200).decay(0.1).gain(1.5)')
                .replace(/\bs\s*\(\s*['"]sn['"]\s*\)/g, 's("square").hpf(500).decay(0.05).gain(0.8)')
                .replace(/\bs\s*\(\s*['"]hh['"]\s*\)/g, 's("pink").hpf(5000).decay(0.02).gain(0.6)');
        }

        // Return the raw (or modified) expression, making sure complex note literals get mini-wrapped
        return applyMix(wrapComplexNoteLiterals(expr));
    }

    if (raw.length > 0) {
        // Check if this is already Strudel code (contains function calls like s(), note(), stack(), etc.)
        // If so, treat it as an expression and don't wrap it
        if (/^(s\(|note\(|stack\(|silence|sound\(|sample\(|n\(|m\()/.test(raw)) {
            return applyMix(wrapComplexNoteLiterals(raw));
        }

        // For drums, prefer sample patterns (e.g., "RolandTR909_bd*4") when available.
        // If the user provided pitch-like notes (e.g., "c1*4"), fall back to a synth so it still works.
        if (track.id === 'drums') {
            const looksLikePitchNotes = /\b[a-g](?:#|b)?\d\b/i.test(raw);
            if (!looksLikePitchNotes) {
                return applyMix(`s("${escapePattern(raw)}")`);
            }
        }

        // Convert other plain patterns to synthetic sounds instead of trying to load samples
        // Determine the appropriate synth based on track type
        const synthMap: Record<InstrumentType, string> = {
            drums: 'square',
            bass: 'triangle',
            melody: 'sawtooth',
            voice: 'sawtooth',
            fx: 'sine',
        };
        const synth = synthMap[track.id as InstrumentType] || 'square';

        // Use note() with mini-notation and synthetic sound
        return applyMix(`note(m("${escapePattern(raw)}")).s("${synth}")`);
    }

    // No pattern supplied: return empty (will be filtered out)
    return '';
}

function sanitizeCodeForEval(code: string) {
    let cleaned = code;

    const looksLikeDrumMiniNotation = (body: string) => {
        const lowered = body.toLowerCase();
        return (
            /\brolandtr\d{3}_/.test(lowered) ||
            /\b(?:bd|kick|kd|sd|sn|snare|cp|clap|rim|rimshot|hh|hat|ch|oh|rd|ride|cr|cym|cymbal)\b/.test(lowered)
        );
    };

    // If the AI accidentally used note(...) for drum sample mini-notation, convert it to s("...") to avoid "not a note" errors.
    cleaned = cleaned.replace(
        /note\(\s*m\(\s*(['"])([^'"]+)\1\s*\)\s*\)\s*(?:\.s\(\s*(['"])[^'"]+\3\s*\))?/gi,
        (full, quote, body) => {
            if (!looksLikeDrumMiniNotation(body)) return full;
            return `s(${quote}${body}${quote})`;
        }
    );
    cleaned = cleaned.replace(
        /note\(\s*(['"])([^'"]+)\1\s*\)\s*(?:\.s\(\s*(['"])[^'"]+\3\s*\))?/gi,
        (full, quote, body) => {
            if (!looksLikeDrumMiniNotation(body)) return full;
            return `s(${quote}${body}${quote})`;
        }
    );

    // Strip comments (both // and /* */)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    cleaned = cleaned.replace(/\/\/.*/g, '');

    // Drop markdown bullets or list markers that are not valid JS
    cleaned = cleaned.replace(/^\s*[-*]\s+/gm, '');

    // Remove stray leading return statements (common when copying function bodies)
    // We use a loop to handle cases where multiple returns or whitespace/comments existed
    // Use \b to match "return" keyword boundary, allowing for "return(" or "return "
    while (/^\s*return\b\s*/.test(cleaned)) {
        cleaned = cleaned.replace(/^\s*return\b\s*/, '');
    }

    // Strip forbidden / brittle helpers
    cleaned = cleaned.replace(/\.analyze\([^)]*\)/gi, '');
    cleaned = cleaned.replace(/\banalyze\([^)]*\)/gi, '');
    cleaned = cleaned.replace(/\.cpm\([^)]*\)/gi, '');
    cleaned = cleaned.replace(/\bcpm\([^)]*\)/gi, '');
    cleaned = cleaned.replace(/setcpm\([^)]*\)/gi, '');
    cleaned = cleaned.replace(/\.bank\([^)]*\)/gi, '');

    // Remove dangling commas that can be left behind after stripping functions
    // We use a safer lookahead that ensures we don't match inside strings (heuristic)
    // But for now, let's just trust the AI/route.ts to have done a decent job, 
    // and only fix obvious trailing commas at the end of the string.
    cleaned = cleaned.replace(/,\s*$/, '');

    // Replace missing-sample calls with synth fallbacks only when sample libraries are unavailable.
    if (!drumSamplesLoaded) {
        cleaned = replaceSampleCalls(cleaned);
    }

    return cleaned.trim();
}

// Wrap note("c3*4") or note("c7") into note(m("...")) so mini-notation gets parsed safely.
// ALL note string literals should use m() wrapper for proper parsing.
function wrapComplexNoteLiterals(src: string) {
    const percFallback: Record<string, string> = {
        bd: 's("square").decay(0.1).lpf(150)',
        kick: 's("square").decay(0.12).lpf(120)',
        sd: 's("square").hpf(500).decay(0.08)',
        sn: 's("square").hpf(500).decay(0.08)',
        snare: 's("square").hpf(500).decay(0.08)',
        hh: 's("pink").hpf(6000).decay(0.02).gain(0.6)',
        hat: 's("pink").hpf(6000).decay(0.02).gain(0.6)',
    };

    return src.replace(/note\(\s*(['"])([^'"]+)\1\s*\)/gi, (full, quote, body) => {
        console.log(`[wrapComplexNoteLiterals] Found: ${full}`);
        const trimmed = body.trim().toLowerCase();
        if (percFallback[trimmed]) {
            return percFallback[trimmed];
        }
        // Skip if it already calls m(...)
        if (/^\s*m\(/.test(body)) {
            console.log(`[wrapComplexNoteLiterals] Skipping m(): ${full}`);
            return full;
        }
        // Wrap ALL note literals with m() - not just complex ones
        const escaped = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const wrapped = `note(m("${escaped}"))`;
        console.log(`[wrapComplexNoteLiterals] Wrapped: ${wrapped}`);
        return wrapped;
    });
}

// Replace sample-style calls like s("bd*4") with synth fallbacks so we never hit missing samples.
function replaceSampleCalls(src: string) {
    type Flavor = 'kick' | 'snare' | 'hat' | 'mixed' | 'none';

    const classifyToken = (token: string): Exclude<Flavor, 'mixed' | 'none'> | 'other' => {
        const lowered = token.toLowerCase();
        const stripped = lowered.replace(/^rolandtr\d{3}_/, '');

        if (['bd', 'kick', 'kd'].includes(stripped) || stripped.endsWith('_bd')) return 'kick';
        if (
            ['sd', 'sn', 'snare', 'cp', 'clap', 'rim', 'rimshot'].includes(stripped) ||
            stripped.endsWith('_sd') ||
            stripped.endsWith('_sn') ||
            stripped.endsWith('_cp')
        ) {
            return 'snare';
        }
        if (
            ['hh', 'hat', 'ch', 'oh', 'rd', 'ride', 'cr', 'cym', 'cymbal'].includes(stripped) ||
            stripped.endsWith('_hh') ||
            stripped.endsWith('_oh') ||
            stripped.endsWith('_rd')
        ) {
            return 'hat';
        }
        return 'other';
    };

    const mapMiniBodyToSynth = (body: string): { mapped: string; flavor: Flavor } => {
        let kickCount = 0;
        let snareCount = 0;
        let hatCount = 0;

        const mapped = body.replace(/[A-Za-z][A-Za-z0-9_]*/g, (token) => {
            const kind = classifyToken(token);
            if (kind === 'kick') {
                kickCount++;
                return 'square';
            }
            if (kind === 'snare') {
                snareCount++;
                return 'noise';
            }
            if (kind === 'hat') {
                hatCount++;
                return 'pink';
            }
            return token;
        });

        const kindsPresent = (kickCount > 0 ? 1 : 0) + (snareCount > 0 ? 1 : 0) + (hatCount > 0 ? 1 : 0);
        if (kindsPresent === 0) return { mapped, flavor: 'none' };
        if (kindsPresent > 1) return { mapped, flavor: 'mixed' };
        if (kickCount > 0) return { mapped, flavor: 'kick' };
        if (snareCount > 0) return { mapped, flavor: 'snare' };
        return { mapped, flavor: 'hat' };
    };

    return src.replace(/s\(\s*(['"])([^'"]+)\1\s*\)/gi, (full, quote, body, offset, whole) => {
        // Don't rewrite chained synth selector calls like note(...).s("square")
        if (offset > 0 && whole[offset - 1] === '.') return full;

        const bodyStr = String(body);
        const { mapped, flavor } = mapMiniBodyToSynth(bodyStr);
        if (mapped === bodyStr || flavor === 'none') return full;

        const perTypeBody = (want: Exclude<Flavor, 'mixed' | 'none'>) => {
            let hit = false;
            const outBody = bodyStr.replace(/[A-Za-z][A-Za-z0-9_]*/g, (token: string) => {
                const kind = classifyToken(token);
                if (kind === want) {
                    hit = true;
                    if (want === 'kick') return 'square';
                    if (want === 'snare') return 'noise';
                    return 'pink';
                }
                if (kind === 'kick' || kind === 'snare' || kind === 'hat') return '~';
                return token;
            });
            return hit ? outBody : null;
        };

        const shape = (expr: string, want: Exclude<Flavor, 'mixed' | 'none'>) => {
            if (want === 'kick') return `${expr}.decay(0.12).lpf(180)`;
            if (want === 'snare') return `${expr}.decay(0.06).hpf(600)`;
            return `${expr}.decay(0.02).hpf(6000).gain(0.6)`;
        };

        if (flavor === 'mixed') {
            const layers: string[] = [];
            const kickBody = perTypeBody('kick');
            const snareBody = perTypeBody('snare');
            const hatBody = perTypeBody('hat');
            if (kickBody) layers.push(shape(`s(${quote}${kickBody}${quote})`, 'kick'));
            if (snareBody) layers.push(shape(`s(${quote}${snareBody}${quote})`, 'snare'));
            if (hatBody) layers.push(shape(`s(${quote}${hatBody}${quote})`, 'hat'));
            if (layers.length === 0) return full;
            return layers.length === 1 ? layers[0] : `stack(${layers.join(', ')})`;
        }

        let out = `s(${quote}${mapped}${quote})`;
        out = shape(out, flavor);
        return out;
    });
}

export function buildStrudelCode(state: SonicSessionState) {
    // If arrangement mode is enabled, use the arrangement builder
    if (state.useArrangement && state.arrangement) {
        return buildArrangementCode(state.arrangement);
    }

    // Build simple stacked pattern from tracks
    // Filter out silent/muted/empty tracks
    const tracks = [
        formatTrack(state.tracks.drums),
        formatTrack(state.tracks.bass),
        formatTrack(state.tracks.melody),
        formatTrack(state.tracks.fx),
        formatTrack(state.tracks.voice)
    ].filter(t => t !== 'silence' && t !== 's("~")' && t.trim() !== '');

    if (tracks.length === 0) {
        return 'silence';
    }

    if (tracks.length === 1) {
        return `(${tracks[0]}).analyze(1)`;
    }

    // Use single-line format to avoid potential parsing issues
    return `stack(${tracks.join(', ')}).analyze(1)`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ARRANGEMENT MODE: Build Strudel code from layered clips
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a clip's pattern to Strudel code
 * The arrangement mode is simplified - we just stack all active clips
 * and let them all play simultaneously (like a basic mixer)
 */
function buildClipCode(clip: Clip, lane: Lane, group: LaneGroup): string | null {
    if (clip.muted || lane.muted || group.muted) {
        return null;
    }

    let pattern = clip.pattern.trim();

    // Apply volume
    const vol = lane.volume * group.volume;
    if (vol !== 1) {
        pattern = `(${pattern}).gain(${vol.toFixed(3)})`;
    }

    // Apply pan
    if (lane.pan !== 0) {
        pattern = `(${pattern}).pan(${((lane.pan + 1) / 2).toFixed(3)})`;
    }

    // Apply FX
    if (lane.fx?.reverb && lane.fx.reverb > 0) {
        pattern = `(${pattern}).room(${lane.fx.reverb.toFixed(2)})`;
    }
    if (lane.fx?.delay && lane.fx.delay > 0) {
        pattern = `(${pattern}).delay(${lane.fx.delay.toFixed(2)})`;
    }
    if (lane.fx?.filter) {
        const f = lane.fx.filter;
        pattern = `(${pattern}).${f.type}(${f.cutoff})`;
    }

    return pattern;
}

/**
 * Build a Strudel expression for a single lane with all its clips
 * SIMPLIFIED: All clips in a lane are stacked together
 */
function buildLaneCode(lane: Lane, group: LaneGroup): string | null {
    if (lane.muted || group.muted || lane.clips.length === 0) {
        return null;
    }

    // Check for solo - if any lane is soloed, only play soloed lanes
    const hasSolo = group.lanes.some(l => l.solo);
    if (hasSolo && !lane.solo) {
        return null;
    }

    // Get all non-muted clips
    const activeClips = lane.clips.filter(c => !c.muted);
    if (activeClips.length === 0) {
        return null;
    }

    // Build each clip's pattern
    const clipPatterns = activeClips
        .map(clip => buildClipCode(clip, lane, group))
        .filter((p): p is string => p !== null);

    if (clipPatterns.length === 0) {
        return null;
    }

    // If single clip, return it directly
    if (clipPatterns.length === 1) {
        return clipPatterns[0];
    }

    // Stack multiple clips
    return `stack(${clipPatterns.join(', ')})`;
}

/**
 * Build complete arrangement Strudel code
 * SIMPLIFIED VERSION: All lanes are stacked together and play simultaneously
 * This is more like a basic mixer than a full arrangement timeline
 */
export function buildArrangementCode(arrangement: ArrangementState): string {
    const { groups } = arrangement;

    // Collect all lane patterns
    const allLanePatterns: string[] = [];

    for (const group of groups) {
        if (group.muted) continue;

        // Check for solo at group level
        const hasGroupSolo = groups.some(g => g.solo);
        if (hasGroupSolo && !group.solo) continue;

        for (const lane of group.lanes) {
            const laneCode = buildLaneCode(lane, group);
            if (laneCode !== null) {
                allLanePatterns.push(laneCode);
            }
        }
    }

    // If no patterns, return silence
    if (allLanePatterns.length === 0) {
        return 'silence';
    }

    // If single pattern, return it directly
    if (allLanePatterns.length === 1) {
        return allLanePatterns[0];
    }

    // Stack all patterns together
    return `stack(\n  ${allLanePatterns.join(',\n  ')}\n)`;
}

async function ensureSynths() {
    if (synthsRegistered) return;
    try {
        // Register all available sounds and synths
        await registerSynthSounds();
        // Alias a generic "noise" sound to the built-in pink noise so s("noise") never explodes.
        soundAlias('pink', 'noise');
        // Common typo/variant aliases that show up in generated code.
        soundAlias('square', 'square*2');
        soundAlias('supersaw', 'supersawtooth');

        // NOTE: External sample loading from strudel.cc is DISABLED because:
        // 1. Network failures cause "Failed to fetch" errors
        // 2. Many networks/firewalls block these requests
        // 3. The app needs to work offline
        //
        // SOLUTION: Use MusicGen AI for real instrument sounds!
        // Start the MusicGen server: python tools/musicgen_server.py
        // Then say "generate AI drums" or "create AI orchestra"
        //
        // The synthetic fallback system uses oscillators which won't
        // sound like real drums/instruments, but will work reliably.

        drumSamplesLoaded = false;
        pianoSamplesLoaded = false;

        synthsRegistered = true;
        console.log('[strudel] ✅ Synths registered');
        console.log('[strudel] ℹ️ For real instrument sounds, use MusicGen: python tools/musicgen_server.py');
    } catch (err) {
        console.error('[strudel] Failed to register synth waveforms:', err);
        // Don't throw - continue with fallback synths
        synthsRegistered = true;
    }
}

export async function initAudio() {
    if (typeof window === 'undefined') return;
    if (isInitialized) {
        console.log('[initAudio] Already initialized');
        return;
    }

    console.log('[initAudio] Starting initialization...');

    try {
        // Initialize Strudel libraries
        Object.assign(window, core);
        Object.assign(window, mini);
        Object.assign(window, superdough);

        // Enable mini-notation parsing for strings (so s("bd ~ hh") works as expected).
        // This matches Strudel's typical REPL behavior.
        try {
            if (typeof mini.miniAllStrings === 'function') {
                mini.miniAllStrings();
                console.log('[initAudio] miniAllStrings enabled');
            }
        } catch (err) {
            console.warn('[initAudio] Failed to enable miniAllStrings (continuing):', err);
        }

        // alias m for mini-notation if missing
        // @ts-expect-error - polyfill for m
        if (!window.m && mini.m) {
            // @ts-expect-error - polyfill for m
            window.m = mini.m;
        }

        // Polyfill .scale() if missing (to prevent crashes from AI code)
        if (core.Pattern && !core.Pattern.prototype.scale) {
            console.warn('[initAudio] Polyfilling Pattern.prototype.scale (missing in this version)');
            core.Pattern.prototype.scale = function () {
                console.warn('Warning: .scale() is not supported in this environment and was ignored.');
                return this;
            };
        }
        // Older Strudel builds don't ship .acidenv; provide a safe no-op so AI-suggested chains don't crash.
        if (core.Pattern && !core.Pattern.prototype.acidenv) {
            console.warn('[initAudio] Polyfilling Pattern.prototype.acidenv as no-op');
            core.Pattern.prototype.acidenv = function () {
                return this;
            };
        }

        console.log('[initAudio] Libraries loaded');

        const { getAudioContext } = await import('@strudel/webaudio');
        const ctx = getAudioContext();

        // Proactively load the bundled superdough worklets. Some bundlers (Turbopack) can skip the default loader,
        // which later causes AudioWorkletNode() to throw InvalidStateError. Explicitly adding the module here keeps it safe.
        if (ctx.audioWorklet?.addModule && supradoughWorkletUrl) {
            try {
                await ctx.audioWorklet.addModule(supradoughWorkletUrl);
                console.log('[initAudio] Worklet module loaded via supradough URL');
            } catch (err) {
                console.warn('[initAudio] Failed to preload worklet module (will rely on superdough init):', err);
            }
        }

        // Load AudioWorklet modules before any AudioWorkletNode is created.
        // Calling the real superdough init here ensures audioWorklet.addModule() runs inside the user gesture.
        await initStrudelAudio();

        console.log('[initAudio] Audio context state:', ctx.state);

        // Ensure audio context is running (required for user interaction)
        if (ctx.state !== 'running') {
            console.log('[initAudio] Resuming audio context...');
            await ctx.resume();
            console.log('[initAudio] Audio context state after resume:', ctx.state);
        }

        await ensureSynths();

        const { scheduler, evaluate: replEvaluate } = webaudioRepl({
            getTime: () => ctx.currentTime,
        });

        // @ts-expect-error - attaching to window
        window.__strudelScheduler__ = scheduler;
        // @ts-expect-error - attaching to window
        window.__strudelEvaluate__ = replEvaluate;

        // Create and register analyser for spectrum visualization
        await getAnalyser();
        console.log('[initAudio] Analyser registered for spectrum visualization');

        console.log('[initAudio] REPL initialized, testing with simple sound...');
        await replEvaluate('s("~")');

        isInitialized = true;
        console.log('[initAudio] ✅ SUCCESS - Strudel fully initialized');

        // Test basic functionality with a synth (not a sample, since samples are disabled)
        try {
            await replEvaluate('s("triangle").decay(0.1)');
            console.log('[initAudio] Test sound played successfully');
        } catch (testErr) {
            console.warn('[initAudio] Test sound failed, but engine initialized:', testErr);
        }

    } catch (e) {
        console.error('[initAudio] ❌ FAILED at initialization:', e);
        isInitialized = false;
        throw e;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL AUDIO LAYER SYSTEM
// Allows different views (DJ, Garden, Code) to play simultaneously
// ═══════════════════════════════════════════════════════════════════════════

const audioLayers = new Map<string, string>();

/**
 * Update a specific audio layer.
 * System automatically stacks all active layers and evaluates the result.
 */
export async function updateAudioLayer(layerId: string, code: string) {
    // If code is empty or silence, remove the layer
    if (!code || code.trim() === '' || code === 'silence') {
        audioLayers.delete(layerId);
    } else {
        audioLayers.set(layerId, code);
    }

    await evaluateLayers();
}

/**
 * Internal function to combine and run all active layers
 */
async function evaluateLayers() {
    if (typeof window === 'undefined' || !isInitialized) return;

    // Combine all layers using stack(), applying transition sweep if active
    const layerEntries = Array.from(audioLayers.entries());
    let masterCode = 'silence';

    if (layerEntries.length > 0) {
        // Apply transition sweep to the target layer if active
        const processedLayers = layerEntries.map(([id, code]) => {
            if (transitionSweep?.active && transitionSweep.layerId === id) {
                const hpf = getTransitionSweepHpf();
                if (hpf > 50) {
                    return `(${code}).hpf(${Math.round(hpf)})`;
                }
            }
            return code;
        });

        if (processedLayers.length === 1) {
            masterCode = processedLayers[0];
        } else {
            // Stack all layers to play together
            masterCode = `stack(
                ${processedLayers.join(',\n')}
            )`;
        }
    }

    // Use internal evaluation that bypasses the layer update loop
    await internalEvaluate(masterCode);
}

/**
 * Clear all layers and stop audio (Global Stop)
 */
export function stopAudio() {
    audioLayers.clear();
    if (typeof window !== 'undefined') {
        // @ts-expect-error - accessing window
        const scheduler = window.__strudelScheduler__;
        if (scheduler) scheduler.stop();

        // Also explicitly evaluate silence
        internalEvaluate('silence');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DJ TRANSITION SWEEP SYSTEM
// Gradually applies HPF sweep to remove bass, creating tension before a drop
// ═══════════════════════════════════════════════════════════════════════════

interface TransitionSweepState {
    active: boolean;
    startTime: number;
    duration: number; // in seconds
    startHpf: number; // starting HPF frequency (usually 20-50 Hz)
    endHpf: number;   // ending HPF frequency (usually 2000-8000 Hz)
    layerId: string;  // which layer to apply the sweep to
}

let transitionSweep: TransitionSweepState | null = null;
let sweepIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start a DJ-style high-pass filter sweep transition
 * This gradually removes the low end from the specified layer to create tension
 * 
 * @param layerId - Which audio layer to apply the sweep to (default: 'main')
 * @param durationBars - How many bars the sweep should take (default: 8)
 * @param bpm - Current BPM to calculate sweep duration (default: 128)
 */
export function startTransitionSweep(layerId: string = 'main', durationBars: number = 8, bpm: number = 128) {
    // Calculate duration in seconds based on BPM
    const beatsPerBar = 4;
    const durationSeconds = (durationBars * beatsPerBar * 60) / bpm;

    transitionSweep = {
        active: true,
        startTime: Date.now(),
        duration: durationSeconds * 1000, // convert to ms
        startHpf: 30,
        endHpf: 6000,
        layerId,
    };

    console.log(`[TransitionSweep] Started: ${durationBars} bars (${durationSeconds.toFixed(1)}s) at ${bpm} BPM`);

    // Update the sweep progress every 100ms
    if (sweepIntervalId) {
        clearInterval(sweepIntervalId);
    }

    sweepIntervalId = setInterval(() => {
        if (!transitionSweep || !transitionSweep.active) {
            if (sweepIntervalId) clearInterval(sweepIntervalId);
            sweepIntervalId = null;
            return;
        }

        const progress = getTransitionSweepProgress();

        // Re-evaluate layers to update the HPF frequency
        evaluateLayers();

        if (progress >= 1) {
            console.log('[TransitionSweep] Sweep complete - bass fully removed, ready for drop!');
            // Don't clear interval - keep re-evaluating to maintain the maximum HPF
            // The sweep will only stop when cancelTransitionSweep() is called
        }
    }, 200); // Update every 200ms for smooth sweep

    return transitionSweep;
}

/**
 * Cancel/release the transition sweep (the "DROP" moment)
 * This instantly removes the HPF, letting the full bass punch through
 */
export function cancelTransitionSweep() {
    if (sweepIntervalId) {
        clearInterval(sweepIntervalId);
        sweepIntervalId = null;
    }

    const wasActive = transitionSweep?.active || false;
    transitionSweep = null;

    if (wasActive) {
        console.log('[TransitionSweep] 💥 DROPPED! Bass is back!');
    }

    // Force re-evaluation of layers to remove the HPF
    evaluateLayers();

    return wasActive;
}

/**
 * Get the current progress of the transition sweep (0 to 1)
 */
export function getTransitionSweepProgress(): number {
    if (!transitionSweep || !transitionSweep.active) return 0;

    const elapsed = Date.now() - transitionSweep.startTime;
    return Math.min(1, elapsed / transitionSweep.duration);
}

/**
 * Get the current HPF frequency based on sweep progress
 */
export function getTransitionSweepHpf(): number {
    if (!transitionSweep || !transitionSweep.active) return 0;

    const progress = getTransitionSweepProgress();
    // Exponential curve for more natural-sounding sweep
    const expProgress = Math.pow(progress, 0.7);
    return transitionSweep.startHpf + (transitionSweep.endHpf - transitionSweep.startHpf) * expProgress;
}

/**
 * Check if a transition sweep is currently active
 */
export function isTransitionSweepActive(): boolean {
    return transitionSweep?.active || false;
}

/**
 * Apply transition sweep filter to code if sweep is active
 */
function applyTransitionSweepToCode(code: string, layerId: string): string {
    if (!transitionSweep || !transitionSweep.active || transitionSweep.layerId !== layerId) {
        return code;
    }

    const hpf = getTransitionSweepHpf();
    if (hpf <= 50) return code; // Don't apply if basically no filter

    // Wrap the code with a high-pass filter
    return `(${code}).hpf(${Math.round(hpf)})`;
}

// Legacy updateStrudel: Redirects to 'main' layer
export function updateStrudel(state: SonicSessionState, onCodeUpdate?: (code: string) => void) {
    if (typeof window === 'undefined') return;
    // Always lock scheduler tempo to the session BPM to prevent drift/tempo distortion.
    lockTempoBpm(state.bpm);
    const code = buildStrudelCode(state);

    if (!state.isPlaying) {
        // Don't stop ALL audio, just clear the main layer specific to this state
        // user might want DJ to keep playing
        updateAudioLayer('main', 'silence');
        onCodeUpdate?.('// Audio Paused');
        return;
    }

    onCodeUpdate?.(code);

    if (!isInitialized) {
        console.warn('[updateStrudel] Cannot update - Strudel not initialized');
        return;
    }

    // Update the 'main' layer
    updateAudioLayer('main', code);

    // Ensure scheduler is running
    // @ts-expect-error - accessing window
    const scheduler = window.__strudelScheduler__;
    if (scheduler && !scheduler.started) {
        scheduler.start();
    }
}

// Wrapper for manual code evaluation: Redirects to 'main' layer
export async function evalStrudelCode(code: string) {
    // Use 'main' layer for manual code evaluation to coexist with DJ layer
    await updateAudioLayer('main', code);
}

// INTERNAL EVALUATION (The actual heavy lifting, formerly evalStrudelCode)
// INTERNAL EVALUATION (The actual heavy lifting, formerly evalStrudelCode)
async function internalEvaluate(code: string) {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return;

    // @ts-expect-error - accessing window
    const replEvaluate = window.__strudelEvaluate__;
    if (!replEvaluate) return;

    let trimmed = code.trim();
    if (!trimmed) {
        return replEvaluate('s("~")');
    }

    // Strip expr: prefix if someone passed a raw genome/track string.
    if (trimmed.startsWith(EXPR_PREFIX)) {
        trimmed = trimmed.slice(EXPR_PREFIX.length).trim();
    }

    // Clean common issues and wrap mini-notation note literals safely.
    const normalized = trimmed.replace(/^\)\s*/, '');
    const sanitized = sanitizeCodeForEval(normalized);
    const prepared = wrapComplexNoteLiterals(sanitized);
    if (!prepared) {
        return replEvaluate('s("~")');
    }

    const hasAnalyzeInCode = prepared.includes('.analyze(');
    const isAlreadyIife = prepared.startsWith('(() =>');
    const startsWithDeclaration = /^(const|let|var|function)\s/.test(prepared);

    const flattenCode = (src: string) =>
        src.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const flatPrepared = flattenCode(prepared);

    let codeToEval: string;
    if (startsWithDeclaration) {
        // Wrap declarations so evaluation doesn't choke on top-level const/let.
        codeToEval = `(() => { ${flatPrepared}; })()`;
    } else if (isAlreadyIife || hasAnalyzeInCode) {
        codeToEval = flatPrepared;
    } else {
        codeToEval = `(${flatPrepared}).analyze(1)`;
    }

    console.log('[AudioEngine] Evaluating Combined Stack:', codeToEval);

    let result: unknown;
    try {
        result = await replEvaluate(codeToEval);
    } catch (err) {
        console.warn('[AudioEngine] Eval failed, retrying raw:', err);
        try {
            await replEvaluate(flatPrepared);
        } catch (e) {
            console.error('[AudioEngine] Fatal eval error:', e);
        }
    }

    // Always try to connect the analyser - even if analyze was in code it may not have run.
    if (result && typeof (result as { analyze?: (id: number) => unknown }).analyze === 'function') {
        try {
            result = (result as { analyze: (id: number) => unknown }).analyze(1);
        } catch (err) {
            console.warn('[AudioEngine] Failed to run analyze on result:', err);
        }
    }

    // After successful evaluation, refresh the analyser reference
    const tryRefresh = (attempts: number) => {
        refreshAnalyser().then(() => {
            if (attempts > 0) {
                setTimeout(() => tryRefresh(attempts - 1), 300);
            }
        }).catch(() => { });
    };

    // Start retrying after a short delay
    setTimeout(() => tryRefresh(5), 400);

    // Ensure scheduler is running
    // @ts-expect-error - accessing window
    const scheduler = window.scheduler || window.__strudelScheduler__ || (window.__strudel__ && window.__strudel__.scheduler);
    if (scheduler && !scheduler.started && typeof scheduler.start === 'function') {
        console.log('[AudioEngine] Starting scheduler...');
        scheduler.start();
    }
}

export async function getAnalyser(): Promise<AnalyserNode | null> {
    if (typeof window === 'undefined') return null;

    // If we already have a valid analyser, return it
    if (analyser && analyser.context?.state !== 'closed') {
        return analyser;
    }

    return refreshAnalyser();
}

// Force refresh the analyser (call after pattern evaluation)
export async function refreshAnalyser(): Promise<AnalyserNode | null> {
    if (typeof window === 'undefined') return null;

    try {
        // superdough exposes analysers by numeric id when patterns call .analyze(id)
        // We use fftSize 8192 to match Strudel's default (fft=8 -> 2^(8+5) = 8192)
        const targetFftSize = 8192;

        // Helper to try getting analyser by ID
        const tryGetById = (id: number): AnalyserNode | null => {
            // 1. Try window.getAnalyserById
            // @ts-expect-error - accessing window
            if (typeof window.getAnalyserById === 'function') {
                // @ts-expect-error - accessing window
                const node = window.getAnalyserById(id, targetFftSize, 0.8);
                if (node) return node;
            }

            // 2. Try window.superdough.getAnalyserById
            // @ts-expect-error - accessing window
            if (window.superdough && typeof window.superdough.getAnalyserById === 'function') {
                // @ts-expect-error - accessing window
                const node = window.superdough.getAnalyserById(id, targetFftSize, 0.8);
                if (node) return node;
            }

            // 3. Try imported getAnalyserById
            if (typeof getAnalyserById === 'function') {
                try {
                    const node = getAnalyserById(id, targetFftSize, 0.8);
                    if (node) return node;
                } catch { /* ignore */ }
            }

            return null;
        };

        // Try ID 1 (default) then ID 0 (fallback)
        const newAnalyser = tryGetById(1) || tryGetById(0);

        if (newAnalyser) {
            newAnalyser.minDecibels = -90;
            newAnalyser.maxDecibels = -10;
            analyser = newAnalyser;
            console.log(`[refreshAnalyser] ✅ Linked to superdough analyser (fftSize: ${newAnalyser.fftSize})`);
            return analyser;
        }

        // 4. Fallback: Create our own analyser if superdough's isn't available
        // NOTE: This will only work if we can somehow inject it, which we can't easily do with Strudel's architecture.
        // So this is mostly a placeholder to prevent null crashes, but won't show audio unless manually connected.
        if (!analyser) {
            console.warn('[refreshAnalyser] ⚠️ superdough.getAnalyserById not available, creating standalone analyser');
            const { getAudioContext } = await import('@strudel/webaudio');
            const ctx = getAudioContext();
            if (ctx && ctx.state !== 'closed') {
                const fallbackAnalyser = ctx.createAnalyser();
                fallbackAnalyser.fftSize = targetFftSize;
                fallbackAnalyser.smoothingTimeConstant = 0.8;
                fallbackAnalyser.minDecibels = -90;
                fallbackAnalyser.maxDecibels = -10;
                analyser = fallbackAnalyser;
                console.log('[refreshAnalyser] Created standalone analyser (disconnected)');
            }
        }

        return analyser;
    } catch {
        console.error('Failed to refresh analyser:');
        return analyser;
    }
}

// Helper to inject analyser into pattern execution
export function getAnalyserForPattern() {
    return analyser;
}
