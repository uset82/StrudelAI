import assert from 'node:assert/strict';
import {
    GENRE_TEMPLATES,
    buildDeterministicMusicResponse,
    buildIntentFallback,
    buildFallbackResponse,
    detectGenre,
    isDoubleTapDrumPrompt,
    isDrumOnlyPrompt,
} from './src/lib/music/genreTemplates';
import { buildMusicContext, routeMusicIntent } from './src/lib/music/musicIntent';
import { STRUDEL_TRAINING_CORPUS, getRelevantTrainingExamples } from './src/lib/music/trainingCorpus';
import { validateGeneratedTracks } from './src/lib/music/strudelValidation';
import { buildStrudelCode } from './src/lib/strudel/engine';
import {
    MusicBriefSchema,
    QualityReviewSchema,
    SoundPlanSchema,
    TheoryPlanSchema,
    buildLocalMusicAgentPipeline,
    buildMusicBrief,
} from './src/lib/music-agent';
import type { SonicSessionState, InstrumentType } from './src/types/sonic';

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

const pureDrums = buildDeterministicMusicResponse('some pure drums', currentRockCode);
assert.ok(pureDrums, 'pure drums should use deterministic drum-only template');
assert.equal(isDrumOnlyPrompt('some pure drums'), true);
assert.ok(hasTrack(pureDrums!.tracks.drums), 'pure drums needs a drum pattern');
assert.equal(pureDrums!.tracks.bass, 'silence', 'pure drums must clear existing bass');
assert.equal(pureDrums!.tracks.melody, 'silence', 'pure drums must clear existing melody');
assert.equal(pureDrums!.tracks.voice, 'silence', 'pure drums must clear existing voice');
assert.equal(pureDrums!.tracks.fx, 'silence', 'pure drums must clear existing fx');
assert.doesNotMatch(pureDrums!.tracks.drums || '', /c4 eb4|triangle|sawtooth.*lpf\(520\)/i, 'pure drums must not include generic bass/melody material');

const doubleTapDrums = buildDeterministicMusicResponse('double tap drums', pureDrums!.tracks.drums || '');
assert.ok(doubleTapDrums, 'double tap drums should use deterministic drum-only template');
assert.equal(isDrumOnlyPrompt('double tap drums'), true);
assert.equal(isDoubleTapDrumPrompt('double tap drums'), true);
assert.notEqual(doubleTapDrums!.tracks.drums, pureDrums!.tracks.drums, 'double tap drums must not replay the plain clean drums template');
assert.match(doubleTapDrums!.tracks.drums || '', /\[c2 c2\].*\[c4 c4\]/, 'double tap drums should use subdivided double hits');
assert.equal(doubleTapDrums!.tracks.bass, 'silence');
assert.equal(doubleTapDrums!.tracks.melody, 'silence');

assert.equal(detectGenre('make a guitar riff'), 'rock');
assert.equal(detectGenre('play fast punk'), 'punk');
assert.equal(detectGenre('drum and bass'), 'dnb');
assert.equal(detectGenre('techno italo 80s'), 'italo_80s');
assert.equal(detectGenre('play some michael jackson'), 'pop_funk');

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

const validPureDrums = validateGeneratedTracks(pureDrums!.tracks, 'some pure drums', currentRockCode);
assert.equal(validPureDrums.valid, true, JSON.stringify(validPureDrums.issues));

const validDoubleTapDrums = validateGeneratedTracks(doubleTapDrums!.tracks, 'double tap drums', currentRockCode);
assert.equal(validDoubleTapDrums.valid, true, JSON.stringify(validDoubleTapDrums.issues));

const invalidPureDrums = validateGeneratedTracks(GENRE_TEMPLATES.generic.tracks, 'some pure drums', currentRockCode);
assert.equal(invalidPureDrums.valid, false, 'drum-only prompts should reject generic full-song fallback');

const applyIntentTurn = (prompt: string, previous?: { bpm: number; tracks: typeof GENRE_TEMPLATES.generic.tracks }) => {
    const context = buildMusicContext({
        currentState: previous
            ? {
                bpm: previous.bpm,
                scale: 'C minor',
                isPlaying: true,
                tracks: {
                    drums: { id: 'drums', name: 'Drums', pattern: previous.tracks.drums || '', muted: false, volume: 1 },
                    bass: { id: 'bass', name: 'Bass', pattern: previous.tracks.bass || '', muted: false, volume: 1 },
                    melody: { id: 'melody', name: 'Melody', pattern: previous.tracks.melody || '', muted: false, volume: 1 },
                    voice: { id: 'voice', name: 'Voice', pattern: previous.tracks.voice || '', muted: false, volume: 1 },
                    fx: { id: 'fx', name: 'FX', pattern: previous.tracks.fx || '', muted: false, volume: 1 },
                },
            }
            : null,
    });
    const intent = routeMusicIntent(prompt, context);
    const response = buildDeterministicMusicResponse(intent, context) || buildIntentFallback(intent, context, 'test fallback');
    return { intent, response };
};

const cleanDrumsTurn = applyIntentTurn('play some clean drums');
assert.equal(cleanDrumsTurn.intent.kind, 'track_only');
assert.equal(cleanDrumsTurn.intent.templateId, 'clean_drums');
assert.ok(hasTrack(cleanDrumsTurn.response.tracks.drums), 'clean drums should create a drum pattern');
assert.equal(cleanDrumsTurn.response.tracks.bass, 'silence', 'clean drums should clear bass');
assert.equal(cleanDrumsTurn.response.tracks.melody, 'silence', 'clean drums should clear melody');

const plainDrumsTurn = applyIntentTurn('play some drums');
assert.equal(plainDrumsTurn.intent.kind, 'track_only');
assert.equal(plainDrumsTurn.intent.templateId, 'drums');
assert.notEqual(plainDrumsTurn.response.tracks.drums, cleanDrumsTurn.response.tracks.drums, 'plain drums and clean drums must not replay the same template');
assert.match(plainDrumsTurn.response.tracks.drums || '', /RolandTR909_bd/i, 'plain drums should use audible sample-safe kick material');
assert.doesNotMatch(plainDrumsTurn.response.tracks.drums || '', /lpf\(145\)|gain\(0\.095\)|gain\(0\.045\)/i, 'plain drums should not use the old muffled low-output synth template');

const cleanAfterPlainTurn = applyIntentTurn('clean drums', plainDrumsTurn.response);
assert.equal(cleanAfterPlainTurn.intent.templateId, 'clean_drums');
assert.notEqual(cleanAfterPlainTurn.response.tracks.drums, plainDrumsTurn.response.tracks.drums, 'clean drums should change the existing plain drum loop');

const correctionCleanTurn = applyIntentTurn('i said clean drums', cleanAfterPlainTurn.response);
assert.equal(correctionCleanTurn.intent.templateId, 'tight_clean_drums');
assert.notEqual(correctionCleanTurn.response.tracks.drums, cleanAfterPlainTurn.response.tracks.drums, 'i said clean drums should tighten/strip the clean loop further');

const doubleTapTurn = applyIntentTurn('double tap drums', cleanDrumsTurn.response);
assert.equal(doubleTapTurn.intent.kind, 'modify_current_track');
assert.notEqual(doubleTapTurn.response.tracks.drums, cleanDrumsTurn.response.tracks.drums, 'double tap drums must change the clean drum code');
assert.match(doubleTapTurn.response.tracks.drums || '', /\[c2 c2\].*\[c4 c4\]/, 'double tap drums should use subdivided hits');
assert.equal(doubleTapTurn.response.tracks.bass, 'silence');
assert.equal(doubleTapTurn.response.tracks.melody, 'silence');

const tripleTapTurn = applyIntentTurn('triple tap drums', doubleTapTurn.response);
assert.equal(isDoubleTapDrumPrompt('triple tap drums'), false);
assert.equal(tripleTapTurn.intent.kind, 'modify_current_track');
assert.equal(tripleTapTurn.intent.templateId, 'triple_tap_drums');
assert.notEqual(tripleTapTurn.response.tracks.drums, doubleTapTurn.response.tracks.drums, 'triple tap drums must not reuse double tap drums');
assert.match(tripleTapTurn.response.tracks.drums || '', /\[c2 c2 c2\].*\[c4 c4 c4\]/, 'triple tap drums should use three-hit subdivisions');

const fasterTurn = applyIntentTurn('faster', doubleTapTurn.response);
assert.equal(fasterTurn.intent.kind, 'tempo_change');
assert.equal(fasterTurn.response.bpm, doubleTapTurn.response.bpm + 10, 'faster should increase BPM by 10');
assert.equal(fasterTurn.response.tracks.drums, doubleTapTurn.response.tracks.drums, 'faster should preserve drum code');
assert.equal(fasterTurn.response.tracks.bass, 'silence', 'faster should preserve drum-only bass silence');
assert.equal(fasterTurn.response.tracks.melody, 'silence', 'faster should preserve drum-only melody silence');

const repairedDrumsTurn = applyIntentTurn('thats horrible', fasterTurn.response);
assert.equal(repairedDrumsTurn.intent.kind, 'repair_current_context');
assert.equal(repairedDrumsTurn.intent.templateId, 'repaired_drums');
assert.ok(hasTrack(repairedDrumsTurn.response.tracks.drums), 'drum repair should keep drums');
assert.equal(repairedDrumsTurn.response.tracks.bass, 'silence', 'drum repair should not introduce rock bass');
assert.equal(repairedDrumsTurn.response.tracks.melody, 'silence', 'drum repair should not introduce rock melody');
assert.doesNotMatch(repairedDrumsTurn.response.thought, /rock/i, 'drum repair should not switch to rock');

const blinkDrumsTurn = applyIntentTurn('drums like blink182', repairedDrumsTurn.response);
assert.equal(blinkDrumsTurn.intent.kind, 'style_reference');
assert.equal(blinkDrumsTurn.intent.templateId, 'pop_punk_drums');
assert.match(blinkDrumsTurn.response.thought, /pop-punk|punk/i, 'Blink-182 reference should map to pop-punk traits');
assert.ok(hasTrack(blinkDrumsTurn.response.tracks.drums), 'pop-punk reference should produce drums');
assert.match(blinkDrumsTurn.response.tracks.drums || '', /RolandTR909_bd/i, 'pop-punk drums should use audible sample-safe kick material');
assert.match(blinkDrumsTurn.response.tracks.drums || '', /RolandTR909_hh\*16/i, 'pop-punk drums need energetic 16th-note hats');
assert.doesNotMatch(blinkDrumsTurn.response.tracks.drums || '', /gain\(0\.075\)|gain\(0\.045\)|lpf\(150\)/i, 'pop-punk drums should not use the old quiet synth placeholder template');
assert.equal(blinkDrumsTurn.response.tracks.bass, 'silence', 'drums like blink182 should stay drum-only');
assert.equal(blinkDrumsTurn.response.tracks.melody, 'silence', 'drums like blink182 should stay drum-only');

const awkwardBlinkDrumsTurn = applyIntentTurn('make the drums some blink 182', repairedDrumsTurn.response);
assert.equal(awkwardBlinkDrumsTurn.intent.kind, 'style_reference');
assert.equal(awkwardBlinkDrumsTurn.intent.templateId, 'pop_punk_drums');
assert.match(awkwardBlinkDrumsTurn.response.tracks.drums || '', /RolandTR909_bd/i, 'awkward Blink phrasing should still use audible sample-safe drums');
assert.equal(awkwardBlinkDrumsTurn.response.tracks.bass, 'silence');
assert.equal(awkwardBlinkDrumsTurn.response.tracks.melody, 'silence');

const looseBlinkDrumsTurn = applyIntentTurn('some blink182 drums', repairedDrumsTurn.response);
assert.equal(looseBlinkDrumsTurn.intent.kind, 'style_reference');
assert.equal(looseBlinkDrumsTurn.intent.templateId, 'pop_punk_drums');
assert.match(looseBlinkDrumsTurn.response.thought, /pop-punk|punk/i, 'loose Blink phrasing should map to pop-punk traits');
assert.equal(looseBlinkDrumsTurn.response.tracks.bass, 'silence');
assert.equal(looseBlinkDrumsTurn.response.tracks.melody, 'silence');

const invalidQuietPopPunkDrums = validateGeneratedTracks({
    drums: "stack(note(m('[c2 c2] ~ c2 ~ c2 ~ [c2 c2] ~')).s('square').decay(0.065).lpf(150).gain(0.78), note(m('~ c4 ~ c4')).s('pink').decay(0.034).hpf(980).gain(0.24), note(m('c6*16')).s('pink').decay(0.009).hpf(8200).gain(0.075), note(m('~ ~ ~ c6 ~ ~ ~ c6')).s('pink').decay(0.015).hpf(6500).gain(0.045))",
    bass: 'silence',
    melody: 'silence',
    voice: 'silence',
    fx: 'silence',
}, 'make the drums some blink 182', undefined, blinkDrumsTurn.intent);
assert.equal(invalidQuietPopPunkDrums.valid, false, 'old quiet synth pop-punk placeholder should be rejected');

const michaelAfterBlinkContext = buildMusicContext({
    currentState: {
        bpm: looseBlinkDrumsTurn.response.bpm,
        tracks: looseBlinkDrumsTurn.response.tracks,
    } as unknown as Partial<SonicSessionState>,
});
assert.equal(michaelAfterBlinkContext.isDrumOnly, true, 'test setup should reproduce a previous drum-only context');
const michaelIntent = routeMusicIntent('play some michael jackson', michaelAfterBlinkContext);
assert.equal(michaelIntent.kind, 'create_full_style');
assert.equal(michaelIntent.templateId, 'pop_funk');
const michaelPipeline = buildLocalMusicAgentPipeline({
    prompt: 'play some michael jackson',
    context: michaelAfterBlinkContext,
    intent: michaelIntent,
    enableOpenRouter: false,
});
assert.equal(michaelPipeline.validation.valid, true, JSON.stringify(michaelPipeline.validation.issues));
assert.ok(hasTrack(michaelPipeline.tracks.drums), 'Michael Jackson-style request should include drums');
assert.ok(hasTrack(michaelPipeline.tracks.bass), 'Michael Jackson-style request should include bass');
assert.ok(hasTrack(michaelPipeline.tracks.melody), 'Michael Jackson-style request should include a hook');
assert.notEqual(michaelPipeline.tracks.bass, 'silence', 'full artist-style request must not inherit drum-only clearing');
assert.doesNotMatch(michaelPipeline.thought, /drum-only intent|deterministic fallback/i, 'full artist-style request should not expose drum-only validation fallback');
assert.doesNotMatch(Object.values(michaelPipeline.tracks).join(' '), /c2 ~ eb2 ~ g1 ~ eb2|c4 eb4 g4 bb4/i, 'Michael Jackson-style request should not use generic C-minor fallback notes');

const responseShapedContext = buildMusicContext({
    currentState: {
        bpm: looseBlinkDrumsTurn.response.bpm,
        tracks: looseBlinkDrumsTurn.response.tracks,
    } as unknown as Partial<SonicSessionState>,
});
assert.equal(responseShapedContext.isDrumOnly, true, 'API response-shaped currentState should still preserve drum-only context');

const insistedBlinkDrumsTurn = applyIntentTurn('i said some blink182 drums', repairedDrumsTurn.response);
assert.equal(insistedBlinkDrumsTurn.intent.kind, 'style_reference');
assert.equal(insistedBlinkDrumsTurn.intent.templateId, 'pop_punk_drums');
assert.equal(insistedBlinkDrumsTurn.response.tracks.bass, 'silence');
assert.equal(insistedBlinkDrumsTurn.response.tracks.melody, 'silence');

const comeOnTurn = applyIntentTurn('come on', looseBlinkDrumsTurn.response);
assert.equal(comeOnTurn.intent.kind, 'repair_current_context');
assert.equal(comeOnTurn.intent.templateId, 'repaired_drums');
assert.equal(comeOnTurn.response.tracks.bass, 'silence', 'come on after drum-only should not add bass');
assert.equal(comeOnTurn.response.tracks.melody, 'silence', 'come on after drum-only should not add melody');
assert.doesNotMatch(comeOnTurn.response.thought, /rejected unsafe|generic/i, 'complaint fallback should not expose validator noise or generic music');

const comeOneTurn = applyIntentTurn('come one', looseBlinkDrumsTurn.response);
assert.equal(comeOneTurn.intent.kind, 'repair_current_context');
assert.equal(comeOneTurn.response.tracks.bass, 'silence', 'come one typo should still repair drum-only context');
assert.equal(comeOneTurn.response.tracks.melody, 'silence');

const lowDrumsTurn = applyIntentTurn('low', doubleTapTurn.response);
assert.equal(lowDrumsTurn.intent.kind, 'modify_current_track');
assert.equal(lowDrumsTurn.intent.templateId, 'low_drums');
assert.equal(lowDrumsTurn.response.tracks.bass, 'silence', 'low after drum-only should not add bass');
assert.equal(lowDrumsTurn.response.tracks.melody, 'silence', 'low after drum-only should not add melody');
assert.match(lowDrumsTurn.response.thought, /lower|deeper|low/i);

const italoTurn = applyIntentTurn('techno italo 80s');
assert.equal(italoTurn.intent.kind, 'create_full_style');
assert.equal(italoTurn.intent.templateId, 'italo_80s');
assert.notEqual(italoTurn.response.tracks.drums, GENRE_TEMPLATES.techno.tracks.drums, 'Italo 80s should not replay generic techno drums');
assert.match(italoTurn.response.thought, /italo|80s|retro/i);

const italoRepeatTurn = applyIntentTurn('techno italo 80s', italoTurn.response);
assert.equal(italoRepeatTurn.intent.kind, 'create_full_style');
assert.equal(italoRepeatTurn.intent.templateId, 'italo_80s_alt');
assert.notEqual(italoRepeatTurn.response.tracks.drums, italoTurn.response.tracks.drums, 'repeated Italo 80s prompt should produce a variation');
assert.match(italoRepeatTurn.response.thought, /variation|changes|italo/i);

const tempoIntent = fasterTurn.intent;
const tempoValidation = validateGeneratedTracks(fasterTurn.response.tracks, 'faster', undefined, tempoIntent);
assert.equal(tempoValidation.valid, true, JSON.stringify(tempoValidation.issues));

const unsupportedDrumOnly = validateGeneratedTracks({
    drums: "s('RolandTR909_bd*4').slider('x').bank('RolandTR909').analyze(1)",
    bass: 'silence',
    melody: 'silence',
    voice: 'silence',
    fx: 'silence',
}, 'only drums', undefined, cleanDrumsTurn.intent);
assert.equal(unsupportedDrumOnly.valid, false, 'drum-only unsafe methods should be rejected');

const makeTrack = (id: InstrumentType, pattern: string): SonicSessionState['tracks'][InstrumentType] => ({
    id,
    name: id,
    pattern,
    muted: false,
    volume: 1,
});

const displayedCode = buildStrudelCode({
    bpm: 120,
    scale: 'C minor',
    isPlaying: true,
    tracks: {
        drums: makeTrack('drums', `expr:${looseBlinkDrumsTurn.response.tracks.drums}`),
        bass: makeTrack('bass', `expr:${looseBlinkDrumsTurn.response.tracks.bass}`),
        melody: makeTrack('melody', `expr:${looseBlinkDrumsTurn.response.tracks.melody}`),
        voice: makeTrack('voice', `expr:${looseBlinkDrumsTurn.response.tracks.voice}`),
        fx: makeTrack('fx', `expr:${looseBlinkDrumsTurn.response.tracks.fx}`),
    },
});
assert.doesNotMatch(displayedCode, /\.analyze\s*\(/, 'displayed Strudel code should not include analyzer helper calls');
assert.doesNotMatch(displayedCode, /triangle.*sine|supersaw|c4 eb4 g4/i, 'displayed drum-only code should not include stale tonal layers');

const rockFamilyPositiveCount = STRUDEL_TRAINING_CORPUS.filter((example) =>
    !example.negative && example.intentTags.some((tag) => ['rock', 'punk', 'metal'].includes(tag)),
).length;
assert.ok(rockFamilyPositiveCount >= 25, `expected at least 25 rock-family examples, got ${rockFamilyPositiveCount}`);

const retrievedRock = getRelevantTrainingExamples('play some rock', 3);
assert.ok(retrievedRock.some((example) => example.id === 'rock-001'), 'rock first-success example should be retrieved');

const emptyContext = buildMusicContext({});
const rockBrief = buildMusicBrief('classic rock in e minor', emptyContext, routeMusicIntent('classic rock in e minor', emptyContext));
MusicBriefSchema.parse(rockBrief);
assert.equal(rockBrief.genre, 'rock');
assert.equal(rockBrief.key, 'E minor');
assert.ok(rockBrief.targetTracks.includes('drums'), 'full rock brief should target drums');

const localRockPipeline = buildLocalMusicAgentPipeline({ prompt: 'play some rock', enableOpenRouter: false });
TheoryPlanSchema.parse(localRockPipeline.theory);
SoundPlanSchema.parse(localRockPipeline.sound);
QualityReviewSchema.parse(localRockPipeline.review);
assert.equal(localRockPipeline.validation.valid, true, JSON.stringify(localRockPipeline.validation.issues));
assert.ok(hasTrack(localRockPipeline.tracks.drums), 'local pipeline rock needs drums');
assert.ok(hasTrack(localRockPipeline.tracks.bass), 'local pipeline rock needs bass');
assert.ok(hasTrack(localRockPipeline.tracks.melody), 'local pipeline rock needs guitar-like melody');
assert.notEqual(localRockPipeline.tracks.melody, GENRE_TEMPLATES.rock.tracks.melody, 'local pipeline should not only copy the rock template melody');
assert.match(localRockPipeline.tracks.melody || '', /distort|sawtooth|square/i, 'local rock pipeline should sound guitar-like');

const localFunkPipeline = buildLocalMusicAgentPipeline({ prompt: 'funky groove', enableOpenRouter: false });
assert.equal(localFunkPipeline.brief.genre, 'funk');
assert.equal(localFunkPipeline.validation.valid, true, JSON.stringify(localFunkPipeline.validation.issues));
assert.match(localFunkPipeline.tracks.bass || '', /~/, 'funk bass should include syncopated rests');

const boomBapDrumsOnlyPipeline = buildLocalMusicAgentPipeline({ prompt: 'boom bap drums only', enableOpenRouter: false });
assert.equal(boomBapDrumsOnlyPipeline.brief.genre, 'boom_bap_drums');
assert.equal(boomBapDrumsOnlyPipeline.validation.valid, true, JSON.stringify(boomBapDrumsOnlyPipeline.validation.issues));
assert.ok(hasTrack(boomBapDrumsOnlyPipeline.tracks.drums), 'boom bap drums-only prompt needs drums');
assert.equal(boomBapDrumsOnlyPipeline.tracks.bass, 'silence', 'boom bap drums-only prompt must clear bass');
assert.equal(boomBapDrumsOnlyPipeline.tracks.melody, 'silence', 'boom bap drums-only prompt must clear melody');

const vagueMoodPipeline = buildLocalMusicAgentPipeline({ prompt: 'make something dark and cinematic', enableOpenRouter: false });
assert.ok(vagueMoodPipeline.brief.mood.includes('dark'), 'vague dark prompt should preserve mood in MusicBrief');
assert.equal(vagueMoodPipeline.validation.valid, true, JSON.stringify(vagueMoodPipeline.validation.issues));

const lessRoboticContext = buildMusicContext({
    currentState: {
        bpm: localRockPipeline.bpm,
        tracks: localRockPipeline.tracks,
    } as unknown as Partial<SonicSessionState>,
});
const lessRoboticIntent = routeMusicIntent('make this less robotic', lessRoboticContext);
const lessRoboticPipeline = buildLocalMusicAgentPipeline({
    prompt: 'make this less robotic',
    context: lessRoboticContext,
    intent: lessRoboticIntent,
    enableOpenRouter: false,
});
assert.equal(lessRoboticIntent.templateId, 'humanized_rock', 'less robotic should map to the humanized context path');
assert.equal(lessRoboticPipeline.validation.valid, true, JSON.stringify(lessRoboticPipeline.validation.issues));
assert.match(lessRoboticPipeline.thought, /human|syncop|rock/i, 'less robotic should not become generic music');
assert.ok(hasTrack(lessRoboticPipeline.tracks.drums), 'less robotic contextual edit should keep drums');
assert.ok(hasTrack(lessRoboticPipeline.tracks.bass), 'less robotic contextual edit should keep bass');
assert.ok(hasTrack(lessRoboticPipeline.tracks.melody), 'less robotic contextual edit should keep melody');

const retryDrumsOnlyPipeline = buildLocalMusicAgentPipeline({ prompt: 'try again but keep only the drums', enableOpenRouter: false });
assert.equal(retryDrumsOnlyPipeline.brief.requestedScope, 'track_only');
assert.equal(retryDrumsOnlyPipeline.validation.valid, true, JSON.stringify(retryDrumsOnlyPipeline.validation.issues));
assert.ok(hasTrack(retryDrumsOnlyPipeline.tracks.drums), 'retry drums-only prompt should keep drums');
assert.equal(retryDrumsOnlyPipeline.tracks.bass, 'silence');
assert.equal(retryDrumsOnlyPipeline.tracks.melody, 'silence');

const invalidMelodicDrums = validateGeneratedTracks({
    drums: "note(m('<c4 e4 g4>')).s('sawtooth').gain(0.7)",
    bass: 'silence',
    melody: 'silence',
    voice: 'silence',
    fx: 'silence',
}, 'drums only');
assert.equal(invalidMelodicDrums.valid, false, 'melodic synth material should not validate as drums');
assert.ok(invalidMelodicDrums.issues.some((issue) => issue.reason.includes('kick/snare/hat')), JSON.stringify(invalidMelodicDrums.issues));

const invalidHighBass = validateGeneratedTracks({
    drums: null,
    bass: "note(m('c5 e5 g5 c6')).s('sawtooth').hpf(1200).gain(0.5)",
    melody: null,
    voice: null,
    fx: null,
}, 'add bass');
assert.equal(invalidHighBass.valid, false, 'high lead-like material should not validate as bass');

const malformedUnsupportedRepair = validateGeneratedTracks({
    drums: "s('RolandTR909_bd*4'",
    bass: "note(m('c1 c1 c1 c1')).s('sawtooth').bank('bad')",
    melody: null,
    voice: null,
    fx: null,
}, 'repair this broken Strudel');
assert.equal(malformedUnsupportedRepair.valid, false, 'malformed and unsupported Strudel should be rejected before repair fallback');

console.log('Music quality regression tests passed.');
