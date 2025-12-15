import { genAI, MODEL_NAME } from '../lib/gemini/client';
import { SonicSessionState } from '../types/sonic';
import { SchemaType, Tool } from '@google/generative-ai';

// Tool Definitions (Gemini Format)
const tools: Tool = {
    functionDeclarations: [
        {
            name: 'setTempo',
            description: 'Set the tempo (BPM) of the session.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    bpm: { type: SchemaType.NUMBER, description: 'The target BPM (e.g. 80, 120, 140).' },
                },
                required: ['bpm'],
            },
        },
        {
            name: 'setTrackPattern',
            description: 'Set the musical pattern for a specific track (drums, bass, melody).',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    trackId: { type: SchemaType.STRING, format: 'enum' as const, enum: ['drums', 'bass', 'melody', 'fx'], description: 'The track to update.' },
                    pattern: { type: SchemaType.STRING, description: 'The Strudel/Tidal pattern string (e.g. "bd sd", "c3 e3 g3").' },
                    style: { type: SchemaType.STRING, description: 'Style description for metadata (e.g. "lofi", "techno").' },
                },
                required: ['trackId', 'pattern'],
            },
        },
        {
            name: 'muteTrack',
            description: 'Mute or unmute a track.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    trackId: { type: SchemaType.STRING, format: 'enum' as const, enum: ['drums', 'bass', 'melody', 'fx'] },
                    mute: { type: SchemaType.BOOLEAN },
                },
                required: ['trackId', 'mute'],
            },
        },
    ],
};

const SYSTEM_PROMPT = `
You are Aether, a visionary music AI controlling the Strudel live coding engine.
Your goal is to interpret natural language requests and translate them into musical patterns.

CRITICAL AUDIO INSTRUCTION - READ CAREFULLY:
This system uses SYNTHETIC SOUNDS ONLY. Audio samples are NOT available.

CORRECT Pattern Format (use this):
- Drums: "c3 ~ c3 ~" (kick pattern using note c3)
- Snare: "~ c4 ~ c4" (snare pattern using note c4)
- Hi-hat: "c5*8" (hi-hat pattern using note c5)
- Bass: "c2 g1 c2 g1" (bass notes)
- Melody: "c4 e4 g4 b4" (melody notes)

The system will automatically convert these to: note(m("pattern")).s("synth")

WRONG - DO NOT USE THESE:
- s("bd") - This tries to load samples and will fail
- s("bd sd hh") - This will cause "sound not found" errors
- .bank("RolandTR909") - Sample banks are not available
- sound("bd") - This function doesn't exist

Pattern Syntax:
- Space separates events: "c3 e3 g3"
- ~ is silence/rest: "c3 ~ e3 ~"
- * repeats: "c3*4" = c3 c3 c3 c3
- < > alternates: "<c3 e3>" = c3 then e3
- [ ] subdivides: "[c3 e3]" = both in one step

Always use note names (c1-c7) for patterns, never sample names (bd, sn, hh).
`;

export async function handleVoiceCommand(text: string, currentState: SonicSessionState) {
    try {
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: SYSTEM_PROMPT,
            tools: [tools]
        });

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: `Current state: ${JSON.stringify(currentState)}` }],
                },
                {
                    role: 'model',
                    parts: [{ text: 'Understood. I am ready to modify the session state.' }],
                }
            ],
        });

        const result = await chat.sendMessage(text);
        const response = result.response;
        const functionCalls = response.functionCalls();

        const newState = JSON.parse(JSON.stringify(currentState)); // Deep clone
        let aiResponseText = response.text() || '';

        if (functionCalls) {
            console.log('[GoogleHandler] Function Calls:', functionCalls);

            for (const call of functionCalls) {
                const args = call.args;
                const name = call.name;

                if (name === 'setTempo') {
                    // @ts-expect-error - args is not strictly typed
                    newState.bpm = args.bpm;
                } else if (name === 'setTrackPattern') {
                    // @ts-expect-error - args is not strictly typed
                    if (newState.tracks[args.trackId]) {
                        // @ts-expect-error - args is not strictly typed
                        newState.tracks[args.trackId].pattern = args.pattern;
                        newState.isPlaying = true;
                    }
                } else if (name === 'muteTrack') {
                    // @ts-expect-error - args is not strictly typed
                    if (newState.tracks[args.trackId]) {
                        // @ts-expect-error - args is not strictly typed
                        newState.tracks[args.trackId].muted = args.mute;
                    }
                }
            }

            if (!aiResponseText) {
                aiResponseText = `Executed ${functionCalls.length} changes.`;
            }
        }

        return { newState, response: aiResponseText };
    } catch (error) {
        console.error('Google GenAI Error:', error);
        return { newState: currentState, response: 'Sorry, I encountered an error with the AI brain.' };
    }
}
