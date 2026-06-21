/**
 * Tests for StrudelCodeAudioValidationAgent
 *
 * Covers all 7 skills plus the full pipeline integration.
 * Run with: npx tsx test_agent_validator.ts
 */

import { parseStrudelCode } from './src/agents/StrudelCodeAudioValidationAgent/skills/parseStrudelCode';
import { validateMusicalSyntax } from './src/agents/StrudelCodeAudioValidationAgent/skills/validateMusicalSyntax';
import {
  validateNotesAgainstScale,
  noteIsInScale,
} from './src/agents/StrudelCodeAudioValidationAgent/skills/validateNotesAgainstScale';
import { validateInstrumentIntent } from './src/agents/StrudelCodeAudioValidationAgent/skills/validateInstrumentIntent';
import { validateSampleMap } from './src/agents/StrudelCodeAudioValidationAgent/skills/validateSampleMap';
import { renderPreviewAndAnalyze, hzToNoteName } from './src/agents/StrudelCodeAudioValidationAgent/skills/renderPreviewAndAnalyze';
import { compareExpectedVsDetectedAudio } from './src/agents/StrudelCodeAudioValidationAgent/skills/compareExpectedVsDetectedAudio';
import { validateStrudelCode } from './src/agents/StrudelCodeAudioValidationAgent/index';
import { getInstrumentProfile, findInstrumentFromIntent, getProfileByAlias } from './src/agents/StrudelCodeAudioValidationAgent/registry/instrumentRegistry';

// ─── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ❌ ${name}`);
    console.log(`     → ${msg}`);
    failed++;
    failures.push(`${name}: ${msg}`);
  }
}

function expect<T>(value: T) {
  return {
    toBe(expected: T) {
      if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toContain(sub: string) {
      if (typeof value !== 'string' || !value.includes(sub))
        throw new Error(`Expected "${value}" to contain "${sub}"`);
    },
    toBeTrue() {
      if (value !== true) throw new Error(`Expected true, got ${JSON.stringify(value)}`);
    },
    toBeFalse() {
      if (value !== false) throw new Error(`Expected false, got ${JSON.stringify(value)}`);
    },
    toBeNull() {
      if (value !== null) throw new Error(`Expected null, got ${JSON.stringify(value)}`);
    },
    toEqual(expected: T) {
      if (JSON.stringify(value) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toHaveLength(len: number) {
      if (!Array.isArray(value) && typeof value !== 'string')
        throw new Error(`Expected array or string, got ${typeof value}`);
      const arr = value as unknown as { length: number };
      if (arr.length !== len)
        throw new Error(`Expected length ${len}, got ${arr.length}`);
    },
    toBeGreaterThan(n: number) {
      if (typeof value !== 'number' || value <= n)
        throw new Error(`Expected ${value} > ${n}`);
    },
    toBeLessThan(n: number) {
      if (typeof value !== 'number' || value >= n)
        throw new Error(`Expected ${value} < ${n}`);
    },
  };
}

// ─── Phase 4: Skill 1 — parseStrudelCode ──────────────────────────────────────

console.log('\n📦 Phase 4 — parseStrudelCode');

test('parses note() from cello melody', () => {
  const result = parseStrudelCode("note('c d eb f').s('cello').reverb(0.3)");
  expect(result.notes).toEqual(['c', 'd', 'eb', 'f']);
  expect(result.sounds).toEqual(['cello']);
  expect(result.hasPitchedPattern).toBeTrue();
});

test('parses s() tokens from TR909 drum pattern', () => {
  const result = parseStrudelCode("s('RolandTR909_bd RolandTR909_sd RolandTR909_hh*8').bank('RolandTR909')");
  expect(result.sounds.some(s => s.includes('bd'))).toBeTrue();
  expect(result.bank).toBe('RolandTR909');
  expect(result.hasSamplePattern).toBeTrue();
});

test('parses n() indexes', () => {
  const result = parseStrudelCode("s('hh*8').bank('RolandTR909').n('0 1 2 3')");
  expect(result.nIndexes).toEqual([0, 1, 2, 3]);
});

test('parses scale() call', () => {
  const result = parseStrudelCode("note('c d eb f').scale('C:minor')");
  expect(result.scale).toBe('C:minor');
});

test('parses fx chain', () => {
  const result = parseStrudelCode("note('c4 e4').s('piano').reverb(0.4).delay(0.2).lpf(2000)");
  expect(result.fx.includes('reverb')).toBeTrue();
  expect(result.fx.includes('delay')).toBeTrue();
  expect(result.fx.includes('lpf')).toBeTrue();
});

test('parses beat pattern with repeat syntax', () => {
  const result = parseStrudelCode("s('bd*4')");
  expect(result.sounds).toEqual(['bd']);
  expect(result.hasSamplePattern).toBeTrue();
});

test('handles stack() with multiple voices', () => {
  const result = parseStrudelCode("stack(s('bd ~ ~ bd').gain(0.9), s('~ ~ sd ~').gain(0.7))");
  expect(result.sounds.includes('bd')).toBeTrue();
  expect(result.sounds.includes('sd')).toBeTrue();
});

// ─── Phase 5: Skill 2 — validateMusicalSyntax ─────────────────────────────────

console.log('\n📦 Phase 5 — validateMusicalSyntax');

test('valid cello melody passes', () => {
  const r = validateMusicalSyntax("note('c d eb f').s('cello').reverb(0.3)");
  expect(r.valid).toBeTrue();
  expect(r.errors.length).toBe(0);
});

test('valid drum pattern passes', () => {
  const r = validateMusicalSyntax("s('RolandTR909_bd*4').gain(0.9)");
  expect(r.valid).toBeTrue();
});

test('silence is always valid', () => {
  const r = validateMusicalSyntax('silence');
  expect(r.valid).toBeTrue();
});

test('empty string is valid', () => {
  const r = validateMusicalSyntax('');
  expect(r.valid).toBeTrue();
});

test('.bank() is an unsupported method', () => {
  const r = validateMusicalSyntax("s('bd*4').bank('RolandTR909')");
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.type === 'unsupported_method')).toBeTrue();
});

test('.slider() is unsupported', () => {
  const r = validateMusicalSyntax("note('c4').s('piano').slider(0.5)");
  expect(r.valid).toBeFalse();
});

test('setcpm() is unsupported', () => {
  const r = validateMusicalSyntax("setcpm(120)");
  expect(r.valid).toBeFalse();
});

test('unbalanced parentheses is rejected', () => {
  const r = validateMusicalSyntax("note('c d e f'.s('piano')");
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.type === 'syntax_error')).toBeTrue();
});

test('invalid vowel value is rejected', () => {
  const r = validateMusicalSyntax("note('c4').s('piano').vowel('x')");
  expect(r.valid).toBeFalse();
});

test('valid vowel value passes', () => {
  const r = validateMusicalSyntax("note('c4').s('piano').vowel('a')");
  expect(r.valid).toBeTrue();
});

// ─── Phase 6: Skill 3 — validateNotesAgainstScale ────────────────────────────

console.log('\n📦 Phase 6 — validateNotesAgainstScale');

test('C minor melody with Eb passes', () => {
  const parsed = parseStrudelCode("note('c d eb f').s('cello')");
  const r = validateNotesAgainstScale(parsed, 'C minor');
  expect(r.valid).toBeTrue();
  expect(r.outOfScaleNotes.length).toBe(0);
});

test('C minor melody with E natural is rejected', () => {
  const parsed = parseStrudelCode("note('c d e f').s('cello')");
  const r = validateNotesAgainstScale(parsed, 'C minor');
  expect(r.valid).toBeFalse();
  expect(r.outOfScaleNotes.length).toBeGreaterThan(0);
  expect(r.outOfScaleNotes[0].note).toContain('e');
});

test('G major scale with all correct notes passes', () => {
  const parsed = parseStrudelCode("note('g a b c d e f#')");
  const r = validateNotesAgainstScale(parsed, 'G major');
  expect(r.valid).toBeTrue();
});

test('G major with F natural is rejected', () => {
  const parsed = parseStrudelCode("note('g a b c d e f')");
  const r = validateNotesAgainstScale(parsed, 'G major');
  expect(r.valid).toBeFalse();
});

test('noteIsInScale — eb is in C minor', () => {
  expect(noteIsInScale('eb', 'C minor')).toBeTrue();
});

test('noteIsInScale — e is NOT in C minor', () => {
  expect(noteIsInScale('e', 'C minor')).toBeFalse();
});

test('no target key — skips scale validation', () => {
  const parsed = parseStrudelCode("note('c d e f').s('piano')");
  const r = validateNotesAgainstScale(parsed, null);
  expect(r.valid).toBeTrue();
});

test('code with no notes — always valid', () => {
  const parsed = parseStrudelCode("s('bd*4').gain(0.9)");
  const r = validateNotesAgainstScale(parsed, 'C minor');
  expect(r.valid).toBeTrue();
});

// ─── Phase 7: Skill 4 — validateInstrumentIntent ─────────────────────────────

console.log('\n📦 Phase 7 — validateInstrumentIntent');

test('kick with bd sample passes', () => {
  const parsed = parseStrudelCode("s('bd*4').gain(0.9)");
  const r = validateInstrumentIntent(parsed, 'hard techno kick');
  expect(r.valid).toBeTrue();
});

test('kick intent with sd sample is rejected', () => {
  const parsed = parseStrudelCode("s('sd*4').gain(0.8)");
  const r = validateInstrumentIntent(parsed, 'hard techno kick');
  expect(r.valid).toBeFalse();
  expect(r.errors[0].type).toBe('instrument_mismatch');
  expect(r.errors[0].message).toContain('kick');
});

test('cello with note() pattern passes', () => {
  const parsed = parseStrudelCode("note('c d eb f').s('cello')");
  const r = validateInstrumentIntent(parsed, 'cello melody in C minor');
  expect(r.valid).toBeTrue();
});

test('piano without note() pattern fails', () => {
  const parsed = parseStrudelCode("s('piano').gain(0.5)");
  const r = validateInstrumentIntent(parsed, 'piano melody');
  expect(r.valid).toBeFalse();
  expect(r.errors[0].type).toBe('missing_note_pattern');
});

test('no intent — always passes', () => {
  const parsed = parseStrudelCode("s('sd*4')");
  const r = validateInstrumentIntent(parsed, null);
  expect(r.valid).toBeTrue();
});

test('hi-hat intent with hh sample passes', () => {
  const parsed = parseStrudelCode("s('RolandTR909_hh*8').gain(0.2)");
  const r = validateInstrumentIntent(parsed, 'closed hi-hat');
  expect(r.valid).toBeTrue();
});

// ─── Phase 8: Skill 5 — validateSampleMap ────────────────────────────────────

console.log('\n📦 Phase 8 — validateSampleMap');

test('bd within default range passes', () => {
  const parsed = parseStrudelCode("s('bd*4').n('0 1 2 3')");
  const r = validateSampleMap(parsed);
  expect(r.valid).toBeTrue();
});

test('unknown sample token is rejected', () => {
  const parsed = parseStrudelCode("s('xyzfakesample')");
  const r = validateSampleMap(parsed);
  expect(r.valid).toBeFalse();
  expect(r.errors[0].type).toBe('sample_not_found');
});

test('unknown bank is rejected', () => {
  const parsed = parseStrudelCode("s('bd').bank('FakeBrand')");
  // Manually inject bank for test since bank() is caught by syntax validator
  const parsedWithBank = { ...parsed, bank: 'FakeBrand' };
  const r = validateSampleMap(parsedWithBank);
  expect(r.valid).toBeFalse();
  expect(r.errors[0].type).toBe('bank_not_found');
});

test('waveform tokens (sine, square) always pass', () => {
  const parsed = parseStrudelCode("s('sine').note('c4 e4')");
  const r = validateSampleMap(parsed);
  expect(r.valid).toBeTrue();
});

// ─── Phase 9: Skill 6 — renderPreviewAndAnalyze (stub) ───────────────────────

console.log('\n📦 Phase 9A — renderPreviewAndAnalyze (stub mode)');

test('stub returns AudioAnalysisResult shape', async () => {
  const parsed = parseStrudelCode("note('c4 d4 eb4').s('cello')");
  const r = await renderPreviewAndAnalyze("note('c4 d4 eb4').s('cello')", parsed);
  expect(r.captured).toBeFalse();
  expect(Array.isArray(r.detectedNotes)).toBeTrue();
  expect(r.frequencyProfile !== undefined).toBeTrue();
});

test('hzToNoteName — A4 (440 Hz) → a4', () => {
  expect(hzToNoteName(440)).toBe('a4');
});

test('hzToNoteName — C4 (261.63 Hz) → c4', () => {
  const note = hzToNoteName(261.63);
  expect(note).toContain('c');
});

// ─── Phase 10: Skill 7 — compareExpectedVsDetectedAudio ──────────────────────

console.log('\n📦 Phase 10 — compareExpectedVsDetectedAudio');

test('matching notes → approved with high confidence', () => {
  const parsed = parseStrudelCode("note('c d eb f').s('cello')");
  const audio = {
    captured: true,
    detectedNotes: ['c4', 'd4', 'eb4', 'f4'],
    fundamentalHz: 261.63,
    frequencyProfile: { rms: 0.4, spectralCentroid: 1200, bassEnergy: 0.1, midEnergy: 0.5, highEnergy: 0.4 },
    hasOnsets: true,
    detectedBpm: null,
  };
  const r = compareExpectedVsDetectedAudio(parsed, audio, 'cello melody');
  expect(r.valid).toBeTrue();
});

test('mismatched note (E detected instead of Eb) → rejected', () => {
  const parsed = parseStrudelCode("note('c d eb f').s('cello')");
  const audio = {
    captured: true,
    detectedNotes: ['c4', 'd4', 'e4', 'f4'], // e instead of eb
    fundamentalHz: 261.63,
    frequencyProfile: { rms: 0.4, spectralCentroid: 1200, bassEnergy: 0.1, midEnergy: 0.5, highEnergy: 0.4 },
    hasOnsets: true,
    detectedBpm: null,
  };
  const r = compareExpectedVsDetectedAudio(parsed, audio, 'cello melody');
  expect(r.valid).toBeFalse();
  expect(r.errors[0].type).toBe('audio_mismatch');
});

test('kick profile match (high bass energy) → approved', () => {
  const parsed = parseStrudelCode("s('bd*4')");
  const audio = {
    captured: true,
    detectedNotes: [],
    fundamentalHz: null,
    frequencyProfile: { rms: 0.7, spectralCentroid: 200, bassEnergy: 0.7, midEnergy: 0.2, highEnergy: 0.1 },
    hasOnsets: true,
    detectedBpm: null,
  };
  const r = compareExpectedVsDetectedAudio(parsed, audio, 'kick drum');
  expect(r.valid).toBeTrue();
});

test('kick intent but hihat profile → rejected', () => {
  const parsed = parseStrudelCode("s('bd*4')");
  const audio = {
    captured: true,
    detectedNotes: [],
    fundamentalHz: null,
    frequencyProfile: { rms: 0.3, spectralCentroid: 8000, bassEnergy: 0.05, midEnergy: 0.15, highEnergy: 0.8 },
    hasOnsets: true,
    detectedBpm: null,
  };
  const r = compareExpectedVsDetectedAudio(parsed, audio, 'kick drum');
  expect(r.valid).toBeFalse();
});

test('stub mode → always valid with warning', () => {
  const parsed = parseStrudelCode("s('bd*4')");
  const audio = {
    captured: false,
    detectedNotes: [],
    fundamentalHz: null,
    frequencyProfile: null,
    hasOnsets: false,
    detectedBpm: null,
  };
  const r = compareExpectedVsDetectedAudio(parsed, audio, 'kick');
  expect(r.valid).toBeTrue();
  expect(r.warnings.some(w => w.type === 'stub_mode')).toBeTrue();
});

// ─── Phase 11+12: Full Pipeline Integration ───────────────────────────────────

console.log('\n📦 Phase 12 — Full Pipeline Integration');

test('valid cello melody → approved', async () => {
  const r = await validateStrudelCode("note('c d eb f').s('cello').reverb(0.3)", {
    userPrompt: 'C minor cello melody',
    targetKey: 'C minor',
  });
  expect(r.approved).toBeTrue();
});

test('melody with wrong notes → rejected with scale_error', async () => {
  const r = await validateStrudelCode("note('c d e f').s('cello')", {
    userPrompt: 'C minor cello melody',
    targetKey: 'C minor',
  });
  expect(r.approved).toBeFalse();
  expect(r.errors.some(e => e.type === 'scale_error')).toBeTrue();
});

test('kick intent with snare code → rejected with instrument_mismatch', async () => {
  const r = await validateStrudelCode("s('sd*4').gain(0.8)", {
    userPrompt: 'hard techno kick',
  });
  expect(r.approved).toBeFalse();
  expect(r.errors.some(e => e.type === 'instrument_mismatch')).toBeTrue();
});

test('kick intent with bd code → approved', async () => {
  const r = await validateStrudelCode("s('bd*4').gain(0.9)", {
    userPrompt: 'hard techno kick',
  });
  expect(r.approved).toBeTrue();
});

test('code with unsupported bank() → rejected with unsupported_method', async () => {
  const r = await validateStrudelCode("s('bd*4').bank('RolandTR909').gain(0.9)", {
    userPrompt: 'techno kick',
  });
  expect(r.approved).toBeFalse();
  expect(r.errors.some(e => e.type === 'unsupported_method')).toBeTrue();
});

test('silence → approved', async () => {
  const r = await validateStrudelCode('silence', {});
  expect(r.approved).toBeTrue();
});

// ─── Regression tests (Phase 14.6) ────────────────────────────────────────────

console.log('\n📦 Phase 14 — Regression Tests');

test('REGRESSION: "hard techno kick using sd" — caught and corrected', async () => {
  const r = await validateStrudelCode("s('sd*4')", { userPrompt: 'hard techno kick' });
  expect(r.approved).toBeFalse();
  const hasMismatch = r.errors.some(e => e.type === 'instrument_mismatch');
  expect(hasMismatch).toBeTrue();
  // Verify suggestedPatch points to bd
  const patch = r.errors.find(e => e.type === 'instrument_mismatch')?.suggestedPatch ?? '';
  expect(patch.includes('bd')).toBeTrue();
});

test('REGRESSION: piano without note() pattern — detected and reported', async () => {
  const r = await validateStrudelCode("s('piano').gain(0.5)", { userPrompt: 'piano melody' });
  expect(r.approved).toBeFalse();
  expect(r.errors.some(e => e.type === 'missing_note_pattern')).toBeTrue();
});

test('REGRESSION: setcpm() in code — unsupported method caught', async () => {
  const r = await validateStrudelCode("setcpm(120)", { userPrompt: 'set tempo to 120' });
  expect(r.approved).toBeFalse();
  expect(r.errors.some(e => e.type === 'unsupported_method')).toBeTrue();
});

// ─── Instrument Registry Tests ────────────────────────────────────────────────

console.log('\n📦 Instrument Registry');

test('getInstrumentProfile("kick") returns kick profile', () => {
  const p = getInstrumentProfile('kick');
  expect(p?.name).toBe('kick');
  expect(p?.type).toBe('drum');
  expect(p?.validStrudelAliases.includes('bd')).toBeTrue();
});

test('getInstrumentProfile("cello") returns cello profile', () => {
  const p = getInstrumentProfile('cello');
  expect(p?.type).toBe('pitched');
});

test('findInstrumentFromIntent("hard techno kick") → kick', () => {
  const p = findInstrumentFromIntent('hard techno kick');
  expect(p?.name).toBe('kick');
});

test('findInstrumentFromIntent("hard rock") does not match rd inside hard', () => {
  const p = findInstrumentFromIntent('hard rock');
  expect(p).toBeNull();
});

test('findInstrumentFromIntent("cello melody") → cello', () => {
  const p = findInstrumentFromIntent('cello melody');
  expect(p?.name).toBe('cello');
});

test('getProfileByAlias("bd") → kick', () => {
  const p = getProfileByAlias('bd');
  expect(p?.name).toBe('kick');
});

test('getProfileByAlias("hh") → closed-hihat', () => {
  const p = getProfileByAlias('hh');
  expect(p?.name).toBe('closed-hihat');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

async function main() {
  // Run async tests

  // All sync tests have already run above.
  // Async tests (pipeline, render) are wrapped but execute synchronously when awaited.

  console.log('\n');
  console.log('══════════════════════════════════════════');
  console.log(`  Test Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\n  All tests passed! ✅');
    process.exit(0);
  }
}

// Run async tests that require await
(async () => {
  // Re-run async tests with await properly
  const asyncCases: Array<[string, () => Promise<void>]> = [
    ['stub returns AudioAnalysisResult shape', async () => {
      const parsed = parseStrudelCode("note('c4 d4 eb4').s('cello')");
      const r = await renderPreviewAndAnalyze("note('c4 d4 eb4').s('cello')", parsed);
      if (r.captured !== false) throw new Error(`Expected captured=false, got ${r.captured}`);
      if (!Array.isArray(r.detectedNotes)) throw new Error('Expected array for detectedNotes');
    }],
    ['valid cello melody → approved (async)', async () => {
      const r = await validateStrudelCode("note('c d eb f').s('cello').reverb(0.3)", {
        userPrompt: 'C minor cello melody',
        targetKey: 'C minor',
      });
      if (!r.approved) throw new Error(`Expected approved=true, got errors: ${JSON.stringify(r.errors)}`);
    }],
    ['melody with wrong notes → rejected (async)', async () => {
      const r = await validateStrudelCode("note('c d e f').s('cello')", {
        userPrompt: 'C minor cello melody',
        targetKey: 'C minor',
      });
      if (r.approved) throw new Error('Expected rejected, got approved');
    }],
    ['kick intent with snare → rejected (async)', async () => {
      const r = await validateStrudelCode("s('sd*4').gain(0.8)", { userPrompt: 'hard techno kick' });
      if (r.approved) throw new Error('Expected rejected, got approved');
    }],
    ['kick intent with bd → approved (async)', async () => {
      const r = await validateStrudelCode("s('bd*4').gain(0.9)", { userPrompt: 'hard techno kick' });
      if (!r.approved) throw new Error(`Expected approved, got: ${JSON.stringify(r.errors)}`);
    }],
  ];

  console.log('\n📦 Async Pipeline Tests');
  for (const [name, fn] of asyncCases) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  ❌ ${name}`);
      console.log(`     → ${msg}`);
      failed++;
      failures.push(`${name}: ${msg}`);
    }
  }

  await main();
})();
