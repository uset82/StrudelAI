# Fix for "OpenAI API Key is missing" Error

## Problem

Console error when sending commands:
```
Error: OpenAI API Key is missing. Please add OPENAI_API_KEY to your .env file.
    at useSonicSocket.useCallback[sendCommand] (src/hooks/useSonicSocket.ts:260:23)
```

## Root Cause

The `/api/agent` route was configured to use OpenAI's API directly, but the `.env` file only contained `OPENROUTER_API_KEY`, not `OPENAI_API_KEY`.

**Mismatch:**
- `.env` file had: `OPENROUTER_API_KEY=sk-or-v1-...`
- API route expected: `OPENAI_API_KEY`

## Solution

Updated the `/api/agent` route to use **OpenRouter** instead of OpenAI directly, matching the existing configuration.

### File Modified: `src/app/api/agent/route.ts`

#### Change 1: Updated Client Initialization (Lines 1-14)

**Before:**
```typescript
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});
```

**After:**
```typescript
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenRouter client (using OpenAI SDK with custom baseURL)
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Aether Sonic',
    },
});

const MODEL_NAME = process.env.MODEL_NAME || 'google/gemini-2.0-flash-exp:free';
```

#### Change 2: Updated API Key Check (Lines 62-66)

**Before:**
```typescript
if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
        error: 'OpenAI API Key is missing. Please add OPENAI_API_KEY to your .env file.'
    }, { status: 500 });
}
```

**After:**
```typescript
if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({
        error: 'OpenRouter API Key is missing. Please add OPENROUTER_API_KEY to your .env file.'
    }, { status: 500 });
}
```

#### Change 3: Updated Model Selection (Line 69)

**Before:**
```typescript
const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Use a fast, capable model
```

**After:**
```typescript
const completion = await openai.chat.completions.create({
    model: MODEL_NAME, // Use configured model from .env
```

#### Change 4: Updated System Prompt (Lines 16-71)

Updated the system prompt to use **synthetic sounds** instead of samples, matching the fixes we made earlier:

**Key Changes:**
- ✅ Removed references to `s("bd")` sample-based patterns
- ✅ Added instructions to use `note(m("...")).s("synth")` patterns
- ✅ Provided correct examples using synthetic waveforms
- ✅ Explained that samples are NOT available

**New Prompt Highlights:**
```
CRITICAL: This system uses SYNTHETIC SOUNDS ONLY. Audio samples are NOT available.

### CORRECT STRUDEL SYNTAX (Use This)
- Drums: note(m("c3 ~ c3 ~")).s("square").decay(0.05)
- Bass: note(m("c2 g1 c2 g1")).s("triangle").sustain(0.2)
- Melody: note(m("c4 e4 g4 b4")).s("sawtooth").slow(2)

### WRONG - DO NOT USE
- s("bd") - This tries to load samples and will fail
```

## Environment Configuration

Your `.env` file is correctly configured:

```env
OPENROUTER_API_KEY=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
MODEL_NAME=x-ai/grok-4.1-fast
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**No changes needed to `.env` file!**

## How It Works Now

### Request Flow

1. **User types command:** "play a techno beat"
2. **Frontend sends to:** `POST /api/agent`
3. **API route:**
   - Checks for `OPENROUTER_API_KEY` ✅
   - Sends request to OpenRouter API
   - Uses model: `x-ai/grok-4.1-fast` (from .env)
4. **OpenRouter:**
   - Routes to Grok 4.1 Fast model
   - Generates Strudel code using synthetic sounds
5. **Response:**
   - Returns clean Strudel code
   - Frontend evaluates and plays music

### Example Request/Response

**User Input:**
```
play a techno beat
```

**API Request to OpenRouter:**
```json
{
  "model": "x-ai/grok-4.1-fast",
  "messages": [
    {
      "role": "system",
      "content": "You are a virtuoso live-coding music assistant..."
    },
    {
      "role": "user",
      "content": "Current Code:\n// No code yet\n\nUser Request: play a techno beat"
    }
  ]
}
```

**API Response:**
```javascript
stack(
  note(m("c3*4")).s("square").decay(0.05).fast(2),
  note(m("c5*8")).s("square").decay(0.02).gain(0.3),
  note(m("c2 ~ c2 ~")).s("triangle").sustain(0.2)
)
```

## Server Restart Required

After making code changes, the server must be restarted:

```bash
# Stop any running Node processes
Get-Process -Name node | Stop-Process -Force

# Start the dev server
npm run dev
```

**Server Output (Success):**
```
> Ready on http://localhost:3000
POST /api/agent 200 in 9.2s
```

The `200` status code confirms the API is working!

## Testing

### Test 1: Simple Command

**Type in chat:** `play a beat`

**Expected:**
- ✅ No "API Key missing" error
- ✅ AI generates Strudel code
- ✅ Code uses synthetic sounds
- ✅ Music plays

### Test 2: Genre-Specific Command

**Type in chat:** `play techno at 130 BPM`

**Expected:**
- ✅ AI generates techno pattern
- ✅ Uses `note(m("...")).s("square")` syntax
- ✅ No sample loading errors
- ✅ Music plays at 130 BPM

### Test 3: Check Server Logs

**Look for:**
```
POST /api/agent 200 in [time]
```

**If you see:**
```
POST /api/agent 500 in [time]
```

Then check the error message in the browser console.

## Verification Checklist

- [x] Updated API client to use OpenRouter
- [x] Updated API key check to use OPENROUTER_API_KEY
- [x] Updated model to use MODEL_NAME from .env
- [x] Updated system prompt to use synthetic sounds
- [x] Server restarted successfully
- [x] API endpoint returns 200 status
- [x] No TypeScript errors
- [x] .env file has correct keys

## Benefits of This Fix

1. **Consistent Configuration:**
   - All AI handlers now use OpenRouter
   - Single API key for all AI features

2. **Cost Effective:**
   - OpenRouter provides access to multiple models
   - Can use free models like Gemini or paid models like Grok

3. **Flexible:**
   - Easy to switch models via .env
   - No code changes needed to try different models

4. **Correct Sound Generation:**
   - AI now generates synthetic sound patterns
   - No "sound not found" errors
   - Consistent with rest of the app

## Available Models via OpenRouter

You can change `MODEL_NAME` in `.env` to any of these:

**Free Models:**
- `google/gemini-2.0-flash-exp:free`
- `meta-llama/llama-3.1-8b-instruct:free`
- `microsoft/phi-3-mini-128k-instruct:free`

**Paid Models (Better Quality):**
- `x-ai/grok-4.1-fast` (Currently configured)
- `anthropic/claude-3.5-sonnet`
- `openai/gpt-4o`

## Troubleshooting

### Error: "OpenRouter API Key is missing"

**Solution:** Check that `.env` has:
```env
OPENROUTER_API_KEY=sk-or-v1-...
```

### Error: "Invalid API Key"

**Solution:** Verify your OpenRouter API key is valid at https://openrouter.ai/keys

### Error: "Model not found"

**Solution:** Check that `MODEL_NAME` in `.env` is a valid OpenRouter model

### Server not picking up changes

**Solution:** Restart the server:
```bash
npm run dev
```

## Summary

✅ **Fixed:** API route now uses OpenRouter instead of OpenAI
✅ **Fixed:** API key check matches .env configuration
✅ **Fixed:** System prompt uses synthetic sounds
✅ **Fixed:** Model selection uses .env configuration
✅ **Verified:** Server running and API responding with 200 status

The "OpenAI API Key is missing" error is now completely resolved!

