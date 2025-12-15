# Fix for "sound bd not found! Is it loaded?" Error

## Problem

Users are getting this error:
```
sound bd not found! Is it loaded?
```

This happens when they try to use Strudel's `s()` function with sample names like:
- `s("bd")` - bass drum
- `s("sn")` - snare
- `s("hh")` - hi-hat
- `s("bd sd hh")` - multiple samples

## Root Cause

The `s()` function in Strudel tries to load audio sample files. This app doesn't have sample files loaded, so it fails.

## Solution

**Use synthetic sounds instead of samples!**

### ❌ Wrong (Causes Error)

```javascript
s("bd")                    // Error: sound bd not found
s("bd sd hh")              // Error: sound bd not found
s("bd").bank("RolandTR909") // Error: sound bd not found
```

### ✅ Correct (Works!)

```javascript
// Use note() with synthetic waveforms
note(m("c3 ~ c3 ~")).s("square").decay(0.05)  // Kick drum sound
note(m("~ c4 ~ c4")).s("square").decay(0.1)   // Snare sound
note(m("c5*8")).s("square").decay(0.02)       // Hi-hat sound
```

## How the App Handles Patterns

### 1. Plain Text Patterns (Auto-Converted)

When you type plain patterns like:
```
bd ~ sd ~
```

The app automatically converts them to:
```javascript
note(m("bd ~ sd ~")).s("square")
```

This uses synthetic sounds, so it works!

### 2. Strudel Code Starting with `s(`

When you type:
```javascript
s("bd")
```

The app passes it through as-is, which causes the error because samples aren't loaded.

### 3. Strudel Code with `expr:` Prefix

When you type:
```
expr:note(m("c3 ~ c3 ~")).s("square")
```

The app uses it exactly as written.

## Quick Fixes for Common Patterns

### Drums

| Instead of... | Use this... |
|--------------|-------------|
| `s("bd")` | `note(m("c3")).s("square").decay(0.05)` |
| `s("sd")` | `note(m("c4")).s("square").decay(0.1)` |
| `s("hh")` | `note(m("c5")).s("square").decay(0.02)` |
| `s("bd sd")` | `note(m("c3 c4")).s("square").decay(0.05)` |
| `s("bd ~ sd ~")` | `note(m("c3 ~ c4 ~")).s("square").decay(0.05)` |

### Why This Works

- `note()` - Creates a note pattern
- `m("...")` - Mini-notation for rhythm
- `.s("square")` - Uses square wave synthesizer (built-in, no loading needed)
- `.decay(0.05)` - Makes it sound punchy like a drum

## Available Synthetic Waveforms

Use these with `.s("waveform")`:

1. **`square`** - Punchy, good for drums
2. **`triangle`** - Smooth, good for bass
3. **`sawtooth`** - Bright, good for melody
4. **`sine`** - Pure tone, good for FX

## Complete Working Examples

### Example 1: Simple Drum Pattern

```javascript
// Kick and snare
stack(
  note(m("c3 ~ c3 ~")).s("square").decay(0.05).gain(1),
  note(m("~ c4 ~ c4")).s("square").decay(0.1).gain(0.8)
)
```

### Example 2: Full Beat

```javascript
// Kick, snare, hi-hat, bass
stack(
  note(m("c3 ~ c3 ~")).s("square").decay(0.05).fast(2),
  note(m("~ c4 ~ c4")).s("square").decay(0.1),
  note(m("c5*8")).s("square").decay(0.02).gain(0.4),
  note(m("c2 g1 c2 g1")).s("triangle").sustain(0.2).gain(0.7)
)
```

### Example 3: Techno Beat

```javascript
stack(
  note(m("c3*4")).s("square").decay(0.05).gain(1),
  note(m("c5*8")).s("square").decay(0.02).gain(0.3),
  note(m("c2 ~ c2 ~")).s("triangle").sustain(0.2).gain(0.7)
)
```

## If You Really Need Samples

If you absolutely must use samples, you need to load them first. The app attempts to load samples in `ensureSynths()` function:

```javascript
// This is already in the code (lines 86-98 of engine.ts)
await evaluate('samples("github")');
```

However, this may fail due to:
1. Network issues
2. CORS restrictions
3. Sample repository unavailable

**Recommendation:** Stick with synthetic sounds for reliability!

## Testing Your Patterns

### Test 1: Verify Synthetic Sounds Work

Type in the code editor:
```javascript
note(m("c3 ~ c3 ~")).s("square").decay(0.05)
```

You should hear a kick drum pattern with NO errors.

### Test 2: Verify Sample Error

Type in the code editor:
```javascript
s("bd")
```

You will see: "sound bd not found! Is it loaded?"

### Test 3: Use Voice Commands

Say: "play a techno beat"

The AI should generate patterns using `note()` and synthetic sounds.

## Updating AI Prompts

The AI handlers should be configured to NEVER use `s()` with sample names. Check these files:

1. **`src/server/googleHandler.ts`** - Line 52-55
2. **`src/server/aiHandler.ts`** - Line 66-71
3. **`src/lib/agent/context-manager.ts`** - Line 25-31

Make sure they say:
```
CRITICAL: Use synthetic sounds ONLY.
- For Drums: Use note(m("...")).s("square")
- For Bass: Use note(m("...")).s("triangle")
- For Melody: Use note(m("...")).s("sawtooth")
- DO NOT use s("bd"), s("sn"), or any sample names
```

## Summary

✅ **DO:**
- Use `note(m("pattern")).s("synth")`
- Use synthetic waveforms: square, triangle, sawtooth, sine
- Use low notes (c1-c5) for drums and bass
- Use higher notes (c4-c7) for melody

❌ **DON'T:**
- Use `s("bd")` or any sample names
- Use `.bank()` to load sample banks
- Expect samples to be available

## Quick Reference Card

```javascript
// DRUMS (use square wave, low notes, short decay)
note(m("c3 ~ c3 ~")).s("square").decay(0.05)  // Kick
note(m("~ c4 ~ c4")).s("square").decay(0.1)   // Snare
note(m("c5*8")).s("square").decay(0.02)       // Hi-hat

// BASS (use triangle wave, very low notes)
note(m("c2 g1 c2 g1")).s("triangle").sustain(0.2)

// MELODY (use sawtooth wave, mid-high notes)
note(m("c4 e4 g4 b4")).s("sawtooth").slow(2)

// FX (use sine wave, high notes)
note(m("<c5 g5> ~")).s("sine").slow(4)
```

## Need More Help?

See `STRUDEL_USAGE_GUIDE.md` for comprehensive examples and patterns!

