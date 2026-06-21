import { InstrumentType, SonicSessionState } from '@/types/sonic';
import {
    GenreKey,
    detectGenre,
    isDoubleTapDrumPrompt,
    isDrumOnlyPrompt,
    isMichaelJacksonPrompt,
    isHumanizePrompt,
    isRepairPrompt,
} from './genreTemplates';

export type MusicIntentKind =
    | 'create_full_style'
    | 'track_only'
    | 'modify_current_track'
    | 'tempo_change'
    | 'repair_current_context'
    | 'style_reference';

export type MusicIntent = {
    kind: MusicIntentKind;
    targetTracks: InstrumentType[];
    preserveTracks: InstrumentType[];
    clearTracks: InstrumentType[];
    templateId: GenreKey | null;
    referenceStyle: string | null;
    currentBpm: number;
    nextBpm: number | null;
    isDrumOnly: boolean;
    reason: string;
};

export type MusicContext = {
    currentBpm: number;
    tracks: Record<InstrumentType, string | null>;
    activeTracks: InstrumentType[];
    isDrumOnly: boolean;
    currentCode: string;
    source: 'currentState' | 'currentCode' | 'empty';
};

const TRACK_IDS: InstrumentType[] = ['drums', 'bass', 'melody', 'voice', 'fx'];
const NON_DRUM_TRACKS: InstrumentType[] = ['bass', 'melody', 'voice', 'fx'];

const emptyTracks = (): Record<InstrumentType, string | null> => ({
    drums: null,
    bass: null,
    melody: null,
    voice: null,
    fx: null,
});

const normalizePrompt = (prompt: string) =>
    prompt
        .toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .trim();

const normalizeTrackPattern = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^expr:/i.test(trimmed)) return trimmed.replace(/^expr:\s*/i, '').trim() || null;
    return trimmed;
};

const hasAudiblePattern = (value: string | null) => {
    if (!value) return false;
    const trimmed = value.trim();
    return Boolean(trimmed) && trimmed !== 'silence' && trimmed !== 's("~")' && !trimmed.startsWith('//');
};

const inferTracksFromCode = (currentCode?: string | null): Record<InstrumentType, string | null> => {
    const tracks = emptyTracks();
    const code = normalizeTrackPattern(currentCode) || '';
    const cleaned = code
        .replace(/\.analyze\([^)]*\)/gi, '')
        .replace(/^stack\(([\s\S]*)\)$/i, '$1')
        .trim();

    if (!cleaned || cleaned === 'silence' || cleaned.startsWith('//')) return tracks;

    const lower = cleaned.toLowerCase();
    const drumSignals = /\b(rolandtr\d{3}_|bd|sd|snare|cp|clap|hh|hat|kick|cymbal)\b|c2|c4|c6/.test(lower);
    const tonalSignals = /\b[a-g](?:#|b)?[1-6]\b/.test(lower) && /sawtooth|triangle|sine|supersaw|piano/.test(lower);

    if (drumSignals && !tonalSignals) {
        tracks.drums = cleaned;
    } else if (tonalSignals && /c1|c2|bass|lpf\((?:1|2|3|4|5|6|7|8|9)\d{2}\)/.test(lower)) {
        tracks.bass = cleaned;
    } else {
        tracks.melody = cleaned;
    }

    return tracks;
};

export function buildMusicContext(input: {
    currentState?: Partial<SonicSessionState> | null;
    currentCode?: string | null;
} = {}): MusicContext {
    const currentBpm = Math.max(40, Math.min(240, Math.round(input.currentState?.bpm || 120)));
    const tracks = emptyTracks();
    let source: MusicContext['source'] = 'empty';

    if (input.currentState?.tracks) {
        source = 'currentState';
        for (const trackId of TRACK_IDS) {
            const rawTrack = input.currentState.tracks[trackId] as unknown;
            if (typeof rawTrack === 'string') {
                tracks[trackId] = normalizeTrackPattern(rawTrack);
                continue;
            }

            const track = rawTrack as Partial<SonicSessionState['tracks'][InstrumentType]> | null | undefined;
            const pattern = normalizeTrackPattern(track?.pattern);
            tracks[trackId] = track?.muted ? null : pattern;
        }
    }

    if (!TRACK_IDS.some((trackId) => hasAudiblePattern(tracks[trackId])) && input.currentCode) {
        source = 'currentCode';
        Object.assign(tracks, inferTracksFromCode(input.currentCode));
    }

    const activeTracks = TRACK_IDS.filter((trackId) => hasAudiblePattern(tracks[trackId]));
    const isDrumOnly = activeTracks.length > 0 && activeTracks.every((trackId) => trackId === 'drums');

    return {
        currentBpm,
        tracks,
        activeTracks,
        isDrumOnly,
        currentCode: input.currentCode || '',
        source,
    };
}

function parseRequestedBpm(prompt: string) {
    const explicit = prompt.match(/\b(?:tempo\s*(?:to|=)?\s*|set\s+bpm\s*(?:to|=)?\s*|)(\d{2,3})\s*bpm\b/i);
    if (!explicit) return null;
    const bpm = Number(explicit[1]);
    if (!Number.isFinite(bpm)) return null;
    return Math.max(40, Math.min(240, Math.round(bpm)));
}

function buildIntent(params: Omit<MusicIntent, 'currentBpm' | 'isDrumOnly'>, context: MusicContext): MusicIntent {
    const targetsOnlyDrums = params.targetTracks.length === 1 && params.targetTracks[0] === 'drums';
    return {
        ...params,
        currentBpm: context.currentBpm,
        isDrumOnly: targetsOnlyDrums && (
            params.kind === 'track_only' ||
            params.kind === 'modify_current_track' ||
            params.kind === 'style_reference' ||
            params.kind === 'repair_current_context' ||
            params.clearTracks.some((trackId) => trackId !== 'drums')
        ),
    };
}

function hasBlinkReference(prompt: string) {
    return /\bblink\s*-?\s*182\b|\bblink182\b/.test(prompt);
}

function hasDrumReferenceIntent(prompt: string) {
    return /\bdrums?\b/.test(prompt);
}

function isComplaintPrompt(prompt: string) {
    return /^(?:come\s+on|come\s+one|cmon|wtf|no|nope|nah|not\s+that|wrong|try\s+again)$/i.test(prompt.trim())
        || /\b(?:come\s+on|come\s+one|not\s+that|wrong|try\s+again)\b/i.test(prompt);
}

function isTempoPrompt(prompt: string) {
    return (
        parseRequestedBpm(prompt) !== null ||
        /^(faster|slower|speed\s+up|slow\s+down)$/i.test(prompt.trim()) ||
        /\b(make\s+it\s+faster|make\s+it\s+slower|increase\s+(?:the\s+)?tempo|decrease\s+(?:the\s+)?tempo|raise\s+(?:the\s+)?bpm|lower\s+(?:the\s+)?bpm)\b/i.test(prompt)
    );
}

function getTempoTarget(prompt: string, currentBpm: number) {
    const explicit = parseRequestedBpm(prompt);
    if (explicit !== null) return explicit;
    if (/\b(slower|slow\s+down|decrease|lower)\b/i.test(prompt)) {
        return Math.max(40, currentBpm - 10);
    }
    return Math.min(240, currentBpm + 10);
}

function drumTemplateForPrompt(prompt: string): GenreKey {
    if (/\b(?:i\s+said|actually|no,?|cleaner|very\s+clean|super\s+clean)\b/.test(prompt) && /\bclean\s+drums?\b/.test(prompt)) return 'tight_clean_drums';
    if (hasBlinkReference(prompt)) return 'pop_punk_drums';
    if (/^(?:low|lower|deeper)$/.test(prompt) || /\b(?:low|lower|deeper)\s+drums?\b/.test(prompt)) return 'low_drums';
    if (/\bmetal\b|\bdouble\s*kick\b/.test(prompt)) return 'metal_double_kick';
    if (/\bboom\s*bap\b|\bhip\s*hop\b|\bhip-hop\b/.test(prompt)) return 'boom_bap_drums';
    if (/\bdnb\b|\bdrum\s*(?:and|&)\s*bass\b|\bjungle\b|\bbreakbeat\b/.test(prompt)) return 'dnb_breakbeat';
    if (/\bpunk\b|\bfast\s+hats?\b/.test(prompt)) return 'punk_fast_hats';
    if (/\bclean\b/.test(prompt)) return 'clean_drums';
    return 'drums';
}

function isVocalBedHipHopPrompt(prompt: string) {
    return /\b(hip\s*hop|hip-hop|rap|boom\s*bap|trap|eminem|eminen|slim\s+shady)\b/.test(prompt)
        && !/\b(melod(?:y|ic)|hook|lead|topline|piano|sample|chords?|keys|arp|arpeggio)\b/.test(prompt);
}

function isRapArtistReferencePrompt(prompt: string) {
    return /\b(eminem|eminen|slim\s+shady)\b/.test(prompt);
}

// New artist/concept reference helpers added for 2.1 phase (patterned after isRapArtistReferencePrompt / isMichaelJacksonPrompt).
// These allow setting specific referenceStyle and BPM when routing, so that even if detectGenre maps the genre,
// we produce a more distinctive "Aether thought" and avoid pure generic.
function isTiestoPrompt(prompt: string) {
    // 2.6: improved to catch "like tiesto", "in the style of tiesto" etc.
    return /\b(tiesto|tiësto)\b/i.test(prompt) || /\b(like|style of|similar to)\s+(tiesto|tiësto)\b/i.test(prompt);
}

function isUfoOrCosmicConceptPrompt(prompt: string) {
    // 2.6 improved to catch "like ufo", "in the style of cosmic signals" etc.
    return /\b(ufo|alien.*(signal|communicat|transmission)|cosmic.*(signal|communicat)|ufo communication|space communication|alien signal)\b/i.test(prompt)
        || /\b(like|style of|similar to)\s+(ufo|alien|cosmic)\b/i.test(prompt);
}

function contextLooksLikeItalo(context: MusicContext) {
    const joined = [context.currentCode, ...Object.values(context.tracks).filter(Boolean)]
        .join(' ')
        .toLowerCase();
    return /italo_80s|rolandtr808_hh\*8|c2 c3 c2 g1 bb1 g1|c5 eb5 g5 bb5/.test(joined);
}

export function routeMusicIntent(prompt: string, context: MusicContext): MusicIntent {
    const normalized = normalizePrompt(prompt);
    const activeOrAllTracks = context.activeTracks.length > 0 ? context.activeTracks : TRACK_IDS;

    if (isTempoPrompt(normalized)) {
        return buildIntent({
            kind: 'tempo_change',
            targetTracks: [],
            preserveTracks: activeOrAllTracks,
            clearTracks: [],
            templateId: null,
            referenceStyle: null,
            nextBpm: getTempoTarget(normalized, context.currentBpm),
            reason: 'Tempo edit: preserve the current musical context and only adjust BPM.',
        }, context);
    }

    if (hasBlinkReference(normalized) && hasDrumReferenceIntent(normalized)) {
        return buildIntent({
            kind: 'style_reference',
            targetTracks: ['drums'],
            preserveTracks: [],
            clearTracks: NON_DRUM_TRACKS,
            templateId: 'pop_punk_drums',
            referenceStyle: 'pop-punk drum traits',
            nextBpm: 176,
            reason: 'Artist reference mapped to safe pop-punk drum traits, not exact imitation.',
        }, context);
    }

    if (isMichaelJacksonPrompt(normalized)) {
        return buildIntent({
            kind: 'create_full_style',
            targetTracks: ['drums', 'bass', 'melody'],
            preserveTracks: [],
            clearTracks: [],
            templateId: 'pop_funk',
            referenceStyle: 'safe pop-funk dance traits',
            nextBpm: 116,
            reason: 'Artist reference mapped to safe pop-funk dance traits, not exact imitation.',
        }, context);
    }

    if (isRapArtistReferencePrompt(normalized)) {
        return buildIntent({
            kind: 'create_full_style',
            targetTracks: ['drums', 'bass'],
            preserveTracks: [],
            clearTracks: ['melody', 'voice'],
            templateId: 'hiphop',
            referenceStyle: 'safe rap vocal-bed traits',
            nextBpm: 92,
            reason: 'Artist reference mapped to safe rap vocal-bed traits, not exact imitation.',
        }, context);
    }

    // Artist/concept special cases (added 2.1) to ensure referenceStyle and differentiated params.
    // These run before the general detectGenre block so referenceStyle gets populated.
    // Tiesto -> trance with specific style note.
    if (isTiestoPrompt(normalized)) {
        return buildIntent({
            kind: 'create_full_style',
            targetTracks: ['drums', 'bass', 'melody'],
            preserveTracks: [],
            clearTracks: [],
            templateId: 'trance',
            referenceStyle: 'Tiesto-inspired uplifting trance traits (not exact imitation)',
            nextBpm: 138,
            reason: 'Artist reference mapped to trance for distinct output instead of generic C-minor template.',
        }, context);
    }

    // UFO / abstract cosmic -> ambient
    if (isUfoOrCosmicConceptPrompt(normalized)) {
        return buildIntent({
            kind: 'create_full_style',
            targetTracks: ['bass', 'fx'],
            preserveTracks: [],
            clearTracks: [],
            templateId: 'ambient',
            referenceStyle: 'UFO communication / cosmic ambient traits',
            nextBpm: 72,
            reason: 'Abstract concept mapped to ambient (ethereal pads/FX) instead of generic beat.',
        }, context);
    }

    if (isComplaintPrompt(normalized) && context.activeTracks.length > 0) {
        if (context.isDrumOnly) {
            return buildIntent({
                kind: 'repair_current_context',
                targetTracks: ['drums'],
                preserveTracks: [],
                clearTracks: NON_DRUM_TRACKS,
                templateId: 'repaired_drums',
                referenceStyle: null,
                nextBpm: context.currentBpm,
                reason: 'Repair the active drum-only loop after a negative follow-up, without adding bass or melody.',
            }, context);
        }

        return buildIntent({
            kind: 'repair_current_context',
            targetTracks: context.activeTracks,
            preserveTracks: context.activeTracks,
            clearTracks: [],
            templateId: null,
            referenceStyle: null,
            nextBpm: context.currentBpm,
            reason: 'Keep the current context and make a safer correction instead of starting generic music.',
        }, context);
    }

    const clearTrackMatch = normalized.match(/\b(?:remove|delete|clear|mute)\s+(bass|melody|voice|fx)\b/);
    if (clearTrackMatch) {
        const trackId = clearTrackMatch[1] as InstrumentType;
        return buildIntent({
            kind: 'modify_current_track',
            targetTracks: [],
            preserveTracks: TRACK_IDS.filter((id) => id !== trackId),
            clearTracks: [trackId],
            templateId: null,
            referenceStyle: null,
            nextBpm: null,
            reason: `Clear ${trackId} while preserving the rest of the current context.`,
        }, context);
    }

    const wantsCleanDrumCreation = /\bclean\s+drums?\b/.test(normalized);
    if ((isRepairPrompt(normalized) && !wantsCleanDrumCreation) || /\bthat'?s\s+horrible\b/.test(normalized)) {
        if (context.isDrumOnly || isDrumOnlyPrompt(normalized)) {
            return buildIntent({
                kind: 'repair_current_context',
                targetTracks: ['drums'],
                preserveTracks: [],
                clearTracks: NON_DRUM_TRACKS,
                templateId: 'repaired_drums',
                referenceStyle: null,
                nextBpm: context.currentBpm,
                reason: 'Repair the active drum-only loop by simplifying it, not switching genres.',
            }, context);
        }

        const genre = detectGenre(normalized);
        return buildIntent({
            kind: 'repair_current_context',
            targetTracks: ['drums', 'bass', 'melody'],
            preserveTracks: [],
            clearTracks: [],
            templateId: genre === 'metal' ? 'metal' : 'clean_rock',
            referenceStyle: null,
            nextBpm: null,
            reason: 'Repair the current full-track context with a cleaner deterministic template.',
        }, context);
    }

    const explicitGenreBeforeHumanize = detectGenre(normalized);
    const explicitHumanizeLanguage = /\b(non\s*even|not\s+even|less\s+even|human|humanize|swing|syncop|too\s+straight|less\s+rigid|robotic|mechanical|stiff)\b/i.test(normalized);
    if (isHumanizePrompt(normalized) && (!explicitGenreBeforeHumanize || explicitHumanizeLanguage)) {
        if (context.isDrumOnly || isDrumOnlyPrompt(normalized)) {
            return buildIntent({
                kind: 'modify_current_track',
                targetTracks: ['drums'],
                preserveTracks: [],
                clearTracks: NON_DRUM_TRACKS,
                templateId: 'humanized_drums',
                referenceStyle: null,
                nextBpm: context.currentBpm,
                reason: 'Humanize the active drum-only loop with controlled syncopation.',
            }, context);
        }

        return buildIntent({
            kind: 'modify_current_track',
            targetTracks: ['drums', 'bass', 'melody'],
            preserveTracks: [],
            clearTracks: [],
            templateId: 'humanized_rock',
            referenceStyle: null,
            nextBpm: null,
            reason: 'Humanize the current full-track groove with controlled syncopation.',
        }, context);
    }

    if (/^(?:low|lower|deeper)$/.test(normalized) || /\b(?:make\s+it\s+lower|make\s+it\s+deeper|lower\s+drums?|deeper\s+drums?)\b/.test(normalized)) {
        if (context.isDrumOnly || isDrumOnlyPrompt(normalized)) {
            return buildIntent({
                kind: 'modify_current_track',
                targetTracks: ['drums'],
                preserveTracks: [],
                clearTracks: NON_DRUM_TRACKS,
                templateId: 'low_drums',
                referenceStyle: null,
                nextBpm: context.currentBpm,
                reason: 'Lower the current drum-only loop without adding tonal layers.',
            }, context);
        }

        return buildIntent({
            kind: 'modify_current_track',
            targetTracks: context.activeTracks,
            preserveTracks: context.activeTracks,
            clearTracks: [],
            templateId: null,
            referenceStyle: null,
            nextBpm: context.currentBpm,
            reason: 'Preserve the current tracks for a low-register adjustment instead of adding unrelated layers.',
        }, context);
    }

    if (/\b(?:triple\s*tap|triple|three\s*hit|3\s*hit)\b/.test(normalized) && isDrumOnlyPrompt(normalized)) {
        return buildIntent({
            kind: 'modify_current_track',
            targetTracks: ['drums'],
            preserveTracks: [],
            clearTracks: NON_DRUM_TRACKS,
            templateId: 'triple_tap_drums',
            referenceStyle: null,
            nextBpm: context.currentBpm,
            reason: 'Modify the current drums with three-hit triple taps.',
        }, context);
    }

    if (isDoubleTapDrumPrompt(normalized)) {
        return buildIntent({
            kind: 'modify_current_track',
            targetTracks: ['drums'],
            preserveTracks: [],
            clearTracks: NON_DRUM_TRACKS,
            templateId: 'double_tap_drums',
            referenceStyle: null,
            nextBpm: context.currentBpm,
            reason: 'Modify the current drums with subdivided double hits.',
        }, context);
    }

    if (isDrumOnlyPrompt(normalized)) {
        return buildIntent({
            kind: 'track_only',
            targetTracks: ['drums'],
            preserveTracks: [],
            clearTracks: NON_DRUM_TRACKS,
            templateId: drumTemplateForPrompt(normalized),
            referenceStyle: null,
            nextBpm: null,
            reason: 'Track-only drum request: create drums and clear tonal layers.',
        }, context);
    }

    const genre = detectGenre(normalized);
    if (genre) {
        const templateId = genre === 'italo_80s' && contextLooksLikeItalo(context)
            ? 'italo_80s_alt'
            : genre;
        const isHipHopVocalBed = genre === 'hiphop' && isVocalBedHipHopPrompt(normalized);
        return buildIntent({
            kind: 'create_full_style',
            targetTracks: isHipHopVocalBed ? ['drums', 'bass'] : ['drums', 'bass', 'melody'],
            preserveTracks: [],
            clearTracks: isHipHopVocalBed ? ['melody', 'voice'] : [],
            templateId,
            // Set referenceStyle based on detected genre so downstream (brief, grounding) can use it.
            // This helps non-artist "trance" etc. avoid feeling completely generic.
            referenceStyle: `safe ${templateId} traits`,
            nextBpm: null,
            reason: `Create a full ${templateId} style loop.`,
        }, context);
    }

    return buildIntent({
        kind: 'create_full_style',
        targetTracks: ['drums', 'bass', 'melody'],
        preserveTracks: [],
        clearTracks: [],
        templateId: 'generic',
        referenceStyle: null,
        nextBpm: null,
        reason: 'Default broad music request.',
    }, context);
}
