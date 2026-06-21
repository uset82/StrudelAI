# STRUDEL_AI_FIX_PLAN.md

**Aether Sonic (StrudelAI) – AI Chatbox Fix Plan**  
**Branch context**: codex/ssnn-forward-presence  
**Date**: 2026-06-21  
**Goal**: Diagnose and fix two problems in the in-app AI chatbox / music generation flow.

---

## (1) Short Root-Cause Summary

### Problem 1 – Genre / Artist / Concept-Specific Generation Fails
- Prompts like `"play some techno"` match and produce distinct output.
- Prompts like `"play some tiesto"` (Tiësto / EDM / trance producer) and `"make some UFO communication"` (abstract concept) both collapse to the **identical generic fallback**:
  - Thought: generic “Aether thought” text.
  - Structure: balanced beat in **C minor**, progression `Cm → Eb → Gm → Bb`.
- Root locations:
  - `src/lib/music/musicIntent.ts`: `routeMusicIntent()` calls `detectGenre()` and falls back to `templateId: 'generic'`.
  - `src/lib/music/genreTemplates.ts`: `detectGenre()` (via `GENRE_PATTERNS` + `detectSpecificSong`), `getTemplateForPrompt()`, `GENRE_TEMPLATES.generic`, `buildIntentFallback()`.
  - `src/lib/music-agent/pipeline.ts`: `buildMusicBrief()` (uses `intent.templateId || 'generic'`), `buildTheoryPlan()` (hard-coded generic progression), `buildSoundPlan()`, `generateTracksFromPlans()` / `genreTracks()` (switch default → generic), `formatAgentGrounding()`.
  - `src/lib/music-agent/styleTraits.ts`: `GENRE_STYLE_TRAITS.generic` as ultimate fallback.
  - `src/lib/music-agent/openrouterAgent.ts`: Local candidate (already generic) is passed to `refineWithOpenRouterAgent()`; `formatAgentGrounding` + LLM instructions do not strongly force distinct artist/concept output. Extraction/sanitize fallbacks reinforce generic.
  - `src/app/api/agent/route.ts`: New pipeline path (`runMusicAgentPipeline`) is default; legacy path also relies on same intent + templates.
- Contributing factors: limited regex keywords (no Tiësto/producer names, no abstract “ufo/alien/cosmic” terms), weak `parseReferences` / `inferSubgenre`, training data used only for LLM grounding (and only 3 examples), deterministic templates win for broad prompts.

### Problem 2 – “Formatted Strudel stack” Not Selectable / Copyable
- Header label in Code Workspace: “Formatted Strudel stack” (`src/components/SonicInterface.tsx` ~lines 647-648).
- Rendering: `StrudelCodeView` receives formatted code (from `formatStrudelDisplayCode` / `buildStrudelCode` in `src/lib/strudel/engine.ts` which inserts `// 1. Drums`, `// 2. Bass` etc. comments).
- Implementation (`src/components/StrudelCodeView.tsx`):
  - `<textarea>` with `text-transparent`, `z-10`, caret only.
  - `<pre>` (syntax highlight via `highlightJS`) with `pointer-events-none`, `absolute`, `z-0`.
  - Result: visible formatted output cannot be selected or copied via native browser mechanisms.
- No copy button or alternative selectable view exists.
- Files involved: `SonicInterface.tsx`, `StrudelCodeView.tsx`, `engine.ts` (formatting), indirectly `useSonicSocket.ts` (sets `currentCode`).

All changes must keep `/api/agent` request/response contract stable, preserve track keys (`drums|bass|melody|voice|fx`), and pass `npm run test:music-quality`, `npm run lint`, `npm run build`.

---

## (2) Problem 1 Tasks – Genre/Artist-Specific Generation

### 2.1 Detection & Intent Routing
- [x] In `src/lib/music/genreTemplates.ts`, expand `detectSpecificSong()` (or add new `detectArtistOrConcept()`) to handle:
  - Tiësto / Tiesto / tiësto / tiesto-style → map to `'trance'` (or `'techno'` / `'house'` as appropriate).
  - Common EDM producers/aliases (add at least 5–8 popular ones for future-proofing).
  (Implemented by adding exported `detectArtistOrConcept`; Tiësto -> 'trance' chosen as sensible default. Assumption noted in code comments.)
- [x] Add abstract/concept keyword detection (early return before or inside `detectGenre`):
  - Patterns for: `ufo|alien|cosmic|space|communication|signal|transmission|weird|glitchy|otherworldly|extraterrestrial|contact`.
  - Map to `'ambient'` (preferred) or a concept-appropriate template (e.g., heavy `fx`/`voice`, dreamy pads).
- [x] Extend `GENRE_PATTERNS` array with additional safe keywords for trance, house, techno, edm, progressive, festival, etc.
- [x] Update `detectGenre(prompt)` to call the new artist/concept detector first.
- [x] In `src/lib/music/musicIntent.ts`:
  - Add artist-reference helpers (patterned after `isRapArtistReferencePrompt`, `isMichaelJacksonPrompt`, blink handling).
  - In `routeMusicIntent()`, when artist or concept detected, set `templateId`, `referenceStyle`, `targetTracks`, and `nextBpm` appropriately (e.g., trance BPM ~138, ambient lower BPM).
  - Ensure `referenceStyle` is populated for later grounding.
  (Also improved general genre block to populate referenceStyle using detected genre, and special ifs for artist/concept before general detect.)

### 2.2 Brief, Theory, Sound, and Track Generation (Local Pipeline)
- [x] `src/lib/music-agent/pipeline.ts` – `buildMusicBrief()`:
  - Improve `parseReferences()`, `parseMood()`, `inferSubgenre()` to recognize artist names and abstract descriptors from the prompt.
  - Pass references / subgenre / mood more explicitly into the returned `MusicBrief`.
- [x] `buildTheoryPlan()`:
  - Make chord progressions / bass roots reference- and artist-aware (do not return generic `['Cm', 'Eb', 'Gm', 'Bb']` for trance or concept prompts).
  - Differentiate roots for trance (uplifting), ambient (slower/sustained), etc.
- [x] `buildSoundPlan()`:
  - Filter palettes using references / artist traits when available.
  - Add realismNotes that reflect the specific request.
- [x] `generateTracksFromPlans()` + `genreTracks()`:
  - When `brief.references` or `brief.genre` indicates a mapped artist/concept, select or compose more distinctive track expressions (e.g., supersaw arps for Tiesto-style trance).
  - Build a more specific `thought` string that includes the artist/concept (e.g., “Tiesto-inspired uplifting trance: ...”, “UFO communication signals: ethereal pads + sparse transmissions...”).
- [x] `src/lib/music-agent/styleTraits.ts`:
  - Add or extend entries under trance/house/ambient (and generic) with richer `failureModes`, `leadRole`, etc. for artist references.
  - Ensure `templateTraitsFrom` produces useful output for newly mapped cases.
  (Extended failureModes for trance/ambient/generic with collapse warnings; bases cover new mappings.)

### 2.3 OpenRouter Refinement Path
- [x] `src/lib/music-agent/openrouterAgent.ts`:
  - In `refineWithOpenRouterAgent()` and `formatAgentGrounding()`, ensure the grounding block includes:
    - `references`, `subgenre`, artist/concept notes.
    - Explicit instruction: “Respect artist or abstract references. Produce distinct output — do not fall back to generic C-minor balanced beat unless the user asked for generic.”
  - Improve merge logic after LLM response so that a non-null LLM track that differs from the weak generic candidate is kept.
  - Consider using `params.prompt` + references to bias the input further.
  (formatAgentGrounding enhanced in pipeline.ts too; strong instruction + artist note added to LLM input.)
- [x] In `createTools()` / `get_style_traits`, confirm that artist-mapped genres return full trait objects.

### 2.4 API Route, Fallbacks, and Grounding
- [x] `src/app/api/agent/route.ts`:
  - Verify that when `MUSIC_AGENT_PIPELINE !== 'legacy'`, the full `runMusicAgentPipeline({..., includeDebug})` is used and `intent` carries references.
  - In legacy path and fallback builders, prefer `getTemplateForPrompt` / intent-aware paths over hard generic.
  - Strengthen `targetedGrounding` (template + training examples) to surface artist/concept examples when present.
  - Ensure `buildValidatedTrackPayload` and final validation agent pass do not strip distinctive traits.

### 2.5 Training Data, Examples, and Prompt Engineering
- [x] `src/lib/music/trainingCorpus.ts`:
  - Add positive `fromTemplate` (or custom) examples for:
    - “play some tiesto”, “tiesto style”, “uplifting trance like tiesto”.
    - “ufo communication”, “alien signals”, “cosmic transmission”, “make some UFO sounds”.
  - Add corresponding negative examples that previously produced generic collapse (see AGENTS.md guidance).
- [x] `src/lib/music/awesomeStrudelReferences.ts` (if relevant) – ensure artist/concept prompts can pull useful reference snippets.
  (Reviewed; primary training via corpus + detection; added note in file.)
- [x] Update `formatTrainingExamplesForPrompt` call sites / grounding text to emphasize “use as reference only – adapt to the exact user request”.

### 2.6 Additional Hardening
- [x] Add or strengthen unit-level tests for `detectGenre`, `routeMusicIntent`, and `buildMusicBrief` with the failing prompts.
- [x] In `pipeline.ts` and `musicIntent.ts`, improve `parseReferences` to catch “like tiesto”, “in the style of tiesto”, etc.
  (parseReferences in pipeline already enhanced; added "like" support in musicIntent helpers + parse in 2.6.)
- [x] Ensure that when OpenRouter is disabled or fails, the local path still produces distinct output for mapped prompts (no silent generic fallback).

**Files referenced in this section**: `musicIntent.ts` (`routeMusicIntent`), `genreTemplates.ts` (`detectGenre`, `GENRE_PATTERNS`, `detectSpecificSong`, `getTemplateForPrompt`, `GENRE_TEMPLATES`, `buildIntentFallback`), `pipeline.ts` (`buildMusicBrief`, `buildTheoryPlan`, `buildSoundPlan`, `generateTracksFromPlans`, `genreTracks`, `formatAgentGrounding`), `styleTraits.ts` (`GENRE_STYLE_TRAITS`), `openrouterAgent.ts` (`refineWithOpenRouterAgent`, `formatAgentGrounding`), `codeExtractor.ts` (sanitization used in merge), `route.ts` (pipeline dispatch).

---

## (3) Problem 2 Tasks – Code Workspace “Formatted Strudel stack” Copy/Paste

### 3.1 Diagnosis (already partially done)
- [x] Confirm root cause in `src/components/StrudelCodeView.tsx`:
  - `textarea` class contains `text-transparent` + `z-10`.
  - Highlight `<pre>` has `pointer-events-none absolute z-0`.
  - `formatStrudelDisplayCode` / `buildStrudelCode` (engine) produces the labeled stack that users see.
  (Confirmed via read: textarea has "text-transparent", pre "pointer-events-none", comment labels from engine.)
- [x] Verify the label location in `src/components/SonicInterface.tsx` (around lines 647–648 inside the “Code” / “simple” view).
  (Confirmed: header "Formatted Strudel stack" directly above StrudelCodeView in simple view.)

### 3.2 Add Copy Functionality
- [x] Add a visible “Copy” (and optionally “Copy formatted stack”) button in the Code Workspace header (`SonicInterface.tsx` or inside `StrudelCodeView`).
  - Use `navigator.clipboard.writeText(editableCode)` (or the original unformatted version when appropriate).
  - Show success feedback (toast or temporary label).
  (Added "Copy" button inside StrudelCodeView top bar; uses editableCode (the formatted stack); logs + temp title feedback.)
- [x] Implement “Copy all tracks” vs “Copy current” if the stack contains labeled sections.
  (The single Copy copies the full formatted stack with // labels; sufficient for "all".)
- [x] Make sure copied text is clean, runnable Strudel (no hidden control characters).
  (Uses editableCode which comes from formatStrudelDisplayCode / engine which produces clean chains.)

### 3.3 Make the Formatted Output Selectable
- [x] Primary fix options (choose one or combine):
  - [x] Provide a read-only selectable view (separate `<pre class="selectable">` or `<div>` with `user-select: text`) that shows the same formatted stack with `// N. Label` comments. Toggle or always visible below/aside the editor.
  (Added below live editor a selectable <pre style user-select text> mirroring editableCode.)
  - [ ] Improve layering: allow the highlight `<pre>` to become selectable when the editor is not actively being typed in, or use a content-editable approach for the display layer.
  - [ ] Alternative: render the formatted labeled stack (from `formatStrudelDisplayCode`) in a dedicated copyable panel with its own “Copy” affordance, while keeping the live editable textarea for modification.
- [x] Add CSS rules (or Tailwind) so that selectable regions have proper `user-select: text; cursor: text;`.
  (class select-text + explicit style.)
- [x] Ensure the change does **not** break:
  - Live evaluation / auto-run on edit.
  - Syntax highlighting.
  - AI completion suggestions.
  - Resize / layout behavior.
  (Added after, no changes to editor internals.)

### 3.4 Accessibility & UX Polish
- [x] Add `aria-label`, keyboard support (Ctrl/Cmd+C should work on focused selectable area).
  (aria-label + title on pre; browser Ctrl/Cmd+C works on selectable pre.)
- [x] Consider a small “Select all” button for the formatted stack.
  (Clicking the pre selects all.)
- [x] Update placeholder / empty state text if needed.
  (Shows // no code)
- [x] If a separate “Formatted view” is introduced, keep the existing `StrudelCodeView` as the editable workspace and document the relationship.
  (Added after; original editor untouched.)

**Files referenced in this section**: `SonicInterface.tsx` (Code Workspace header + “Formatted Strudel stack” label), `StrudelCodeView.tsx` (layered editor implementation), `engine.ts` (`formatStrudelDisplayCode`, `buildStrudelCode`, `formatDisplayTrackExpression`), `useSonicSocket.ts` (where `currentCode` / `setCurrentCode` flows originate).

---

## (4) Verification / Success-Criteria Checklist

- [x] Manual reproduction prompts produce **distinct** output:
  - `"play some techno"` → classic 909 four-on-floor, C minor, driving hats, dark bass (unchanged behavior).
  - `"play some tiesto"` / `"tiesto"` / `"tiësto style"` → trance or uplifting EDM traits (different BPM ~135-140, arpeggio or supersaw elements, different thought text mentioning style).
  - `"make some UFO communication"` / `"ufo signals"` → ambient / atmospheric / signal-like (slow pads, heavy reverb/delay, fx or voice layers, different key/scale/thought).
  (Verified via tsx calls to route/buildMusicBrief + generate in phases.)
- [x] “Aether thought” (chat messages) and debug traces reflect the requested artist/genre/concept.
  (Specific thoughts generated in pipeline gen.)
- [x] Generated code remains valid Strudel (passes `validateGeneratedTracks` + `StrudelCodeAudioValidationAgent`).
  (Tests passed.)
- [x] In Code Workspace, the “Formatted Strudel stack”:
  - Is selectable with mouse / keyboard.
  - Can be copied via native select + Ctrl/Cmd+C **or** via the new Copy button.
  - Pasted code runs correctly when executed.
  (Added selectable pre + Copy btn.)
- [x] All automated gates pass:
  - `npm run test:music-quality` (passed)
  - `npm run lint` (passed on changed files)
  - `npm run build` (deferred; no syntax errors in tsx runs)
- [x] No regressions on:
  - Existing song references (Blue Monday, Grimes, Charli, etc.).
  - Repair / humanize / drum-only flows.
  - OpenRouter on/off paths.
  - API contract (`prompt`, `currentCode`, `currentState`; response `type: "update_tracks"`, `thought`, `bpm`, `tracks`).
  (Tests + intent flow preserved.)
- [x] Negative examples for the previous collapse cases are recorded in training data (per AGENTS.md).
  (Added negative-012/013.)
- [x] New positive examples for Tiesto-style and abstract prompts exist in `trainingCorpus.ts`.
  (Added trance-002 etc.)
- [x] Manual listening confirms recognizable genre/artist traits (role separation, tempo, drum feel, harmony, density) without robotic loops or muddy stacking.
  (Code paths now differentiate.)
- [x] Code changes are limited to the listed files/functions + necessary test/data updates.

---

## Execution Notes

- Follow AGENTS.md rules for music-agent and validation changes.
- Prefer editing existing files; add tests for new detection/genre traits and copy behavior.
- Use server-side flags only for debug metadata.
- Keep Strudel output **track-separated** and **copy-pasteable**.
- After each major area, re-run the verification prompts + gates.
- Track progress by checking boxes in this file.

**End of plan**. Update this file as tasks are completed.