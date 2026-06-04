# Implementation & Task Plan — Awesome-Strudel Song Integration

This document outlines the design and phase-by-phase execution plan for importing the community-created Strudel songs from the [awesome-strudel](https://github.com/terryds/awesome-strudel) repository into Aether Sonic's training data.

---

## Phase 1 — Ingestion Scraper
- [x] **Task 1.1:** Write the ingestion script in `scratch/import_awesome_strudel.js`.
- [x] **Task 1.2:** Download eefano's raw Javascript song files from the `eefano/strudel-songs-collection` GitHub repository.
- [x] **Task 1.3:** Programmatically decode inline Base64 hash links for Blue Monday and Undertale Determination.
- [x] **Task 1.4:** Retrieve database-backed project codes for Grimes, Charli XCX, and Billie Eilish covers using the Supabase REST API endpoint.
- [x] **Task 1.5:** Verify all raw files are successfully saved to `training_data/awesome_strudel_raw/`.

## Phase 2 — Sanitization and Segmentation
- [x] **Task 2.1:** Write the sanitization utility in `scratch/sanitize_imported_songs.js`.
- [x] **Task 2.2:** Strip unsupported/crashing functions (e.g. `.bank()`, `.slider()`, `._pianoroll()`, `setcpm()`) from the raw code.
- [x] **Task 2.3:** Map full-song timing arrangements or segment them into layers (drums, bass, melody, voice, fx).
- [x] **Task 2.4:** Write the sanitized structures as clean JSON files ready for integration.

## Phase 3 — Codebase Integration
- [x] **Task 3.1:** Add the new song keys to `GenreKey` in `src/lib/music/genreTemplates.ts`.
- [x] **Task 3.2:** Register the song track mappings under `GENRE_TEMPLATES` in `src/lib/music/genreTemplates.ts`.
- [x] **Task 3.3:** Populate `STRUDEL_TRAINING_EXAMPLES` with the positive templates in `src/lib/music/trainingCorpus.ts`.
- [x] **Task 3.4:** Add prompts and examples to `training_data/strudel_prompt_code/corpus_manifest.json`.
- [x] **Task 3.5:** Update `training_data/strudel_prompt_code/baseline_prompts.json` with verification prompts.

## Phase 4 — Testing and Verification
- [x] **Task 4.1:** Run `npm run lint` and fix any type/formatting issues.
- [x] **Task 4.2:** Run `npm run build` to confirm the application compiles successfully.
- [x] **Task 4.3:** Run `npm run test:music-quality` to check quality metrics.
- [x] **Task 4.4:** Start the local server (`npm run dev`) and manually test prompts (e.g., "play Blue Monday") in the chat REPL.

## Hardening Pass — Reference Examples Without Runtime Copying
- [x] **Task H.1:** Keep `training_data/awesome_strudel_raw/` as an unmodified source archive and exclude it from ESLint.
- [x] **Task H.2:** Use imported songs as reference traits and grounding, not copied full-song Strudel scripts.
- [x] **Task H.3:** Replace helper-heavy runtime templates with compact, valid, role-separated drums/bass/melody/fx tracks.
- [x] **Task H.4:** Update baseline acceptance targets away from "full arrangement in melody track".
- [x] **Task H.5:** Add regression coverage for every imported song prompt, including rejection of `const`, `arrange`, `.bank()`, `.slider()`, `.analyze()`, and other unsafe copied-script constructs.
- [x] **Task H.6:** Verify with `npm run test:music-quality`, `npm run lint`, `npm run build`, and `npx tsx test_agent_validator.ts`.
