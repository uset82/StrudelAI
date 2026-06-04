import { InstrumentType } from '@/types/sonic';
import {
    GenreTemplate,
    TrackMap,
    detectGenre,
    getTemplateForPrompt,
    isBroadMusicRequest,
    isDrumOnlyPrompt,
    isHumanizePrompt,
    isRepairPrompt,
} from './genreTemplates';
import type { MusicIntent } from './musicIntent';

export type TrackValidationIssue = {
    trackId: InstrumentType;
    reason: string;
};

export type ValidationResult = {
    valid: boolean;
    issues: TrackValidationIssue[];
};

const SAFE_TRACK_START = /^(stack|note|s|sound|sample|seq|cat|silence|m)\s*\(/i;
const UNSUPPORTED_METHODS = [
    /\.bank\s*\(/i,
    /\.slider\s*\(/i,
    /\._pianoroll\s*\(/i,
    /\.analyze\s*\(/i,
    /\banalyze\s*\(/i,
    /\bsetcpm\s*\(/i,
    /\.cpm\s*\(/i,
    /\bcpm\s*\(/i,
];
const UNSAFE_TIME_FACTORS = /\.(?:fast|slow)\(\s*(?!0\.5\s*\)|1\s*\)|2\s*\)|4\s*\)|8\s*\)|16\s*\))(-?\d+(?:\.\d+)?)\s*\)/i;
const KNOWN_SAMPLE_TOKEN = /^(?:~|RolandTR(?:808|909)_(?:bd|sd|cp|hh|oh|rd|rim|cb|perc)|bd|sd|sn|cp|hh|oh|rim|kick|snare|clap|hat|hihat)$/i;

function hasBalancedDelimiters(value: string) {
    const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{', '>': '<' };
    const openers = new Set(Object.values(pairs));
    const stack: string[] = [];
    let quote: string | null = null;

    for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        const prev = i > 0 ? value[i - 1] : '';
        if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\') {
            quote = quote === ch ? null : quote || ch;
            continue;
        }
        if (quote) continue;
        if (openers.has(ch)) {
            stack.push(ch);
            continue;
        }
        if (pairs[ch]) {
            if (stack.pop() !== pairs[ch]) return false;
        }
    }
    return !quote && stack.length === 0;
}

function hasValidVowels(value: string) {
    const matches = value.matchAll(/\.vowel\(\s*(['"])(.*?)\1\s*\)/gi);
    for (const match of matches) {
        if (!/^[aeiou]$/i.test(match[2].trim())) return false;
    }
    return true;
}

function sampleTokensLookKnown(value: string) {
    const sampleCalls = value.matchAll(/\bs\(\s*(['"])(.*?)\1\s*\)/gi);
    for (const call of sampleCalls) {
        const body = call[2];
        if (/^(?:sine|square|triangle|sawtooth|supersaw|pink|piano)$/i.test(body.trim())) continue;
        const tokens = body
            .replace(/[\[\]<>(),!*?/]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
        for (const token of tokens) {
            if (/^\d+$/.test(token)) continue;
            if (!KNOWN_SAMPLE_TOKEN.test(token)) return false;
        }
    }
    return true;
}

export function looksLikeSafeStrudelTrack(value: string | null): boolean {
    if (!value || typeof value !== 'string') return true;
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed === 'silence') return true;
    if (!SAFE_TRACK_START.test(trimmed)) return false;
    if (!hasBalancedDelimiters(trimmed)) return false;
    if (!hasValidVowels(trimmed)) return false;
    if (!sampleTokensLookKnown(trimmed)) return false;
    if (UNSUPPORTED_METHODS.some((pattern) => pattern.test(trimmed))) return false;
    if (UNSAFE_TIME_FACTORS.test(trimmed)) return false;
    return true;
}

function trackHasPattern(value: string | null) {
    return typeof value === 'string' && value.trim().length > 0;
}

function includesAny(value: string, patterns: RegExp[]) {
    return patterns.some((pattern) => pattern.test(value));
}

function numericMethodValues(value: string, method: string) {
    const matches = value.matchAll(new RegExp(`\\.${method}\\(\\s*(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))\\s*\\)`, 'gi'));
    return Array.from(matches)
        .map((match) => Number(match[1]))
        .filter(Number.isFinite);
}

function validateTemplateRequirements(tracks: TrackMap, template: GenreTemplate, prompt: string): TrackValidationIssue[] {
    const issues: TrackValidationIssue[] = [];

    if (isDrumOnlyPrompt(prompt)) {
        if (!trackHasPattern(tracks.drums)) {
            issues.push({ trackId: 'drums', reason: 'drum-only requests require a drums track' });
        }

        for (const trackId of ['bass', 'melody', 'voice', 'fx'] as const) {
            const value = tracks[trackId]?.trim();
            if (value && value !== 'silence') {
                issues.push({ trackId, reason: 'drum-only requests must not include tonal or FX tracks' });
            }
        }

        return issues;
    }

    for (const trackId of template.requiredTracks) {
        if (!trackHasPattern(tracks[trackId])) {
            issues.push({ trackId, reason: `${template.id} requires ${trackId}` });
        }
    }

    const joined = Object.values(tracks).filter(Boolean).join(' ').toLowerCase();
    const genre = detectGenre(prompt);

    const shouldRequireFullGenre = isBroadMusicRequest(prompt) || isRepairPrompt(prompt) || isHumanizePrompt(prompt);

    if (shouldRequireFullGenre && (genre === 'rock' || genre === 'punk' || genre === 'metal' || template.id === 'clean_rock' || template.id === 'humanized_rock')) {
        if (!trackHasPattern(tracks.drums) || !trackHasPattern(tracks.bass) || !trackHasPattern(tracks.melody)) {
            issues.push({ trackId: 'melody', reason: 'rock-family requests need drums, bass, and riff/chord melody tracks' });
        }
        if (!includesAny(joined, [/distort\(/, /sawtooth/, /power/, /e1|e2|a1|a2|g1|g2/])) {
            issues.push({ trackId: 'melody', reason: 'rock-family output needs a guitar-like riff or power-chord texture' });
        }
        if (includesAny(joined, [/rolandtr909_bd\*4.*rolandtr909_hh\*16.*resonance\(1[0-9]/])) {
            issues.push({ trackId: 'drums', reason: 'rock-family output looks like generic techno' });
        }

        if (genre === 'rock' || template.id === 'clean_rock' || template.id === 'humanized_rock') {
            const melody = (tracks.melody || '').toLowerCase();
            const excessiveDistortion = numericMethodValues(melody, 'distort').some((value) => value > 0.18);
            if (excessiveDistortion) {
                issues.push({ trackId: 'melody', reason: 'rock guitar distortion should stay controlled at 0.18 or lower' });
            }
        }
    }

    if (genre === 'ambient' && trackHasPattern(tracks.drums)) {
        issues.push({ trackId: 'drums', reason: 'ambient should not force drums unless requested' });
    }

    if (genre === 'dnb') {
        const drums = tracks.drums || '';
        if (!/\*16|rolandtr909_hh\*16|~ ~/.test(drums.toLowerCase())) {
            issues.push({ trackId: 'drums', reason: 'DnB needs fast subdivisions or a broken beat' });
        }
    }

    if (isRepairPrompt(prompt)) {
        const harshSignals = (joined.match(/distort\((?:0\.[4-9]|1|[2-9])/g) || []).length;
        const loudSignals = (joined.match(/gain\((?:0\.[8-9]|1|[2-9])/g) || []).length;
        if (harshSignals > 1 || loudSignals > 3) {
            issues.push({ trackId: 'fx', reason: 'repair prompts should reduce harshness and gain' });
        }
    }

    if (isHumanizePrompt(prompt)) {
        if (!/[~].*[a-g]|rolandtr909_bd ~ ~|~ [a-g0-9_]+ [a-g0-9_]+/i.test(joined)) {
            issues.push({ trackId: 'drums', reason: 'humanized requests need controlled syncopation, not a fully even loop' });
        }
    }

    return issues;
}

function validateIntentRequirements(tracks: TrackMap, prompt: string, intent: MusicIntent): TrackValidationIssue[] {
    const issues: TrackValidationIssue[] = [];

    if (intent.kind === 'tempo_change') {
        return issues;
    }

    const expectsDrumOnly = (
        intent.targetTracks.length === 1 &&
        intent.targetTracks[0] === 'drums' &&
        (
            intent.kind === 'track_only' ||
            intent.kind === 'modify_current_track' ||
            intent.kind === 'style_reference' ||
            intent.kind === 'repair_current_context' ||
            intent.clearTracks.some((trackId) => trackId !== 'drums')
        )
    );

    if (expectsDrumOnly) {
        if (!trackHasPattern(tracks.drums) || tracks.drums === 'silence') {
            issues.push({ trackId: 'drums', reason: 'drum-only intent requires a drums track' });
        }

        for (const trackId of ['bass', 'melody', 'voice', 'fx'] as const) {
            const value = tracks[trackId]?.trim();
            if (value && value !== 'silence') {
                issues.push({ trackId, reason: 'drum-only intent must not include tonal or FX tracks' });
            }
        }

        if (intent.templateId === 'pop_punk_drums') {
            const drums = tracks.drums || '';
            if (!/\*16|\[[^\]]+\]|c6\*16/i.test(drums)) {
                issues.push({ trackId: 'drums', reason: 'pop-punk drum reference needs fast hats or energetic subdivisions' });
            }
            if (!/(?:RolandTR(?:808|909)_bd|\bbd\b|kick)/i.test(drums) ||
                !/(?:RolandTR(?:808|909)_sd|\bsd\b|snare)/i.test(drums) ||
                !/(?:RolandTR(?:808|909)_hh|\bhh\b|hat)/i.test(drums)) {
                issues.push({ trackId: 'drums', reason: 'pop-punk drum reference needs sample-safe kick, snare, and hat roles' });
            }
        }

        if (intent.kind === 'repair_current_context') {
            const joined = Object.values(tracks).filter(Boolean).join(' ').toLowerCase();
            const harshSignals = (joined.match(/distort\((?:0\.[4-9]|1|[2-9])/g) || []).length;
            const loudSignals = (joined.match(/gain\((?:0\.[8-9]|1|[2-9])/g) || []).length;
            if (harshSignals > 0 || loudSignals > 2) {
                issues.push({ trackId: 'drums', reason: 'drum repair should reduce harshness and loud layers' });
            }
        }

        return issues;
    }

    if (intent.kind === 'track_only' || intent.kind === 'modify_current_track' || intent.kind === 'style_reference') {
        for (const trackId of intent.targetTracks) {
            if (!trackHasPattern(tracks[trackId]) || tracks[trackId] === 'silence') {
                issues.push({ trackId, reason: `${intent.kind} requires ${trackId}` });
            }
        }
        return issues;
    }

    return validateTemplateRequirements(tracks, getTemplateForPrompt(prompt), prompt);
}

function validateTrackRoles(tracks: TrackMap): TrackValidationIssue[] {
    const issues: TrackValidationIssue[] = [];
    const drums = (tracks.drums || '').toLowerCase();
    const bass = (tracks.bass || '').toLowerCase();
    const melody = (tracks.melody || '').toLowerCase();
    const fx = (tracks.fx || '').toLowerCase();

    if (drums && drums !== 'silence') {
        const hasDrumRole = /rolandtr(?:808|909)_(?:bd|sd|cp|hh|oh)|\b(?:bd|sd|sn|cp|hh|kick|snare|clap|hat)\b|\.s\(['"](?:square|pink)['"]\)/i.test(drums);
        const tonalSynthDrums = /\b(?:sawtooth|supersaw|triangle|piano|sine)\b/.test(drums) && /<[a-g][^>]*[a-g]|[a-g][4-7]/i.test(drums);
        if (!hasDrumRole || tonalSynthDrums) {
            issues.push({ trackId: 'drums', reason: 'drums track must contain kick/snare/hat roles, not tonal melodic synth material' });
        }
    }

    if (bass && bass !== 'silence') {
        const lowNotes = (bass.match(/\b[a-g](?:#|b)?[01]\b/gi) || []).length;
        const highNotes = (bass.match(/\b[a-g](?:#|b)?[4-7]\b/gi) || []).length;
        if (highNotes > lowNotes && !/\b(?:c2|d2|e2|f2|g2|a2|b2)\b/i.test(bass)) {
            issues.push({ trackId: 'bass', reason: 'bass track should live mostly in low registers' });
        }
        if (/hpf\((?:[89]\d{2}|[1-9]\d{3,})\)/i.test(bass)) {
            issues.push({ trackId: 'bass', reason: 'bass track should not be high-passed like a lead' });
        }
    }

    if (melody && melody !== 'silence') {
        const lowOnly = /\b[a-g](?:#|b)?[01]\b/i.test(melody) && !/\b[a-g](?:#|b)?[2-6]\b/i.test(melody);
        if (lowOnly && /lpf\((?:[1-4]\d{2})\)/i.test(melody)) {
            issues.push({ trackId: 'melody', reason: 'melody track looks like bass-only material' });
        }
    }

    if (fx && fx !== 'silence') {
        const isTexture = /pink|noise|room\(|delay\(|hpf\(|lpf\(|sweep|riser|slow\((?:4|8|16)\)/i.test(fx);
        const denseTonal = (fx.match(/\b[a-g](?:#|b)?[1-7]\b/gi) || []).length > 8 && !isTexture;
        if (denseTonal) {
            issues.push({ trackId: 'fx', reason: 'fx track should be texture, space, or transition material, not dense melody' });
        }
    }

    return issues;
}

export function validateGeneratedTracks(
    tracks: TrackMap,
    prompt: string,
    currentCode?: string,
    intent?: MusicIntent,
): ValidationResult {
    const issues: TrackValidationIssue[] = [];

    for (const [rawTrackId, value] of Object.entries(tracks)) {
        const trackId = rawTrackId as InstrumentType;
        if (!looksLikeSafeStrudelTrack(value)) {
            issues.push({ trackId, reason: 'unsafe or unsupported Strudel code' });
        }
    }

    if (intent) {
        issues.push(...validateIntentRequirements(tracks, prompt, intent));
    } else {
        const template = getTemplateForPrompt(prompt, currentCode);
        issues.push(...validateTemplateRequirements(tracks, template, prompt));
    }

    issues.push(...validateTrackRoles(tracks));

    return {
        valid: issues.length === 0,
        issues,
    };
}
