/**
 * StrudelCodeAudioValidationAgent — Main Pipeline Orchestrator
 *
 * Wires all 7 skills into a single sequential validation pipeline.
 * Implements Phases 11 and 12 of the task plan.
 *
 * Pipeline order:
 *  1. parseStrudelCode       → ParsedStrudelIntent
 *  2. validateMusicalSyntax  → fail-fast on syntax errors
 *  3. validateNotesAgainstScale → check scale/key alignment
 *  4. validateInstrumentIntent  → check instrument alias correctness
 *  5. validateSampleMap         → check sample banks and n() indexes
 *  6. renderPreviewAndAnalyze   → audio capture + feature extraction (if enabled)
 *  7. compareExpectedVsDetectedAudio → final audio comparison
 *
 * Entry point: validateStrudelCode()
 */

import type { ValidationResult, ValidationContext, CorrectionReport, ValidationWarning, ValidationAnalysis } from './types';
import { parseStrudelCode } from './skills/parseStrudelCode';
import { validateMusicalSyntax } from './skills/validateMusicalSyntax';
import { validateNotesAgainstScale } from './skills/validateNotesAgainstScale';
import { validateInstrumentIntent } from './skills/validateInstrumentIntent';
import { validateSampleMap } from './skills/validateSampleMap';
import { renderPreviewAndAnalyze } from './skills/renderPreviewAndAnalyze';
import { compareExpectedVsDetectedAudio } from './skills/compareExpectedVsDetectedAudio';

// ─── Correction Engine ────────────────────────────────────────────────────────

/**
 * Build a structured rejection response for the AI to act on.
 * The AI should only re-generate the specific parts listed in errors.
 */
export function buildCorrectionReport(
  code: string,
  errors: CorrectionReport[],
  warnings: ValidationWarning[],
  confidence = 0.0,
): ValidationResult {
  return {
    approved: false,
    confidence: parseFloat(confidence.toFixed(2)),
    code,
    errors,
    warnings,
    analysis: null,
  };
}

/**
 * Build a structured approval response.
 */
export function buildApprovalReport(
  code: string,
  analysis: ValidationAnalysis | null,
  warnings: ValidationWarning[],
  confidence = 1.0,
): ValidationResult {
  return {
    approved: true,
    confidence: parseFloat(confidence.toFixed(2)),
    code,
    errors: [],
    warnings,
    analysis,
  };
}

// ─── Main validator ───────────────────────────────────────────────────────────

/**
 * Run the full validation pipeline on a Strudel code string.
 *
 * @param code - The AI-generated Strudel code to validate
 * @param context - Optional validation context (user prompt, target key, flags)
 * @returns ValidationResult — approved or rejected with structured errors
 */
export async function validateStrudelCode(
  code: string,
  context: ValidationContext = {},
): Promise<ValidationResult> {
  const allErrors: CorrectionReport[] = [];
  const allWarnings: ValidationWarning[] = [];

  const {
    userPrompt,
    targetKey,
  } = context;

  // ── Step 1: Parse ──────────────────────────────────────────────────────────
  const parsed = parseStrudelCode(code);

  // ── Step 2: Syntax validation (fail-fast) ──────────────────────────────────
  const syntaxResult = validateMusicalSyntax(code);
  allErrors.push(...syntaxResult.errors);
  allWarnings.push(...syntaxResult.warnings);

  if (!syntaxResult.valid) {
    // Hard fail — don't continue past syntax errors
    const confidence = Math.max(0.0, 1.0 - syntaxResult.errors.length * 0.25);
    return buildCorrectionReport(code, allErrors, allWarnings, confidence);
  }

  // ── Step 3: Scale / note validation ───────────────────────────────────────
  const scaleResult = validateNotesAgainstScale(parsed, targetKey);
  allErrors.push(...scaleResult.errors);
  if (scaleResult.outOfScaleNotes.length > 0) {
    allWarnings.push({
      type: 'scale_hint',
      message: `Scale validation detected ${scaleResult.outOfScaleNotes.length} out-of-scale note(s) in ${scaleResult.detectedScale ?? 'unknown scale'}.`,
    });
  }

  // ── Step 4: Instrument intent validation ───────────────────────────────────
  const intentResult = validateInstrumentIntent(parsed, userPrompt);
  allErrors.push(...intentResult.errors);
  allWarnings.push(...intentResult.warnings);

  // ── Step 5: Sample map validation ─────────────────────────────────────────
  const sampleResult = validateSampleMap(parsed);
  allErrors.push(...sampleResult.errors);
  allWarnings.push(...sampleResult.warnings);

  // If there are hard errors after Steps 3–5, reject here
  if (allErrors.length > 0) {
    const confidence = Math.max(0.1, 1.0 - allErrors.length * 0.15);
    return buildCorrectionReport(code, allErrors, allWarnings, confidence);
  }

  // ── Step 6: Audio rendering + analysis (if enabled) ───────────────────────
  const audioResult = await renderPreviewAndAnalyze(code, parsed);

  // ── Step 7: Expected vs Detected comparison ────────────────────────────────
  const comparisonResult = compareExpectedVsDetectedAudio(parsed, audioResult, userPrompt);
  allErrors.push(...comparisonResult.errors);
  allWarnings.push(...comparisonResult.warnings);

  // ── Final decision ─────────────────────────────────────────────────────────
  if (allErrors.length > 0) {
    return buildCorrectionReport(
      code,
      allErrors,
      allWarnings,
      comparisonResult.confidence,
    );
  }

  return buildApprovalReport(
    code,
    comparisonResult.analysis,
    allWarnings,
    comparisonResult.confidence,
  );
}

// ─── Correction loop helper ───────────────────────────────────────────────────

/**
 * Run the validation pipeline with automatic re-try support.
 * On rejection, calls the provided correctionFn with the correction report
 * and validates the corrected code again. Stops after maxRetries.
 *
 * @param code - Initial Strudel code to validate
 * @param context - Validation context
 * @param correctionFn - Async function that takes a ValidationResult and returns a corrected code string
 * @returns Final ValidationResult (approved or last-rejected)
 */
export async function validateWithCorrectionLoop(
  code: string,
  context: ValidationContext,
  correctionFn: (result: ValidationResult) => Promise<string>,
): Promise<ValidationResult> {
  const maxRetries = context.maxRetries ?? 3;
  let currentCode = code;
  let lastResult: ValidationResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await validateStrudelCode(currentCode, context);
    lastResult = result;

    if (result.approved) {
      return result;
    }

    if (attempt === maxRetries) {
      // Exhausted retries — return last rejection
      break;
    }

    // Call the correction function to get a patched code
    currentCode = await correctionFn(result);
  }

  return lastResult!;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { parseStrudelCode } from './skills/parseStrudelCode';
export { validateMusicalSyntax } from './skills/validateMusicalSyntax';
export { validateNotesAgainstScale } from './skills/validateNotesAgainstScale';
export { validateInstrumentIntent } from './skills/validateInstrumentIntent';
export { validateSampleMap } from './skills/validateSampleMap';
export { renderPreviewAndAnalyze } from './skills/renderPreviewAndAnalyze';
export { compareExpectedVsDetectedAudio } from './skills/compareExpectedVsDetectedAudio';
export { getInstrumentProfile, findInstrumentFromIntent } from './registry/instrumentRegistry';
export type {
  ValidationResult,
  ValidationContext,
  ParsedStrudelIntent,
  CorrectionReport,
  ValidationWarning,
  AudioAnalysisResult,
  InstrumentProfile,
} from './types';
