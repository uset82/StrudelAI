# Fix for "note(...).scale is not a function" Error

## Problem

Console error when AI generates code:
```
TypeError: note(...).scale is not a function
    at async useSonicSocket.useCallback[sendCommand] (src/hooks/useSonicSocket.ts:278:21)
```

## Root Cause

The AI (Grok 4.1 Fast) was generating code that uses `.scale()` method, which **does not exist** in Strudel.

**Example of problematic code:**
```javascript
note("c4 e4 g4 [a4 g4] c5 ~ e5 g5 f5 e5 d5 c5 ~").scale('C4 minor').s("sawtooth")
```

The `.scale()` method is not part of Strudel's API. The AI was hallucinating this method.

## Solution Applied

Added two layers of protection:

### Fix 1: Updated System Prompt

**File: `src/app/api/agent/route.ts` (Lines 32-60)**

Added explicit documentation of:
- ✅ **ALLOWED METHODS** - What the AI can use
- ✅ **FORBIDDEN METHODS** - What the AI must NOT use

```typescript
## ALLOWED METHODS
- .s("waveform") - Set synth (square, triangle, sawtooth, sine)
- .decay(0.05) - Envelope decay time
- .sustain(0.2) - Envelope sustain time
- .gain(0.8) - Volume (0.0 to 1.0)
- .slow(2) - Slow down pattern
- .fast(2) - Speed up pattern

## FORBIDDEN METHODS (DO NOT USE)
- .scale() - Does NOT exist in Strudel
- .bank() - Sample banks not available
- .lpf(), .hpf() - Use .lowpass(), .highpass() instead
- cpm() - Tempo handled separately
- analyze() - Analysis handled separately
```

### Fix 2: Post-Processing Code Cleaning

**File: `src/app/api/agent/route.ts` (Lines 132-147)**

Added automatic removal of forbidden methods:

```typescript
if (parsed.type === 'code' && parsed.content) {
    // Clean the code to remove forbidden methods
    let cleanedCode = parsed.content
        // Remove .scale() calls (not supported in Strudel)
        .replace(/\.scale\([^)]*\)/g, '')
        // Remove .bank() calls (samples not available)
        .replace(/\.bank\([^)]*\)/g, '')
        // Replace .lpf() with .lowpass()
        .replace(/\.lpf\(/g, '.lowpass(')
        // Replace .hpf() with .highpass()
        .replace(/\.hpf\(/g, '.highpass(');
    
    console.log('[API/Agent] Cleaned code:', cleanedCode);
    return NextResponse.json({ type: 'code', code: cleanedCode });
}
```

## How It Works

### Before Fix

**AI generates:**
```javascript
note("c4 e4 g4").scale('C4 minor').s("sawtooth")
```

**Result:**
```
❌ TypeError: note(...).scale is not a function
```

### After Fix

**AI generates:**
```javascript
note("c4 e4 g4").scale('C4 minor').s("sawtooth")
```

**Post-processing removes `.scale('C4 minor')`:**
```javascript
note("c4 e4 g4").s("sawtooth")
```

**Result:**
```
✅ Code executes successfully
```

## Other Methods Fixed

### .bank() Removal

**Before:**
```javascript
s("bd").bank("RolandTR909")
```

**After:**
```javascript
s("bd")
```

### .lpf() → .lowpass()

**Before:**
```javascript
note(m("c3 ~ c3 ~")).s("square").lpf(500)
```

**After:**
```javascript
note(m("c3 ~ c3 ~")).s("square").lowpass(500)
```

### .hpf() → .highpass()

**Before:**
```javascript
note(m("c5*8")).s("square").hpf(2000)
```

**After:**
```javascript
note(m("c5*8")).s("square").highpass(2000)
```

## Testing

### Test 1: Command That Previously Failed

**Type:** `play happy music`

**Expected AI Response (before cleaning):**
```javascript
note("c4 e4 g4").scale('C4 major').s("sawtooth")
```

**After Cleaning:**
```javascript
note("c4 e4 g4").s("sawtooth")
```

**Result:**
```
✅ Code executes successfully
✅ Music plays
```

### Test 2: Check Server Logs

**Look for:**
```
[API/Agent] Raw AI response: {"type": "code", "content": "...scale(...)..."}
[API/Agent] Cleaned code: <code without .scale()>
```

### Test 3: Complex Pattern

**Type:** `play a funky beat`

**If AI uses forbidden methods, they'll be automatically removed**

## Monitoring

### Server Logs

```bash
# Good - Forbidden methods removed
[API/Agent] Raw AI response: {"type": "code", "content": "note(...).scale('C4 minor')..."}
[API/Agent] Cleaned code: note(...)...

# Good - No forbidden methods
[API/Agent] Raw AI response: {"type": "code", "content": "stack(...)"}
[API/Agent] Cleaned code: stack(...)
```

### Browser Console

```javascript
// Good - Code executes
[SonicSocket] Generated code: note(m("c4 e4 g4")).s("sawtooth")
System: Code executed successfully

// Bad - Would have failed before fix
[SonicSocket] Generated code: note(m("c4 e4 g4")).scale('C4 minor').s("sawtooth")
TypeError: note(...).scale is not a function
```

## Strudel Methods Reference

### ✅ Supported Methods

**Synthesis:**
- `.s("waveform")` - Set synthesizer (square, triangle, sawtooth, sine)

**Envelope:**
- `.decay(time)` - Decay time in seconds
- `.sustain(time)` - Sustain time in seconds
- `.release(time)` - Release time in seconds

**Volume:**
- `.gain(level)` - Volume level (0.0 to 1.0)

**Timing:**
- `.slow(factor)` - Slow down pattern
- `.fast(factor)` - Speed up pattern

**Filters:**
- `.lowpass(freq)` - Low-pass filter
- `.highpass(freq)` - High-pass filter
- `.resonance(amount)` - Filter resonance

**Effects:**
- `.room(amount)` - Reverb
- `.delay(time)` - Delay effect
- `.pan(position)` - Stereo panning (0 = left, 1 = right)

### ❌ Unsupported Methods

**These do NOT exist in Strudel:**
- `.scale()` - No scale method
- `.bank()` - No sample banks
- `.lpf()` - Use `.lowpass()` instead
- `.hpf()` - Use `.highpass()` instead
- `.bpf()` - Use `.bandpass()` instead

## Files Modified

1. ✅ `src/app/api/agent/route.ts` - Lines 32-60: Added method documentation
2. ✅ `src/app/api/agent/route.ts` - Lines 132-147: Added code cleaning

## Verification Checklist

- [x] System prompt lists allowed methods
- [x] System prompt lists forbidden methods
- [x] Post-processing removes .scale()
- [x] Post-processing removes .bank()
- [x] Post-processing replaces .lpf() with .lowpass()
- [x] Post-processing replaces .hpf() with .highpass()
- [x] Cleaned code is logged
- [x] Server restarted
- [x] No TypeScript errors

## Additional Improvements

### Future: Add More Method Replacements

If the AI uses other incorrect methods, add them to the cleaning regex:

```typescript
let cleanedCode = parsed.content
    .replace(/\.scale\([^)]*\)/g, '')
    .replace(/\.bank\([^)]*\)/g, '')
    .replace(/\.lpf\(/g, '.lowpass(')
    .replace(/\.hpf\(/g, '.highpass(')
    // Add more as needed:
    .replace(/\.bpf\(/g, '.bandpass(')
    .replace(/\.notch\(/g, '.bandreject(');
```

### Future: Validate Code Before Execution

Add a validation step that checks for known patterns:

```typescript
function validateStrudelCode(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (code.includes('.scale(')) {
        errors.push('.scale() method does not exist');
    }
    
    if (code.includes('.bank(')) {
        errors.push('.bank() method not available');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}
```

## Summary

✅ **Fixed:** AI can no longer break code with `.scale()` method
✅ **Fixed:** Other forbidden methods also removed automatically
✅ **Fixed:** Method aliases replaced with correct names
✅ **Added:** Comprehensive method documentation in system prompt
✅ **Added:** Automatic code cleaning
✅ **Server:** Restarted and ready for testing

The "note(...).scale is not a function" error is now completely prevented through both AI instruction and post-processing!

