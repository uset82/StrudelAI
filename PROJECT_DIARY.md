# 🎵 AETHER SONIC INTERFACE - Project Diary

**Live Coding Music Platform for Festivals**  
*AI-Powered Strudel Code Generation with Real-Time Audio Analysis*

---

## 📋 Project Overview

**AETHER** is a cutting-edge live-coding music application designed for festival performances. It combines the power of AI (specifically x-ai/grok-4.1-fast) with Strudel (a JavaScript port of TidalCycles) to enable real-time, voice-controlled music generation with professional-grade audio analysis and layering capabilities.

### Core Concept
- **Live Performance**: Built specifically for live coding festivals where artists need to build tracks layer-by-layer in real-time
- **AI Collaboration**: The AI acts as a collaborative partner, understanding musical context and generating musically coherent patterns
- **Layer-Based Architecture**: Inspired by Ableton Live, separating music into distinct tracks (Drums, Bass, Melody, FX)

---

## 🛠️ Technology Stack

### Frontend Framework
- **Next.js 16.0.3 (Turbopack)**: React-based framework for server-side rendering and API routes
- **TypeScript**: Type-safe development throughout the codebase
- **React 19.2.0**: Latest React features for state management and hooks

### Audio Engine
- **Strudel**: JavaScript port of TidalCycles for live coding music
  - `@strudel/core`: Core pattern and rhythm engine
  - `@strudel/mini`: Mini-notation parser for concise pattern syntax
  - `@strudel/webaudio`: Web Audio API integration
- **Superdough**: Advanced audio synthesis engine
  - Waveform synthesis (square, triangle, sawtooth, sine, supersaw)
  - Built-in effects (reverb, delay, distortion, filters)
  - Real-time audio analysis via AnalyserNode

### AI Integration
- **OpenRouter API**: Gateway to access multiple AI models
- **x-ai/grok-4.1-fast**: Primary AI model for code generation
  - Used for music generation (agent endpoint)
  - Used for code completion (autocomplete endpoint)
- **Google Gemini API**: Available as fallback/alternative
- **MusicGen (Meta/Audiocraft)**: AI audio generation model
  - Real audio stem generation (drums, bass, melody, voice, fx)
  - GPU-accelerated inference via PyTorch/CUDA
  - Models: facebook/musicgen-small, musicgen-medium, musicgen-melody

### Audio Analysis & Processing
- **librosa**: Python library for audio analysis
  - BPM detection via beat tracking
  - Key detection via chroma features
  - Onset detection for drum pattern extraction
  - Pitch tracking for melody extraction
- **yt-dlp**: YouTube audio downloader
- **FFmpeg**: Audio format conversion (webm → wav)

### Real-Time Communication
- **Socket.IO**: WebSocket-based bidirectional communication
  - Server-to-client state sync
  - Client-to-server command transmission
  - Real-time audio analysis streaming

### Browser APIs
- **Web Speech API**: Voice command recognition
  - Continuous listening mode
  - Error handling and offline detection
- **Web Audio API**: Low-level audio processing
  - FFT analysis (8192 bins)
  - Frequency domain analysis
  - Time domain (waveform) analysis

### Python Servers
- **YouTube-to-Strudel Server** (Port 5002): Converts YouTube audio to Strudel code
- **MusicGen Server** (Port 5001): Generates AI audio samples

### UI/Styling
- **Tailwind CSS**: Utility-first CSS framework (if used)
- **Custom CSS**: Cyberpunk/terminal aesthetic
  - Matrix-inspired green/cyan color scheme
  - Glow effects and animations
  - Glassmorphism effects

---

## 🎯 Key Features

### 1. AI-Powered Music Generation
- **Natural Language Input**: "Make a techno beat", "Add a bassline"
- **Context-Aware**: AI analyzes current code, frequency data, and tempo
- **Structured Output**: Returns track-specific patterns (drums, bass, melody, fx)
- **Auto-Fix**: Automatically detects and fixes syntax errors

### 2. Ableton-Style Track Layering
- **5 Track System**:
  - 🥁 **Drums**: Percussive elements (kicks, snares, hi-hats)
  - 🎸 **Bass**: Sub-bass and basslines
  - 🎹 **Melody**: Lead synths, arpeggios, chords
  - 🎤 **Voice**: Vocal synthesis, speech, choir effects
  - ✨ **FX**: Atmospheric sounds, risers, impacts
- **Non-Destructive Layering**: New patterns add to existing ones rather than replacing
- **Mute/Solo**: Independent control over each track
- **Volume Control**: Per-track gain staging

### 3. Real-Time Audio Analysis
- **Frequency Analysis**:
  - RMS Level (overall amplitude)
  - Peak Frequency detection
  - Spectral Centroid (tonal center)
  - Energy distribution (Low/Mid/High bands)
- **AI Context**: Analysis data is sent to AI to ensure musical coherence
  - Prevents adding sub-bass when low frequencies are already saturated
  - Suggests high-frequency elements when mix is muddy
- **Visual Feedback**: Ableton-style spectrum analyzer

### 4. Live Coding Interface
- **Syntax-Highlighted Editor**: Monaco-like code view
- **Auto-Completion**: AI-powered suggestions via Grok
- **Auto-Run**: Debounced execution on code changes
- **Error Highlighting**: Real-time syntax error detection

### 5. Voice Control
- **Speech Recognition**: Continuous listening mode
- **Command Processing**: Natural language parsing
- **Offline Detection**: Graceful handling of network issues
- **Permission Management**: Microphone access handling

### 6. Musical Coherence System
- **Key Matching**: Ensures new layers are in the same key as existing music
- **Frequency Space Awareness**: Analyzes spectral content to avoid clashing
- **Tempo Sync**: All tracks share the same BPM
- **Dynamic Gain Staging**: Auto-adjusts volume to prevent clipping

### 7. YouTube-to-Strudel Conversion (NEW)
- **URL Detection**: Recognizes YouTube links in chat
- **Audio Download**: Fetches audio via yt-dlp
- **BPM Detection**: Analyzes tempo using librosa beat tracking
- **Key Detection**: Determines musical key via chroma analysis
- **Pattern Extraction**: Detects drum, bass, and melody patterns
- **Code Generation**: Creates playable Strudel patterns

### 8. DJ Controller / DJ Mixer Mode (NEW)
- **Two Decks**: Mix synthetic Strudel patterns with uploaded audio tracks (WebAudio `AudioBuffer`)
- **Mixer Controls**: 3-band EQ, filter, channel faders, crossfader, master volume, master pitch
- **Performance Pads**:
  - **Hot Cue / Pitch Play**: Jump to cues; Shift enables pitch-play behavior
  - **Loop (Bounce Loop)**: Hold 1/2/4/8 beat loops (quantized when beatgrid/downbeat is provided)
  - **FX (Slicer)**: Beat-jump/slicer workflow for uploaded tracks
  - **Neural Mix (Sampler)**: Trigger synth/percussion one-shots (MVP; captured loops next)
- **Sync Tools**: Tempo Sync (latching), AI Beat Match (tempo + phase alignment when beatgrid exists)

---

## 📁 Project Structure

```
musicAPP/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/
│   │   │   │   └── route.ts          # Main AI music generation + YouTube integration
│   │   │   ├── complete/
│   │   │   │   └── route.ts          # Code completion endpoint
│   │   │   └── socket/
│   │   │       └── route.ts          # WebSocket server (if used)
│   │   ├── page.tsx                  # Main app page
│   │   └── layout.tsx                # Root layout
│   ├── components/
│   │   ├── SonicInterface.tsx        # Main UI component
│   │   ├── SpectrumAnalyzer.tsx      # Frequency visualization
│   │   ├── ArrangementView.tsx       # Ableton-style timeline view
│   │   ├── TrackStrip.tsx            # Individual track controls
│   │   └── StrudelCodeView.tsx       # Code editor component
│   ├── hooks/
│   │   └── useSonicSocket.ts         # WebSocket & state management hook
│   ├── lib/
│   │   ├── ai/
│   │   │   └── client.ts             # OpenRouter/OpenAI client config
│   │   ├── agent/
│   │   │   ├── runtime.ts            # Agent message processing
│   │   │   ├── tool-bridge.ts        # Tool execution bridge
│   │   │   └── context-manager.ts    # Conversation context
│   │   ├── musicgen/
│   │   │   └── client.ts             # MusicGen API client
│   │   └── strudel/
│   │       └── engine.ts             # Strudel audio engine wrapper
│   └── types/
│       └── sonic.ts                  # TypeScript type definitions
├── tools/                             # Python utilities
│   ├── youtube_to_strudel.py         # YouTube audio analyzer + Strudel generator
│   ├── musicgen_server.py            # MusicGen AI audio server
│   ├── musicgen_batch.py             # Batch audio generation
│   └── musicgen_trainer.py           # Model fine-tuning (experimental)
├── knowledge.md                       # Strudel syntax reference for AI
├── package.json
├── tsconfig.json
└── .env.local                        # API keys (not in repo)
```

---

## 🔧 Core Algorithms & Logic

### 1. Code Sanitization Pipeline
**Purpose**: Clean AI-generated code to prevent runtime errors

**Steps**:
1. Remove markdown bullets/list markers
2. Strip forbidden methods (`.analyze()`, `cpm()`, `.bank()`, `.slider()`)
3. Replace aliases (`.lpf()` → `.lowpass()`)
4. Clean dangling commas
5. Coerce loose lines into `stack()` if needed
6. Detect and truncate run-on code hallucinations
7. Balance parentheses

**Location**: `src/app/api/agent/route.ts` - `sanitizeGeneratedCode()`

### 2. Track Update System
**Purpose**: Enable Ableton-style layer-by-layer building

**Flow**:
```
User: "Add drums"
  ↓
AI Agent: Generates structured JSON
  {
    "type": "update_tracks",
    "tracks": {
      "drums": "note(m('c3*4')).s('square').decay(0.05)",
      "bass": null,
      "melody": null,
      "fx": null
    }
  }
  ↓
Client: Merges with existing state
  - Only updates non-null tracks
  - Preserves patterns on other tracks
  ↓
Strudel Engine: Rebuilds stack
  stack(
    drums_pattern,
    bass_pattern,
    melody_pattern,
    fx_pattern
  )
```

**Location**: 
- API: `src/app/api/agent/route.ts`
- Client: `src/hooks/useSonicSocket.ts` (line ~320)

### 3. Frequency Analysis Loop
**Purpose**: Provide real-time spectral data to AI for musical decisions

**Metrics Computed**:
- **RMS**: `sqrt(Σ(sample²) / N)` - Overall loudness
- **Peak Frequency**: Frequency bin with highest magnitude
- **Spectral Centroid**: `Σ(freq × magnitude) / Σ(magnitude)` - "Center of mass" of spectrum
- **Energy Bands**: Low (0-⅓), Mid (⅓-⅔), High (⅔-1) frequency ranges

**Update Rate**: 500ms (throttled to reduce overhead)

**Location**: `src/hooks/useSonicSocket.ts` (line ~183-262)

### 4. AI Prompt Engineering
**System Prompt Components**:
1. **Role Definition**: "You are a virtuoso live-coding music assistant"
2. **Context**: "Live Coding Festival - Build layer by layer"
3. **Critical Rules**: Preserve existing code, match key, avoid frequency clashing
4. **Workflow**: Analyze → Plan → Draft → Output
5. **Command Detection**: Chat vs. Meta vs. Music generation
6. **Output Format**: JSON with track updates
7. **Allowed/Forbidden Methods**: Explicit lists
8. **Examples**: Few-shot learning

**Knowledge Injection**: 
- Entire `knowledge.md` file (~600 lines) appended to system prompt
- Contains Strudel syntax, patterns, examples, best practices

**Location**: `src/app/api/agent/route.ts` (SYSTEM_PROMPT constant)

---

## 🚀 Development Milestones

### Phase 1: Foundation (Early Development)
- ✅ Next.js project setup
- ✅ Strudel integration
- ✅ Basic audio playback
- ✅ WebSocket communication

### Phase 2: AI Integration (November 2024)
- ✅ OpenRouter API integration
- ✅ Gemini 2.0 Flash initial testing
- ✅ Migration to Grok-4.1-fast
- ✅ Code completion endpoint
- ✅ System prompt optimization

### Phase 3: Musical Intelligence (Recent)
- ✅ Frequency analysis system
- ✅ AI context augmentation (send frequency data to AI)
- ✅ Key matching logic
- ✅ Frequency space awareness

### Phase 4: Layering System (Latest - Nov 23-24, 2024)
- ✅ Track-based architecture (Drums/Bass/Melody/FX)
- ✅ Structured AI responses (`update_tracks` type)
- ✅ Non-destructive layering
- ✅ State management for individual tracks
- ✅ Ableton-style UI grid

### Phase 5: Refinement (Ongoing)
- ✅ Code sanitization improvements
- ✅ Run-on code detection
- ✅ Auto-fix for syntax errors
- ✅ Knowledge base expansion (knowledge.md)

---

## 🐛 Known Issues & Solutions

### Issue 1: AI Deleting Previous Code
**Problem**: Grok would replace entire patterns instead of layering  
**Solution**: Implemented structured `update_tracks` response type  
**Status**: ✅ Resolved

### Issue 2: Run-On Code Hallucinations
**Problem**: AI would output `stack(...))stack(...)` - valid code followed by garbage  
**Solution**: Regex detection and truncation at first run-on pattern  
**Status**: ✅ Resolved

### Issue 3: Frequency Clashing
**Problem**: Multiple sub-bass layers causing muddy mix  
**Solution**: Send real-time frequency analysis to AI, instruct it to check low energy before adding bass  
**Status**: ✅ Resolved

### Issue 4: Forbidden Methods Breaking Execution
**Problem**: AI using `.scale()`, `cpm()`, `.analyze()` which aren't available  
**Solution**: Multi-layer sanitization (system prompt + code stripping)  
**Status**: ✅ Resolved

### Issue 5: Tempo Desync
**Problem**: Patterns running at different speeds  
**Solution**: Centralized `cpm()` in buildStrudelCode, all patterns share one BPM  
**Status**: ✅ Resolved

---

## 📊 Performance Characteristics

### Audio Metrics
- **Latency**: ~10-30ms (Web Audio API scheduling)
- **Sample Rate**: 48kHz (browser default)
- **FFT Size**: 8192 bins (high-resolution spectrum)
- **Analysis Update Rate**: 500ms (balances accuracy & performance)

### AI Response Times (Grok-4.1-fast)
- **Simple Requests**: 1-3 seconds
- **Complex Requests**: 3-6 seconds
- **Auto-Completion**: <1 second (15 tokens max)

### Memory Usage
- **Base Application**: ~50-80 MB
- **With Audio Context**: ~100-150 MB
- **Per Track Pattern**: ~1-2 KB

---

## 🎓 Strudel Syntax Primer

### Mini-Notation Basics
```javascript
// Rhythm patterns
"c3 ~ c3 ~"           // Kick on beats 1 and 3
"c3*4"                // Kick on every quarter note
"c3*8"                // Kick on every eighth note
"[c3 e3 g3]"          // Subdivision (play all 3 in time of 1)
"<c3 e3>"             // Alternation (different note each cycle)

// Modifiers
.s("square")          // Synth waveform
.decay(0.05)          // Envelope decay
.sustain(0.2)         // Envelope sustain
.gain(0.8)            // Volume (0-1)
.fast(2)              // Double speed
.slow(2)              // Half speed
.room(0.5)            // Reverb
.delay(0.25)          // Delay effect
```

### Forbidden in This Environment
- `.scale()` - Not available in webaudio version
- `.cpm()`, `setcpm()` - Handled by engine
- `.analyze()` - Managed by our wrapper
- `.lpf()`, `.hpf()` - Use `.lowpass()`, `.highpass()`

---

## 🔐 Environment Variables

```env
# Required
OPENROUTER_API_KEY=sk-or-v1-xxxxx...

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
MODEL_NAME=x-ai/grok-4.1-fast
GOOGLE_API_KEY=AIzaSy...  # For Gemini fallback
```

---

## 🎯 Future Roadmap

### Short-Term (Next Sprint)
- [ ] Visual track timeline (Ableton-style arrangement view)
- [ ] MIDI controller support
- [ ] Export to audio file (.wav/.mp3)
- [ ] Preset library (save/load patterns)

### Mid-Term (Next Month)
- [ ] Collaborative sessions (multiple users)
- [ ] Pattern randomization/mutation
- [ ] Advanced effects (flanger, phaser, compressor)
- [ ] Visual waveform editor

### Long-Term (Vision)
- [ ] Multi-model AI ensemble (Grok + Claude + GPT)
- [ ] ML-powered pattern suggestions
- [ ] Integration with hardware synthesizers
- [ ] AR/VR visualization mode
- [ ] Live streaming integration

---

## 👥 Development Team

**Project Type**: Solo development with AI assistance (Gemini/Claude)  
**Target Audience**: Live coders, electronic music producers, festival performers  
**License**: (To be determined)

---

## 📚 References & Inspiration

### Technologies
- [Strudel Documentation](https://strudel.cc/)
- [TidalCycles](https://tidalcycles.org/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [OpenRouter](https://openrouter.ai/)

### Design Inspiration
- Ableton Live (track layering)
- Sonic Pi (live coding)
- Hydra (visual synthesis)

---

## 📝 Development Log

### 2025-12-15
- **DJ Controller MVP**: Controller-style mixer + performance workflow
  - FLX4-inspired DJ mixer UI with scale-to-fit layout (no overlap at 100% zoom)
  - WebAudio uploaded decks (`AudioBuffer`) + beatgrid JSON import
  - Fixed Deck 2 load/play issues when audio init happens after selecting tracks
  - Added per-deck Tempo Sync (latching), Shift, and pad modes: Hot Cue/Pitch Play, Loop (Bounce Loop), FX (Slicer), Neural Mix (Sampler)
  - Synplant "Quick Build-Ups / Drops" now forces audio init so presets actually play
  - Verified `npm run build` passes

### 2025-12-01
- **Evening**: YouTube-to-Strudel Integration (Continued)
  - Fixed FFmpeg PATH issues for audio extraction
  - Restarted YouTube server with proper environment variables
  - Debugged "Unexpected token ','" syntax errors in generated code
  - Fixed Python generator to output synthesized sounds instead of sample-based sounds
  - Updated code sanitizer to handle `$:` prefix and replace `s("bd")`, `s("sd")`, `s("hh")` patterns
  - Added debug logging to trace raw code → parsed tracks → sanitized tracks

### 2025-11-30
- **Full Day**: YouTube-to-Strudel Feature Development
  - Created `tools/youtube_to_strudel.py` - Full audio analysis pipeline:
    - Downloads YouTube audio using yt-dlp
    - Converts to WAV using FFmpeg
    - Analyzes BPM using librosa beat tracking
    - Detects musical key using chroma features
    - Extracts drum patterns (kick, snare, hihat) via spectral analysis
    - Detects bass notes (60-250 Hz range)
    - Extracts melody notes (250-2000 Hz range)
    - Generates Strudel code with synthesized sounds
  - Integrated into chat API (`src/app/api/agent/route.ts`):
    - Added `detectYouTubeURL()` - Recognizes youtube.com and youtu.be links
    - Added `analyzeYouTubeVideo()` - Calls Python server for audio analysis
    - Added `parseStrudelCodeToTracks()` - Splits code into drums/bass/melody/voice/fx
    - Returns `update_tracks` response with YouTube metadata (title, artist, BPM, key)
  - Installed dependencies: yt-dlp, librosa, flask, flask-cors
  - Installed FFmpeg via `winget install Gyan.FFmpeg`
  - Server runs on port 5002: `python tools/youtube_to_strudel.py --server`

- **MusicGen Integration** (Earlier):
  - Created `tools/musicgen_server.py` - AI audio generation server
  - Uses Facebook's MusicGen model for generating real audio stems
  - Supports stem types: drums, bass, melody, voice, fx
  - GPU acceleration with CUDA support
  - Integrated into agent route with `detectMusicGenRequest()` trigger

### 2024-11-23
- **23:00-00:19**: Implemented Ableton-style layering system
  - Updated SYSTEM_PROMPT to output structured track data
  - Modified API to handle `update_tracks` response type
  - Enhanced useSonicSocket to merge track updates
  - Verified with test scripts: SUCCESS
  - Fixed code sanitization logic restoration

### 2024-11-23 (Earlier)
- **Evening**: Frequency analysis integration
  - Added real-time FFT analysis
  - Implemented spectral centroid calculation
  - Created energy band distribution (low/mid/high)
  - Updated AI prompt to use frequency data for musical decisions

### 2024-11-20 - 2024-11-22
- Various bug fixes and improvements
- Migration from Gemini to Grok-4.1-fast
- Knowledge base expansion
- Code sanitization enhancements

---

## 🆕 New Features (December 2025)

### YouTube-to-Strudel Converter
**Purpose**: Paste a YouTube link and the AI generates Strudel code that approximates the song's rhythm, bass, and melody.

**How it works**:
1. User pastes YouTube URL in chat
2. System detects URL pattern (youtube.com/watch, youtu.be, etc.)
3. Python server downloads audio (30s by default)
4. Librosa analyzes: BPM, key, drum onsets, bass frequencies, melody pitches
5. Generator creates Strudel patterns using synthesized sounds
6. Code is parsed into tracks and sent back to UI

**Technical Stack**:
- **yt-dlp**: YouTube downloader
- **FFmpeg**: Audio conversion (webm → wav)
- **librosa**: Audio analysis (tempo, chroma, onset detection)
- **Flask**: HTTP server for the converter

**Generated Code Example**:
```javascript
// Drums - Synthesized kick, snare, hihat
stack(
  note("c2").struct("x ~ x ~").s("square").decay(0.08).lpf(150).gain(0.9),
  note("c3").struct("~ x ~ x").s("square").hpf(400).decay(0.06).gain(0.7),
  note("c6*8").s("pink").hpf(8000).decay(0.02).gain(0.4)
)

// Bass - Detected bass notes
note("e2 g2 a2 b2").s("sawtooth").lpf(400).decay(0.2).sustain(0.3).gain(0.6)

// Melody - Detected melody notes  
note("e4 g4 a4 b4").s("triangle").decay(0.3).sustain(0.4).delay(0.2).gain(0.5)
```

### MusicGen AI Audio Generation
**Purpose**: Generate real AI audio samples using Meta's MusicGen model (from Audiocraft).

**Model Options**:
- `facebook/musicgen-small` (300M params, fast)
- `facebook/musicgen-medium` (1.5B params, better quality)
- `facebook/musicgen-melody` (1.5B params, melody conditioning)

**Trigger phrases**: "generate real drums", "ai bass", "musicgen melody"

**Server**: Runs on port 5001 with GPU acceleration

**Reference**: [github.com/facebookresearch/audiocraft](https://github.com/facebookresearch/audiocraft)

---

## 🎉 Key Achievements

1. **✅ Zero Sample Dependencies**: All sounds generated via synthesis (robust, no loading issues)
2. **✅ Musical Intelligence**: AI understands harmony, rhythm, and frequency space
3. **✅ Live Performance Ready**: Designed for festival use with voice control
4. **✅ Non-Destructive Workflow**: Layer-based editing preserves existing work
5. **✅ Real-Time Analysis**: 500ms update loop provides instant feedback
6. **✅ Fault Tolerance**: Auto-fix errors, sanitize code, graceful degradation
7. **✅ YouTube Integration**: Paste a link, get playable Strudel code
8. **✅ MusicGen Support**: AI-generated real audio stems (when GPU available)

---

**Last Updated**: 2025-12-15  
**Version**: 0.6.0-alpha (Pre-release)  
**Status**: 🟢 Active Development
