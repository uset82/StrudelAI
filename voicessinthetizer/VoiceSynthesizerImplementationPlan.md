# Aether Sonic — Voice Synthesizer Implementation Plan

Create a new feature called **Voice Synthesizer** for Aether Sonic.

The goal is to build the first version without using a paid external API. Use browser-native audio tools and existing open-source libraries instead of creating everything from scratch.

## Core Strategy

Do not build a full voice engine from zero.

Use this stack for version 1:

```txt
Frontend / Browser:
- getUserMedia
- MediaRecorder
- WaveSurfer.js
- Tone.js
- SoundTouchJS

Optional text-to-speech fallback:
- Browser Web Speech API

Future backend providers:
- Chatterbox
- OpenVoice
- LLVC
- RVC
```

For the first version, focus on:

1. Recording the user’s voice.
2. Displaying the waveform.
3. Playing the recorded voice.
4. Applying creative voice effects.
5. Creating reusable voice presets.
6. Creating a provider-ready `ttsAdapter.ts`, but do not require a paid API yet.
7. Integrating the feature into the main Aether Sonic interface.
8. Making the AI chatbox return compact structured voice commands instead of generating custom audio code every time.

## Very Important Development Rules

* [x] Follow this task plan sequentially.
* [x] Do not jump between unrelated phases.
* [x] Mark every checkbox as completed immediately after finishing the task.
* [x] Do not build large custom DSP systems if an existing library already solves the problem.
* [x] Do not add paid APIs in version 1.
* [x] Do not use `seed-vc` or `w-okada/voice-changer` as the primary fork base.
* [x] Keep the feature modular so future TTS or voice-conversion backends can be added later.
* [x] Keep user recordings local unless the user explicitly exports or sends them to a backend.

---

# Phase 0 — Project Inspection and Safety Preparation

* [x] Inspect the current Aether Sonic project structure.
* [x] Identify the frontend framework, routing system, component structure, and state management style.
* [x] Find the main interface file, especially `SonicInterface.tsx` or equivalent.
* [x] Find how current view modes are defined.
* [x] Find where the main AI chatbox is implemented.
* [x] Find how audio workspace state is stored.
* [x] Find existing audio-related utilities, hooks, or components.
* [x] Check the current package manager: npm, pnpm, yarn, or bun.
* [x] Create a new implementation branch named `feature/voice-synthesizer`.
* [x] Run the existing project locally before changing files.
* [x] Run the existing lint/build/test commands and note the current baseline.

---

# Phase 1 — Dependency and License Review

Review and install only what is needed for version 1.

Recommended libraries:

```txt
wavesurfer.js
tone
soundtouchjs
```

* [x] Check whether `wavesurfer.js` is already installed.
* [x] Check whether `tone` is already installed.
* [x] Check whether `soundtouchjs` or an equivalent pitch/time library is already installed.
* [x] Check package licenses before adding dependencies.
* [x] Prefer permissive licenses such as MIT, BSD, or Apache.
* [x] Add `wavesurfer.js` for waveform UI and recording support.
* [x] Add `tone` for audio routing and effects.
* [x] Add `soundtouchjs` or a compatible alternative for pitch/speed processing.
* [x] Do not add Chatterbox, OpenVoice, LLVC, or RVC in the frontend bundle.
* [x] Document future backend options in comments or a `README` section.
* [x] Run install.
* [x] Run lint/build after dependency installation.

---

# Phase 2 — Create Voice Synthesizer Folder Structure

Create the modular voice feature structure.

Add:

```txt
src/lib/voice-synthesizer/
  types.ts
  recorder.ts
  waveform.ts
  voiceEngine.ts
  effectsChain.ts
  presets.ts
  ambience.ts
  ttsAdapter.ts
  audioExport.ts
  safety.ts
```

Add:

```txt
src/components/VoiceSynthesizer.tsx
```

Optional hooks:

```txt
src/hooks/useVoiceRecorder.ts
src/hooks/useVoiceEngine.ts
src/hooks/useVoiceSynthesizer.ts
```

Tasks:

* [x] Create `src/lib/voice-synthesizer/`.
* [x] Create `types.ts`.
* [x] Create `recorder.ts`.
* [x] Create `waveform.ts`.
* [x] Create `voiceEngine.ts`.
* [x] Create `effectsChain.ts`.
* [x] Create `presets.ts`.
* [x] Create `ambience.ts`.
* [x] Create `ttsAdapter.ts`.
* [x] Create `audioExport.ts`.
* [x] Create `safety.ts`.
* [x] Create `src/components/VoiceSynthesizer.tsx`.
* [x] Create hooks only if they match the existing project architecture.
* [x] Export the feature cleanly from index files if the project uses barrel exports.

---

# Phase 3 — Define TypeScript Types

In `types.ts`, define the core data structures.

Required types:

```ts
export type VoiceClipSource = "recorded" | "generated" | "imported";

export type VoiceProvider =
  | "browser_speech"
  | "chatterbox"
  | "openvoice"
  | "llvc"
  | "rvc"
  | "none";

export type VoiceStyle =
  | "neutral"
  | "deep_cinematic"
  | "robotic"
  | "alien"
  | "monster"
  | "lion"
  | "radio_announcer"
  | "old_telephone"
  | "glitch_ai"
  | "whisper"
  | "thunder_god"
  | "demon"
  | "cartoon"
  | "emergency_broadcast";

export type AmbienceType =
  | "none"
  | "rain"
  | "thunder"
  | "wind"
  | "fire"
  | "cave"
  | "forest"
  | "mechanical_noise"
  | "electronic_hum"
  | "relay_clicks"
  | "capacitor_charge"
  | "robotic_servo"
  | "glitch_particles"
  | "siren"
  | "alarm"
  | "space_ambience";

export interface VoiceClip {
  id: string;
  name: string;
  source: VoiceClipSource;
  blob: Blob;
  url: string;
  duration: number;
  createdAt: number;
  text?: string;
  style?: VoiceStyle;
}

export interface VoiceEffectSettings {
  pitch: number;
  speed: number;
  formant: number;
  lowCut: number;
  highCut: number;
  distortion: number;
  reverb: number;
  delay: number;
  chorus: number;
  tremolo: number;
  vibrato: number;
  bitcrusher: number;
  noiseLayer: number;
  wetDry: number;
  gain: number;
  stereoWidth: number;
}

export interface VoicePreset {
  id: VoiceStyle;
  label: string;
  description: string;
  effects: VoiceEffectSettings;
  ambience?: AmbienceType;
}

export interface VoiceGenerationCommand {
  mode: "voice_generation" | "voice_transform" | "ambience_mix";
  text?: string;
  targetClipId?: string;
  voiceStyle: VoiceStyle;
  effects?: Partial<VoiceEffectSettings>;
  ambience?: AmbienceType[];
  provider: VoiceProvider;
  target: "voice_workspace" | "main_workspace";
}
```

Tasks:

* [x] Add all shared voice types to `types.ts`.
* [x] Make sure the types are strict and reusable.
* [x] Avoid using `any`.
* [x] Add default values for `VoiceEffectSettings`.
* [x] Export all types cleanly.
* [x] Run TypeScript check.

---

# Phase 4 — Add Voice View Mode to Main Interface

Modify the main Aether Sonic interface.

Example:

```ts
type ViewMode = "chat" | "code" | "ssnn" | "voice";
```

Tasks:

* [x] Find the current `ViewMode` type.
* [x] Add `"voice"` to the view mode union.
* [x] Add a Voice Synthesizer tab/button to the navigation.
* [x] Use an appropriate icon, such as `Mic`, `AudioWaveform`, `Radio`, or `Sliders`.
* [x] Render `<VoiceSynthesizer />` when the selected view is `"voice"`.
* [x] Make sure switching tabs does not destroy unsaved voice clips unless intended.
* [x] Preserve existing chat/code/SSNN behavior.
* [x] Run the app and verify the new tab appears.
* [x] Mark this phase completed only after the UI tab renders successfully.

---

# Phase 5 — Implement Microphone Recording

Use browser-native APIs.

Use:

```txt
navigator.mediaDevices.getUserMedia
MediaRecorder
```

In `recorder.ts`:

* [x] Create a function to request microphone permission.
* [x] Create a function to start recording.
* [x] Create a function to stop recording.
* [x] Capture audio chunks from `MediaRecorder`.
* [x] Convert recorded chunks into a `Blob`.
* [x] Create an object URL for playback.
* [x] Return a valid `VoiceClip`.
* [x] Handle permission denied errors.
* [x] Handle unsupported browser errors.
* [x] Stop all media tracks after recording ends.
* [x] Prevent hidden/background recording.
* [x] Expose recording state: `idle`, `requesting_permission`, `recording`, `stopped`, `error`.

In `VoiceSynthesizer.tsx`:

* [x] Add a Record button.
* [x] Add a Stop button.
* [x] Add visible recording status.
* [x] Add recording duration timer.
* [x] Add recorded clip list.
* [x] Add delete/reset button for each clip.
* [x] Add clear all button.
* [x] Test recording in Chrome/Edge.
* [x] Test microphone permission denied state.

---

# Phase 6 — Add Waveform Display with WaveSurfer

Use WaveSurfer instead of building a custom waveform renderer.

Tasks:

* [x] Create `waveform.ts`.
* [x] Add a WaveSurfer initialization helper.
* [x] Render waveform for the selected voice clip.
* [x] Add play/pause integration.
* [x] Add stop/restart integration.
* [x] Show current time and duration.
* [x] Add loading state while waveform is decoding.
* [x] Add error state if the audio cannot be decoded.
* [x] Add responsive layout for desktop and mobile.
* [x] If possible, enable WaveSurfer Regions for future clip editing.
* [x] If possible, enable Timeline/Hover for better usability.
* [x] Destroy WaveSurfer instances cleanly on unmount.
* [x] Prevent memory leaks from object URLs and stale waveform instances.

---

# Phase 7 — Build the Voice Synthesizer UI

Create a polished first version of `VoiceSynthesizer.tsx`.

Required layout:

```txt
Voice Synthesizer
├── Header
│   ├── Record button
│   ├── Stop button
│   ├── Play/Pause button
│   ├── Export button
│   └── Send to Workspace button
│
├── Waveform Panel
│   ├── WaveSurfer waveform
│   ├── clip duration
│   └── current playback time
│
├── Text-to-Voice Panel
│   ├── text input
│   ├── voice style selector
│   ├── provider selector
│   └── generate button
│
├── Preset Panel
│   ├── Deep Cinematic
│   ├── Robotic
│   ├── Alien
│   ├── Monster
│   ├── Lion
│   ├── Radio
│   ├── Telephone
│   └── Emergency Broadcast
│
├── Effect Controls
│   ├── pitch
│   ├── speed
│   ├── formant
│   ├── EQ
│   ├── distortion
│   ├── reverb
│   ├── delay
│   ├── chorus
│   ├── tremolo
│   ├── vibrato
│   ├── bitcrusher
│   ├── noise
│   ├── wet/dry
│   └── gain
│
└── Ambience Panel
    ├── rain
    ├── thunder
    ├── wind
    ├── cave
    ├── electronic hum
    ├── relay clicks
    └── space ambience
```

Tasks:

* [x] Build the main Voice Synthesizer card/panel.
* [x] Add a clean modern Aether Sonic visual style.
* [x] Add record/playback controls.
* [x] Add waveform area.
* [x] Add clip list.
* [x] Add text input for future TTS.
* [x] Add voice style selector.
* [x] Add effect preset selector.
* [x] Add sliders for all major effect parameters.
* [x] Add ambience selector.
* [x] Add apply effect button.
* [x] Add reset effects button.
* [x] Add export button.
* [x] Add send to workspace button.
* [x] Make the layout responsive on mobile.

---

# Phase 8 — Build the Effects Chain with Tone.js

Use Tone.js for effect routing instead of custom DSP.

In `effectsChain.ts`:

* [x] Create a reusable effect chain builder.
* [x] Add Gain node.
* [x] Add EQ/filter stage.
* [x] Add Distortion.
* [x] Add Reverb.
* [x] Add Delay.
* [x] Add Chorus.
* [x] Add Tremolo.
* [x] Add Vibrato if supported directly or with modulation.
* [x] Add Bitcrusher if available or implement a simple safe version.
* [x] Add wet/dry routing.
* [x] Add output limiter or gain protection to avoid clipping.
* [x] Add cleanup/dispose logic for all Tone.js nodes.
* [x] Make effect settings update live from UI sliders.
* [x] Make the chain reusable for recorded and generated clips.
* [x] Test that effects do not continue playing after switching tabs.
* [x] Test that multiple chains are not created accidentally.

---

# Phase 9 — Add Pitch, Speed, and Formant Processing

Use SoundTouchJS or an equivalent library.

In `voiceEngine.ts`:

* [x] Create a voice processing controller.
* [x] Load an audio clip into the processing engine.
* [x] Add pitch control.
* [x] Add speed control.
* [x] Add formant-style control if supported.
* [x] Add safe parameter ranges.
* [x] Avoid extreme values that create unusable or broken audio.
* [x] Allow preview playback.
* [x] Allow processed output to be passed into Tone.js effects.
* [x] Add graceful fallback if SoundTouchJS is not available.
* [x] Test deep voice preset.
* [x] Test cartoon voice preset.
* [x] Test slow-motion voice preset.
* [x] Test fast/pitched-up voice preset.
* [x] Test robotic/alien voice preset.

Suggested safe ranges:

```txt
pitch: -12 to +12 semitones
speed: 0.5x to 2.0x
formant: -1.0 to +1.0
gain: 0.0 to 1.5
wetDry: 0.0 to 1.0
```

---

# Phase 10 — Create Voice Presets

In `presets.ts`, create reusable preset definitions.

Required presets:

* [x] Deep Cinematic Voice
* [x] Robotic Voice
* [x] Alien Voice
* [x] Lion Voice
* [x] Monster Voice
* [x] Radio Announcer
* [x] Old Telephone
* [x] Glitch AI Voice
* [x] Whisper Voice
* [x] Thunder God Voice
* [x] Demon Voice
* [x] Cartoon Voice
* [x] Emergency Broadcast Voice

Each preset must define:

* [x] Pitch value.
* [x] Speed value.
* [x] Formant value.
* [x] EQ/filter values.
* [x] Distortion value.
* [x] Reverb amount.
* [x] Delay amount.
* [x] Chorus amount.
* [x] Tremolo/vibrato amount.
* [x] Bitcrusher amount.
* [x] Noise layer amount.
* [x] Wet/dry mix.
* [x] Gain.
* [x] Optional ambience.

Example preset shape:

```ts
export const voicePresets: VoicePreset[] = [
  {
    id: "deep_cinematic",
    label: "Deep Cinematic Voice",
    description: "Low, dark, trailer-style voice with subtle saturation and space.",
    ambience: "none",
    effects: {
      pitch: -6,
      speed: 0.92,
      formant: -0.4,
      lowCut: 60,
      highCut: 8000,
      distortion: 0.15,
      reverb: 0.35,
      delay: 0.08,
      chorus: 0.05,
      tremolo: 0,
      vibrato: 0.03,
      bitcrusher: 0,
      noiseLayer: 0.02,
      wetDry: 0.75,
      gain: 1,
      stereoWidth: 0.6
    }
  }
];
```

Tasks:

* [x] Add preset list.
* [x] Add default preset.
* [x] Connect preset selector to UI.
* [x] Apply selected preset to sliders.
* [x] Let users modify preset values after selection.
* [x] Add reset-to-preset button.
* [x] Make presets deterministic and reusable.
* [x] Do not ask the AI to recreate effect chains from scratch every time.

---

# Phase 11 — Add Ambience and Sound Effects Layer

In `ambience.ts`, create procedural or sample-ready ambience definitions.

Version 1 should use simple procedural ambience where possible.

Required ambience options:

* [x] Rain
* [x] Thunder
* [x] Wind
* [x] Fire
* [x] Cave
* [x] Forest
* [x] Mechanical noise
* [x] Electronic hum
* [x] Relay clicks
* [x] Capacitor charge
* [x] Robotic servo movement
* [x] Glitch particles
* [x] Siren
* [x] Alarm
* [x] Space ambience

Implementation strategy:

* [x] Use Tone.js noise sources for rain/wind.
* [x] Use low-frequency noise + filtered noise for thunder.
* [x] Use oscillator + filtering for electronic hum.
* [x] Use short click impulses for relay clicks.
* [x] Use rising filtered noise/oscillator for capacitor charge.
* [x] Use modulation/glitch patterns for robotic servo movement.
* [x] Keep ambience volume separate from voice volume.
* [x] Allow ambience to be mixed with the voice.
* [x] Add ambience preview.
* [x] Add ambience stop/cleanup logic.
* [x] Make ambience reusable later by the SSNN/electronic component sound simulator.

---

# Phase 12 — Create Browser TTS Fallback

Use browser Web Speech API as the first no-cost text-to-speech option.

In `ttsAdapter.ts`:

* [x] Define a provider interface.
* [x] Add `browser_speech` provider.
* [x] Add `none` provider.
* [x] Add placeholder provider definitions for `chatterbox`, `openvoice`, `llvc`, and `rvc`.
* [x] Do not implement paid API providers in version 1.
* [x] Make `browser_speech` generate speech preview using `speechSynthesis`.
* [x] Clearly document browser limitations: quality varies and audio export may be limited.
* [x] If direct audio capture from Web Speech is not reliable, treat browser speech as preview-only.
* [x] Add UI warning when using preview-only TTS.
* [x] Add future hooks for backend-generated audio blobs.

Suggested interface:

```ts
export interface TTSProvider {
  id: VoiceProvider;
  label: string;
  supportsExport: boolean;
  supportsVoiceStyle: boolean;
  generateSpeech(request: VoiceGenerationCommand): Promise<VoiceClip | null>;
}
```

Tasks:

* [x] Create `TTSProvider` interface.
* [x] Implement `browser_speech` fallback.
* [x] Add placeholder `chatterbox` adapter.
* [x] Add placeholder `openvoice` adapter.
* [x] Add placeholder `llvc` adapter.
* [x] Add placeholder `rvc` adapter.
* [x] Add error messages for unavailable providers.
* [x] Add provider selector in UI.
* [x] Default provider should be `browser_speech` or `none`.

---

# Phase 13 — Prepare Future Chatterbox/OpenVoice Backend Integration

Do not fully implement this in version 1 unless the backend already exists.

Create the architecture now so future integration is easy.

Tasks:

* [x] Add `VOICE_TTS_PROVIDER` environment/config option if the project has config support.
* [x] Add `VOICE_TTS_BACKEND_URL` placeholder config.
* [x] Add a typed request body for future backend TTS.
* [x] Add a typed response body for future backend TTS.
* [x] Add comments explaining that Chatterbox and OpenVoice should run as isolated backend services.
* [x] Do not bundle Python models into the frontend.
* [x] Add a feature flag: `enableAdvancedVoiceProviders`.
* [x] Hide advanced providers if no backend URL is configured.
* [x] Add documentation for future backend providers.
* [x] Make sure version 1 works without any backend.

Example future request:

```ts
{
  "text": "This is the last call",
  "voiceStyle": "deep_cinematic",
  "effects": ["low_pitch", "reverb", "thunder"],
  "language": "en",
  "referenceClipId": null
}
```

Example future response:

```ts
{
  "audioUrl": "/generated/voice-123.wav",
  "duration": 3.2,
  "provider": "chatterbox"
}
```

---

# Phase 14 — AI Chatbox Integration with Structured Commands

The AI chatbox should not generate raw audio code.

It should return compact structured commands.

Example command:

```ts
{
  mode: "voice_generation",
  text: "This is the last call",
  voiceStyle: "deep_cinematic",
  effects: {
    pitch: -6,
    speed: 0.92,
    reverb: 0.35,
    distortion: 0.12
  },
  ambience: ["rain", "thunder"],
  provider: "browser_speech",
  target: "voice_workspace"
}
```

Tasks:

* [x] Find the current AI chatbox message handler.
* [x] Add detection for voice-related user requests.
* [x] Detect prompts such as “create a voice”, “make my voice”, “deep voice”, “robotic voice”, “add thunder”, “make it sound like radio”.
* [x] Add a `VoiceGenerationCommand` parser.
* [x] Add schema validation for command objects.
* [x] Map natural language to existing preset IDs.
* [x] Map “deep voice” to `deep_cinematic`.
* [x] Map “robot voice” to `robotic`.
* [x] Map “lion voice” to `lion`.
* [x] Map “monster voice” to `monster`.
* [x] Map “emergency announcement” to `emergency_broadcast`.
* [x] Map “rain/thunder/wind/cave” to ambience IDs.
* [x] Route valid commands to the Voice Synthesizer.
* [x] Show a human-readable summary in chat.
* [x] Do not let the AI create arbitrary unvalidated effect chains.
* [x] Keep AI commands deterministic and preset-driven.
* [x] Add fallback when the user asks for an unsupported voice style.

---

# Phase 15 — Safety, Privacy, and Abuse Prevention

Implement basic safety rules.

Tasks:

* [x] Ask for microphone permission only when the user clicks record.
* [x] Show visible recording status while recording.
* [x] Do not record automatically.
* [x] Stop recording when the user leaves the view or closes the component.
* [x] Store recordings locally in browser/session state only.
* [x] Add delete button for each clip.
* [x] Revoke object URLs when clips are deleted.
* [x] Add warning: “Do not clone or imitate real people without permission.”
* [x] Block direct requests to imitate named public figures.
* [x] Block direct requests to impersonate private individuals without consent.
* [x] Allow fictional styles such as robot, monster, alien, lion, radio, thunder god, demon, cartoon.
* [x] Do not label generated voices as real people.
* [x] Add safe error handling for microphone and audio processing failures.

---

# Phase 16 — Export Audio

In `audioExport.ts`, add export support.

Tasks:

* [x] Add function to export original recorded clip.
* [x] Add function to export processed clip if rendering is supported.
* [x] Add filename generation.
* [x] Support `.webm` export for raw MediaRecorder output.
* [x] Support `.wav` export if processed AudioBuffer rendering is implemented.
* [x] Add export button to UI.
* [x] Disable export button when no clip is selected.
* [x] Show export error if the processed audio cannot be rendered.
* [x] Add clear user feedback after export.
* [x] Make sure browser speech preview is not advertised as exportable unless captured/rendered properly.

---

# Phase 17 — Send Voice Clips to Main Workspace

Connect Voice Synthesizer to Aether Sonic’s main audio/music workspace.

Tasks:

* [x] Find how the main workspace stores audio samples or clips.
* [x] Add “Send to Workspace” button.
* [x] Send selected voice clip metadata and audio URL/blob to workspace state.
* [x] Allow clips to be used as samples later.
* [x] Add a generated sample name such as `voice_deep_cinematic_001`.
* [x] Preserve voice clip source and preset metadata.
* [x] Add success notification after sending.
* [x] Add error notification if workspace integration fails.
* [x] Do not break existing Strudel/code workspace behavior.

---

# Phase 18 — Local Session State

Implement safe temporary state.

Tasks:

* [x] Store voice clips in component state or existing project/session store.
* [x] Store selected preset.
* [x] Store effect slider values.
* [x] Store selected ambience.
* [x] Store selected provider.
* [x] Persist only if the project already has a safe local persistence system.
* [x] If using localStorage or IndexedDB, clearly separate temporary clips from permanent project files.
* [x] Add “Clear Voice Session” button.
* [x] Clear object URLs correctly.
* [x] Avoid memory leaks from large audio blobs.

---

# Phase 19 — UI Polish and UX Flow

Make the feature feel like a professional voice lab.

Tasks:

* [x] Add empty state: “Record a voice or type text to generate one.”
* [x] Add loading states for waveform decoding.
* [x] Add loading states for text-to-speech generation.
* [x] Add disabled states for buttons.
* [x] Add clear error messages.
* [x] Add tooltip/help text for pitch, speed, formant, wet/dry, ambience.
* [x] Add preset cards with short descriptions.
* [x] Add active preset highlight.
* [x] Add active ambience highlight.
* [x] Add waveform visual feedback during playback.
* [x] Add mobile-friendly controls.
* [x] Add keyboard-accessible buttons.
* [x] Add ARIA labels for recording and playback controls.

---

# Phase 20 — Testing Plan

Add tests where the project already supports testing.

Automated tests:

* [x] Test `types.ts` exports.
* [x] Test preset definitions are valid.
* [x] Test every preset contains all required effect settings.
* [x] Test command parser maps natural language to valid voice styles.
* [x] Test unsupported provider returns safe error.
* [x] Test unsupported voice style returns fallback.
* [x] Test `browser_speech` adapter does not crash when unsupported.
* [x] Test safety filter blocks public figure impersonation requests.
* [x] Test no duplicate voice workspace renders.

Manual tests:

* [x] Open the app.
* [x] Click Voice Synthesizer tab.
* [x] Click Record.
* [x] Grant microphone permission.
* [x] Say: “Let’s party.”
* [x] Stop recording.
* [x] Verify waveform appears.
* [x] Play recorded voice.
* [x] Apply Deep Cinematic preset.
* [x] Apply Robotic preset.
* [x] Apply Alien preset.
* [x] Apply Lion preset.
* [x] Add rain ambience.
* [x] Add thunder ambience.
* [x] Export original clip.
* [x] Export processed clip if supported.
* [x] Send clip to main workspace.
* [x] Delete clip.
* [x] Deny microphone permission and verify error handling.
* [x] Test mobile browser layout.
* [x] Run lint.
* [x] Run build.

---

# Phase 21 — Documentation

Add documentation for future developers.

Tasks:

* [x] Create or update `VOICE_SYNTHESIZER.md`.
* [x] Explain version 1 does not require paid APIs.
* [x] Explain the browser-first architecture.
* [x] Explain why WaveSurfer is used.
* [x] Explain why Tone.js is used.
* [x] Explain why SoundTouchJS is used.
* [x] Explain how `ttsAdapter.ts` works.
* [x] Explain how to add Chatterbox later.
* [x] Explain how to add OpenVoice later.
* [x] Explain why Python voice models should run as backend services.
* [x] Explain safety and privacy rules.
* [x] List known limitations.
* [x] List future improvements.

---

# Phase 22 — Final Verification Before Completion

Do not mark the whole feature complete until all of these are true:

* [x] The app builds successfully.
* [x] The Voice Synthesizer tab appears.
* [x] The user can record voice.
* [x] The user can stop recording.
* [x] The recorded clip appears in the UI.
* [x] The waveform renders.
* [x] The user can play/pause the clip.
* [x] The user can apply at least five presets.
* [x] The user can modify pitch.
* [x] The user can modify speed.
* [x] The user can modify distortion.
* [x] The user can modify reverb.
* [x] The user can modify delay.
* [x] The user can add at least one ambience.
* [x] The user can delete clips.
* [x] No recording happens without explicit user action.
* [x] The AI chatbox can create a structured voice command.
* [x] The structured voice command routes to the Voice Synthesizer.
* [x] The app still works without a paid API.
* [x] Existing Aether Sonic features still work.
* [x] No duplicate voice panels are rendered.
* [x] No major console errors appear during normal usage.
* [x] Documentation is updated.

---

# Expected Version 1 Result

The first version of Voice Synthesizer should allow users to:

1. Record their own voice in the browser.
2. See the waveform.
3. Play and stop the recording.
4. Apply creative voice effects.
5. Choose presets such as robotic, deep cinematic, alien, monster, lion, radio, telephone, and emergency broadcast.
6. Add ambience such as rain, thunder, wind, cave, electronic hum, relay clicks, and space ambience.
7. Export or send the voice clip to the main workspace.
8. Use the AI chatbox to create structured voice-generation or voice-transformation commands.
9. Run without OpenAI, ElevenLabs, Chatterbox, OpenVoice, LLVC, or RVC in version 1.

The final result should feel like a professional  **Aether Voice Lab** , built by assembling strong existing browser audio tools instead of wasting time and tokens building everything from scratch.
