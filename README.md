# 🎵 StrudelAI - Aether Sonic Interface

**AI-Powered Live Coding Music System** with Voice Control, Synplant Genetic Sound Design, and Professional DJ Tools.

🌐 **Live Demo:** [https://strudelzeroai.app.canner.ca/](https://strudelzeroai.app.canner.ca/) (or mirror at [https://strudelai.netlify.app](https://strudelai.netlify.app))

Built for **live coding festivals**, music producers, and creative technologists - create music layer-by-layer with natural language commands, voice control, genetic sound evolution, and AI-powered pattern generation.

---

## ✨ Features

### Core Features
- **🎤 Voice Control:** Speak natural language commands to create music
- **🤖 AI-Powered:** Uses [DeepSeek V3.1 Nex N1](https://openrouter.ai/nex-agi/deepseek-v3.1-nex-n1:free) (free) via OpenRouter
- **🎹 Live Coding Engine:** Generates Strudel (TidalCycles) patterns in real-time
- **📊 Real-Time Analysis:** FFT spectrum analyzer with frequency band visualization
- **🎚️ Track Layering:** Ableton-style 5-track system (Drums, Bass, Melody, Voice, FX)

### 🎙️ Voice Synthesizer / Voice Lab (NEW)
Browser-native voice processing and synthesis suite:
- **Text-to-Speech (TTS):** Custom presets (Robot, Alien, Cyber-Chant, Deep-Space, Whisper) powered by the Web Speech API.
- **Audio Recording:** Live microphone capture with real-time feedback.
- **Waveform Rendering:** Interactive wave visualizer using WaveSurfer.js.
- **Multi-Effects DSP Chain:** Real-time processing via Tone.js (Pitch Shift, Distortion, BitCrusher, Chorus, Tremolo, Delay, Reverb).
- **Procedural Ambience Layering:** Layer background noise (rain, wind, thunder, space hum, telemetry alerts) using synthesized sound generators.
- **WAV Export & Registering:** Build-to-file exports using Tone.Offline and custom binary WAV encoding, automatically registered into the Strudel audio workspace.
- **AI Commands:** Automatically configure settings, presets, and text using voice/text chat commands.

### 🌱 Synplant Garden (NEW - December 2025)
Grow and evolve sounds using genetic algorithms, inspired by Sonic Charge's Synplant:
- **Genetic Sound Design:** Seeds that grow into unique instrument sounds
- **3-Tab Interface:** Grow / Tweak / DJ modes for different workflows
- **Forest Grid:** 3x3 seed visualization with mutation controls
- **Parent Seed System:** Evolve sounds from a parent seed
- **Garden Shelf:** Save and organize your favorite sound seeds
- **Mutation Depths:** Gentle → Wild → Chaotic → Extreme mutations
- **FX Options:** Filter, Reverb, Delay, and Neuro effects per seed
- **Build-up/Drop Presets:** Riser, Sweep, Tension, Pitch Rise for transitions

### 🎛️ DJ Mixer View (NEW)
Professional dual-deck DJ interface with:
- **Dual Decks (A/B):** Load and mix synthetic or uploaded tracks
- **EQ Controls:** 3-band EQ (Low, Mid, High) per deck
- **Filter Knob:** Resonant filter sweep for DJ transitions
- **Crossfader:** Smooth mixing between decks
- **Pad Performance:** 8 pads per deck with FX (Reverb, Echo, Roll, Filter)
- **Track Library:** Built-in Techno and Acid presets
- **Audio Upload:** Load your own audio files with BPM detection
- **Beatgrid Import:** Sync BPM and downbeat across decks

### 🎬 YouTube-to-Strudel
- Paste a YouTube link and get playable Strudel code that approximates the song
- Automatic BPM, key, drum, bass, and melody detection

### 🧠 MusicGen Integration
- Generate real AI audio samples using Facebook's MusicGen model
- Create drums, bass, melody, and FX with natural language prompts

### 👁️ Frequency Awareness
- AI analyzes current audio to avoid frequency clashing
- Smart layering recommendations

---

## 🚀 Quick Start

### 1. Install Node.js Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file:

```env
# Required
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional
GOOGLE_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
MODEL_NAME=nex-agi/deepseek-v3.1-nex-n1:free
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🎮 Usage Guide

### Main Views

The app has multiple views accessible from the navigation:

1. **🎹 Sonic Interface** - Main AI-powered music creation
2. **🌱 Synplant Garden** - Genetic sound design and evolution
3. **🎛️ DJ Mixer** - Professional dual-deck mixing
4. **🎙️ Voice Lab** - Advanced Voice Synthesis & Effects processing
5. **📝 Strudel Code** - Direct code editing with live preview

### Synplant Garden Workflow

1. **Grow Tab:** Watch seeds evolve into sounds
2. **Tweak Tab:** Fine-tune parameters (Attack, Decay, Filter, etc.)
3. **DJ Tab:** Access build-ups, drops, and transition tools
4. Click any seed to hear it, long-press to apply to a track

### DJ Mixer Workflow

1. Load tracks to Deck A and Deck B
2. Use EQ and filter to shape each deck
3. Use the crossfader to mix between decks
4. Trigger pads for live effects and sounds

### Voice Lab Workflow

1. **Synthesize/Record:** Select a preset and generate voice using Text-to-Speech, or record live audio using your microphone.
2. **Shape Audio:** Customize Pitch, Distortion, Filter, Delay, and Reverb via the DSP Effects Chain sliders.
3. **Layer Ambience:** Add procedural background layers (e.g. Space Hum, Wind, or Telemetry Alerts) and adjust their mix level.
4. **Export & Integrate:** Export the custom processed clip as a WAV file. It will automatically compile and register into the Strudel runtime, ready to be sequenced using code (e.g. `s("voice")`).

### Voice/Text Commands

**Creating Music:**
- "Start a techno beat at 130 BPM"
- "Add a dark bassline"
- "Create an ethereal melody"
- "Add some atmospheric FX"

**Controlling Playback:**
- "Stop" or "Silence"
- "Clear all tracks"
- "Mute the melody"

---

## 🎬 YouTube-to-Strudel Setup (Optional)

### Requirements

1. **Python 3.10+** with pip
2. **FFmpeg** (for audio conversion)

### Installation

```bash
# Install FFmpeg (Windows)
winget install Gyan.FFmpeg

# Or on macOS
brew install ffmpeg

# Install Python dependencies
pip install yt-dlp librosa flask flask-cors numpy scipy
```

### Running the YouTube Server

```bash
python tools/youtube_to_strudel.py --server
```

---

## 🧠 MusicGen Setup (Optional - Requires GPU)

### Requirements

- **NVIDIA GPU** with CUDA support (8GB+ VRAM recommended)
- **Python 3.10+**
- **PyTorch with CUDA**

### Installation

```bash
# Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/macOS

# Install PyTorch with CUDA
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# Install MusicGen dependencies
pip install transformers accelerate flask flask-cors
```

### Running the MusicGen Server

```bash
python tools/musicgen_server.py
```

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Modern utility-first styling
- **Lucide React** - Icon library

### Backend
- **Node.js** - Custom server with Socket.IO
- **Socket.IO** - Real-time WebSocket communication

### AI
- **Google Gemini** - Primary AI model
- **Grok** - Alternative AI (via OpenRouter)
- **MusicGen** - Meta's AI audio generation (optional)

### Audio
- **Strudel** - JavaScript port of TidalCycles
- **Superdough** - Audio synthesis engine
- **Web Audio API** - Browser audio processing

### Validation & Guardrails
- **StrudelCodeAudioValidationAgent** - Multi-skill validation pipeline verifying syntax, scale alignment (target key), instrument intent (valid sample aliases vs. request), sample index limits, and expected vs. analyzed frequency energy (kick, snare, hi-hat).

### Analysis Tools (Python)
- **librosa** - Audio analysis library
- **yt-dlp** - YouTube downloader
- **FFmpeg** - Audio conversion

---

## 📁 Project Structure

```
StrudelAI/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/route.ts    # AI music generation + YouTube
│   │   │   └── complete/route.ts # Code autocomplete
│   │   ├── page.tsx              # Main app entry
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   ├── SonicInterface.tsx    # Main AI music UI
│   │   ├── SynplantGarden.tsx    # Genetic sound design
│   │   ├── DJMixerView.tsx       # Dual-deck DJ interface
│   │   ├── VoiceSynthesizer.tsx  # Advanced Voice Lab interface
│   │   ├── StrudelCodeView.tsx   # Live code editor
│   │   ├── SpectrumAnalyzer.tsx  # FFT visualization
│   │   ├── TrackStrip.tsx        # Track controls
│   │   └── ArrangementView.tsx   # Timeline view
│   ├── hooks/
│   │   └── useSonicSocket.ts     # WebSocket + state management
│   ├── lib/
│   │   ├── strudel/engine.ts     # Audio engine with layer system
│   │   ├── synplant/genome.ts    # Genetic sound algorithms
│   │   ├── dj/audio-deck.ts      # DJ deck audio processing
│   │   ├── gemini/client.ts      # Gemini AI client
│   │   ├── musicgen/client.ts    # MusicGen AI client
│   │   └── voice-synthesizer/    # Voice DSP, presets & export
│   └── types/
│       └── sonic.ts              # TypeScript interfaces
├── tools/
│   ├── youtube_to_strudel.py     # YouTube audio analyzer
│   ├── musicgen_server.py        # AI audio generation server
│   └── musicgen_batch.py         # Batch audio generation
├── server.ts                     # Custom Socket.IO server
├── package.json
└── .env.local                    # API keys (create this)
```

---

## 🔧 Troubleshooting

### "No audio playing"
1. Click the **Play** button to start playback
2. Make sure your browser allows audio autoplay
3. Check browser console for errors

### "YouTube server not running"
```bash
python tools/youtube_to_strudel.py --server
```

### "FFmpeg not found"
```bash
# Windows - refresh PATH after installing FFmpeg:
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### "Rate limited"
- API rate limits apply. Wait a moment and try again.
- Consider upgrading your API plan for higher limits.

---

## 📜 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Strudel](https://strudel.cc/) - Live coding music framework
- [TidalCycles](https://tidalcycles.org/) - Original live coding language
- [Synplant](https://soniccharge.com/synplant) - Inspiration for genetic sound design
- [Google Gemini](https://ai.google.dev/) - AI language model
- [OpenRouter](https://openrouter.ai/) - AI model gateway
- [MusicGen / Audiocraft](https://github.com/facebookresearch/audiocraft) - Meta's AI audio generation
