---
name: openrouter-agent-api
description: Harden the OpenRouter Agent SDK path for this Strudel assistant. Use when changing `src/lib/music-agent/openrouterAgent.ts`, `/api/agent` provider fallback behavior, model candidate loops, timeout or cost caps, typed tools, debug metadata, response schemas, or stable local fallback behavior when OpenRouter is unavailable.
---

# OpenRouter Agent API

## Workflow

1. Keep the local deterministic pipeline as the first candidate and safety fallback.
2. Use OpenRouter Agent SDK refinement only as a bounded improvement layer.
3. Keep tools typed and narrow: style trait retrieval and track validation are preferred over broad filesystem or network tools.
4. Cap agent loops with step and cost limits. Preserve configured model candidates, timeout, and OpenRouter headers behavior.
5. If OpenRouter is missing, rate-limited, timed out, or returns invalid output, return the local `update_tracks` response instead of a provider error.
6. Add debug metadata only behind a server-side flag and never include secrets, headers, API keys, raw env values, or full provider stack traces.

## Response Rules

- Normal `/api/agent` music responses must remain `type`, `thought`, `bpm`, and `tracks`.
- Validate OpenRouter-refined tracks before returning them.
- Reject refinements that violate role, genre, syntax, or track-scope constraints.
- Preserve `chat`, `code`, `musicgen`, YouTube, and direct Strudel paths unless the task explicitly targets them.

## Checks

- Add regression tests for provider-unavailable fallback when the behavior is changed.
- Run `npm run test:music-quality`, `npm run lint`, and `npm run build`.
- Do not log secrets while debugging provider behavior.
