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

* [ ] Follow this task plan sequentially.
* [ ] Do not jump between unrelated phases.
* [ ] Mark every checkbox as completed immediately after finishing the task.
* [ ] Do not build large custom DSP systems if an existing library already solves the problem.
* [ ] Do not add paid APIs in version 1.
* [ ] Do not use `seed-vc` or `w-okada/voice-changer` as the primary fork base.
* [ ] Keep the feature modular so future TTS or voice-conversion backends can be added later.
* [ ] Keep user recordings local unless the user explicitly exports or sends them to a backend.

---

# Phase 0 — Project Inspection and Safety Preparation

* [ ] Inspect the current Aether Sonic project structure.
* [ ] Identify the frontend framework, routing system, component structure, and state management style.
* [ ] Find the main interface file, especially `SonicInterface.tsx` or equivalent.
* [ ] Find how current view modes are defined.
* [ ] Find where the main AI chatbox is implemented.
* [ ] Find how audio workspace state is stored.
* [ ] Find existing audio-related utilities, hooks, or components.
* [ ] Check the current package manager: npm, pnpm, yarn, or bun.
* [ ] Create a new implementation branch named `feature/voice-synthesizer`.
* [ ] Run the existing project locally before changing files.
* [ ] Run the existing lint/build/test commands and note the current baseline.

---

# Phase 1 — Dependency and License Review

Review and install only what is needed for version 1.

Recommended libraries:

```txt
wavesurfer.js
tone
soundtouchjs
```

* [ ] Check whether `wavesurfer.js` is already installed.
* [ ] Check whether `tone` is already installed.
* [ ] Check whether `soundtouchjs` or an equivalent pitch/time library is already installed.
* [ ] Check package licenses before adding dependencies.
* [ ] Prefer permissive licenses such as MIT, BSD, or Apache.
* [ ] Add `wavesurfer.js` for waveform UI and recording support.
* [ ] Add `tone` for audio routing and effects.
* [ ] Add `soundtouchjs` or a compatible alternative for pitch/speed processing.
* [ ] Do not add Chatterbox, OpenVoice, LLVC, or RVC in the frontend bundle.
* [ ] Document future backend options in comments or a `README` section.
* [ ] Run install.
* [ ] Run lint/build after dependency installation.

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

* [ ] Create `src/lib/voice-synthesizer/`.
* [ ] Create `types.ts`.
* [ ] Create `recorder.ts`.
* [ ] Create `waveform.ts`.
* [ ] Create `voiceEngine.ts`.
* [ ] Create `effectsChain.ts`.
* [ ] Create `presets.ts`.
* [ ] Create `ambience.ts`.
* [ ] Create `ttsAdapter.ts`.
* [ ] Create `audioExport.ts`.
* [ ] Create `safety.ts`.
* [ ] Create `src/components/VoiceSynthesizer.tsx`.
* [ ] Create hooks only if they match the existing project architecture.
* [ ] Export the feature cleanly from index files if the project uses barrel exports.

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

* [ ] Add all shared voice types to `types.ts`.
* [ ] Make sure the types are strict and reusable.
* [ ] Avoid using `any`.
* [ ] Add default values for `VoiceEffectSettings`.
* [ ] Export all types cleanly.
* [ ] Run TypeScript check.

---

# Phase 4 — Add Voice View Mode to Main Interface

Modify the main Aether Sonic interface.

Example:

```ts
type ViewMode = "chat" | "code" | "ssnn" | "voice";
```

Tasks:

* [ ] Find the current `ViewMode` type.
* [ ] Add `"voice"` to the view mode union.
* [ ] Add a Voice Synthesizer tab/button to the navigation.
* [ ] Use an appropriate icon, such as `Mic`, `AudioWaveform`, `Radio`, or `Sliders`.
* [ ] Render `<VoiceSynthesizer />` when the selected view is `"voice"`.
* [ ] Make sure switching tabs does not destroy unsaved voice clips unless intended.
* [ ] Preserve existing chat/code/SSNN behavior.
* [ ] Run the app and verify the new tab appears.
* [ ] Mark this phase completed only after the UI tab renders successfully.

---

# Phase 5 — Implement Microphone Recording

Use browser-native APIs.

Use:

```txt
navigator.mediaDevices.getUserMedia
MediaRecorder
```

In `recorder.ts`:

* [ ] Create a function to request microphone permission.
* [ ] Create a function to start recording.
* [ ] Create a function to stop recording.
* [ ] Capture audio chunks from `MediaRecorder`.
* [ ] Convert recorded chunks into a `Blob`.
* [ ] Create an object URL for playback.
* [ ] Return a valid `VoiceClip`.
* [ ] Handle permission denied errors.
* [ ] Handle unsupported browser errors.
* [ ] Stop all media tracks after recording ends.
* [ ] Prevent hidden/background recording.
* [ ] Expose recording state: `idle`, `requesting_permission`, `recording`, `stopped`, `error`.

In `VoiceSynthesizer.tsx`:

* [ ] Add a Record button.
* [ ] Add a Stop button.
* [ ] Add visible recording status.
* [ ] Add recording duration timer.
* [ ] Add recorded clip list.
* [ ] Add delete/reset button for each clip.
* [ ] Add clear all button.
* [ ] Test recording in Chrome/Edge.
* [ ] Test microphone permission denied state.

---

# Phase 6 — Add Waveform Display with WaveSurfer

Use WaveSurfer instead of building a custom waveform renderer.

Tasks:

* [ ] Create `waveform.ts`.
* [ ] Add a WaveSurfer initialization helper.
* [ ] Render waveform for the selected voice clip.
* [ ] Add play/pause integration.
* [ ] Add stop/restart integration.
* [ ] Show current time and duration.
* [ ] Add loading state while waveform is decoding.
* [ ] Add error state if the audio cannot be decoded.
* [ ] Add responsive layout for desktop and mobile.
* [ ] If possible, enable WaveSurfer Regions for future clip editing.
* [ ] If possible, enable Timeline/Hover for better usability.
* [ ] Destroy WaveSurfer instances cleanly on unmount.
* [ ] Prevent memory leaks from object URLs and stale waveform instances.

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

* [ ] Build the main Voice Synthesizer card/panel.
* [ ] Add a clean modern Aether Sonic visual style.
* [ ] Add record/playback controls.
* [ ] Add waveform area.
* [ ] Add clip list.
* [ ] Add text input for future TTS.
* [ ] Add voice style selector.
* [ ] Add effect preset selector.
* [ ] Add sliders for all major effect parameters.
* [ ] Add ambience selector.
* [ ] Add apply effect button.
* [ ] Add reset effects button.
* [ ] Add export button.
* [ ] Add send to workspace button.
* [ ] Make the layout responsive on mobile.

---

# Phase 8 — Build the Effects Chain with Tone.js

Use Tone.js for effect routing instead of custom DSP.

In `effectsChain.ts`:

* [ ] Create a reusable effect chain builder.
* [ ] Add Gain node.
* [ ] Add EQ/filter stage.
* [ ] Add Distortion.
* [ ] Add Reverb.
* [ ] Add Delay.
* [ ] Add Chorus.
* [ ] Add Tremolo.
* [ ] Add Vibrato if supported directly or with modulation.
* [ ] Add Bitcrusher if available or implement a simple safe version.
* [ ] Add wet/dry routing.
* [ ] Add output limiter or gain protection to avoid clipping.
* [ ] Add cleanup/dispose logic for all Tone.js nodes.
* [ ] Make effect settings update live from UI sliders.
* [ ] Make the chain reusable for recorded and generated clips.
* [ ] Test that effects do not continue playing after switching tabs.
* [ ] Test that multiple chains are not created accidentally.

---

# Phase 9 — Add Pitch, Speed, and Formant Processing

Use SoundTouchJS or an equivalent library.

In `voiceEngine.ts`:

* [ ] Create a voice processing controller.
* [ ] Load an audio clip into the processing engine.
* [ ] Add pitch control.
* [ ] Add speed control.
* [ ] Add formant-style control if supported.
* [ ] Add safe parameter ranges.
* [ ] Avoid extreme values that create unusable or broken audio.
* [ ] Allow preview playback.
* [ ] Allow processed output to be passed into Tone.js effects.
* [ ] Add graceful fallback if SoundTouchJS is not available.
* [ ] Test deep voice preset.
* [ ] Test cartoon voice preset.
* [ ] Test slow-motion voice preset.
* [ ] Test fast/pitched-up voice preset.
* [ ] Test robotic/alien voice preset.

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

* [ ] Deep Cinematic Voice
* [ ] Robotic Voice
* [ ] Alien Voice
* [ ] Lion Voice
* [ ] Monster Voice
* [ ] Radio Announcer
* [ ] Old Telephone
* [ ] Glitch AI Voice
* [ ] Whisper Voice
* [ ] Thunder God Voice
* [ ] Demon Voice
* [ ] Cartoon Voice
* [ ] Emergency Broadcast Voice

Each preset must define:

* [ ] Pitch value.
* [ ] Speed value.
* [ ] Formant value.
* [ ] EQ/filter values.
* [ ] Distortion value.
* [ ] Reverb amount.
* [ ] Delay amount.
* [ ] Chorus amount.
* [ ] Tremolo/vibrato amount.
* [ ] Bitcrusher amount.
* [ ] Noise layer amount.
* [ ] Wet/dry mix.
* [ ] Gain.
* [ ] Optional ambience.

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

* [ ] Add preset list.
* [ ] Add default preset.
* [ ] Connect preset selector to UI.
* [ ] Apply selected preset to sliders.
* [ ] Let users modify preset values after selection.
* [ ] Add reset-to-preset button.
* [ ] Make presets deterministic and reusable.
* [ ] Do not ask the AI to recreate effect chains from scratch every time.

---

# Phase 11 — Add Ambience and Sound Effects Layer

In `ambience.ts`, create procedural or sample-ready ambience definitions.

Version 1 should use simple procedural ambience where possible.

Required ambience options:

* [ ] Rain
* [ ] Thunder
* [ ] Wind
* [ ] Fire
* [ ] Cave
* [ ] Forest
* [ ] Mechanical noise
* [ ] Electronic hum
* [ ] Relay clicks
* [ ] Capacitor charge
* [ ] Robotic servo movement
* [ ] Glitch particles
* [ ] Siren
* [ ] Alarm
* [ ] Space ambience

Implementation strategy:

* [ ] Use Tone.js noise sources for rain/wind.
* [ ] Use low-frequency noise + filtered noise for thunder.
* [ ] Use oscillator + filtering for electronic hum.
* [ ] Use short click impulses for relay clicks.
* [ ] Use rising filtered noise/oscillator for capacitor charge.
* [ ] Use modulation/glitch patterns for robotic servo movement.
* [ ] Keep ambience volume separate from voice volume.
* [ ] Allow ambience to be mixed with the voice.
* [ ] Add ambience preview.
* [ ] Add ambience stop/cleanup logic.
* [ ] Make ambience reusable later by the SSNN/electronic component sound simulator.

---

# Phase 12 — Create Browser TTS Fallback

Use browser Web Speech API as the first no-cost text-to-speech option.

In `ttsAdapter.ts`:

* [ ] Define a provider interface.
* [ ] Add `browser_speech` provider.
* [ ] Add `none` provider.
* [ ] Add placeholder provider definitions for `chatterbox`, `openvoice`, `llvc`, and `rvc`.
* [ ] Do not implement paid API providers in version 1.
* [ ] Make `browser_speech` generate speech preview using `speechSynthesis`.
* [ ] Clearly document browser limitations: quality varies and audio export may be limited.
* [ ] If direct audio capture from Web Speech is not reliable, treat browser speech as preview-only.
* [ ] Add UI warning when using preview-only TTS.
* [ ] Add future hooks for backend-generated audio blobs.

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

* [ ] Create `TTSProvider` interface.
* [ ] Implement `browser_speech` fallback.
* [ ] Add placeholder `chatterbox` adapter.
* [ ] Add placeholder `openvoice` adapter.
* [ ] Add placeholder `llvc` adapter.
* [ ] Add placeholder `rvc` adapter.
* [ ] Add error messages for unavailable providers.
* [ ] Add provider selector in UI.
* [ ] Default provider should be `browser_speech` or `none`.

---

# Phase 13 — Prepare Future Chatterbox/OpenVoice Backend Integration

Do not fully implement this in version 1 unless the backend already exists.

Create the architecture now so future integration is easy.

Tasks:

* [ ] Add `VOICE_TTS_PROVIDER` environment/config option if the project has config support.
* [ ] Add `VOICE_TTS_BACKEND_URL` placeholder config.
* [ ] Add a typed request body for future backend TTS.
* [ ] Add a typed response body for future backend TTS.
* [ ] Add comments explaining that Chatterbox and OpenVoice should run as isolated backend services.
* [ ] Do not bundle Python models into the frontend.
* [ ] Add a feature flag: `enableAdvancedVoiceProviders`.
* [ ] Hide advanced providers if no backend URL is configured.
* [ ] Add documentation for future backend providers.
* [ ] Make sure version 1 works without any backend.

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

* [ ] Find the current AI chatbox message handler.
* [ ] Add detection for voice-related user requests.
* [ ] Detect prompts such as “create a voice”, “make my voice”, “deep voice”, “robotic voice”, “add thunder”, “make it sound like radio”.
* [ ] Add a `VoiceGenerationCommand` parser.
* [ ] Add schema validation for command objects.
* [ ] Map natural language to existing preset IDs.
* [ ] Map “deep voice” to `deep_cinematic`.
* [ ] Map “robot voice” to `robotic`.
* [ ] Map “lion voice” to `lion`.
* [ ] Map “monster voice” to `monster`.
* [ ] Map “emergency announcement” to `emergency_broadcast`.
* [ ] Map “rain/thunder/wind/cave” to ambience IDs.
* [ ] Route valid commands to the Voice Synthesizer.
* [ ] Show a human-readable summary in chat.
* [ ] Do not let the AI create arbitrary unvalidated effect chains.
* [ ] Keep AI commands deterministic and preset-driven.
* [ ] Add fallback when the user asks for an unsupported voice style.

---

# Phase 15 — Safety, Privacy, and Abuse Prevention

Implement basic safety rules.

Tasks:

* [ ] Ask for microphone permission only when the user clicks record.
* [ ] Show visible recording status while recording.
* [ ] Do not record automatically.
* [ ] Stop recording when the user leaves the view or closes the component.
* [ ] Store recordings locally in browser/session state only.
* [ ] Add delete button for each clip.
* [ ] Revoke object URLs when clips are deleted.
* [ ] Add warning: “Do not clone or imitate real people without permission.”
* [ ] Block direct requests to imitate named public figures.
* [ ] Block direct requests to impersonate private individuals without consent.
* [ ] Allow fictional styles such as robot, monster, alien, lion, radio, thunder god, demon, cartoon.
* [ ] Do not label generated voices as real people.
* [ ] Add safe error handling for microphone and audio processing failures.

---

# Phase 16 — Export Audio

In `audioExport.ts`, add export support.

Tasks:

* [ ] Add function to export original recorded clip.
* [ ] Add function to export processed clip if rendering is supported.
* [ ] Add filename generation.
* [ ] Support `.webm` export for raw MediaRecorder output.
* [ ] Support `.wav` export if processed AudioBuffer rendering is implemented.
* [ ] Add export button to UI.
* [ ] Disable export button when no clip is selected.
* [ ] Show export error if the processed audio cannot be rendered.
* [ ] Add clear user feedback after export.
* [ ] Make sure browser speech preview is not advertised as exportable unless captured/rendered properly.

---

# Phase 17 — Send Voice Clips to Main Workspace

Connect Voice Synthesizer to Aether Sonic’s main audio/music workspace.

Tasks:

* [ ] Find how the main workspace stores audio samples or clips.
* [ ] Add “Send to Workspace” button.
* [ ] Send selected voice clip metadata and audio URL/blob to workspace state.
* [ ] Allow clips to be used as samples later.
* [ ] Add a generated sample name such as `voice_deep_cinematic_001`.
* [ ] Preserve voice clip source and preset metadata.
* [ ] Add success notification after sending.
* [ ] Add error notification if workspace integration fails.
* [ ] Do not break existing Strudel/code workspace behavior.

---

# Phase 18 — Local Session State

Implement safe temporary state.

Tasks:

* [ ] Store voice clips in component state or existing project/session store.
* [ ] Store selected preset.
* [ ] Store effect slider values.
* [ ] Store selected ambience.
* [ ] Store selected provider.
* [ ] Persist only if the project already has a safe local persistence system.
* [ ] If using localStorage or IndexedDB, clearly separate temporary clips from permanent project files.
* [ ] Add “Clear Voice Session” button.
* [ ] Clear object URLs correctly.
* [ ] Avoid memory leaks from large audio blobs.

---

# Phase 19 — UI Polish and UX Flow

Make the feature feel like a professional voice lab.

Tasks:

* [ ] Add empty state: “Record a voice or type text to generate one.”
* [ ] Add loading states for waveform decoding.
* [ ] Add loading states for text-to-speech generation.
* [ ] Add disabled states for buttons.
* [ ] Add clear error messages.
* [ ] Add tooltip/help text for pitch, speed, formant, wet/dry, ambience.
* [ ] Add preset cards with short descriptions.
* [ ] Add active preset highlight.
* [ ] Add active ambience highlight.
* [ ] Add waveform visual feedback during playback.
* [ ] Add mobile-friendly controls.
* [ ] Add keyboard-accessible buttons.
* [ ] Add ARIA labels for recording and playback controls.

---

# Phase 20 — Testing Plan

Add tests where the project already supports testing.

Automated tests:

* [ ] Test `types.ts` exports.
* [ ] Test preset definitions are valid.
* [ ] Test every preset contains all required effect settings.
* [ ] Test command parser maps natural language to valid voice styles.
* [ ] Test unsupported provider returns safe error.
* [ ] Test unsupported voice style returns fallback.
* [ ] Test `browser_speech` adapter does not crash when unsupported.
* [ ] Test safety filter blocks public figure impersonation requests.
* [ ] Test no duplicate voice workspace renders.

Manual tests:

* [ ] Open the app.
* [ ] Click Voice Synthesizer tab.
* [ ] Click Record.
* [ ] Grant microphone permission.
* [ ] Say: “Let’s party.”
* [ ] Stop recording.
* [ ] Verify waveform appears.
* [ ] Play recorded voice.
* [ ] Apply Deep Cinematic preset.
* [ ] Apply Robotic preset.
* [ ] Apply Alien preset.
* [ ] Apply Lion preset.
* [ ] Add rain ambience.
* [ ] Add thunder ambience.
* [ ] Export original clip.
* [ ] Export processed clip if supported.
* [ ] Send clip to main workspace.
* [ ] Delete clip.
* [ ] Deny microphone permission and verify error handling.
* [ ] Test mobile browser layout.
* [ ] Run lint.
* [ ] Run build.

---

# Phase 21 — Documentation

Add documentation for future developers.

Tasks:

* [ ] Create or update `VOICE_SYNTHESIZER.md`.
* [ ] Explain version 1 does not require paid APIs.
* [ ] Explain the browser-first architecture.
* [ ] Explain why WaveSurfer is used.
* [ ] Explain why Tone.js is used.
* [ ] Explain why SoundTouchJS is used.
* [ ] Explain how `ttsAdapter.ts` works.
* [ ] Explain how to add Chatterbox later.
* [ ] Explain how to add OpenVoice later.
* [ ] Explain why Python voice models should run as backend services.
* [ ] Explain safety and privacy rules.
* [ ] List known limitations.
* [ ] List future improvements.

---

# Phase 22 — Final Verification Before Completion

Do not mark the whole feature complete until all of these are true:

* [ ] The app builds successfully.
* [ ] The Voice Synthesizer tab appears.
* [ ] The user can record voice.
* [ ] The user can stop recording.
* [ ] The recorded clip appears in the UI.
* [ ] The waveform renders.
* [ ] The user can play/pause the clip.
* [ ] The user can apply at least five presets.
* [ ] The user can modify pitch.
* [ ] The user can modify speed.
* [ ] The user can modify distortion.
* [ ] The user can modify reverb.
* [ ] The user can modify delay.
* [ ] The user can add at least one ambience.
* [ ] The user can delete clips.
* [ ] No recording happens without explicit user action.
* [ ] The AI chatbox can create a structured voice command.
* [ ] The structured voice command routes to the Voice Synthesizer.
* [ ] The app still works without a paid API.
* [ ] Existing Aether Sonic features still work.
* [ ] No duplicate voice panels are rendered.
* [ ] No major console errors appear during normal usage.
* [ ] Documentation is updated.

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
