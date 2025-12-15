import { openai, MODEL_NAME } from '../ai/client';
import { AGENT_TOOLS, executeTool } from './tool-bridge';
import { ContextManager } from './context-manager';
import { SonicSessionState, ChatMessage } from '../../types/sonic';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const ACTION_KEYWORDS = [
    'play', 'stop', 'start', 'pause', 'faster', 'slower', 'tempo', 'bpm', 'speed',
    'fast', 'temp', // misspells/shortcuts for tempo
    'drum', 'bass', 'melody', 'lead', 'fx', 'synth', 'pattern', 'code', 'write',
    'clear', 'delete',
    'mute', 'unmute', 'louder', 'quieter', 'volume', 'scale', 'chord', 'riff', 'groove',
    'kick', 'snare', 'hat', 'hi-hat', 'arpeggio', 'arp', 'bassline', 'melodyline'
];

function requiresToolCall(text: string) {
    const normalized = text.toLowerCase();
    return ACTION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function cloneState(state: SonicSessionState): SonicSessionState {
    return JSON.parse(JSON.stringify(state));
}

/**
 * Normalize a pattern.
 * If it looks like Strudel code (starts with s(, note(, stack(, etc.), use it as is (prefixed with expr:).
 * Otherwise, treat it as mini-notation and wrap with note(m("...")).s("synth").
 */
function normalizePattern(trackId: keyof SonicSessionState['tracks'], pattern: string): string {
    const p = pattern.trim();
    if (p.toLowerCase().startsWith('expr:')) return p;

    // Check for common Strudel functions to detect raw code
    // e.g. s("bd"), note("c3"), stack(...), silence, etc.
    if (/^(s\(|note\(|stack\(|silence|sound\(|sample\()/.test(p)) {
        return `expr:${p}`;
    }

    const escaped = p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    if (trackId === 'drums') {
        const looksLikePitchNotes = /\b[a-g](?:#|b)?\d\b/i.test(p);
        if (!looksLikePitchNotes) {
            return `expr:s("${escaped}")`;
        }
    }

    const synth: Record<keyof SonicSessionState['tracks'], string> = {
        drums: 'square',
        bass: 'triangle',
        melody: 'sawtooth',
        voice: 'sine',
        fx: 'sine',
    };

    return `expr:note(m("${escaped}")).s("${synth[trackId]}")`;
}

function tryRuleBasedUpdate(text: string, state: SonicSessionState): { changed: boolean; newState: SonicSessionState; response: string } {
    const lowered = text.toLowerCase();
    const newState = cloneState(state);
    let changed = false;

    const includesAll = (words: string[]) => words.every((w) => lowered.includes(w));

    // Clear/delete commands wipe patterns and stop
    if ((/\b(delete|clear)\b/.test(lowered) && /\b(code|song|everything|all)\b/.test(lowered)) || includesAll(['delete', 'code'])) {
        Object.values(newState.tracks).forEach((t) => {
            t.pattern = '';
            t.muted = false;
        });
        newState.isPlaying = false;
        changed = true;
        return {
            changed,
            newState,
            response: 'Cleared all tracks and stopped playback.'
        };
    }

    // Direct Code Injection: "track: pattern"
    // Regex matches: (drums|bass|melody|fx) : (anything)
    const directCodeMatch = text.match(/^(drums|bass|melody|fx)\s*:\s*(.+)$/i);
    if (directCodeMatch) {
        const trackId = directCodeMatch[1].toLowerCase() as keyof SonicSessionState['tracks'];
        const pattern = directCodeMatch[2].trim();

        if (newState.tracks[trackId]) {
            // Normalize the pattern to use synthetic sounds
            newState.tracks[trackId].pattern = normalizePattern(trackId, pattern);
            newState.tracks[trackId].muted = false;
            newState.isPlaying = true; // Auto-play on code change
            changed = true;
            return {
                changed,
                newState,
                response: `Updated ${trackId} pattern to: ${pattern}`
            };
        }
    }

    const bpmMatch = lowered.match(/(\d{2,3})\s*bpm/);
    const tempoMatch = lowered.match(/tempo\s*(?:to)?\s*(\d{2,3})/);

    if (bpmMatch || tempoMatch) {
        const bpm = parseInt(bpmMatch?.[1] || tempoMatch?.[1] || '', 10);
        if (!isNaN(bpm)) {
            newState.bpm = bpm;
            newState.isPlaying = true;
            changed = true;
        }
    } else if (lowered.includes('faster') || lowered.includes('fast')) {
        newState.bpm = Math.min((newState.bpm || 120) + 10, 220);
        newState.isPlaying = true;
        changed = true;
    } else if (lowered.includes('slower')) {
        newState.bpm = Math.max((newState.bpm || 120) - 10, 60);
        newState.isPlaying = true;
        changed = true;
    }

    const setPattern = (trackId: keyof SonicSessionState['tracks'], pattern: string) => {
        newState.tracks[trackId].pattern = normalizePattern(trackId, pattern);
        newState.tracks[trackId].muted = false;
        newState.isPlaying = true;
        changed = true;
    };

    const trackKeys: Array<{ key: string; id: keyof SonicSessionState['tracks'] }> = [
        { key: 'drum', id: 'drums' },
        { key: 'bass', id: 'bass' },
        { key: 'melody', id: 'melody' },
        { key: 'lead', id: 'melody' },
        { key: 'fx', id: 'fx' },
    ];

    for (const { key, id } of trackKeys) {
        const idx = lowered.indexOf(`${key}s to`);
        if (idx !== -1) {
            const slice = text.slice(idx).split('to')[1];
            if (slice) {
                const pat = slice.replace(/["“”]/g, '').trim();
                if (pat.length > 0) {
                    setPattern(id, pat);
                    break;
                }
            }
        }
    }

    // Genre/intent shortcuts
    if (lowered.includes('techno')) {
        newState.bpm = Math.max(newState.bpm || 130, 130);
        setPattern('drums', 'expr:stack(s("RolandTR909_bd*4"), s("~ RolandTR909_cp ~ RolandTR909_cp"), s("RolandTR909_hh*16").gain(0.35))');
    }
    if (lowered.includes('lofi')) {
        newState.bpm = 85;
        setPattern('drums', 'expr:note(m("c3 ~ ~ c3 ~")).s("square").slow(2)');
        setPattern('bass', 'expr:note(m("c2 ~ c2 ~")).s("triangle").sustain(0.3)');
    }
    if (lowered.includes('bassline') || lowered.includes('add bass') || lowered.includes('dark bass')) {
        setPattern('bass', 'expr:note(m("c2 ~ c2 ~")).s("triangle").gain(0.6)');
    }
    if (lowered.includes('melody')) {
        setPattern('melody', 'expr:note(m("c4 e4 g4 b4")).s("sawtooth").slow(2).gain(0.6)');
    }

    const mutePairs: Array<{ phrase: string; id: keyof SonicSessionState['tracks']; value: boolean }> = [
        { phrase: 'mute drums', id: 'drums', value: true },
        { phrase: 'unmute drums', id: 'drums', value: false },
        { phrase: 'mute bass', id: 'bass', value: true },
        { phrase: 'unmute bass', id: 'bass', value: false },
        { phrase: 'mute melody', id: 'melody', value: true },
        { phrase: 'unmute melody', id: 'melody', value: false },
        { phrase: 'mute fx', id: 'fx', value: true },
        { phrase: 'unmute fx', id: 'fx', value: false },
    ];

    for (const m of mutePairs) {
        if (lowered.includes(m.phrase)) {
            newState.tracks[m.id].muted = m.value;
            changed = true;
        }
    }

    // Simple "low code" / "bass" fallback to seed a bass pattern
    if (includesAll(['low', 'code']) || lowered.includes('bass code') || lowered.includes('give me bass')) {
        setPattern('bass', 'c2 ~ g1 ~');
        newState.isPlaying = true;
        changed = true;
    }

    if (lowered.includes('play')) {
        newState.isPlaying = true;
        changed = true;
    }
    if (lowered.includes('stop') || lowered.includes('pause')) {
        newState.isPlaying = false;
        changed = true;
    }

    return {
        changed,
        newState,
        response: changed
            ? `Applied quick change: bpm=${newState.bpm}, patterns updated if specified.`
            : 'No quick rule-based change applied.'
    };
}

export class AgentRuntime {
    private contextManager: ContextManager;
    private history: ChatMessage[] = [];

    constructor() {
        this.contextManager = new ContextManager();
        this.history = this.contextManager.getInitialContext();
    }

    public async processMessage(
        userMessage: string,
        currentState: SonicSessionState
    ): Promise<{ response: string; newState: SonicSessionState }> {
        this.history.push({ role: 'user', content: userMessage });
        const needsAction = requiresToolCall(userMessage);

        console.log(`[Agent] Thinking... Message: "${userMessage}" (needsAction=${needsAction})`);
        console.log(`[Agent] Current state:`, JSON.stringify(currentState, null, 2));

        let finalState = currentState;
        // Fast rule-based path: apply deterministic updates before touching the LLM/tooling.
        const quick = tryRuleBasedUpdate(userMessage, finalState);
        if (quick.changed) {
            return {
                response: quick.response,
                newState: quick.newState,
            };
        }

        try {
            for (let attempt = 0; attempt < 2; attempt++) {
                const stateMessage = { role: 'system', content: `Current Session State: ${JSON.stringify(finalState)}` };
                const actionInstruction = {
                    role: 'system',
                    content: 'Use the provided tools (update_track, set_tempo, set_scale, control_playback). Do not reply without calling tools when a musical change is requested.',
                };
                const messagesToSend = [...this.history, stateMessage, actionInstruction] as ChatCompletionMessageParam[];

                const completion = await openai.chat.completions.create({
                    model: MODEL_NAME,
                    messages: messagesToSend,
                    tools: AGENT_TOOLS,
                    tool_choice: needsAction ? 'required' : 'auto',
                    // @ts-expect-error - reasoning is a custom property
                    extra_body: {
                        reasoning: {
                            enabled: true
                        }
                    }
                });

                const message = completion.choices[0].message;
                const hasToolCalls = Boolean(message.tool_calls && message.tool_calls.length > 0);

                if (!hasToolCalls && needsAction && attempt === 0) {
                    console.warn('[Agent] No tool call detected; reinforcing requirement.');
                    this.history.push({
                        role: 'system',
                        content: 'Reminder: execute the requested musical change by calling one of the provided tools (update_track, set_tempo, set_scale, control_playback) before responding.'
                    });
                    continue;
                }

                this.history.push(message as any as ChatMessage);

                if (hasToolCalls && message.tool_calls) {
                    console.log(`[Agent] Tool calls detected:`, message.tool_calls);

                    for (const toolCall of message.tool_calls) {
                        if (toolCall.type === 'function') {
                            const functionName = toolCall.function.name;
                            const args = JSON.parse(toolCall.function.arguments);
                            console.log(`[Agent] Executing tool: ${functionName}`, args);

                            // Execute the tool
                            const result = await executeTool(functionName, args, finalState);
                            console.log(`[Agent] Tool result:`, result);

                            if (result.newState) {
                                finalState = result.newState;
                            }

                            // Add tool result to history
                            this.history.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: JSON.stringify({ status: result.success ? "success" : "error", message: result.message }),
                            });
                        }
                    }

                    // Second call to LLM to summarize/confirm actions
                    const secondCompletion = await openai.chat.completions.create({
                        model: MODEL_NAME,
                        messages: this.history as ChatCompletionMessageParam[],
                        // @ts-expect-error - reasoning is a custom property
                        extra_body: {
                            reasoning: {
                                enabled: true
                            }
                        }
                    });

                    const finalMessage = secondCompletion.choices[0].message;
                    this.history.push(finalMessage as any as ChatMessage);
                    return { response: finalMessage.content || "Action completed.", newState: finalState };
                }
            }

            if (needsAction) {
                const fallback = tryRuleBasedUpdate(userMessage, finalState);
                if (fallback.changed) {
                    return {
                        response: fallback.response,
                        newState: fallback.newState,
                    };
                }
            }

            return {
                response: needsAction
                    ? 'Unable to modify the music because no executable action was produced. Try phrasing like "set tempo to 140 bpm" or "mute drums".'
                    : 'Standing by. No musical changes executed.',
                newState: finalState,
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error("[Agent] Error processing message:", error);
            return {
                response: `I hit an error talking to the model: ${errMsg}`,
                newState: finalState
            };
        }
    }

    public getHistory() {
        return this.history;
    }
}
