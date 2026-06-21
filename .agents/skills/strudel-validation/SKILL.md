---
name: strudel-validation
description: Validate and repair Strudel code for this music assistant. Use when changing sanitizer behavior, `src/lib/music/strudelValidation.ts`, unsupported method checks, balanced syntax checks, sample token rules, role validators, genre validators, repair loops, or tests for invalid/generated Strudel output.
---

# Strudel Validation

## Workflow

1. Reproduce the bad track set with the smallest prompt and current-code context.
2. Classify the problem as syntax, unsupported helper, malformed mini-notation, bad sample token, wrong role, wrong genre, bad repair, or bad contextual edit.
3. Add a failing regression in `test_music_quality.ts` before changing validation logic when the issue is user-visible.
4. Prefer deterministic validators over prompt prose. Keep validators precise enough to reject bad output without blocking known-good templates.
5. Make repair behavior return playable fallback tracks, not raw validator noise.

## Validator Expectations

- Accept empty tracks, `null`, and `silence` where the intent allows them.
- Reject unsupported helpers such as `bank`, `slider`, `analyze`, `setcpm`, and track-level `cpm`.
- Check balanced delimiters outside quoted strings.
- Validate `.vowel()` values and known sample tokens in `s(...)`.
- Enforce track roles: drums need kick/snare/hat roles, bass mostly low register, melody not bass-only, FX not dense melody.
- Enforce genre traits where they matter: rock-family riff/backbeat, DnB broken beat, ambient no forced drums, repair prompts lower harshness.

## Checks

- Run `npm run test:music-quality` after validator changes.
- Run `npm run lint` and `npm run build` if TypeScript, imports, or public API code changed.
- Keep error messages short, actionable, and safe for logs.
