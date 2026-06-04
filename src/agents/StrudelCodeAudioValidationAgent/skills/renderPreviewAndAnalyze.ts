/**
 * Skill 6 — renderPreviewAndAnalyze
 *
 * Renders 1–2 bars of Strudel code and extracts audio features.
 *
 * Phase 9A: Stub implementation — returns a mock AudioAnalysisResult.
 * Phase 9B: Real audio capture via Web Audio API + Meyda + pitchfinder.
 *
 * The ENABLE_AUDIO_VALIDATION environment flag controls which path is used.
 * In a Node.js / Next.js API route environment (no Web Audio), the stub is used.
 * In a browser environment with the flag set, real analysis is attempted.
 */

import type { AudioAnalysisResult, FrequencyProfile, ParsedStrudelIntent } from '../types';

// ─── Environment detection ─────────────────────────────────────────────────────

const IS_BROWSER = typeof window !== 'undefined' && typeof AudioContext !== 'undefined';
const ENABLE_AUDIO_VALIDATION =
  typeof process !== 'undefined'
    ? process.env.ENABLE_AUDIO_VALIDATION === 'true'
    : false;

// ─── Stub result ──────────────────────────────────────────────────────────────

/**
 * Returns a mock AudioAnalysisResult for environments where real audio
 * capture is not available (Node.js server, no Web Audio).
 */
function stubAnalysis(parsed: ParsedStrudelIntent): AudioAnalysisResult {
  // Build a plausible stub based on the parsed intent
  const isDrum = parsed.hasSamplePattern && !parsed.hasPitchedPattern;

  return {
    captured: false,
    detectedNotes: parsed.notes.length > 0 ? [...parsed.notes] : [],
    fundamentalHz: null,
    frequencyProfile: isDrum
      ? {
          rms: 0.5,
          spectralCentroid: 800,
          bassEnergy: 0.6,  // Stub: assume kick-like profile for drums
          midEnergy: 0.3,
          highEnergy: 0.1,
        }
      : {
          rms: 0.3,
          spectralCentroid: 1200,
          bassEnergy: 0.1,
          midEnergy: 0.5,
          highEnergy: 0.4,
        },
    hasOnsets: isDrum,
    detectedBpm: parsed.bpm ?? null,
  };
}

// ─── Hz to note conversion ────────────────────────────────────────────────────

const A4_HZ = 440.0;
const NOTE_NAMES_CHROMATIC = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

/**
 * Convert a frequency in Hz to the closest note name with octave.
 * e.g. 261.63 → "c4"
 */
function hzToNoteName(hz: number): string {
  if (hz <= 0) return 'unknown';
  const semitones = 12 * Math.log2(hz / A4_HZ);
  const midiNote = Math.round(semitones) + 69; // A4 = MIDI 69
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = ((midiNote % 12) + 12) % 12;
  return `${NOTE_NAMES_CHROMATIC[noteIndex]}${octave}`;
}

// ─── Pitchfinder integration ──────────────────────────────────────────────────

/**
 * Detect the fundamental frequency of a Float32Array audio buffer using pitchfinder.
 * Returns Hz or null if no pitch detected.
 *
 * Only called in browser or Node environments where pitchfinder is available.
 */
async function detectPitch(buffer: Float32Array, sampleRate: number): Promise<number | null> {
  try {
    // Dynamic import to avoid breaking SSR
    const { default: pitchfinderModule } = await import('pitchfinder');
    const detectFn = pitchfinderModule.AMDF({ sampleRate });
    const pitch = detectFn(buffer);
    return pitch ?? null;
  } catch {
    return null;
  }
}

// ─── Meyda integration ────────────────────────────────────────────────────────

/**
 * Extract audio features from a buffer using Meyda.
 * Only callable in environments where Meyda is available.
 */
async function extractMeydaFeatures(
  buffer: Float32Array,
  sampleRate: number,
): Promise<FrequencyProfile | null> {
  try {
    const Meyda = (await import('meyda')).default;

    const features = Meyda.extract(
      ['rms', 'spectralCentroid', 'mfcc', 'energy', 'perceptualSpread'],
      buffer,
    );

    if (!features) return null;

    // Compute band energies by FFT magnitude split
    // Using a simple approximation: low = spectral centroid < 250 Hz means high bass
    const centroid = (features.spectralCentroid as number) ?? 1000;
    const rms = (features.rms as number) ?? 0;

    // Approximate band energy split from centroid position
    const maxFreq = sampleRate / 2;
    const bassRatio = Math.min(1, Math.max(0, 1 - centroid / 500));
    const highRatio = Math.min(1, Math.max(0, (centroid - 2000) / (maxFreq - 2000)));
    const midRatio = Math.max(0, 1 - bassRatio - highRatio);

    return {
      rms,
      spectralCentroid: centroid,
      bassEnergy: bassRatio,
      midEnergy: midRatio,
      highEnergy: highRatio,
      mfcc: features.mfcc as number[] | undefined,
    };
  } catch {
    return null;
  }
}

// ─── Web Audio capture (browser only) ────────────────────────────────────────

/**
 * Attempt to capture audio from a running Strudel engine via Web Audio.
 * This is a best-effort capture using OfflineAudioContext or MediaStream recording.
 *
 * NOTE: In Phase 9B full implementation, this function would connect to the
 * Strudel Web Audio graph, render 1–2 bars, and return a Float32Array.
 * For now it returns null to trigger fallback to stub.
 */
async function captureStrudelAudio(
  _code: string,
  _durationBars: number,
  _bpm: number,
): Promise<{ buffer: Float32Array; sampleRate: number } | null> {
  // Phase 9B TODO: Implement real capture
  // 1. Create an OfflineAudioContext
  // 2. Feed code to Strudel engine via the JS API
  // 3. Render _durationBars of audio at _bpm
  // 4. Return the rendered buffer
  void _code;
  void _durationBars;
  void _bpm;
  return null;
}

// ─── Main skill ───────────────────────────────────────────────────────────────

/**
 * Render a short preview of Strudel code and analyze the audio.
 *
 * In Phase 9A (current): Returns a stub analysis based on parsed intent.
 * In Phase 9B (future): Captures real audio and runs Meyda + pitchfinder.
 *
 * @param code - The validated Strudel code to analyze
 * @param parsed - Pre-parsed Strudel intent (used for stub mode)
 * @param durationBars - Number of bars to render (default 2)
 */
export async function renderPreviewAndAnalyze(
  code: string,
  parsed: ParsedStrudelIntent,
  durationBars = 2,
): Promise<AudioAnalysisResult> {
  // If audio validation is disabled or not in browser — use stub
  if (!ENABLE_AUDIO_VALIDATION || !IS_BROWSER) {
    return stubAnalysis(parsed);
  }

  // Attempt real audio capture
  const bpm = parsed.bpm ?? 120;
  const captured = await captureStrudelAudio(code, durationBars, bpm);

  if (!captured) {
    // Capture failed — fall back to stub
    return stubAnalysis(parsed);
  }

  const { buffer, sampleRate } = captured;

  // Run pitch detection
  const fundamentalHz = await detectPitch(buffer, sampleRate);
  const detectedNotes: string[] = [];
  if (fundamentalHz !== null) {
    detectedNotes.push(hzToNoteName(fundamentalHz));
  }

  // Run Meyda feature extraction
  const frequencyProfile = await extractMeydaFeatures(buffer, sampleRate);

  // Onset detection (simple RMS threshold approach for Phase 9B)
  const hasOnsets = (frequencyProfile?.rms ?? 0) > 0.05;

  return {
    captured: true,
    detectedNotes,
    fundamentalHz,
    frequencyProfile,
    hasOnsets,
    detectedBpm: null, // Phase 9B: integrate aubio for tempo detection
  };
}

// Export helpers for testing
export { hzToNoteName, stubAnalysis };
