### Title

Voice-First AI Music Assistant with Integrated Strudel Live Coding MCP Server

---

### High-Level Goal

Build a web application where the user controls generative music  **only with voice** , no typing.

The system must:

1. Use **Google Gemini (via Google GenAI SDK / Realtime API)** as the main AI model.
2. Use the existing **open-source “Strudel Live Coding MCP Server” by William Zujkowski** as the  **music backend** :
   * It controls a real Strudel.cc browser session via  **Playwright** .
   * It exposes 40+ MCP tools for:
     * Pattern generation (`generate_pattern`, `generate_drums`, `generate_bassline`, etc.).
     * Music theory (`generate_chord_progression`, `apply_scale`, `generate_euclidean`, etc.).
     * Real-time audio analysis (`analyze`, `set_tempo`, etc.).
     * Session management (`init`, `play`, `stop`, `save`, `load`, `undo`, `redo`). [Skywork**+2**PulseMCP**+2**](https://skywork.ai/skypage/en/ai-engineer-guide-strudel-live-coding/1981613226920611840?utm_source=chatgpt.com)
3. Provide a  **voice-only UX** :
   * User speaks (microphone).
   * AI understands natural language commands.
   * AI uses the MCP tools to drive Strudel in real time.
4. Ensure that the AI can **continuously access frequency and audio analysis data** from the MCP server, so the assistant is always “connected” to the sound.

---

### Architecture Overview

#### 1. Components

* **Frontend (Web App)**
  * React + TypeScript (Next.js is OK).
  * UI elements:
    * “Start AI Session” button.
    * Big microphone button (record / listening state).
    * Minimal dashboard showing:
      * Current BPM, scale/key.
      * Which tracks are active (drums, bass, melody, FX).
      * A small log of last user commands + AI decisions.
  * Handles:
    * Capturing audio from the microphone.
    * Sending audio to the backend (initially as chunks or WAV blobs).
    * Displaying basic music state updates received from backend.
* **Backend**
  * Node.js + TypeScript.
  * Integrates:
    * **Google GenAI SDK** (Gemini 2.x) for reasoning + tool calling.
    * **Strudel Live Coding MCP Server** as an external process/service.
  * Responsibilities:
    * Manage user sessions.
    * Handle STT (speech-to-text) using Gemini (or placeholder).
    * Translate AI “tool calls” into actual MCP requests to the Strudel server.
    * Maintain a continuous loop of audio analysis (poll MCP `analyze` tool and feed results back into the AI context).
* **External Service: Strudel Live Coding MCP Server**
  * Installed via npm (e.g. `npm install -g @williamzujkowski/strudel-mcp-server`). [Libraries.io](https://libraries.io/npm/%40williamzujkowski%2Fstrudel-mcp-server?utm_source=chatgpt.com)
  * Run as a separate process and connected via MCP protocol.
  * Controls a real Strudel.cc browser session using Playwright.
  * Provides:
    * Pattern generation by genre (techno, house, DnB, ambient, etc.).
    * Music theory tools.
    * Real-time audio analysis via Web Audio API.
    * Session management tools.

---

### Key Requirement: MCP Integration

The core of this project is **not** to re-implement Strudel logic, but to  **reuse the existing Strudel Live Coding MCP Server** .

We need:

1. A **minimal MCP client** on the backend:
   * A module that can:
     * Register available tools from the Strudel MCP server.
     * Send a tool invocation (with JSON arguments).
     * Receive and parse the structured response.
   * This can be done either by using an existing MCP client library or implementing the MCP JSON-RPC/WebSocket protocol manually.
2. A **bridge layer** between Gemini and MCP:
   * On the Gemini side, define **tools / functions** that represent high-level actions:
     * `createBeat(style, bpm, density, swing)`
     * `createBassline(scale, intensity, octave)`
     * `createMelody(scale, mood, complexity)`
     * `setFX(trackId, reverb, delay, distortion, filterConfig)`
     * `analyzeCurrentAudio()`
   * The implementation of each tool will:
     * Map the high-level call to one or more Strudel MCP tools. Examples:
       * `createBeat(...)` → calls MCP tools like `generate_drums`, `set_tempo`, `init`, `play`.
       * `createBassline(...)` → uses `generate_bassline`, `apply_scale`.
       * `analyzeCurrentAudio()` → calls MCP `analyze` and returns metrics: peak frequency, spectrum, energy, etc. [Skywork**+1**](https://skywork.ai/skypage/en/ai-engineer-guide-strudel-live-coding/1981613226920611840?utm_source=chatgpt.com)
3. A  **continuous analysis loop** :
   * The backend should periodically ask the Strudel MCP server for analysis:
     * e.g., every 500–1000 ms, call `analyze` (or an equivalent analysis tool).
   * Store the latest audio analysis in the session state:
     * Example:
       <pre class="overflow-visible!" data-start="6167" data-end="6367"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-ts"><span><span>interface</span><span></span><span>AudioAnalysis</span><span> {
         </span><span>rms</span><span>: </span><span>number</span><span>;
         </span><span>peakFrequencyHz</span><span>: </span><span>number</span><span>;
         </span><span>bassEnergy</span><span>: </span><span>number</span><span>;
         </span><span>midEnergy</span><span>: </span><span>number</span><span>;
         </span><span>highEnergy</span><span>: </span><span>number</span><span>;
       }
       </span></span></code></div></div></pre>
   * When sending prompts to Gemini, always include the **latest analysis object** so the AI is “always connected” to the current sound and can react to it:
     * “Current mix has strong low-end energy and a peak around 120 Hz; kick is dominating; hi-hats are weak.”

---

### Main User Flows

#### Flow A – Start Session

1. User opens the web app and clicks “Start Session”.
2. Backend:
   * Starts/ensures a Strudel MCP server instance is running.
   * Calls MCP `init` to open a Strudel.cc session and be ready to play. [Skywork**+1**](https://skywork.ai/skypage/en/ai-engineer-guide-strudel-live-coding/1981613226920611840?utm_source=chatgpt.com)
   * Initializes a Gemini conversation with a system prompt describing:
     * The role: “You are a music assistant controlling Strudel via MCP tools.”
     * Available tools and their parameters.
3. Frontend switches UI to “Session active”.

#### Flow B – Voice command → Music change

1. User presses mic button and speaks:
   > “Give me a lofi beat at 82 BPM with soft kick and vinyl noise, in D minor.”
   >
2. Frontend:
   * Records audio and sends it to the backend.
3. Backend:
   * Converts audio → text (using Gemini or any STT).
   * Sends the text, plus current audio analysis + state, to Gemini.
4. Gemini:
   * Understands the request.
   * Calls appropriate **tools** (e.g. `createBeat`, `createBassline`, `setFX`).
5. Tool handlers:
   * Translate those high-level tools into one or more MCP calls to the Strudel server:
     * `set_tempo(82)`
     * `generate_drums("lofi")`
     * `generate_bassline("D minor")`
     * `add vinyl noise` using existing Strudel pattern or sample tools.
6. Strudel MCP server:
   * Updates the Strudel.cc session, starts/updates playback.
7. Backend returns:
   * A short textual summary to the frontend (“Created a lofi beat at 82 BPM in D minor…”).
8. Frontend:
   * Updates UI (BPM, track states, log messages).

#### Flow C – Continuous “AI listening”

* A background loop on the backend calls the MCP `analyze` tool regularly:
  * MCP returns structured data, e.g.:
    * `peakFrequencyHz: 120`
    * `bassEnergy: 0.8`, `midEnergy: 0.4`, `highEnergy: 0.3`
  * This is stored and fed into the next prompt to Gemini.
* Example behavior:
  * If low-end is too strong, AI may decide on its own:
    * To lower bass gain (`setFX` on bass track),
    * Or to make the hi-hats brighter,
    * Or to slightly reduce kick level.

---

### Tech & Implementation Details

* **Language:** TypeScript everywhere (frontend + backend).
* **Frontend:**
  * React with a single main page.
  * Simple component structure:
    * `<SessionStatus />`
    * `<MicButton />`
    * `<TrackOverview />`
    * `<LogPanel />`
  * Use WebSockets or SSE to receive real-time updates.
* **Backend:**
  * Node + Express or Next.js API routes.
  * `mcpClient.ts`:
    * Handles JSON-RPC/WebSocket connection to the Strudel MCP server.
    * Exposes methods like `mcpInit()`, `mcpGenerateDrums()`, `mcpAnalyze()`.
  * `aiBridge.ts`:
    * Configures Gemini with tools.
    * Maps tool calls → `mcpClient` calls.
  * `sessionManager.ts`:
    * Keeps per-session state (tempo, scale, tracks, last analysis).
* **Config:**
  * `.env` with:
    * `GOOGLE_API_KEY`
    * `MCP_STRUDEL_COMMAND` (e.g. `strudel-mcp`)
    * `NODE_ENV`, etc.
* **Deliverables:**
  * Fully working local app (`npm install`, `npm run dev`).
  * README with:
    * How to install Strudel MCP server.
    * How to configure `.env`.
    * How to start backend + frontend.
    * How to run a simple voice → beat test.
