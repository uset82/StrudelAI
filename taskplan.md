# AI Strudel Music Assistant Redesign Task Plan

This file is the source of truth for the implementation pass.

## Current Status

* [x] Current system audit completed.
* [x] OpenRouter Agent SDK and Zod installed.
* [x] Shared music-agent pipeline implemented.
* [x] API and socket surfaces unified behind shared pipeline.
* [x] Validation, corpus data, and tests expanded.
* [x] Final automated verification completed.
* [ ] Human listening pass completed.

## Implementation Notes

* Use OpenRouter Agent SDK for bounded refinement, with deterministic local generation as the safety fallback.
* Keep the public `/api/agent` request and response shape stable.
* Treat training data as reference material, not as an exact-copy output library.
* Keep secrets out of generated docs, logs, and test fixtures.
* Keep repo-local Codex skills in `.agents/skills`; do not wire hosted OpenAI Skills API into production runtime unless the app later moves to OpenAI Responses API shell environments.

## Agent Guidance And Skills Hardening

* [x] Create root `AGENTS.md` with project overview, API contract, music-quality rules, checks, and security guidance.
* [x] Create `.agents/skills/strudel-music-generation/SKILL.md`.
* [x] Create `.agents/skills/strudel-validation/SKILL.md`.
* [x] Create `.agents/skills/music-quality-evaluation/SKILL.md`.
* [x] Create `.agents/skills/openrouter-agent-api/SKILL.md`.
* [x] Validate all four skill manifests with `quick_validate.py`.
* [x] Add server-flag-only music-agent debug metadata support.
* [x] Make legacy OpenRouter no-key behavior fall back locally instead of returning a provider setup error.
* [x] Add regression coverage for boom-bap drums-only, less-robotic contextual edits, drums-only retry, and malformed unsupported Strudel.
* [x] Run `npm run test:music-quality`, `npm run lint`, and `npm run build`.
* [ ] Confirm skill routing in a fresh Codex session: Strudel generation improvement -> `$strudel-music-generation`.
* [ ] Confirm skill routing in a fresh Codex session: broken Strudel repair -> `$strudel-validation`.
* [ ] Confirm skill routing in a fresh Codex session: listening-test expansion -> `$music-quality-evaluation`.
* [ ] Confirm skill routing in a fresh Codex session: OpenRouter fallback tuning -> `$openrouter-agent-api`.

## Human Listening Checklist

Use this table during manual listening passes after automated tests pass.

| Prompt | Expected Traits | Generated Code Summary | Genre Match | Listenability | Issues | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| play some rock | Backbeat, bass, guitar-like riff, controlled distortion | TBD | TBD | TBD | TBD | TBD |
| hard rock | Stronger backbeat and E-minor root/fifth riff, distortion still controlled at 0.18 or lower | Reject OpenRouter refinements that raise guitar distortion to 0.2+ | TBD | TBD | Prior output sounded over-distorted and out of tune | TBD |
| make a guitar riff | Riff-focused rock texture, root/fifth relationship | TBD | TBD | TBD | TBD | TBD |
| funky groove | Syncopated drums, active bass, clipped chords | TBD | TBD | TBD | TBD | TBD |
| calm ambient music | Slow pads, no forced drums, spacious FX | TBD | TBD | TBD | TBD | TBD |
| drum and bass | 174 BPM, broken beat, rolling bass | TBD | TBD | TBD | TBD | TBD |
| something like eminen | Safe artist-reference rap traits, punchy half-time drums, low sub bass, no melodic lead unless requested | Prior output used generic C-minor triangle bass and clean sine hook | Fail | Fail | Too melodic; typo missed rap vocal-bed routing | Fail |
| thats no even close to eminen | Correction stays in safe rap vocal-bed traits with tighter drums/sub and no lead hook | Prior output added a C-minor square-wave hook and saw bass | Fail | Fail | Complaint plus typo still routed to melodic hook behavior | Fail |
| SSNN default preset during continuous playback | Continuous, even neural pulse stream; controls remain responsive; no bursty vibration or long dropouts | Prior implementation created up to 12 one-shot voices per animation frame and tied audio timing to repaint cadence | Fail | Fail | Bursty output, UI lag, and sound stopped after a few events | Fail |
| Generate techno, then listen in SSNN | Neural spikes and resynthesis should follow the workstation FFT while the 960-neuron simulation stays off the UI thread | Prior SSNN only used microphone FFT when SpecListen was enabled; otherwise generated tracks did not drive the LIF input | Fail | Fail | SSNN sounded autonomous/unrelated and the panel occasionally shook under simulation load | Fail |
