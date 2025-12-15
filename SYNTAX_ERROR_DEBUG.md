# Fix for "Invalid or unexpected token" Syntax Error

## Problem

Console error when AI generates code:
```
SyntaxError: Invalid or unexpected token
    at Function (<anonymous>:null:null)
    at async useSonicSocket.useCallback[sendCommand] (src/hooks/useSonicSocket.ts:270:13)
```

## Root Cause

The AI (Grok 4.1 Fast via OpenRouter) is generating code that contains:
1. Markdown formatting (```javascript ... ```)
2. Explanatory text ("Here is the code:")
3. Comments or invalid syntax
4. Special characters that break JavaScript parsing

## Solution Applied

Added comprehensive code cleaning and error handling in two places:

### Fix 1: API Route Code Cleaning

**File: `src/app/api/agent/route.ts` (Lines 100-135)**

Added robust code cleaning that:
- ✅ Removes markdown code blocks
- ✅ Removes AI explanations ("Here is the code:", "Output:", etc.)
- ✅ Removes comment lines at the start
- ✅ Logs raw and cleaned code for debugging
- ✅ Returns error if no valid code generated

```typescript
const code = completion.choices[0].message.content?.trim() || '';
console.log('[API/Agent] Raw AI response:', code);

// Clean up any markdown formatting, explanations, or extra text
let cleanCode = code
    // Remove markdown code blocks
    .replace(/^```(?:javascript|js|strudel)?\s*/gm, '')
    .replace(/```\s*$/gm, '')
    // Remove common AI explanations
    .replace(/^Here(?:'s| is) (?:the|a) code.*?:\s*/i, '')
    .replace(/^Output:\s*/i, '')
    .replace(/^Result:\s*/i, '')
    // Remove comments at the start
    .replace(/^\/\/.*\n/gm, '')
    .trim();

// If the code is empty after cleaning, return an error
if (!cleanCode) {
    console.error('[API/Agent] No valid code generated');
    return NextResponse.json(
        { error: 'AI did not generate valid code' },
        { status: 500 }
    );
}

console.log('[API/Agent] Cleaned code:', cleanCode);
return NextResponse.json({ code: cleanCode });
```

### Fix 2: Better Error Handling in Frontend

**File: `src/hooks/useSonicSocket.ts` (Lines 263-290)**

Added:
- ✅ Logging of generated code
- ✅ Try-catch around code evaluation
- ✅ Detailed error messages to user
- ✅ Shows problematic code snippet

```typescript
const generatedCode = data.code;
console.log('[SonicSocket] Generated code:', generatedCode);

setMessages(prev => [...prev, `AI: Generated code for "${trimmed}"`]);

// Update local code view
setCurrentCode(generatedCode);

// Execute locally with error handling
try {
    await evalStrudelCode(generatedCode);
    setMessages(prev => [...prev, `System: Code executed successfully`]);
} catch (evalErr: any) {
    console.error('[SonicSocket] Code evaluation error:', evalErr);
    setMessages(prev => [...prev, `Evaluation Error: ${evalErr.message || 'Invalid code syntax'}`]);
    // Show the problematic code to the user
    setMessages(prev => [...prev, `Problematic code: ${generatedCode.slice(0, 100)}...`]);
}
```

## How to Debug

### Step 1: Check Server Logs

When you send a command, look for these logs in the server terminal:

```
[API/Agent] Raw AI response: <what the AI actually said>
[API/Agent] Cleaned code: <code after cleaning>
```

**Example of problematic AI response:**
```
Here is the code:
```javascript
stack(
  note(m("c3 ~ c3 ~")).s("square")
)
```
```

**After cleaning:**
```
stack(
  note(m("c3 ~ c3 ~")).s("square")
)
```

### Step 2: Check Browser Console

Open browser console (F12) and look for:

```
[SonicSocket] Generated code: <the code received from API>
[SonicSocket] Code evaluation error: <specific error>
```

### Step 3: Check Chat Messages

The app now shows detailed error messages in the chat:

```
AI: Generated code for "play a beat"
Evaluation Error: Invalid or unexpected token
Problematic code: Here is the code: ```javascript stack(...
```

This tells you exactly what went wrong.

## Common Issues and Fixes

### Issue 1: AI Adds Markdown

**AI Response:**
```
```javascript
stack(note(m("c3 ~ c3 ~")).s("square"))
```
```

**Fix:** Already handled by code cleaning (removes ``` markers)

### Issue 2: AI Adds Explanations

**AI Response:**
```
Here is a techno beat:
stack(note(m("c3*4")).s("square"))
```

**Fix:** Already handled by code cleaning (removes "Here is...")

### Issue 3: AI Uses Invalid Syntax

**AI Response:**
```
// This is a techno beat
const beat = stack(...)
return beat
```

**Fix:** Partially handled (removes leading comments), but `const` and `return` might still cause issues

**Solution:** Update the system prompt to be more strict

### Issue 4: AI Uses Sample Names

**AI Response:**
```
s("bd sd hh")
```

**Fix:** System prompt already instructs against this, but AI might still do it

**Solution:** Add post-processing to detect and replace sample patterns

## Testing the Fix

### Test 1: Simple Command

**Type:** `play a beat`

**Expected Server Logs:**
```
[API/Agent] Raw AI response: stack(note(m("c3 ~ c3 ~")).s("square"))
[API/Agent] Cleaned code: stack(note(m("c3 ~ c3 ~")).s("square"))
```

**Expected Browser Console:**
```
[SonicSocket] Generated code: stack(note(m("c3 ~ c3 ~")).s("square"))
```

**Expected Chat:**
```
You: play a beat
AI: Generated code for "play a beat"
System: Code executed successfully
```

### Test 2: Complex Command

**Type:** `play techno at 130 BPM`

**Expected:** Similar logs, but with more complex stack() code

### Test 3: Intentional Error

**Type:** `play invalid syntax`

**Expected Chat:**
```
You: play invalid syntax
AI: Generated code for "play invalid syntax"
Evaluation Error: Invalid or unexpected token
Problematic code: <first 100 chars of bad code>
```

## Improving AI Code Generation

If you continue to see syntax errors, you can make the system prompt even more strict:

**File: `src/app/api/agent/route.ts`**

Add to the RULES section:

```typescript
### RULES
1. **Output ONLY code.** No markdown backticks, no explanations.
2. **No comments.** Do not add // or /* */ comments.
3. **No variables.** Do not use const, let, or var.
4. **No return statements.** Just the pattern expression.
5. **Use note() with m() for all patterns.**
6. **Use synthetic waveforms** (square, triangle, sawtooth, sine).
7. **Use stack() for multiple parts.**
8. **Do NOT use cpm() or analyze().**
```

## Alternative: Use Mock AI Handler

If the AI continues to generate invalid code, you can temporarily switch to the mock handler:

**File: `src/server/socket.ts`**

Change:
```typescript
import { handleVoiceCommand } from './googleHandler';
```

To:
```typescript
import { handleVoiceCommand } from './mockAiHandler';
```

The mock handler uses simple keyword matching and always generates valid code.

## Monitoring

### Server Logs to Watch

```bash
# Good - Code generated successfully
[API/Agent] Raw AI response: stack(...)
[API/Agent] Cleaned code: stack(...)
POST /api/agent 200 in 5.2s

# Bad - AI generated invalid response
[API/Agent] Raw AI response: I can help you with that...
[API/Agent] No valid code generated
POST /api/agent 500 in 5.2s
```

### Browser Console Logs to Watch

```javascript
// Good - Code executed
[SonicSocket] Generated code: stack(...)
[StrudelCodeView] Code evaluation successful

// Bad - Syntax error
[SonicSocket] Generated code: Here is the code: ...
[SonicSocket] Code evaluation error: Invalid or unexpected token
```

## Files Modified

1. ✅ `src/app/api/agent/route.ts` - Added code cleaning and logging
2. ✅ `src/hooks/useSonicSocket.ts` - Added error handling and logging

## Verification Checklist

- [x] Code cleaning removes markdown
- [x] Code cleaning removes explanations
- [x] Code cleaning removes comments
- [x] Logging shows raw AI response
- [x] Logging shows cleaned code
- [x] Error handling catches evaluation errors
- [x] Error messages shown to user
- [x] Problematic code shown in chat
- [x] Server restarted to apply changes

## Next Steps

1. **Test the app** - Try sending commands and check the logs
2. **Monitor server logs** - Look for `[API/Agent]` messages
3. **Check browser console** - Look for `[SonicSocket]` messages
4. **Review chat messages** - Look for error details

If errors persist:
1. Copy the "Raw AI response" from server logs
2. Copy the "Problematic code" from chat
3. Share both to diagnose the specific issue

## Summary

✅ **Added:** Comprehensive code cleaning in API route
✅ **Added:** Detailed logging at every step
✅ **Added:** Better error handling in frontend
✅ **Added:** User-friendly error messages
✅ **Server:** Restarted and ready for testing

The app now has much better debugging capabilities and should handle AI-generated code more robustly!

