import { openai, MODEL_NAME } from '../ai/client';
import { AGENT_TOOLS, executeTool } from './tool-bridge';
import { ContextManager } from './context-manager';
import { SonicSessionState, ChatMessage } from '../../types/sonic';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { applyTrackMapToState, buildLocalMusicAgentPipeline, toAgentUpdateResponse } from '../music-agent';
import { createDefaultSSNNState } from '../ssnn/engine';

const ACTION_KEYWORDS = [
    'play', 'stop', 'start', 'pause', 'faster', 'slower', 'tempo', 'bpm', 'speed',
    'fast', 'temp', // misspells/shortcuts for tempo
    'drum', 'bass', 'melody', 'lead', 'fx', 'synth', 'pattern', 'code', 'write',
    'clear', 'delete',
    'mute', 'unmute', 'louder', 'quieter', 'volume', 'scale', 'chord', 'riff', 'groove',
    'kick', 'snare', 'hat', 'hi-hat', 'arpeggio', 'arp', 'bassline', 'melodyline',
    'ssnn', 'spiking', 'temporal identity', 'comb filter', 'neural column', 'arpeggiator',
    'comb', 'filter', 'resynthesiz', 'integrate-and-fire', 'lif', 'neural network', 'neural',
    'dsp chain'
];

function requiresToolCall(text: string) {
    const normalized = text.toLowerCase();
    return ACTION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function cloneState(state: SonicSessionState): SonicSessionState {
    return JSON.parse(JSON.stringify(state));
}

function shouldUseSharedMusicPipeline(text: string) {
    const lowered = text.toLowerCase();
    if (/^(stop|pause|silence)\b/.test(lowered)) return false;
    if (/\b(mute|unmute|solo|delete|clear|louder|quieter|volume|balance|reverb|delay|low[ -]?pass|filter|pitch|playback)\b/.test(lowered)) return false;
    if (/\b(ssnn|spiking|neural|neuron|bernoulli|sweight|spec\s*listen|spike\s*q|wet\s*dry)\b/.test(lowered)) return false;
    if (/^(drums|bass|melody|fx|voice)\s*:/i.test(text)) return false;
    return /\b(play|make|create|generate|give|music|song|loop|beat|drums?|bass|melody|lead|riff|guitar|groove|rock|punk|metal|funk|jazz|hip\s*hop|hip-hop|hiphop|rap(?:per)?|boom\s*bap|trap|eminem|eminen|slim\s+shady|house|techno|ambient|dnb|drum\s*(?:and|&)\s*bass|reggae|latin|trance|acid|minimal|horrible|harsh|muddy|human|humanize|clean|less\s+even|not\s+even)\b/i.test(text);
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

export function tryRuleBasedUpdate(text: string, state: SonicSessionState): { changed: boolean; newState: SonicSessionState; response: string } {
    const lowered = text.toLowerCase();
    const newState = cloneState(state);
    let changed = false;

    const includesAll = (words: string[]) => words.every((w) => lowered.includes(w));
    const currentCode = Object.values(state.tracks)
        .map((track) => track.pattern)
        .filter(Boolean)
        .join('\n');

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const ensureSsnn = () => {
        if (!newState.ssnn) newState.ssnn = createDefaultSSNNState();
        return newState.ssnn;
    };

    // Mixer/control commands must run before prompt-to-music generation. These
    // mutations are returned to the client as a state patch by /api/agent.
    const mixerTrackAliases: Array<{ pattern: RegExp; id: keyof SonicSessionState['tracks'] }> = [
        { pattern: /\bdrums?\b|\bpercussion\b/, id: 'drums' },
        { pattern: /\bbass(?:line)?\b|\bsub\b/, id: 'bass' },
        { pattern: /\bmelody\b|\blead\b/, id: 'melody' },
        { pattern: /\bvoice\b|\bvocal(?:s)?\b/, id: 'voice' },
        { pattern: /\bfx\b|\beffects?\b/, id: 'fx' },
    ];
    const mentionedTracks = mixerTrackAliases.filter(({ pattern }) => pattern.test(lowered)).map(({ id }) => id);
    const targetTracks = mentionedTracks.length > 0
        ? mentionedTracks
        : (lowered.includes('all tracks') || lowered.includes('master') ? Object.keys(newState.tracks) as Array<keyof SonicSessionState['tracks']> : []);
    const explicitLevel = lowered.match(/(?:volume|level|gain)?\s*(?:to|at|=)\s*(\d+(?:\.\d+)?)\s*(%|percent)?/);
    const normalizedLevel = explicitLevel
        ? clamp(parseFloat(explicitLevel[1]) / (explicitLevel[2] ? 100 : (parseFloat(explicitLevel[1]) > 1.5 ? 100 : 1)), 0, 1.5)
        : null;

    if (/\bbalance(?:\s+the)?\s+(?:sound|mix|audio|tracks?)\b|\bmix\s+balance\b/.test(lowered)) {
        const balancedLevels: Record<keyof SonicSessionState['tracks'], number> = {
            drums: 0.82,
            bass: 0.72,
            melody: 0.58,
            voice: 0.55,
            fx: 0.35,
        };
        (Object.keys(balancedLevels) as Array<keyof SonicSessionState['tracks']>).forEach((id) => {
            newState.tracks[id].volume = balancedLevels[id];
            newState.tracks[id].solo = false;
        });
        changed = true;
        return { changed, newState, response: 'Balanced the mixer with headroom for drums and bass and lower supporting melody, voice, and FX levels.' };
    }

    if (targetTracks.length > 0 && (/\b(volume|level|gain|louder|quieter|turn\s+up|turn\s+down)\b/.test(lowered))) {
        targetTracks.forEach((id) => {
            const current = Number.isFinite(newState.tracks[id].volume) ? newState.tracks[id].volume : 1;
            newState.tracks[id].volume = normalizedLevel ?? clamp(current + (/\b(quieter|lower|turn\s+down|reduce)\b/.test(lowered) ? -0.15 : 0.15), 0, 1.5);
        });
        changed = true;
        return { changed, newState, response: `Updated ${targetTracks.join(', ')} volume.` };
    }

    if (targetTracks.length > 0 && /\bsolo\b/.test(lowered)) {
        const disableSolo = /\b(?:unsolo|un-solo|disable|off|remove)\b/.test(lowered);
        (Object.keys(newState.tracks) as Array<keyof SonicSessionState['tracks']>).forEach((id) => {
            newState.tracks[id].solo = disableSolo ? false : targetTracks.includes(id);
            newState.tracks[id].muted = disableSolo ? false : !targetTracks.includes(id);
        });
        changed = true;
        return { changed, newState, response: disableSolo ? 'Cleared track soloing.' : `Soloed ${targetTracks.join(', ')}.` };
    }

    const fxMatch = lowered.match(/\b(reverb|delay|low[ -]?pass|lpf|speed|pitch)\b/);
    if (targetTracks.length > 0 && fxMatch) {
        const fxKey = fxMatch[1].startsWith('low') || fxMatch[1] === 'lpf' ? 'lpf' : fxMatch[1] as 'reverb' | 'delay' | 'speed' | 'pitch';
        const value = normalizedLevel ?? (/\b(?:off|remove|disable|no)\b/.test(lowered) ? 0 : 0.5);
        targetTracks.forEach((id) => {
            newState.tracks[id].fx = { ...(newState.tracks[id].fx || {}), [fxKey]: clamp(value, 0, 1) };
        });
        changed = true;
        return { changed, newState, response: `Updated ${fxKey} on ${targetTracks.join(', ')}.` };
    }

    // General SSNN controls. This deterministic parser makes the web chat path
    // useful even when the provider is unavailable and mirrors update_ssnn.
    const ssnnContext = /\b(ssnn|spiking|neural|neuron|bernoulli|sweight|morph|tau|wcoef|input\s+gain|spec\s*listen|spike\s*q|wet\s*dry)\b/.test(lowered);
    if (ssnnContext) {
        const ssnn = ensureSsnn();
        const updates: string[] = [];
        const parameterSpecs: Array<{ key: keyof typeof ssnn; aliases: string; min: number; max: number }> = [
            { key: 'morph', aliases: 'morph', min: 0, max: 1 },
            { key: 'sweight', aliases: 'sweight|connection weight', min: -1, max: 1 },
            { key: 'inputGain', aliases: 'input gain', min: 0, max: 20 },
            { key: 'bernoulli', aliases: 'bernoulli', min: 0, max: 1 },
            { key: 'tau', aliases: 'tau', min: 0.1, max: 10 },
            { key: 'spikeDec', aliases: 'spike decay', min: 0, max: 1 },
            { key: 'wCoef', aliases: 'wcoef|weight coefficient', min: 0, max: 10 },
            { key: 'g4', aliases: 'g4', min: 0, max: 5 },
            { key: 'updateRate', aliases: 'update rate', min: 0.1, max: 50 },
            { key: 'balanceTh', aliases: 'balance threshold|firing threshold', min: 0.1, max: 1 },
            { key: 'mgain', aliases: 'master gain|mgain', min: 0, max: 1.5 },
            { key: 'decay', aliases: 'voice decay|decay', min: 0, max: 1 },
            { key: 'wetDry', aliases: 'wet dry|wet\/dry', min: 0, max: 1 },
        ];
        for (const spec of parameterSpecs) {
            const match = lowered.match(new RegExp(`(?:${spec.aliases})\\s*(?:to|at|=|is)?\\s*(-?\\d+(?:\\.\\d+)?)`));
            if (!match) continue;
            const value = clamp(parseFloat(match[1]), spec.min, spec.max);
            (ssnn as unknown as Record<string, unknown>)[spec.key] = value;
            updates.push(`${String(spec.key)}=${value}`);
        }

        const booleanSpecs: Array<{ key: 'specListen' | 'spikeQ' | 'tune'; aliases: RegExp }> = [
            { key: 'specListen', aliases: /spec\s*listen|spectral\s+listen/ },
            { key: 'spikeQ', aliases: /spike\s*q|spike\s+quantiz/ },
            { key: 'tune', aliases: /\btun(?:e|ing)\b/ },
        ];
        booleanSpecs.forEach(({ key, aliases }) => {
            if (!aliases.test(lowered)) return;
            const off = /\b(?:off|disable|disabled|stop|remove)\b/.test(lowered);
            const on = /\b(?:on|enable|enabled|start|activate)\b/.test(lowered);
            if (!off && !on) return;
            ssnn[key] = !off;
            updates.push(`${key}=${!off}`);
        });

        const engines = ['pulse', 'modal', 'synaptic', 'granular', 'fm', 'comb', 'tape', 'arpeg'] as const;
        engines.forEach((engine) => {
            if (!new RegExp(`\\b${engine}(?:giator)?\\b`).test(lowered)) return;
            const disable = new RegExp(`(?:disable|remove|turn|switch)\\s+(?:the\\s+)?${engine}(?:giator)?\\s+off|${engine}(?:giator)?\\s+(?:off|disabled)`).test(lowered);
            if (disable) {
                ssnn.activeEngines = ssnn.activeEngines.filter((item) => item !== engine);
                ssnn.columns.forEach((column) => {
                    if (column.activeEngine === engine) column.activeEngine = 'pulse';
                });
                updates.push(`${engine}=off`);
            } else if (/\b(?:enable|add|activate|on|use)\b/.test(lowered) && !ssnn.activeEngines.includes(engine)) {
                ssnn.activeEngines.push(engine);
                updates.push(`${engine}=on`);
            }
        });

        const columnMatch = lowered.match(/(?:column|col)\s*(?:number\s*)?(\d)/);
        const requestedEngine = engines.find((engine) => new RegExp(`\\b${engine}(?:giator)?\\b`).test(lowered));
        if (columnMatch && requestedEngine) {
            const columnIndex = clamp(parseInt(columnMatch[1], 10) - 1, 0, 3);
            ssnn.columns[columnIndex].activeEngine = requestedEngine;
            if (!ssnn.activeEngines.includes(requestedEngine)) ssnn.activeEngines.push(requestedEngine);
            updates.push(`column${columnIndex + 1}=${requestedEngine}`);
        }

        if (/\b(?:balance|smooth|stable|less\s+jitter|stop\s+vibrat)\b/.test(lowered)) {
            ssnn.updateRate = 2;
            ssnn.bernoulli = 0.22;
            ssnn.balanceTh = 0.72;
            ssnn.decay = 0.75;
            ssnn.qntRnd = 0;
            ssnn.mgain = Math.min(ssnn.mgain, 0.65);
            updates.push('stable balance preset');
        }

        if (/\b(?:harder|louder|closer|forward|up\s+front|more\s+present|punchier)\b/.test(lowered)) {
            ssnn.mgain = Math.max(ssnn.mgain, 1.0);
            ssnn.wetDry = Math.min(ssnn.wetDry, 0.22);
            ssnn.decay = Math.min(ssnn.decay, 0.48);
            ssnn.columns.forEach((column) => {
                if (column.gain > 0.001) column.gain = Math.max(column.gain, 0.9);
                column.pan *= 0.45;
            });
            if (!ssnn.activeEngines.includes('pulse')) ssnn.activeEngines.unshift('pulse');
            updates.push('forward punch preset');
        }

        if (/\b(?:softer|quieter|farther|further\s+back|less\s+present)\b/.test(lowered)) {
            ssnn.mgain = Math.max(0, ssnn.mgain - 0.18);
            ssnn.wetDry = Math.max(ssnn.wetDry, 0.68);
            ssnn.decay = Math.max(ssnn.decay, 0.65);
            updates.push('receded soft preset');
        }

        if (updates.length > 0) {
            changed = true;
            return { changed, newState, response: `Updated SSNN: ${updates.join(', ')}.` };
        }
    }

    // SSNN specific rule-based commands:
    if (lowered.includes('temporal identity') || (lowered.includes('neuron activation') && lowered.includes('spectral distribution'))) {
        if (!newState.ssnn) {
            newState.ssnn = createDefaultSSNNState();
        }
        newState.ssnn.specListen = true;
        newState.ssnn.morph = 0.8;
        newState.ssnn.sweight = 0.5;
        changed = true;
        return {
            changed,
            newState,
            response: "Creating a temporal identity between the neuron activation and the spectral distribution. Enabling continuous FFT spectral listening, morphing weights to 0.8, and setting connection weight contrast scaling to 0.5."
        };
    }

    if (lowered.includes('comb filter') || lowered.includes('second nn column') || (lowered.includes('second column') && lowered.includes('comb'))) {
        if (!newState.ssnn) {
            newState.ssnn = createDefaultSSNNState();
        }
        // "add a comb filter to the dsp chain , charging the second NN column and its DSP with comb filter as well."
        if (!newState.ssnn.activeEngines.includes('comb')) {
            newState.ssnn.activeEngines.push('comb');
        }
        if (newState.ssnn.columns[1]) {
            newState.ssnn.columns[1].activeEngine = 'comb';
            newState.ssnn.columns[1].gain = Math.max(newState.ssnn.columns[1].gain, 0.7);
        }
        changed = true;
        return {
            changed,
            newState,
            response: "Added a comb filter to the DSP chain and configured the second neural column to trigger the comb engine."
        };
    }

    if (lowered.includes('arpeggiator') || lowered.includes('arpeggiator active') || lowered.includes('arpeggiator is active')) {
        if (!newState.ssnn) {
            newState.ssnn = createDefaultSSNNState();
        }
        // "now the arpeggiator is active and adding some resonant filters to the DSP chain."
        if (!newState.ssnn.activeEngines.includes('arpeg')) {
            newState.ssnn.activeEngines.push('arpeg');
        }
        if (!newState.ssnn.activeEngines.includes('comb')) {
            newState.ssnn.activeEngines.push('comb'); // resonant comb filter
        }
        newState.ssnn.reson = 0.85; // high resonance filter
        newState.ssnn.cfGain = 0.8;
        changed = true;
        return {
            changed,
            newState,
            response: "Activated the arpeggiator and added resonant comb filters to the DSP chain with resonance set to 0.85."
        };
    }

    if (shouldUseSharedMusicPipeline(text)) {
        const local = buildLocalMusicAgentPipeline({
            prompt: text,
            currentCode,
            currentState: state,
            enableOpenRouter: false,
        });
        const response = toAgentUpdateResponse(local);
        return {
            changed: true,
            newState: applyTrackMapToState(response, newState),
            response: response.thought,
        };
    }

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
    const directCodeMatch = text.match(/^(drums|bass|melody|voice|fx)\s*:\s*(.+)$/i);
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
        { key: 'voice', id: 'voice' },
        { key: 'vocal', id: 'voice' },
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
        { phrase: 'mute voice', id: 'voice', value: true },
        { phrase: 'unmute voice', id: 'voice', value: false },
        { phrase: 'mute vocals', id: 'voice', value: true },
        { phrase: 'unmute vocals', id: 'voice', value: false },
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
                    content: 'Use the provided tools (update_track, set_tempo, set_scale, control_playback, update_ssnn). Do not reply without calling tools when a musical change is requested.',
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

                this.history.push(message as unknown as ChatMessage);

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
                    this.history.push(finalMessage as unknown as ChatMessage);
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
