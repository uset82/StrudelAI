# AGENTS.md

## Project Overview

- This repo is a Next.js/TypeScript Strudel music assistant called Aether Sonic.
- The main generation path is `/api/agent`, shared with the socket runtime through `src/lib/music-agent`.
- Strudel output must be valid, track-separated, genre-aware music that users can actually listen to.

## API Contract

- Keep `/api/agent` request fields stable: `prompt`, `currentCode`, `currentState`, `frequencyData`.
- Keep the normal music response shape stable: `type: "update_tracks"`, `thought`, `bpm`, `tracks`.
- Track keys are always `drums`, `bass`, `melody`, `voice`, and `fx`.
- Add debug or trace metadata only behind a server-side flag. Do not expose it in normal responses.
- Preserve existing `chat`, `code`, `musicgen`, and direct Strudel handling unless the user explicitly asks to change those flows.

## Music Generation Rules

- Route prompt-to-Strudel work through `src/lib/music-agent` whenever possible.
- Treat training data as reference grounding, not as an exact-copy output library.
- Use `MusicBrief`, theory planning, sound design, validation, quality review, and refinement stages for behavior changes.
- Genre output must include recognizable traits: realistic role separation, tempo range, drum feel, bass role, harmony, lead or riff behavior, effects, and density.
- Avoid robotic loops, random note runs, fake genre claims, over-dense mixes, unsupported Strudel helpers, and muddy gain stacking.
- Use realistic drum sample tokens where possible. Use synth fallback only when samples are unavailable or the style calls for it.

## Validation And Tests

- For music-agent, validation, or API generation changes, run:
  - `npm run test:music-quality`
  - `npm run lint`
  - `npm run build`
- Add or update tests for new genre traits, contextual edits, repair behavior, sanitizer behavior, and regression prompts.
- If a generated example sounds subjectively bad during manual listening, record it as a negative example before changing generator behavior.

## Security

- Never print, copy, or document `.env.local` values, API keys, OpenRouter headers containing secrets, or generated secret logs.
- Do not add secrets to tests, docs, training data, `taskplan.md`, or console output.
- Treat provider failures as recoverable where possible and fall back to deterministic local generation.

## Useful Repo Skills

- Use `$strudel-music-generation` for prompt-to-Strudel behavior, genre traits, theory planning, and sound design.
- Use `$strudel-validation` for syntax, sanitizer, role validation, repair loops, and invalid-output regressions.
- Use `$music-quality-evaluation` for baseline prompts, negative examples, listening checklists, and quality tests.
- Use `$openrouter-agent-api` for OpenRouter Agent SDK loops, model fallback, cost caps, timeouts, and API response stability.
