# 🎵 Aether Sonic Interface

**Voice-Controlled AI Live Coding Music Assistant** powered by Strudel and Grok-4.1-fast (via OpenRouter).

Built for **live coding festivals** - create music layer-by-layer with natural language commands, voice control, and AI-powered pattern generation.

---

## ✨ Features

### Core Features
- **🎤 Voice Control:** Speak natural language commands to create music
- **🤖 AI-Powered:** Uses Grok-4.1-fast (via OpenRouter) to interpret musical intent
- **🎹 Live Coding Engine:** Generates Strudel (TidalCycles) patterns in real-time
- **📊 Real-Time Analysis:** FFT spectrum analyzer with frequency band visualization
- **🎚️ Track Layering:** Ableton-style 5-track system (Drums, Bass, Melody, Voice, FX)

### New Features (December 2025)
- **🎬 YouTube-to-Strudel:** Paste a YouTube link and get playable Strudel code that approximates the song
- **🧠 MusicGen Integration:** Generate real AI audio samples using Facebook's MusicGen model
- **👁️ Frequency Awareness:** AI analyzes current audio to avoid frequency clashing

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
NEXT_PUBLIC_APP_URL=http://localhost:3000
MODEL_NAME=x-ai/grok-4.1-fast
GOOGLE_API_KEY=your_google_api_key  # For Gemini fallback
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🎬 YouTube-to-Strudel Setup (Optional)

This feature lets you paste a YouTube link and generate Strudel code that matches the song's rhythm, bass, and melody.

### Requirements

1. **Python 3.10+** with pip
2. **FFmpeg** (for audio conversion)

### Installation

```bash
# Install FFmpeg (Windows)
winget install Gyan.FFmpeg

# Or on macOS
brew install ffmpeg

# Or on Linux
sudo apt install ffmpeg

# Install Python dependencies
pip install yt-dlp librosa flask flask-cors numpy scipy
```

### Running the YouTube Server

```bash
# Start the YouTube-to-Strudel server (port 5002)
python tools/youtube_to_strudel.py --server
```

### Usage

1. Make sure the YouTube server is running on port 5002
2. Paste a YouTube URL in the chat: `https://youtu.be/dQw4w9WgXcQ`
3. Wait 10-30 seconds for analysis
4. The AI will generate drums, bass, and melody patterns based on the song

### How It Works

1. **Download**: yt-dlp fetches audio from YouTube
2. **Convert**: FFmpeg converts to WAV format
3. **Analyze**: librosa detects BPM, key, drum hits, bass notes, melody
4. **Generate**: Creates Strudel code with synthesized sounds

---

## 🧠 MusicGen Setup (Optional - Requires GPU)

Generate real AI audio samples using **Meta's MusicGen** model (from Facebook AI Research / Audiocraft).

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
# Start the MusicGen server (port 5001)
python tools/musicgen_server.py
```

### Usage

Say commands like:
- "Generate real drums"
- "Create AI bass"
- "MusicGen melody"

---

## 🎮 Usage Guide

### Starting a Session

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **INITIALIZE SESSION** to start the audio engine
3. Use the text input or microphone to send commands

### Voice/Text Commands

**Creating Music:**
- "Start a techno beat at 130 BPM"
- "Add a dark bassline"
- "Create an ethereal melody"
- "Add some atmospheric FX"
- "Make the drums more complex"

**Controlling Playback:**
- "Stop" or "Silence"
- "Clear all tracks"
- "Mute the melody"
- "Solo the drums"

**YouTube Integration:**
- Just paste a YouTube URL: `https://youtu.be/...`

**MusicGen (if server running):**
- "Generate real drums"
- "AI bass sample"

### Track System

The app uses 5 independent tracks:
- 🥁 **Drums**: Kicks, snares, hi-hats
- 🎸 **Bass**: Sub-bass and basslines
- 🎹 **Melody**: Lead synths, chords, arpeggios
- 🎤 **Voice**: Vocal synthesis, speech effects
- ✨ **FX**: Atmosphere, risers, impacts

Each track can be:
- Muted/unmuted independently
- Soloed to hear in isolation
- Volume adjusted

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library

### Backend
- **Node.js** - Custom server with Socket.IO
- **Socket.IO** - Real-time WebSocket communication

### AI
- **Grok-4.1-fast** - Primary AI model (via OpenRouter)
- **MusicGen** - Meta's AI audio generation via Audiocraft (optional)

### Audio
- **Strudel** - JavaScript port of TidalCycles
- **Superdough** - Audio synthesis engine
- **Web Audio API** - Browser audio processing

### Audio Analysis (Python)
- **librosa** - Audio analysis library
- **yt-dlp** - YouTube downloader
- **FFmpeg** - Audio conversion

---

## 📁 Project Structure

```
musicAPP/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/route.ts    # AI music generation + YouTube
│   │   │   └── complete/route.ts # Code autocomplete
│   │   ├── page.tsx              # Main app
│   │   └── globals.css           # Styles
│   ├── components/
│   │   ├── SonicInterface.tsx    # Main UI
│   │   ├── SpectrumAnalyzer.tsx  # FFT visualization
│   │   ├── TrackStrip.tsx        # Track controls
│   │   └── ArrangementView.tsx   # Timeline view
│   ├── hooks/
│   │   └── useSonicSocket.ts     # WebSocket + state
│   └── lib/
│       └── strudel/engine.ts     # Audio engine
├── tools/
│   ├── youtube_to_strudel.py     # YouTube analyzer
│   └── musicgen_server.py        # AI audio server
├── knowledge.md                   # Strudel reference for AI
└── .env.local                     # API keys
```

---

## 🔧 Troubleshooting

### "YouTube server not running"
```bash
# Make sure the server is running:
python tools/youtube_to_strudel.py --server
```

### "FFmpeg not found"
```bash
# Windows - refresh PATH after installing FFmpeg:
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Then restart the YouTube server
```

### "No audio playing"
1. Click the **Play** button to start playback
2. Make sure your browser allows audio autoplay
3. Check browser console for errors

### "Rate limited"
- OpenRouter has rate limits. Wait a moment and try again.
- Consider upgrading your OpenRouter plan for higher limits.

---

## 📜 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Strudel](https://strudel.cc/) - Live coding music framework
- [TidalCycles](https://tidalcycles.org/) - Original live coding language
- [OpenRouter](https://openrouter.ai/) - AI model gateway
- [MusicGen / Audiocraft](https://github.com/facebookresearch/audiocraft) - Meta's AI audio generation
