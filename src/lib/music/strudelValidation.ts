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

export function looksLikeSafeStrudelTrack(value: string | null): boolean {
    if (!value || typeof value !== 'string') return true;
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed === 'silence') return true;
    if (!SAFE_TRACK_START.test(trimmed)) return false;
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

export function validateGeneratedTracks(tracks: TrackMap, prompt: string, currentCode?: string): ValidationResult {
    const issues: TrackValidationIssue[] = [];

    for (const [rawTrackId, value] of Object.entries(tracks)) {
        const trackId = rawTrackId as InstrumentType;
        if (!looksLikeSafeStrudelTrack(value)) {
            issues.push({ trackId, reason: 'unsafe or unsupported Strudel code' });
        }
    }

    const template = getTemplateForPrompt(prompt, currentCode);
    issues.push(...validateTemplateRequirements(tracks, template, prompt));

    return {
        valid: issues.length === 0,
        issues,
    };
}
