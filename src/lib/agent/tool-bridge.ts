import { ChatCompletionTool } from "openai/resources/chat/completions";
import { SonicSessionState, InstrumentType } from "../../types/sonic";

export const AGENT_TOOLS: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "update_track",
            description: "Updates the pattern, volume, or mute state of a specific track.",
            parameters: {
                type: "object",
                properties: {
                    trackId: {
                        type: "string",
                        enum: ["drums", "bass", "melody", "fx"],
                        description: "The track to update.",
                    },
                    pattern: {
                        type: "string",
                        description: "The Strudel pattern string (e.g., 'bd sd', 'c3 e3').",
                    },
                    volume: {
                        type: "number",
                        description: "Volume level (0.0 to 1.0).",
                    },
                    muted: {
                        type: "boolean",
                        description: "Whether the track is muted.",
                    },
                },
                required: ["trackId"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_tempo",
            description: "Sets the global tempo (BPM).",
            parameters: {
                type: "object",
                properties: {
                    bpm: {
                        type: "number",
                        description: "Beats per minute.",
                    },
                },
                required: ["bpm"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_scale",
            description: "Sets the global musical scale.",
            parameters: {
                type: "object",
                properties: {
                    scale: {
                        type: "string",
                        description: "The scale name (e.g., 'C minor', 'D dorian').",
                    },
                },
                required: ["scale"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "control_playback",
            description: "Starts or stops the session.",
            parameters: {
                type: "object",
                properties: {
                    isPlaying: {
                        type: "boolean",
                        description: "True to play, false to stop.",
                    },
                },
                required: ["isPlaying"],
            },
        },
    },
];

/**
 * Normalize a pattern to ensure it uses synthetic sounds instead of samples.
 * If the pattern doesn't start with "expr:", wrap it with note(m("...")).s("synth")
 */
function normalizePattern(trackId: InstrumentType, pattern: string): string {
    const p = pattern.trim();

    // If already has expr: prefix, return as-is
    if (p.toLowerCase().startsWith('expr:')) {
        return p;
    }

    // Map track types to appropriate synth sounds
    const synthMap: Record<InstrumentType, string> = {
        drums: 'square',
        bass: 'triangle',
        melody: 'sawtooth',
        voice: 'sine',
        fx: 'sine',
    };

    const synth = synthMap[trackId] || 'square';

    // Wrap plain patterns with expr: prefix and synthetic sound
    return `expr:note(m("${p}")).s("${synth}")`;
}


type ToolArgs = {
    trackId?: InstrumentType;
    pattern?: string;
    volume?: number;
    muted?: boolean;
    bpm?: number;
    scale?: string;
    isPlaying?: boolean;
};

export async function executeTool(
    name: string,
    args: ToolArgs,
    currentState: SonicSessionState
): Promise<{ success: boolean; message: string; newState?: SonicSessionState }> {
    console.log(`[Agent] Executing tool: ${name}`, args);

    // Clone state to avoid direct mutation issues if any
    const newState = JSON.parse(JSON.stringify(currentState));

    switch (name) {
        case "update_track":
            const track = newState.tracks[args.trackId as InstrumentType];
            if (track) {
                if (args.pattern !== undefined) {
                    // Normalize the pattern to use synthetic sounds
                    track.pattern = normalizePattern(args.trackId as InstrumentType, args.pattern);
                }
                if (args.volume !== undefined) track.volume = args.volume;
                if (args.muted !== undefined) track.muted = args.muted;
                newState.isPlaying = true;
                return { success: true, message: `Updated ${args.trackId}`, newState };
            }
            return { success: false, message: `Track ${args.trackId} not found` };

        case "set_tempo":
            newState.bpm = args.bpm;
            newState.isPlaying = true; // nudge playback on when tempo changes
            return { success: true, message: `Tempo set to ${args.bpm}`, newState };

        case "set_scale":
            newState.scale = args.scale;
            return { success: true, message: `Scale set to ${args.scale}`, newState };

        case "control_playback":
            newState.isPlaying = args.isPlaying;
            return { success: true, message: args.isPlaying ? "Playback started" : "Playback stopped", newState };

        default:
            return { success: false, message: `Unknown tool: ${name}` };
    }
}
