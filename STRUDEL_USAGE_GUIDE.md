# Strudel Usage Guide - Synthetic Sounds Only

## ⚠️ Important: This App Uses Synthetic Sounds

This application is configured to use **synthetic waveforms** instead of audio samples. This means:

- ❌ **DON'T USE:** `s("bd")`, `s("sn")`, `s("hh")` - These try to load sample files
- ✅ **USE INSTEAD:** `note()` with `.s("synth")` - These use built-in synthesizers

## Why Synthetic Sounds?

1. **No Loading Required** - Instant playback, no waiting for samples
2. **Smaller Bundle** - No large audio files to download
3. **Consistent Sound** - Same sound on all devices
4. **More Control** - Easy to modify pitch, timbre, effects

## How to Make Sounds

### ✅ Correct Way: Use `note()` with Synths

```javascript
// Drums (use low notes with square wave)
note(m("c3 ~ c3 ~")).s("square").decay(0.05).fast(2)

// Bass (use triangle wave)
note(m("c2 g1 c2 g1")).s("triangle").sustain(0.2)

// Melody (use sawtooth wave)
note(m("c4 e4 g4 b4")).s("sawtooth").slow(2)

// FX (use sine wave)
note(m("<c5 g5> ~")).s("sine").slow(4)
```

### ❌ Wrong Way: Using `s()` with Sample Names

```javascript
// ❌ This will cause "sound bd not found" error
s("bd sd hh")

// ❌ This will also fail
s("bd").bank("RolandTR909")
```

## Available Synth Waveforms

Use these with `.s("waveform")`:

- **`square`** - Good for drums, punchy sounds
- **`triangle`** - Good for bass, smooth low end
- **`sawtooth`** - Good for melody, bright and rich
- **`sine`** - Good for FX, pure tone

## Pattern Examples

### Drums Pattern

```javascript
// Kick drum pattern
note(m("c3 ~ c3 ~")).s("square").decay(0.05).fast(2).gain(0.8)

// Snare pattern
note(m("~ c4 ~ c4")).s("square").decay(0.1).gain(0.7)

// Hi-hat pattern
note(m("c5*8")).s("square").decay(0.02).gain(0.4)

// Combined drum pattern
stack(
  note(m("c3 ~ c3 ~")).s("square").decay(0.05).fast(2),
  note(m("~ c4 ~ c4")).s("square").decay(0.1),
  note(m("c5*8")).s("square").decay(0.02).gain(0.4)
)
```

### Bass Pattern

```javascript
// Simple bassline
note(m("c2 ~ g1 ~")).s("triangle").sustain(0.3).gain(0.7)

// Funky bass
note(m("c2 c2 g1 ~ c2 ~ g1 g1")).s("triangle").sustain(0.2)

// Deep sub bass
note(m("c1*4")).s("sine").sustain(0.5).gain(0.6)
```

### Melody Pattern

```javascript
// Simple melody
note(m("c4 e4 g4 b4")).s("sawtooth").slow(2).gain(0.6)

// Arpeggio
note(m("c4 e4 g4 c5")).s("sawtooth").fast(2)

// Chord progression
note(m("<c4 e4 g4> <d4 f4 a4>")).s("sawtooth").slow(4)
```

## Mini-Notation Basics

The `m("...")` function uses mini-notation:

- **Space** - Separate events: `"c3 e3 g3"` = 3 notes
- **`~`** - Rest/silence: `"c3 ~ e3 ~"` = note, rest, note, rest
- **`*`** - Repeat: `"c3*4"` = c3 c3 c3 c3
- **`/`** - Slow down: `"c3/2"` = c3 plays half as often
- **`< >`** - Alternate: `"<c3 e3>"` = c3 then e3 on next cycle
- **`[ ]`** - Subdivide: `"[c3 e3]"` = both notes in one step

## Effects and Modifiers

Chain these after `.s("synth")`:

```javascript
// Volume
.gain(0.8)          // 0.0 to 1.0

// Envelope
.decay(0.1)         // How fast sound fades
.sustain(0.3)       // How long sound holds
.release(0.2)       // Fade out time

// Timing
.fast(2)            // Play twice as fast
.slow(2)            // Play half as fast

// Pitch
.note("+12")        // Transpose up an octave
.note("-12")        // Transpose down an octave

// Filter
.cutoff(1000)       // Low-pass filter frequency
.resonance(5)       // Filter resonance

// Panning
.pan(0.5)           // 0 = left, 0.5 = center, 1 = right
```

## Complete Examples

### Techno Beat

```javascript
stack(
  note(m("c3 ~ c3 ~")).s("square").decay(0.05).fast(2).gain(1),
  note(m("~ c4 ~ c4")).s("square").decay(0.1).gain(0.8),
  note(m("c5*8")).s("square").decay(0.02).gain(0.3),
  note(m("c2 ~ c2 ~")).s("triangle").sustain(0.2).gain(0.7)
)
```

### House Groove

```javascript
stack(
  note(m("c3*4")).s("square").decay(0.05).gain(1),
  note(m("~ c4 ~ c4")).s("square").decay(0.1).gain(0.8),
  note(m("c2 ~ g1 ~")).s("triangle").sustain(0.3).gain(0.7),
  note(m("c4 e4 g4 b4")).s("sawtooth").slow(2).gain(0.5)
)
```

### Ambient Texture

```javascript
stack(
  note(m("c3(3,8)")).s("square").decay(0.1).slow(2).gain(0.6),
  note(m("c2*2")).s("sine").sustain(0.8).gain(0.5),
  note(m("<c4 e4 g4> ~")).s("sawtooth").slow(4).gain(0.4).cutoff(800)
)
```

## Common Mistakes and Fixes

### ❌ Mistake: Using sample names

```javascript
s("bd sd hh")  // Error: sound bd not found!
```

### ✅ Fix: Use note() with synth

```javascript
note(m("c3 c4 c5")).s("square").decay(0.05)
```

---

### ❌ Mistake: Trying to load samples

```javascript
s("bd").bank("RolandTR909")  // Error: samples not loaded
```

### ✅ Fix: Use synthetic drums

```javascript
note(m("c3 ~ c3 ~")).s("square").decay(0.05).fast(2)
```

---

### ❌ Mistake: Using sound() function

```javascript
sound("bd sd")  // Error: sound not found
```

### ✅ Fix: Use note() with pattern

```javascript
note(m("c3 c4")).s("square").decay(0.1)
```

## Quick Reference

| Want to make... | Use this pattern |
|----------------|------------------|
| Kick drum | `note(m("c3 ~ c3 ~")).s("square").decay(0.05)` |
| Snare | `note(m("~ c4 ~ c4")).s("square").decay(0.1)` |
| Hi-hat | `note(m("c5*8")).s("square").decay(0.02)` |
| Bass | `note(m("c2 g1")).s("triangle").sustain(0.3)` |
| Melody | `note(m("c4 e4 g4")).s("sawtooth")` |
| Pad | `note(m("c3 e3 g3")).s("sine").sustain(0.8)` |

## Tips

1. **Start Simple** - Begin with one track, then add more
2. **Use Low Notes for Drums** - c3, c4, c5 work well
3. **Use Low Notes for Bass** - c1, c2, g1 for deep bass
4. **Experiment with Decay** - Short decay (0.05) for drums, longer (0.3+) for pads
5. **Layer Sounds** - Use `stack()` to combine multiple patterns
6. **Adjust Gain** - Keep total gain under 1.0 to avoid clipping

## Need Help?

If you see "sound not found" errors:
1. Make sure you're using `note(m("...")).s("synth")`
2. Don't use `s("samplename")`
3. Use synthetic waveforms: square, triangle, sawtooth, sine
4. Check the examples above for correct syntax

## Advanced: If You Really Need Samples

If you absolutely need to use samples, you must load them first:

```javascript
// Load samples (do this once at startup)
samples("github")

// Then you can use them
s("bd sd hh")
```

However, this app is designed for synthetic sounds, so stick with `note()` patterns for best results!

