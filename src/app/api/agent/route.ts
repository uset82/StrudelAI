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

// Check if MusicGen is requested
function detectMusicGenRequest(prompt: string): { shouldGenerate: boolean; type?: string; description?: string } {
    const p = prompt.toLowerCase();

    // Keywords that suggest user wants AI-generated real audio
    const musicGenTriggers = [
        /\b(generate|create|make)\s+(real|actual|ai)\s+(music|audio|sound)/i,
        /\b(musicgen|ai\s+music|neural\s+audio)/i,
        /\bgenerate\s+a?\s*(sample|loop|beat)/i,
        /\b(real|actual)\s+(drums?|bass|melody|voice|choir|pad)/i,
        /\bai\s+(drums?|bass|melody|synth)/i,
    ];

    for (const trigger of musicGenTriggers) {
        if (trigger.test(p)) {
            // Determine what type of stem to generate
            let type = 'drums';
            if (/bass/i.test(p)) type = 'bass';
            else if (/melody|lead|synth/i.test(p)) type = 'melody';
            else if (/voice|vocal|choir|angel/i.test(p)) type = 'voice';
            else if (/pad|ambient|fx|atmosphere/i.test(p)) type = 'fx';

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
    for (const ch of src) {
        if (ch === '(') openParens++;
        else if (ch === ')') openParens = Math.max(0, openParens - 1);
        else if (ch === '[') openBrackets++;
        else if (ch === ']') openBrackets = Math.max(0, openBrackets - 1);
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

const sanitizeGeneratedCode = (input: string) => {
    let output = input;

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

    // Replace sample-based drum sounds with synthesized equivalents
    output = output.replace(/s\(\s*["']bd["']\s*\)/gi, 'note("c2").s("square").decay(0.08).lpf(150)');
    output = output.replace(/s\(\s*["']sd["']\s*\)/gi, 'note("c3").s("square").hpf(400).decay(0.06)');
    output = output.replace(/s\(\s*["']hh["']\s*\)/gi, 'note("c6").s("pink").hpf(8000).decay(0.02)');
    output = output.replace(/s\(\s*["']cp["']\s*\)/gi, 'note("c4").s("pink").hpf(1000).decay(0.05)');

    // Normalize vowel arguments to valid vowels
    // Allow sequences but filter out invalid words
    output = output.replace(/\.vowel\(\s*(["'`])([^"'`]+)\1\s*\)/gi, (_match, quote, content) => {
        // Replace any word-like token that isn't a vowel with 'a' (or 'o' if it looks like one?)
        // Actually, let's just default to 'a' for simplicity, or try to map.
        // But for "zorro", "o" is better.

        const cleanContent = content.replace(/[a-z]+/gi, (token: string) => {
            if (/^[aeiou]$/i.test(token)) return token.toLowerCase();
            // If invalid, try to find a vowel inside, else 'a'
            const match = token.match(/[aeiou]/i);
            return match ? match[0].toLowerCase() : 'a';
        });

        // Clean up multiple spaces
        return `.vowel("${cleanContent.replace(/\s+/g, ' ').trim()}")`;
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

    // Verify syntax
    try {
        // We use a simple function constructor to check for syntax errors
        // This doesn't execute the code, just parses it
        new Function(output);
    } catch (e: any) {
        console.warn('[Sanitizer] Generated code has syntax error:', e.message);
        // Attempt one last desperate fix: ensure it ends with )
        if (e.message.includes('missing )') && !output.endsWith(')')) {
            output += ')';
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
        drums: 'note(m("c3*4")).s("square").decay(0.05).fast(2)',
        bass: null,
        melody: null,
        voice: null,
        fx: null,
    };
};

const SYSTEM_PROMPT = `You are a virtuoso live-coding music assistant powered by Strudel (a port of TidalCycles to JavaScript).
You are performing at a LIVE CODING FESTIVAL. Your goal is to BUILD UP a track layer by layer.

## CRITICAL RULES
1. **LAYER, DON'T REPLACE**: Output code in a STRUCTURED format, separating Drums, Bass, Melody, Voice, and FX.
2. **PRESERVE EXISTING CODE**: Never delete the user's previous patterns unless explicitly asked.
3. **MUSICAL COHERENCE**: Match the Key. If adding bass, check existing melody notes.
4. **VALID VOWELS ONLY**: For .vowel(), ONLY use: "a", "e", "i", "o", "u". NEVER use words like "zorro", "robot", etc.

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
     "tracks": {
       "drums": "code or null",
       "bass": "code or null",
       "melody": "code or null",
       "voice": "code or null",
       "fx": "code or null"
     }
   }

## SOUND SOURCES (SYNTHETIC ONLY)
Available waveforms: "square", "triangle", "sawtooth", "sine", "supersaw", "pink"

## BASIC PATTERNS

Drums:
- Kick: note(m("c2*4")).s("square").decay(0.08).lpf(150)
- Snare: note(m("~ c3 ~ c3")).s("square").hpf(400).decay(0.06)
- Hi-hat: note(m("c5*8")).s("pink").hpf(6000).decay(0.02).gain(0.5)
- Euclidean: note(m("c3(3,8)")).s("square").decay(0.1)

Bass:
- Simple: note(m("c2 ~ eb2 ~ g2 ~")).s("triangle").sustain(0.3)
- Rolling: note(m("c1 c1 ~ c1")).s("sawtooth").lpf(400).gain(0.8)

Melody/Lead:
- Arp: note(m("c4 e4 g4 b4")).s("sawtooth").slow(2).room(0.3)
- Chord: note(m("<c4 e4 g4> <d4 f4 a4>")).s("square").delay(0.25)

Voice (formant synthesis for vocal/choir sounds):
- Choir/Angel: note(m("c4 e4 g4")).s("sawtooth").vowel("a").slow(2).room(0.8).gain(0.5)
- Heavenly voices: note(m("<c4 e4 g4> <g4 b4 d5>")).s("sawtooth").vowel("o").slow(4).room(0.9).delay(0.3).gain(0.4)
- Robot: note(m("c3*4")).s("square").vowel("o").crush(4)

FX/Ambient:
- Pad: note(m("<c5 g5> <e5 b5>")).s("sine").slow(8).room(0.95).delay(0.5)

## MINI-NOTATION
- Space: sequential - "c3 e3 g3"
- ~: rest - "c3 ~ e3 ~"
- ,: parallel - "c3, e3, g3"
- []: subdivision - "c3 [e3 g3]"
- <>: alternation - "<c3 e3>"
- *: repeat - "c3*4"
- /: slowdown - "c3/2"
- (): Euclidean - "c3(3,8)"

## ALLOWED METHODS

Sound: .s("waveform"), .trans(-12), .add(7)
Envelope: .att(0.01), .decay(0.1), .sustain(0.5), .release(0.3)
Volume: .gain(0.8), .velocity(0.9)
Filters: .lpf(1000), .hpf(200), .bandf(800), .cutoff(500), .resonance(10)
Effects: .room(0.5), .delay(0.5), .distort(0.5), .crush(8), .phaser(4), .chorus(0.5)
Modulation: .tremolo(8), .leslie(5), .vowel("a") (ONLY a, e, i, o, u)
Spatial: .pan(0.5), .pan(sine.slow(4))
Time: .slow(2), .fast(2), .rev(), .jux(rev)
Probability: .sometimes(rev), .often(fast(2)), .degradeBy(0.3)
Stacking: stack(pattern1, pattern2, pattern3)

## PATTERN AUTOMATION
Parameters can be patterns: .lpf(sine.range(200, 2000).slow(4))

## EXAMPLES

Input: "make a hard techno beat"
Output: {
  "type": "update_tracks",
  "thought": "Hard techno needs punchy 4/4 kick, snappy clap, driving hi-hats.",
  "tracks": {
    "drums": "stack(note(m(\\"c2*4\\")).s(\\"square\\").decay(0.08).lpf(150).gain(0.95), note(m(\\"~ c3 ~ c3\\")).s(\\"square\\").hpf(500).decay(0.05).room(0.2), note(m(\\"c5*16\\")).s(\\"pink\\").hpf(8000).decay(0.015).gain(0.4))",
    "bass": null,
    "melody": null,
    "voice": null,
    "fx": null
  }
}

Input: "add a dark rolling bassline"
Output: {
  "type": "update_tracks",
  "thought": "Adding minor-key rolling bass with filter movement.",
  "tracks": {
    "drums": null,
    "bass": "note(m(\\"c2 c2 eb2 c2 g1 g1 c2 ~\\")).s(\\"sawtooth\\").lpf(sine.range(200, 800).slow(4)).gain(0.85)",
    "melody": null,
    "voice": null,
    "fx": null
  }
}

Input: "add angel voices" or "add heavenly choir"
Output: {
  "type": "update_tracks",
  "thought": "Adding ethereal angel choir using formant vowel synthesis with slow harmonic progression, heavy reverb for heavenly wash.",
  "tracks": {
    "drums": null,
    "bass": null,
    "melody": null,
    "voice": "note(m(\\"<c4 e4 g4> <g4 b4 d5>\\")).s(\\"sawtooth\\").vowel(\\"a\\").slow(4).room(0.9).delay(0.3).gain(0.45)",
    "fx": null
  }
}

Input: "add a robot voice"
Output: {
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

Input: "add atmosphere"
Output: {
  "type": "update_tracks",
  "thought": "Evolving ambient texture with heavy reverb and delay.",
  "tracks": {
    "drums": null,
    "bass": null,
    "melody": null,
    "voice": null,
    "fx": "note(m(\\"<c5 g5> <e5 b5>\\")).s(\\"sine\\").slow(8).room(0.95).delay(0.5).lpf(1200).gain(0.35)"
  }
}

Input: "give me some batucada" or "brazilian drums" or "samba beat" or "carnival rhythm" or "feel the rhythm" or "ANNA" or "Vintage Culture" or "techno samba"
Output: {
  "type": "update_tracks",
  "thought": "Creating Peak Time Techno + Afro-Brazilian fusion (Feel The Rhythm style by ANNA & Vintage Culture). Industrial 4/4 kick, surdo on beat 2, tamborim syncopation, 16th hi-hats, tribal toms, dark rolling bassline with filter sweep, and vowel chant FX. Key: C minor, BPM: 128.",
  "tracks": {
    "drums": "stack(note(m(\\"c1*4\\")).s(\\"square\\").decay(0.12).lpf(100).gain(1), note(m(\\"~ c3 ~ c3\\")).s(\\"square\\").hpf(800).decay(0.06).room(0.15).gain(0.7), note(m(\\"~ g1 ~ ~\\")).s(\\"triangle\\").decay(0.25).lpf(180).gain(0.8), note(m(\\"c5 ~ c5 c5 ~ c5 c5 ~\\")).s(\\"pink\\").hpf(4000).decay(0.02).gain(0.35), note(m(\\"c6*16\\")).s(\\"pink\\").hpf(8000).decay(0.015).gain(0.25), note(m(\\"~ ~ c3 ~ ~ c3 ~ c3\\")).s(\\"triangle\\").decay(0.1).lpf(400).gain(0.45).room(0.2))",
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
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
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
                return NextResponse.json({
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

                return NextResponse.json({
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
                return NextResponse.json({
                    type: 'chat',
                    message: `I detected the YouTube link but couldn't analyze it. Make sure the YouTube-to-Strudel server is running on port 5002. You can start it with: python tools/youtube_to_strudel.py --server`
                });
            }
        }

        if (!process.env.OPENROUTER_API_KEY) {
            return NextResponse.json({
                error: 'OpenRouter API Key is missing. Please add OPENROUTER_API_KEY to your .env file.'
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
                return NextResponse.json({ type: 'chat', message: parsed.message });
            }

            if (parsed.type === 'meta') {
                if (parsed.action === 'clear' || parsed.action === 'silence') {
                    return NextResponse.json({ type: 'code', code: 'silence' });
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

                return NextResponse.json({
                    type: 'update_tracks',
                    tracks: enforceAtLeastOne(sanitizedTracks),
                    thought: parsed.thought || ''
                });
            }

            if (parsed.type === 'code' && parsed.content) {
                const cleanedCode = sanitizeGeneratedCode(parsed.content);
                return NextResponse.json({ type: 'code', code: cleanedCode, thought: parsed.thought });
            }
        }

        // Fallback: reject unstructured responses
        console.warn('[API/Agent] No valid JSON response from model, returning guidance');
        return NextResponse.json({
            type: 'chat',
            message: 'I need to respond with structured JSON. Please try asking again with a clearer music request.'
        });

    } catch (error: unknown) {
        console.error('[API/Agent] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to generate code';
        return NextResponse.json(
            { error: message || 'Failed to generate code' },
            { status: 500 }
        );
    }
}
