# MusicGen Integration Guide

This guide explains how to integrate Facebook's MusicGen AI model for generating real music from text prompts.

## Quick Start (Your Setup)

Your system: **RTX 2070 (8GB VRAM)** - Perfect for MusicGen-small!

```powershell
# 1. Start the MusicGen server (model downloads automatically)
python tools/musicgen_server.py

# 2. Test generation (in another terminal)
python test_musicgen.py

# 3. Generate batch samples
python tools/musicgen_batch.py
```

**Performance on your RTX 2070:**
- First run: ~2 min (downloads 2.3GB model)
- After: **~7 seconds** for 5 seconds of audio!

## Overview

MusicGen is a state-of-the-art AI model that generates high-quality music from text descriptions. Instead of using Strudel's synthetic sounds, you can generate actual audio samples with MusicGen.

## Setup Options

### Option 1: Local Python Server (Recommended for Development)

**Requirements:**
- Python 3.9+
- 8GB+ RAM (16GB+ recommended)
- GPU with 4GB+ VRAM for faster generation (optional, CPU works but slower)

**Installation:**

```bash
# Create virtual environment
cd tools
python -m venv musicgen-env
source musicgen-env/bin/activate  # On Windows: musicgen-env\Scripts\activate

# Install dependencies
pip install torch transformers scipy flask flask-cors

# For GPU support (CUDA):
pip install torch --index-url https://download.pytorch.org/whl/cu118
```

**Running the Server:**

```bash
# Start the MusicGen server
python tools/musicgen_server.py

# Or with environment variables:
MUSICGEN_MODEL=facebook/musicgen-medium MUSICGEN_PORT=5001 python tools/musicgen_server.py
```

**Available Models:**
- `facebook/musicgen-small` - 300M params, fastest, lower quality
- `facebook/musicgen-medium` - 1.5B params, good balance (recommended)
- `facebook/musicgen-melody` - 1.5B params, can condition on melody
- `facebook/musicgen-large` - 3.3B params, best quality, slow

### Option 2: Hugging Face Inference API (Cloud)

For production without local GPU, you can use Hugging Face's hosted inference API.

1. Get an API key from [Hugging Face](https://huggingface.co/settings/tokens)
2. Add to your `.env`:
   ```
   HUGGINGFACE_API_KEY=your_token_here
   ```

### Option 3: Replicate API (Cloud)

Another cloud option with pay-per-use pricing.

1. Get an API key from [Replicate](https://replicate.com)
2. Add to your `.env`:
   ```
   REPLICATE_API_TOKEN=your_token_here
   ```

## API Endpoints

### POST /generate
Generate music from a text prompt.

```json
{
  "prompt": "energetic techno beat with heavy bass and driving synths",
  "duration": 8,
  "format": "base64"
}
```

**Response:**
```json
{
  "success": true,
  "prompt": "...",
  "duration": 8,
  "sampling_rate": 32000,
  "audio_base64": "UklGRi...",
  "generation_time": 12.5
}
```

### POST /generate_stem
Generate a specific instrument stem.

```json
{
  "type": "drums",
  "style": "techno",
  "mood": "energetic",
  "key": "C minor",
  "bpm": 128,
  "duration": 8
}
```

### GET /health
Check server status.

## Frontend Integration

```typescript
import { generateMusic, generateStem, playGeneratedAudio } from '@/lib/musicgen/client';

// Generate from text prompt
const result = await generateMusic({
  prompt: "ambient electronic with ethereal pads",
  duration: 10
});

// Play the generated audio
await playGeneratedAudio(result.audio_base64);

// Generate specific stem
const drums = await generateStem({
  type: 'drums',
  style: 'house',
  mood: 'groovy',
  bpm: 124
});
```

## Workflow Integration

### AI Voice → MusicGen Flow

When a user makes a voice request like "add angel voices":

1. **Current Flow (Strudel):**
   - AI generates Strudel code: `note(m("c4 e4 g4")).s("sawtooth").vowel("a")...`
   - Strudel synthesizes in real-time

2. **MusicGen Flow:**
   - Detect "generate" or "real" keywords in request
   - Call MusicGen: `generateStem({ type: 'voice', style: 'ethereal choir' })`
   - Load generated WAV as a sample in Strudel
   - Play with: `s("musicgen_voice_1")`

### Hybrid Approach (Recommended)

Use Strudel for real-time patterns and MusicGen for one-shot samples:

```typescript
// Generate a MusicGen sample
const voiceSample = await generateStem({ type: 'voice', style: 'angelic choir' });

// Load into Web Audio
const audioBuffer = await base64ToAudioBuffer(voiceSample.audio_base64, audioContext);

// Register as Strudel sample
await registerSample('musicgen_voice', audioBuffer);

// Use in pattern
evalStrudelCode('s("musicgen_voice").slow(4).room(0.8)');
```

## Performance Tips

1. **Use smaller models** for real-time interaction (`musicgen-small`)
2. **Cache generated samples** to avoid re-generation
3. **Generate in background** while user interacts with Strudel
4. **Pre-generate common stems** (kicks, snares, hats) on server startup

## Limitations

- **Generation time:** 5-30 seconds depending on duration and hardware
- **Not real-time:** Unlike Strudel, can't modify on-the-fly
- **GPU recommended:** CPU generation is slow (30s+ for 8 seconds of audio)
- **Memory usage:** Medium model needs 4GB+ VRAM or 16GB+ RAM

---

## Fine-Tuning Your Own Model

Want to train MusicGen on your own music samples? Use the trainer tool!

### 1. Prepare Your Data

```powershell
# Create the training data structure
python tools/musicgen_trainer.py --mode create_sample
```

This creates a `training_data/` folder with example structure.

### 2. Add Your Audio Files

Put your audio files (WAV, MP3, FLAC) in `training_data/` with descriptions:

**Option A - Metadata JSON:**
```json
[
  {"audio": "my_kick.wav", "description": "punchy techno kick, 128 bpm, heavy compression"},
  {"audio": "my_pad.wav", "description": "ethereal ambient pad, slow attack, reverb"}
]
```

**Option B - Individual .txt files:**
- `my_kick.wav` + `my_kick.txt` (containing description)

### 3. Description Tips

Good descriptions lead to better training:
- Include genre: "techno", "ambient", "trap", "orchestral"
- Include mood: "dark", "euphoric", "melancholic", "aggressive"
- Include instruments: "kick drum", "synthesizer", "strings"
- Include tempo: "128 bpm", "slow", "fast"
- Include key (optional): "C minor", "A major"

**Example descriptions:**
- "dark industrial techno kick, distorted, 135 bpm, aggressive"
- "lo-fi hip hop piano chords, jazzy, warm, nostalgic, 85 bpm"
- "epic orchestral brass, cinematic, triumphant, major key"

### 4. Run Training

```powershell
# Check your system capabilities
python tools/musicgen_trainer.py --mode info

# Start fine-tuning (uses LoRA for memory efficiency)
python tools/musicgen_trainer.py --mode train --data_dir training_data --epochs 3
```

**Training requirements:**
- 8GB+ VRAM: Can train musicgen-small with LoRA
- 12GB+ VRAM: Can train musicgen-medium with LoRA
- 24GB+ VRAM: Full fine-tuning possible

### 5. Use Your Fine-Tuned Model

```powershell
# Start server with your model
set MUSICGEN_MODEL=./musicgen_finetuned
python tools/musicgen_server.py
```

---

## Example Prompts

**Drums:**
- "punchy 4/4 techno kick drum pattern 128 bpm"
- "brazilian batucada percussion with surdo and tamborim"
- "trap hi-hats with rolls and 808 kick"

**Bass:**
- "deep rolling bassline in C minor, techno style"
- "funky slap bass groove 120 bpm"
- "massive dubstep wobble bass"

**Melody:**
- "ethereal synth arpeggio in A minor"
- "jazzy piano chords progression"
- "epic orchestral brass melody"

**Voice:**
- "angelic choir singing ahhh"
- "robotic vocoder vocal"
- "ethereal female vocal pad"

**FX/Ambient:**
- "dark atmospheric drone pad"
- "evolving ambient texture"
- "cinematic tension riser"
