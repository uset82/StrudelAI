/**
 * Skill 2 — validateMusicalSyntax
 *
 * Verifies that a Strudel code string is syntactically valid:
 * - Uses only supported Strudel functions
 * - Has balanced parentheses/brackets/quotes
 * - Does not use unsupported helpers (bank, slider, analyze, cpm, etc.)
 * - Mini-notation structure is well-formed
 */

import type { CorrectionReport, ValidationWarning } from '../types';

// ─── Supported top-level / chainable functions ─────────────────────────────────

const SUPPORTED_TOP_LEVEL = new Set([
  'note', 's', 'sound', 'sample', 'stack', 'seq', 'cat', 'silence', 'm',
]);

// These are defined for future use in auto-completion and deep validation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SUPPORTED_CHAINABLE = new Set([
  // Sample / note control
  'n', 'bank', 'speed', 'begin', 'end', 'unit',
  // Envelope
  'attack', 'att', 'decay', 'sustain', 'release', 'adsr',
  // Filters
  'lpf', 'hpf', 'bpf', 'resonance', 'cutoff',
  // Distortion / shaping
  'distort', 'crush', 'coarse', 'shape',
  // Mix / levels
  'gain', 'vol', 'pan', 'panning',
  // Space / FX
  'room', 'reverb', 'delay', 'echo', 'delaytime', 'delayfeedback',
  // Pitch / tuning
  'tune', 'trans', 'freq',
  // Rhythm
  'tempo', 'fast', 'slow', 'every', 'sometimes', 'struct', 'euclid',
  // Pattern ops
  'rev', 'palindrome', 'jux', 'layer', 'off', 'when',
  // Articulation
  'staccato', 'legato', 'portamento',
  // Vowel formant
  'vowel',
  // Scale
  'scale',
  // Misc valid
  'sine', 'range', 'segment',
]);

// ─── Unsupported helpers (hard-reject) ────────────────────────────────────────

const UNSUPPORTED_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\.bank\s*\(/i, name: '.bank()' },
  { pattern: /\.slider\s*\(/i, name: '.slider()' },
  { pattern: /\._pianoroll\s*\(/i, name: '._pianoroll()' },
  { pattern: /\.analyze\s*\(/i, name: '.analyze()' },
  { pattern: /\banalyze\s*\(/i, name: 'analyze()' },
  { pattern: /\bsetcpm\s*\(/i, name: 'setcpm()' },
  { pattern: /\.cpm\s*\(/i, name: '.cpm()' },
  { pattern: /\bcpm\s*\(/i, name: 'cpm()' },
];

// ─── Unsafe time-factor values ─────────────────────────────────────────────────

/**
 * fast() and slow() with arbitrary large/unusual numeric values can crash the engine.
 * Allow only: 0.5, 1, 2, 4, 8, 16
 */
const UNSAFE_TIME_FACTOR = /\.(?:fast|slow)\(\s*(?!0\.5\s*\)|1\s*\)|2\s*\)|4\s*\)|8\s*\)|16\s*\))(-?\d+(?:\.\d+)?)\s*\)/i;

// ─── Delimiter balance checker ─────────────────────────────────────────────────

function hasBalancedDelimiters(code: string): { ok: boolean; detail: string } {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const openers = new Set(Object.values(pairs));
  const stack: string[] = [];
  let quote: string | null = null;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : '';
    if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\') {
      quote = quote === ch ? null : quote || ch;
      continue;
    }
    if (quote) continue;
    if (openers.has(ch)) { stack.push(ch); continue; }
    if (pairs[ch]) {
      if (stack.pop() !== pairs[ch]) {
        return { ok: false, detail: `Unexpected '${ch}' — no matching opener.` };
      }
    }
  }

  if (quote) return { ok: false, detail: `Unclosed string literal: ${quote}` };
  if (stack.length > 0) return { ok: false, detail: `Unclosed '${stack[stack.length - 1]}'.` };
  return { ok: true, detail: '' };
}

// ─── Mini-notation bracket checker ────────────────────────────────────────────

function hasBalancedMiniNotation(code: string): { ok: boolean; detail: string } {
  // Check that < > are balanced inside string literals
  const strings = code.matchAll(/(['"`])([\s\S]*?)\1/g);
  for (const match of strings) {
    const content = match[2];
    let depth = 0;
    for (const ch of content) {
      if (ch === '<') depth++;
      if (ch === '>') depth--;
      if (depth < 0) return { ok: false, detail: 'Unmatched > in mini-notation pattern.' };
    }
    if (depth !== 0) return { ok: false, detail: 'Unclosed < in mini-notation pattern.' };
  }
  return { ok: true, detail: '' };
}

// ─── Vowel value checker ──────────────────────────────────────────────────────

function hasValidVowels(code: string): { ok: boolean; detail: string } {
  const matches = code.matchAll(/\.vowel\(\s*(['"])(.*?)\1\s*\)/gi);
  for (const match of matches) {
    if (!/^[aeiou]$/i.test(match[2].trim())) {
      return {
        ok: false,
        detail: `Invalid vowel value "${match[2]}". Must be one of: a, e, i, o, u.`,
      };
    }
  }
  return { ok: true, detail: '' };
}

// ─── Safe track start ─────────────────────────────────────────────────────────

const SAFE_START = /^(stack|note|s|sound|sample|seq|cat|silence|m)\s*\(/i;

// ─── Main skill ───────────────────────────────────────────────────────────────

export interface SyntaxValidationResult {
  valid: boolean;
  errors: CorrectionReport[];
  warnings: ValidationWarning[];
}


/**
 * Validates the syntactic correctness of a Strudel code string.
 *
 * @param code - The Strudel code to validate
 * @returns SyntaxValidationResult with errors and warnings
 */
export function validateMusicalSyntax(code: string): SyntaxValidationResult {
  const errors: CorrectionReport[] = [];
  const warnings: ValidationWarning[] = [];
  const trimmed = code.trim();

  // Empty or silence is always valid
  if (!trimmed || trimmed === 'silence') {
    return { valid: true, errors: [], warnings: [] };
  }

  // 1. Must start with a supported top-level function
  if (!SAFE_START.test(trimmed)) {
    errors.push({
      type: 'syntax_error',
      message: `Code must start with a supported function: ${[...SUPPORTED_TOP_LEVEL].join(', ')}.`,
      // Do not provide a suggestedPatch if we cannot programmatically guess how to wrap it safely
    });
  }

  // 2. Balanced delimiters
  const balanced = hasBalancedDelimiters(trimmed);
  if (!balanced.ok) {
    errors.push({
      type: 'syntax_error',
      message: `Unbalanced delimiters: ${balanced.detail}`,
    });
  }

  // 3. Balanced mini-notation
  const miniBalanced = hasBalancedMiniNotation(trimmed);
  if (!miniBalanced.ok) {
    errors.push({
      type: 'syntax_error',
      message: `Mini-notation error: ${miniBalanced.detail}`,
    });
  }

  // 4. Unsupported methods
  for (const { pattern, name } of UNSUPPORTED_PATTERNS) {
    if (pattern.test(trimmed)) {
      let patched = trimmed;
      if (name === '.bank()') {
        patched = patched.replace(/\.bank\([^)]*\)/g, '');
      } else if (name === '.slider()') {
        patched = patched.replace(/\.slider\([^)]*\)/g, '');
      } else if (name === '._pianoroll()') {
        patched = patched.replace(/\._pianoroll\([^)]*\)/g, '');
      } else if (name === '.analyze()') {
        patched = patched.replace(/\.analyze\([^)]*\)/gi, '');
      } else if (name === 'analyze()') {
        patched = patched.replace(/\banalyze\([^)]*\)/gi, '');
      } else if (name === 'setcpm()') {
        patched = patched.replace(/\bsetcpm\([^)]*\)/gi, '');
      } else if (name === '.cpm()') {
        patched = patched.replace(/\.cpm\([^)]*\)/gi, '');
      } else if (name === 'cpm()') {
        patched = patched.replace(/\bcpm\([^)]*\)/gi, '');
      }

      errors.push({
        type: 'unsupported_method',
        message: `Unsupported Strudel method: ${name}. This method is not available in the current runtime.`,
        suggestedPatch: patched !== trimmed ? patched : undefined,
      });
    }
  }

  // 5. Unsafe time factors
  const timeMatch = trimmed.match(UNSAFE_TIME_FACTOR);
  if (timeMatch) {
    warnings.push({
      type: 'unsafe_time_factor',
      message: `Unusual time factor value: ${timeMatch[1]}. Use standard values: 0.5, 1, 2, 4, 8, or 16.`,
      normalizedValue: timeMatch[1],
    });
  }

  // 6. Valid vowel values
  const vowelCheck = hasValidVowels(trimmed);
  if (!vowelCheck.ok) {
    const patched = trimmed.replace(/\.vowel\(\s*(['"])(.*?)\1\s*\)/gi, '.vowel("a")');
    errors.push({
      type: 'syntax_error',
      message: vowelCheck.detail,
      suggestedPatch: patched !== trimmed ? patched : undefined,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
