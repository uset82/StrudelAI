import {
    AgentUpdateResponse,
    GENRE_TEMPLATES,
    GenreKey,
    detectGenre,
    isHumanizePrompt,
    isRepairPrompt,
} from './genreTemplates';
import { formatAwesomeStrudelReferencesForPrompt } from './awesomeStrudelReferences';

export type StrudelTrainingExample = {
    id: string;
    version: string;
    userPrompt: string;
    intentTags: string[];
    expected: AgentUpdateResponse;
    bpm: number;
    key: string;
    qualityNotes: string[];
    negative?: boolean;
    rejectionReason?: string;
};

export const STRUDEL_CORPUS_VERSION = '2026-06-04.4';

const fromTemplate = (
    id: string,
    userPrompt: string,
    templateId: GenreKey,
    intentTags: string[],
    qualityNotes: string[],
): StrudelTrainingExample => {
    const template = GENRE_TEMPLATES[templateId];
    return {
        id,
        version: STRUDEL_CORPUS_VERSION,
        userPrompt,
        intentTags: [...template.intentTags, ...intentTags],
        expected: {
            type: 'update_tracks',
            thought: template.thought,
            bpm: template.bpm,
            tracks: template.tracks,
        },
        bpm: template.bpm,
        key: template.key,
        qualityNotes,
    };
};

const rockFamilyExamples: StrudelTrainingExample[] = [
    fromTemplate('rock-001', 'play some rock', 'rock', ['broad-genre', 'first-success-target'], ['Must not fall back to techno', 'Needs drums, bass, and guitar-like riff']),
    fromTemplate('rock-002', 'classic rock in e minor', 'rock', ['classic-rock'], ['Backbeat stays obvious', 'Power chord riff is moderate']),
    fromTemplate('rock-003', 'make a driving guitar riff', 'rock', ['riff', 'guitar'], ['Riff uses root and fifth layers', 'Do not use random notes']),
    fromTemplate('rock-004', 'give me hard rock', 'rock', ['hard-rock'], ['Controlled distortion', 'Kick/snare remain clear']),
    fromTemplate('rock-005', 'rock song with a catchy riff', 'rock', ['hook', 'riff'], ['Lead is memorable and sparse']),
    fromTemplate('rock-006', 'e minor power chords', 'rock', ['power-chords', 'harmony'], ['Root/fifth relationship is audible']),
    fromTemplate('rock-007', 'arena rock loop', 'rock', ['anthemic'], ['Keep 3-4 layers max', 'No noisy FX wash']),
    fromTemplate('rock-008', 'grunge style guitar groove', 'rock', ['grunge'], ['Darker riff, not excessive distortion']),
    fromTemplate('rock-009', 'alt rock beat', 'rock', ['alternative-rock'], ['Backbeat with a clear bass line']),
    fromTemplate('rock-010', 'make the rock less stiff', 'humanized_rock', ['humanize', 'syncopated'], ['Add syncopation without losing snare anchors']),
    fromTemplate('rock-011', 'that not even sound', 'humanized_rock', ['humanize', 'user-correction'], ['Interpret as less rigid timing and riff gaps']),
    fromTemplate('rock-012', 'make it less even', 'humanized_rock', ['humanize', 'syncopated'], ['Do not jump to complex Euclidean chaos']),
    fromTemplate('rock-013', 'more human rock groove', 'humanized_rock', ['humanize'], ['Kick accents vary but stay musical']),
    fromTemplate('rock-014', 'sounds horrible', 'clean_rock', ['repair', 'clean'], ['Simplify, reduce distortion, lower hats']),
    fromTemplate('rock-015', 'clean up the bad rock sound', 'clean_rock', ['repair', 'rock'], ['Keep genre; do not replace with techno']),
    fromTemplate('rock-016', 'too harsh, make it listenable', 'clean_rock', ['repair', 'harsh'], ['Lower high frequencies and distortion']),
    fromTemplate('rock-017', 'the mix is muddy', 'clean_rock', ['repair', 'muddy'], ['Separate bass and kick; reduce gain']),
    fromTemplate('punk-001', 'play fast punk', 'punk', ['punk', 'fast'], ['Fast straight feel with short envelopes']),
    fromTemplate('punk-002', 'pop punk with guitars', 'punk', ['punk', 'guitar'], ['No ambient wash; keep riff direct']),
    fromTemplate('punk-003', 'raw punk rock', 'punk', ['punk', 'raw'], ['Energy from tempo and riff, not noise']),
    fromTemplate('punk-004', 'punk drums and power chords', 'punk', ['punk', 'power-chords'], ['Snare remains on backbeat']),
    fromTemplate('metal-001', 'play heavy metal', 'metal', ['metal', 'heavy'], ['Chugging riff, controlled low end']),
    fromTemplate('metal-002', 'metal chug in e minor', 'metal', ['metal', 'chug'], ['Palm-muted rhythm with root/fifth layers']),
    fromTemplate('metal-003', 'hard metal double kick', 'metal', ['metal', 'double-kick'], ['Double kick should not clip']),
    fromTemplate('metal-004', 'aggressive guitar metal', 'metal', ['metal', 'guitar'], ['Highs capped below harsh range']),
];

const broadGenreExamples: StrudelTrainingExample[] = [
    fromTemplate('funk-001', 'play funky music', 'funk', ['funk'], ['Syncopated bass carries the groove']),
    fromTemplate('pop-001', 'make a catchy pop loop', 'pop', ['pop'], ['Simple hook, no clutter']),
    fromTemplate('jazz-001', 'jazzy chill groove', 'jazz', ['jazz'], ['Soft drums and walking bass']),
    fromTemplate('hiphop-001', 'boom bap hip hop beat', 'hiphop', ['hiphop'], ['Half-time drum feel']),
    fromTemplate('latin-001', 'latin percussion groove', 'latin', ['latin'], ['Bright percussion at low gain']),
    fromTemplate('reggae-001', 'play reggae', 'reggae', ['reggae'], ['Offbeat chord chops']),
    fromTemplate('techno-001', 'dark techno beat', 'techno', ['techno'], ['Four-on-floor remains appropriate']),
    fromTemplate('house-001', 'deep house groove', 'house', ['house'], ['Warm offbeat hats']),
    fromTemplate('ambient-001', 'calm ambient music', 'ambient', ['ambient'], ['No forced drums']),
    fromTemplate('dnb-001', 'drum and bass', 'dnb', ['dnb'], ['Fast BPM is explicit']),
];

const drumIntentExamples: StrudelTrainingExample[] = [
    fromTemplate('drums-001', 'play some clean drums', 'clean_drums', ['track-only', 'context-seed'], ['Create only drums', 'Clear bass, melody, voice, and FX']),
    fromTemplate('drums-002', 'double tap drums', 'double_tap_drums', ['modify-current-track', 'contextual-followup'], ['Change the existing drum pattern', 'Do not replay clean drums']),
    fromTemplate('drums-003', 'triple tap drums', 'triple_tap_drums', ['modify-current-track', 'contextual-followup', 'triple-tap'], ['Use three-hit subdivisions', 'Do not replay double tap drums']),
    fromTemplate('drums-004', 'drums like blink182', 'pop_punk_drums', ['style-reference', 'pop-punk'], ['Map to safe pop-punk drum traits only']),
    fromTemplate('drums-005', 'some blink182 drums', 'pop_punk_drums', ['style-reference', 'pop-punk', 'loose-reference'], ['Map loose artist phrasing to safe pop-punk drum traits only']),
    fromTemplate('drums-006', 'i said some blink182 drums', 'pop_punk_drums', ['style-reference', 'pop-punk', 'correction'], ['Respect repeated artist-reference drum request without adding bass or melody']),
    fromTemplate('drums-007', 'pop-punk drums', 'pop_punk_drums', ['pop-punk', 'track-only'], ['Fast hats and backbeat', 'No bass or guitar unless requested']),
    fromTemplate('drums-008', 'punk fast hats', 'punk_fast_hats', ['punk', 'fast-hats'], ['Fast hats carry energy']),
    fromTemplate('drums-009', 'rock backbeat drums only', 'clean_drums', ['rock', 'backbeat', 'track-only'], ['Backbeat without adding bass or riff']),
    fromTemplate('drums-010', 'metal double-kick drums', 'metal_double_kick', ['metal', 'double-kick', 'track-only'], ['Double kick without clipping']),
    fromTemplate('drums-011', 'hip-hop boom bap drums', 'boom_bap_drums', ['hiphop', 'boom-bap', 'track-only'], ['Loose half-time feel']),
    fromTemplate('drums-012', 'dnb breakbeat drums', 'dnb_breakbeat', ['dnb', 'breakbeat', 'track-only'], ['Fast broken rhythm without bass unless requested']),
    fromTemplate('drums-013', 'low', 'low_drums', ['modify-current-track', 'low', 'drum-only'], ['Lower the active drum loop without adding bass or pads']),
];

const contextualCorrectionExamples: StrudelTrainingExample[] = [
    fromTemplate('context-001', 'make it faster', 'clean_drums', ['tempo-change', 'contextual-followup'], ['Preserve current tracks and increase BPM in code, not .fast(1.1)']),
    fromTemplate('context-002', 'make it less even', 'humanized_drums', ['humanize', 'contextual-followup'], ['Humanize active drums without switching genre']),
    fromTemplate('context-003', 'sounds horrible', 'repaired_drums', ['repair', 'contextual-followup', 'drum-only'], ['Repair active drum loop if only drums are playing']),
    fromTemplate('context-004', 'too harsh', 'repaired_drums', ['repair', 'harsh', 'drum-only'], ['Lower hat gain and simplify']),
    fromTemplate('context-005', 'clean it up', 'repaired_drums', ['repair', 'clean', 'drum-only'], ['Simplify current drum context']),
    fromTemplate('context-006', 'more human', 'humanized_drums', ['humanize', 'drum-only'], ['Controlled syncopation, not random Euclidean chaos']),
    fromTemplate('context-007', 'only drums', 'clean_drums', ['track-only', 'clear-tracks'], ['Clear bass, melody, voice, and FX']),
    fromTemplate('context-008', 'remove melody', 'clean_drums', ['clear-track', 'contextual-followup'], ['Clear melody without inventing a new full genre']),
    fromTemplate('context-009', 'i said clean drums', 'tight_clean_drums', ['correction', 'clean', 'drum-only'], ['Use a tighter clean template instead of replaying the same clean drums']),
    fromTemplate('context-010', 'come on', 'repaired_drums', ['complaint', 'repair', 'drum-only'], ['Treat negative follow-up as context repair, not generic music']),
    fromTemplate('context-011', 'come one', 'repaired_drums', ['complaint', 'repair', 'typo'], ['Handle typo as complaint repair']),
    fromTemplate('context-012', 'techno italo 80s', 'italo_80s', ['italo', '80s', 'style'], ['Use retro Italo traits instead of generic techno']),
    fromTemplate('context-013', 'techno italo 80s again', 'italo_80s_alt', ['italo', '80s', 'variation'], ['Repeated Italo request should vary the loop, not replay identical generic techno']),
];

const negativeExamples: StrudelTrainingExample[] = [
    {
        id: 'negative-001',
        version: STRUDEL_CORPUS_VERSION,
        userPrompt: 'play some rock',
        intentTags: ['negative', 'rock', 'wrong-genre'],
        expected: {
            type: 'update_tracks',
            thought: 'Rejected: this is a generic techno stack, not a rock loop.',
            bpm: 128,
            tracks: GENRE_TEMPLATES.techno.tracks,
        },
        bpm: 128,
        key: 'C minor',
        qualityNotes: ['Do not use this as a positive rock example'],
        negative: true,
        rejectionReason: 'Wrong genre: four-on-floor techno does not satisfy rock guitar/riff intent.',
    },
    {
        id: 'negative-002',
        version: STRUDEL_CORPUS_VERSION,
        userPrompt: 'make a guitar riff',
        intentTags: ['negative', 'unsupported-syntax'],
        expected: {
            type: 'update_tracks',
            thought: 'Rejected: unsupported bank/analyze helpers and excessive distortion.',
            bpm: 140,
            tracks: {
                drums: "s('RolandTR909_bd*4').bank('x').analyze(1)",
                bass: null,
                melody: "note(m('e1 g1 a1')).s('sawtooth').distort(0.9).gain(1.2)",
                voice: null,
                fx: null,
            },
        },
        bpm: 140,
        key: 'E minor',
        qualityNotes: ['Reject unsupported methods before playback'],
        negative: true,
        rejectionReason: 'Unsupported methods and harsh gain/distortion.',
    },
    {
        id: 'negative-003',
        version: STRUDEL_CORPUS_VERSION,
        userPrompt: 'sounds horrible',
        intentTags: ['negative', 'repair'],
        expected: {
            type: 'update_tracks',
            thought: 'Rejected: repair prompts should simplify, not add noisy layers.',
            bpm: 128,
            tracks: {
                drums: "stack(s('pink').gain(0.8), s('RolandTR909_hh*16').gain(0.8))",
                bass: "note(m('c1 c1 c1 c1')).s('sawtooth').distort(0.8).gain(1)",
                melody: "note(m('c6 d6 eb6 f6')).s('square').distort(0.8).gain(0.9)",
                voice: null,
                fx: "s('pink').gain(0.7)",
            },
        },
        bpm: 128,
        key: 'C minor',
        qualityNotes: ['Do not increase density during repair'],
        negative: true,
        rejectionReason: 'Overcomplicated and harsh for a repair request.',
    },
    {
        id: 'negative-004',
        version: STRUDEL_CORPUS_VERSION,
        userPrompt: 'rock backbeat drums only',
        intentTags: ['negative', 'drums', 'wrong-sound-source'],
        expected: {
            type: 'update_tracks',
            thought: 'Rejected: generic synth blips are not a convincing rock drum backbeat.',
            bpm: 120,
            tracks: {
                drums: "note(m('c4 eb4 g4 bb4')).s('sawtooth').gain(0.7)",
                bass: null,
                melody: null,
                voice: null,
                fx: null,
            },
        },
        bpm: 120,
        key: 'N/A',
        qualityNotes: ['Reject tonal synth pretending to be drums'],
        negative: true,
        rejectionReason: 'Drum request produced melodic synth material instead of kick/snare/hat roles.',
    },
    {
        id: 'negative-005',
        version: STRUDEL_CORPUS_VERSION,
        userPrompt: 'only drums',
        intentTags: ['negative', 'drum-only', 'extra-tracks'],
        expected: {
            type: 'update_tracks',
            thought: 'Rejected: drum-only requests must not add bass or melody.',
            bpm: 120,
            tracks: GENRE_TEMPLATES.generic.tracks,
        },
        bpm: 120,
        key: 'C minor',
        qualityNotes: ['Do not use full-song fallback for track-only prompts'],
        negative: true,
        rejectionReason: 'Drum-only request accidentally added bass and melody.',
    },
    {
        id: 'negative-006',
        version: STRUDEL_CORPUS_VERSION,
        userPrompt: 'thats horrible',
        intentTags: ['negative', 'repair', 'wrong-genre'],
        expected: {
            type: 'update_tracks',
            thought: 'Rejected: active drum repair switched to rock arrangement.',
            bpm: GENRE_TEMPLATES.clean_rock.bpm,
            tracks: GENRE_TEMPLATES.clean_rock.tracks,
        },
        bpm: GENRE_TEMPLATES.clean_rock.bpm,
        key: 'E minor',
        qualityNotes: ['Contextual repair must preserve active drum-only scope'],
        negative: true,
        rejectionReason: 'Repair prompt changed genre instead of repairing the current drum loop.',
    },
    {
        id: 'negative-007',
        version: STRUDEL_CORPUS_VERSION,
        userPrompt: 'double tap drums',
        intentTags: ['negative', 'unsupported-syntax', 'drum-only'],
        expected: {
            type: 'update_tracks',
            thought: 'Rejected: unsupported helpers are not valid Strudel in this app.',
            bpm: 120,
            tracks: {
                drums: "s('RolandTR909_bd*4').slider('density').bank('RolandTR909').analyze(1)",
                bass: 'silence',
                melody: 'silence',
                voice: 'silence',
                fx: 'silence',
            },
        },
        bpm: 120,
        key: 'N/A',
        qualityNotes: ['Reject .slider(), .bank(), and .analyze()'],
        negative: true,
        rejectionReason: 'Unsupported Strudel syntax should be sanitized or rejected.',
    },
    {
        id: 'negative-008',
        version: STRUDEL_CORPUS_VERSION,
        userPrompt: 'classic cello melody in C minor',
        intentTags: ['negative', 'scale-error', 'melody'],
        expected: {
            type: 'update_tracks',
            thought: 'Rejected: Cello melody contains E natural which is outside the C minor scale.',
            bpm: 120,
            tracks: {
                drums: null,
                bass: null,
                melody: "note('c3 d3 e3 f3').s('cello')",
                voice: null,
                fx: null,
            },
        },
        bpm: 120,
        key: 'C minor',
        qualityNotes: ['E natural is outside C minor. C minor scale notes are: C, D, Eb, F, G, Ab, Bb.'],
        negative: true,
        rejectionReason: 'Cello melody contains out-of-scale E natural note when C minor key/scale was expected.',
    },
];

const awesomeStrudelSongExamples: StrudelTrainingExample[] = [
    fromTemplate('song-001', 'play grimes music 4 machines cover', 'grimes_m4m', ['song', 'cover', 'grimes'], ['Reference-inspired Grimes-style synth arrangement', 'Valid track-separated Strudel']),
    fromTemplate('song-002', 'play charli xcx 360 remix', 'charli_360', ['song', 'cover', 'remix', 'charli'], ['Reference-inspired electropop groove', 'Valid track-separated Strudel']),
    fromTemplate('song-003', 'play bug from heaven by eefano', 'bug_from_heaven', ['song', 'cover', 'eefano'], ['Reference-inspired guitar song traits', 'Valid track-separated Strudel']),
    fromTemplate('song-004', 'play stranger things theme song', 'stranger_things', ['song', 'theme', 'netflix'], ['Reference-inspired arpeggiated synth theme', 'Bass and melody split']),
    fromTemplate('song-005', 'play radiohead pyramid song cover', 'pyramid_song', ['song', 'cover', 'radiohead'], ['Reference-inspired piano and vocal-pad feel', 'Valid track-separated Strudel']),
    fromTemplate('song-006', 'play rhythm of the night by corona', 'rhythm_of_the_night', ['song', 'cover', 'corona'], ['Reference-inspired Eurodance groove', 'Valid track-separated Strudel']),
    fromTemplate('song-007', 'play pump up the jam cover', 'pump_up_the_jam', ['song', 'cover', 'technotronic'], ['Reference-inspired 90s dance groove', 'Valid track-separated Strudel']),
    fromTemplate('song-008', 'play happy birthday song', 'happy_birthday', ['song', 'birthday'], ['Recognizable public-domain melody shape', 'Drums, bass, and melody split']),
    fromTemplate('song-009', 'play shostakovich waltz 2', 'shostakovich_waltz', ['song', 'classical', 'waltz'], ['Reference-inspired minor waltz feel', 'Valid track-separated Strudel']),
    fromTemplate('song-010', 'play old macdonald song', 'old_macdonald', ['song', 'traditional', 'children'], ['Traditional melody reference', 'Valid track-separated Strudel']),
    fromTemplate('song-011', 'play blue monday remix by new order', 'blue_monday', ['song', 'cover', 'new-order'], ['Reference-inspired Blue Monday traits', 'Valid track-separated Strudel']),
    fromTemplate('song-012', 'play determination theme from undertale', 'undertale_determination', ['song', 'theme', 'undertale', 'toby-fox'], ['Reference-inspired chiptune square lead', 'Valid track-separated Strudel']),
    fromTemplate('song-013', 'play billie eilish birds of a feather cover', 'billie_birds', ['song', 'cover', 'billie-eilish'], ['Reference-inspired soft pop guitar traits', 'Valid track-separated Strudel'])
];

export const STRUDEL_TRAINING_CORPUS: StrudelTrainingExample[] = [
    ...rockFamilyExamples,
    ...broadGenreExamples,
    ...drumIntentExamples,
    ...contextualCorrectionExamples,
    ...awesomeStrudelSongExamples,
    ...negativeExamples,
];

const tokenize = (value: string) =>
    value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

export function getRelevantTrainingExamples(prompt: string, limit = 4) {
    const genre = detectGenre(prompt);
    const promptTokens = new Set(tokenize(prompt));
    const wantsRepair = isRepairPrompt(prompt);
    const wantsHumanize = isHumanizePrompt(prompt);

    return STRUDEL_TRAINING_CORPUS
        .filter((example) => !example.negative)
        .map((example) => {
            let score = 0;
            if (genre && example.intentTags.includes(genre)) score += 8;
            if (wantsRepair && example.intentTags.includes('repair')) score += 10;
            if (wantsHumanize && example.intentTags.includes('humanize')) score += 10;
            for (const tag of example.intentTags) {
                if (promptTokens.has(tag)) score += 2;
            }
            for (const token of tokenize(example.userPrompt)) {
                if (promptTokens.has(token)) score += 1;
            }
            if (example.intentTags.includes('first-success-target')) score += genre === 'rock' ? 4 : 0;
            return { example, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.example);
}

export function formatTrainingExamplesForPrompt(prompt: string, limit = 3) {
    const examples = getRelevantTrainingExamples(prompt, limit);
    const awesomeReferences = formatAwesomeStrudelReferencesForPrompt(prompt, 2);
    if (examples.length === 0 && !awesomeReferences) return '';

    const lines = ['## RETRIEVED CURATED EXAMPLES'];
    for (const example of examples) {
        lines.push(`Example ${example.id}:`);
        lines.push(`User: ${example.userPrompt}`);
        lines.push(`BPM: ${example.expected.bpm}`);
        lines.push(`Thought: ${example.expected.thought}`);
        lines.push(`Tracks: ${JSON.stringify(example.expected.tracks)}`);
        lines.push(`Quality: ${example.qualityNotes.join('; ')}`);
    }
    if (awesomeReferences) lines.push(awesomeReferences);
    return lines.join('\n');
}
