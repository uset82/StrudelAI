import { InstrumentType } from '@/types/sonic';
import {
    GenreTemplate,
    TrackMap,
    detectGenre,
    detectSpecificSong,
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

/**
 * @deprecated Superseded by StrudelCodeAudioValidationAgent (in src/agents/StrudelCodeAudioValidationAgent).
 * Use validateStrudelCode instead for comprehensive AST, scale, sample, and audio validation.
 */
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

function isPlainRapOrHiphopPrompt(prompt: string) {
    return /\b(?:rap(?:per)?|hip-?hop|boom\s*bap|trap|eminem|eminen|slim\s+shady)\b/i.test(prompt) && !/\b(melod(?:y|ic)|hook|lead|topline|piano|sample)\b/i.test(prompt);
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

    if (genre === 'trance') {
        const bass = (tracks.bass || '').toLowerCase();
        const melody = (tracks.melody || '').toLowerCase();
        const fx = (tracks.fx || '').toLowerCase();
        if (!/supersaw/.test(melody) || !/a4|a5|c5|e5/.test(melody)) {
            issues.push({ trackId: 'melody', reason: 'trance needs a bright supersaw arp or chord-tone hook, not a generic melody' });
        }
        if (!/^note\(m\(['"]~\s+a1/i.test((tracks.bass || '').trim()) && !/offbeat|~ a1 ~ a1/i.test(bass)) {
            issues.push({ trackId: 'bass', reason: 'trance needs an offbeat saw bass role' });
        }
        if (!/pink|riser|hpf\(sine\.range|slow\(8|slow\(16/.test(fx)) {
            issues.push({ trackId: 'fx', reason: 'trance needs build/breakdown FX such as risers, downlifters, or long sweeps' });
        }
        if (/c2 ~ eb2 ~ g1|c4 eb4 g4 bb4/.test(Object.values(tracks).filter(Boolean).join(' ').toLowerCase())) {
            issues.push({ trackId: 'melody', reason: 'trance artist/genre prompts must not collapse to the generic C-minor fallback' });
        }
    }

    if (genre === 'reggae') {
        const drums = (tracks.drums || '').toLowerCase();
        const bass = (tracks.bass || '').toLowerCase();
        const melody = (tracks.melody || '').toLowerCase();
        if (/rolandtr909_bd\*4|rolandtr808_bd\*4/.test(drums)) {
            issues.push({ trackId: 'drums', reason: 'reggae needs a one-drop or laid-back pocket, not four-on-floor kick' });
        }
        if (!/~ ~ rolandtr808_bd|~ ~ rolandtr909_sd|rim|delay/.test(drums)) {
            issues.push({ trackId: 'drums', reason: 'reggae needs one-drop/rim/dub drum traits' });
        }
        if (!/g1|bb1|d2/.test(bass) || !/slow\(2\)|~ ~/.test(bass)) {
            issues.push({ trackId: 'bass', reason: 'reggae needs deep spacious roots bass with rests' });
        }
        if (!/~\s*<|delay\(/.test(melody)) {
            issues.push({ trackId: 'melody', reason: 'reggae needs offbeat skank chord chops with dub space' });
        }
    }

    if (genre === 'breakbeat_90s') {
        const drums = (tracks.drums || '').toLowerCase();
        const melody = (tracks.melody || '').toLowerCase();
        if (/rolandtr909_bd\*4/.test(drums)) {
            issues.push({ trackId: 'drums', reason: '90s breakbeat must not use a straight four-on-floor kick' });
        }
        if (!/rolandtr909_hh\*16|~ ~ rolandtr909_sd|rolandtr909_bd ~ ~ rolandtr909_bd/.test(drums)) {
            issues.push({ trackId: 'drums', reason: '90s breakbeat needs broken drums with fast hats' });
        }
        if (!/square|supersaw|crush|rave|<c4/.test(melody)) {
            issues.push({ trackId: 'melody', reason: '90s breakbeat needs rave stabs or short synth hits' });
        }
    }

    if (genre === 'spacesynth') {
        const joinedTracks = Object.values(tracks).filter(Boolean).join(' ').toLowerCase();
        if (/\.s\(['"]koto['"]\)/.test(joinedTracks)) {
            issues.push({ trackId: 'melody', reason: 'spacesynth must not use unsupported koto samples; emulate pluck with supported instruments' });
        }
        if (!/a1 a2|square/.test(joinedTracks)) {
            issues.push({ trackId: 'bass', reason: 'spacesynth needs retro octave square bass movement' });
        }
        if (!/piano|pentatonic|a4 c5 d5|delay\(/.test(joinedTracks)) {
            issues.push({ trackId: 'melody', reason: 'Koto-style spacesynth needs a supported plucked pentatonic lead' });
        }
        if (!/room\(0\.9|cosmic|pink|slow\(16/.test(joinedTracks)) {
            issues.push({ trackId: 'fx', reason: 'spacesynth needs a wide cosmic pad or FX bed' });
        }
    }

    if (genre === 'cinematic_electronic') {
        const joinedTracks = Object.values(tracks).filter(Boolean).join(' ').toLowerCase();
        if (!/crush\(|pink|square/.test(joinedTracks)) {
            issues.push({ trackId: 'drums', reason: 'cinematic relay/capacitor output needs electrical click/transient sound design' });
        }
        if (!/att\(0\.001\)|decay\(0\.03|decay\(0\.055/.test(joinedTracks)) {
            issues.push({ trackId: 'melody', reason: 'relay/capacitor sounds need fast attack/decay transient envelopes' });
        }
        if (!trackHasPattern(tracks.fx) || !/hpf\(sine\.range|room\(0\.65|slow\(16/.test((tracks.fx || '').toLowerCase())) {
            issues.push({ trackId: 'fx', reason: 'cinematic electronic needs wide tension FX, not only a dry loop' });
        }
    }

    if (genre === 'hiphop' && isPlainRapOrHiphopPrompt(prompt)) {
        const melody = tracks.melody || '';
        const highMelodyNotes = (melody.match(/\b[a-g](?:#|b)?[4-7]\b/gi) || []).length;
        if (melody.trim() && melody.trim() !== 'silence' && highMelodyNotes > 3) {
            issues.push({ trackId: 'melody', reason: 'plain rap requests should leave vocal space instead of adding a melodic lead line' });
        }
        if (!trackHasPattern(tracks.drums) || !trackHasPattern(tracks.bass)) {
            issues.push({ trackId: 'bass', reason: 'rap requests need drums and low bass as the core beat' });
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

const STANDARD_STEP_COUNTS = new Set([1, 2, 3, 4, 6, 8, 12, 16, 24, 32]);

function getPatternStepCount(pattern: string): number {
    let collapsed = pattern;
    let prev = '';
    while (collapsed !== prev) {
        prev = collapsed;
        collapsed = collapsed.replace(/\[[^\]]*\]/g, 'sub');
        collapsed = collapsed.replace(/<[^>]*>/g, 'alt');
        collapsed = collapsed.replace(/\([^)]*\)/g, 'euclid');
    }
    const tokens = collapsed.split(/\s+/).filter(Boolean);
    return tokens.length;
}

function extractMiniNotationPatterns(code: string): string[] {
    const patterns: string[] = [];
    const matches = code.matchAll(/\b(?:s|note|m|sound|sample)\(\s*(['"`])([\s\S]*?)\1\s*\)/gi);
    for (const match of matches) {
        patterns.push(match[2]);
    }
    return patterns;
}

function validateTrackRoles(tracks: TrackMap, prompt?: string): TrackValidationIssue[] {
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

    // Step count validation to catch AI loop division hallucinations (e.g. 10-step or 9-step patterns)
    const isSpecificSong = prompt ? detectSpecificSong(prompt) : false;
    if (!isSpecificSong) {
        for (const [rawTrackId, code] of Object.entries(tracks)) {
            const trackId = rawTrackId as InstrumentType;
            if (!code || code === 'silence') continue;

            const patterns = extractMiniNotationPatterns(code);
            for (const pattern of patterns) {
                const steps = getPatternStepCount(pattern);
                if (steps > 0 && !STANDARD_STEP_COUNTS.has(steps)) {
                    issues.push({
                        trackId,
                        reason: `${trackId} pattern has non-standard step count of ${steps} (pattern: "${pattern}"). Standard loop patterns must have 1, 2, 3, 4, 6, 8, 12, 16, 24, or 32 steps per cycle.`,
                    });
                }
            }
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

    issues.push(...validateTrackRoles(tracks, prompt));

    return {
        valid: issues.length === 0,
        issues,
    };
}
