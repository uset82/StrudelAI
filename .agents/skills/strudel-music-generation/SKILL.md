---
name: strudel-music-generation
description: Improve prompt-to-Strudel music generation in this repo. Use when changing `/api/agent`, `src/lib/music-agent`, genre traits, theory planning, sound design, Strudel track generation, contextual music edits, or failures where generated music sounds robotic, wrong-genre, repetitive, or unrelated to the user request.
---

# Strudel Music Generation

## Workflow

1. Start from the user-facing failure or desired behavior. Capture the prompt, current tracks, expected genre, target instruments, tempo, mood, and whether the request is a full arrangement or a track-only edit.
2. Inspect `src/lib/music-agent` before editing. Keep generation staged as intent brief, theory plan, sound plan, track generation, validation, quality review, refinement, and final response.
3. Update data first when possible: add or revise style traits, tempo ranges, sound palettes, arrangement notes, and failure modes before adding new branching code.
4. Generate Strudel as role-separated tracks. Drums must behave like drums, bass must live mostly low, melody should carry riff/chord/hook material, voice should be vocal-like, and FX should be texture or transition material.
5. Use training examples as references only. Do not copy corpus examples unless preserving an existing deterministic template is the explicit goal.
6. Keep the public API shape stable: `type`, `thought`, `bpm`, `tracks`.

## Music Rules

- Rock, punk, and metal need backbeat or energetic drums, bass, and guitar-like saw/square root/fifth riff or chord texture with controlled distortion.
- Funk needs syncopation, rests, active bass, clipped chord stabs, and space between parts.
- Hip-hop needs boom-bap or trap-specific drum placement, low bass, and restrained melodic loops.
- House and techno need electronic drum traits without pretending to be rock.
- Ambient should not force drums unless explicitly requested.
- Vague mood prompts should still produce a coherent `MusicBrief` with sensible defaults.

## Checks

- Add or update `test_music_quality.ts` for every behavior change.
- Validate generated tracks with `validateGeneratedTracks`.
- Run `npm run test:music-quality`, `npm run lint`, and `npm run build`.
- If the change affects perceived sound, update `taskplan.md` or negative examples with listening notes.
