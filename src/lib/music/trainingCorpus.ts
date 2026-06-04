import {
    AgentUpdateResponse,
    GENRE_TEMPLATES,
    GenreKey,
    detectGenre,
    isHumanizePrompt,
    isRepairPrompt,
} from './genreTemplates';

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

export const STRUDEL_CORPUS_VERSION = '2026-06-04.1';

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
];

export const STRUDEL_TRAINING_CORPUS: StrudelTrainingExample[] = [
    ...rockFamilyExamples,
    ...broadGenreExamples,
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
    if (examples.length === 0) return '';

    const lines = ['## RETRIEVED CURATED EXAMPLES'];
    for (const example of examples) {
        lines.push(`Example ${example.id}:`);
        lines.push(`User: ${example.userPrompt}`);
        lines.push(`BPM: ${example.expected.bpm}`);
        lines.push(`Thought: ${example.expected.thought}`);
        lines.push(`Tracks: ${JSON.stringify(example.expected.tracks)}`);
        lines.push(`Quality: ${example.qualityNotes.join('; ')}`);
    }
    return lines.join('\n');
}

