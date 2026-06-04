/**
 * Instrument Registry — StrudelCodeAudioValidationAgent
 *
 * Maps instrument names to their validation profiles:
 * type, note range, frequency thresholds, valid Strudel aliases, and intent keywords.
 */

import type { InstrumentProfile } from '../types';

// ─── Registry Data ─────────────────────────────────────────────────────────────

const INSTRUMENT_REGISTRY: InstrumentProfile[] = [
  // ── Pitched instruments ────────────────────────────────────────────────────
  {
    name: 'piano',
    label: 'Piano',
    type: 'pitched',
    allowedNoteRange: { min: 'A0', max: 'C8' },
    validStrudelAliases: ['piano'],
    validationMethod: 'pitch',
    intentKeywords: ['piano', 'keys', 'keyboard', 'grand piano', 'upright piano'],
  },
  {
    name: 'cello',
    label: 'Cello',
    type: 'pitched',
    allowedNoteRange: { min: 'C2', max: 'C7' },
    validStrudelAliases: ['cello'],
    validationMethod: 'pitch',
    intentKeywords: ['cello', 'celli', 'string bass'],
  },
  {
    name: 'guitar',
    label: 'Guitar',
    type: 'pitched',
    allowedNoteRange: { min: 'E2', max: 'E6' },
    validStrudelAliases: ['guitar', 'sawtooth', 'square'],
    validationMethod: 'pitch',
    intentKeywords: ['guitar', 'electric guitar', 'acoustic guitar', 'riff', 'chord guitar'],
  },
  {
    name: 'synth',
    label: 'Synth',
    type: 'pitched',
    allowedNoteRange: { min: 'C1', max: 'C8' },
    validStrudelAliases: ['sawtooth', 'square', 'triangle', 'sine', 'supersaw'],
    validationMethod: 'pitch',
    intentKeywords: ['synth', 'synthesizer', 'lead synth', 'poly synth', 'analog'],
  },
  {
    name: 'bass',
    label: 'Bass',
    type: 'pitched',
    allowedNoteRange: { min: 'B0', max: 'C4' },
    validStrudelAliases: ['sawtooth', 'triangle', 'sine', 'square'],
    validationMethod: 'pitch',
    intentKeywords: ['bass', 'bassline', 'bass guitar', 'sub bass', '808 bass', 'low end'],
  },
  {
    name: 'lead',
    label: 'Lead',
    type: 'pitched',
    allowedNoteRange: { min: 'C3', max: 'C7' },
    validStrudelAliases: ['sawtooth', 'square', 'triangle', 'sine', 'supersaw'],
    validationMethod: 'pitch',
    intentKeywords: ['lead', 'melody lead', 'solo', 'hook', 'arp lead'],
  },
  {
    name: 'pad',
    label: 'Pad',
    type: 'pitched',
    allowedNoteRange: { min: 'C2', max: 'C7' },
    validStrudelAliases: ['sine', 'triangle', 'sawtooth', 'supersaw'],
    validationMethod: 'pitch',
    intentKeywords: ['pad', 'string pad', 'atmosphere', 'ambient pad', 'lush', 'warm pad'],
  },

  // ── Drum / Percussion instruments ──────────────────────────────────────────
  {
    name: 'kick',
    label: 'Kick Drum',
    type: 'drum',
    expectedFrequencyProfile: {
      minBassEnergy: 0.55,
      expectsOnset: true,
    },
    validStrudelAliases: ['bd', 'RolandTR909_bd', 'RolandTR808_bd', 'kick'],
    validationMethod: 'spectrum',
    intentKeywords: ['kick', 'kick drum', 'bass drum', 'bd', '808 kick', '909 kick', 'four on the floor'],
  },
  {
    name: 'snare',
    label: 'Snare Drum',
    type: 'drum',
    expectedFrequencyProfile: {
      minMidEnergy: 0.35,
      expectsOnset: true,
    },
    validStrudelAliases: ['sd', 'sn', 'RolandTR909_sd', 'RolandTR808_sd', 'snare'],
    validationMethod: 'transient',
    intentKeywords: ['snare', 'snare drum', 'sd', '909 snare', '808 snare', 'backbeat'],
  },
  {
    name: 'clap',
    label: 'Clap',
    type: 'drum',
    expectedFrequencyProfile: {
      minHighEnergy: 0.4,
      expectsOnset: true,
    },
    validStrudelAliases: ['cp', 'clap', 'RolandTR909_cp', 'RolandTR808_cp'],
    validationMethod: 'transient',
    intentKeywords: ['clap', 'handclap', 'cp', '909 clap'],
  },
  {
    name: 'closed-hihat',
    label: 'Closed Hi-hat',
    type: 'drum',
    expectedFrequencyProfile: {
      minHighEnergy: 0.65,
      expectsOnset: true,
    },
    validStrudelAliases: ['hh', 'RolandTR909_hh', 'RolandTR808_hh', 'hat', 'hihat'],
    validationMethod: 'spectrum',
    intentKeywords: ['hi-hat', 'hihat', 'closed hat', 'hh', 'tick', 'closed hi-hat'],
  },
  {
    name: 'open-hihat',
    label: 'Open Hi-hat',
    type: 'drum',
    expectedFrequencyProfile: {
      minHighEnergy: 0.55,
      expectsOnset: false,
    },
    validStrudelAliases: ['oh', 'RolandTR909_oh', 'RolandTR808_oh'],
    validationMethod: 'spectrum',
    intentKeywords: ['open hi-hat', 'open hat', 'oh', 'open hihat'],
  },
  {
    name: 'tom',
    label: 'Tom',
    type: 'drum',
    expectedFrequencyProfile: {
      minMidEnergy: 0.3,
      minBassEnergy: 0.2,
      expectsOnset: true,
    },
    validStrudelAliases: ['tom', 'mt', 'lt', 'ht'],
    validationMethod: 'transient',
    intentKeywords: ['tom', 'floor tom', 'rack tom', 'hi tom', 'low tom'],
  },
  {
    name: 'ride',
    label: 'Ride Cymbal',
    type: 'drum',
    expectedFrequencyProfile: {
      minHighEnergy: 0.5,
      expectsOnset: true,
    },
    validStrudelAliases: ['rd', 'ride', 'RolandTR909_rd'],
    validationMethod: 'spectrum',
    intentKeywords: ['ride', 'ride cymbal', 'rd'],
  },
  {
    name: 'crash',
    label: 'Crash Cymbal',
    type: 'drum',
    expectedFrequencyProfile: {
      minHighEnergy: 0.6,
      expectsOnset: true,
    },
    validStrudelAliases: ['crash', 'cr'],
    validationMethod: 'spectrum',
    intentKeywords: ['crash', 'crash cymbal', 'cymbal'],
  },
  {
    name: 'rim',
    label: 'Rimshot',
    type: 'drum',
    expectedFrequencyProfile: {
      minMidEnergy: 0.4,
      expectsOnset: true,
    },
    validStrudelAliases: ['rim', 'RolandTR909_rim'],
    validationMethod: 'transient',
    intentKeywords: ['rim', 'rimshot', 'rim shot'],
  },
  {
    name: 'percussion',
    label: 'Percussion',
    type: 'drum',
    expectedFrequencyProfile: {
      expectsOnset: true,
    },
    validStrudelAliases: ['perc', 'cb', 'clave', 'shaker', 'tamb'],
    validationMethod: 'transient',
    intentKeywords: ['percussion', 'perc', 'cowbell', 'clave', 'shaker', 'tambourine'],
  },

  // ── FX / Noise / Texture ────────────────────────────────────────────────────
  {
    name: 'pink-noise',
    label: 'Pink Noise / Sweep',
    type: 'noise',
    validStrudelAliases: ['pink'],
    validationMethod: 'spectrum',
    intentKeywords: ['noise', 'pink noise', 'sweep', 'riser', 'white noise', 'texture noise'],
  },
];

// ─── Lookup Index ──────────────────────────────────────────────────────────────

const BY_NAME = new Map<string, InstrumentProfile>(
  INSTRUMENT_REGISTRY.map((p) => [p.name.toLowerCase(), p])
);

const BY_ALIAS = new Map<string, InstrumentProfile>();
for (const profile of INSTRUMENT_REGISTRY) {
  for (const alias of profile.validStrudelAliases) {
    if (!BY_ALIAS.has(alias.toLowerCase())) {
      BY_ALIAS.set(alias.toLowerCase(), profile);
    }
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up an instrument profile by its canonical name (e.g. "kick", "cello").
 * Returns null if not found.
 */
export function getInstrumentProfile(name: string): InstrumentProfile | null {
  return BY_NAME.get(name.toLowerCase()) ?? null;
}

/**
 * Look up the instrument profile that owns a given Strudel sample alias
 * (e.g. "bd" → kick, "sd" → snare, "hh" → closed-hihat).
 */
export function getProfileByAlias(alias: string): InstrumentProfile | null {
  return BY_ALIAS.get(alias.toLowerCase()) ?? null;
}

/**
 * Find the best matching instrument profile given a natural language prompt fragment
 * (e.g. "hard techno kick" → kick profile).
 */
export function findInstrumentFromIntent(intent: string): InstrumentProfile | null {
  const lower = intent.toLowerCase();
  let best: InstrumentProfile | null = null;
  let bestScore = 0;

  for (const profile of INSTRUMENT_REGISTRY) {
    let score = 0;
    for (const kw of profile.intentKeywords) {
      if (lower.includes(kw.toLowerCase())) {
        // Longer keyword matches score higher
        score += kw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = profile;
    }
  }
  return best;
}

/**
 * Returns all profiles of a given kind.
 */
export function getProfilesByKind(kind: InstrumentProfile['type']): InstrumentProfile[] {
  return INSTRUMENT_REGISTRY.filter((p) => p.type === kind);
}

export { INSTRUMENT_REGISTRY };
