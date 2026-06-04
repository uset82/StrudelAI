/**
 * StrudelCodeAudioValidationAgent — Shared Types
 * All TypeScript interfaces used across the agent's skills.
 */

// ─── Parsed Intent ─────────────────────────────────────────────────────────────

/**
 * Extracted musical intent from a raw Strudel code string.
 */
export interface ParsedStrudelIntent {
  /** Note names extracted from note() calls, e.g. ["c", "d", "eb", "f"] */
  notes: string[];
  /** Sample tokens from s() calls, e.g. ["bd", "sd", "hh"] */
  sounds: string[];
  /** Bank name from bank() call, e.g. "RolandTR909" */
  bank: string | null;
  /** Numeric indexes from n() call, e.g. [0, 1, 2, 3] */
  nIndexes: number[];
  /** Scale string parsed from scale() or inferred, e.g. "C:minor" */
  scale: string | null;
  /** Transposition value from trans() */
  trans: number | null;
  /** BPM from tempo() or setcpm() */
  bpm: number | null;
  /** FX chain names detected, e.g. ["reverb", "delay", "lpf"] */
  fx: string[];
  /** Raw code that was parsed */
  rawCode: string;
  /** Whether code uses note() for pitched material */
  hasPitchedPattern: boolean;
  /** Whether code uses s() for sample-based material */
  hasSamplePattern: boolean;
}

// ─── Correction Report ─────────────────────────────────────────────────────────

export type CorrectionErrorType =
  | 'syntax_error'
  | 'scale_error'
  | 'instrument_mismatch'
  | 'sample_not_found'
  | 'bank_not_found'
  | 'index_out_of_range'
  | 'missing_note_pattern'
  | 'audio_mismatch'
  | 'unsupported_method';

/**
 * A single correction item returned to the AI when validation fails.
 */
export interface CorrectionReport {
  type: CorrectionErrorType;
  message: string;
  suggestedPatch?: string;
}

/**
 * A non-blocking warning (does not reject the code).
 */
export interface ValidationWarning {
  type: string;
  message: string;
  normalizedValue?: unknown;
}

// ─── Audio Analysis ────────────────────────────────────────────────────────────

/**
 * Frequency profile derived from Meyda audio feature extraction.
 */
export interface FrequencyProfile {
  /** RMS loudness, 0–1 */
  rms: number;
  /** Spectral centroid (Hz) */
  spectralCentroid: number;
  /** Ratio of bass-band energy (< 250 Hz), 0–1 */
  bassEnergy: number;
  /** Ratio of mid-band energy (250–4000 Hz), 0–1 */
  midEnergy: number;
  /** Ratio of high-band energy (> 4000 Hz), 0–1 */
  highEnergy: number;
  /** MFCC coefficients if available */
  mfcc?: number[];
}

/**
 * Result from audio rendering and feature extraction.
 */
export interface AudioAnalysisResult {
  /** Whether audio was actually captured (false = stub mode) */
  captured: boolean;
  /** Notes detected by pitch detection (pitchfinder / basic-pitch) */
  detectedNotes: string[];
  /** Fundamental frequency in Hz (for monophonic detection) */
  fundamentalHz: number | null;
  /** Frequency profile from Meyda */
  frequencyProfile: FrequencyProfile | null;
  /** Whether onsets were detected (transient present) */
  hasOnsets: boolean;
  /** Estimated tempo if detected */
  detectedBpm: number | null;
}

// ─── Validation Result ─────────────────────────────────────────────────────────

/**
 * Analysis summary attached to an approved result.
 */
export interface ValidationAnalysis {
  expectedNotes: string[];
  detectedNotes: string[];
  scale: string | null;
  instrument: string | null;
  frequencyProfile?: FrequencyProfile | null;
}

/**
 * Final output of the full validation pipeline.
 */
export interface ValidationResult {
  /** Whether the code is approved to reach the Strudel engine */
  approved: boolean;
  /** Confidence score 0–1 */
  confidence: number;
  /** The original or suggested-corrected code */
  code: string;
  /** Errors that caused rejection */
  errors: CorrectionReport[];
  /** Non-blocking warnings */
  warnings: ValidationWarning[];
  /** Analysis data (populated when approved) */
  analysis: ValidationAnalysis | null;
}

// ─── Instrument Registry ───────────────────────────────────────────────────────

export type InstrumentKind = 'pitched' | 'drum' | 'noise' | 'fx' | 'loop';
export type ValidationMethod = 'pitch' | 'transient' | 'spectrum' | 'sample-map';

/**
 * Expected frequency profile thresholds for a drum/noise instrument.
 */
export interface DrumFrequencyThreshold {
  /** Minimum bassEnergy (0–1) expected */
  minBassEnergy?: number;
  /** Minimum highEnergy (0–1) expected */
  minHighEnergy?: number;
  /** Minimum midEnergy (0–1) expected */
  minMidEnergy?: number;
  /** Whether a clear onset/transient is expected */
  expectsOnset: boolean;
}

/**
 * Registry entry for a single instrument or drum role.
 */
export interface InstrumentProfile {
  /** Name key (e.g. "kick", "cello") */
  name: string;
  /** Instrument category */
  type: InstrumentKind;
  /** Human-readable display name */
  label: string;
  /** MIDI note range for pitched instruments */
  allowedNoteRange?: { min: string; max: string };
  /** Frequency profile thresholds for drum/noise validation */
  expectedFrequencyProfile?: DrumFrequencyThreshold;
  /** Valid Strudel s() aliases for this instrument */
  validStrudelAliases: string[];
  /** How to validate this instrument in audio */
  validationMethod: ValidationMethod;
  /** Keywords used to detect this instrument from a user prompt */
  intentKeywords: string[];
}

// ─── Pipeline Context ──────────────────────────────────────────────────────────

/**
 * Optional context passed to the main validateStrudelCode() function.
 */
export interface ValidationContext {
  /** The user's original prompt, used for intent matching */
  userPrompt?: string;
  /** Target key/scale from the music brief (e.g. "C minor") */
  targetKey?: string;
  /** Whether to run audio rendering & analysis (requires Web Audio) */
  enableAudioValidation?: boolean;
  /** Max correction retries (default 3) */
  maxRetries?: number;
}
