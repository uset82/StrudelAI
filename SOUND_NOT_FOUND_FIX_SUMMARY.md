# Complete Fix for "sound bd not found! Is it loaded?" Error

## Problem Summary

Users were encountering this error:

```text
sound bd not found! Is it loaded?
```

This occurred when trying to use Strudel's `s()` function with sample names like
`s("bd")`, `s("sn")`, etc.

## Root Cause

The application doesn't have audio sample files loaded. When users (or AI)
generate patterns using `s("bd")`, Strudel tries to load a sample file named
"bd" which doesn't exist.

## Complete Solution Applied

### 1. Updated AI System Prompts (2 files)

#### File: `src/server/googleHandler.ts`

**Changed the system prompt to:**

- ✅ Instruct AI to use NOTE NAMES (c1-c7) instead of sample names (bd, sn, hh)
- ✅ Explain that samples are NOT available
- ✅ Provide correct pattern examples using notes
- ✅ Remove references to `sound()`, `.bank()`, and sample loading

**Before:**

```text
- Drums: "bd ~ sd ~" (kick snare)
- Use 'sound("sawtooth")' or 'sound("square")'
```

**After:**

```text
CORRECT Pattern Format:
- Drums: "c3 ~ c3 ~" (kick pattern using note c3)
- Snare: "~ c4 ~ c4" (snare pattern using note c4)
- Hi-hat: "c5*8" (hi-hat pattern using note c5)

The system will automatically convert these to: note(m("pattern")).s("synth")

DO NOT USE:
- s("bd") - This tries to load samples and will fail
- .bank("RolandTR909") - Sample banks are not available
```

#### File: `src/server/aiHandler.ts`

**Updated system prompt similarly:**

- ✅ Use note names instead of sample names
- ✅ Provide correct mini-notation examples
- ✅ Explain automatic conversion to synthetic sounds

**Before:**

```text
- Drums: "bd sd" (kick snare)
- Bass/Melody: "c3 e3 g3" (notes)
```

**After:**

```text
Pattern Guide (use NOTE NAMES):
- Drums: "c3 ~ c3 ~" (kick using note c3), "~ c4 ~ c4" (snare using c4)
- Bass: "c2 g1 c2 g1" (bass notes)
- Melody: "c4 e4 g4 b4" (melody notes)

IMPORTANT:
- Provide ONLY note patterns like "c3 ~ c3 ~"
- DO NOT use sample names like "bd", "sn", "hh"
- The engine automatically converts patterns to synthetic sounds
```

### 2. Updated UI Placeholders (2 files)

#### File: `src/components/SonicInterface.tsx`

**Changed input placeholder:**

**Before:**

```text
"Type command or code (e.g., drums: s('bd'))"
```

**After:**

```text
'Type command (e.g., "play techno" or drums: note(m("c3 ~ c3 ~")).s("square"))'
```

#### File: `src/components/StrudelCodeView.tsx`

**Changed textarea placeholder:**

**Before:**

```text
"// Type Strudel code here..."
```

**After:**

```text
"// Type Strudel code here...
// Use synthetic sounds: note(m("c3 ~ c3 ~")).s("square")
// Don't use s("bd") - samples not loaded!"
```

### 3. Pattern Conversion Logic (Already in place)

The `formatTrack()` function in `src/lib/strudel/engine.ts` already handles conversion:

```typescript
// Plain patterns like "c3 ~ c3 ~" are auto-converted to:
note(m("c3 ~ c3 ~")).s("square")

// Strudel code starting with s(, note(, etc. is passed through as-is
```

**Note:** The user manually updated this file to detect Strudel code patterns.

### 4. Documentation Created (3 files)

1. **`STRUDEL_USAGE_GUIDE.md`** - Comprehensive guide on using synthetic sounds
2. **`SAMPLE_ERROR_FIX.md`** - Quick reference for fixing sample errors
3. **`SOUND_NOT_FOUND_FIX_SUMMARY.md`** - This file

## How It Works Now

### User Types Plain Pattern

**Input:** `c3 ~ c3 ~`

**Auto-converted to:**

```javascript
note(m("c3 ~ c3 ~")).s("square").decay(0.05)
```

**Result:** ✅ Plays kick drum using square wave synth

### User Types Strudel Code

**Input:** `note(m("c3 ~ c3 ~")).s("square")`

**Passed through as-is:**

**Result:** ✅ Plays exactly as written

### User Types Sample Code (Wrong)

**Input:** `s("bd")`

**Passed through as-is:**

**Result:** ❌ Error: "sound bd not found!"

**Solution:** User should use `note(m("c3")).s("square")` instead

## AI Behavior Changes

### Before Fix

AI might generate:

```javascript
s("bd sd hh")  // ❌ Tries to load samples
```

### After Fix

AI now generates:

```javascript
c3 ~ c4 ~  // ✅ Uses note names, auto-converted to synths
```

Or:

```javascript
expr:note(m("c3 ~ c3 ~")).s("square")  // ✅ Explicit synth usage
```

## Testing the Fix

### Test 1: Voice Command

**Say:** "play a techno beat"

**Expected AI Response:**

- Sets BPM to 130-140
- Generates patterns using note names: "c3 ~ c3 ~", "c2 g1", etc.
- NO "sound not found" errors

### Test 2: Text Command

**Type:** `play house music`

**Expected:**

- AI generates note-based patterns
- Patterns auto-convert to synthetic sounds
- Music plays successfully

### Test 3: Direct Code (Correct)

**Type in code editor:**

```javascript
note(m("c3 ~ c3 ~")).s("square").decay(0.05)
```

**Expected:**

- ✅ Plays kick drum pattern
- No errors

### Test 4: Direct Code (Wrong - for testing)

**Type in code editor:**

```javascript
s("bd")
```

**Expected:**

- ❌ Error: "sound bd not found!"
- This is expected - user should use note() instead

## Files Modified

1. ✅ `src/server/googleHandler.ts` - Updated AI system prompt
2. ✅ `src/server/aiHandler.ts` - Updated AI system prompt
3. ✅ `src/components/SonicInterface.tsx` - Updated input placeholder
4. ✅ `src/components/StrudelCodeView.tsx` - Updated textarea placeholder

## Files Already Correct

1. ✅ `src/lib/strudel/engine.ts` - Pattern conversion logic (user updated)
2. ✅ `src/lib/agent/context-manager.ts` - Already has correct examples
3. ✅ `src/server/mockAiHandler.ts` - Already uses note names

## Quick Reference for Users

### ✅ DO Use These Patterns

```javascript
// Drums
note(m("c3 ~ c3 ~")).s("square").decay(0.05)  // Kick
note(m("~ c4 ~ c4")).s("square").decay(0.1)   // Snare
note(m("c5*8")).s("square").decay(0.02)       // Hi-hat

// Bass
note(m("c2 g1 c2 g1")).s("triangle").sustain(0.2)

// Melody
note(m("c4 e4 g4 b4")).s("sawtooth").slow(2)

// Or just plain patterns (auto-converted):
c3 ~ c3 ~
c2 g1 c2 g1
c4 e4 g4 b4
```

### ❌ DON'T Use These

```javascript
s("bd")              // ❌ Tries to load sample
s("bd sd hh")        // ❌ Tries to load samples
s("bd").bank("...")  // ❌ Sample banks not available
sound("bd")          // ❌ Function doesn't exist
```

## Available Synth Waveforms

Use with `.s("waveform")`:

- **`square`** - Punchy, good for drums
- **`triangle`** - Smooth, good for bass
- **`sawtooth`** - Bright, good for melody
- **`sine`** - Pure tone, good for FX/pads

## Expected Results

### Before All Fixes

```text
❌ AI generates: s("bd sd hh")
❌ Error: "sound bd not found!"
❌ No music plays
```

### After All Fixes

```text
✅ AI generates: c3 ~ c4 ~
✅ Auto-converts to: note(m("c3 ~ c4 ~")).s("square")
✅ Music plays successfully
✅ No errors
```

## Verification Checklist

- [x] AI prompts updated to use note names
- [x] UI placeholders show correct examples
- [x] Pattern conversion logic in place
- [x] Documentation created
- [x] TypeScript compiles with no errors
- [x] No new linting issues
- [x] Mock handler uses note names
- [x] Context manager has correct examples

## If Errors Still Occur

If you still see "sound bd not found" errors:

1. **Check what pattern was generated:**
   - Open browser console (F12)
   - Look for the pattern being evaluated
   - If it contains `s("bd")`, the AI is still using old format

2. **Verify AI is using updated prompts:**
   - Check server logs
   - Ensure the server was restarted after changes
   - Verify the correct AI handler is being used

3. **Check user input:**
   - If user manually types `s("bd")`, they'll get the error
   - Guide them to use `note(m("c3")).s("square")` instead

4. **Refer to documentation:**
   - `STRUDEL_USAGE_GUIDE.md` - Full guide
   - `SAMPLE_ERROR_FIX.md` - Quick fixes

## Summary

The "sound bd not found" error has been comprehensively addressed by:

1. ✅ Updating AI prompts to generate note-based patterns
2. ✅ Updating UI to show correct examples
3. ✅ Leveraging existing pattern conversion logic
4. ✅ Creating comprehensive documentation

Users and AI should now consistently use synthetic sounds, eliminating sample
loading errors entirely.
