# MusicGen Training Data

## How to prepare your training data:

1. **Collect audio samples** (WAV, MP3, or FLAC)
   - 5-30 seconds each is ideal
   - Try to have at least 10-50 samples per style
   - Higher quality = better results

2. **Add descriptions** for each sample:
   
   Option A: Create `metadata.json`:
   ```json
   [
     {"audio": "sample1.wav", "description": "energetic techno beat, 128 bpm"},
     {"audio": "sample2.wav", "description": "chill lo-fi hip hop, jazzy chords"}
   ]
   ```
   
   Option B: Create `.txt` file for each audio:
   - `sample1.wav` -> `sample1.txt` containing the description

3. **Description tips:**
   - Include genre/style: "techno", "ambient", "rock"
   - Include mood: "energetic", "chill", "dark", "euphoric"
   - Include instruments: "synthesizer", "guitar", "drums"
   - Include tempo: "120 bpm", "slow", "fast"
   - Include key (optional): "C minor", "A major"

## Example descriptions:

- "driving techno beat, 130 bpm, industrial, distorted kick, metallic hi-hats"
- "smooth jazz piano, relaxing, warm, 90 bpm, brushed drums"
- "epic orchestral, dramatic, cinematic, brass section, timpani"
- "glitchy IDM, experimental, polyrhythmic, 160 bpm, granular textures"

## File structure:
```
training_data/
├── metadata.json (optional)
├── sample1.wav
├── sample1.txt (optional if using metadata.json)
├── sample2.wav
├── sample2.txt
└── ...
```
