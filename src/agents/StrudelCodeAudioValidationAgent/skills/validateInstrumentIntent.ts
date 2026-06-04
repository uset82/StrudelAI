/**
 * Skill 4 — validateInstrumentIntent
 *
 * Ensures that the generated Strudel code matches the instrument
 * the user requested in their prompt.
 *
 * Examples:
 * - "hard techno kick" + s("sd*4") → REJECTED (snare used instead of kick)
 * - "cello melody" + s("cello") + note("c d eb f") → APPROVED
 * - "piano chord" + s("sine") without note() → WARNING (no pitch pattern)
 */

import type { ParsedStrudelIntent, CorrectionReport, ValidationWarning } from '../types';
import {
  findInstrumentFromIntent,
  getProfileByAlias,
} from '../registry/instrumentRegistry';

export interface IntentValidationResult {
  valid: boolean;
  errors: CorrectionReport[];
  warnings: ValidationWarning[];
  detectedInstrument: string | null;
  expectedInstrument: string | null;
}

/**
 * Validate that the Strudel code's samples/sounds match the user's instrument intent.
 *
 * @param parsed - Parsed Strudel intent
 * @param userIntent - The raw user prompt or instrument description (e.g. "hard techno kick")
 */
export function validateInstrumentIntent(
  parsed: ParsedStrudelIntent,
  userIntent: string | null | undefined,
): IntentValidationResult {
  const errors: CorrectionReport[] = [];
  const warnings: ValidationWarning[] = [];

  if (!userIntent) {
    return { valid: true, errors, warnings, detectedInstrument: null, expectedInstrument: null };
  }

  // ── Identify the instrument the user intended ──────────────────────────────
  const expectedProfile = findInstrumentFromIntent(userIntent);
  if (!expectedProfile) {
    // Can't identify intent from prompt — skip this validation
    return { valid: true, errors, warnings, detectedInstrument: null, expectedInstrument: null };
  }

  const expectedInstrument = expectedProfile.name;

  // ── Find what instrument the code actually uses ────────────────────────────
  let detectedInstrument: string | null = null;
  let detectedAlias: string | null = null;

  // Check s() sounds for known drum/sample aliases
  for (const sound of parsed.sounds) {
    const profile = getProfileByAlias(sound);
    if (profile) {
      detectedInstrument = profile.name;
      detectedAlias = sound;
      break;
    }
  }

  // ── Validate pitched instruments ──────────────────────────────────────────
  if (expectedProfile.type === 'pitched') {
    // Pitched instruments MUST have a note() pattern
    if (!parsed.hasPitchedPattern) {
      errors.push({
        type: 'missing_note_pattern',
        message: `User requested "${expectedInstrument}" (pitched) but code has no note() pattern. Pitched instruments require note() to specify pitch.`,
        suggestedPatch: `Add note("c4 d4 e4 f4").s("${expectedProfile.validStrudelAliases[0]}")`,
      });
    }

    // Check that s() uses a valid alias for this instrument (if any sound is present)
    if (parsed.sounds.length > 0) {
      const validAliases = expectedProfile.validStrudelAliases.map((a) => a.toLowerCase());
      const hasMatchingAlias = parsed.sounds.some((s) =>
        validAliases.includes(s.toLowerCase())
      );
      if (!hasMatchingAlias) {
        warnings.push({
          type: 'instrument_alias_mismatch',
          message: `Expected s() to use one of [${validAliases.join(', ')}] for "${expectedInstrument}", but found [${parsed.sounds.join(', ')}].`,
          normalizedValue: expectedProfile.validStrudelAliases[0],
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      detectedInstrument,
      expectedInstrument,
    };
  }

  // ── Validate drum / noise instruments ────────────────────────────────────
  if (expectedProfile.type === 'drum' || expectedProfile.type === 'noise') {
    // Drum instruments must NOT rely solely on note() for pitch — they need s()
    if (!parsed.hasSamplePattern && parsed.hasPitchedPattern) {
      warnings.push({
        type: 'instrument_type_mismatch',
        message: `User requested drum/percussion "${expectedInstrument}" but code uses only note(). Drums should use s() with sample tokens.`,
        normalizedValue: `s("${expectedProfile.validStrudelAliases[0]}")`,
      });
    }

    // Check that the detected alias matches expected aliases
    if (detectedInstrument && detectedInstrument !== expectedInstrument) {
      const validAliases = expectedProfile.validStrudelAliases;
      const suggestAlias = validAliases[0];

      // Build a suggested patch by replacing the wrong alias
      let suggestedPatch = parsed.rawCode;
      if (detectedAlias) {
        suggestedPatch = parsed.rawCode.replace(
          new RegExp(`\\b${detectedAlias}\\b`, 'g'),
          suggestAlias,
        );
      }

      errors.push({
        type: 'instrument_mismatch',
        message: `User requested "${expectedInstrument}" but AI generated "${detectedInstrument}" (alias: "${detectedAlias}"). Expected one of: [${validAliases.join(', ')}].`,
        suggestedPatch,
      });
    }

    // Also check if no recognizable drum alias is present at all
    if (parsed.hasSamplePattern && parsed.sounds.length > 0) {
      const validAliases = expectedProfile.validStrudelAliases.map((a) => a.toLowerCase());
      const hasMatch = parsed.sounds.some((s) =>
        validAliases.some((a) => s.toLowerCase().includes(a.toLowerCase()))
      );
      if (!hasMatch && !detectedInstrument) {
        errors.push({
          type: 'instrument_mismatch',
          message: `Code uses s("${parsed.sounds.join(', ')}") but none match expected "${expectedInstrument}" aliases: [${validAliases.join(', ')}].`,
          suggestedPatch: `s("${expectedProfile.validStrudelAliases[0]}")`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedInstrument,
    expectedInstrument,
  };
}
