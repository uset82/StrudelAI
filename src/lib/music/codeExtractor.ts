import { TrackMap } from './genreTemplates';

export const coerceBpmValue = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded < 40 || rounded > 240) return null;
    return rounded;
};

export const extractBpmFromPrompt = (prompt: string): number | null => {
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

export const extractCodeFromMarkdown = (text: string): string | null => {
    // Try ```strudel or ```js or ``` blocks
    const codeBlockMatch = text.match(/```(?:strudel|js|javascript)?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();
    // Try indented code blocks
    const lines = text.split('\n');
    const codeLines = lines.filter(l => /^\s{2,}|^>\s/.test(l) || /^(stack|note|s|sound|m|silence|sample)\(/.test(l.trim()));
    if (codeLines.length > 0) return codeLines.map(l => l.trim()).join('\n');
    return null;
};

export const stripMarkdown = (text: string): string => {
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')  // bold
        .replace(/\*([^*]+)\*/g, '$1')       // italic
        .replace(/`([^`]+)`/g, '$1')         // inline code
        .replace(/^#{1,6}\s+/gm, '')         // headers
        .replace(/^\s*[-*]\s+/gm, '')        // bullets
        .replace(/^\s*\d+\.\s+/gm, '')       // numbered lists
        .trim();
};

export const coerceLooseLines = (src: string) => {
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

export const balanceDelimiters = (src: string) => {
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

export function cleanStrudelCode(code: string): string {
    if (!code || typeof code !== 'string') return code;
    let output = code.trim();

    // Remove surrounding quotes if the whole thing is quoted
    if ((output.startsWith('"') && output.endsWith('"')) ||
        (output.startsWith("'") && output.endsWith("'")) ||
        (output.startsWith('`') && output.endsWith('`'))) {
        output = output.slice(1, -1).trim();
    }

    // This ensures no redundant nesting and produces copy-pasteable clean code.
    output = sanitizeGeneratedCode(output);
    return output;
}

export const sanitizeGeneratedCode = (input: string) => {
    let output = input.trim();

    // Early strip of redundant outer wrapper parens from bad generators (prevents ((( nesting))
    output = output.replace(/^\(+/, '');

    // Strip surrounding quotes around the entire code string if present (e.g. "stack(...)")
    if ((output.startsWith('"') && output.endsWith('"')) ||
        (output.startsWith("'") && output.endsWith("'")) ||
        (output.startsWith('`') && output.endsWith('`'))) {
        output = output.slice(1, -1).trim();
    }

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

    // Normalize vowel arguments to valid vowels
    output = output.replace(/\.vowel\(\s*(["'`])([^"'`]+)\1\s*\)/gi, (_match, quote, content) => {
        const sanitizedTokenContent = content.replace(/[a-z]+/gi, (token: string) => {
            if (/^[aeiou]$/i.test(token)) return token.toLowerCase();
            const match = token.match(/[aeiou]/i);
            return match ? match[0].toLowerCase() : 'a';
        });

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
    // Strip leading commas at line starts
    output = output.replace(/(^|\r?\n)\s*,\s*/g, '$1');

    // Clean up dangling commas left by removals
    output = output.replace(/,\s*(?=[\)\}])/g, '');

    // Fix function calls with leading commas
    output = output.replace(/\(\s*,/g, '(');
    output = output.replace(/stack\(\s*,/g, 'stack(');

    output = coerceLooseLines(output.trim());

    // Final safety check for leading commas after coercion
    output = output.replace(/\(\s*,/g, '(');

    // Fix run-on code
    const runOnMatch = output.match(/\)\s*(stack|note|s|sound|n|seq|cat)\(/);
    if (runOnMatch && runOnMatch.index) {
        output = output.substring(0, runOnMatch.index + 1);
    }

    // Fix missing commas between patterns
    output = output.replace(/\)\s+(stack|note|s|sound|n|seq|cat|m)/g, '), $1');

    output = balanceDelimiters(output);

    const strudelGlobals = 'note, m, s, n, stack, silence, sound, sample, seq, cat, sine, saw, tri, square, pink, noise, cosine, rand';
    try {
        new Function(strudelGlobals, `return ${output}`);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes('missing )') || message.includes('Unexpected end') || message.includes('Unexpected token')) {
            let fixed = output;
            fixed = fixed.replace(/\.\w+\([^)]*$/g, '');
            fixed = balanceDelimiters(fixed);
            try {
                new Function(strudelGlobals, `return ${fixed}`);
                output = fixed;
            } catch {
                const lastCompleteStack = fixed.lastIndexOf(')');
                if (lastCompleteStack > 0) {
                    fixed = fixed.substring(0, lastCompleteStack + 1);
                    fixed = balanceDelimiters(fixed);
                    try {
                        new Function(strudelGlobals, `return ${fixed}`);
                        output = fixed;
                    } catch {
                        // proceed
                    }
                }
            }
        }
    }

    return output;
};

export function parseStrudelCodeToTracks(code: string): Record<string, string | null> {
    const tracks: Record<string, string | null> = {
        drums: null,
        bass: null,
        melody: null,
        voice: null,
        fx: null,
    };

    const lines = code.split('\n');
    let currentSection = '';
    let currentCode: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

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
            continue;
        } else if (trimmed && currentSection) {
            currentCode.push(trimmed);
        } else if (trimmed && !currentSection) {
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

    if (currentSection && currentCode.length > 0) {
        tracks[currentSection] = currentCode.join('\n').replace(/^\$:\s*/, '').trim();
    }

    return tracks;
}

export const toTrackMap = (tracks: Record<string, string | null>): TrackMap => ({
    drums: tracks.drums ?? null,
    bass: tracks.bass ?? null,
    melody: tracks.melody ?? null,
    voice: tracks.voice ?? null,
    fx: tracks.fx ?? null,
});
