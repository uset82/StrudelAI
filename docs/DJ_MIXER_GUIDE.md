# 🎧 DJ Mixer User Guide

A complete guide to using the DJ Mixer in StrudelAI. Learn to mix like a pro!

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Interface Layout](#interface-layout)
3. [Getting Started](#getting-started)
4. [Step-by-Step Tutorials](#step-by-step-tutorials)
5. [Controls Reference](#controls-reference)
6. [Tips & Tricks](#tips--tricks)

---

## Overview

The DJ Mixer provides a realistic dual-deck mixing experience with:
- **Two independent decks** (A and B) with rotating platters
- **Crossfader** for smooth transitions between decks
- **EQ controls** (Low, Mid, High) per channel
- **Filter knobs** for sweeping effects
- **Tempo/Pitch control** with Sync capability
- **Drum pads** for live performance triggers
- **Track browser** to load different patterns

---

## Interface Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   DECK A    │     │   MIXER     │     │   DECK B    │      │
│   │  (Cyan)     │     │   PANEL     │     │  (Magenta)  │      │
│   │             │     │             │     │             │      │
│   │  [PLATTER]  │     │  EQ Knobs   │     │  [PLATTER]  │      │
│   │             │     │  Faders     │     │             │      │
│   │  [PADS]     │     │  Crossfader │     │  [PADS]     │      │
│   │  Tempo      │     │  Browse     │     │  Tempo      │      │
│   │  Sync/Cue   │     │             │     │  Sync/Cue   │      │
│   └─────────────┘     └─────────────┘     └─────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Step 1: Open the DJ Mixer
1. Go to http://localhost:3000
2. Click **"Initialize Session"** button
3. Switch to **"DJ"** view using the view selector

### Step 2: Play Your First Track
1. Click **Play** button on Deck A (left side)
2. The platter will start spinning
3. You'll hear the default kick-snare pattern

### Step 3: Add the Second Deck
1. Click **Play** on Deck B (right side)
2. Now both decks are playing!

---

## Step-by-Step Tutorials

### 🎓 Tutorial 1: Basic Crossfade Mix

Learn to smoothly transition between two tracks.

| Step | Action | Result |
|------|--------|--------|
| 1 | Press **Play** on Deck A | Deck A starts playing |
| 2 | Move crossfader to the LEFT (-1) | Only Deck A is audible |
| 3 | Press **Play** on Deck B | Deck B starts (but muted by crossfader) |
| 4 | Slowly move crossfader to CENTER (0) | Both decks blend 50/50 |
| 5 | Continue moving crossfader to RIGHT (+1) | Deck B takes over completely |

**Pro Tip:** Use slow movements for smooth transitions!

---

### 🎓 Tutorial 2: Using the EQ

Shape the sound by boosting or cutting frequencies.

**The 3 EQ Bands:**
- **HI (High)** - Controls treble/cymbals/hi-hats (2500Hz+)
- **MID** - Controls vocals/lead sounds (around 1200Hz)
- **LO (Low)** - Controls bass/kick drums (below 300Hz)

**Exercise: EQ Swap Transition**
| Step | Action | Why |
|------|--------|-----|
| 1 | Play both decks, crossfader center | Both tracks playing |
| 2 | Turn Deck A's **LO** knob to minimum | Removes Deck A's bass |
| 3 | Turn Deck B's **LO** knob to maximum | Deck B's bass dominates |
| 4 | Slowly swap the LO knobs back | Smooth bass transition! |

---

### 🎓 Tutorial 3: Filter Sweeps

Create dramatic sweep effects with the filter knob.

| Position | Effect |
|----------|--------|
| Left (0) | Low-pass filter at 300Hz (muffled, underwater sound) |
| Center (0.5) | No filter (full sound) |
| Right (1) | High-pass filter at 9000Hz (thin, tinny, no bass) |

**Exercise: The Filter Drop**
1. Play Deck A
2. Turn filter knob slowly to the LEFT (low-pass opens up)
3. Quickly snap back to CENTER for dramatic effect!

---

### 🎓 Tutorial 4: Tempo Matching (Beat Matching)

Essential skill for seamless mixing.

| Step | Action |
|------|--------|
| 1 | Note the BPM display on each deck |
| 2 | If Deck B is faster, lower its Tempo fader |
| 3 | If Deck B is slower, raise its Tempo fader |
| 4 | Click **Sync** on Deck B to match Deck A automatically |

**Tempo Range:** 50% to 200% of original speed

---

### 🎓 Tutorial 5: Using Drum Pads

Trigger one-shot sounds for live performance.

Each deck has 4 pads:

| Pad | Deck A Sound | Deck B Sound |
|-----|--------------|--------------|
| 1 | Kick Drum | Kick 2 |
| 2 | Snare | Snare 2 |
| 3 | Hi-Hat | Hi-Hat 2 |
| 4 | Clap | Clap 2 |

**Exercise: Add Fills**
1. Play Deck A
2. During the loop, tap Pad 1 (kick) rhythmically
3. Add Pad 3 (hi-hat) for extra groove

---

### 🎓 Tutorial 6: Loading Different Tracks

Browse and load different patterns.

| Step | Action |
|------|--------|
| 1 | Turn the **Browse** knob in the mixer section |
| 2 | Display shows "Track 01", "Track 02", etc. |
| 3 | Click **Load A** to load pattern into Deck A |
| 4 | Click **Load B** to load pattern into Deck B |

**Available Patterns:**
- Track 01: Kick-Snare
- Track 02: Hi-Hat
- Track 03: Kick-Clap
- Track 04: Bass

---

### 🎓 Tutorial 7: Cue Preview

Listen to one deck in headphones while the other plays.

| Step | Action |
|------|--------|
| 1 | Click **Cue** on Deck A | Only Deck A is audible |
| 2 | Adjust Deck A's tempo/EQ without affecting output |
| 3 | Click **Cue** again to turn off | Normal crossfader mixing resumes |

---

## Controls Reference

### Deck Controls
| Control | Function |
|---------|----------|
| **Play/Pause** | Start/stop the deck |
| **Tempo Fader** | Speed adjustment (0.5x to 2x) |
| **Sync** | Match tempo to other deck |
| **Cue** | Solo preview mode |
| **Pads 1-4** | Trigger one-shot sounds |

### Mixer Controls
| Control | Function |
|---------|----------|
| **Trim** | Input gain per channel |
| **HI/MID/LO** | 3-band EQ |
| **Filter** | Low-pass ↔ High-pass |
| **Channel Fader** | Volume per channel |
| **Crossfader** | Balance A ↔ B |
| **Master** | Main output volume |
| **Browse** | Select track number |
| **Load A/B** | Load selected track |

---

## Tips & Tricks

### 🔥 Pro Tips

1. **Use EQ instead of crossfader** for cleaner transitions
2. **Cut the bass first** when mixing in a new track
3. **Small tempo adjustments** are less noticeable than big jumps
4. **Practice with simple patterns** before complex mixes
5. **Listen to the beat** - tap along to feel the rhythm

### ⚡ Keyboard Shortcuts
(If supported by your browser)
- Click platters to **Play/Pause**
- Use mousewheel on knobs for fine control

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No sound | Click "Initialize Session" first |
| Deck not playing | Make sure crossfader includes that deck |
| Volume too low | Check Trim, Fader, and Master levels |
| Sounds distorted | Lower the Trim and Master knobs |

---

Happy Mixing! 🎛️🎵
