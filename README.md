# 🎵 StrudelAI - Aether Sonic Interface

**AI-Powered Live Coding Music System** with Voice Control, Synplant Genetic Sound Design, and Professional DJ Tools.

🌐 **Live Demo:** Canner deployment — public URL pending

Built for **live coding festivals**, music producers, and creative technologists - create music layer-by-layer with natural language commands, voice control, genetic sound evolution, and AI-powered pattern generation.

---

## ✨ Features

### Core Features
- **🎤 Voice Control:** Speak natural language commands to create music
- **🤖 AI-Powered:** Uses [Nex N2 Pro](https://openrouter.ai/nex-agi/nex-n2-pro:free) (free) via OpenRouter
- **🎹 Live Coding Engine:** Generates Strudel (TidalCycles) patterns in real-time
- **📊 Real-Time Analysis:** FFT spectrum analyzer with frequency band visualization
- **🎚️ Track Layering:** Ableton-style 5-track system (Drums, Bass, Melody, Voice, FX)

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
MODEL_NAME=nex-agi/nex-n2-pro:free
```

On Canner, set `NEXT_PUBLIC_APP_URL` to the public deployment URL shown after a successful deploy. Do not use the dashboard URL: it is for project management, not the app's public origin.

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
4. **📝 Strudel Code** - Direct code editing with live preview

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
│   │   └── musicgen/client.ts    # MusicGen AI client
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
