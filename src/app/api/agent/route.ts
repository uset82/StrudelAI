import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { InstrumentType } from '@/types/sonic';

// MusicGen server URL
const MUSICGEN_URL = process.env.MUSICGEN_URL || 'http://localhost:5001';

// YouTube to Strudel server URL
const YOUTUBE_STRUDEL_URL = process.env.YOUTUBE_STRUDEL_URL || 'http://localhost:5002';

// Initialize OpenRouter client (using OpenAI SDK with custom baseURL)
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Aether Sonic',
    },
});

const MODEL_NAME = process.env.MODEL_NAME || 'x-ai/grok-4.1-fast';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonWithCors(data: unknown, init: ResponseInit = {}) {
    return NextResponse.json(data, { ...init, headers: corsHeaders });
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

// Parse Strudel code into tracks structure
function parseStrudelCodeToTracks(code: string): Record<string, string | null> {
    const tracks: Record<string, string | null> = {
        drums: null,
        bass: null,
        melody: null,
        voice: null,
        fx: null,
    };

    // Split by $: patterns or // comments to identify sections
    const lines = code.split('\n');
    let currentSection = '';
    let currentCode: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Check for section comments
        if (trimmed.startsWith('// Drums') || trimmed.startsWith('// drums')) {
            if (currentSection && currentCode.length > 0) {
                tracks[currentSection] = currentCode.join('\n').replace(/^\$:\s*/, '').trim();
            }
            currentSection = 'drums';
            currentCode = [];
        } else if (trimmed.startsWith('// Bass') || trimmed.startsWith('// bass')) {
            if (currentSection && currentCode.length > 0) {
                tracks[currentSection] = currentCode.join('\n').replace(/^\$:\s*/, '').trim();
            }
            currentSection = 'bass';
            currentCode = [];
        } else if (trimmed.startsWith('// Melody') || trimmed.startsWith('// melody')) {
            if (currentSection && currentCode.length > 0) {
                tracks[currentSection] = currentCode.join('\n').replace(/^\$:\s*/, '').trim();
            }
            currentSection = 'melody';
            currentCode = [];
        } else if (trimmed.startsWith('// Voice') || trimmed.startsWith('// voice')) {
            if (currentSection && currentCode.length > 0) {
                tracks[currentSection] = currentCode.join('\n').replace(/^\$:\s*/, '').trim();
            }
            currentSection = 'voice';
            currentCode = [];
        } else if (trimmed.startsWith('// FX') || trimmed.startsWith('// fx') || trimmed.startsWith('// Ambient')) {
            if (currentSection && currentCode.length > 0) {
                tracks[currentSection] = currentCode.join('\n').replace(/^\$:\s*/, '').trim();
            }
            currentSection = 'fx';
            currentCode = [];
        } else if (trimmed.startsWith('//') || trimmed.startsWith('setcpm')) {
            // Skip other comments and tempo settings
            continue;
        } else if (trimmed && currentSection) {
            currentCode.push(trimmed);
        } else if (trimmed && !currentSection) {
            // If no section identified yet, try to detect from content
            if (/\b(bd|sd|hh|kick|snare|clap)\b/i.test(trimmed) || /\.struct\(/i.test(trimmed)) {
                currentSection = 'drums';
                currentCode.push(trimmed);
            } else if (/\b(c[12]|d[12]|e[12]|f[12]|g[12]|a[12]|b[12])\b/i.test(trimmed) && /triangle|lpf\(4/i.test(trimmed)) {
                currentSection = 'bass';
                currentCode.push(trimmed);
            } else if (/\b(c[45]|d[45]|e[45]|f[45]|g[45]|a[45]|b[45])\b/i.test(trimmed)) {
                currentSection = 'melody';
                currentCode.push(trimmed);
            }
        }
    }

    // Don't forget the last section
    if (currentSection && currentCode.length > 0) {
        tracks[currentSection] = currentCode.join('\n').replace(/^\$:\s*/, '').trim();
    }

    return tracks;
}

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

const coerceLooseLines = (src: string) => {
    const lines = src.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return src;
    if (/[{;]|\b(const|let|var|function|class|return|if|for|while|=>)\b/.test(src)) {
        return src;
    }
    const isPlainExpr = (l: string) => /^(note\(|s\(|stack\(|silence|sound\(|sample\(|n\(|m\()/i.test(l);
    if (lines.every(isPlainExpr)) {
        return `stack(${lines.join(', ')})`;
    }
    return src;
};

const balanceDelimiters = (src: string) => {
    let openParens = 0;
    let openBrackets = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        const prevCh = i > 0 ? src[i - 1] : '';

        // Handle string boundaries (skip escaped quotes)
        if ((ch === '"' || ch === "'" || ch === '`') && prevCh !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = ch;
            } else if (ch === stringChar) {
                inString = false;
                stringChar = '';
            }
            continue;
        }

        // Only count delimiters outside of strings
        if (!inString) {
            if (ch === '(') openParens++;
            else if (ch === ')') openParens = Math.max(0, openParens - 1);
            else if (ch === '[') openBrackets++;
            else if (ch === ']') openBrackets = Math.max(0, openBrackets - 1);
        }
    }

    let balanced = src;
    if (openParens > 0) {
        balanced += ')'.repeat(openParens);
    }
    if (openBrackets > 0) {
        balanced += ']'.repeat(openBrackets);
    }
    return balanced;
};

const coerceBpmValue = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded < 40 || rounded > 240) return null;
    return rounded;
};

const extractBpmFromPrompt = (prompt: string): number | null => {
    const p = prompt.toLowerCase();
    const bpmMatch = p.match(/(\d{2,3})\s*bpm\b/);
    if (bpmMatch) {
        return coerceBpmValue(Number(bpmMatch[1]));
    }
    const tempoMatch = p.match(/\btempo\s*(?:to|=)?\s*(\d{2,3})\b/);
    if (tempoMatch) {
        return coerceBpmValue(Number(tempoMatch[1]));
    }
    return null;
};

const sanitizeGeneratedCode = (input: string) => {
    let output = input;

    // Normalize smart quotes and odd unicode punctuation that can break JS parsing
    output = output
        .replace(/[“”„‟«»]/g, '"')
        .replace(/[‘’‚‛‹›`]/g, "'")
        .replace(/\u00A0/g, ' ')
        .replace(/\u200B/g, '');

    // Remove markdown bullets or stray list markers the model sometimes emits
    output = output.replace(/^\s*[-*]\s+/gm, '');

    // Remove $: prefix (not valid Strudel)
    output = output.replace(/^\s*\$:\s*/gm, '');

    // Remove .bank() calls (samples not available)
    output = output.replace(/\.bank\([^)]*\)/g, '');
    // Remove slider() calls (not available)
    output = output.replace(/\.slider\([^)]*\)/g, '');
    // Remove ._pianoroll() calls (not available)
    output = output.replace(/\._pianoroll\([^)]*\)/g, '');
    // Strip analyze() which is forbidden in this environment
    output = output.replace(/\.analyze\([^)]*\)/gi, '');
    output = output.replace(/\banalyze\([^)]*\)/gi, '');
    // Strip tempo helpers that frequently break parsing (model still tries to add them)
    output = output.replace(/\bcpm\([^)]*\)/gi, '');
    output = output.replace(/\.cpm\([^)]*\)/gi, '');
    output = output.replace(/setcpm\([^)]*\)/gi, '');

    // BPM lock: prevent accidental tempo drift from fractional fast/slow values.
    // We only allow simple musical factors (0.5, 1, 2, 4). Everything else is snapped to the nearest.
    const snapFactor = (v: number) => {
        const candidates = [0.5, 1, 2, 4];
        let best = candidates[0];
        let bestDist = Math.abs(v - best);
        for (const c of candidates) {
            const d = Math.abs(v - c);
            if (d < bestDist) {
                bestDist = d;
                best = c;
            }
        }
        return best;
    };
    output = output.replace(/\.(fast|slow)\(\s*(-?\d+(?:\.\d+)?)\s*\)/gi, (_m, fn, rawVal) => {
        const v = Number(rawVal);
        if (!Number.isFinite(v) || v === 0) return '';
        const snapped = snapFactor(Math.abs(v));
        return `.${String(fn).toLowerCase()}(${snapped})`;
    });

    // NOTE: We no longer replace sample calls with synth equivalents since we now load real samples
    // s("bd"), s("sd"), s("hh"), s("cp") etc. will use the loaded Dirt-Samples

    // Normalize vowel arguments to valid vowels
    // Allow sequences but filter out invalid words
    output = output.replace(/\.vowel\(\s*(["'`])([^"'`]+)\1\s*\)/gi, (_match, quote, content) => {
        // First, sanitize individual tokens within the content
        let sanitizedTokenContent = content.replace(/[a-z]+/gi, (token: string) => {
            if (/^[aeiou]$/i.test(token)) return token.toLowerCase();
            const match = token.match(/[aeiou]/i);
            return match ? match[0].toLowerCase() : 'a';
        });

        // Now, ensure the final result for .vowel() is a single valid vowel.
        // Take the first vowel found in the (potentially multi-vowel) sanitizedTokenContent
        // or default to 'a' if none found.
        const finalVowelMatch = sanitizedTokenContent.match(/[aeiou]/i);
        const finalVowel = finalVowelMatch ? finalVowelMatch[0].toLowerCase() : 'a';

        return `.vowel("${finalVowel}")`;
    });

    // Fix mini-notation strings that start with "(" which breaks the mini parser
    output = output.replace(/m\(\s*["'`]\(([^"'`]+)["'`]\s*\)/gi, (_match, inner) => {
        return `m("${inner}")`;
    });

    // Remove duplicate commas
    output = output.replace(/,\s*,+/g, ',');
    // Strip trailing commas before closing delimiters
    output = output.replace(/,\s*(\)|\]|\})/g, '$1');
    // Strip leading commas at line starts (common when model inserts bullet-like commas)
    output = output.replace(/(^|\r?\n)\s*,\s*/g, '$1');

    // Clean up dangling commas left by removals
    output = output.replace(/,\s*(?=[\)\}])/g, '');

    // Fix function calls with leading commas: "stack(, " -> "stack("
    output = output.replace(/\(\s*,/g, '(');
    output = output.replace(/stack\(\s*,/g, 'stack('); // Extra safety

    output = coerceLooseLines(output.trim());

    // Final safety check for leading commas after coercion
    output = output.replace(/\(\s*,/g, '(');

    if (input !== output) {
        console.log('[Sanitizer] Fixed code:', { input: input.substring(0, 50), output: output.substring(0, 50) });
    }

    // Fix run-on code: "stack(...))stack(...)" -> "stack(...))"
    const runOnMatch = output.match(/\)\s*(stack|note|s|sound|n|seq|cat)\(/);
    if (runOnMatch && runOnMatch.index) {
        console.log('[API/Agent] Detected run-on code, truncating...');
        output = output.substring(0, runOnMatch.index + 1);
    }

    // Fix missing commas between patterns: "stack(note(...) note(...))" -> "stack(note(...), note(...))"
    // This is a common LLM error where it lists arguments without commas
    output = output.replace(/\)\s+(stack|note|s|sound|n|seq|cat|m)/g, '), $1');

    output = balanceDelimiters(output);

    // Verify syntax by wrapping in a function that has Strudel globals as parameters
    // This prevents "undefined" errors for note, stack, m, sine, etc.
    const strudelGlobals = 'note, m, s, n, stack, silence, sound, sample, seq, cat, sine, saw, tri, square, pink, noise, cosine, rand';
    try {
        new Function(strudelGlobals, `return ${output}`);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        // Only log if it's a real syntax issue (not undefined variable)
        if (!message.includes('is not defined')) {
            console.warn('[Sanitizer] Generated code has syntax error:', message);
        }

        // Attempt fixes only for actual syntax issues (unbalanced parens, etc.)
        if (message.includes('missing )') || message.includes('Unexpected end') || message.includes('Unexpected token')) {
            // Re-run balance with aggressive fix
            let fixed = output;
            // Remove any trailing incomplete method chains like ".gain(" or ".lpf("
            fixed = fixed.replace(/\.\w+\([^)]*$/g, '');
            // Re-balance
            fixed = balanceDelimiters(fixed);
            // Retry parse
            try {
                new Function(strudelGlobals, `return ${fixed}`);
                output = fixed;
                console.log('[Sanitizer] Fixed syntax via re-balance');
            } catch {
                // If still failing, try stripping to last complete expression
                const lastCompleteStack = fixed.lastIndexOf(')');
                if (lastCompleteStack > 0) {
                    fixed = fixed.substring(0, lastCompleteStack + 1);
                    fixed = balanceDelimiters(fixed);
                    try {
                        new Function(strudelGlobals, `return ${fixed}`);
                        output = fixed;
                        console.log('[Sanitizer] Fixed syntax via truncation');
                    } catch {
                        // At this point, just return the balanced output and let Strudel handle it
                        console.warn('[Sanitizer] Could not verify syntax, proceeding anyway');
                    }
                }
            }
        }
    }

    return output;
};

const detectRequestedTracks = (prompt: string) => {
    const p = prompt.toLowerCase();
    const wants = {
        drums: /\b(drums?|beat|beats|percussion|kick|snare|hats?|hihat|hi-hat|batucada|samba|brazilian|carnival|surdo|tamborim|agogo|escola|anna|vintage culture|techno samba|rhythm)\b/.test(p),
        bass: /\b(bass|sub|low end|low-end|bassline)\b/.test(p),
        melody: /\b(melody|melodies|lead|topline|chords?|pads?|keys|synth|arps?|arpeggio)\b/.test(p),
        voice: /\b(voice|voices|vocal|vocals|speech|sing|singing|choir|robot|talk|angel|angelic|heaven|heavenly)\b/.test(p),
        fx: /\b(fx|effects?|atmo|atmos|atmosphere|texture|noise|riser|sweep|ambient)\b/.test(p),
    };
    const any = wants.drums || wants.bass || wants.melody || wants.voice || wants.fx;
    // If no explicit request, allow all
    return any ? wants : { drums: true, bass: true, melody: true, voice: true, fx: true };
};

const enforceAtLeastOne = (tracks: Record<string, string | null>) => {
    const hasAny = Object.values(tracks).some(v => typeof v === 'string' && v.trim());
    if (hasAny) return tracks;
    // Default to a simple drum pulse if nothing was provided
    return {
        drums: 'stack(s("RolandTR909_bd*4"), s("RolandTR909_hh*8").gain(0.35))',
        bass: null,
        melody: null,
        voice: null,
        fx: null,
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
  "thought": "Techno: Industrial 4/4 kick, clap on 2&4, driving 16th hi-hats, dark minor-key bass. Key: C minor.",
  "tracks": {
    "drums": "stack(s('RolandTR909_bd*4').gain(1), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.8), s('RolandTR909_hh*16').gain(0.35), s('~ RolandTR909_oh ~ RolandTR909_oh').gain(0.22))",
    "bass": "note(m('c1 ~ c1 ~ eb1 ~ g1 ~')).s('sawtooth').att(0.01).decay(0.2).lpf(sine.range(220, 650).slow(4)).resonance(10).gain(0.7)",
    "melody": "note(m('<c4 eb4 g4> ~ ~ <c4 eb4 g4>')).s('supersaw').att(0.01).decay(0.18).lpf(2600).room(0.25).delay(0.15).gain(0.35).slow(2)",
    "voice": null,
    "fx": "s('pink').hpf(sine.range(200, 12000).slow(8)).gain(sine.range(0.1, 0.4).slow(8))"
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
    "voice": "stack(note(m(\\"<c4 e4 g4> <g4 b4 d5> <a4 c5 e5> <f4 a4 c5>\\")).s(\\"sawtooth\\").vowel(\\"a\\").slow(8).room(0.95).delay(0.4).gain(0.4), note(m(\\"<e4 g4 b4> <c5 e5 g5>\\")).s(\\"sine\\").vowel(\\"o\\").slow(16).room(0.9).gain(0.3), note(m(\\"c5 e5 g5 c6\\")).s(\\"triangle\\").vowel(\\"e\\").slow(4).room(0.8).lpf(3000).gain(0.25))",
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
        const { prompt, currentCode, frequencyData } = await req.json();

        if (!prompt) {
            return jsonWithCors({ error: 'Prompt is required' }, { status: 400 });
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
                        sanitizedTracks[key] = sanitizeGeneratedCode(value);
                    } else {
                        sanitizedTracks[key] = null;
                    }
                }
                console.log('[YouTube] Sanitized tracks:', JSON.stringify(sanitizedTracks, null, 2));

                return jsonWithCors({
                    type: 'update_tracks',
                    tracks: enforceAtLeastOne(sanitizedTracks),
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

        if (!process.env.OPENROUTER_API_KEY) {
            console.error('[API/Agent] OPENROUTER_API_KEY not found in environment');
            return jsonWithCors({
                error: 'OpenRouter API Key is missing. Please configure OPENROUTER_API_KEY in your deployment environment variables.'
            }, { status: 500 });
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

        // Read knowledge.md to augment the system prompt
        let knowledgeBase = '';
        try {
            const knowledgePath = path.join(process.cwd(), 'knowledge.md');
            if (fs.existsSync(knowledgePath)) {
                knowledgeBase = fs.readFileSync(knowledgePath, 'utf-8');
            }
        } catch (err) {
            console.error('[API/Agent] Failed to read knowledge.md:', err);
        }

        const augmentedSystemPrompt = `${SYSTEM_PROMPT}

## EXTENDED KNOWLEDGE BASE (REFERENCE)
${knowledgeBase}
`;

        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: augmentedSystemPrompt },
                {
                    role: "user",
                    content: `Current Code:
${currentCode || '// No code yet'}${audioContext}

User Request: ${prompt}`
                }
            ],
            temperature: 0.7,
            max_tokens: 1000,
        });

        const raw = completion.choices[0].message.content?.trim() || '';
        console.log('[API/Agent] Raw AI response:', raw);

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
                // Sanitize each track
                const sanitizedTracks: Record<string, string | null> = {};
                for (const [key, value] of Object.entries(parsed.tracks)) {
                    if (value && typeof value === 'string') {
                        sanitizedTracks[key] = sanitizeGeneratedCode(value);
                    } else {
                        sanitizedTracks[key] = null;
                    }
                }
                // Enforce user intent: only keep tracks explicitly requested (unless none specified)
                const anyIntent = wants.drums || wants.bass || wants.melody || wants.voice || wants.fx;
                if (anyIntent) {
                    if (!wants.drums) sanitizedTracks.drums = null;
                    if (!wants.bass) sanitizedTracks.bass = null;
                    if (!wants.melody) sanitizedTracks.melody = null;
                    if (!wants.voice) sanitizedTracks.voice = null;
                    if (!wants.fx) sanitizedTracks.fx = null;
                }

                const bpm = coerceBpmValue(parsed.bpm) ?? extractBpmFromPrompt(prompt);
                return jsonWithCors({
                    type: 'update_tracks',
                    ...(bpm !== null ? { bpm } : {}),
                    tracks: enforceAtLeastOne(sanitizedTracks),
                    thought: parsed.thought || ''
                });
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
        const isConversational = /^(really\??|what\??|huh\??|ok|okay|nice|cool|thanks?|thank you|wow|amazing|lol|haha|yes|no|yep|nope|sure|great|awesome|perfect|sounds? good|love it|i like it|why\??)$/i.test(promptLower);

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
        const looksLikeRawCode = /^(stack\(|note\(|s\(|sound\(|m\(|\(\s*\(\s*\)\s*=>)/i.test(raw.trim());
        if (looksLikeRawCode) {
            console.log('[API/Agent] Detected raw Strudel code, treating as single-track code output');
            const sanitizedCode = sanitizeGeneratedCode(raw);
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

            return jsonWithCors({
                type: 'update_tracks',
                tracks: enforceAtLeastOne(detectedTracks),
                thought: 'Generated pattern from AI response'
            });
        }

        // Detect user intent from prompt and generate a reasonable response
        const p = prompt.toLowerCase();
        let fallbackTracks: Record<string, string | null> = {
            drums: null,
            bass: null,
            melody: null,
            voice: null,
            fx: null
        };
        let thought = 'Generated fallback music based on your request.';

        if (/love|romantic|ballad|sweet|tender|heart/i.test(p)) {
            thought = 'Creating a romantic love song with soft chords, gentle melody, and dreamy atmosphere.';
            fallbackTracks = {
                drums: null,
                bass: 'note(m("c2 ~ g2 ~ a2 ~ g2 ~")).s("triangle").sustain(0.5).lpf(400).gain(0.6).slow(2)',
                melody: 'note(m("<c4 e4 g4> <a3 c4 e4> <f3 a3 c4> <g3 b3 d4>")).s("sine").slow(4).room(0.7).delay(0.3).gain(0.5)',
                voice: null,
                fx: 'note(m("<c5 g5> <e5 b5>")).s("sine").slow(8).room(0.95).delay(0.5).lpf(1200).gain(0.3)'
            };
        } else if (/techno|beat|dance|club|party/i.test(p)) {
            thought = 'Creating an energetic techno beat with punchy drums and driving bass.';
            fallbackTracks = {
                drums: 'stack(note(m("c2*4")).s("square").decay(0.08).lpf(150).gain(0.95), note(m("~ c3 ~ c3")).s("square").hpf(500).decay(0.05).room(0.2), note(m("c5*16")).s("pink").hpf(8000).decay(0.015).gain(0.4))',
                bass: 'note(m("c2 c2 ~ c2 eb2 ~ c2 ~")).s("sawtooth").lpf(sine.range(300, 900).slow(8)).decay(0.15).gain(0.75)',
                melody: null,
                voice: null,
                fx: null
            };
        } else if (/chill|relax|ambient|calm|peaceful/i.test(p)) {
            thought = 'Creating a chill ambient atmosphere with soft pads and gentle textures.';
            fallbackTracks = {
                drums: null,
                bass: null,
                melody: 'note(m("<c4 e4 g4> <d4 f4 a4>")).s("sine").slow(4).room(0.8).delay(0.4).gain(0.4)',
                voice: null,
                fx: 'note(m("<c5 g5> <e5 b5>")).s("sine").slow(8).room(0.95).delay(0.5).lpf(1200).gain(0.35)'
            };
        } else {
            // Generic musical response - create something nice
            thought = 'Creating a musical pattern based on your request.';
            fallbackTracks = {
                drums: 'note(m("c2*4")).s("square").decay(0.08).lpf(150).gain(0.8)',
                bass: 'note(m("c2 ~ eb2 ~ g2 ~")).s("triangle").sustain(0.3).slow(2)',
                melody: 'note(m("c4 e4 g4 b4")).s("sawtooth").slow(2).room(0.3).gain(0.5)',
                voice: null,
                fx: null
            };
        }

        return jsonWithCors({
            type: 'update_tracks',
            tracks: enforceAtLeastOne(fallbackTracks),
            thought
        });

    } catch (error: unknown) {
        console.error('[API/Agent] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to generate code';
        return jsonWithCors(
            { error: message || 'Failed to generate code' },
            { status: 500 }
        );
    }
}
