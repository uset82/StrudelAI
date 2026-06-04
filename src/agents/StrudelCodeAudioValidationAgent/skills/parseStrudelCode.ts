/**
 * Skill 1 — parseStrudelCode
 *
 * Extracts musical intent from raw Strudel code strings.
 * Handles: note(), s(), bank(), n(), scale(), trans(), tempo(), and FX chains.
 */

import type { ParsedStrudelIntent } from '../types';

// ─── Mini-notation token splitter ─────────────────────────────────────────────

/**
 * Strips mini-notation control characters and splits into token atoms.
 * Handles: *N repeats, [groups], <alternations>, rest (~), silence (_), etc.
 */
function splitMiniNotation(pattern: string): string[] {
  // Remove grouping / alternation brackets
  const cleaned = pattern
    .replace(/[\[\]<>()]/g, ' ')
    .replace(/[,!]/g, ' ')
    .trim();

  const tokens: string[] = [];
  for (const part of cleaned.split(/\s+/)) {
    if (!part) continue;
    // Handle repeat: note*N → take note part only
    const repeatMatch = part.match(/^([^\s*]+)\*\d+$/);
    if (repeatMatch) {
      tokens.push(repeatMatch[1]);
    } else if (/^\d+$/.test(part)) {
      tokens.push(part); // numeric index
    } else if (part !== '~' && part !== '_') {
      tokens.push(part);
    }
  }
  return tokens;
}

// ─── Extractor helpers ─────────────────────────────────────────────────────────

/**
 * Extract all strings from calls to a given Strudel function.
 * Handles: note("c d e"), s("bd sd hh"), bank("RolandTR909"), scale("C:minor")
 */
function extractStringArgs(code: string, fnName: string): string[] {
  const results: string[] = [];
  // Match function calls at start of line, after dot (chained), after (, after comma, or after whitespace
  // This handles: note(...), .note(...), stack(s(...), s(...))
  const quoteChars = "'\"`";
  const pattern = new RegExp(
    '(?:^|[.,(\\s])' + fnName + '\\s*\\(\\s*([' + quoteChars + '])([\\s\\S]*?)\\1\\s*\\)',
    'gi'
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    results.push(match[2]);
    // Reset lastIndex by 1 to handle overlapping matches at the same position
    pattern.lastIndex = Math.max(0, pattern.lastIndex - 1);
  }
  return results;
}

/**
 * Extract numeric argument from a function call.
 * Handles: .tempo(120), .trans(2), .speed(0.5)
 */
function extractNumericArg(code: string, fnName: string): number | null {
  const pattern = new RegExp(
    `(?:^|\\.)${fnName}\\s*\\(\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)`,
    'i'
  );
  const match = code.match(pattern);
  return match ? parseFloat(match[1]) : null;
}

// ─── Note normalization ────────────────────────────────────────────────────────

const NOTE_NAMES = new Set([
  'c', 'c#', 'db', 'd', 'd#', 'eb', 'e', 'f', 'f#', 'gb',
  'g', 'g#', 'ab', 'a', 'a#', 'bb', 'b',
]);

/**
 * Normalizes a raw note token to a lowercase pitch class + optional octave.
 * e.g. "C4" → "c4", "Eb5" → "eb5", "m('c d eb f')" is not processed here.
 */
function normalizeNote(token: string): string {
  return token.toLowerCase();
}

/**
 * Given a list of raw tokens from a note() pattern, filter to valid note names.
 */
function filterNotes(tokens: string[]): string[] {
  return tokens
    .map(normalizeNote)
    .filter((t) => {
      // Accept: c, c4, c#4, db5, etc.
      const pitchClass = t.replace(/\d+$/, '');
      return NOTE_NAMES.has(pitchClass);
    });
}

// ─── FX chain detector ────────────────────────────────────────────────────────

const KNOWN_FX = [
  'reverb', 'room', 'delay', 'echo',
  'lpf', 'hpf', 'bpf',
  'distort', 'crush', 'coarse',
  'gain', 'vol',
  'pan', 'panning',
  'attack', 'att', 'decay', 'sustain', 'release',
  'vibrato', 'tremolo',
  'vowel',
  'speed', 'fast', 'slow',
];

function extractFx(code: string): string[] {
  const found: string[] = [];
  for (const fx of KNOWN_FX) {
    const re = new RegExp(`\\.${fx}\\s*\\(`, 'i');
    if (re.test(code)) found.push(fx);
  }
  return found;
}

// ─── Main parser ───────────────────────────────────────────────────────────────

/**
 * Parse a raw Strudel code string and extract musical intent.
 *
 * @example
 * parseStrudelCode("note('c d eb f').s('cello').reverb(0.3)")
 * // → { notes: ['c','d','eb','f'], sounds: ['cello'], ... }
 */
export function parseStrudelCode(code: string): ParsedStrudelIntent {
  // ── Note extraction ──────────────────────────────────────────────────────
  const notePatterns = extractStringArgs(code, 'note');
  // Also handle m() shorthand (mini notation wrapper)
  const mPatterns = extractStringArgs(code, 'm');

  const allNoteTokens: string[] = [];
  for (const pattern of [...notePatterns, ...mPatterns]) {
    allNoteTokens.push(...splitMiniNotation(pattern));
  }
  const notes = filterNotes(allNoteTokens);

  // ── Sound / sample extraction ────────────────────────────────────────────
  const soundPatterns = extractStringArgs(code, 's');
  const soundAlso = extractStringArgs(code, 'sound');
  const soundAlso2 = extractStringArgs(code, 'sample');

  const allSoundTokens: string[] = [];
  for (const pattern of [...soundPatterns, ...soundAlso, ...soundAlso2]) {
    allSoundTokens.push(...splitMiniNotation(pattern));
  }
  // Filter out clearly non-sample tokens (pure numeric strings handled separately)
  const sounds = allSoundTokens.filter(
    (t) => !/^\d+$/.test(t) && t.length > 0
  );

  // ── Bank extraction ──────────────────────────────────────────────────────
  const bankArgs = extractStringArgs(code, 'bank');
  const bank = bankArgs[0] ?? null;

  // ── N-index extraction ───────────────────────────────────────────────────
  const nPatterns = extractStringArgs(code, 'n');
  const nTokens: number[] = [];
  for (const pattern of nPatterns) {
    for (const token of splitMiniNotation(pattern)) {
      const n = parseInt(token, 10);
      if (!isNaN(n)) nTokens.push(n);
    }
  }

  // ── Scale extraction ─────────────────────────────────────────────────────
  const scaleArgs = extractStringArgs(code, 'scale');
  const scale = scaleArgs[0] ?? null;

  // ── Trans extraction ─────────────────────────────────────────────────────
  const trans = extractNumericArg(code, 'trans');

  // ── BPM / tempo extraction ───────────────────────────────────────────────
  const bpm = extractNumericArg(code, 'tempo') ?? extractNumericArg(code, 'setcpm');

  // ── FX chain ─────────────────────────────────────────────────────────────
  const fx = extractFx(code);

  // ── Structural flags ─────────────────────────────────────────────────────
  const hasPitchedPattern = /(?:^|[.\s(])note\s*\(/.test(code);
  const hasSamplePattern = /(?:^|[.\s(])(?:s|sound|sample)\s*\(/.test(code);

  return {
    notes,
    sounds,
    bank,
    nIndexes: nTokens,
    scale,
    trans,
    bpm,
    fx,
    rawCode: code,
    hasPitchedPattern,
    hasSamplePattern,
  };
}
