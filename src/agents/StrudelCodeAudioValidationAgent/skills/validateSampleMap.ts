/**
 * Skill 5 — validateSampleMap
 *
 * Validates that sample names, bank names, and n() indexes
 * in a parsed Strudel intent are within known valid ranges.
 *
 * - Unknown sample tokens → error
 * - Unknown bank name → error
 * - n() index out of range for the bank → warning + normalized indexes
 */

import type { ParsedStrudelIntent, CorrectionReport, ValidationWarning } from '../types';

// ─── Sample Bank Registry ─────────────────────────────────────────────────────

/**
 * Known banks and their sample slot counts per token.
 * e.g. RolandTR909.bd has 4 samples (n() index 0–3).
 */
interface BankDefinition {
  /** Display name */
  label: string;
  /** Per-sample-token slot count */
  samples: Record<string, number>;
}

const SAMPLE_BANKS: Record<string, BankDefinition> = {
  RolandTR909: {
    label: 'Roland TR-909',
    samples: {
      bd: 4,
      sd: 4,
      hh: 4,
      oh: 2,
      cp: 2,
      rd: 2,
      rim: 2,
      cb: 1,
      perc: 2,
    },
  },
  RolandTR808: {
    label: 'Roland TR-808',
    samples: {
      bd: 4,
      sd: 4,
      hh: 4,
      oh: 2,
      cp: 2,
      mt: 2,
      lt: 2,
      ht: 2,
      cb: 1,
      clap: 2,
      clave: 1,
    },
  },
  // Default global sample tokens (no bank prefix needed)
  default: {
    label: 'Global Default',
    samples: {
      bd: 6,
      sd: 6,
      sn: 6,
      hh: 6,
      oh: 4,
      cp: 4,
      clap: 4,
      rim: 4,
      kick: 4,
      snare: 4,
      hat: 4,
      hihat: 4,
      // Pitched synth waveforms (always available)
      sine: 999,
      square: 999,
      sawtooth: 999,
      triangle: 999,
      supersaw: 999,
      // Piano
      piano: 1,
      // Misc
      pink: 999,
    },
  },
};

// ─── Known global sample tokens (flat list) ────────────────────────────────────

const GLOBAL_SAMPLE_TOKENS = new Set([
  ...Object.keys(SAMPLE_BANKS.default.samples),
  // Also accept fully qualified bank_token patterns like RolandTR909_bd
  'RolandTR909_bd', 'RolandTR909_sd', 'RolandTR909_hh', 'RolandTR909_oh',
  'RolandTR909_cp', 'RolandTR909_rd', 'RolandTR909_rim',
  'RolandTR808_bd', 'RolandTR808_sd', 'RolandTR808_hh', 'RolandTR808_oh',
  'RolandTR808_cp', 'RolandTR808_mt', 'RolandTR808_lt', 'RolandTR808_ht',
  'RolandTR808_cb', 'RolandTR808_clap',
  // Pitched instrument names used in s() — always valid
  'cello', 'piano', 'guitar', 'violin', 'bass', 'lead', 'pad', 'synth',
  'flute', 'trumpet', 'organ', 'harp', 'strings',
  // Misc
  '~', '_',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a sound token against a bank to find the slot count.
 * Handles both "bd" (with bank="RolandTR909") and "RolandTR909_bd".
 */
function resolveSlotCount(token: string, bankName: string | null): number | null {
  const lower = token.toLowerCase();

  // Handle fully qualified tokens: RolandTR909_bd → use bank definition
  const prefixMatch = token.match(/^(Roland(?:TR909|TR808))_(.+)$/i);
  if (prefixMatch) {
    const bankKey = prefixMatch[1];
    const sampleKey = prefixMatch[2].toLowerCase();
    const bankDef = SAMPLE_BANKS[bankKey];
    return bankDef?.samples[sampleKey] ?? null;
  }

  // Use explicit bank if provided
  if (bankName) {
    const bankDef = SAMPLE_BANKS[bankName];
    if (bankDef) {
      return bankDef.samples[lower] ?? null;
    }
  }

  // Fall back to global defaults
  return SAMPLE_BANKS.default.samples[lower] ?? null;
}

/**
 * Normalize out-of-range n() indexes by wrapping them.
 */
function normalizeIndexes(indexes: number[], slotCount: number): number[] {
  return indexes.map((i) => ((i % slotCount) + slotCount) % slotCount);
}

// ─── Main skill ───────────────────────────────────────────────────────────────

export interface SampleMapValidationResult {
  valid: boolean;
  errors: CorrectionReport[];
  warnings: ValidationWarning[];
}

/**
 * Validate sample tokens, bank names, and n() indexes.
 */
export function validateSampleMap(parsed: ParsedStrudelIntent): SampleMapValidationResult {
  const errors: CorrectionReport[] = [];
  const warnings: ValidationWarning[] = [];

  // ── 1. Validate bank name ─────────────────────────────────────────────────
  if (parsed.bank !== null) {
    if (!SAMPLE_BANKS[parsed.bank]) {
      errors.push({
        type: 'bank_not_found',
        message: `Bank "${parsed.bank}" is not recognized. Known banks: ${Object.keys(SAMPLE_BANKS).filter(k => k !== 'default').join(', ')}.`,
        suggestedPatch: `Use bank("RolandTR909") or bank("RolandTR808"), or remove the bank() call.`,
      });
    }
  }

  // ── 2. Validate sample tokens ─────────────────────────────────────────────
  for (const sound of parsed.sounds) {
    // Skip waveform names (they are always valid as s() arguments)
    if (/^(sine|square|triangle|sawtooth|supersaw|piano|pink)$/i.test(sound)) {
      continue;
    }
    if (!GLOBAL_SAMPLE_TOKENS.has(sound) && !GLOBAL_SAMPLE_TOKENS.has(sound.toLowerCase())) {
      errors.push({
        type: 'sample_not_found',
        message: `Sample token "${sound}" is not in the known sample map. It may be unavailable in this runtime.`,
        suggestedPatch: `Use a known token: bd, sd, hh, cp, oh, rim, or a prefixed RolandTR909_bd style token.`,
      });
    }
  }

  // ── 3. Validate n() indexes ────────────────────────────────────────────────
  if (parsed.nIndexes.length > 0) {
    for (const sound of parsed.sounds) {
      const slotCount = resolveSlotCount(sound, parsed.bank);
      if (slotCount === null) continue; // Unknown sample — already reported above

      const outOfRange = parsed.nIndexes.filter((i) => i < 0 || i >= slotCount);
      if (outOfRange.length > 0) {
        const normalized = normalizeIndexes(parsed.nIndexes, slotCount);
        warnings.push({
          type: 'index_out_of_range',
          message: `n() indexes [${outOfRange.join(', ')}] may be out of range for "${sound}" (max ${slotCount - 1}). They will wrap around.`,
          normalizedValue: normalized,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/** Export for use in tests */
export { SAMPLE_BANKS, GLOBAL_SAMPLE_TOKENS };
