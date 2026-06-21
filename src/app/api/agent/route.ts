import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { InstrumentType } from '@/types/sonic';
import {
    OPENROUTER_API_KEY,
    OPENROUTER_HEADERS,
    OPENROUTER_TIMEOUT_MS,
    getOpenRouterModelCandidates,
    getServerEnv,
} from '@/lib/ai/openrouter-config';
import {
    TrackMap,
    buildDeterministicMusicResponse,
    buildIntentFallback,
    buildTemplateGrounding,
    getTemplateForPrompt,
} from '@/lib/music/genreTemplates';
import { MusicContext, MusicIntent, buildMusicContext, routeMusicIntent, isPureChatGreeting } from '@/lib/music/musicIntent';
import { formatTrainingExamplesForPrompt } from '@/lib/music/trainingCorpus';
import { validateGeneratedTracks } from '@/lib/music/strudelValidation';
import { runMusicAgentPipeline } from '@/lib/music-agent';
import { validateStrudelCode } from '@/agents/StrudelCodeAudioValidationAgent';
import { tryRuleBasedUpdate } from '@/lib/agent/runtime';
import { VoiceStyle, VoiceEffectSettings, AmbienceType, VoiceGenerationCommand } from '@/lib/voice-synthesizer/types';

// MusicGen server URL
const MUSICGEN_URL = process.env.MUSICGEN_URL || 'http://localhost:5001';

// YouTube to Strudel server URL
const YOUTUBE_STRUDEL_URL = process.env.YOUTUBE_STRUDEL_URL || 'http://localhost:5002';
const MUSIC_AGENT_DEBUG = /^(1|true|yes)$/i.test(getServerEnv('MUSIC_AGENT_DEBUG'));
// Initialize OpenRouter client (using OpenAI SDK with custom baseURL)
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
    timeout: OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
    defaultHeaders: OPENROUTER_HEADERS,
});
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonWithCors(data: unknown, init: ResponseInit = {}) {
    return NextResponse.json(data, { ...init, headers: corsHeaders });
}

function isRecoverableProviderError(error: unknown) {
    const status = (error as { status?: number })?.status;
    if (typeof status === 'number') {
        return status === 404 || status === 408 || status === 429 || status >= 500;
    }

    const code = String((error as { code?: string })?.code || '').toLowerCase();
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    return (
        code.includes('timeout') ||
        code.includes('etimedout') ||
        code.includes('econnreset') ||
        message.includes('timeout') ||
        message.includes('timed out') ||
        message.includes('fetch failed') ||
        message.includes('network')
    );
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Check if MusicGen is requested
function detectMusicGenRequest(prompt: string): { shouldGenerate: boolean; type?: string; description?: string } {
    const p = prompt.toLowerCase();

    // Keywords that suggest user wants AI-generated real audio (not synthesized tones)
    const musicGenTriggers = [
        // Explicit MusicGen requests
        /\b(musicgen|ai\s+music|neural\s+audio)/i,
        /\b(generate|create|make)\s+(real|actual|ai)\s+(music|audio|sound)/i,
        /\bgenerate\s+a?\s*(sample|loop|beat)/i,
        // "real X" triggers
        /\b(real|actual)\s+(drums?|bass|melody|voice|choir|pad|orchestra|strings|guitar|piano)/i,
        /\b(real)\s+(kick|snare|hihat|hi-hat|cymbal|tom)/i,
        // "ai X" triggers
        /\bai\s+(drums?|bass|melody|synth|beat|music)/i,
        // Simple phrases that indicate desire for realistic audio
        /\b(realistic|authentic)\s+(drums?|bass|beat|music|sound)/i,
        /\breal\s+sounding/i,
        /\bnot\s+synth(esized)?/i,
        /\blike\s+real\s+(drums?|instruments?)/i,
        // Orchestra and choir
        /\b(orchestra|orchestral|strings|choir|angelic|angel|vocal)/i,
    ];

    for (const trigger of musicGenTriggers) {
        if (trigger.test(p)) {
            // Determine what type of stem to generate
            let type = 'drums';
            if (/bass/i.test(p)) type = 'bass';
            else if (/melody|lead|synth|piano|guitar/i.test(p)) type = 'melody';
            else if (/voice|vocal|choir|angel|angelic|orchestra|strings/i.test(p)) type = 'voice';
            else if (/pad|ambient|fx|atmosphere/i.test(p)) type = 'fx';
            else if (/kick|snare|hihat|hi-hat|cymbal|tom|drum/i.test(p)) type = 'drums';

            return { shouldGenerate: true, type, description: prompt };
        }
    }

    return { shouldGenerate: false };
}

// Generate audio via MusicGen server
async function generateMusicGenSample(type: string, prompt: string): Promise<{ audio_base64: string; duration: number; generation_time: number } | null> {
    try {
        // Check if server is available
        const healthCheck = await fetch(`${MUSICGEN_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000)
        });

        if (!healthCheck.ok) {
            console.log('[MusicGen] Server not available');
            return null;
        }

        console.log(`[MusicGen] Generating ${type} stem: ${prompt}`);

        const response = await fetch(`${MUSICGEN_URL}/generate_stem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                style: extractStyle(prompt),
                mood: extractMood(prompt),
                bpm: 128,
                duration: 8,
            }),
        });

        if (!response.ok) {
            console.error('[MusicGen] Generation failed:', await response.text());
            return null;
        }

        const data = await response.json();
        return {
            audio_base64: data.audio_base64,
            duration: data.duration || 8,
            generation_time: data.generation_time || 0,
        };
    } catch (err) {
        console.error('[MusicGen] Error:', err);
        return null;
    }
}

// Extract style from prompt
function extractStyle(prompt: string): string {
    const p = prompt.toLowerCase();
    if (/techno|tech\s*house/i.test(p)) return 'techno';
    if (/house|deep/i.test(p)) return 'house';
    if (/trance/i.test(p)) return 'trance';
    if (/dubstep|bass\s*music/i.test(p)) return 'dubstep';
    if (/ambient|atmospheric/i.test(p)) return 'ambient';
    if (/hip\s*hop|trap/i.test(p)) return 'hip hop';
    if (/rock|metal/i.test(p)) return 'rock';
    if (/jazz/i.test(p)) return 'jazz';
    if (/classical|orchestral/i.test(p)) return 'orchestral';
    return 'electronic';
}

// Extract mood from prompt
function extractMood(prompt: string): string {
    const p = prompt.toLowerCase();
    if (/dark|heavy|aggressive/i.test(p)) return 'dark';
    if (/bright|happy|uplifting/i.test(p)) return 'uplifting';
    if (/chill|relaxed|calm/i.test(p)) return 'chill';
    if (/energetic|powerful|driving/i.test(p)) return 'energetic';
    if (/ethereal|dreamy|heavenly/i.test(p)) return 'ethereal';
    if (/sad|melancholic/i.test(p)) return 'melancholic';
    return 'energetic';
}

// Detect YouTube URLs in prompt
function detectYouTubeURL(prompt: string): string | null {
    // Match various YouTube URL formats
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = prompt.match(pattern);
        if (match) {
            // Return full URL
            return `https://www.youtube.com/watch?v=${match[1]}`;
        }
    }
    return null;
}

// Analyze YouTube video and generate Strudel code
async function analyzeYouTubeVideo(url: string, duration: number = 30): Promise<{
    code: string;
    metadata: { title: string; artist: string; duration: number };
    analysis: { bpm: number; key: string; mode: string };
} | null> {
    try {
        // Check if YouTube-to-Strudel server is available
        const healthCheck = await fetch(`${YOUTUBE_STRUDEL_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });

        if (!healthCheck.ok) {
            console.log('[YouTube] Audio analysis server not available');
            return null;
        }

        console.log(`[YouTube] Sending to audio analysis server: ${url}`);

        // Call the Python server that does real audio analysis
        const response = await fetch(`${YOUTUBE_STRUDEL_URL}/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, duration }),
            signal: AbortSignal.timeout(180000) // 3 minute timeout for download + analysis
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[YouTube] Audio analysis failed:', error);
            return null;
        }

        const data = await response.json();
        console.log(`[YouTube] Analysis complete: BPM=${data.analysis?.bpm}, Key=${data.analysis?.key}`);

        return {
            code: data.code || '',
            metadata: {
                title: data.metadata?.title || 'Unknown',
                artist: data.metadata?.artist || 'Unknown',
                duration: data.metadata?.duration || duration
            },
            analysis: {
                bpm: data.analysis?.bpm || 120,
                key: data.analysis?.key || 'C',
                mode: data.analysis?.mode || 'minor'
            }
        };
    } catch (err) {
        console.error('[YouTube] Error:', err);
        return null;
    }
}

// Detect and parse Voice Synthesizer requests
function detectVoiceRequest(prompt: string): { 
    shouldHandle: boolean; 
    thought?: string; 
    command?: VoiceGenerationCommand; 
} {
    const p = prompt.toLowerCase();
    
    // Core triggers that indicate a Voice Lab request
    const voiceTriggers = [
        /\b(voice|speech|speak|say|tts|pronounce|vocalize|impersonate|clone)\b/i,
        /\b(robotic|deep|alien|monster|lion|radio|telephone|glitch|whisper|thunder|demon|cartoon|emergency|announcer|broadcast)\s+voice\b/i
    ];
    
    const isVoice = voiceTriggers.some(t => t.test(p));
    if (!isVoice) {
        return { shouldHandle: false };
    }
    
    // Determine style
    let voiceStyle: VoiceStyle = 'neutral';
    let thought = 'Detected voice request. Applying neutral profile.';
    
    if (/\b(deep|cinematic|trailer|movie)\b/i.test(p)) {
        voiceStyle = 'deep_cinematic';
        thought = 'Applying Deep Cinematic voice preset: low-pitched with rich space and saturation.';
    } else if (/\b(robot|robotic|vocoder|cybernetic|cyborg|machine)\b/i.test(p)) {
        voiceStyle = 'robotic';
        thought = 'Applying Robotic preset: metallic, digital synthesis style.';
    } else if (/\b(alien|space|ufo|martian|extraterrestrial)\b/i.test(p)) {
        voiceStyle = 'alien';
        thought = 'Applying Alien preset: modulated pitch shifts with cosmic delay.';
    } else if (/\b(monster|beast|growl|creature)\b/i.test(p)) {
        voiceStyle = 'monster';
        thought = 'Applying Monster preset: massive pitch drop with tube drive.';
    } else if (/\b(lion|roar|predator)\b/i.test(p)) {
        voiceStyle = 'lion';
        thought = 'Applying Lion preset: low guttural resonance with sharp overdrive.';
    } else if (/\b(radio|announcer|broadcast|dj|podcast)\b/i.test(p)) {
        voiceStyle = 'radio_announcer';
        thought = 'Applying Radio Announcer preset: crisp presence and direct communication feel.';
    } else if (/\b(telephone|phone|lofi|retro)\b/i.test(p)) {
        voiceStyle = 'old_telephone';
        thought = 'Applying Old Telephone preset: bandpass filter and retro microphone crunch.';
    } else if (/\b(glitch|glitchy|broken)\b/i.test(p)) {
        voiceStyle = 'glitch_ai';
        thought = 'Applying Glitchy AI preset: high pitch fluctuations and digital grain.';
    } else if (/\b(whisper|whispering|quiet|soft)\b/i.test(p)) {
        voiceStyle = 'whisper';
        thought = 'Applying Whisper preset: high breathiness layer and soft dynamics.';
    } else if (/\b(thunder|god|thor|booming)\b/i.test(p)) {
        voiceStyle = 'thunder_god';
        thought = 'Applying Thunder God preset: booming pitch shift with thunder atmosphere.';
    } else if (/\b(demon|satanic|evil|diabolical|underworld)\b/i.test(p)) {
        voiceStyle = 'demon';
        thought = 'Applying Demon preset: dual pitch drops and deep cavern depth.';
    } else if (/\b(cartoon|chipmunk|funny|high)\b/i.test(p)) {
        voiceStyle = 'cartoon';
        thought = 'Applying Cartoon preset: high-pitched and playful.';
    } else if (/\b(emergency|alert|warning|alarm|siren)\b/i.test(p)) {
        voiceStyle = 'emergency_broadcast';
        thought = 'Applying Emergency Broadcast preset: high saturation and siren atmosphere.';
    }
    
    // Extract text
    let text = '';
    const quoteMatch = prompt.match(/(?:say|speak|voice|pronounce)\s+["'“]([^"'“”]+)["'”]/i);
    if (quoteMatch) {
        text = quoteMatch[1];
    } else {
        const simpleMatch = prompt.match(/(?:say|speak)\s+([a-zA-Z0-9\s!,.-]+)$/i);
        if (simpleMatch) {
            text = simpleMatch[1];
        }
    }
    
    // Additional effect parameter changes
    const effects: Partial<VoiceEffectSettings> = {};
    if (/\b(higher pitch|pitch up|more pitch|pitch higher)\b/i.test(p)) {
        effects.pitch = 6;
    } else if (/\b(lower pitch|pitch down|pitch lower)\b/i.test(p)) {
        effects.pitch = -6;
    }
    
    if (/\b(faster|speed up)\b/i.test(p)) {
        effects.speed = 1.35;
    } else if (/\b(slower|speed down)\b/i.test(p)) {
        effects.speed = 0.75;
    }

    if (/\b(more reverb|reverb|echo)\b/i.test(p)) {
        effects.reverb = 0.5;
    }

    if (/\b(distortion|saturate|drive|crunch)\b/i.test(p)) {
        effects.distortion = 0.4;
    }

    if (/\b(delay|feedback)\b/i.test(p)) {
        effects.delay = 0.35;
    }

    // Ambience layer detection
    const ambience: AmbienceType[] = [];
    if (/\brain\b/i.test(p)) ambience.push('rain');
    if (/\bwind\b/i.test(p)) ambience.push('wind');
    if (/\bthunder\b/i.test(p)) ambience.push('thunder');
    if (/\bcave\b/i.test(p)) ambience.push('cave');
    if (/\bspace\b/i.test(p)) ambience.push('space_ambience');
    if (/\bhum\b/i.test(p)) ambience.push('electronic_hum');
    if (/\bclick\b/i.test(p)) ambience.push('relay_clicks');
    if (/\bservo\b/i.test(p)) ambience.push('robotic_servo');
    if (/\bglitch\b/i.test(p)) ambience.push('glitch_particles');
    if (/\balarm\b/i.test(p)) ambience.push('alarm');
    if (/\bsiren\b/i.test(p)) ambience.push('siren');

    return {
        shouldHandle: true,
        thought,
        command: {
            mode: text ? 'voice_generation' : 'voice_transform',
            text: text || undefined,
            voiceStyle,
            effects,
            ambience: ambience.length > 0 ? ambience : undefined,
            provider: 'browser_speech',
            target: 'voice_workspace'
        }
    };
}

import {
    coerceBpmValue,
    extractBpmFromPrompt,
    sanitizeGeneratedCode,
    cleanStrudelCode,
    parseStrudelCodeToTracks,
    toTrackMap,
} from '@/lib/music/codeExtractor';

type ParsedResponse = {
    type?: 'chat' | 'meta' | 'code' | 'update_tracks';
    action?: string;
    content?: string;
    thought?: string;
    message?: string;
    bpm?: number;
    tracks?: {
        [K in InstrumentType]?: string | null;
    } & {
        drums?: string | null;
        bass?: string | null;
        melody?: string | null;
        voice?: string | null;
        fx?: string | null;
    };
};

const hasAnyTrack = (tracks: Record<string, string | null>) =>
    Object.values(tracks).some(v => typeof v === 'string' && v.trim());

const detectRequestedTracks = (prompt: string) => {
    const p = prompt.toLowerCase();
    const wants = {
        drums: /\b(drums?|beat|beats|percussion|kick|snare|hats?|hihat|hi-hat|batucada|samba|brazilian|carnival|surdo|tamborim|agogo|escola|anna|vintage culture|techno samba|rhythm)\b/.test(p),
        bass: /\b(bass|sub|low end|low-end|bassline)\b/.test(p),
        melody: /\b(melody|melodies|lead|topline|chords?|pads?|keys|synth|arps?|arpeggio|guitar|riff|power\s*chords?)\b/.test(p),
        voice: /\b(voice|voices|vocal|vocals|speech|sing|singing|choir|robot|talk|angel|angelic|heaven|heavenly)\b/.test(p),
        fx: /\b(fx|effects?|atmo|atmos|atmosphere|texture|noise|riser|sweep|ambient)\b/.test(p),
    };
    const any = wants.drums || wants.bass || wants.melody || wants.voice || wants.fx;
    return any ? wants : { drums: true, bass: true, melody: true, voice: true, fx: true };
};

const isPlainRapVocalBedPrompt = (prompt: string) =>
    /\b(?:rap(?:per)?|hip\s*hop|hip-hop|hiphop|boom\s*bap|trap|eminem|eminen|slim\s+shady)\b/i.test(prompt)
    && !/\b(melod(?:y|ic)|hook|lead|topline|piano|sample|chords?|keys|arp|arpeggio)\b/i.test(prompt);

const RAP_VOCAL_BED_THOUGHT = 'Rap vocal-bed loop: punchy half-time drums, low sub bass, and open space for vocals. No melodic lead was added.';

const applyIntentTrackPolicy = (
    tracks: Record<string, string | null>,
    intent: MusicIntent,
    context: MusicContext,
    prompt: string,
) => {
    const next = toTrackMap(hasAnyTrack(tracks) ? tracks : context.tracks);
    if (!hasAnyTrack(next)) {
        return buildIntentFallback(intent, context, '').tracks;
    }

    for (const trackId of intent.clearTracks) {
        next[trackId] = 'silence';
    }
    if (isPlainRapVocalBedPrompt(prompt)) {
        next.melody = 'silence';
        next.voice = 'silence';
    }

    return next;
};

const buildProviderFallback = (intent: MusicIntent, context: MusicContext, thought: string) => {
    // 2.4: prefer getTemplateForPrompt / intent-aware when possible to avoid hard generic for artist/concept
    const fallback = buildIntentFallback(intent, context, thought);
    // If intent has templateId from detection (e.g. trance for tiesto), the fallback already uses it.
    // Strengthen by using getTemplateForPrompt if no strong template yet.
    if (!intent.templateId || intent.templateId === 'generic') {
        const tmpl = getTemplateForPrompt(thought || '', context.currentCode || undefined);  // best effort
        if (tmpl && tmpl.id !== 'generic') {
            fallback.tracks = { ...tmpl.tracks };
            fallback.bpm = intent.nextBpm ?? tmpl.bpm;
        }
    }
    return {
        ...fallback,
        bpm: intent.nextBpm ?? fallback.bpm,
    };
};

const logBadGeneration = (
    prompt: string,
    raw: string,
    issues: ReturnType<typeof validateGeneratedTracks>['issues'],
    tracks: TrackMap,
) => {
    try {
        const logDir = path.join(process.cwd(), 'training_data', 'strudel_prompt_code');
        fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(
            path.join(logDir, 'bad_generations.log.jsonl'),
            `${JSON.stringify({
                timestamp: new Date().toISOString(),
                prompt,
                issues,
                raw: raw.slice(0, 2000),
                tracks,
            })}\n`,
            'utf-8',
        );
    } catch (err) {
        console.warn('[API/Agent] Failed to log bad generation:', err);
    }
};

const buildValidatedTrackPayload = async (params: {
    prompt: string;
    currentCode?: string;
    intent: MusicIntent;
    context: MusicContext;
    raw: string;
    tracks: Record<string, string | null>;
    bpm?: number | null;
    thought?: string;
}) => {
    const finalTracks = applyIntentTrackPolicy(params.tracks, params.intent, params.context, params.prompt);
    // 2.4: validation/agent passes keep distinctive traits (no forced generic); intent-aware policy only clears requested.
    const validation = validateGeneratedTracks(finalTracks, params.prompt, params.currentCode, params.intent);
    const bpm = coerceBpmValue(params.bpm) ?? params.intent.nextBpm ?? extractBpmFromPrompt(params.prompt) ?? params.context.currentBpm;

    if (!validation.valid) {
        logBadGeneration(params.prompt, params.raw, validation.issues, finalTracks);
        return buildIntentFallback(params.intent, params.context);
    }

    // ── StrudelCodeAudioValidationAgent: per-track validation ─────────────────
    // Run the new agent on each non-null track before the code reaches the engine.
    const trackIds = ['drums', 'bass', 'melody', 'voice', 'fx'] as const;
    for (const trackId of trackIds) {
        const trackCode = finalTracks[trackId];
        if (!trackCode || trackCode === 'silence') continue;
        try {
            const agentResult = await validateStrudelCode(trackCode, {
                userPrompt: params.prompt,
                enableAudioValidation: false,
            });
            if (!agentResult.approved) {
                console.warn(
                    `[ValidationAgent] Track "${trackId}" rejected:`,
                    agentResult.errors.map(e => e.message).join('; ')
                );
                // Use suggested patch if available, otherwise fall back
                const patch = agentResult.errors.find(e => e.suggestedPatch)?.suggestedPatch;
                if (patch) {
                    (finalTracks as Record<string, string | null>)[trackId] = cleanStrudelCode(patch);
                    console.log(`[ValidationAgent] Applied patch for track "${trackId}"`);
                } else {
                    // Cannot patch — log and let the track stay for now (existing fallback handles it)
                    console.warn(`[ValidationAgent] No patch available for track "${trackId}", keeping original.`);
                    (finalTracks as Record<string, string | null>)[trackId] = cleanStrudelCode(trackCode);
                }
            } else if (agentResult.warnings.length > 0) {
                console.log(
                    `[ValidationAgent] Track "${trackId}" warnings:`,
                    agentResult.warnings.map(w => w.message).join('; ')
                );
            }
        } catch (err) {
            // Agent errors must never break the music pipeline
            console.warn(`[ValidationAgent] Error validating track "${trackId}":`, err);
        }
    }

    return {
        type: 'update_tracks',
        bpm,
        tracks: finalTracks,
        thought: isPlainRapVocalBedPrompt(params.prompt) ? RAP_VOCAL_BED_THOUGHT : params.thought || '',
    };
};

const SYSTEM_PROMPT = `You are a virtuoso live-coding music assistant powered by Strudel (a port of TidalCycles to JavaScript).
You are performing at a LIVE CODING FESTIVAL. Your goal is to BUILD UP a track layer by layer.

**ABSOLUTE RULE: RESPOND WITH ONLY VALID JSON. NOTHING ELSE.**
- No markdown code blocks
- No explanations before or after the JSON
- No raw Strudel code - always wrap code inside JSON
- EVERY response must be parseable by JSON.parse()

## CRITICAL RULES
1. **ALWAYS OUTPUT JSON**: Every response must be valid JSON matching one of the response types below. NEVER output raw code.
2. **LAYER, DON'T REPLACE**: Output code in a STRUCTURED format, separating Drums, Bass, Melody, Voice, and FX.
3. **PRESERVE EXISTING CODE**: Never delete the user's previous patterns unless explicitly asked.
4. **MUSICAL COHERENCE**: Match the Key. If adding bass, check existing melody notes.
5. **VALID VOWELS ONLY**: For .vowel(), ONLY use: "a", "e", "i", "o", "u". NEVER use words like "zorro", "robot", etc.
6. **TEMPO LOCK**: If the user requests tempo (e.g. "140 bpm", "faster", "slower"), include a top-level "bpm" field (integer 40-240). NEVER simulate tempo with fractional .fast(1.1)/.slow(0.93)/.speed(1.07). Only use .fast/.slow with 2, 4, or 0.5 for rhythmic subdivision.
7. **CONVERSATIONAL QUERIES**: If the user asks a question like "really?", "what?", "huh?", "ok", "nice", respond with a chat message, NOT code.
8. **CLEAN READABLE CHAINS (CRITICAL)**: NEVER emit redundant nested parentheses. Always use direct readable chains. GOOD: "stack(s('RolandTR909_bd*4'), s('~ RolandTR909_cp ~ RolandTR909_cp')).gain(0.9).room(0.2)". BAD: "(((((stack(...))).room(0.84)).delay(0.72)).slow(1.1)).gain(0.5)". The track value must be copy-pasteable directly into a Strudel editor and run.

## COMMAND TYPE DETECTION

1. **GREETINGS/CHAT** (hi, hello, thanks, etc.)
   Return: {"type": "chat", "message": "friendly response"}

2. **META-COMMANDS**
   - "clean/clear/reset code" -> {"type": "meta", "action": "clear"}
   - "stop/silence" -> {"type": "meta", "action": "silence"}

3. **MUSIC REQUESTS** 
   Return:
   {
     "type": "update_tracks",
     "thought": "reasoning",
     "bpm": 140,
     "tracks": {
       "drums": "code or null",
       "bass": "code or null",
       "melody": "code or null",
       "voice": "code or null",
       "fx": "code or null"
     }
   }

## SOUND SOURCES (SAMPLES + SYNTHS)
- Drum samples (recommended for realistic drums): use s("...") patterns.
  - Techno kit (909): RolandTR909_bd, RolandTR909_sd, RolandTR909_cp, RolandTR909_hh, RolandTR909_oh, RolandTR909_rd, RolandTR909_rim
  - Classic kit (808): RolandTR808_bd, RolandTR808_sd, RolandTR808_cp, RolandTR808_hh, RolandTR808_oh, RolandTR808_cb, RolandTR808_perc
- Tonal synth waveforms: square, triangle, sawtooth, sine, supersaw
- Noise: pink (use for texture/FX, not primary drums)
- Piano sample: note(m("c4 e4 g4")).s("piano")

## SOUND DESIGN REFERENCE

### KICK DRUMS (use samples for realism)
- Techno/Hard (909): s("RolandTR909_bd*4").gain(1)
- House/Groovy (808): s("RolandTR808_bd*4").gain(0.95)
- Minimal: s("RolandTR909_bd ~ ~ RolandTR909_bd ~ ~ RolandTR909_bd ~").gain(0.9)

### SNARES/CLAPS
- Techno clap (909): s("~ RolandTR909_cp ~ RolandTR909_cp").gain(0.8)
- House snare (808): s("~ RolandTR808_sd ~ RolandTR808_sd").gain(0.75)

### HI-HATS
- Closed (909): s("RolandTR909_hh*16").gain(0.35)
- Open (909): s("~ RolandTR909_oh ~ RolandTR909_oh").gain(0.25)
- Offbeat: s("~ RolandTR909_hh ~ RolandTR909_hh").gain(0.3)

### BASS (low frequencies, controlled)
- Dark/Techno: note(m("c1 c1 ~ c1 eb1 ~ g1 ~")).s("sawtooth").lpf(400).gain(0.8)
- Rolling: note(m("c2 c2 eb2 c2")).s("sawtooth").lpf(sine.range(200, 600).slow(4)).gain(0.75)
- Sub: note(m("c1*2")).s("sine").lpf(100).gain(0.9)

### LEADS/MELODY (mid-high frequencies)
- Stab: note(m("<c4 eb4 g4>")).s("square").decay(0.1).hpf(300).room(0.2).gain(0.5)
- Arp: note(m("c4 eb4 g4 c5")).s("sawtooth").lpf(2000).room(0.3).slow(2).gain(0.45)

### 90s RAVE SYNTHS (high resonance filters for that classic sound)
- Squelchy Stab: note(m("d4 d4 ~ d4 f4 ~ a4 ~")).s("supersaw").att(0.005).decay(0.08).lpf(sine.range(800, 4000).slow(2)).resonance(16).gain(0.5)
- Acid Lead: note(m("d3 d3 f3 d3 a3 d3 f3 g3")).s("sawtooth").lpf(sine.range(200, 3000).slow(1)).resonance(20).distort(0.15).gain(0.6)
- Hard Stab: note(m("<d4 f4> ~ <a4 d5> ~")).s("square").att(0.001).decay(0.05).hpf(600).lpf(3500).distort(0.25).gain(0.55)
- Filter Sweep Lead: note(m("d4*8")).s("sawtooth").lpf(sine.range(400, 6000).slow(4)).resonance(18).room(0.15).gain(0.45)

### CHOIR/VOCALS (formant synthesis)
- Choir: note(m("<c4 e4 g4>")).s("sawtooth").vowel("a").slow(2).room(0.8).gain(0.5)
- Robot: note(m("c4 e4 g4 c5")).s("square").vowel("o").crush(6).room(0.3).slow(2)

### RISERS/SWEEPS/DROPS (tension and release - USE IN FX TRACK)
- White Noise Riser (builds tension over 8 bars): s("pink").hpf(sine.range(200, 12000).slow(8)).gain(sine.range(0, 0.6).slow(8))
- Pitch Riser (ascending notes): note(m("c3 d3 e3 g3 c4 e4 g4 c5")).s("sawtooth").fast(2).lpf(sine.range(500, 8000).slow(4)).gain(0.5)
- Filter Sweep Up: s("sawtooth").lpf(sine.range(100, 10000).slow(4)).resonance(15).gain(0.4)
- Reverse Cymbal (downlifter): s("pink").hpf(sine.range(8000, 200).slow(2)).gain(sine.range(0.5, 0).slow(2))
- Sub Drop (impact): note(m("c1")).s("sine").decay(0.8).lpf(100).gain(0.9).slow(8)
- Tension Build: note(m("c4 c4 c4 c4 c4 c4 c4 c4")).s("square").fast(sine.range(1, 4).slow(4)).hpf(1000).gain(0.4)

## MINI-NOTATION
- Space: sequential - "c3 e3 g3"
- ~: rest - "c3 ~ e3 ~"
- <>: alternation - "<c3 e3>"
- *: repeat - "c3*4"
- /: slowdown - "c3/2"
- (): Euclidean - "c3(3,8)"

## ALLOWED METHODS
Sound: s("samplePattern"), note(m("...")).s("instrument"), .s("waveformOrInstrument"), .trans(-12), .add(7)
Envelope: .att(0.01), .decay(0.1), .sustain(0.5), .release(0.3)
Volume: .gain(0.8), .velocity(0.9)
Filters: .lpf(1000), .hpf(200), .bandf(800), .cutoff(500), .resonance(10)
Effects: .room(0.5), .delay(0.5), .distort(0.5), .crush(8), .phaser(4), .chorus(0.5)
Modulation: .tremolo(8), .leslie(5), .vowel("a") (ONLY a, e, i, o, u)
Time: .slow(2), .fast(2), .rev(), .jux(rev)
Stacking: stack(pattern1, pattern2, pattern3)

## PATTERN AUTOMATION
Parameters can be patterns: .lpf(sine.range(200, 2000).slow(4))

## GENRE-SPECIFIC TEMPLATES

### TECHNO (dark, industrial, 4/4, minimal melody, driving hi-hats)
Input: "techno" or "make techno" or "techno beat" or "techno sound"
{
  "type": "update_tracks",
  "thought": "Techno: four-on-floor 909 kick, clap on 2&4, crisp 16th hats, dark filtered saw bass separated from kick in C minor. Clean direct chains only.",
  "tracks": {
    "drums": "stack(s('RolandTR909_bd*4').gain(0.98), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.82), s('RolandTR909_hh*16').gain(0.32), s('~ RolandTR909_oh ~ RolandTR909_oh').gain(0.18))",
    "bass": "note(m('c1 ~ c1 ~ eb1 ~ g1 ~')).s('sawtooth').att(0.008).decay(0.22).lpf(sine.range(180, 580).slow(3)).resonance(12).gain(0.72)",
    "melody": null,
    "voice": null,
    "fx": "s('pink').hpf(sine.range(180, 11000).slow(8)).gain(sine.range(0.06, 0.28).slow(8))"
  }
}

### HOUSE (groovy, warm, 4/4, offbeat hi-hats, chord stabs)
Input: "house" or "deep house" or "house music" or "groovy beat"
{
  "type": "update_tracks",
  "thought": "House: Warm 4/4 kick, snare on 2&4, offbeat hi-hats for groove, warm bass. Key: C major.",
  "tracks": {
    "drums": "stack(s('RolandTR808_bd*4').gain(0.95), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.75), s('~ RolandTR909_hh ~ RolandTR909_hh').gain(0.32), s('RolandTR909_hh*8').gain(0.2))",
    "bass": "note(m('c2 ~ ~ c2 ~ g1 ~ ~')).s('triangle').att(0.01).decay(0.25).lpf(700).gain(0.7)",
    "melody": "note(m('<c4 e4 g4> ~ <d4 f4 a4> ~')).s('piano').decay(0.2).room(0.35).lpf(5000).gain(0.35).slow(2)",
    "voice": null,
    "fx": "s('pink').lpf(sine.range(500, 8000).slow(16)).gain(sine.range(0.05, 0.25).slow(16)).room(0.4)"
  }
}

### AMBIENT (slow, atmospheric, heavy reverb/delay, evolving pads)
Input: "ambient" or "atmospheric" or "chill" or "relax" or "calm"
{
  "type": "update_tracks",
  "thought": "Ambient: No drums, slow evolving pads, heavy reverb and delay, gentle filter movement. Key: C major.",
  "tracks": {
    "drums": null,
    "bass": "note(m(\\"c2 ~ ~ ~ e2 ~ ~ ~\\")).s(\\"sine\\").lpf(300).room(0.7).slow(4).gain(0.5)",
    "melody": null,
    "voice": null,
    "fx": "note(m(\\"<c5 e5 g5> <g4 b4 d5>\\")).s(\\"sine\\").slow(8).room(0.95).delay(0.6).lpf(1500).gain(0.4)"
  }
}

### DRUM & BASS (fast breakbeats, rolling bass, 170+ BPM feel)
Input: "drum and bass" or "dnb" or "jungle" or "breakbeat"
{
  "type": "update_tracks",
  "thought": "DnB: Fast broken beat, rolling bass, minimal lead. Keep tempo locked and use dense subdivisions. Key: C minor.",
  "bpm": 174,
  "tracks": {
    "drums": "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ RolandTR909_bd ~').gain(1), s('~ ~ RolandTR909_sd ~ ~ RolandTR909_sd ~ RolandTR909_sd').gain(0.9), s('RolandTR909_hh*16').gain(0.22))",
    "bass": "note(m('c1 c1 c1 ~ eb1 eb1 ~ c1')).s('sawtooth').att(0.01).decay(0.2).lpf(sine.range(200, 900).slow(2)).gain(0.8)",
    "melody": "note(m('c5 ~ eb5 ~ g5 ~ ~ ~')).s('sine').att(0.01).decay(0.12).hpf(500).room(0.25).gain(0.3)",
    "voice": null,
    "fx": null
  }
}

### MINIMAL (sparse, hypnotic, subtle variations)
Input: "minimal" or "minimal techno" or "hypnotic"
{
  "type": "update_tracks",
  "thought": "Minimal: Sparse 4/4 kick, subtle hi-hats, hypnotic bass loop, no melody. Key: C minor.",
  "tracks": {
    "drums": "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ ~ RolandTR909_bd ~').gain(0.9), s('~ ~ ~ RolandTR909_hh ~ ~ RolandTR909_hh ~').gain(0.22))",
    "bass": "note(m('c2 ~ c2 ~ c2 ~ ~ ~')).s('triangle').att(0.01).decay(0.25).lpf(420).gain(0.65)",
    "melody": null,
    "voice": null,
    "fx": null
  }
}

### TRANCE (uplifting, arpeggios, big pads, driving beat)
Input: "trance" or "uplifting" or "euphoric"
{
  "type": "update_tracks",
  "thought": "Trance: Driving 4/4 kick, offbeat bass, uplifting arpeggio, lush pad. Key: A minor.",
  "tracks": {
    "drums": "stack(s('RolandTR909_bd*4').gain(0.95), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.75), s('~ RolandTR909_hh ~ RolandTR909_hh').gain(0.32), s('RolandTR909_hh*16').gain(0.18))",
    "bass": "note(m('~ a1 ~ a1 ~ a1 ~ a1')).s('sawtooth').att(0.01).decay(0.25).lpf(900).resonance(8).gain(0.7)",
    "melody": "note(m('a4 c5 e5 a5 e5 c5 a4 e4')).s('supersaw').att(0.01).decay(0.22).lpf(3200).room(0.45).delay(0.22).gain(0.45).slow(2)",
    "voice": null,
    "fx": "stack(note(m('<a4 c5 e5> <e4 g4 b4>')).s('sine').slow(8).room(0.9).delay(0.5).lpf(2200).gain(0.25), s('pink').hpf(sine.range(500, 15000).slow(8)).gain(sine.range(0.1, 0.35).slow(8)))"
  }
}

### 90s ITALIAN TECHNO (Mauro Picotto style, hard driving, 140-145 BPM, aggressive resonant filters)
Input: "mauro picotto" or "italian techno" or "90s techno" or "hard techno" or "iguana" or "lizard" or "komodo"
{
  "type": "update_tracks",
  "thought": "90s Italian Techno: Hard punchy 909 kick, aggressive 16th hi-hats, squelchy resonant filter bass, stabby synth riff with filter automation. Classic rave sound. Key: D minor. 142 BPM.",
  "bpm": 142,
  "tracks": {
    "drums": "stack(s('RolandTR909_bd*4').gain(1.1), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.9).room(0.15), s('RolandTR909_hh*16').gain(0.4).hpf(6000), s('~ ~ RolandTR909_oh ~').gain(0.3))",
    "bass": "note(m('d1 d1 ~ d1 d1 ~ d1 ~')).s('sawtooth').att(0.005).decay(0.15).lpf(sine.range(120, 800).slow(1)).resonance(18).distort(0.1).gain(0.85)",
    "melody": "note(m('d4 d4 ~ d4 f4 ~ a4 ~')).s('supersaw').att(0.005).decay(0.08).hpf(400).lpf(sine.range(1200, 4500).slow(2)).resonance(14).distort(0.2).room(0.2).gain(0.55)",
    "voice": null,
    "fx": "stack(note(m('<d5 a4 f5 d5>')).s('square').att(0.001).decay(0.06).hpf(800).lpf(sine.range(2000, 8000).slow(4)).resonance(10).gain(0.35).slow(2), s('pink').hpf(sine.range(1000, 18000).slow(8)).gain(sine.range(0.05, 0.25).slow(8)))"
  }
}

### ACID HOUSE (303 bassline, squelchy filter, hypnotic)
Input: "acid" or "acid house" or "303" or "squelchy"
{
  "type": "update_tracks",
  "thought": "Acid House: Classic 303-style bass with resonant filter sweep, simple 4/4 kick, hypnotic 16-step bassline. Key: A minor.",
  "tracks": {
    "drums": "stack(s('RolandTR909_bd*4').gain(1), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.75), s('RolandTR909_hh*16').gain(0.25))",
    "bass": "note(m('a1 a2 a1 c2 a1 a2 d2 a1')).s('sawtooth').att(0.01).decay(0.18).lpf(sine.range(200, 2200).slow(1)).resonance(18).gain(0.8)",
    "melody": null,
    "voice": null,
    "fx": "note(m('<a3 c4 e4>')).s('sawtooth').lpf(sine.range(500, 3000).slow(2)).resonance(12).room(0.3).gain(0.35).slow(4)"
  }
}

### PROGRESSIVE HOUSE (long builds, evolving filters, deep grooves)
Input: "progressive" or "progressive house" or "deep progressive"
{
  "type": "update_tracks",
  "thought": "Progressive House: Deep 4/4 groove, slowly evolving filter sweeps, atmospheric pads, long tension builds with risers. Key: G minor.",
  "tracks": {
    "drums": "stack(s('RolandTR909_bd*4').gain(0.95), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.7), s('RolandTR909_hh*16').gain(0.22), s('RolandTR909_rd*4').gain(0.18))",
    "bass": "note(m('g1 ~ ~ g1 ~ d2 ~ ~')).s('sawtooth').att(0.01).decay(0.25).lpf(sine.range(200, 900).slow(8)).gain(0.7)",
    "melody": "note(m('g4 bb4 d5 g5')).s('sine').att(0.01).decay(0.4).lpf(sine.range(900, 2600).slow(16)).room(0.55).delay(0.32).gain(0.32).slow(4)",
    "voice": null,
    "fx": "stack(note(m('<g3 bb3 d4> <d3 f3 a3>')).s('sine').slow(16).room(0.95).delay(0.6).lpf(1200).gain(0.2), s('pink').hpf(sine.range(100, 14000).slow(16)).gain(sine.range(0.05, 0.35).slow(16)))"
  }
}

## OTHER EXAMPLES

Input: "add angel voices" or "add heavenly choir" or "orchestra" or "orchestral"
{
  "type": "update_tracks",
  "thought": "Ethereal angel choir using multi-layered formant vowel synthesis, slow harmonic progression, heavy reverb, multiple voice layers.",
  "tracks": {
    "drums": null,
    "bass": null,
    "melody": null,
    "voice": "stack(note(m(\"<c4 e4 g4> <g4 b4 d5> <a4 c5 e5> <f4 a4 c5>\")).s(\"sawtooth\").vowel(\"a\").slow(8).room(0.95).delay(0.4).gain(0.4), note(m(\"<e4 g4 b4> <c5 e5 g5>\")).s(\"sine\").vowel(\"o\").slow(16).room(0.9).gain(0.3), note(m(\"c5 e5 g5 c6\")).s(\"triangle\").vowel(\"e\").slow(4).room(0.8).lpf(3000).gain(0.25))",
    "fx": null
  }
}


Input: "add a robot voice"
{
  "type": "update_tracks",
  "thought": "Robotic vocal using formant synthesis and bitcrushing.",
  "tracks": {
    "drums": null,
    "bass": null,
    "melody": null,
    "voice": "note(m(\\"c4 e4 g4 c5\\")).s(\\"square\\").vowel(\\"o\\").crush(6).room(0.3).slow(2)",
    "fx": null
  }
}

Input: "batucada" or "brazilian drums" or "samba" or "carnival" or "ANNA" or "Vintage Culture"
{
  "type": "update_tracks",
  "thought": "Peak Time Techno + Afro-Brazilian fusion. Industrial 4/4 kick, surdo, tamborim syncopation, tribal elements. Key: C minor.",
  "tracks": {
    "drums": "stack(note(m(\\"c1*4\\")).s(\\"square\\").decay(0.12).lpf(100).gain(1), note(m(\\"~ c3 ~ c3\\")).s(\\"square\\").hpf(800).decay(0.06).room(0.15).gain(0.7), note(m(\\"~ g1 ~ ~\\")).s(\\"triangle\\").decay(0.25).lpf(180).gain(0.8), note(m(\\"c5 ~ c5 c5 ~ c5 c5 ~\\")).s(\\"pink\\").hpf(4000).decay(0.02).gain(0.35), note(m(\\"c6*16\\")).s(\\"pink\\").hpf(8000).decay(0.015).gain(0.25))",
    "bass": "note(m(\\"c2 c2 ~ c2 eb2 ~ c2 ~\\")).s(\\"sawtooth\\").lpf(sine.range(300, 900).slow(8)).decay(0.15).gain(0.75)",
    "melody": "note(m(\\"<c4 eb4 g4> ~ ~ ~\\")).s(\\"square\\").decay(0.08).hpf(500).room(0.3).delay(0.2).gain(0.4).slow(2)",
    "voice": null,
    "fx": "note(m(\\"<c4 g4> <eb4 c4>\\")).s(\\"sawtooth\\").vowel(\\"a\\").decay(0.4).room(0.6).gain(0.3).slow(4)"
  }
}
`;

export async function POST(req: Request) {
    try {
        const { prompt, currentCode, currentState, frequencyData } = await req.json();

        if (!prompt) {
            return jsonWithCors({ error: 'Prompt is required' }, { status: 400 });
        }

        // Run rule-based checks first to intercept SSNN/playback/tempo commands
        if (currentState) {
            const quick = tryRuleBasedUpdate(prompt, currentState);
            if (quick.changed) {
                console.log(`[API/Agent] Rule-based update triggered for prompt: "${prompt}"`);
                return jsonWithCors({
                    type: 'update_tracks',
                    thought: quick.response,
                    bpm: quick.newState.bpm,
                    tracks: Object.fromEntries(
                        Object.entries(quick.newState.tracks).map(([k, v]) => [k, v.pattern])
                    ),
                    ssnn: quick.newState.ssnn,
                    statePatch: {
                        bpm: quick.newState.bpm,
                        scale: quick.newState.scale,
                        isPlaying: quick.newState.isPlaying,
                        tracks: Object.fromEntries(
                            Object.entries(quick.newState.tracks).map(([key, track]) => [key, {
                                muted: track.muted,
                                solo: track.solo,
                                volume: track.volume,
                                fx: track.fx,
                            }])
                        ),
                        ssnn: quick.newState.ssnn,
                    },
                });
            }
        }

        const context = buildMusicContext({ currentState, currentCode });
        const intent = routeMusicIntent(prompt, context);

        // Early conversational gate — "hi", "hello", short chat should not force music generation
        if (isPureChatGreeting(prompt)) {
            const reply = /^(hi|hello|hey|yo)/i.test(prompt.trim())
                ? "Hey! What kind of track do you want to build?"
                : "Got it — what would you like to create or change?";
            return jsonWithCors({ type: 'chat', message: reply });
        }

        // Check if this is a MusicGen request
        const musicGenCheck = detectMusicGenRequest(prompt);
        if (musicGenCheck.shouldGenerate) {
            console.log(`[API/Agent] MusicGen request detected: ${musicGenCheck.type}`);

            const result = await generateMusicGenSample(
                musicGenCheck.type || 'drums',
                musicGenCheck.description || prompt
            );

            if (result) {
                return jsonWithCors({
                    type: 'musicgen',
                    stemType: musicGenCheck.type,
                    audio_base64: result.audio_base64,
                    duration: result.duration,
                    generation_time: result.generation_time,
                    message: `Generated ${musicGenCheck.type} sample in ${result.generation_time.toFixed(1)}s`,
                });
            } else {
                // Fallback to Strudel if MusicGen fails
                console.log('[API/Agent] MusicGen failed, falling back to Strudel');
            }
        }

        // Check if this is a Voice Synthesizer request
        const voiceCheck = detectVoiceRequest(prompt);
        if (voiceCheck.shouldHandle) {
            console.log('[API/Agent] Voice Synthesizer request detected:', prompt);
            return jsonWithCors({
                type: 'voice_command',
                thought: voiceCheck.thought,
                command: voiceCheck.command
            });
        }

        // Check if prompt contains a YouTube URL
        const youtubeUrl = detectYouTubeURL(prompt);
        if (youtubeUrl) {
            console.log(`[API/Agent] YouTube URL detected: ${youtubeUrl}`);

            // Extract duration preference from prompt (default 30s)
            const durationMatch = prompt.match(/(\d+)\s*(?:sec|seconds?|s\b)/i);
            const duration = durationMatch ? parseInt(durationMatch[1]) : 30;

            const result = await analyzeYouTubeVideo(youtubeUrl, duration);

            if (result) {
                console.log('[YouTube] Raw code from server:', result.code);

                // Parse the generated code into tracks
                const tracks = parseStrudelCodeToTracks(result.code);
                console.log('[YouTube] Parsed tracks:', JSON.stringify(tracks, null, 2));

                // Sanitize each track
                const sanitizedTracks: Record<string, string | null> = {};
                for (const [key, value] of Object.entries(tracks)) {
                    if (value && typeof value === 'string') {
                        sanitizedTracks[key] = cleanStrudelCode(sanitizeGeneratedCode(value));
                    } else {
                        sanitizedTracks[key] = null;
                    }
                }
                console.log('[YouTube] Sanitized tracks:', JSON.stringify(sanitizedTracks, null, 2));

                return jsonWithCors({
                    type: 'update_tracks',
                    tracks: hasAnyTrack(sanitizedTracks)
                        ? toTrackMap(sanitizedTracks)
                        : buildIntentFallback(intent, context, 'Generated fallback tracks because YouTube analysis returned no usable patterns.').tracks,
                    thought: `Analyzed "${result.metadata.title}" by ${result.metadata.artist}. Detected BPM: ${result.analysis.bpm}, Key: ${result.analysis.key} ${result.analysis.mode}. Generated Strudel patterns that approximate the rhythm, bass, and melody.`,
                    youtube: {
                        title: result.metadata.title,
                        artist: result.metadata.artist,
                        bpm: result.analysis.bpm,
                        key: result.analysis.key,
                        mode: result.analysis.mode,
                    }
                });
            } else {
                // YouTube analysis failed, tell user
                return jsonWithCors({
                    type: 'chat',
                    message: `I detected the YouTube link but couldn't analyze it. Make sure the YouTube-to-Strudel server is running on port 5002. You can start it with: python tools/youtube_to_strudel.py --server`
                });
            }
        }

        if (process.env.MUSIC_AGENT_PIPELINE !== 'legacy') {
            // Verified for 2.4: full runMusicAgentPipeline is called with the (now artist-aware) intent
            // that carries referenceStyle, templateId etc from musicIntent detection.
            const musicAgentResponse = await runMusicAgentPipeline({
                prompt,
                currentCode,
                currentState,
                context,
                intent,
                enableOpenRouter: true,
                includeDebug: MUSIC_AGENT_DEBUG,
            });
            return jsonWithCors(musicAgentResponse);
        }

        const deterministicResponse = buildDeterministicMusicResponse(intent, context);
        if (deterministicResponse) {
            console.log(`[API/Agent] Deterministic music template selected for prompt: "${prompt}" (${intent.kind}/${intent.templateId})`);
            return jsonWithCors(deterministicResponse);
        }

        if (!OPENROUTER_API_KEY) {
            console.warn('[API/Agent] OPENROUTER_API_KEY not found, generating locally through deterministic fallback');
            return jsonWithCors(buildProviderFallback(
                intent,
                context,
                'OpenRouter is not configured - generating music locally based on your request.',
            ));
        }

        // Build audio analysis context for the AI
        let audioContext = '';
        if (frequencyData) {
            const { rms, peakFrequency, spectralCentroid, lowEnergy, midEnergy, highEnergy } = frequencyData;
            audioContext = `

Current Audio Analysis:
- RMS Level: ${(rms * 100).toFixed(1)}%
- Peak Frequency: ${peakFrequency.toFixed(0)} Hz
- Spectral Centroid: ${spectralCentroid.toFixed(0)} Hz (tonal center)
- Low Frequencies (bass): ${lowEnergy.toFixed(1)} energy
- Mid Frequencies: ${midEnergy.toFixed(1)} energy
- High Frequencies (treble): ${highEnergy.toFixed(1)} energy

CRITICAL - TIMING AND RHYTHM AWARENESS:
The user expects precise timing. Use standard Strudel rhythm notation (e.g. "*4", "/2", "[a b]", "c(3,8)") to ensure no sync errors.
Avoid complex polyrhythms unless explicitly requested.
Listen to the spectral centroid: if it's too high (>3000Hz), the sound might be harsh/distorted.
If low energy is high (>100), the bass might be muddy. Ensure frequency separation between Bass and Kick.

If the user mentions desync, clashing, or balance issues, analyze these values to understand the frequency distribution.`;
        }

        const targetedGrounding = [
            buildTemplateGrounding(intent, context),
            formatTrainingExamplesForPrompt(prompt, 3),
            // 2.4 strengthened: surface artist/concept when present in intent (from 2.1 routing)
            intent.referenceStyle ? `Artist/concept reference style: ${intent.referenceStyle}. Adapt output to be distinct.` : '',
        ].filter(Boolean).join('\n\n');

        const augmentedSystemPrompt = `${SYSTEM_PROMPT}

${targetedGrounding}
`;

        let completion;
        let lastError: unknown;
        let wasRateLimited = false;
        const attemptedModels: string[] = [];
        for (const model of getOpenRouterModelCandidates()) {
            attemptedModels.push(model);
            try {
                completion = await openai.chat.completions.create({
                    model,
                    messages: [
                        { role: "system", content: augmentedSystemPrompt },
                        {
                            role: "user",
                            content: `Current Code:
${currentCode || '// No code yet'}${audioContext}

User Request: ${prompt}`
                        }
                    ],
                    temperature: 0.25,
                    max_tokens: 1500,
                });
                break;
            } catch (err: unknown) {
                lastError = err;
                const status = (err as { status?: number })?.status;
                wasRateLimited ||= status === 429;
                console.warn(`[API/Agent] OpenRouter model failed (${model})`, err);
                if (!isRecoverableProviderError(err)) {
                    throw err;
                }
            }
        }
        if (!completion) {
            const reason = wasRateLimited
                ? 'OpenRouter models were rate limited - generating music locally based on your request.'
                : 'OpenRouter was slow or unavailable - generating music locally based on your request.';
            console.warn(`[API/Agent] ${reason}`, lastError);
            console.warn(`[API/Agent] Attempted models: ${attemptedModels.join(', ')}`);
            return jsonWithCors(buildProviderFallback(intent, context, reason));
        }

        const raw = completion.choices[0].message.content?.trim() || '';
        console.log('[API/Agent] Raw AI response:', raw.substring(0, 500));

        // Helper: extract Strudel code from markdown code blocks
        function extractCodeFromMarkdown(text: string): string | null {
            // Try ```strudel or ```js or ``` blocks
            const codeBlockMatch = text.match(/```(?:strudel|js|javascript)?\s*\n?([\s\S]*?)```/);
            if (codeBlockMatch) return codeBlockMatch[1].trim();
            // Try indented code blocks
            const lines = text.split('\n');
            const codeLines = lines.filter(l => /^\s{2,}|^>\s/.test(l) || /^(stack|note|s|sound|m|silence|sample)\(/.test(l.trim()));
            if (codeLines.length > 0) return codeLines.map(l => l.trim()).join('\n');
            return null;
        }

        // Helper: strip markdown formatting and extract meaningful content
        function stripMarkdown(text: string): string {
            return text
                .replace(/\*\*([^*]+)\*\*/g, '$1')  // bold
                .replace(/\*([^*]+)\*/g, '$1')       // italic
                .replace(/`([^`]+)`/g, '$1')         // inline code
                .replace(/^#{1,6}\s+/gm, '')         // headers
                .replace(/^\s*[-*]\s+/gm, '')        // bullets
                .replace(/^\s*\d+\.\s+/gm, '')       // numbered lists
                .trim();
        }

        // Method 1: Try direct JSON parse
        let parsed: ParsedResponse | null = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            // Method 2: Extract JSON from text (AI sometimes adds explanations before/after)
            const jsonMatch = raw.match(/\{[\s\S]*"type"[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                    console.log('[API/Agent] Extracted JSON from text');
                } catch {
                    console.log('[API/Agent] Failed to parse extracted JSON');
                }
            }
        }

        // Method 2.5: Strip markdown and try again
        if (!parsed) {
            const stripped = stripMarkdown(raw);
            try {
                parsed = JSON.parse(stripped);
                console.log('[API/Agent] Parsed after stripping markdown');
            } catch {
                const strippedJsonMatch = stripped.match(/\{[\s\S]*"type"[\s\S]*\}/);
                if (strippedJsonMatch) {
                    try {
                        parsed = JSON.parse(strippedJsonMatch[0]);
                        console.log('[API/Agent] Extracted JSON after stripping markdown');
                    } catch {
                        console.log('[API/Agent] Failed to parse stripped JSON');
                    }
                }
            }
        }

        // Method 3: Extract code from markdown blocks and wrap as update_tracks
        if (!parsed) {
            const extractedCode = extractCodeFromMarkdown(raw);
            if (extractedCode) {
                console.log('[API/Agent] Extracted code from markdown blocks:', extractedCode.substring(0, 80));
                const sanitizedCode = cleanStrudelCode(sanitizeGeneratedCode(extractedCode));
                const detectedTracks: Record<string, string | null> = {
                    drums: null, bass: null, melody: null, voice: null, fx: null
                };
                if (/RolandTR|bd|sd|hh|cp|kick|snare|clap|hihat/i.test(sanitizedCode)) {
                    detectedTracks.drums = sanitizedCode;
                } else if (/[a-g][12](?!\d)/i.test(sanitizedCode) && /sawtooth|triangle|bass/i.test(sanitizedCode)) {
                    detectedTracks.bass = sanitizedCode;
                } else if (/vowel|voice|choir/i.test(sanitizedCode)) {
                    detectedTracks.voice = sanitizedCode;
                } else if (/pink|noise|riser|sweep|room\(/i.test(sanitizedCode) && !/note\(/i.test(sanitizedCode)) {
                    detectedTracks.fx = sanitizedCode;
                } else {
                    detectedTracks.melody = sanitizedCode;
                }
                return jsonWithCors(await buildValidatedTrackPayload({
                    prompt,
                    currentCode,
                    intent,
                    context,
                    raw,
                    tracks: detectedTracks,
                    thought: 'Extracted pattern from AI response',
                }));
            }
        }

        // Handle parsed JSON
        if (parsed) {
            if (parsed.type === 'chat') {
                return jsonWithCors({ type: 'chat', message: parsed.message });
            }

            if (parsed.type === 'meta') {
                if (parsed.action === 'clear' || parsed.action === 'silence') {
                    return jsonWithCors({ type: 'code', code: 'silence' });
                }
            }

            if (parsed.type === 'update_tracks' && parsed.tracks) {
                const wants = detectRequestedTracks(prompt);

                // Check if tracks look like real Strudel code (not just text descriptions)
                const looksLikeCode = (v: string | null): boolean => {
                    if (!v || typeof v !== 'string') return false;
                    const trimmed = v.trim();
                    if (trimmed.length < 3) return false;
                    if (trimmed === 'silence') return true;
                    return /^(stack|note|s|sound|sample|seq|cat|silence|m)\s*\(/i.test(trimmed);
                };

                // Sanitize each track
                const sanitizedTracks: Record<string, string | null> = {};
                for (const [key, value] of Object.entries(parsed.tracks)) {
                    if (value && typeof value === 'string') {
                        const cleaned = cleanStrudelCode(sanitizeGeneratedCode(value));
                        // Only keep if it actually looks like Strudel code, not plain text
                        sanitizedTracks[key] = looksLikeCode(cleaned) ? cleaned.trim() : null;
                    } else {
                        sanitizedTracks[key] = null;
                    }
                }

                console.log('[API/Agent] Sanitized tracks:', JSON.stringify(Object.fromEntries(
                    Object.entries(sanitizedTracks).map(([k, v]) => [k, v ? v.substring(0, 60) + '...' : null])
                )));

                // Enforce user intent: only keep tracks explicitly requested (unless none specified)
                const anyIntent = wants.drums || wants.bass || wants.melody || wants.voice || wants.fx;
                if (anyIntent) {
                    if (!wants.drums) sanitizedTracks.drums = null;
                    if (!wants.bass) sanitizedTracks.bass = null;
                    if (!wants.melody) sanitizedTracks.melody = null;
                    if (!wants.voice) sanitizedTracks.voice = null;
                    if (!wants.fx) sanitizedTracks.fx = null;
                }

                const bpm = coerceBpmValue(parsed.bpm) ?? extractBpmFromPrompt(prompt) ?? 128;
                const previewTracks = applyIntentTrackPolicy(sanitizedTracks, intent, context, prompt);
                console.log('[API/Agent] Final enforced tracks:', JSON.stringify(Object.fromEntries(
                    Object.entries(previewTracks).map(([k, v]) => [k, v ? v.substring(0, 60) + '...' : null])
                )));
                return jsonWithCors(await buildValidatedTrackPayload({
                    prompt,
                    currentCode,
                    intent,
                    context,
                    raw,
                    bpm,
                    tracks: sanitizedTracks,
                    thought: parsed.thought || '',
                }));
            }

            if (parsed.type === 'code' && parsed.content) {
                const cleanedCode = sanitizeGeneratedCode(parsed.content);
                return jsonWithCors({ type: 'code', code: cleanedCode, thought: parsed.thought });
            }
        }

        // Fallback: Try to interpret what the user wanted and generate something reasonable
        console.warn('[API/Agent] No valid JSON response from model, attempting fallback');

        // Check if user's input is a short conversational query (not a music request)
        const promptLower = prompt.toLowerCase().trim();
        const isConversational = isPureChatGreeting(prompt) ||
            /^(really\??|what\??|huh\??|ok|okay|nice|cool|thanks?|thank you|wow|amazing|lol|haha|yes|no|yep|nope|sure|great|awesome|perfect|sounds? good|love it|i like it|why\??|hi|hello|hey|yo)$/i.test(promptLower);

        if (isConversational) {
            // Return a friendly conversational response
            const conversationalResponses = [
                "Yes! That's the vibe we're going for. Want me to add more energy or change anything?",
                "Glad you like it! Should I modify something or add new elements?",
                "Thanks! Want to add more layers or change the style?",
                "Let me know if you want any changes - more bass, different drums, effects?",
                "I'm here to help! Tell me what you'd like to adjust in the track.",
            ];
            const randomResponse = conversationalResponses[Math.floor(Math.random() * conversationalResponses.length)];
            return jsonWithCors({ type: 'chat', message: randomResponse });
        }

        // Check if the AI returned raw Strudel code (common model failure)
        const strippedForCheck = stripMarkdown(raw);
        const looksLikeRawCode = /^(stack\(|note\(|s\(|sound\(|m\(|\(\s*\(\s*\)\s*=>)/i.test(strippedForCheck.trim());
        if (looksLikeRawCode) {
            console.log('[API/Agent] Detected raw Strudel code, treating as single-track code output');
            const sanitizedCode = cleanStrudelCode(sanitizeGeneratedCode(strippedForCheck));
            // Try to intelligently assign to a track based on content
            const detectedTracks: Record<string, string | null> = {
                drums: null,
                bass: null,
                melody: null,
                voice: null,
                fx: null
            };

            // Analyze code to assign to appropriate track
            if (/RolandTR|bd|sd|hh|cp|kick|snare|clap|hihat/i.test(sanitizedCode)) {
                detectedTracks.drums = sanitizedCode;
            } else if (/[a-g][12](?!\d)/i.test(sanitizedCode) && /sawtooth|triangle|bass/i.test(sanitizedCode)) {
                detectedTracks.bass = sanitizedCode;
            } else if (/vowel|voice|choir/i.test(sanitizedCode)) {
                detectedTracks.voice = sanitizedCode;
            } else if (/pink|noise|riser|sweep|room\(/i.test(sanitizedCode) && !/note\(/i.test(sanitizedCode)) {
                detectedTracks.fx = sanitizedCode;
            } else {
                detectedTracks.melody = sanitizedCode;
            }

            return jsonWithCors(await buildValidatedTrackPayload({
                prompt,
                currentCode,
                intent,
                context,
                raw,
                bpm: extractBpmFromPrompt(prompt) ?? 128,
                tracks: detectedTracks,
                thought: 'Generated pattern from AI response',
            }));
        }

        return jsonWithCors(buildIntentFallback(intent, context, 'Generated deterministic fallback music based on your request.'));

    } catch (error: unknown) {
        console.error('[API/Agent] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to generate code';
        return jsonWithCors(
            { error: message || 'Failed to generate code' },
            { status: 500 }
        );
    }
}
