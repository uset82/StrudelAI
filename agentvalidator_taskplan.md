# StrudelCodeAudioValidationAgent — Task Plan
> Based on: [agentvalidator.md](file:///D:/Proyectos/StrudelAI-main/StrudelAI-main/agentvalidator.md)

---

## Overview

Build a multi-skill validation agent (`StrudelCodeAudioValidationAgent`) that intercepts AI-generated Strudel code **before** it reaches the live audio engine, validates it syntactically and musically, optionally renders a short audio preview and analyzes the result, and either approves or returns a structured correction request to the AI.

---

## Phase 1 — Research & Repository Setup

> Goal: Understand the existing codebase and prepare all dependencies.

- [x] **1.1** Read and understand the current `src/lib/music-agent` pipeline and how code reaches the Strudel engine.
- [x] **1.2** Read `src/lib/music/strudelValidation.ts` to understand the existing validation layer.
- [x] **1.3** Clone reference repositories locally (do **not** fork into the main project):
  - [x] `git clone https://github.com/williamzujkowski/live-coding-music-mcp.git` — study MCP integration patterns.
  - [x] `git clone https://github.com/tidalcycles/strudel.git` — study Strudel grammar, `note()`, `s()`, `bank()`, `n()`, `scale()`, `trans()`.
- [x] **1.4** Install MVP audio/validation libraries into the Next.js project:
  - [x] `npm install @spotify/basic-pitch` (TypeScript build — basic-pitch-ts)
  - [x] `npm install meyda`
  - [x] `npm install pitchfinder`
- [x] **1.5** Confirm package compatibility (Node + browser targets) and add types if needed.
- [x] **1.6** Document the integration notes per library in a short `src/agents/StrudelCodeAudioValidationAgent/LIBRARIES.md`.

---

## Phase 2 — Agent Scaffold & Directory Structure

> Goal: Create the folder layout and typed interfaces for the agent.

- [x] **2.1** Create the agent directory:
  ```
  src/agents/StrudelCodeAudioValidationAgent/
  ├── index.ts                  ← main agent entry point
  ├── types.ts                  ← shared TypeScript interfaces
  ├── registry/
  │   └── instrumentRegistry.ts ← Skill 2 data
  ├── skills/
  │   ├── parseStrudelCode.ts
  │   ├── validateMusicalSyntax.ts
  │   ├── validateNotesAgainstScale.ts
  │   ├── validateInstrumentIntent.ts
  │   ├── validateSampleMap.ts
  │   ├── renderPreviewAndAnalyze.ts
  │   └── compareExpectedVsDetectedAudio.ts
  └── LIBRARIES.md
  ```
- [x] **2.2** Define TypeScript interfaces in `types.ts`:
  - [x] `ParsedStrudelIntent` — notes, sounds, bank, n-indexes, scale, trans, tempo, FX.
  - [x] `ValidationResult` — `approved`, `confidence`, `errors[]`, `warnings[]`, `analysis`.
  - [x] `CorrectionReport` — `type`, `message`, `suggestedPatch`.
  - [x] `AudioAnalysisResult` — `expectedNotes`, `detectedNotes`, `detectedProfile` (RMS, spectral, onsets).
- [x] **2.3** Create `index.ts` as the orchestrator that calls all skills in sequence.
- [x] **2.4** Export the agent so it can be imported by `src/lib/music-agent`.

---

## Phase 3 — Instrument Registry

> Goal: Build the internal registry that maps instruments to their validation profile.

- [x] **3.1** Create `registry/instrumentRegistry.ts` with entries for all instrument types:
  - **Pitched**: `piano`, `cello`, `guitar`, `synth`, `bass`, `lead`, `pad`.
  - **Drum categories**: `kick`, `snare`, `clap`, `closed-hihat`, `open-hihat`, `tom`, `ride`, `crash`, `percussion`.
- [x] **3.2** Each registry entry must include:
  - [x] `type`: `"pitched" | "drum" | "noise" | "fx" | "loop"`
  - [x] `allowedNoteRange` (if pitched, e.g., `{ min: "C1", max: "C8" }`)
  - [x] `expectedFrequencyProfile` (if drum/noise, e.g., `{ bassEnergy: ">0.6" }` for kick)
  - [x] `validStrudelAliases`: e.g., kick → `["bd"]`, snare → `["sd"]`, hi-hat → `["hh"]`, clap → `["cp"]`
  - [x] `validationMethod`: `"pitch" | "transient" | "spectrum" | "sample-map"`
- [x] **3.3** Export typed `getInstrumentProfile(name: string)` helper.

---

## Phase 4 — Skill 1: `parseStrudelCode`

> Goal: Extract musical intent from raw Strudel code strings.

- [x] **4.1** Implement parser that handles at minimum:
  - `note("c d eb f")` → extract note array
  - `s("bd sd hh*8")` → extract sample names (including repeat syntax `*N`)
  - `bank("RolandTR909")` → extract bank name
  - `n("0 1 2 3")` → extract n-indexes as array
  - `scale("C:minor")` / `trans(...)` → extract key/scale/transposition
  - `.tempo(120)` → extract BPM
  - Chained FX: `.reverb()`, `.delay()`, `.lpf()`, etc.
- [x] **4.2** Return a `ParsedStrudelIntent` object.
- [x] **4.3** Write unit tests: parse a cello melody line, parse a TR909 drum pattern.

---

## Phase 5 — Skill 2: `validateMusicalSyntax`

> Goal: Verify that Strudel functions and mini-notation are syntactically valid.

- [x] **5.1** Check that all used Strudel functions (`note`, `s`, `bank`, `n`, `scale`, `trans`, `tempo`) are on the supported-functions list.
- [x] **5.2** Validate mini-notation: brackets `[...]`, angle brackets `<...>`, `,` alternations, `*N` repeats, `!N` replicates, `_` rests.
- [x] **5.3** Detect unsupported helpers (reuse logic from existing `strudelValidation.ts` where possible).
- [x] **5.4** Detect unbalanced parentheses/quotes.
- [x] **5.5** Return `ValidationResult` with syntax errors listed.
- [x] **5.6** Write unit tests: valid code passes, code with unsupported helper fails.

---

## Phase 6 — Skill 3: `validateNotesAgainstScale`

> Goal: Detect notes that fall outside the requested musical key/scale.

- [x] **6.1** Build a scale-note lookup table for common scales: major, natural minor, harmonic minor, pentatonic major/minor, blues, dorian, mixolydian, phrygian.
- [x] **6.2** Accept the target key (e.g., `"C minor"`) from the parsed intent or from the original prompt context.
- [x] **6.3** For each note in `ParsedStrudelIntent.notes`, check if it belongs to the scale.
- [x] **6.4** On violation, return:
  ```json
  {
    "approved": false,
    "error": "E natural is outside C minor. Use Eb.",
    "suggestedPatch": "note('c d eb f').s('cello')"
  }
  ```
- [x] **6.5** Write unit tests: C minor melody with E natural is rejected; C minor with Eb is approved.

---

## Phase 7 — Skill 4: `validateInstrumentIntent`

> Goal: Ensure the generated Strudel code matches the instrument the user requested.

- [x] **7.1** Accept the original user intent string (e.g., `"hard techno kick"`).
- [x] **7.2** Look up the instrument in the registry to determine `type` and `validStrudelAliases`.
- [x] **7.3** Compare the code's `s()` sample aliases against the registry's `validStrudelAliases`.
- [x] **7.4** On mismatch, return:
  ```json
  {
    "approved": false,
    "error": "User requested kick but AI generated snare.",
    "suggestedPatch": "s('bd*4')"
  }
  ```
- [x] **7.5** For pitched instruments, ensure `note()` is used (not just `s()` without pitch).
- [x] **7.6** Write unit tests: kick intent with `sd` sample fails; kick with `bd` passes.

---

## Phase 8 — Skill 5: `validateSampleMap`

> Goal: Validate that sample names, banks, and n() indexes are within valid ranges.

- [x] **8.1** Build (or import) a sample map registry listing known banks and their sample counts:
  - `RolandTR909`: `{ bd: 4, sd: 4, hh: 4, oh: 2, cp: 2, ... }`
  - `RolandTR808`: similar
  - Default/global: `bd, sd, hh, cp, oh, rim, ...`
- [x] **8.2** Check that `s()` sample names exist in the known map.
- [x] **8.3** Check that `bank()` value is a known bank.
- [x] **8.4** Check that `n()` indexes are within the sample count for that bank.
- [x] **8.5** If index is out of range, return a **warning** (not hard rejection) with normalized indexes:
  ```json
  {
    "warning": "Sample indexes 4 and 5 may wrap around.",
    "normalizedIndexes": [0, 1, 2, 3, 0, 1]
  }
  ```
- [x] **8.6** Write unit tests: index within range passes; index out of range returns warning.

---

## Phase 9 — Skill 6: `renderPreviewAndAnalyze`

> Goal: Render 1–2 bars of audio from the validated Strudel code and extract audio features.

> [!IMPORTANT]
> This is the most complex skill. Start with a stub/mock in Phase 9A, then implement real audio analysis in Phase 9B.

### Phase 9A — Stub (render skip, return mock analysis)
- [x] **9A.1** Implement a `renderPreviewAndAnalyze` stub that accepts Strudel code and returns a mock `AudioAnalysisResult`.
- [x] **9A.2** Ensure the rest of the pipeline works end-to-end with the stub.

### Phase 9B — Real audio capture and analysis
- [ ] **9B.1** Research how Strudel's Web Audio API outputs can be captured (OfflineAudioContext or MediaStream recording).
- [ ] **9B.2** Implement short audio capture: render 1–2 bars using Strudel's engine into a Float32Array buffer.
- [ ] **9B.3** Feed audio buffer to **Meyda**:
  - [ ] Extract RMS (loudness)
  - [ ] Extract spectral centroid (brightness)
  - [ ] Extract MFCC (timbre)
  - [ ] Extract energy per band (bass vs. high)
- [ ] **9B.4** Feed audio buffer to **pitchfinder**:
  - [ ] Detect fundamental frequency for pitched instruments.
  - [ ] Convert Hz to note name.
- [ ] **9B.5** Feed audio buffer to **basic-pitch-ts** (if available in browser/Node):
  - [ ] Detect polyphonic pitch / MIDI note detection.
- [ ] **9B.6** Return a combined `AudioAnalysisResult`.

---

## Phase 10 — Skill 7: `compareExpectedVsDetectedAudio`

> Goal: Compare what the code *should* produce vs. what the audio analysis *actually* detected.

- [x] **10.1** For **pitched instruments**:
  - [x] Compare `expectedNotes` (from `ParsedStrudelIntent.notes`) with `detectedNotes` (from pitchfinder/basic-pitch).
  - [x] Flag any note that differs (e.g., E detected where Eb was expected).
  - [x] Check cents deviation for tuning accuracy.
- [x] **10.2** For **drums**:
  - [x] Compare expected drum role (kick/snare/hihat) with the detected Meyda frequency profile:
    - Kick: `bassEnergy > 0.6`
    - Hi-hat: `highEnergy > 0.7`
    - Snare/clap: `midEnergy > 0.5 && transient detected`
  - [x] Flag mismatches.
- [x] **10.3** Return structured `ValidationResult` with `approved`, `confidence`, errors, and analysis.
- [x] **10.4** Write unit tests with mock audio analysis data.

---

## Phase 11 — Correction Engine

> Goal: When validation fails, produce a structured correction report for the AI.

- [x] **11.1** Implement `buildCorrectionReport(errors: CorrectionReport[])` that formats the full rejection JSON:
  ```json
  {
    "approved": false,
    "confidence": 0.61,
    "errors": [
      {
        "type": "scale_error",
        "message": "E natural is outside C minor. Use Eb instead.",
        "suggestedPatch": "replace E with Eb"
      }
    ]
  }
  ```
- [x] **11.2** Implement `buildApprovalReport(code, analysis)` for the approval JSON:
  ```json
  {
    "approved": true,
    "confidence": 0.92,
    "code": "note('c d eb f').s('cello')",
    "warnings": [],
    "analysis": { ... }
  }
  ```
- [x] **11.3** Integrate correction reports into the `src/lib/music-agent` loop so the AI receives the report and can re-generate only the incorrect part.
- [x] **11.4** Limit correction loop to **max 3 retries** to avoid infinite loops.

---

## Phase 12 — Pipeline Orchestrator (`index.ts`)

> Goal: Wire all skills into a single sequential validation pipeline.

- [x] **12.1** Implement the main `validateStrudelCode(code: string, intent: string, context?: MusicContext)` function in `index.ts`.
- [x] **12.2** Pipeline order:
  1. `parseStrudelCode(code)` → `ParsedStrudelIntent`
  2. `validateMusicalSyntax(parsed)` → fail-fast on syntax errors
  3. `validateNotesAgainstScale(parsed, intent)` → check scale/key
  4. `validateInstrumentIntent(parsed, intent)` → check instrument alignment
  5. `validateSampleMap(parsed)` → check banks and n() indexes
  6. `renderPreviewAndAnalyze(code)` → audio capture + feature extraction (if enabled)
  7. `compareExpectedVsDetectedAudio(parsed, audioResult)` → final audio comparison
  8. Return final `ValidationResult`.
- [x] **12.3** Each step can short-circuit (return early rejection) or accumulate warnings.
- [x] **12.4** Add a feature flag `ENABLE_AUDIO_VALIDATION=true/false` to skip steps 6–7 in environments without Web Audio.

---

## Phase 13 — Integration into StrudelAI

> Goal: Plug the agent into the existing music generation flow.

- [x] **13.1** Identify the exact point in `src/lib/music-agent` (or `/api/agent`) where generated code is sent to the Strudel engine.
- [x] **13.2** Insert the validation call **before** the code is dispatched:
  ```ts
  const result = await validateStrudelCode(generatedCode, userPrompt);
  if (!result.approved) {
    // send correction report back to AI
    return requestAICorrection(result);
  }
  // send approved code to Strudel engine
  ```
- [x] **13.3** Ensure the correction loop feeds back into the AI's generation step (not re-running the whole generation from scratch).
- [x] **13.4** Update `/api/agent` response shape if needed (stay compatible with existing `type: "update_tracks"` contract).
- [x] **13.5** Test end-to-end: prompt → AI code → validation → (rejection + fix) → approval → audio.

---

## Phase 14 — Testing & Quality Assurance

> Goal: Ensure all skills and the full pipeline are tested.

- [x] **14.1** Run existing test suite: `npm run test:music-quality`
- [x] **14.2** Run lint: `npm run lint`
- [x] **14.3** Run build: `npm run build`
- [x] **14.4** Write unit tests for each skill:
  - [x] `parseStrudelCode` — parse cello melody, parse TR909 pattern
  - [x] `validateMusicalSyntax` — valid code passes, bad helper fails
  - [x] `validateNotesAgainstScale` — E in C minor fails, Eb passes
  - [x] `validateInstrumentIntent` — `sd` for kick fails, `bd` passes
  - [x] `validateSampleMap` — out-of-range n() returns warning
  - [x] `compareExpectedVsDetectedAudio` — mock audio mismatch detected
- [x] **14.5** Write integration test: full pipeline with a known bad prompt → correction → approval.
- [x] **14.6** Add regression test: "hard techno kick using sd" should be caught and corrected.
- [x] **14.7** Add negative example in `music-quality-evaluation` skill if validation was bypassed and bad audio was produced.

---

## Phase 15 — Documentation & Cleanup

- [x] **15.1** Update `AGENTS.md` with the new agent name and its role in the pipeline.
- [x] **15.2** Add a short description of `StrudelCodeAudioValidationAgent` to `README.md`.
- [x] **15.3** Document the output JSON format (approved + rejected shapes) in `src/agents/StrudelCodeAudioValidationAgent/LIBRARIES.md`.
- [x] **15.4** Mark deprecated/redundant validation code in `strudelValidation.ts` if now superseded.
- [x] **15.5** Tag a pre-release commit: `git tag v0.1.0-validator`.

---

## Advanced / Future Phases (Post-MVP)

- [ ] **A1** Integrate `aubio/aubio` or `qiuxiang/aubiojs` for better onset, beat, and tempo detection.
- [ ] **A2** Integrate `spotify/basic-pitch` (Python backend) as a server-side audio transcription service for heavier analysis.
- [ ] **A3** Study `DamRsn/NeuralNote` for advanced audio-to-MIDI with quantization and pitch bends.
- [ ] **A4** Add support for loop/sample-based tracks (not just note-based patterns).
- [ ] **A5** Build a UI feedback panel in the Aether Sonic interface showing validation status, confidence score, and detected vs. expected notes.

---

## Dependency Summary

| Library | Purpose | Phase |
|---|---|---|
| `@spotify/basic-pitch` | Polyphonic pitch/MIDI detection | 9B |
| `meyda` | RMS, spectral centroid, MFCC, energy | 9B |
| `pitchfinder` | Fast monophonic pitch detection | 9B |
| `aubiojs` (optional) | Onset, beat, tempo detection | A1 |
| `spotify/basic-pitch` Python (optional) | Heavy server-side transcription | A2 |
| `NeuralNote` (reference) | Audio-to-MIDI quantization reference | A3 |

---

> [!NOTE]
> Work through phases **1 → 15** in order. Each phase depends on the previous one. Do not skip to Phase 13 (integration) before the skills in Phases 4–11 are implemented and tested.
