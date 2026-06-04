---
name: music-quality-evaluation
description: Evaluate generated Strudel music quality in this repo. Use when adding baseline prompts, negative examples, listening checklists, genre acceptance notes, regression tests for wrong genre or robotic output, or when converting subjective listening failures into reproducible tests and training references.
---

# Music Quality Evaluation

## Workflow

1. Convert each complaint into a concrete prompt, expected traits, generated-code summary, and pass/fail reason.
2. Add positive baselines for successful behavior and negative examples for failure modes. Keep examples as reference data, not exact-copy templates.
3. Cover both broad prompts and contextual edits: "play some rock", "funky groove", "boom bap drums only", "make it less robotic", "try again", and "only drums".
4. Add automated checks for any failure that can be detected structurally: wrong genre, missing required role, unsupported Strudel, over-harsh repair, repeated identical output, or track-scope loss.
5. For subjective failures, update the listening checklist in `taskplan.md` and add a negative example before changing generator behavior.

## Acceptance Notes

- A pass means the output validates, matches the requested style, uses plausible instrument roles, avoids robotic repetition, and keeps the requested track scope.
- A fail should name the musical reason, not only the code reason.
- Variation tests should expect related but non-identical output when repeated prompts ask for another take.

## Checks

- Run `npm run test:music-quality` after updating corpus or tests.
- Run `npm run lint` and `npm run build` when TypeScript changes.
- Keep secrets and provider logs out of training data and task files.
