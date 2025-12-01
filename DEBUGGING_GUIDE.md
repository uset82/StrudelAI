# Debugging Guide for Syntax Errors

## Current Error

```
SyntaxError: Unexpected token '}'
    at Function (<anonymous>:null:null)
    at async StrudelCodeView.useEffect.timer (src/components/StrudelCodeView.tsx:118:17)
```

## How to Debug

### Step 1: Check Browser Console

Open the browser console (F12) and look for these logs:

```javascript
[StrudelCodeView] Evaluating code: <the code being evaluated>
[StrudelCodeView] Code to eval: <the actual code sent to Strudel>
[StrudelCodeView] Code evaluation error: <specific error>
[StrudelCodeView] Failed code: <the code that failed>
```

### Step 2: Check Server Logs

Look at the terminal running `npm run dev` for:

```
[API/Agent] Raw AI response: <what the AI generated>
[API/Agent] Cleaned code: <code after cleaning>
```

### Step 3: Identify the Problem

Compare the logs to find where the syntax error is introduced:

1. **AI generates bad code** → Fix in system prompt or add more cleaning
2. **Cleaning breaks code** → Fix the regex replacements
3. **User types bad code** → Validation should catch it
4. **Code is valid but Strudel rejects it** → Strudel-specific issue

## Common Issues

### Issue 1: Mismatched Brackets

**Example:**
```javascript
stack(
  note(m("c3 ~ c3 ~")).s("square")
}}
```

**Detection:**
- `isBalanced()` should catch this
- If it doesn't, the balance check has a bug

**Fix:**
- Check the `isBalanced()` function
- Make sure it handles all bracket types

### Issue 2: Invalid Mini-Notation

**Example:**
```javascript
note(m("c3 ~ c3 ~]")).s("square")
```

**Detection:**
- `validateSyntax()` won't catch this (valid JavaScript)
- Strudel will reject it at runtime

**Fix:**
- Add Strudel-specific validation
- Check for balanced brackets in mini-notation strings

### Issue 3: Forbidden Methods

**Example:**
```javascript
note(m("c3 ~ c3 ~")).scale('C4 minor').s("square")
```

**Detection:**
- Should be caught by code cleaning
- Check if `.scale()` is being removed

**Fix:**
- Verify the regex in `src/app/api/agent/route.ts` line 135

### Issue 4: Incomplete Code

**Example:**
```javascript
stack(
  note(m("c3 ~ c3 ~")).s("square"
```

**Detection:**
- `isBalanced()` should catch this
- Evaluation should be skipped

**Fix:**
- User needs to finish typing
- No action needed

## Debugging Steps

### 1. Enable Detailed Logging

The code now logs:
- Code being evaluated
- Code sent to Strudel
- Errors with full details
- Failed code snippets

### 2. Check Validation Layers

**Layer 1: Balance Check**
```typescript
if (!isBalanced(codeToRun)) return;
```
- Checks: Brackets, parentheses, braces, strings
- Logs: None (silent skip)

**Layer 2: Syntax Validation**
```typescript
const validation = validateSyntax(codeToEval);
if (!validation.valid) {
    console.warn('[StrudelCodeView] Syntax error:', validation.error);
    setRunError(`Syntax error: ${validation.error}`);
    return;
}
```
- Checks: JavaScript syntax
- Logs: `[StrudelCodeView] Syntax error: <error>`

**Layer 3: Strudel Evaluation**
```typescript
try {
    await evalStrudelCode(codeToEval);
} catch (err: any) {
    console.error('[StrudelCodeView] Code evaluation error:', err);
    console.error('[StrudelCodeView] Failed code:', codeToEval);
    setRunError(`Evaluation error: ${errorMsg}`);
}
```
- Checks: Strudel runtime
- Logs: `[StrudelCodeView] Code evaluation error: <error>`

### 3. Test Each Layer

**Test Balance Check:**
```javascript
// In browser console
const code = 'stack(note(m("c3 ~ c3 ~")).s("square")';
// Should not evaluate (unbalanced)
```

**Test Syntax Validation:**
```javascript
// In browser console
const code = 'stack(note(m("c3 ~ c3 ~")).s("square")}}';
// Should show: "Syntax error: Unexpected token '}'"
```

**Test Strudel Evaluation:**
```javascript
// In browser console
const code = 'note(m("c3 ~ c3 ~")).nonExistentMethod()';
// Should show: "Evaluation error: nonExistentMethod is not a function"
```

## Current State

### Files with Validation

1. **`src/components/StrudelCodeView.tsx`**
   - Lines 43-65: `isBalanced()` function
   - Lines 71-79: `validateSyntax()` function
   - Lines 98: Balance check
   - Lines 106-114: Syntax validation
   - Lines 116-133: Strudel evaluation with error handling

2. **`src/app/api/agent/route.ts`**
   - Lines 132-147: Code cleaning (removes forbidden methods)

3. **`src/hooks/useSonicSocket.ts`**
   - Lines 276-285: Error handling for AI-generated code

### What's Protected

✅ Unbalanced brackets/parentheses
✅ Invalid JavaScript syntax
✅ Forbidden methods (`.scale()`, `.bank()`)
✅ Runtime errors in Strudel
✅ AI-generated malformed code

### What's NOT Protected

❌ Invalid mini-notation (e.g., `m("c3 ~ c3 ~]")`)
❌ Invalid note names (e.g., `m("x1 y2 z3")`)
❌ Invalid waveforms (e.g., `.s("invalid")`)
❌ Strudel-specific syntax errors

## How to Fix Remaining Issues

### Add Mini-Notation Validation

```typescript
const validateMiniNotation = (code: string): { valid: boolean; error?: string } => {
    // Extract all m("...") patterns
    const miniNotationRegex = /m\s*\(\s*["']([^"']+)["']\s*\)/g;
    let match;
    
    while ((match = miniNotationRegex.exec(code)) !== null) {
        const notation = match[1];
        
        // Check for balanced brackets in mini-notation
        let bracketCount = 0;
        for (const char of notation) {
            if (char === '[') bracketCount++;
            if (char === ']') bracketCount--;
            if (bracketCount < 0) {
                return { valid: false, error: `Unbalanced brackets in mini-notation: ${notation}` };
            }
        }
        
        if (bracketCount !== 0) {
            return { valid: false, error: `Unbalanced brackets in mini-notation: ${notation}` };
        }
    }
    
    return { valid: true };
};
```

### Add Waveform Validation

```typescript
const VALID_WAVEFORMS = ['square', 'triangle', 'sawtooth', 'sine'];

const validateWaveforms = (code: string): { valid: boolean; error?: string } => {
    const waveformRegex = /\.s\s*\(\s*["']([^"']+)["']\s*\)/g;
    let match;
    
    while ((match = waveformRegex.exec(code)) !== null) {
        const waveform = match[1];
        if (!VALID_WAVEFORMS.includes(waveform)) {
            return { valid: false, error: `Invalid waveform: ${waveform}. Use: ${VALID_WAVEFORMS.join(', ')}` };
        }
    }
    
    return { valid: true };
};
```

## Immediate Actions

### If You're Seeing This Error Now

1. **Open browser console (F12)**
2. **Look for the log:** `[StrudelCodeView] Failed code: <code>`
3. **Copy the failed code**
4. **Check for:**
   - Mismatched brackets
   - Invalid syntax
   - Forbidden methods
5. **Report the code** so we can add specific validation

### Example Debug Session

**Error:**
```
SyntaxError: Unexpected token '}'
```

**Browser Console:**
```
[StrudelCodeView] Evaluating code: stack(...)
[StrudelCodeView] Code to eval: stack(...)}}
[StrudelCodeView] Code evaluation error: Unexpected token '}'
[StrudelCodeView] Failed code: stack(...)}}
```

**Analysis:**
- Extra `}}` at the end
- `isBalanced()` should have caught this
- Bug in balance check or code was modified after validation

**Fix:**
- Check if code is being modified between validation and evaluation
- Verify `isBalanced()` logic

## Summary

The app now has comprehensive error handling and logging. When you see a syntax error:

1. ✅ Check browser console for detailed logs
2. ✅ Check server logs for AI-generated code
3. ✅ Identify which layer failed
4. ✅ Report the specific code that failed

This will help us add targeted validation for specific issues!

