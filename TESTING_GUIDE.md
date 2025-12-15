# Testing Guide - Chat Box & Strudel Engine Fix

## What Was Fixed

### 1. **Input Accessibility Issues**
- ✅ Added `pointer-events-none` to decorative blur elements
- ✅ Added `z-10` to input container to ensure it's above other elements
- ✅ Added `disabled` state that prevents interaction before audio is ready
- ✅ Added auto-focus to input after audio initialization
- ✅ Added visual feedback (border color changes) when audio is ready

### 2. **Strudel Code Editor Issues**
- ✅ Added focus ring for better visibility
- ✅ Added minimum height to prevent tiny textarea
- ✅ Added click and focus event logging for debugging
- ✅ Added `spellCheck={false}` to prevent browser interference

### 3. **Pattern Normalization**
- ✅ Fixed pattern conversion to use synthetic sounds instead of samples
- ✅ Updated `formatTrack`, `tool-bridge`, and `runtime` to normalize patterns
- ✅ Patterns like "bd ~ sd ~" now convert to `note(m("bd ~ sd ~")).s("square")`

### 4. **TypeScript Errors**
- ✅ Fixed `message.tool_calls` possibly undefined error

## How to Test

### Step 1: Start the Application

The server should already be running. If not:

```bash
npm run dev
```

Then open: http://localhost:3000

### Step 2: Initialize Audio

1. You should see a black screen with an overlay
2. Click the **"INITIALIZE SESSION"** button
3. Wait for the overlay to disappear
4. You should see: "✓ Audio engine ready • Type commands and press Enter"

### Step 3: Test Chat Input Box

**Test 1: Basic Text Input**
1. Click in the input box at the bottom (should auto-focus)
2. Type: `play a techno beat`
3. Press Enter
4. Check console (F12) for logs:
   - `[Input] Changed: play a techno beat`
   - `[Input] Enter pressed, sending: play a techno beat`
   - `[SonicSocket] Sending command: play a techno beat`

**Test 2: Direct Pattern Injection**
1. Type: `drums: bd ~ sd ~`
2. Press Enter
3. You should hear a kick-snare pattern
4. Check the Strudel Engine panel - code should update

**Test 3: Voice Commands**
1. Click the microphone button
2. Say: "start a house beat"
3. The system should process your voice command

### Step 4: Test Strudel Code Editor

**Test 1: Click and Type**
1. Click in the left panel "STRUDEL ENGINE" code area
2. Check console for: `[StrudelCodeView] Textarea clicked`
3. Type: `s("bd sd")`
4. Wait 500ms - it should auto-evaluate
5. Check console for: `[StrudelCodeView] Code evaluation successful`

**Test 2: Edit Existing Code**
1. After sending a command, the code editor shows generated code
2. Click in the code editor
3. Modify the code (e.g., change BPM)
4. Wait 500ms - changes should apply

**Test 3: Complex Pattern**
```javascript
stack(
  note(m("c3 ~ c3 ~")).s("square").fast(2),
  note(m("c2 g1")).s("triangle")
)
```

### Step 5: Verify Pattern Normalization

**Before the fix:**
- Input: `bd ~ sd ~` → Error: "sound bd not found!"

**After the fix:**
- Input: `bd ~ sd ~` → Converts to: `note(m("bd ~ sd ~")).s("square")` ✅
- Should play using synthetic square wave

### Step 6: Check Visual Feedback

1. **Before audio init:**
   - Input box has gray border
   - Input is disabled
   - Placeholder says "Initialize audio first..."

2. **After audio init:**
   - Input box has cyan border with glow effect
   - Input is enabled and focused
   - Placeholder says "Type command or code..."
   - Status message appears: "✓ Audio engine ready"

## Common Issues & Solutions

### Issue: Input box doesn't respond to clicks

**Solution:**
1. Open browser console (F12)
2. Run: `document.getElementById('command-input')`
3. If it returns `null`, the element isn't rendered
4. Check if audio is initialized
5. Try clicking "INITIALIZE SESSION" again

### Issue: Strudel code editor doesn't respond

**Solution:**
1. Check console for focus events
2. Try clicking directly on the text area
3. Look for any overlay elements blocking clicks
4. Check if `isConnected` is true (green dot in top right)

### Issue: No sound plays

**Solution:**
1. Check browser console for audio context errors
2. Click "TEST SYSTEM AUDIO (BEEP)" button
3. Check if patterns are being normalized (look for `expr:note(m(...))`)
4. Verify socket connection (green "LINKED" indicator)

### Issue: Commands don't reach the server

**Solution:**
1. Check console for: `[SonicSocket] Emitting sonic:command`
2. Verify socket connection: Look for `[SonicSocket] ✅ Connected to server`
3. Check server logs for incoming commands
4. Try refreshing the page

## Debug Console Commands

Open browser console (F12) and try these:

```javascript
// Check if input is accessible
document.getElementById('command-input').disabled

// Manually focus input
document.getElementById('command-input').focus()

// Check audio ready state
// (Look for isAudioReady in React DevTools)

// Check socket connection
// (Look for socket in Network tab)

// Force a command
const input = document.getElementById('command-input');
input.value = 'play a beat';
input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
```

## Expected Console Output

When everything works correctly, you should see:

```
[SonicInterface] Component rendering...
[SonicInterface] Props: { isConnected: true, isAudioReady: true, messagesCount: 5 }
[Input] Focused
[Input] Changed: play a techno beat
[Input] Enter pressed, sending: play a techno beat
[SonicSocket] Sending command: play a techno beat
[SonicSocket] Socket connected? true
[SonicSocket] Emitting sonic:command
[SonicSocket] 🤖 Received message: Initiating high-energy Techno sequence at 135 BPM.
[StrudelCodeView] Rendering with: { code: '(() => {...', isConnected: true }
```

## Success Criteria

✅ Input box is clickable and accepts text
✅ Pressing Enter sends commands
✅ Commands appear in chat log
✅ AI responds with messages
✅ Strudel code editor is editable
✅ Code changes auto-evaluate after 500ms
✅ Patterns use synthetic sounds (no "sound not found" errors)
✅ Audio plays when patterns are active
✅ Visual feedback shows when system is ready

## Next Steps

If all tests pass:
1. Try creating music with voice commands
2. Experiment with direct code injection
3. Edit generated Strudel code
4. Combine multiple tracks

If tests fail:
1. Check browser console for errors
2. Verify server is running
3. Check socket connection
4. Try hard refresh (Ctrl+Shift+R)

