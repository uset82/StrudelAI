import assert from 'node:assert/strict';
import {
    GENRE_TEMPLATES,
    buildDeterministicMusicResponse,
    buildFallbackResponse,
    detectGenre,
} from './src/lib/music/genreTemplates';
import { STRUDEL_TRAINING_CORPUS, getRelevantTrainingExamples } from './src/lib/music/trainingCorpus';
import { validateGeneratedTracks } from './src/lib/music/strudelValidation';

const hasTrack = (value: string | null) => typeof value === 'string' && value.trim().length > 0;

const currentRockCode = Object.values(GENRE_TEMPLATES.rock.tracks)
    .filter(Boolean)
    .join('\n');

const rock = buildDeterministicMusicResponse('play some rock');
assert.ok(rock, 'rock prompt should use deterministic template');
assert.equal(rock?.type, 'update_tracks');
assert.ok(rock!.bpm >= 125 && rock!.bpm <= 145, 'rock BPM should be in rock range');
assert.ok(hasTrack(rock!.tracks.drums), 'rock needs drums');
assert.ok(hasTrack(rock!.tracks.bass), 'rock needs bass');
assert.ok(hasTrack(rock!.tracks.melody), 'rock needs riff/chord melody');
assert.match(rock!.tracks.melody || '', /distort|sawtooth|e2|b2/i, 'rock melody should be guitar-like');
assert.doesNotMatch(rock!.tracks.drums || '', /RolandTR909_bd\*4.*RolandTR909_hh\*16/i, 'rock should not be generic techno');

const humanized = buildDeterministicMusicResponse('that not even sound', currentRockCode);
assert.ok(humanized, 'less-even prompt should use deterministic humanized template');
assert.match(humanized!.thought, /human|syncopated|less rigid|syncopation/i);
assert.match(humanized!.tracks.drums || '', /RolandTR909_bd ~ ~ RolandTR909_bd/i, 'humanized drums should add controlled syncopation');

const repaired = buildDeterministicMusicResponse('sounds horrible', currentRockCode);
assert.ok(repaired, 'repair prompt should use deterministic repair template');
assert.match(repaired!.thought, /clean|simpl|distortion|harsh/i);
assert.doesNotMatch(repaired!.tracks.melody || '', /distort\(0\.[4-9]|gain\(1/i, 'repair should avoid high distortion/gain');

assert.equal(detectGenre('make a guitar riff'), 'rock');
assert.equal(detectGenre('play fast punk'), 'punk');
assert.equal(detectGenre('drum and bass'), 'dnb');

const fallbackRock = buildFallbackResponse('make a guitar riff', 'fallback');
assert.equal(fallbackRock.bpm, GENRE_TEMPLATES.rock.bpm);
assert.ok(hasTrack(fallbackRock.tracks.melody), 'fallback should include rock riff');

const validRock = validateGeneratedTracks(GENRE_TEMPLATES.rock.tracks, 'play some rock');
assert.equal(validRock.valid, true, JSON.stringify(validRock.issues));

const badRock = validateGeneratedTracks(GENRE_TEMPLATES.techno.tracks, 'play some rock');
assert.equal(badRock.valid, false, 'techno stack should not validate as rock');

const unsupported = validateGeneratedTracks({
    drums: "s('RolandTR909_bd*4').bank('RolandTR909').analyze(1)",
    bass: null,
    melody: null,
    voice: null,
    fx: null,
}, 'play some rock');
assert.equal(unsupported.valid, false, 'unsupported methods should be rejected');

const repairTooHarsh = validateGeneratedTracks({
    drums: "s('RolandTR909_hh*16').gain(0.9)",
    bass: "note(m('c1 c1 c1 c1')).s('sawtooth').distort(0.8).gain(1)",
    melody: "note(m('c6 d6 eb6 f6')).s('square').distort(0.7).gain(0.9)",
    voice: null,
    fx: "s('pink').gain(0.9)",
}, 'sounds horrible');
assert.equal(repairTooHarsh.valid, false, 'repair prompt should reject harsh dense output');

const rockFamilyPositiveCount = STRUDEL_TRAINING_CORPUS.filter((example) =>
    !example.negative && example.intentTags.some((tag) => ['rock', 'punk', 'metal'].includes(tag)),
).length;
assert.ok(rockFamilyPositiveCount >= 25, `expected at least 25 rock-family examples, got ${rockFamilyPositiveCount}`);

const retrievedRock = getRelevantTrainingExamples('play some rock', 3);
assert.ok(retrievedRock.some((example) => example.id === 'rock-001'), 'rock first-success example should be retrieved');

console.log('Music quality regression tests passed.');

