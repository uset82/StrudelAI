# StrudelCodeAudioValidationAgent — Library Integration Notes

## Overview

This document describes the audio and music analysis libraries integrated into the
`StrudelCodeAudioValidationAgent` and how each one is used within the validation pipeline.

---

## MVP Libraries (Phase 9B)

### 1. `meyda`

- **Purpose**: Browser/Node audio feature extraction
- **npm**: `npm install meyda`
- **Used in**: `skills/renderPreviewAndAnalyze.ts`
- **Features extracted**:
  - `rms` — overall loudness / signal energy
  - `spectralCentroid` — brightness of the sound (Hz)
  - `mfcc` — timbre fingerprint (Mel-Frequency Cepstral Coefficients)
  - Band energy split (bass / mid / high) — approximated from spectral centroid
- **Environment**: Works in both browser and Node.js
- **Usage note**: Meyda requires a `Float32Array` audio buffer. In Phase 9A (stub mode),
  it is not called. In Phase 9B, it is called after capturing audio from Strudel's Web Audio graph.

```typescript
import Meyda from 'meyda';
const features = Meyda.extract(['rms', 'spectralCentroid', 'mfcc'], buffer);
```

---

### 2. `pitchfinder`

- **Purpose**: Lightweight monophonic pitch detection
- **npm**: `npm install pitchfinder`
- **Used in**: `skills/renderPreviewAndAnalyze.ts`
- **Algorithm**: AMDF (Average Magnitude Difference Function) — good for monophonic signals
- **Instruments validated**: piano, cello, guitar, bass, lead, melody
- **Output**: Fundamental frequency in Hz → converted to note name with octave (e.g. `"c4"`)
- **Environment**: Works in Node.js and browser
- **Usage note**: Best for single-voice instruments. For polyphonic material,
  use `basic-pitch-ts` (Phase 9B advanced).

```typescript
import pitchfinder from 'pitchfinder';
const detect = pitchfinder.AMDF({ sampleRate: 44100 });
const hz = detect(audioBuffer); // returns Hz or null
```

---

## Advanced Libraries (Phase 9B+)

### 3. `@spotify/basic-pitch` (basic-pitch-ts)

- **Purpose**: Polyphonic pitch detection — converts audio to MIDI note events
- **npm**: `npm install @spotify/basic-pitch`
- **Repository**: https://github.com/spotify/basic-pitch-ts
- **Used in**: `skills/renderPreviewAndAnalyze.ts` (Phase 9B step 9B.5)
- **Instruments validated**: All pitched instruments (polyphonic chords, overlapping notes)
- **Environment**: Browser (uses TensorFlow.js WASM backend)
- **Usage note**: Heavier than pitchfinder. Use only when polyphonic detection is needed.
  Falls back to pitchfinder for monophonic tracks.

---

### 4. `aubiojs` / `aubio`

- **Purpose**: Onset detection, beat tracking, tempo estimation
- **Repository**: https://github.com/qiuxiang/aubiojs
- **Used in**: Phase A1 (advanced future phase)
- **Features**:
  - Onset / transient detection → validate drum hits
  - Tempo estimation → verify BPM
  - Pitch detection (as alternative to pitchfinder)
- **Environment**: Browser via WASM
- **Usage note**: Not yet installed. Add with `npm install aubiojs` when ready for Phase A1.

---

### 5. `DamRsn/NeuralNote` (reference only)

- **Purpose**: Advanced audio-to-MIDI with pitch bends and quantization
- **Repository**: https://github.com/DamRsn/NeuralNote
- **Used in**: Phase A3 (reference / inspiration only)
- **Status**: Not integrated — used as design reference for note quantization workflows.

---

## Approved Output JSON Format

### Approved

```json
{
  "approved": true,
  "confidence": 0.92,
  "code": "note('c d eb f').s('cello')",
  "warnings": [],
  "analysis": {
    "expectedNotes": ["c", "d", "eb", "f"],
    "detectedNotes": ["c", "d", "eb", "f"],
    "scale": "C minor",
    "instrument": "cello"
  }
}
```

### Rejected

```json
{
  "approved": false,
  "confidence": 0.61,
  "code": "note('c d e f').s('cello')",
  "errors": [
    {
      "type": "scale_error",
      "message": "E natural (semitone 4) is outside C minor. Suggested: eb.",
      "suggestedPatch": "note('c d eb f').s('cello')"
    }
  ],
  "warnings": [],
  "analysis": null
}
```

---

## Feature Flag

Set `ENABLE_AUDIO_VALIDATION=true` in `.env.local` to enable real audio rendering and analysis.
Without this flag, the pipeline runs in stub mode (Steps 1–5 only, no real audio capture).

```env
ENABLE_AUDIO_VALIDATION=false   # default — Steps 1-5 only
ENABLE_AUDIO_VALIDATION=true    # Steps 1-7 with Meyda + pitchfinder
```
