# AI Strudel Generation and Workspace Fix Plan
## Problem statement
The chatbox should behave like a real Strudel music-coding assistant: interpret artist or genre requests deeply, generate valid and musically distinctive Strudel, send the result into one editable Code Workspace, and avoid duplicate or conflicting code displays.
## Current state from research
The normal `/api/agent` flow already routes through `src/lib/music-agent` unless `MUSIC_AGENT_PIPELINE=legacy` is set in `src/app/api/agent/route.ts:815`. The local pipeline builds a `MusicBrief`, theory plan, sound plan, generated tracks, validation report, quality review, and refinement in `src/lib/music-agent/pipeline.ts (138-774)`, then optionally lets the OpenRouter agent refine it in `src/lib/music-agent/openrouterAgent.ts (222-436)`.
Tiësto and UFO routing already exists in `src/lib/music/musicIntent.ts (219-258)` and `src/lib/music/genreTemplates.ts (1016-1026)`, but the trance template itself still resembles the bad example: 4/4 909 drums, a simple offbeat saw bass, one slow supersaw arp, and pink noise FX in `src/lib/music/genreTemplates.ts (327-344)`. This explains why the thought can claim “Tiësto-inspired uplifting trance” while the code remains generic.
Training examples are included through `formatTrainingExamplesForPrompt()` and grounding in `src/lib/music-agent/pipeline.ts (644-687)`, but the generation path still relies heavily on deterministic genre templates and small variants. There is no explicit quality gate that scores required genre traits such as “trance needs supersaw chord/arp layering, breakdown/build energy, offbeat bass, and transition FX” before code reaches the workspace.
The Code Workspace is already an editable transparent textarea with syntax-highlighted `<pre>` behind it in `src/components/StrudelCodeView.tsx (309-498)`, but it also renders a second read-only selectable formatted `<pre>` in `src/components/StrudelCodeView.tsx (524-548)`, which is the duplicate code box the user wants removed.
AI `update_tracks` responses are applied to session state and then converted to workspace display code in `src/hooks/useSonicSocket.ts (663-687)`, so workspace auto-replacement is mostly present. The UX still needs clearer explicit actions and tests around one editable workspace.
## Sequential implementation tasks
### Phase 1 — Diagnose the AI Strudel generation problem
Task 1.1: Document the active generation path in code comments or tests only where useful: chatbox request, `/api/agent`, `routeMusicIntent`, `buildMusicBrief`, local pipeline, OpenRouter refinement, validation, `useSonicSocket`, and `StrudelCodeView`.
Task 1.2: Add targeted regression assertions that reproduce the current weaknesses for “Play some Tiësto” and the other requested prompts, focusing on route intent, generated track roles, validation, and non-generic musical traits.
Task 1.3: Confirm whether the local pipeline and OpenRouter grounding use training examples by asserting relevant examples and style traits appear in grounding for artist or genre prompts.
Task 1.4: Classify root causes in code-level terms: weak deterministic templates, incomplete trait checks, limited artist/reference interpretation, and duplicate workspace render logic.
### Phase 2 — Improve the AI music interpretation layer
Task 2.1: Introduce a structured interpretation model for genre, artist or concept reference, tempo range, rhythm style, harmony, instruments, arrangement, energy, sound design, density, and failure modes.
Task 2.2: Extend style traits for trance, techno, rock, reggae, breaks/DnB, synthwave or spacesynth, ambient, cinematic electronic, and existing supported styles.
Task 2.3: Distinguish artist-inspired requests from generic genre requests by producing safe reference traits without copying songs; for Tiësto, route to uplifting trance traits with explicit supersaw, offbeat bass, breakdown/build, and 136-140 BPM expectations.
Task 2.4: Add prompt-specific interpretation coverage for “dark Jamaican roots reggae,” “90s breakbeat,” “Koto-style spacesynth,” and “cinematic electronic music with relay and capacitor sounds.”
Task 2.5: Add a pre-generation quality target object that downstream generators and validators can compare against before response finalization.
### Phase 3 — Improve Strudel code generation
Task 3.1: Replace weak genre templates with richer reusable templates that still fit the track contract: `drums`, `bass`, `melody`, `voice`, and `fx`.
Task 3.2: Build a stronger trance/Tiësto-safe template: driving 909 kick, offbeat bass, layered supersaw chord/arp, hook contour, breakdown pad/FX, riser/downlifter, and controlled gains.
Task 3.3: Add or strengthen templates for reggae/dub, 90s breakbeat, spacesynth/Koto-style, synthwave, ambient, and cinematic relay/capacitor electronic.
Task 3.4: Add controlled variation helpers that choose from valid mini-notation and supported Strudel methods such as `.sometimes()`, `.every()`, `.slow()`, `.fast()`, `.gain()`, filters, room, delay, and rhythmic rests when supported by validation.
Task 3.5: Keep generated code track-separated, readable, valid, and low-risk: no unsupported helpers, no random note runs, no excessive gain stacking, no fake genre claims, and no one-bar robotic loop unless requested.
Task 3.6: Extend `reviewMusicQuality()` and validation rules so final responses are rejected or refined when required genre traits are missing.
### Phase 4 — Fix the Code Workspace UX problem
Task 4.1: Keep a single main editable workspace in `StrudelCodeView` and remove the duplicate read-only formatted `<pre>`.
Task 4.2: Keep the syntax-highlighted background only as an accessibility-hidden rendering layer behind the textarea, not as a second user-visible code box.
Task 4.3: Rename and clarify the existing copy action as “Copy Code” and make it copy the current editable workspace contents.
Task 4.4: Add an explicit “Replace Workspace Code” or “Send to Workspace” action where AI-generated code can be placed into the editable workspace when it is not auto-applied.
Task 4.5: Preserve select, copy, paste, edit, Ctrl/Cmd+Enter run, Tab behavior, and auto-run after edits.
Task 4.6: Ensure AI `update_tracks` and `code` responses consistently update `currentCode` with formatted workspace code and do not create conflicting display state.
### Phase 5 — Remove duplicate code output
Task 5.1: Verify all code rendering call sites and confirm there is only one `StrudelCodeView` instance for the simple workspace view.
Task 5.2: Remove duplicate render logic from `StrudelCodeView` and any chat/message output that repeats full code when the workspace already contains it.
Task 5.3: Keep AI messages concise: show the musical thought/status in chat, while the generated code lives in the editable workspace.
Task 5.4: Add a UI-level or static test that fails if multiple user-visible Strudel workspace/code boxes are rendered.
### Phase 6 — Add validation and testing
Task 6.1: Expand `test_music_quality.ts` to cover all requested prompts and assert intent, BPM range, required tracks, genre-specific code features, validation success, and absence of generic fallback patterns.
Task 6.2: Add tests for valid generated Strudel code and supported helper usage; update sanitizer/validator allowlists only if required helpers are truly supported.
Task 6.3: Add tests for workspace formatting and single-workspace rendering; if no browser test framework exists, add lightweight component/static tests or assertions that match the project’s current test style.
Task 6.4: Add tests or implementation checks for copy/paste behavior and “Copy Code”/“Replace Workspace Code” actions.
Task 6.5: Run `npm run test:music-quality`, `npm run lint`, and `npm run build` after implementation.
Task 6.6: Manually test the prompts: “Play some Tiësto,” “Create dark Jamaican roots reggae,” “Make a 90s breakbeat track,” “Create a Koto-style spacesynth track,” and “Make cinematic electronic music with relay and capacitor sounds.”
## Execution rules
Execute the phases sequentially and complete tasks within each phase before moving to the next phase.
After plan approval, mirror these tasks into the TODO tracker and mark each item complete immediately after finishing it.
Do not commit unless explicitly requested.
Keep `/api/agent` request fields stable: `prompt`, `currentCode`, `currentState`, and `frequencyData`.
Keep normal music responses stable: `type: "update_tracks"`, `thought`, `bpm`, and `tracks` with `drums`, `bass`, `melody`, `voice`, and `fx`.
Run the required project validations for music-agent/generation changes: `npm run test:music-quality`, `npm run lint`, and `npm run build`.