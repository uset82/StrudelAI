# AI Music Agent Architecture

This app now uses a shared TypeScript music-agent pipeline for Strudel generation.

## Pipeline

The main flow is:

1. `UserIntentAgent`: builds a `MusicBrief` from prompt, current tracks, BPM, requested scope, genre, mood, instruments, references, and constraints.
2. `MusicTheoryAgent`: chooses BPM, key/scale, chord movement, bass roots, rhythmic feel, density, and section intent.
3. `SoundDesignAgent`: chooses drum, bass, melody, and FX palettes plus mix rules.
4. `StrudelCodeAgent`: creates track-separated Strudel expressions.
5. `CodeValidationAgent`: validates syntax, supported methods, instrument roles, and genre requirements.
6. `MusicQualityReviewAgent`: checks genre match, listenability, and robotic repetition.
7. `RefinementAgent`: repairs validation or quality problems before returning the public `update_tracks` response.

The public API response remains:

```json
{
  "type": "update_tracks",
  "thought": "short musical rationale",
  "bpm": 136,
  "tracks": {
    "drums": "Strudel expression or null",
    "bass": "Strudel expression or null",
    "melody": "Strudel expression or null",
    "voice": "Strudel expression or null",
    "fx": "Strudel expression or null"
  }
}
```

## OpenRouter Agent SDK

`@openrouter/agent` is used as a bounded refinement layer. The local pipeline always creates a safe candidate first. For non-trivial full-arrangement requests, the OpenRouter agent can improve the candidate using typed tools for style traits and validation. If the provider is unavailable, rate-limited, or returns invalid output, the local pipeline result is used.

## ADK And LiteLLM

ADK and LiteLLM are not part of v1. They remain a future option if the project moves to a separate Python agent service. The current repo is a TypeScript/Next.js app, so the TypeScript OpenRouter Agent SDK keeps the architecture simpler and avoids an extra runtime.

## Repo Agent Guidance And Skills

Root `AGENTS.md` defines durable coding-agent expectations for this repository. Repo-scoped skills live in `.agents/skills` and guide future development work for Strudel generation, validation, music-quality evaluation, and OpenRouter API hardening.

These skills are developer workflow bundles for Codex. They are not mounted into production `/api/agent` and do not replace the OpenRouter Agent SDK path. Hosted OpenAI Skills API can be considered later only if the app adds an OpenAI Responses API shell environment.

## Reference Data

Training and example data are reference material, not strict templates. The generator should preserve style traits such as tempo range, drum feel, bass role, harmony, lead/riff behavior, density, and failure modes while producing original Strudel patterns.
