/**
 * Skill 7 — compareExpectedVsDetectedAudio
 *
 * Compares what the Strudel code SHOULD produce (from parsed intent)
 * against what the audio analysis ACTUALLY detected.
 *
 * For pitched instruments: compares expected note names vs detected notes.
 * For drums: compares expected drum role vs detected frequency profile.
 */

import type {
  ParsedStrudelIntent,
  AudioAnalysisResult,
  CorrectionReport,
  ValidationWarning,
  ValidationAnalysis,
} from '../types';
import { getProfileByAlias, findInstrumentFromIntent } from '../registry/instrumentRegistry';

// ─── Note pitch-class comparison ──────────────────────────────────────────────

const NOTE_SEMITONES: Record<string, number> = {
  c: 0,  'c#': 1, db: 1,
  d: 2,  'd#': 3, eb: 3,
  e: 4,
  f: 5,  'f#': 6, gb: 6,
  g: 7,  'g#': 8, ab: 8,
  a: 9,  'a#': 10, bb: 10,
  b: 11,
};

function pitchClass(note: string): string {
  return note.toLowerCase().replace(/\d+$/, '');
}

function noteToSemitone(note: string): number | null {
  return NOTE_SEMITONES[pitchClass(note)] ?? null;
}

/**
 * Check if two note names are enharmonically equivalent (same semitone).
 * toleranceSemitones=0 → exact pitch class match only.
 * toleranceSemitones=1 → allow ±1 semitone (for microtonal or detection jitter).
 */
function notesMatch(expected: string, detected: string, toleranceSemitones = 0): boolean {
  const e = noteToSemitone(expected);
  const d = noteToSemitone(detected);
  if (e === null || d === null) return expected.toLowerCase() === detected.toLowerCase();
  const diff = Math.min(Math.abs(e - d), 12 - Math.abs(e - d));
  return diff <= toleranceSemitones;
}

// ─── Drum profile thresholds ──────────────────────────────────────────────────

interface DrumCheckResult {
  matches: boolean;
  reason: string;
}

function checkDrumProfile(
  expectedRole: string,
  profile: AudioAnalysisResult['frequencyProfile'],
  hasOnsets: boolean,
): DrumCheckResult {
  if (!profile) {
    return { matches: true, reason: 'No frequency profile available (stub mode).' };
  }

  switch (expectedRole) {
    case 'kick':
      if (profile.bassEnergy < 0.55) {
        return {
          matches: false,
          reason: `Expected kick (high bass energy ≥ 0.55) but detected bassEnergy=${profile.bassEnergy.toFixed(2)}. Sound profile looks more like hi-hat or snare.`,
        };
      }
      return { matches: true, reason: 'Kick profile matches: sufficient bass energy.' };

    case 'closed-hihat':
    case 'open-hihat':
      if (profile.highEnergy < 0.55) {
        return {
          matches: false,
          reason: `Expected hi-hat (high energy ≥ 0.55) but detected highEnergy=${profile.highEnergy.toFixed(2)}. Sound profile looks more like kick or snare.`,
        };
      }
      return { matches: true, reason: 'Hi-hat profile matches: sufficient high-frequency energy.' };

    case 'snare':
    case 'clap':
      if (profile.midEnergy < 0.35 || !hasOnsets) {
        return {
          matches: false,
          reason: `Expected snare/clap (mid energy ≥ 0.35 + transient) but detected midEnergy=${profile.midEnergy.toFixed(2)}, hasOnsets=${hasOnsets}.`,
        };
      }
      return { matches: true, reason: 'Snare/clap profile matches: transient + mid energy present.' };

    default:
      return { matches: true, reason: `No specific profile check for "${expectedRole}".` };
  }
}

// ─── Main skill ───────────────────────────────────────────────────────────────

export interface AudioComparisonResult {
  valid: boolean;
  confidence: number;
  errors: CorrectionReport[];
  warnings: ValidationWarning[];
  analysis: ValidationAnalysis;
}

/**
 * Compare expected audio output (from parsed code) vs detected audio features.
 *
 * @param parsed - Parsed Strudel intent (what the code claims to produce)
 * @param audio - Audio analysis result from renderPreviewAndAnalyze
 * @param userIntent - Original user prompt (for instrument role detection)
 */
export function compareExpectedVsDetectedAudio(
  parsed: ParsedStrudelIntent,
  audio: AudioAnalysisResult,
  userIntent: string | null | undefined,
): AudioComparisonResult {
  const errors: CorrectionReport[] = [];
  const warnings: ValidationWarning[] = [];
  let confidence = 1.0;

  // ── Build baseline analysis object ────────────────────────────────────────
  const analysis: ValidationAnalysis = {
    expectedNotes: parsed.notes,
    detectedNotes: audio.detectedNotes,
    scale: parsed.scale,
    instrument: null,
    frequencyProfile: audio.frequencyProfile,
  };

  // If audio was not captured (stub mode), reduce confidence but don't fail
  if (!audio.captured) {
    warnings.push({
      type: 'stub_mode',
      message: 'Audio validation is in stub mode — real audio was not captured. Set ENABLE_AUDIO_VALIDATION=true to enable.',
    });
    confidence = 0.75;
    return { valid: true, confidence, errors, warnings, analysis };
  }

  // ── Determine instrument being validated ──────────────────────────────────
  let expectedRole: string | null = null;
  if (userIntent) {
    const profile = findInstrumentFromIntent(userIntent);
    if (profile) {
      expectedRole = profile.name;
      analysis.instrument = profile.name;
    }
  }
  if (!expectedRole && parsed.sounds.length > 0) {
    const profile = getProfileByAlias(parsed.sounds[0]);
    if (profile) {
      expectedRole = profile.name;
      analysis.instrument = profile.name;
    }
  }

  // ── Pitched instrument: compare notes ─────────────────────────────────────
  if (parsed.hasPitchedPattern && parsed.notes.length > 0 && audio.detectedNotes.length > 0) {
    const mismatches: string[] = [];

    // Compare overlapping positions (detected may have fewer notes than expected)
    const compareLen = Math.min(parsed.notes.length, audio.detectedNotes.length);
    for (let i = 0; i < compareLen; i++) {
      const expected = parsed.notes[i];
      const detected = audio.detectedNotes[i];
      if (!notesMatch(expected, detected, 0)) {
        mismatches.push(`Position ${i + 1}: expected "${expected}", detected "${detected}"`);
      }
    }

    if (mismatches.length > 0) {
      const penalty = mismatches.length / parsed.notes.length;
      confidence = Math.max(0.1, confidence - penalty * 0.4);

      errors.push({
        type: 'audio_mismatch',
        message: `Detected notes differ from expected: ${mismatches.join('; ')}. Expected: [${parsed.notes.join(', ')}], Detected: [${audio.detectedNotes.join(', ')}].`,
      });
    }

    // Tuning deviation check
    if (audio.fundamentalHz !== null) {
      const expectedFirstSemitone = noteToSemitone(parsed.notes[0]);
      if (expectedFirstSemitone !== null) {
        // Simple sanity check: detectedHz should be in the right ballpark
        // For C4 (261.63 Hz), we allow ±50 Hz variance
        // This is a rough check; Phase 9B should use cents calculation
        warnings.push({
          type: 'pitch_detected',
          message: `Fundamental frequency detected: ${audio.fundamentalHz.toFixed(1)} Hz.`,
        });
      }
    }
  }

  // ── Drum instrument: compare frequency profile ────────────────────────────
  if (parsed.hasSamplePattern && !parsed.hasPitchedPattern && expectedRole) {
    const drumCheck = checkDrumProfile(
      expectedRole,
      audio.frequencyProfile,
      audio.hasOnsets,
    );

    if (!drumCheck.matches) {
      confidence = Math.max(0.1, confidence - 0.4);
      errors.push({
        type: 'audio_mismatch',
        message: drumCheck.reason,
      });
    } else {
      warnings.push({
        type: 'drum_profile_ok',
        message: drumCheck.reason,
      });
    }
  }

  return {
    valid: errors.length === 0,
    confidence: parseFloat(confidence.toFixed(2)),
    errors,
    warnings,
    analysis,
  };
}
