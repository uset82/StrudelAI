/**
 * Skill 3 — validateNotesAgainstScale
 *
 * Checks that notes in a parsed Strudel intent belong to the requested key/scale.
 * Returns rejection details with a suggested patch if notes are outside the scale.
 */

import type { ParsedStrudelIntent, CorrectionReport } from '../types';

// ─── Scale Definitions ─────────────────────────────────────────────────────────

/**
 * Scale intervals in semitones from the root (0 = root).
 * Chromatic reference: C=0, C#/Db=1, D=2, D#/Eb=3, E=4, F=5, F#/Gb=6, G=7, G#/Ab=8, A=9, A#/Bb=10, B=11
 */
const SCALE_INTERVALS: Record<string, number[]> = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  minor:            [0, 2, 3, 5, 7, 8, 10], // natural minor
  'natural minor':  [0, 2, 3, 5, 7, 8, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic minor':  [0, 2, 3, 5, 7, 9, 11],
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  phrygian:         [0, 1, 3, 5, 7, 8, 10],
  lydian:           [0, 2, 4, 6, 7, 9, 11],
  mixolydian:       [0, 2, 4, 5, 7, 9, 10],
  locrian:          [0, 1, 3, 5, 6, 8, 10],
  'pentatonic major':  [0, 2, 4, 7, 9],
  'pentatonic minor':  [0, 3, 5, 7, 10],
  pentatonic:          [0, 2, 4, 7, 9],
  blues:            [0, 3, 5, 6, 7, 10],
  diminished:       [0, 2, 3, 5, 6, 8, 9, 11],
  'whole tone':     [0, 2, 4, 6, 8, 10],
  chromatic:        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

// ─── Note name → semitone mapping ─────────────────────────────────────────────

const NOTE_SEMITONES: Record<string, number> = {
  c: 0,  'c#': 1, db: 1,
  d: 2,  'd#': 3, eb: 3,
  e: 4,
  f: 5,  'f#': 6, gb: 6,
  g: 7,  'g#': 8, ab: 8,
  a: 9,  'a#': 10, bb: 10,
  b: 11,
};

/** Map of natural note → flat / sharp equivalents for suggestions */
const ENHARMONIC_FLAT: Record<number, string> = {
  1: 'db', 3: 'eb', 6: 'gb', 8: 'ab', 10: 'bb',
};

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Parse a pitch class from a note token (strip octave number).
 * e.g. "eb4" → "eb", "C#" → "c#", "d" → "d"
 */
function pitchClass(note: string): string {
  return note.toLowerCase().replace(/\d+$/, '');
}

/**
 * Convert note name to semitone value (0–11).
 * Returns null if not recognized.
 */
function noteToSemitone(note: string): number | null {
  const pc = pitchClass(note);
  return NOTE_SEMITONES[pc] ?? null;
}

/**
 * Parse a root note from a key string like "C minor", "G major", "F# dorian".
 * Returns { root: "c", scaleName: "minor" } or null.
 */
function parseKeyString(key: string): { root: string; scaleName: string } | null {
  // Formats: "C minor", "C:minor", "Cmaj", "C major"
  const match = key.match(/^([A-Ga-g](?:#|b)?)\s*[:\s-]?\s*(.+)$/);
  if (!match) return null;
  return {
    root: match[1].toLowerCase(),
    scaleName: match[2].toLowerCase().trim(),
  };
}

/**
 * Given a root note name and scale name, return the set of allowed semitones (mod 12).
 */
function buildScaleSet(root: string, scaleName: string): Set<number> | null {
  const rootSemitone = NOTE_SEMITONES[root.toLowerCase()];
  if (rootSemitone === undefined) return null;

  const intervals = SCALE_INTERVALS[scaleName.toLowerCase()];
  if (!intervals) return null;

  const semitones = new Set(intervals.map((i) => (rootSemitone + i) % 12));
  return semitones;
}

/**
 * For a given out-of-scale note, find the closest in-scale note.
 */
function suggestReplacement(noteName: string, scaleSet: Set<number>): string {
  const semitone = noteToSemitone(noteName);
  if (semitone === null) return noteName;

  const octave = noteName.match(/\d+$/)?.[0] ?? '';

  // Try the flat and sharp of the same position
  for (const delta of [1, -1, 2, -2]) {
    const candidate = (semitone + delta + 12) % 12;
    if (scaleSet.has(candidate)) {
      const name = ENHARMONIC_FLAT[candidate] ??
        Object.keys(NOTE_SEMITONES).find((k) => NOTE_SEMITONES[k] === candidate) ??
        String(candidate);
      return name + octave;
    }
  }
  return noteName;
}

// ─── Scale validation result ──────────────────────────────────────────────────

export interface ScaleValidationResult {
  valid: boolean;
  outOfScaleNotes: Array<{
    note: string;
    suggestion: string;
    reason: string;
  }>;
  errors: CorrectionReport[];
  detectedScale: string | null;
}

// ─── Main skill ───────────────────────────────────────────────────────────────

/**
 * Validate that the notes in a parsed Strudel intent fall within the target scale.
 *
 * @param parsed - The parsed Strudel intent
 * @param targetKey - Key string like "C minor", "G major" (from prompt or MusicBrief)
 * @returns ScaleValidationResult
 */
export function validateNotesAgainstScale(
  parsed: ParsedStrudelIntent,
  targetKey: string | null | undefined,
): ScaleValidationResult {
  const empty: ScaleValidationResult = {
    valid: true,
    outOfScaleNotes: [],
    errors: [],
    detectedScale: null,
  };

  // If no notes, nothing to validate
  if (parsed.notes.length === 0) return empty;

  // Use explicitly declared scale in code first, then targetKey
  const keySource = parsed.scale ?? targetKey;
  if (!keySource) {
    // No scale context — skip scale validation but issue a warning
    return empty;
  }

  // Try to parse scale from code-level scale() call (format: "C:minor")
  let parsed_key = keySource;
  if (parsed_key.includes(':')) {
    parsed_key = parsed_key.replace(':', ' ');
  }

  const keyParsed = parseKeyString(parsed_key);
  if (!keyParsed) {
    return empty; // Can't parse key, skip
  }

  const scaleSet = buildScaleSet(keyParsed.root, keyParsed.scaleName);
  if (!scaleSet) {
    return empty; // Unknown scale name, skip
  }

  const detectedScale = `${keyParsed.root.toUpperCase()} ${keyParsed.scaleName}`;
  const outOfScaleNotes: ScaleValidationResult['outOfScaleNotes'] = [];
  const errors: CorrectionReport[] = [];

  for (const note of parsed.notes) {
    const semitone = noteToSemitone(note);
    if (semitone === null) continue; // Skip unrecognized tokens

    if (!scaleSet.has(semitone)) {
      const suggestion = suggestReplacement(note, scaleSet);
      const reason = `"${note}" (semitone ${semitone}) is outside ${detectedScale}. Suggested: "${suggestion}".`;
      outOfScaleNotes.push({ note, suggestion, reason });
    }
  }

  if (outOfScaleNotes.length > 0) {
    // Build a suggested patch by replacing notes in the rawCode
    let patchedCode = parsed.rawCode;
    for (const { note, suggestion } of outOfScaleNotes) {
      // Replace bare note names (not preceded by alphanumeric)
      const notePattern = new RegExp(`(?<![a-z#])${note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z#\\d])`, 'gi');
      patchedCode = patchedCode.replace(notePattern, suggestion);
    }

    errors.push({
      type: 'scale_error',
      message: `${outOfScaleNotes.length} note(s) outside ${detectedScale}: ${outOfScaleNotes.map((n) => n.note).join(', ')}. ${outOfScaleNotes.map((n) => n.reason).join(' ')}`,
      suggestedPatch: patchedCode,
    });
  }

  return {
    valid: outOfScaleNotes.length === 0,
    outOfScaleNotes,
    errors,
    detectedScale,
  };
}

/**
 * Check whether a note name belongs to a given key/scale string.
 * Convenience function for single-note checks.
 */
export function noteIsInScale(note: string, keyString: string): boolean {
  const keyParsed = parseKeyString(keyString.replace(':', ' '));
  if (!keyParsed) return true;
  const scaleSet = buildScaleSet(keyParsed.root, keyParsed.scaleName);
  if (!scaleSet) return true;
  const semitone = noteToSemitone(note);
  if (semitone === null) return true;
  return scaleSet.has(semitone);
}

/** Export scale data for tests */
export { SCALE_INTERVALS, NOTE_SEMITONES };
