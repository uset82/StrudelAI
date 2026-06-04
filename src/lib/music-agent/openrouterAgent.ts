import { OpenRouter, callModel, maxCost, stepCountIs, tool } from '@openrouter/agent';
import { z } from 'zod';
import {
    OPENROUTER_API_KEY,
    OPENROUTER_HEADERS,
    OPENROUTER_TIMEOUT_MS,
    getOpenRouterModelCandidates,
} from '@/lib/ai/openrouter-config';
import { buildMusicContext, routeMusicIntent, type MusicContext, type MusicIntent } from '@/lib/music/musicIntent';
import type { SonicSessionState } from '@/types/sonic';
import type { AgentUpdateResponse, TrackMap } from '@/lib/music/genreTemplates';
import { validateGeneratedTracks } from '@/lib/music/strudelValidation';
import { GENRE_STYLE_TRAITS } from './styleTraits';
import {
    TrackMapSchema,
    type MusicAgentPipelineResult,
} from './types';
import {
    buildLocalMusicAgentPipeline,
    formatAgentGrounding,
    toAgentUpdateResponse,
} from './pipeline';

type MusicAgentResponseSource = MusicAgentPipelineResult['source'] | 'openrouter_agent';

type MusicAgentDebugMetadata = {
    source: MusicAgentResponseSource;
    genre: string;
    requestedScope: string;
    targetTracks: string[];
    validation: MusicAgentPipelineResult['validation'];
    review: Pick<MusicAgentPipelineResult['review'], 'score' | 'matchesIntent' | 'listenability' | 'problems' | 'improvements'>;
    traces: MusicAgentPipelineResult['traces'];
};

type AgentUpdateResponseWithDebug = AgentUpdateResponse & {
    debug?: MusicAgentDebugMetadata;
};

const agentClient = new OpenRouter({
    apiKey: OPENROUTER_API_KEY,
    timeoutMs: OPENROUTER_TIMEOUT_MS,
    httpReferer: OPENROUTER_HEADERS['HTTP-Referer'],
    appTitle: OPENROUTER_HEADERS['X-Title'],
});

function extractJson(text: string) {
    const direct = text.trim();
    if (direct.startsWith('{') && direct.endsWith('}')) return direct;
    const fenced = direct.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return fenced[1].trim();
    const object = direct.match(/\{[\s\S]*"tracks"[\s\S]*\}/);
    return object?.[0]?.trim() || null;
}

function stripUnsupported(code: string) {
    return code
        .replace(/[“”„‟«»]/g, '"')
        .replace(/[‘’‚‛‹›`]/g, "'")
        .replace(/^\s*\$:\s*/gm, '')
        .replace(/\.bank\([^)]*\)/gi, '')
        .replace(/\.slider\([^)]*\)/gi, '')
        .replace(/\._pianoroll\([^)]*\)/gi, '')
        .replace(/\.analyze\([^)]*\)/gi, '')
        .replace(/\banalyze\([^)]*\)/gi, '')
        .replace(/\.cpm\([^)]*\)/gi, '')
        .replace(/\bcpm\([^)]*\)/gi, '')
        .replace(/setcpm\([^)]*\)/gi, '')
        .replace(/,\s*(\)|\]|\})/g, '$1')
        .trim();
}

function isSilentPlaceholder(code: string) {
    const compact = code.replace(/\s+/g, '');
    if (/^s\((['"])~\1\)(?:\.gain\(0(?:\.0+)?\))?$/i.test(compact)) return true;
    if (/^note\(/i.test(compact) && /\.gain\(0(?:\.0+)?\)$/i.test(compact)) return true;
    if (/^sound\(/i.test(compact) && /\.gain\(0(?:\.0+)?\)$/i.test(compact)) return true;
    return false;
}

function sanitizeTrack(value: string | null) {
    if (!value) return value;
    const stripped = stripUnsupported(value);
    return isSilentPlaceholder(stripped) ? null : stripped;
}

function sanitizeTracks(tracks: TrackMap): TrackMap {
    return {
        drums: sanitizeTrack(tracks.drums),
        bass: sanitizeTrack(tracks.bass),
        melody: sanitizeTrack(tracks.melody),
        voice: sanitizeTrack(tracks.voice),
        fx: sanitizeTrack(tracks.fx),
    };
}

const AgentResponseSchema = z.object({
    type: z.literal('update_tracks'),
    thought: z.string(),
    bpm: z.number().int().min(40).max(240),
    tracks: TrackMapSchema,
});

function createTools(prompt: string, currentCode: string | undefined, intent: MusicIntent) {
    const getStyleTraits = tool({
        name: 'get_style_traits',
        description: 'Return genre trait guidance. Use it to avoid wrong-genre or robotic Strudel code.',
        inputSchema: z.object({ genre: z.string() }),
        outputSchema: z.object({ traits: z.string() }),
        execute: ({ genre }) => {
            const key = genre in GENRE_STYLE_TRAITS ? genre as keyof typeof GENRE_STYLE_TRAITS : 'generic';
            return { traits: JSON.stringify(GENRE_STYLE_TRAITS[key]) };
        },
    });

    const validateTracks = tool({
        name: 'validate_tracks',
        description: 'Validate generated Strudel tracks against syntax, role, and genre requirements.',
        inputSchema: z.object({
            tracks: TrackMapSchema,
        }),
        outputSchema: z.object({
            valid: z.boolean(),
            issues: z.array(z.object({ trackId: z.string(), reason: z.string() })),
        }),
        execute: ({ tracks }) => validateGeneratedTracks(tracks as TrackMap, prompt, currentCode, intent),
    });

    return [getStyleTraits, validateTracks] as const;
}

function withDebugMetadata(
    response: AgentUpdateResponse,
    local: MusicAgentPipelineResult,
    source: MusicAgentResponseSource,
): AgentUpdateResponseWithDebug {
    return {
        ...response,
        debug: {
            source,
            genre: local.brief.genre,
            requestedScope: local.brief.requestedScope,
            targetTracks: local.brief.targetTracks,
            validation: local.validation,
            review: {
                score: local.review.score,
                matchesIntent: local.review.matchesIntent,
                listenability: local.review.listenability,
                problems: local.review.problems,
                improvements: local.review.improvements,
            },
            traces: local.traces,
        },
    };
}

export async function refineWithOpenRouterAgent(params: {
    prompt: string;
    currentCode?: string;
    context: MusicContext;
    intent: MusicIntent;
    local: MusicAgentPipelineResult;
}): Promise<AgentUpdateResponse | null> {
    if (!OPENROUTER_API_KEY) return null;
    if (params.intent.kind === 'tempo_change' || params.intent.kind === 'track_only') return null;

    const grounding = formatAgentGrounding(params.prompt, params.local.brief, params.local.theory, params.local.sound);
    const candidate = toAgentUpdateResponse(params.local);
    const tools = createTools(params.prompt, params.currentCode, params.intent);
    const input = [
        'You are a small agent team for generating enjoyable Strudel music code.',
        'Roles: UserIntentAgent, MusicTheoryAgent, SoundDesignAgent, StrudelCodeAgent, CodeValidationAgent, MusicQualityReviewAgent, RefinementAgent.',
        'Return ONLY JSON matching: {"type":"update_tracks","thought":string,"bpm":number,"tracks":{"drums":string|null,"bass":string|null,"melody":string|null,"voice":string|null,"fx":string|null}}.',
        'Use examples and traits as reference material only. Do not simply copy examples unless the deterministic candidate is already the best musical answer.',
        'Avoid robotic repetition, random notes, unsupported helpers, fake genre claims, and muddy gain stacking.',
        'For rock-family requests, include realistic backbeat drums, bass, and a guitar-like riff/chord track.',
        'For rock and hard rock, harder means tighter rhythm, stronger backbeat, and E-minor root/fifth pairs such as E/B, G/D, and A/E; do not raise guitar distortion above 0.18.',
        'Do not add silent placeholder tracks such as s("~").gain(0) or note(m("c4")).gain(0); use null instead.',
        'Before final JSON, use validate_tracks when you change any track.',
        grounding,
        `Current deterministic candidate:\n${JSON.stringify(candidate)}`,
        `User request: ${params.prompt}`,
    ].join('\n\n');

    let lastError: unknown;
    for (const model of getOpenRouterModelCandidates()) {
        try {
            const result = callModel(agentClient, {
                model,
                input,
                tools,
                temperature: 0.35,
                maxOutputTokens: 1400,
                stopWhen: [stepCountIs(3), maxCost(0.04)],
                allowFinalResponse: 'Return the final validated JSON response now.',
            });
            const text = await result.getText();
            const json = extractJson(text);
            if (!json) continue;
            const parsed = AgentResponseSchema.parse(JSON.parse(json));
            const tracks = sanitizeTracks(parsed.tracks as TrackMap);
            const validation = validateGeneratedTracks(tracks, params.prompt, params.currentCode, params.intent);
            if (!validation.valid) {
                console.warn('[MusicAgent] OpenRouter refinement rejected:', validation.issues);
                continue;
            }
            return {
                type: 'update_tracks',
                thought: parsed.thought,
                bpm: parsed.bpm,
                tracks,
            };
        } catch (err) {
            lastError = err;
            console.warn(`[MusicAgent] OpenRouter agent failed (${model})`, err);
        }
    }

    if (lastError) {
        console.warn('[MusicAgent] Falling back to local pipeline after OpenRouter agent failure.');
    }
    return null;
}

export async function runMusicAgentPipeline(params: {
    prompt: string;
    currentCode?: string | null;
    currentState?: Partial<SonicSessionState> | null;
    context?: MusicContext;
    intent?: MusicIntent;
    enableOpenRouter?: boolean;
    includeDebug?: boolean;
}): Promise<AgentUpdateResponseWithDebug> {
    const context = params.context || buildMusicContext({ currentState: params.currentState, currentCode: params.currentCode });
    const intent = params.intent || routeMusicIntent(params.prompt, context);
    const local = buildLocalMusicAgentPipeline({ ...params, context, intent });
    const localResponse = toAgentUpdateResponse(local);

    if (params.enableOpenRouter === false) {
        return params.includeDebug ? withDebugMetadata(localResponse, local, local.source) : localResponse;
    }

    const refined = await refineWithOpenRouterAgent({
        prompt: params.prompt,
        currentCode: params.currentCode || undefined,
        context,
        intent,
        local,
    });

    if (refined) {
        return params.includeDebug ? withDebugMetadata(refined, local, 'openrouter_agent') : refined;
    }

    return params.includeDebug ? withDebugMetadata(localResponse, local, local.source) : localResponse;
}
