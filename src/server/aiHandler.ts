import { openai, MODEL_NAME } from '../lib/ai/client';
import { SonicSessionState } from '../types/sonic';
import { ChatCompletionTool } from 'openai/resources/chat/completions';

// Tool Definitions (OpenAI Format)
const tools: ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'setTempo',
            description: 'Set the tempo (BPM) of the session.',
            parameters: {
                type: 'object',
                properties: {
                    bpm: { type: 'number', description: 'The target BPM (e.g. 80, 120, 140).' },
                },
                required: ['bpm'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'setTrackPattern',
            description: 'Set the musical pattern for a specific track (drums, bass, melody).',
            parameters: {
                type: 'object',
                properties: {
                    trackId: { type: 'string', enum: ['drums', 'bass', 'melody', 'fx'], description: 'The track to update.' },
                    pattern: { type: 'string', description: 'The Strudel/Tidal pattern string (e.g. "bd sd", "c3 e3 g3").' },
                    style: { type: 'string', description: 'Style description for metadata (e.g. "lofi", "techno").' },
                },
                required: ['trackId', 'pattern'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'muteTrack',
            description: 'Mute or unmute a track.',
            parameters: {
                type: 'object',
                properties: {
                    trackId: { type: 'string', enum: ['drums', 'bass', 'melody', 'fx'] },
                    mute: { type: 'boolean' },
                },
                required: ['trackId', 'mute'],
            },
        },
    },
];

const SYSTEM_PROMPT = `
You are Aether, a visionary music AI controlling the Strudel live coding engine.
Your goal is to interpret natural language requests and translate them into musical patterns.
The user will speak to you. You must call the appropriate tools to modify the music state.

CRITICAL - USE NOTE NAMES, NOT SAMPLE NAMES:
This system uses synthetic sounds. Audio samples (bd, sn, hh) are NOT available.

Pattern Guide (use NOTE NAMES):
- Drums: "c3 ~ c3 ~" (kick using note c3), "~ c4 ~ c4" (snare using c4), "c5*8" (hi-hat using c5)
- Bass: "c2 g1 c2 g1" (bass notes), "c1*4" (sub bass)
- Melody: "c4 e4 g4 b4" (melody notes), "c4*2" (repetition)
- Silence: "~"

Mini-notation syntax:
- Space = separate events: "c3 e3 g3"
- ~ = rest: "c3 ~ e3 ~"
- * = repeat: "c3*4"
- < > = alternate: "<c3 e3>"
- [ ] = subdivide: "[c3 e3]"

Style Guidelines:
- Lofi: 70-90 BPM, simple patterns, use low notes
- Techno: 120-140 BPM, steady "c3*4" kick pattern
- House: 120-128 BPM, "c3 ~ c3 ~" kick pattern

IMPORTANT:
- Provide ONLY note patterns like "c3 ~ c3 ~" or "c4 e4 g4"
- DO NOT use sample names like "bd", "sn", "hh"
- DO NOT add .sound(), .bank(), or .s()
- The engine automatically converts patterns to synthetic sounds
`;

export async function handleVoiceCommand(text: string, currentState: SonicSessionState) {
    try {
        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'system', content: 'Current state: ' + JSON.stringify(currentState) },
                { role: 'user', content: text },
            ],
            tools: tools,
            tool_choice: 'auto',
        });

        const message = completion.choices[0].message;
        const toolCalls = message.tool_calls;

        const newState = { ...currentState };
        let aiResponseText = message.content || '';

        if (toolCalls) {
            for (const toolCall of toolCalls) {
                // @ts-expect-error - function is not strictly typed
                const args = JSON.parse(toolCall.function.arguments);
                // @ts-expect-error - function is not strictly typed
                const name = toolCall.function.name;

                if (name === 'setTempo') {
                    newState.bpm = args.bpm;
                } else if (name === 'setTrackPattern') {
                    if (newState.tracks[args.trackId as keyof typeof newState.tracks]) {
                        newState.tracks[args.trackId as keyof typeof newState.tracks].pattern = args.pattern;
                        newState.isPlaying = true;
                    }
                } else if (name === 'muteTrack') {
                    if (newState.tracks[args.trackId as keyof typeof newState.tracks]) {
                        newState.tracks[args.trackId as keyof typeof newState.tracks].muted = args.mute;
                    }
                }
            }

            // If content is empty but tools were called, generate a summary
            if (!aiResponseText) {
                aiResponseText = `Executed ${toolCalls.length} changes.`;
            }
        }

        return { newState, response: aiResponseText };
    } catch (error) {
        console.error('OpenAI API Error:', error);
        return { newState: currentState, response: 'Sorry, I encountered an error processing your request.' };
    }
}
