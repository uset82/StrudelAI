import type { InstrumentType, SonicSessionState } from '@/types/sonic';
import {
    AgentUpdateResponse,
    GENRE_TEMPLATES,
    GenreKey,
    TrackMap,
    buildIntentFallback,
} from '@/lib/music/genreTemplates';
import { MusicContext, MusicIntent, buildMusicContext, routeMusicIntent } from '@/lib/music/musicIntent';
import { validateGeneratedTracks } from '@/lib/music/strudelValidation';
import { formatTrainingExamplesForPrompt } from '@/lib/music/trainingCorpus';
import { GENRE_STYLE_TRAITS } from './styleTraits';
import { cleanStrudelCode } from '@/lib/music/codeExtractor';
import {
    GeneratedTrackSet,
    MusicAgentPipelineResult,
    MusicAgentTrace,
    MusicBrief,
    QualityReview,
    SoundPlan,
    TheoryPlan,
    TRACK_IDS,
    ValidationReport,
} from './types';

type PipelineInput = {
    prompt: string;
    currentCode?: string | null;
    currentState?: Partial<SonicSessionState> | null;
    context?: MusicContext;
    intent?: MusicIntent;
    enableOpenRouter?: boolean;
};

const NON_DRUM_TRACKS: InstrumentType[] = ['bass', 'melody', 'voice', 'fx'];

const clampBpm = (value: number) => Math.max(40, Math.min(240, Math.round(value)));

function hashString(value: string) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
}

function pick<T>(seed: number, items: T[]) {
    return items[seed % items.length];
}

function normalizePrompt(prompt: string) {
    return prompt.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').trim();
}

function parseBpm(prompt: string) {
    const match = prompt.match(/\b(?:tempo\s*(?:to|=)?\s*|set\s+bpm\s*(?:to|=)?\s*)?(\d{2,3})\s*bpm\b/i);
    if (!match) return null;
    return clampBpm(Number(match[1]));
}

function parseKey(prompt: string) {
    const match = prompt.match(/\b([a-g](?:#|b)?)\s+(major|minor|dorian|phrygian|mixolydian)\b/i);
    if (!match) return null;
    const root = match[1].slice(0, 1).toUpperCase() + match[1].slice(1);
    return `${root} ${match[2].toLowerCase()}`;
}

function parseMood(prompt: string) {
    const moods: Array<[string, RegExp]> = [
        ['dark', /\b(dark|evil|menacing|moody)\b/i],
        ['uplifting', /\b(uplifting|euphoric|bright|happy|anthemic)\b/i],
        ['aggressive', /\b(aggressive|heavy|hard|raw|angry)\b/i],
        ['chill', /\b(chill|calm|relaxed|peaceful|soft)\b/i],
        ['dreamy', /\b(dreamy|ethereal|heavenly|spacey)\b/i],
        ['funky', /\b(funky|groovy|pocket)\b/i],
        ['clean', /\b(clean|clear|less harsh|not harsh)\b/i],
    ];
    const res = moods.filter(([, pattern]) => pattern.test(prompt)).map(([name]) => name);
    // Enhanced in 2.2: recognize abstract descriptors like spacey/ufo for ambient/uplifting
    const p = prompt.toLowerCase();
    if (/\b(spacey|cosmic|alien|ufo|ethereal)\b/i.test(p) && !res.includes('dreamy')) res.push('dreamy');
    if (/\b(uplifting|trance like)\b/i.test(p) && !res.includes('uplifting')) res.push('uplifting');
    return res;
}

function parseReferences(prompt: string) {
    const refs: string[] = [];
    const likeMatch = prompt.match(/\b(?:like|in the style of|similar to)\s+([a-z0-9 ._-]{2,40})/i);
    if (likeMatch) refs.push(likeMatch[1].trim());
    if (/\bblink\s*-?\s*182\b|\bblink182\b/i.test(prompt)) refs.push('pop-punk drum traits');
    // Enhanced (phase 2.2) to recognize artist and abstract from prompt for better brief.references
    // (used in grounding/theory). This passes artist/concept info explicitly.
    if (/\b(tiesto|tiësto)\b/i.test(prompt)) refs.push('tiesto-inspired');
    if (/\b(ufo|alien|cosmic|ufo communication)\b/i.test(prompt)) refs.push('ufo-cosmic-concept');
    return Array.from(new Set(refs));
}

function parseSectionIntent(prompt: string): MusicBrief['sectionIntent'] {
    const p = normalizePrompt(prompt);
    if (/\b(intro|start|beginning)\b/.test(p)) return 'intro';
    if (/\b(fill|drum fill|turnaround)\b/.test(p)) return 'fill';
    if (/\b(drop|chorus|big part)\b/.test(p)) return 'drop';
    if (/\b(again|variation|different|change it up|more interesting)\b/.test(p)) return 'variation';
    if (/\b(fix|repair|horrible|bad|muddy|harsh|clean it)\b/.test(p)) return 'repair';
    return 'core_loop';
}

function scopeFromIntent(intent: MusicIntent): MusicBrief['requestedScope'] {
    if (intent.kind === 'tempo_change') return 'tempo_only';
    if (intent.kind === 'track_only') return 'track_only';
    if (intent.kind === 'repair_current_context') return 'repair';
    if (intent.kind === 'modify_current_track' || intent.kind === 'style_reference') return 'modify_current';
    return 'full_arrangement';
}

function inferInstruments(prompt: string, intent: MusicIntent) {
    const p = normalizePrompt(prompt);
    const instruments = new Set<InstrumentType>(intent.targetTracks);
    if (/\b(drums?|beat|percussion|kick|snare|hats?|hi-?hat)\b/.test(p)) instruments.add('drums');
    if (/\b(bass|sub|low end|bassline)\b/.test(p)) instruments.add('bass');
    if (/\b(melody|lead|riff|guitar|chords?|keys|piano|arp|arpeggio|hook)\b/.test(p)) instruments.add('melody');
    if (/\b(voice|vocal|choir|robot|angelic|singing)\b/.test(p)) instruments.add('voice');
    if (/\b(fx|effect|riser|sweep|texture|noise|atmosphere|ambient)\b/.test(p)) instruments.add('fx');
    if (instruments.size === 0) {
        for (const trackId of intent.targetTracks.length ? intent.targetTracks : ['drums', 'bass', 'melody'] as InstrumentType[]) {
            instruments.add(trackId);
        }
    }
    return Array.from(instruments);
}

function summarizeContext(context: MusicContext) {
    if (context.activeTracks.length === 0) return 'No active musical context.';
    return `Active tracks: ${context.activeTracks.join(', ')} at ${context.currentBpm} BPM.`;
}
const REQUIRED_CODE_TRAITS: Partial<Record<GenreKey, string[]>> = {
    trance: ['supersaw', 'offbeat-bass', 'riser-or-downlifter', 'breakdown-pad', 'a-minor-chord-tones'],
    reggae: ['one-drop', 'offbeat-skank', 'deep-roots-bass', 'dub-delay'],
    dnb: ['fast-breakbeat', 'rolling-bass', '16th-hats'],
    breakbeat_90s: ['broken-beat', 'rave-stab', 'rolling-bass', 'filter-sweep'],
    spacesynth: ['octave-square-bass', 'pentatonic-pluck', 'cosmic-pad'],
    cinematic_electronic: ['relay-clicks', 'capacitor-plucks', 'cinematic-fx', 'sparse-pulse'],
    ambient: ['no-forced-drums', 'slow-pad', 'wide-space'],
    techno: ['four-on-floor', 'filtered-bass', 'controlled-hats'],
    rock: ['backbeat', 'guitar-like-riff', 'root-fifth-motion'],
};

const FORBIDDEN_CODE_TRAITS: Partial<Record<GenreKey, string[]>> = {
    trance: ['generic-c-minor-fallback', 'flat-pad-only', 'missing-arp'],
    reggae: ['four-on-floor-techno', 'fast-edm-hats', 'missing-skank'],
    dnb: ['straight-four-on-floor', 'slow-bpm'],
    breakbeat_90s: ['straight-four-on-floor', 'generic-techno-loop'],
    spacesynth: ['unsupported-koto-sample', 'generic-techno-loop'],
    cinematic_electronic: ['generic-edm-drop', 'dense-random-notes'],
    ambient: ['forced-beat', 'short-harsh-envelope'],
    hiphop: ['busy-melodic-lead'],
};

function energyForDensity(density: string, genre: GenreKey) {
    if (genre === 'trance' || genre === 'dnb' || genre === 'breakbeat_90s') return 'high but controlled';
    if (genre === 'ambient' || genre === 'reggae' || genre === 'cinematic_electronic') return 'slow and spacious';
    if (density === 'dense') return 'high';
    if (density === 'sparse') return 'restrained';
    return 'balanced';
}

function buildQualityTarget(params: {
    genre: GenreKey;
    references: string[];
    traits: typeof GENRE_STYLE_TRAITS.generic;
}) {
    const artistReference = params.references.find((reference) =>
        /artist|tiesto|tiësto|ufo|cosmic|koto|relay|capacitor/i.test(reference)
    ) || null;
    return {
        styleIdentity: params.genre,
        artistReference,
        tempoRange: params.traits.bpmRange,
        rhythmicFeel: params.traits.drumFeel,
        harmony: params.traits.harmony,
        arrangement: params.traits.arrangement,
        energy: energyForDensity(params.traits.density, params.genre),
        soundDesign: params.traits.soundPalette,
        requiredTracks: params.traits.requiredTracks,
        requiredCodeTraits: REQUIRED_CODE_TRAITS[params.genre] || params.traits.soundPalette,
        forbiddenTraits: FORBIDDEN_CODE_TRAITS[params.genre] || params.traits.failureModes,
    };
}

export function buildMusicBrief(prompt: string, context: MusicContext, intent: MusicIntent): MusicBrief {
    const templateId = intent.templateId || 'generic';
    const template = GENRE_TEMPLATES[templateId] || GENRE_TEMPLATES.generic;
    const traits = GENRE_STYLE_TRAITS[templateId];
    const fallbackTraits = traits || GENRE_STYLE_TRAITS.generic;
    const explicitBpm = parseBpm(prompt);
    const explicitKey = parseKey(prompt);
    const bpm = clampBpm(intent.nextBpm ?? explicitBpm ?? traits?.defaultBpm ?? template.bpm ?? context.currentBpm);
    const key = explicitKey || traits?.key || template.key;
    const seed = hashString(`${prompt}|${context.currentCode}|${context.activeTracks.join(',')}|${intent.templateId || ''}`);
    const references = (() => {
        let r = parseReferences(prompt);
        // 2.2: explicitly merge intent.referenceStyle (populated by musicIntent artist/concept detection)
        // so that brief carries it for theory/grounding/sound even if parseReferences missed some.
        if (intent.referenceStyle) {
            const rs = intent.referenceStyle;
            if (rs && !r.includes(rs)) r = [...r, rs];
        }
        return Array.from(new Set(r));
    })();

    return {
        prompt,
        intentKind: intent.kind,
        genre: templateId,
        subgenre: inferSubgenre(prompt, templateId),
        mood: parseMood(prompt),
        bpm,
        key,
        scale: explicitKey || traits?.scale || template.scale || fallbackTraits.scale,
        instruments: inferInstruments(prompt, intent),
        targetTracks: intent.targetTracks,
        preserveTracks: intent.preserveTracks,
        clearTracks: intent.clearTracks,
        requestedScope: scopeFromIntent(intent),
        sectionIntent: parseSectionIntent(prompt),
        references,
        constraints: buildConstraints(prompt, intent),
        qualityTarget: buildQualityTarget({ genre: templateId, references, traits: fallbackTraits }),
        currentBpm: context.currentBpm,
        contextSummary: summarizeContext(context),
        variationSeed: seed,
    };
}

function inferSubgenre(prompt: string, genre: GenreKey) {
    const p = normalizePrompt(prompt);
    if (genre === 'rock') {
        if (/\b(grunge)\b/.test(p)) return 'grunge';
        if (/\b(arena|anthemic)\b/.test(p)) return 'arena rock';
        if (/\b(classic)\b/.test(p)) return 'classic rock';
        if (/\b(alt|alternative)\b/.test(p)) return 'alternative rock';
    }
    if (genre === 'hiphop' && /\b(trap)\b/.test(p)) return 'trap';
    if (genre === 'house' && /\b(deep)\b/.test(p)) return 'deep house';
    if (genre === 'techno' && /\b(industrial)\b/.test(p)) return 'industrial techno';
    // Enhanced 2.2: for trance/ambient when artist or concept keywords present in prompt
    if (genre === 'trance' && /\b(tiesto|uplifting|edm)\b/.test(p)) return 'uplifting trance';
    if (genre === 'ambient' && /\b(ufo|cosmic|space|alien)\b/.test(p)) return 'cosmic/atmospheric';
    if (genre === 'reggae' && /\b(dark|jamaican|roots|dub)\b/.test(p)) return 'dark roots dub';
    if (genre === 'breakbeat_90s') return '90s rave breakbeat';
    if (genre === 'spacesynth' && /\bkoto\b/.test(p)) return 'koto-style spacesynth';
    if (genre === 'cinematic_electronic') return 'relay/capacitor cinematic';
    return null;
}

function buildConstraints(prompt: string, intent: MusicIntent) {
    const constraints = [
        'Return valid Strudel expressions per track.',
        'Use top-level BPM for tempo.',
        'Avoid unsupported helpers such as bank, slider, analyze, and cpm.',
    ];
    if (intent.clearTracks.length > 0) {
        constraints.push(`Clear tracks: ${intent.clearTracks.join(', ')}.`);
    }
    if (/\b(real|actual|realistic)\b/i.test(prompt)) {
        constraints.push('Use MusicGen only for explicitly real audio requests; otherwise make the Strudel part sample-safe.');
    }
    if (/\b(less harsh|clean|horrible|bad|muddy)\b/i.test(prompt)) {
        constraints.push('Reduce gain, distortion, density, and high-frequency clutter.');
    }
    return constraints;
}

export function buildTheoryPlan(brief: MusicBrief): TheoryPlan {
    const progressions: Partial<Record<GenreKey, string[]>> = {
        rock: ['Em', 'G5', 'A5', 'G5'],
        punk: ['Am', 'F5', 'G5', 'E5'],
        metal: ['Em', 'E5', 'G5', 'D5'],
        funk: ['Cm7', 'Eb7', 'Gm7', 'Bb7'],
        pop_funk: ['Fm7', 'Ab', 'Bb', 'C7'],
        pop: ['C', 'G', 'Am', 'F'],
        jazz: ['Dm7', 'G7', 'Cmaj7', 'A7'],
        hiphop: ['Fm', 'Ab', 'Eb', 'Db'],
        latin: ['Am', 'G', 'F', 'E'],
        reggae: ['Gm', 'F', 'Eb', 'F'],
        house: ['C', 'Dm', 'F', 'G'],
        techno: ['Cm', 'Eb', 'Gm', 'Cm'],
        italo_80s: ['Cm', 'Bb', 'Ab', 'Gm'],
        italo_80s_alt: ['Am', 'G', 'F', 'Em'],
        ambient: ['C', 'G', 'Am', 'F'],
        dnb: ['Cm', 'Eb', 'Gm', 'Bb'],
        breakbeat_90s: ['Cm', 'Eb', 'Fm', 'Gm'],
        spacesynth: ['Am', 'G', 'Em', 'F'],
        cinematic_electronic: ['Cm', 'Gm', 'Eb', 'Gm'],
        trance: ['Am', 'C', 'Em', 'G'],
        acid: ['Am', 'C', 'Dm', 'Am'],
        minimal: ['Cm'],
        generic: ['Cm', 'Eb', 'Gm', 'Bb'],
    };
    const roots: Partial<Record<GenreKey, string[]>> = {
        rock: ['e1', 'g1', 'a1', 'g1'],
        punk: ['a1', 'f1', 'g1', 'e1'],
        metal: ['e1', 'e1', 'g1', 'd1'],
        funk: ['c2', 'eb2', 'g1', 'bb1'],
        pop_funk: ['f1', 'ab1', 'c2', 'eb2'],
        pop: ['c2', 'g1', 'a1', 'f1'],
        jazz: ['d2', 'f2', 'a1', 'c2'],
        hiphop: ['f1', 'ab1', 'eb1', 'db1'],
        latin: ['a1', 'e2', 'g1', 'e2'],
        reggae: ['g1', 'd2', 'bb1', 'd2'],
        house: ['c2', 'g1', 'd2', 'f1'],
        techno: ['c1', 'eb1', 'g1', 'c1'],
        italo_80s: ['c2', 'c3', 'g1', 'bb1'],
        italo_80s_alt: ['a1', 'a2', 'e2', 'g1'],
        ambient: ['c2', 'e2', 'g2', 'b1'],
        dnb: ['c1', 'c1', 'eb1', 'c1'],
        breakbeat_90s: ['c1', 'eb1', 'f1', 'g1'],
        spacesynth: ['a1', 'a2', 'e2', 'g1'],
        cinematic_electronic: ['c1', 'g1', 'eb1', 'g1'],
        trance: ['a1', 'c2', 'e2', 'g1'],
        acid: ['a1', 'a2', 'c2', 'd2'],
        minimal: ['c2'],
        generic: ['c2', 'eb2', 'g1', 'bb1'],
    };
    const traits = GENRE_STYLE_TRAITS[brief.genre] || GENRE_STYLE_TRAITS.generic;
    let chordProgression = progressions[brief.genre] || progressions.generic!;
    let bassRoots = roots[brief.genre] || roots.generic!;
    // 2.2 improvement: make reference- and artist-aware so trance/artist and ambient/concept
    // prompts NEVER collapse to the generic Cm->Eb->Gm->Bb .
    const refStr = (brief.references || []).join(' ').toLowerCase();
    if (brief.genre === 'trance' || /tiesto|uplifting/.test(refStr) || brief.subgenre?.includes('trance')) {
        chordProgression = ['Am', 'C', 'Em', 'G'];
        bassRoots = ['a1', 'c2', 'e2', 'g1'];
    } else if (brief.genre === 'ambient' || /ufo|cosmic|alien/.test(refStr) || (brief.subgenre && brief.subgenre.includes('cosmic'))) {
        chordProgression = ['C', 'G', 'Am', 'Em'];  // sustained, less driving than generic
        bassRoots = ['c2', 'g1', 'a1', 'e2'];
    }
    return {
        bpm: brief.bpm,
        key: brief.key,
        scale: brief.scale,
        chordProgression,
        bassRoots,
        rhythmicFeel: traits.drumFeel,
        arrangement: traits.arrangement,
        density: traits.density,
        variationSeed: brief.variationSeed,
    };
}

export function buildSoundPlan(brief: MusicBrief, theory: TheoryPlan): SoundPlan {
    const traits = GENRE_STYLE_TRAITS[brief.genre] || GENRE_STYLE_TRAITS.generic;
    const drumPalette = traits.soundPalette.filter((item) => /drum|808|909|hat|snare|kick|breakbeat/i.test(item));
    const bassPalette = traits.soundPalette.filter((item) => /bass|sub|303|triangle/i.test(item));
    const melodyPalette = traits.soundPalette.filter((item) => /guitar|chord|piano|saw|supersaw|arp|hook/i.test(item));
    // 2.2 enhancement: use references/artist for palette differentiation (e.g. supersaw for tiesto trance)
    const refStr = (brief.references || []).join(' ').toLowerCase();
    let effectiveMelodyPalette = melodyPalette.length ? melodyPalette : ['short coherent hook'];
    if (/tiesto|trance/.test(refStr) || brief.genre === 'trance') {
        effectiveMelodyPalette = ['supersaw arp', 'uplifting hook', ...effectiveMelodyPalette];
    }
    if (/ufo|cosmic|ambient/.test(refStr) || brief.genre === 'ambient') {
        effectiveMelodyPalette = ['sine pad', 'ethereal texture', 'filtered long tones'];
    }
    return {
        drumPalette: drumPalette.length ? drumPalette : ['sample-safe kick/snare/hat roles'],
        bassPalette: bassPalette.length ? bassPalette : ['filtered low bass'],
        melodyPalette: effectiveMelodyPalette,
        fxPalette: ['room and delay only when useful', 'pink noise sweeps at low gain'],
        mixRules: [
            'Keep kick and bass separated with low-pass/level control.',
            'Avoid more than four active layers unless the genre requires density.',
            `Density target: ${theory.density}.`,
            'Use controlled variation instead of random note runs.',
        ],
        realismNotes: [
            traits.drumFeel,
            traits.bassRole,
            traits.leadRole,
        ],
    };
}

const silenceClears = (tracks: TrackMap, clearTracks: InstrumentType[]) => {
    const next = { ...tracks };
    for (const trackId of clearTracks) {
        next[trackId] = 'silence';
    }
    return next;
};

function emptyTracks(): TrackMap {
    return { drums: null, bass: null, melody: null, voice: null, fx: null };
}

function templateTracks(genre: GenreKey) {
    return { ...GENRE_TEMPLATES[genre].tracks };
}

function composeDrumTemplateTracks(brief: MusicBrief): TrackMap | null {
    if (!brief.genre.endsWith('_drums') && brief.genre !== 'drums' && brief.genre !== 'clean_drums' && brief.genre !== 'tight_clean_drums') {
        return null;
    }
    return templateTracks(brief.genre);
}

function rockFamilyTracks(brief: MusicBrief): TrackMap {
    const seed = brief.variationSeed;
    const isMetal = brief.genre === 'metal';
    const isPunk = brief.genre === 'punk';
    if (isMetal) {
        return {
            drums: pick(seed, [
                "stack(s('RolandTR909_bd*8').gain(0.74).lpf(170), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.72).hpf(520), s('RolandTR909_hh*16').gain(0.14).hpf(7600))",
                "stack(s('RolandTR909_bd RolandTR909_bd ~ RolandTR909_bd RolandTR909_bd ~ RolandTR909_bd ~').gain(0.76).lpf(160), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.7).hpf(520), s('RolandTR909_hh*8').gain(0.16).hpf(7200))",
            ]),
            bass: pick(seed + 1, [
                "note(m('e1 e1 e1 ~ e1 g1 e1 d1')).s('sawtooth').att(0.004).decay(0.1).lpf(390).gain(0.68)",
                "note(m('e1 ~ e1 e1 g1 e1 d1 ~')).s('sawtooth').att(0.004).decay(0.12).lpf(420).gain(0.66)",
            ]),
            melody: pick(seed + 2, [
                "stack(note(m('e2 e2 ~ e2 g2 e2 d2 ~')).s('sawtooth').att(0.002).decay(0.075).hpf(140).lpf(2100).distort(0.22).gain(0.38), note(m('b2 b2 ~ b2 d3 b2 a2 ~')).s('sawtooth').att(0.002).decay(0.075).hpf(160).lpf(2100).distort(0.18).gain(0.26))",
                "stack(note(m('e2 ~ e2 g2 e2 d2 e2 ~')).s('square').att(0.002).decay(0.08).hpf(130).lpf(2000).distort(0.2).gain(0.36), note(m('b2 ~ b2 d3 b2 a2 b2 ~')).s('sawtooth').att(0.002).decay(0.08).hpf(160).lpf(2200).distort(0.16).gain(0.24))",
            ]),
            voice: null,
            fx: null,
        };
    }
    if (isPunk) {
        return {
            drums: "stack(s('RolandTR909_bd ~ RolandTR909_bd RolandTR909_bd ~ RolandTR909_bd ~ RolandTR909_bd').gain(0.86), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.76).hpf(520), s('RolandTR909_hh*16').gain(0.17).hpf(7600))",
            bass: "note(m('a1 a1 a1 a1 g1 g1 e1 e1')).s('sawtooth').att(0.004).decay(0.09).lpf(620).gain(0.68)",
            melody: "stack(note(m('a2 a2 g2 e2 a2 ~ g2 e2')).s('sawtooth').att(0.004).decay(0.09).hpf(160).lpf(2500).distort(0.18).gain(0.4), note(m('e3 e3 d3 b2 e3 ~ d3 b2')).s('sawtooth').att(0.004).decay(0.09).hpf(180).lpf(2500).distort(0.14).gain(0.27))",
            voice: null,
            fx: null,
        };
    }
    return {
        drums: pick(seed, [
            "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ RolandTR909_bd ~ ~').gain(0.86), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.68).hpf(480), s('RolandTR909_hh*8').gain(0.16).hpf(6800), s('~ ~ ~ RolandTR909_oh ~ ~ ~ ~').gain(0.1))",
            "stack(s('RolandTR909_bd ~ RolandTR909_bd ~ ~ RolandTR909_bd ~ ~').gain(0.84), s('~ RolandTR909_sd ~ RolandTR909_sd').gain(0.66).hpf(470), s('RolandTR909_hh*8').gain(0.15).hpf(6700), s('~ ~ RolandTR909_oh ~').gain(0.09))",
        ]),
        bass: pick(seed + 1, [
            "note(m('e1 ~ e1 g1 ~ a1 g1 ~')).s('sawtooth').att(0.008).decay(0.16).lpf(500).gain(0.6)",
            "note(m('e1 e1 ~ e1 g1 ~ a1 g1')).s('triangle').att(0.01).decay(0.2).lpf(460).gain(0.62)",
        ]),
        melody: pick(seed + 2, [
            "stack(note(m('e2 ~ ~ g2 a2 ~ g2 ~')).s('sawtooth').att(0.006).decay(0.14).hpf(150).lpf(2400).distort(0.14).gain(0.34), note(m('b2 ~ ~ d3 e3 ~ d3 ~')).s('sawtooth').att(0.006).decay(0.14).hpf(170).lpf(2400).distort(0.1).gain(0.24))",
            "stack(note(m('e2 g2 ~ a2 ~ g2 e2 ~')).s('sawtooth').att(0.006).decay(0.13).hpf(150).lpf(2350).distort(0.13).gain(0.33), note(m('b2 d3 ~ e3 ~ d3 b2 ~')).s('square').att(0.006).decay(0.13).hpf(180).lpf(2300).distort(0.09).gain(0.23))",
        ]),
        voice: null,
        fx: null,
    };
}

function cleanVoiceForPrompt(brief: MusicBrief): string | null {
    const p = normalizePrompt(brief.prompt);
    const keyBase = (brief.key || 'C minor').split(' ')[0].toLowerCase() || 'c';
    if (/\b(choir|angel|heaven|ethereal|vocal|sing)\b/i.test(p)) {
        return `stack(note(m("<${keyBase}4 e4 g4> <g4 b4 d5>")).s("sawtooth").vowel("a").slow(4).room(0.92).delay(0.35).gain(0.38), note(m("<e4 g4 b4> <${keyBase}5 e5 g5>")).s("sine").vowel("o").slow(8).room(0.88).gain(0.28))`;
    }
    if (/\b(robot|robotic|talk|machine)\b/i.test(p)) {
        return `note(m("${keyBase}4 e4 g4 ${keyBase}5")).s("square").vowel("o").crush(5).room(0.35).slow(2).gain(0.32)`;
    }
    // Generic clean voice pad/harmony
    return `note(m("<${keyBase}4 e4 g4> ~ <g4 b4 d5> ~")).s("sawtooth").vowel("a").slow(4).room(0.85).gain(0.36)`;
}

function genreTracks(brief: MusicBrief): TrackMap {
    const seed = brief.variationSeed;
    switch (brief.genre) {
        case 'rock':
        case 'punk':
        case 'metal':
            return rockFamilyTracks(brief);
        case 'funk':
            return {
                drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ RolandTR808_bd ~ ~').gain(0.82), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.62).hpf(500), s('RolandTR909_hh*16').gain(0.1).hpf(7200))",
                bass: pick(seed, [
                    "note(m('c2 ~ eb2 g1 ~ c2 bb1 ~')).s('triangle').att(0.004).decay(0.14).lpf(720).gain(0.7)",
                    "note(m('c2 eb2 ~ g1 c2 ~ bb1 g1')).s('triangle').att(0.004).decay(0.13).lpf(760).gain(0.68)",
                ]),
                melody: "note(m('~ <eb4 g4> ~ <c4 eb4> ~ <g4 bb4> ~ ~')).s('square').att(0.004).decay(0.07).hpf(520).lpf(3100).gain(0.3)",
                voice: null,
                fx: null,
            };
        case 'ambient':
            return {
                drums: null,
                bass: "note(m('c2 ~ ~ ~ e2 ~ ~ ~')).s('sine').att(0.04).release(0.5).lpf(260).room(0.78).slow(4).gain(0.42)",
                melody: null,
                voice: null,
                fx: "note(m('<c5 e5 g5> <g4 b4 d5>')).s('sine').slow(8).room(0.95).delay(0.55).lpf(1400).gain(0.34)",
            };
        case 'dnb':
            return {
                drums: pick(seed, [
                    "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ RolandTR909_bd ~').gain(0.92), s('~ ~ RolandTR909_sd ~ ~ RolandTR909_sd ~ RolandTR909_sd').gain(0.82).hpf(520), s('RolandTR909_hh*16').gain(0.18).hpf(7600))",
                    "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ ~ RolandTR909_bd ~').gain(0.9), s('~ ~ RolandTR909_sd ~ ~ RolandTR909_sd ~ ~').gain(0.82).hpf(520), s('RolandTR909_hh*16').gain(0.2).hpf(7600))",
                ]),
                bass: "note(m('c1 c1 c1 ~ eb1 eb1 ~ c1')).s('sawtooth').att(0.006).decay(0.16).lpf(sine.range(220, 850).slow(2)).gain(0.72)",
                melody: "note(m('c5 ~ eb5 ~ g5 ~ ~ ~')).s('sine').att(0.01).decay(0.11).hpf(500).room(0.2).gain(0.22)",
                voice: null,
                fx: null,
            };
        case 'house':
            return {
                drums: "stack(s('RolandTR808_bd*4').gain(0.9), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.66), s('~ RolandTR909_hh ~ RolandTR909_hh').gain(0.28).hpf(7000), s('RolandTR909_hh*8').gain(0.12).hpf(7600))",
                bass: "note(m('c2 ~ ~ c2 ~ g1 ~ ~')).s('triangle').att(0.008).decay(0.22).lpf(650).gain(0.64)",
                melody: "note(m('<c4 e4 g4> ~ <d4 f4 a4> ~')).s('piano').decay(0.18).room(0.32).lpf(4700).gain(0.28).slow(2)",
                voice: null,
                fx: "s('pink').lpf(sine.range(600, 7500).slow(16)).gain(sine.range(0.03, 0.16).slow(16)).room(0.32)",
            };
        case 'techno':
            return {
                drums: "stack(s('RolandTR909_bd*4').gain(0.98), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.82), s('RolandTR909_hh*16').gain(0.32), s('~ RolandTR909_oh ~ RolandTR909_oh').gain(0.18))",
                bass: "note(m('c1 ~ c1 ~ eb1 ~ g1 ~')).s('sawtooth').att(0.008).decay(0.22).lpf(sine.range(180, 580).slow(3)).resonance(12).gain(0.72)",
                melody: null,
                voice: null,
                fx: "s('pink').hpf(sine.range(180, 11000).slow(8)).gain(sine.range(0.06, 0.28).slow(8))",
            };
        case 'hiphop':
            return {
                drums: pick(seed, [
                    "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ ~ RolandTR808_bd ~').gain(0.94).lpf(185), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.74).hpf(430), s('RolandTR909_hh ~ RolandTR909_hh RolandTR909_hh ~ RolandTR909_hh ~ RolandTR909_hh').gain(0.13).hpf(7600), s('~ ~ ~ RolandTR909_cp ~ ~ ~ ~').gain(0.16).hpf(1200))",
                    "stack(s('RolandTR808_bd ~ RolandTR808_bd ~ ~ ~ RolandTR808_bd ~').gain(0.94).lpf(185), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.74).hpf(430), s('RolandTR909_hh ~ RolandTR909_hh ~ RolandTR909_hh RolandTR909_hh ~ RolandTR909_hh').gain(0.13).hpf(7600))",
                ]),
                bass: pick(seed + 1, [
                    "note(m('f1 ~ f1 ~ db1 ~ eb1 ~')).s('sine').att(0.006).decay(0.32).lpf(95).gain(0.82)",
                    "note(m('f1 ~ ~ f1 ~ db1 eb1 ~')).s('sine').att(0.006).decay(0.34).lpf(90).gain(0.82)",
                ]),
                melody: 'silence',
                voice: 'silence',
                fx: "s('pink').hpf(1800).lpf(3600).gain(0.03).room(0.16).slow(8)",
            };
        default:
            if (GENRE_TEMPLATES[brief.genre]) {
                return templateTracks(brief.genre);
            }
            return templateTracks('generic');
    }
}

export function generateTracksFromPlans(brief: MusicBrief, theory: TheoryPlan, sound: SoundPlan, context: MusicContext, intent: MusicIntent): GeneratedTrackSet {
    if (brief.requestedScope === 'tempo_only') {
        return {
            bpm: brief.bpm,
            tracks: silenceClears({ ...context.tracks }, intent.clearTracks),
            thought: `Tempo changed to ${brief.bpm} BPM while preserving the current musical context.`,
        };
    }

    const drumTemplate = composeDrumTemplateTracks(brief);
    const baseTracks = drumTemplate || genreTracks(brief);
    let tracks = silenceClears({ ...emptyTracks(), ...baseTracks }, intent.clearTracks);

    // Provide clean idiomatic voice when requested and not already set
    if ((brief.instruments.includes('voice') || brief.targetTracks.includes('voice')) &&
        (!tracks.voice || tracks.voice === 'silence' || tracks.voice === null)) {
        const v = cleanVoiceForPrompt(brief);
        if (v) tracks = { ...tracks, voice: cleanStrudelCode(v) };
    }
    // 2.2: when artist/concept refs, compose/select more distinctive expressions (e.g. supersaw for tiesto trance)
    const refStr = (brief.references || []).join(' ').toLowerCase();
    if ((/tiesto/.test(refStr) || brief.genre === 'trance') && !tracks.melody) {
        tracks.melody = "note(m('a4 c5 e5 a5 e5 c5 a4 e4')).s('supersaw').att(0.01).decay(0.22).lpf(3200).room(0.45).delay(0.22).gain(0.45).slow(2)";
    }
    if ((/ufo|cosmic/.test(refStr) || brief.genre === 'ambient') && !tracks.fx) {
        tracks.fx = "note(m('<c5 e5 g5> <g4 b4 d5>')).s('sine').slow(8).room(0.95).delay(0.55).lpf(1400).gain(0.34)";
    }
    const traits = GENRE_STYLE_TRAITS[brief.genre];
    const template = GENRE_TEMPLATES[brief.genre];
    const isReferenceTemplate = template?.intentTags.includes('song') || template?.intentTags.includes('reference');
    let thought = `${template.thought} Theory: ${theory.key}. Sound: ${sound.mixRules[0]}`;
    if (!isReferenceTemplate && traits) {
        thought = [
            `${brief.genre}: ${traits.drumFeel}`,
            traits.bassRole,
            traits.leadRole,
            `Theory: ${theory.key}, ${theory.chordProgression.join(' -> ')}.`,
            `Sound: ${sound.mixRules[0]}`,
        ].join(' ');
    }
    // 2.2: build more specific thought that includes artist/concept when references or genre indicate mapped request.
    // e.g. prevents the generic "Aether thought" for tiesto/ufo.
    const refStr2 = (brief.references || []).join(' ').toLowerCase();
    if (/tiesto/.test(refStr2) || (brief.genre === 'trance' && /tiesto|uplifting/.test(refStr2))) {
        thought = `Tiesto-inspired uplifting trance: driving four-on-floor with offbeat bass and bright supersaw arpeggio. ${thought}`;
    } else if (/ufo|cosmic|alien/.test(refStr2) || (brief.genre === 'ambient' && /ufo|cosmic/.test(refStr2))) {
        thought = `UFO communication signals: slow ethereal pads, sparse bass pulses and atmospheric FX textures. ${thought}`;
    }

    // Ensure all tracks are clean idiomatic chains (no redundant nested parens)
    const cleanedTracks: TrackMap = {
        drums: tracks.drums ? cleanStrudelCode(tracks.drums) : null,
        bass: tracks.bass ? cleanStrudelCode(tracks.bass) : null,
        melody: tracks.melody ? cleanStrudelCode(tracks.melody) : null,
        voice: tracks.voice ? cleanStrudelCode(tracks.voice) : null,
        fx: tracks.fx ? cleanStrudelCode(tracks.fx) : null,
    };

    return {
        bpm: theory.bpm,
        tracks: cleanedTracks,
        thought,
    };
}

function toValidationReport(result: ReturnType<typeof validateGeneratedTracks>): ValidationReport {
    return {
        valid: result.valid,
        issues: result.issues,
    };
}

function hasRoboticMelody(tracks: TrackMap) {
    const melody = tracks.melody || '';
    const repeatedNote = /m\(['"]\s*([a-g](?:#|b)?\d)\s+(?:\1\s+){5,}/i.test(melody);
    const repeatedStar = /\b[a-g](?:#|b)?\d\*([8-9]|1[0-9])/i.test(melody);
    return repeatedNote || repeatedStar;
}

function numericMethodValues(value: string, method: string) {
    const matches = value.matchAll(new RegExp(`\\.${method}\\(\\s*(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))\\s*\\)`, 'gi'));
    return Array.from(matches)
        .map((match) => Number(match[1]))
        .filter(Number.isFinite);
}

function hasExcessiveControlledRockDistortion(brief: MusicBrief, tracks: TrackMap) {
    if (brief.genre !== 'rock' && brief.genre !== 'clean_rock' && brief.genre !== 'humanized_rock') {
        return false;
    }
    return numericMethodValues(tracks.melody || '', 'distort').some((value) => value > 0.18);
}

function missingQualityTargetTraits(brief: MusicBrief, tracks: TrackMap) {
    const joined = Object.values(tracks).filter(Boolean).join(' ').toLowerCase();
    const missing: string[] = [];
    const expect = (label: string, pattern: RegExp) => {
        if (!pattern.test(joined)) missing.push(label);
    };

    switch (brief.genre) {
        case 'trance':
            expect('layered supersaw arp/chord hook', /supersaw/);
            expect('offbeat A-minor bass', /~ a1|a1 ~ a1/);
            expect('riser or downlifter FX', /pink|hpf\(sine\.range|slow\(8|slow\(16/);
            break;
        case 'reggae':
            expect('one-drop drum pocket', /~ ~ rolandtr808_bd|~ ~ rolandtr909_sd|rim/);
            expect('offbeat skank chords', /~\s*<|delay\(/);
            expect('deep roots bass', /g1|bb1|d2/);
            break;
        case 'breakbeat_90s':
            expect('broken drums', /rolandtr909_bd ~ ~ rolandtr909_bd|~ ~ rolandtr909_sd/);
            expect('rave stab color', /square|supersaw|crush/);
            break;
        case 'spacesynth':
            expect('octave square bass', /a1 a2|square/);
            expect('plucked pentatonic lead', /piano|a4 c5 d5|pentatonic/);
            expect('cosmic pad or FX', /room\(0\.9|pink|slow\(16/);
            break;
        case 'cinematic_electronic':
            expect('relay/capacitor transient design', /crush\(|att\(0\.001\)|decay\(0\.03|decay\(0\.055/);
            expect('cinematic tension FX', /hpf\(sine\.range|room\(0\.65|slow\(16/);
            break;
    }

    return missing;
}

export function reviewMusicQuality(brief: MusicBrief, generated: GeneratedTrackSet, validation: ValidationReport): QualityReview {
    const problems: string[] = [];
    const improvements: string[] = [];
    const roboticMelody = hasRoboticMelody(generated.tracks);
    const excessiveRockDistortion = hasExcessiveControlledRockDistortion(brief, generated.tracks);
    const missingTraits = missingQualityTargetTraits(brief, generated.tracks);

    if (!validation.valid) {
        problems.push(...validation.issues.map((issue) => `${issue.trackId}: ${issue.reason}`));
        improvements.push('Repair validation issues before playback.');
    }

    if (roboticMelody) {
        problems.push('Melody is too repetitive or robotic.');
        improvements.push('Add rests, contour, or a shorter hook instead of repeated identical notes.');
    }

    if (brief.genre === 'rock' && !/distort\(|sawtooth|square/i.test(generated.tracks.melody || '')) {
        problems.push('Rock output lacks guitar-like texture.');
        improvements.push('Use layered root/fifth saw or square parts with controlled distortion.');
    }

    if (excessiveRockDistortion) {
        problems.push('Rock guitar layer is too distorted.');
        improvements.push('Keep rock and hard-rock guitar distortion at or below 0.18; use tighter rhythm and root/fifth notes for intensity.');
    }

    if (missingTraits.length > 0) {
        problems.push(`Missing required ${brief.genre} traits: ${missingTraits.join(', ')}.`);
        improvements.push(`Regenerate using quality target traits: ${brief.qualityTarget.requiredCodeTraits.join(', ')}.`);
    }

    const matchesIntent = problems.length === 0;
    const listenability = validation.valid && !roboticMelody && !excessiveRockDistortion && missingTraits.length === 0;
    const score = Math.max(0, Math.min(1, 1 - problems.length * 0.2));

    return {
        score,
        matchesIntent,
        listenability,
        problems,
        improvements,
    };
}

export function refineGeneratedTracks(
    generated: GeneratedTrackSet,
    brief: MusicBrief,
    context: MusicContext,
    intent: MusicIntent,
    validation: ValidationReport,
    review: QualityReview,
): GeneratedTrackSet {
    if (!validation.valid) {
        const fallback = buildIntentFallback(intent, context, `Refined with deterministic fallback after validation issues: ${validation.issues.map(i => i.reason).join('; ')}`);
        return {
            bpm: fallback.bpm,
            tracks: fallback.tracks,
            thought: fallback.thought,
        };
    }

    if (review.listenability) return generated;

    const tracks = { ...generated.tracks };
    if (hasRoboticMelody(tracks)) {
        if (brief.genre === 'rock') {
            tracks.melody = rockFamilyTracks({ ...brief, variationSeed: brief.variationSeed + 3 }).melody;
        } else {
            tracks.melody = "note(m('c4 ~ eb4 g4 ~ bb4 g4 ~')).s('sine').att(0.01).decay(0.18).room(0.22).gain(0.28).slow(2)";
        }
    }
    if (hasExcessiveControlledRockDistortion(brief, tracks)) {
        tracks.melody = rockFamilyTracks({ ...brief, genre: 'rock', variationSeed: brief.variationSeed + 5 }).melody;
    }
    // Always re-clean after refinement
    const cleaned: TrackMap = {
        drums: tracks.drums ? cleanStrudelCode(tracks.drums) : null,
        bass: tracks.bass ? cleanStrudelCode(tracks.bass) : null,
        melody: tracks.melody ? cleanStrudelCode(tracks.melody) : null,
        voice: tracks.voice ? cleanStrudelCode(tracks.voice) : null,
        fx: tracks.fx ? cleanStrudelCode(tracks.fx) : null,
    };
    return {
        ...generated,
        tracks: cleaned,
        thought: `${generated.thought} Refined to reduce repetition and keep the loop more musical.`,
    };
}

function tracesFor(brief: MusicBrief, theory: TheoryPlan, sound: SoundPlan, validation: ValidationReport, review: QualityReview): MusicAgentTrace[] {
    return [
        { stage: 'UserIntentAgent', summary: `${brief.requestedScope} ${brief.genre} at ${brief.bpm} BPM.` },
        { stage: 'MusicTheoryAgent', summary: `${theory.key}: ${theory.chordProgression.join(' -> ')}.` },
        { stage: 'SoundDesignAgent', summary: sound.realismNotes.join(' ') },
        { stage: 'StrudelCodeAgent', summary: 'Generated track-separated Strudel expressions.' },
        { stage: 'CodeValidationAgent', summary: validation.valid ? 'Validation passed.' : `Validation issues: ${validation.issues.length}.` },
        { stage: 'MusicQualityReviewAgent', summary: `Quality score ${review.score.toFixed(2)}.` },
        { stage: 'RefinementAgent', summary: review.listenability ? 'No refinement needed.' : 'Applied deterministic refinement or fallback.' },
    ];
}

let localPipelineOverride: ((input: PipelineInput) => MusicAgentPipelineResult) | null = null;
let isExecutingOverride = false;

export function setLocalPipelineOverride(fn: typeof localPipelineOverride) {
    localPipelineOverride = fn;
}

export function buildLocalMusicAgentPipeline(input: PipelineInput): MusicAgentPipelineResult {
    if (localPipelineOverride && !isExecutingOverride) {
        isExecutingOverride = true;
        try {
            return localPipelineOverride(input);
        } finally {
            isExecutingOverride = false;
        }
    }
    const context = input.context || buildMusicContext({ currentState: input.currentState, currentCode: input.currentCode });
    const intent = input.intent || routeMusicIntent(input.prompt, context);
    const brief = buildMusicBrief(input.prompt, context, intent);
    const theory = buildTheoryPlan(brief);
    const sound = buildSoundPlan(brief, theory);
    const generated = generateTracksFromPlans(brief, theory, sound, context, intent);
    const validation = toValidationReport(validateGeneratedTracks(generated.tracks, input.prompt, input.currentCode || undefined, intent));
    const review = reviewMusicQuality(brief, generated, validation);
    const refined = refineGeneratedTracks(generated, brief, context, intent, validation, review);
    const finalValidation = toValidationReport(validateGeneratedTracks(refined.tracks, input.prompt, input.currentCode || undefined, intent));
    const finalReview = reviewMusicQuality(brief, refined, finalValidation);

    return {
        ...refined,
        brief,
        theory,
        sound,
        validation: finalValidation,
        review: finalReview,
        traces: tracesFor(brief, theory, sound, finalValidation, finalReview),
        source: finalValidation.valid ? 'local_pipeline' : 'fallback',
    };
}

export function toAgentUpdateResponse(result: Pick<GeneratedTrackSet, 'bpm' | 'tracks' | 'thought'>): AgentUpdateResponse {
    return {
        type: 'update_tracks',
        bpm: result.bpm,
        tracks: result.tracks,
        thought: result.thought,
    };
}

export function formatAgentGrounding(prompt: string, brief: MusicBrief, theory: TheoryPlan, sound: SoundPlan) {
    const traits = GENRE_STYLE_TRAITS[brief.genre] || GENRE_STYLE_TRAITS.generic;
    const artistConceptNote = (brief.references || []).filter(r => /tiesto|ufo|cosmic|alien|artist/.test(r.toLowerCase())).join('; ') || (brief.genre !== 'generic' ? brief.genre : '');
    return [
        'Music brief:',
        JSON.stringify({
            genre: brief.genre,
            subgenre: brief.subgenre,
            mood: brief.mood,
            bpm: brief.bpm,
            key: brief.key,
            scope: brief.requestedScope,
            targetTracks: brief.targetTracks,
            clearTracks: brief.clearTracks,
            sectionIntent: brief.sectionIntent,
            references: brief.references,
            artistOrConcept: artistConceptNote || undefined,
        }),
        'Style traits:',
        JSON.stringify({
            drumFeel: traits.drumFeel,
            bassRole: traits.bassRole,
            harmony: traits.harmony,
            leadRole: traits.leadRole,
            requiredTracks: traits.requiredTracks,
            failureModes: traits.failureModes,
        }),
        'Theory plan:',
        JSON.stringify(theory),
        'Sound plan:',
        JSON.stringify(sound),
        'Quality target:',
        JSON.stringify(brief.qualityTarget),
        'Relevant examples as reference only:',
        formatTrainingExamplesForPrompt(prompt, 3),  // 2.5 updated emphasis via artist notes in caller + new examples in corpus
        artistConceptNote ? `Artist/concept guidance: Use traits for ${artistConceptNote} to produce distinct non-generic output (e.g. supersaw arps or cosmic pads).` : '',
    ].filter(Boolean).join('\n');
}

export function applyTrackMapToState(response: AgentUpdateResponse, currentState: SonicSessionState): SonicSessionState {
    const next: SonicSessionState = JSON.parse(JSON.stringify(currentState));
    next.bpm = response.bpm;
    for (const trackId of TRACK_IDS) {
        const pattern = response.tracks[trackId];
        if (!next.tracks[trackId]) continue;
        if (pattern === null || pattern === undefined) continue;
        next.tracks[trackId].pattern = pattern ? `expr:${pattern}` : '';
        next.tracks[trackId].muted = false;
    }
    for (const trackId of NON_DRUM_TRACKS) {
        if (response.tracks[trackId] === 'silence' && next.tracks[trackId]) {
            next.tracks[trackId].pattern = 'expr:silence';
            next.tracks[trackId].muted = false;
        }
    }
    next.isPlaying = true;
    next.trackDescription = response.thought;
    return next;
}
