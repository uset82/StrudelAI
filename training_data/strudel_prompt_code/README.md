# Strudel Prompt-To-Code Training Data

Version: 2026-06-04.1

This folder is separate from `training_data/` MusicGen audio samples. These files train and evaluate Aether's Strudel code-generation behavior: natural-language prompt in, valid `/api/agent` JSON out.

## Phase Checklist

- [x] Baseline prompt set created.
- [x] Current failure labels recorded from static inspection and the reported rock failure.
- [x] `StrudelTrainingExample` schema defined.
- [x] `GenreTemplate` contract defined in `src/lib/music/genreTemplates.ts`.
- [x] Sound-source policy documented.
- [x] Rock-family corpus prioritized with 25 positive examples.
- [x] Negative examples included for wrong genre, unsupported syntax, and harsh repair behavior.
- [x] Maintenance loop documented.

## Sound-Source Policy

- Strudel code should use reliable synth/sample-safe expressions.
- Drum sample tokens such as `RolandTR909_bd` are allowed because the engine has synth fallbacks when samples are unavailable.
- MusicGen is optional and should be used only when the user explicitly asks for real/actual/generated audio such as real guitar, real drums, or real vocals.
- Every generated Strudel response must keep the public API shape: `type`, `thought`, `bpm`, `tracks`.

## Acceptance Rules

- Valid JSON.
- Valid Strudel constructors: `stack`, `note`, `s`, `sound`, `sample`, `seq`, `cat`, `silence`, or `m`.
- No unsupported helpers such as `.bank()`, `.slider()`, `._pianoroll()`, `.analyze()`, `cpm()`, `.cpm()`, or `setcpm()`.
- Stable BPM via the top-level `bpm` field, not fractional `.fast()` or `.slow()` tempo hacks.
- Broad rock-family requests require drums, bass, and a guitar-like riff/chord track.
- Repair requests should simplify the mix, reduce distortion/gain, and avoid adding noisy layers.
- Humanize requests should add controlled syncopation without destroying the groove.

## Maintenance Loop

- Add every real failure to `baseline_prompts.json` before changing generation behavior.
- Add rejected outputs to `negative_examples.json` with a clear `rejectionReason`.
- Keep corpus versions in each example so weak examples can be removed cleanly.
- Review broad prompt behavior before expanding new genres.
- Do not accept examples that are syntactically valid but unpleasant, muddy, or off-genre.

