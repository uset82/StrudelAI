import { ChatCompletionTool } from "openai/resources/chat/completions";
import { SonicSessionState, InstrumentType } from "../../types/sonic";
import { createDefaultSSNNState } from '../ssnn/engine';

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
                        enum: ["drums", "bass", "melody", "voice", "fx"],
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
                    solo: {
                        type: "boolean",
                        description: "Whether this track is soloed.",
                    },
                    fx: {
                        type: "object",
                        properties: {
                            lpf: { type: "number", description: "Low-pass amount (0.0 to 1.0)." },
                            reverb: { type: "number", description: "Reverb amount (0.0 to 1.0)." },
                            delay: { type: "number", description: "Delay amount (0.0 to 1.0)." },
                            speed: { type: "number", description: "Speed control (0.0 to 1.0)." },
                            pitch: { type: "number", description: "Pitch control (0.0 to 1.0)." },
                        },
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
    {
        type: "function",
        function: {
            name: "update_ssnn",
            description: "Updates parameters, engines, arpeggiator patterns, or routing configurations of the Spiking and Sounding Neural Network (SSNN).",
            parameters: {
                type: "object",
                properties: {
                    specListen: { type: "boolean", description: "Enable continuous FFT spectral listening." },
                    morph: { type: "number", description: "Weight morphing interpolation (0.0 to 1.0, random to learned)." },
                    sweight: { type: "number", description: "Contrast scaling coefficient (-1.0 to 1.0)." },
                    inputGain: { type: "number", description: "FFT input gain (0.0 to 20.0)." },
                    bernoulli: { type: "number", description: "Bernoulli noise injection probability (0.0 to 1.0)." },
                    tau: { type: "number", description: "Decay time constant (0.1 to 10.0)." },
                    spikeDec: { type: "number", description: "Visual spikes decay rate (0.0 to 1.0)." },
                    wCoef: { type: "number", description: "Weight coefficient multiplier (0.0 to 10.0)." },
                    g4: { type: "number", description: "Output threshold/gain parameter (0.0 to 5.0)." },
                    updateRate: { type: "number", description: "Neural simulation update speed (0.1 to 50.0)." },
                    balanceTh: { type: "number", description: "Firing threshold (0.0 to 1.0)." },
                    buffLen: { type: "integer", description: "Tape/granular buffer length in samples (1000 to 50000)." },
                    spikeVis: { type: "boolean", description: "Enable spike visualization." },
                    voiceAlloc: { type: "boolean", description: "Enable voice-allocation visualization." },
                    spectralShift: { type: "integer", description: "Log-frequency shift mapping index (0 to 10)." },
                    mgain: { type: "number", description: "SSNN master output gain (0.0 to 1.5)." },
                    spikeQth: { type: "number", description: "Spike quantization threshold (0.0 to 1.0)." },
                    spikeQ: { type: "boolean", description: "Enable spike quantization." },
                    envStq: { type: "integer", description: "Quantization division." },
                    qntRnd: { type: "number", description: "Quantization timing randomness (0 to 100)." },
                    tuningScale: { type: "string", enum: ["pentatonic", "diatonic", "wholetone", "xenakis_dial", "5th"] },
                    tune: { type: "boolean", description: "Quantize pitches to the selected scale." },
                    decay: { type: "number", description: "Global voice decay (0.0 to 1.0)." },
                    wetDry: { type: "number", description: "Global wet/dry mix (0.0 to 1.0)." },
                    freqs: {
                        type: "array",
                        items: { type: "number" },
                        minItems: 4,
                        maxItems: 4,
                        description: "Four base voice frequencies in hertz.",
                    },
                    activeEngines: {
                        type: "array",
                        items: { type: "string", enum: ["pulse", "modal", "synaptic", "granular", "fm", "comb", "tape", "arpeg"] },
                        description: "List of active synthesizer engines."
                    },
                    cfGain: { type: "number", description: "Comb Filter Gain (0.0 to 2.0)." },
                    reson: { type: "number", description: "Filter resonance or comb resonance (0.0 to 1.0)." },
                    loPass: { type: "boolean", description: "Enable lowpass filter on comb." },
                    modDepth: { type: "number", description: "Modulation depth (0.0 to 1.0)." },
                    decayFact: { type: "number", description: "Decay factor (0.0 to 1.0)." },
                    arpeggiatorPattern: { type: "string", description: "Arpeggiator pattern (e.g., 'min-tri', 'octave', '5th')." },
                    activePreset: { type: "integer", description: "Preset slot to load (1 to 12)." },
                    columns: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                columnIndex: { type: "integer", description: "Index of the column to update (0 to 3)." },
                                activeEngine: { type: "string", enum: ["pulse", "modal", "synaptic", "granular", "fm", "comb", "tape", "arpeg"] },
                                gain: { type: "number", description: "Column gain (0.0 to 1.5)." },
                                pan: { type: "number", description: "Column pan (-1.0 to 1.0)." },
                                gainMod: { type: "boolean" },
                                pitchMod: { type: "boolean" }
                            },
                            required: ["columnIndex"]
                        },
                        description: "Specific neural columns to update."
                    }
                }
            }
        }
    }
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
    solo?: boolean;
    fx?: SonicSessionState['tracks'][InstrumentType]['fx'];
    bpm?: number;
    scale?: string;
    isPlaying?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
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
                if (args.volume !== undefined) track.volume = Math.min(1.5, Math.max(0, args.volume));
                if (args.muted !== undefined) track.muted = args.muted;
                if (args.solo !== undefined) track.solo = args.solo;
                if (args.fx !== undefined) track.fx = { ...(track.fx || {}), ...args.fx };
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

        case "update_ssnn":
            if (!newState.ssnn) {
                newState.ssnn = createDefaultSSNNState();
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ssnnArgs = args as any;

            // Loop through all properties in args and apply them if they are not columns
            for (const key of Object.keys(ssnnArgs)) {
                if (key !== 'columns' && ssnnArgs[key] !== undefined) {
                    newState.ssnn[key] = ssnnArgs[key];
                }
            }

            // Handle column updates
            if (ssnnArgs.columns && Array.isArray(ssnnArgs.columns)) {
                for (const colUpdate of ssnnArgs.columns) {
                    const colIdx = colUpdate.columnIndex;
                    if (colIdx >= 0 && colIdx < 4) {
                        const col = newState.ssnn.columns[colIdx];
                        if (col) {
                            if (colUpdate.activeEngine !== undefined) col.activeEngine = colUpdate.activeEngine;
                            if (colUpdate.gain !== undefined) col.gain = colUpdate.gain;
                            if (colUpdate.pan !== undefined) col.pan = colUpdate.pan;
                            if (colUpdate.gainMod !== undefined) col.gainMod = colUpdate.gainMod;
                            if (colUpdate.pitchMod !== undefined) col.pitchMod = colUpdate.pitchMod;
                        }
                    }
                }
            }

            return { success: true, message: `Updated SSNN parameters`, newState };

        default:
            return { success: false, message: `Unknown tool: ${name}` };
    }
}
