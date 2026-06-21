# Voice Synthesizer (Voice Lab) Developer Documentation

This document describes the design, architecture, and details of the **Voice Synthesizer (Voice Lab)** feature implemented in Aether Sonic.

## 1. Core Architecture (Browser-First)

The Voice Lab is designed to run entirely client-side in the browser. It does not require any external paid APIs (e.g., ElevenLabs, OpenAI Audio) or native server models to function in its baseline version. This keeps the deployment cost at zero.

The audio stack uses:
- **`MediaRecorder` API:** For local microphone audio capture.
- **`wavesurfer.js`:** For rendering live microphone and TTS waveforms, managing playback head positions, and controlling visual audio representations.
- **`Tone.js`:** For real-time signal processing, routing vocal clips through effects chains, and synthesizing procedural ambient layers.
- **Web Speech API (`speechSynthesis`):** As a browser-native text-to-speech engine fallback.

---

## 2. Audio Processing Chain (`effectsChain.ts`)

Recorded voice clips or generated SpeechSynthesis clips are loaded dynamically into a `Tone.Player` instance. The player connects to a multi-stage effects routing chain:

```
[Tone.Player] 
      │
      ▼
[Tone.PitchShift] (Pitch Adjustment: -12 to +12 semitones)
      │
      ▼
[Tone.Filter] (High-pass: cuts low frequency mud)
      │
      ▼
[Tone.Filter] (Low-pass: cuts high-frequency harshness)
      │
      ▼
[Tone.Distortion] (Clipping/saturation drive)
      │
      ▼
[Tone.BitCrusher] (Decimates sample resolution: 16-bit down to 3-bit)
      │
      ▼
[Tone.Chorus] (Adds depth/thickening)
      │
      ▼
[Tone.Tremolo] (Amplitude modulation)
      │
      ▼
[Tone.FeedbackDelay] (Synchronized echoing)
      │
      ▼
[Tone.Reverb] (Spacial decay)
      │
      ▼
[Tone.Limiter] (Prevents signal clipping/distortion)
      │
      ▼
[Tone.Volume] (Main output level mapping)
      │
      ▼
[Audio Destination]
```

---

## 3. Ambience Synthesis (`ambience.ts`)

To enrich the vocals, the engine generates **procedural backgrounds** using native synthesis instead of heavy static audio files:
- **Rain & Wind:** Simulated using white noise sources filtered with low-frequency oscillators (`LFO`) to mimic gusts and moving droplets.
- **Thunder:** Simulated by low-pass filtering noise sweeps and adding envelope clicks.
- **Space Ambience / Hum / Click Alarms:** Created using modulated low-frequency oscillators and harmonic resonance filters.

---

## 4. TTS Adapter & Future Backend Extensions (`ttsAdapter.ts`)

The Speech Synthesis client is encapsulated in `ttsAdapter.ts`. It provides:
- **`browser_speech`:** Generates local voice previews using the browser's TTS system.
- **Plugs for Future Backends:** Reusable classes and interface signatures are ready for integration with open-source neural frameworks:
  - **Chatterbox / OpenVoice / LLVC / RVC:** These are heavyweight Python/PyTorch-based voice models. Because of execution constraints and resource usage, they should **never** be bundled into the Next.js frontend pack. They must run on an isolated backend server that accepts HTTP POST requests containing text and styles, returning a static audio WAV/MP3 URL.

---

## 5. Security & Safety Controls (`safety.ts`)

To prevent misuse and impersonation issues, a safety filter is integrated inside `safety.ts`:
- Blocks user prompts attempting to clone or impersonate named public figures (e.g., politicians, celebrity singers).
- Warns users about cloning voices without explicit permission.
- Restricts cloning to fictional presets (e.g., alien, robot, monster).

---

## 6. Workspace Integration

Once a user records or generates a vocal clip, applying presets and mixing ambience, they can click **"Send to Workspace"**. This encodes the offline output buffer into a WAV file, generates an object URL, and calls `registerSound()` from `superdough`.
This dynamically mounts the sample into the Strudel audio context. The user can immediately reference the clip in their music code via:
```javascript
s("voice_user_clip_name")
```
This bridges the Voice Lab directly into the live musical workspace.
