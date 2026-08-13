import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    GENRE_TEMPLATES,
    buildDeterministicMusicResponse,
    buildIntentFallback,
    buildFallbackResponse,
    detectGenre,
    isDoubleTapDrumPrompt,
    isDrumOnlyPrompt,
    AgentUpdateResponse,
} from './src/lib/music/genreTemplates';
import { buildMusicContext, isPureChatGreeting, routeMusicIntent } from './src/lib/music/musicIntent';
import { STRUDEL_TRAINING_CORPUS, formatTrainingExamplesForPrompt, getRelevantTrainingExamples } from './src/lib/music/trainingCorpus';
import { validateGeneratedTracks } from './src/lib/music/strudelValidation';
import { buildStrudelCode, buildArrangementCode, formatStrudelDisplayCode } from './src/lib/strudel/engine';
import { createDefaultArrangement } from './src/lib/arrangement/sessionSync';
import {
    MusicBriefSchema,
    QualityReviewSchema,
    SoundPlanSchema,
    TheoryPlanSchema,
    applyTrackMapToState,
    buildLocalMusicAgentPipeline,
    buildMusicBrief,
    formatAgentGrounding,
} from './src/lib/music-agent';
import { cleanStrudelCode } from './src/lib/music/codeExtractor';
import { tryRuleBasedUpdate } from './src/lib/agent/runtime';
import { mapFftDecibelsToSsnnBands } from './src/lib/ssnn/fft';
import { getSsnnOutputCharacter } from './src/lib/ssnn/dsp';
import { createDefaultSSNNState } from './src/lib/ssnn/engine';
import type { SonicSessionState, InstrumentType } from './src/types/sonic';

const hasTrack = (value: string | null) => typeof value === 'string' && value.trim().length > 0;
const numericMethodValues = (value: string, method: string) => Array.from(
    value.matchAll(new RegExp(`\\.${method}\\(\\s*(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))\\s*\\)`, 'gi')),
).map((match) => Number(match[1])).filter(Number.isFinite);

const currentRockCode = Object.values(GENRE_TEMPLATES.rock.tracks)
    .filter(Boolean)
    .join('\n');

const rock = buildDeterministicMusicResponse('play some rock') as Extract<AgentUpdateResponse, { type: 'update_tracks' }>;
assert.ok(rock, 'rock prompt should use deterministic template');
assert.equal(rock?.type, 'update_tracks');
assert.ok(rock!.bpm >= 125 && rock!.bpm <= 145, 'rock BPM should be in rock range');
assert.ok(hasTrack(rock!.tracks.drums), 'rock needs drums');
assert.ok(hasTrack(rock!.tracks.bass), 'rock needs bass');
assert.ok(hasTrack(rock!.tracks.melody), 'rock needs riff/chord melody');
assert.match(rock!.tracks.melody || '', /distort|sawtooth|e2|b2/i, 'rock melody should be guitar-like');
assert.doesNotMatch(rock!.tracks.drums || '', /RolandTR909_bd\*4.*RolandTR909_hh\*16/i, 'rock should not be generic techno');

const humanized = buildDeterministicMusicResponse('that not even sound', currentRockCode) as Extract<AgentUpdateResponse, { type: 'update_tracks' }>;
assert.ok(humanized, 'less-even prompt should use deterministic humanized template');
assert.match(humanized!.thought, /human|syncopated|less rigid|syncopation/i);
assert.match(humanized!.tracks.drums || '', /RolandTR909_bd ~ ~ RolandTR909_bd/i, 'humanized drums should add controlled syncopation');

const repaired = buildDeterministicMusicResponse('sounds horrible', currentRockCode) as Extract<AgentUpdateResponse, { type: 'update_tracks' }>;
assert.ok(repaired, 'repair prompt should use deterministic repair template');
assert.match(repaired!.thought, /clean|simpl|distortion|harsh/i);
assert.doesNotMatch(repaired!.tracks.melody || '', /distort\(0\.[4-9]|gain\(1/i, 'repair should avoid high distortion/gain');

const pureDrums = buildDeterministicMusicResponse('some pure drums', currentRockCode) as Extract<AgentUpdateResponse, { type: 'update_tracks' }>;
assert.ok(pureDrums, 'pure drums should use deterministic drum-only template');
assert.equal(isDrumOnlyPrompt('some pure drums'), true);
assert.ok(hasTrack(pureDrums!.tracks.drums), 'pure drums needs a drum pattern');
assert.equal(pureDrums!.tracks.bass, 'silence', 'pure drums must clear existing bass');
assert.equal(pureDrums!.tracks.melody, 'silence', 'pure drums must clear existing melody');
assert.equal(pureDrums!.tracks.voice, 'silence', 'pure drums must clear existing voice');
assert.equal(pureDrums!.tracks.fx, 'silence', 'pure drums must clear existing fx');
assert.doesNotMatch(pureDrums!.tracks.drums || '', /c4 eb4|triangle|sawtooth.*lpf\(520\)/i, 'pure drums must not include generic bass/melody material');

const doubleTapDrums = buildDeterministicMusicResponse('double tap drums', pureDrums!.tracks.drums || '') as Extract<AgentUpdateResponse, { type: 'update_tracks' }>;
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
assert.equal(detectGenre('something like eminem'), 'hiphop');
assert.equal(detectGenre('something like eminen'), 'hiphop');
assert.equal(isPureChatGreeting('rock'), false, 'a one-word genre must not be mistaken for small-talk');
assert.equal(isPureChatGreeting('techno'), false, 'short recognized genres must reach music generation');
assert.equal(isPureChatGreeting('jazz'), false, 'jazz must not be mistaken for small-talk');
assert.equal(isPureChatGreeting('lofi'), false, 'lofi must not be mistaken for small-talk');
assert.equal(isPureChatGreeting('disco'), false, 'disco must not be mistaken for small-talk');
assert.equal(isPureChatGreeting('drill'), false, 'drill must not be mistaken for small-talk');
assert.equal(isPureChatGreeting('piano'), false, 'instrument prompt must not be mistaken for small-talk');
assert.equal(isPureChatGreeting('synth'), false, 'synth prompt must not be mistaken for small-talk');
assert.equal(isPureChatGreeting('chill'), false, 'mood prompt must not be mistaken for small-talk');
assert.equal(isPureChatGreeting('dark'), false, 'mood prompt must not be mistaken for small-talk');
assert.equal(isPureChatGreeting('hi'), true, 'hi is a greeting');
assert.equal(isPureChatGreeting('hello'), true, 'hello is a greeting');
assert.equal(isPureChatGreeting('hey there'), true, 'hey there is a greeting');
assert.equal(isPureChatGreeting('what\'s up'), true, 'what is up is conversational');
assert.equal(isPureChatGreeting('thanks'), true, 'thanks is conversational');
assert.equal(isPureChatGreeting('?'), true, 'a standalone question mark remains conversational');
// 2.6 strengthened tests for artist/concept detection (tiesto, ufo)
assert.equal(detectGenre('play some tiesto'), 'trance');
assert.equal(detectGenre('tiësto style'), 'trance');
assert.equal(detectGenre('make some UFO communication'), 'ambient');
assert.equal(detectGenre('ufo signals'), 'ambient');

const ctxTest = buildMusicContext({});
const tiestoIntent = routeMusicIntent('play some tiesto', ctxTest);
assert.equal(tiestoIntent.templateId, 'trance');
assert.ok(tiestoIntent.referenceStyle && tiestoIntent.referenceStyle.includes('Tiesto'), 'should have Tiesto ref style');
const ufoIntent = routeMusicIntent('make some UFO communication', ctxTest);
assert.equal(ufoIntent.templateId, 'ambient');
assert.ok(ufoIntent.referenceStyle && /UFO|cosmic/i.test(ufoIntent.referenceStyle || ''), 'ufo should set concept ref');

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
    return { intent, response: response as Extract<AgentUpdateResponse, { type: 'update_tracks' }> };
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

const makeTrack = (
    id: InstrumentType,
    pattern: string,
    overrides: Partial<SonicSessionState['tracks'][InstrumentType]> = {},
): SonicSessionState['tracks'][InstrumentType] => ({
    id,
    name: id,
    pattern,
    muted: false,
    volume: 1,
    ...overrides,
});

const controlState: SonicSessionState = {
    bpm: 120,
    scale: 'C minor',
    isPlaying: true,
    tracks: {
        drums: makeTrack('drums', "expr:s('RolandTR909_bd*4')"),
        bass: makeTrack('bass', "expr:note(m('c1 ~ c1 ~')).s('sine')"),
        melody: makeTrack('melody', "expr:note(m('c4 eb4 g4 ~')).s('square')"),
        voice: makeTrack('voice', "expr:note(m('c4 ~')).s('sine')"),
        fx: makeTrack('fx', "expr:s('pink').gain(0.1)"),
    },
};
const stoppedByChat = tryRuleBasedUpdate('stop playback', controlState);
assert.equal(stoppedByChat.changed, true, 'chat stop command should produce a state change');
assert.equal(stoppedByChat.newState.isPlaying, false, 'chat stop command must preserve stopped state through the API patch');

const mutedByChat = tryRuleBasedUpdate('mute bass', controlState);
assert.equal(mutedByChat.newState.tracks.bass.muted, true, 'chat mute command should mutate mixer state instead of regenerating music');

const balancedByChat = tryRuleBasedUpdate('balance the sound', controlState);
assert.equal(balancedByChat.newState.tracks.drums.volume, 0.82);
assert.equal(balancedByChat.newState.tracks.fx.volume, 0.35);
assert.ok(balancedByChat.newState.tracks.bass.volume < balancedByChat.newState.tracks.drums.volume, 'balanced mix should leave kick headroom over bass');

const ssnnTauByChat = tryRuleBasedUpdate('set SSNN tau to 7', controlState);
assert.equal(ssnnTauByChat.newState.ssnn?.tau, 7, 'chat should control individual SSNN parameters');
assert.equal(ssnnTauByChat.newState.ssnn?.isEnabled, false, 'SSNN parameter changes must not start the feature');

assert.equal(createDefaultSSNNState().isEnabled, false, 'SSNN must be off until the user explicitly runs it');
const startedSsnnByChat = tryRuleBasedUpdate('start SSNN', controlState);
assert.equal(startedSsnnByChat.newState.ssnn?.isEnabled, true, 'an explicit SSNN start command should enable the feature');
const stoppedSsnnByChat = tryRuleBasedUpdate('stop SSNN', startedSsnnByChat.newState);
assert.equal(stoppedSsnnByChat.newState.ssnn?.isEnabled, false, 'an explicit SSNN stop command should disable the feature without stopping the main transport');
assert.equal(stoppedSsnnByChat.newState.isPlaying, true, 'stopping SSNN must not stop normal music playback');

const stableSsnnByChat = tryRuleBasedUpdate('make the SSNN stable and less jittery', controlState);
assert.equal(stableSsnnByChat.newState.ssnn?.qntRnd, 0, 'stable SSNN command should remove quantization jitter');
assert.equal(stableSsnnByChat.newState.ssnn?.updateRate, 2, 'stable SSNN command should cap neural update load');

const forwardSsnnByChat = tryRuleBasedUpdate('make a SSNN sound harder and closer', controlState);
assert.equal(forwardSsnnByChat.changed, true, 'harder SSNN request should be handled as a control command');
assert.ok((forwardSsnnByChat.newState.ssnn?.mgain ?? 0) >= 1, 'harder SSNN should raise its master gain');
assert.ok((forwardSsnnByChat.newState.ssnn?.wetDry ?? 1) <= 0.22, 'harder SSNN should move toward a dry, forward mix');
assert.ok(Math.abs(forwardSsnnByChat.newState.ssnn?.columns[0].pan ?? 1) < 0.3, 'harder SSNN should narrow active voices');

const defaultSsnnCharacter = getSsnnOutputCharacter(0.32);
const distantSsnnCharacter = getSsnnOutputCharacter(0.8);
assert.ok(defaultSsnnCharacter.presenceDb > distantSsnnCharacter.presenceDb, 'drier SSNN mix should have more presence');
assert.ok(defaultSsnnCharacter.makeupGain > distantSsnnCharacter.makeupGain, 'drier SSNN mix should receive controlled makeup gain');
assert.ok(defaultSsnnCharacter.stereoWidth < distantSsnnCharacter.stereoWidth, 'drier SSNN mix should be narrower and closer');

const silentFft = new Float32Array(512).fill(-100);
const silentNeuralBands = mapFftDecibelsToSsnnBands(silentFft, 44100, 1024);
assert.equal(Math.max(...silentNeuralBands), 0, 'silent workstation FFT should not inject false neural energy');
const tonalFft = new Float32Array(512).fill(-100);
tonalFft[Math.round(440 / (44100 / 1024))] = -3;
const tonalNeuralBands = mapFftDecibelsToSsnnBands(tonalFft, 44100, 1024);
assert.ok(Math.max(...tonalNeuralBands) > 0.1, 'audible workstation FFT energy should reach at least one LIF input band');

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
assert.match(displayedCode, /^stack\(\n/, 'displayed Strudel code should use a root stack');
assert.match(displayedCode, /\/\/ 1\. Drums\n  stack\(/, 'displayed drum code should include a readable track comment and nested stack');
assert.doesNotMatch(displayedCode, /\/\/ \d+\. Bass|\/\/ \d+\. Melody|\/\/ \d+\. Voice|\/\/ \d+\. FX/, 'displayed drum-only code should not render silent track sections');

const orderedDisplayedCode = buildStrudelCode({
    bpm: 128,
    scale: 'C minor',
    isPlaying: true,
    tracks: {
        drums: makeTrack('drums', "expr:s('RolandTR909_bd*4')"),
        bass: makeTrack('bass', "expr:note(m('c1 ~ c1 ~')).s('sine').gain(0.7)"),
        melody: makeTrack('melody', "expr:note(m('c4 eb4 g4 ~')).s('square').gain(0.3)"),
        voice: makeTrack('voice', "expr:note(m('c4 ~')).s('sawtooth').vowel('a').gain(0.2)"),
        fx: makeTrack('fx', "expr:s('pink').hpf(7000).gain(0.05)"),
    },
});
const orderedDisplayLabels = ['// 1. Drums', '// 2. Bass', '// 3. Melody', '// 4. Voice', '// 5. FX'];
let previousDisplayLabelIndex = -1;
for (const label of orderedDisplayLabels) {
    const currentIndex = orderedDisplayedCode.indexOf(label);
    assert.ok(currentIndex > previousDisplayLabelIndex, `expected ${label} after previous display label`);
    previousDisplayLabelIndex = currentIndex;
}

const sparseDisplayedCode = buildStrudelCode({
    bpm: 96,
    scale: 'C minor',
    isPlaying: true,
    tracks: {
        drums: makeTrack('drums', "expr:s('RolandTR909_bd ~ RolandTR909_sd ~')"),
        bass: makeTrack('bass', 'expr:silence'),
        melody: makeTrack('melody', ''),
        voice: makeTrack('voice', "expr:note(m('c4 ~')).s('sine')", { muted: true }),
        fx: makeTrack('fx', "expr:s('pink').hpf(8000).gain(0.04)"),
    },
});
assert.match(sparseDisplayedCode, /\/\/ 1\. Drums/, 'sparse display should keep the active drums section');
assert.match(sparseDisplayedCode, /\/\/ 2\. FX/, 'sparse display should renumber the next active section');
assert.doesNotMatch(sparseDisplayedCode, /\/\/ \d+\. Bass|\/\/ \d+\. Melody|\/\/ \d+\. Voice/, 'sparse display should skip silent, empty, and muted tracks');

const arrangement = createDefaultArrangement();
const vocalLane = arrangement.groups[0].lanes.find((lane) => lane.name === 'Vocals');
const drumsLane = arrangement.groups[0].lanes.find((lane) => lane.name === 'Drums');
const bassLane = arrangement.groups[0].lanes.find((lane) => lane.name === 'Bass');
assert.ok(vocalLane?.clips[0], 'default arrangement should include a vocal clip');
assert.ok(drumsLane?.clips[0], 'default arrangement should include a drum clip');
assert.ok(bassLane?.clips[0], 'default arrangement should include a bass clip');
assert.equal(vocalLane!.clips[0].startBar, 0, 'vocal clip should start at bar 1');
assert.equal(drumsLane!.clips[0].startBar, 0, 'drum clip should start at bar 1');
assert.equal(bassLane!.clips[0].startBar, 8, 'bass clip should start later in the arrangement');
const arrangementCode = buildArrangementCode(arrangement);
assert.match(arrangementCode, /\.mask\("1 1 1 1 1 1 1 1"\)/, 'vocal clip should be masked to the first eight bars');
assert.match(arrangementCode, /\.mask\("0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1"\)/, 'bass clip should be masked to the second eight bars');
assert.doesNotMatch(arrangementCode, /\.bank\s*\(|\.slider\s*\(|\.analyze\s*\(/, 'arrangement playback code should stay within supported Strudel helpers');

const compactRawStack = "stack(stack(s('RolandTR909_bd ~ RolandTR909_bd ~').gain(0.78), s('~ RolandTR909_sd ~ RolandTR909_sd').gain(0.58), s('RolandTR909_hh*8').gain(0.16).hpf(6500)), note(m('c2 ~ eb2 ~ g1 ~ bb1 ~')).s('triangle').att(0.01).decay(0.2).lpf(520).gain(0.58), note(m('c4 eb4 g4 bb4')).s('sine').att(0.01).decay(0.2).room(0.25).gain(0.32).slow(2))";
const formattedRawStack = formatStrudelDisplayCode(compactRawStack);
assert.match(formattedRawStack, /\/\/ 1\. Drums\n  stack\(/, 'raw compact stack should become a commented drums section');
assert.match(formattedRawStack, /\/\/ 2\. Bass\n  note\(m\('c2 ~ eb2 ~ g1 ~ bb1 ~'\)\)/, 'raw compact stack should infer the bass section');
assert.match(formattedRawStack, /\n    \.s\('triangle'\)\n    \.att\(0\.01\)/, 'raw bass chain should be split into readable method lines');
assert.match(formattedRawStack, /\/\/ 3\. Melody\n  note\(m\('c4 eb4 g4 bb4'\)\)/, 'raw compact stack should infer the melody section');
assert.doesNotMatch(formattedRawStack, /^stack\(stack\(/, 'raw compact stack should not stay as one boring line');
assert.ok(formattedRawStack.split('\n').length >= 10, 'raw compact stack should render across multiple readable lines');
assert.equal(formatStrudelDisplayCode(formattedRawStack), formattedRawStack, 'display formatting should be idempotent for already-sectioned code');

const strudelCodeViewSource = readFileSync('src/components/StrudelCodeView.tsx', 'utf-8');
assert.match(strudelCodeViewSource, /<textarea[\s\S]*aria-label="Strudel code editor"/, 'workspace should keep one editable textarea code editor');
assert.match(strudelCodeViewSource, />\s*Copy Code\s*</, 'workspace should expose a clear Copy Code button');
assert.match(strudelCodeViewSource, />\s*Replace Workspace Code\s*</, 'workspace should expose a clear Replace Workspace Code button');
assert.match(strudelCodeViewSource, /strudel-code-highlight[\s\S]*aria-hidden="true"/, 'syntax highlight layer should remain accessibility-hidden');
assert.doesNotMatch(strudelCodeViewSource, /Formatted \(selectable for copy\)|Selectable formatted Strudel code stack/i, 'workspace must not render a duplicate read-only formatted code box');

const sonicInterfaceSource = readFileSync('src/components/SonicInterface.tsx', 'utf-8');
assert.equal((sonicInterfaceSource.match(/<StrudelCodeView\b/g) || []).length, 1, 'simple view should render exactly one StrudelCodeView workspace');
const sonicSocketSource = readFileSync('src/hooks/useSonicSocket.ts', 'utf-8');
assert.doesNotMatch(sonicSocketSource, /Fixed code:/, 'chat should not show a competing full-code output when workspace already holds code');

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

const oneWordRockPipeline = buildLocalMusicAgentPipeline({ prompt: 'rock', enableOpenRouter: false });
assert.equal(oneWordRockPipeline.brief.genre, 'rock', 'a one-word rock request should keep its genre through the pipeline');
assert.ok(hasTrack(oneWordRockPipeline.tracks.drums), 'a one-word rock request should generate drums');
assert.ok(hasTrack(oneWordRockPipeline.tracks.bass), 'a one-word rock request should generate bass');
assert.ok(hasTrack(oneWordRockPipeline.tracks.melody), 'a one-word rock request should generate a guitar-like part');
assert.doesNotMatch(oneWordRockPipeline.thought, /what kind of music/i, 'a one-word genre request must not receive the generic chat reply');

const hardRockContext = buildMusicContext({
    currentState: {
        bpm: localRockPipeline.bpm,
        tracks: localRockPipeline.tracks,
    } as unknown as Partial<SonicSessionState>,
});
const hardRockIntent = routeMusicIntent('hard rock', hardRockContext);
const overDistortedHardRock = validateGeneratedTracks({
    drums: "stack(s('RolandTR909_bd ~ RolandTR909_bd ~ ~ RolandTR909_bd ~ ~').gain(0.92), s('~ RolandTR909_sd ~ RolandTR909_sd').gain(0.75).hpf(450), s('RolandTR909_hh*8').gain(0.2).hpf(6000), s('~ ~ RolandTR909_oh ~').gain(0.15))",
    bass: "note(m('e1 e1 ~ e1 g1 ~ a1 g1')).s('sawtooth').att(0.01).decay(0.18).lpf(520).gain(0.68)",
    melody: "stack(note(m('e2 ~ g2 a2 ~ g2 e2 ~')).s('sawtooth').att(0.01).decay(0.15).hpf(120).lpf(2600).distort(0.25).gain(0.4), note(m('b2 ~ d3 e3 ~ d3 b2 ~')).s('sawtooth').att(0.01).decay(0.15).hpf(120).lpf(2600).distort(0.2).gain(0.3))",
    voice: null,
    fx: null,
}, 'hard rock', undefined, hardRockIntent);
assert.equal(overDistortedHardRock.valid, false, 'hard rock should reject excessive guitar distortion');
assert.ok(
    overDistortedHardRock.issues.some((issue) => /distortion/i.test(issue.reason)),
    JSON.stringify(overDistortedHardRock.issues),
);

const hardRockPipeline = buildLocalMusicAgentPipeline({
    prompt: 'hard rock',
    context: hardRockContext,
    intent: hardRockIntent,
    enableOpenRouter: false,
});
assert.equal(hardRockPipeline.validation.valid, true, JSON.stringify(hardRockPipeline.validation.issues));
assert.ok(
    numericMethodValues(hardRockPipeline.tracks.melody || '', 'distort').every((value) => value <= 0.18),
    'local hard rock should keep guitar distortion controlled',
);
assert.match(hardRockPipeline.tracks.melody || '', /e2|b2|g2|d3|a2|e3/i, 'local hard rock should stay tuned to E-minor root/fifth riff notes');

const localFunkPipeline = buildLocalMusicAgentPipeline({ prompt: 'funky groove', enableOpenRouter: false });
assert.equal(localFunkPipeline.brief.genre, 'funk');
assert.equal(localFunkPipeline.validation.valid, true, JSON.stringify(localFunkPipeline.validation.issues));
assert.match(localFunkPipeline.tracks.bass || '', /~/, 'funk bass should include syncopated rests');
// Regression root causes covered here:
// weak deterministic templates, incomplete genre-trait validation, under-specified
// artist/concept interpretation, and generic fallback code reaching the workspace.

const assertStylePipeline = (
    prompt: string,
    expectedGenre: string,
    bpmRange: [number, number],
    requiredPatterns: Array<[RegExp, string]>,
    forbiddenPatterns: Array<[RegExp, string]> = [],
) => {
    const context = buildMusicContext({});
    const intent = routeMusicIntent(prompt, context);
    assert.equal(intent.templateId, expectedGenre, `${prompt} should route to ${expectedGenre}`);
    const result = buildLocalMusicAgentPipeline({ prompt, context, intent, enableOpenRouter: false });
    MusicBriefSchema.parse(result.brief);
    TheoryPlanSchema.parse(result.theory);
    SoundPlanSchema.parse(result.sound);
    QualityReviewSchema.parse(result.review);
    assert.equal(result.brief.genre, expectedGenre);
    assert.ok(result.bpm >= bpmRange[0] && result.bpm <= bpmRange[1], `${prompt} BPM should be in expected range`);
    assert.equal(result.validation.valid, true, `${prompt} should validate: ${JSON.stringify(result.validation.issues)}`);
    assert.equal(result.review.listenability, true, `${prompt} should pass quality review: ${JSON.stringify(result.review.problems)}`);
    const joined = Object.values(result.tracks).filter(Boolean).join(' ');
    for (const [pattern, message] of requiredPatterns) {
        assert.match(joined, pattern, message);
    }
    for (const [pattern, message] of forbiddenPatterns) {
        assert.doesNotMatch(joined, pattern, message);
    }
    return result;
};

const localTiestoPipeline = assertStylePipeline(
    'Play some Tiësto',
    'trance',
    [136, 140],
    [
        [/supersaw/i, 'Tiësto-safe trance needs layered supersaw material'],
        [/~ a1/i, 'Tiësto-safe trance needs an offbeat A bass pattern'],
        [/hpf\(sine\.range|slow\(8|slow\(16/i, 'Tiësto-safe trance needs build/breakdown FX'],
        [/RolandTR909_bd\*4/i, 'Tiësto-safe trance still needs a driving 909 kick'],
    ],
    [
        [/c2 ~ eb2 ~ g1|c4 eb4 g4 bb4/i, 'Tiësto prompt must not reuse generic C-minor fallback material'],
    ],
);
assert.ok(localTiestoPipeline.brief.qualityTarget.requiredCodeTraits.includes('supersaw'), 'Tiësto quality target should require supersaw traits');
const tiestoGrounding = formatAgentGrounding('Play some Tiësto', localTiestoPipeline.brief, localTiestoPipeline.theory, localTiestoPipeline.sound);
assert.match(tiestoGrounding, /Quality target:/, 'OpenRouter grounding should include quality target');
assert.match(tiestoGrounding, /trance-002|supersaw|Tiesto/i, 'Grounding should surface Tiësto/trance examples or traits');

const localRootsReggaePipeline = assertStylePipeline(
    'Create dark Jamaican roots reggae',
    'reggae',
    [70, 78],
    [
        [/~ ~ RolandTR808_bd|~ ~ RolandTR909_sd/i, 'roots reggae needs a one-drop drum pocket'],
        [/g1 ~ ~ d2/i, 'roots reggae needs deep spacious bass'],
        [/~ <g3 bb3 d4>|delay\(/i, 'roots reggae needs offbeat skank/dub delay'],
    ],
    [
        [/RolandTR909_bd\*4|RolandTR808_bd\*4/i, 'roots reggae must not become four-on-floor dance music'],
    ],
);
assert.match(localRootsReggaePipeline.thought, /roots|reggae|dub|one-drop/i, 'roots reggae thought should describe the style identity');

const localBreakbeatPipeline = assertStylePipeline(
    'Make a 90s breakbeat track',
    'breakbeat_90s',
    [126, 138],
    [
        [/RolandTR909_bd ~ ~ RolandTR909_bd/i, '90s breakbeat needs broken kick placement'],
        [/RolandTR909_hh\*16/i, '90s breakbeat needs fast hat energy'],
        [/square|supersaw|crush/i, '90s breakbeat needs rave stabs or short synth hits'],
    ],
    [
        [/RolandTR909_bd\*4/i, '90s breakbeat must not be straight four-on-floor'],
    ],
);
assert.match(localBreakbeatPipeline.brief.qualityTarget.requiredCodeTraits.join(' '), /broken-beat|rave-stab/);

const localSpacesynthPipeline = assertStylePipeline(
    'Create a Koto-style spacesynth track',
    'spacesynth',
    [116, 128],
    [
        [/a1 a2/i, 'spacesynth needs octave square bass movement'],
        [/piano/i, 'Koto-style spacesynth should emulate pluck with supported piano/synth timbre'],
        [/a4 c5 d5 e5 g5/i, 'Koto-style spacesynth needs pentatonic lead contour'],
        [/room\(0\.9|slow\(16|pink/i, 'spacesynth needs cosmic pad/FX space'],
    ],
    [
        [/\.s\(['"]koto['"]\)/i, 'spacesynth must not use unsupported koto samples'],
    ],
);
assert.match(localSpacesynthPipeline.brief.qualityTarget.artistReference || '', /Koto/i);

const localCinematicPipeline = assertStylePipeline(
    'Make cinematic electronic music with relay and capacitor sounds',
    'cinematic_electronic',
    [88, 104],
    [
        [/crush\(|att\(0\.001\)|decay\(0\.03/i, 'cinematic relay/capacitor music needs fast electrical transients'],
        [/hpf\(sine\.range|room\(0\.65|slow\(16/i, 'cinematic electronic needs wide tension FX'],
        [/c1 ~ ~ g1/i, 'cinematic electronic needs dark bass anchors'],
    ],
    [
        [/RolandTR909_bd\*4/i, 'cinematic electronic should not collapse to generic EDM drums'],
    ],
);
assert.match(localCinematicPipeline.brief.qualityTarget.requiredCodeTraits.join(' '), /relay-clicks|capacitor-plucks/);

const deterministicRap = buildDeterministicMusicResponse('play some rap') as Extract<AgentUpdateResponse, { type: 'update_tracks' }>;
assert.ok(deterministicRap, 'plain rap should have deterministic hip-hop fallback coverage');
assert.match(deterministicRap!.thought, /rap|vocals|808/i, 'plain rap thought should describe a vocal-friendly rap beat');
assert.ok(hasTrack(deterministicRap!.tracks.drums), 'plain rap deterministic fallback needs drums');
assert.ok(hasTrack(deterministicRap!.tracks.bass), 'plain rap deterministic fallback needs bass');
assert.equal(deterministicRap!.tracks.melody, 'silence', 'plain rap deterministic fallback should explicitly clear melody');
assert.equal(deterministicRap!.tracks.voice, 'silence', 'plain rap deterministic fallback should explicitly clear voice');

const previousMelodicRapState: SonicSessionState = {
    bpm: 120,
    scale: 'C minor',
    isPlaying: true,
    tracks: {
        drums: makeTrack('drums', "expr:s('RolandTR909_bd*4')"),
        bass: makeTrack('bass', "expr:note(m('c2 ~ eb2 ~')).s('triangle')"),
        melody: makeTrack('melody', "expr:note(m('f4 ~ ab4 ~ c5 ~ eb5 ~ db5 ~')).s('sine').gain(0.24)"),
        voice: makeTrack('voice', "expr:note(m('c4')).s('sawtooth').vowel('a')"),
        fx: makeTrack('fx', "expr:s('pink').gain(0.05)"),
    },
};
const rapContextWithMelody = buildMusicContext({
    currentState: previousMelodicRapState,
});
const rapIntentWithMelody = routeMusicIntent('play some rap', rapContextWithMelody);
assert.deepEqual(rapIntentWithMelody.targetTracks, ['drums', 'bass'], 'plain rap should target the beat and sub, not a melodic lead');
assert.deepEqual(rapIntentWithMelody.clearTracks, ['melody', 'voice'], 'plain rap should clear prior melody/voice lanes');

const eminenIntent = routeMusicIntent('something like eminen', rapContextWithMelody);
assert.equal(eminenIntent.templateId, 'hiphop', 'misspelled Eminem-style prompt should route to hiphop traits');
assert.deepEqual(eminenIntent.targetTracks, ['drums', 'bass'], 'misspelled rap artist prompt should target beat and sub');
assert.deepEqual(eminenIntent.clearTracks, ['melody', 'voice'], 'misspelled rap artist prompt should clear prior melody/voice lanes');

const eminenComplaintIntent = routeMusicIntent('thats no even close to eminen', rapContextWithMelody);
assert.equal(eminenComplaintIntent.kind, 'create_full_style', 'rap artist complaint should reroute to the safe rap style instead of generic context repair');
assert.equal(eminenComplaintIntent.templateId, 'hiphop');
assert.equal(eminenComplaintIntent.referenceStyle, 'safe rap vocal-bed traits');
assert.deepEqual(eminenComplaintIntent.targetTracks, ['drums', 'bass']);
assert.deepEqual(eminenComplaintIntent.clearTracks, ['melody', 'voice']);

const localRapPipeline = buildLocalMusicAgentPipeline({ prompt: 'play some rap', enableOpenRouter: false });
assert.equal(localRapPipeline.brief.genre, 'hiphop');
assert.equal(localRapPipeline.validation.valid, true, JSON.stringify(localRapPipeline.validation.issues));
assert.match(localRapPipeline.tracks.drums || '', /RolandTR808_bd/i, 'rap beat needs an 808-style kick');
assert.match(localRapPipeline.tracks.drums || '', /RolandTR909_sd/i, 'rap beat needs a dry snare');
assert.match(localRapPipeline.tracks.bass || '', /\bf1\b/i, 'rap beat needs low F-minor bass');
assert.equal(localRapPipeline.tracks.melody, 'silence', 'plain rap pipeline should clear melody instead of adding a lead');
assert.equal(localRapPipeline.tracks.voice, 'silence', 'plain rap pipeline should clear voice to leave rap vocal space');
assert.doesNotMatch(localRapPipeline.thought, /minimal sine melody hook|melodic lead line/i, 'plain rap should not describe the old melodic-hook behavior');

const rapStateAfterClear = applyTrackMapToState({
    type: 'update_tracks',
    bpm: localRapPipeline.bpm,
    tracks: localRapPipeline.tracks,
    thought: localRapPipeline.thought,
}, previousMelodicRapState);
const rapDisplayedCode = buildStrudelCode(rapStateAfterClear);
assert.doesNotMatch(rapDisplayedCode, /f4 ~ ab4 ~ c5|vowel\('a'\)/i, 'plain rap should remove stale melody/voice from displayed playback code');

const localEminenPipeline = buildLocalMusicAgentPipeline({ prompt: 'something like eminen', enableOpenRouter: false });
assert.equal(localEminenPipeline.brief.genre, 'hiphop');
assert.equal(localEminenPipeline.validation.valid, true, JSON.stringify(localEminenPipeline.validation.issues));
assert.equal(localEminenPipeline.tracks.melody, 'silence', 'misspelled rap artist prompt should not add a clean sine hook');
assert.equal(localEminenPipeline.tracks.voice, 'silence', 'misspelled rap artist prompt should leave vocal space');
assert.match(localEminenPipeline.tracks.drums || '', /RolandTR808_bd/i, 'misspelled rap artist prompt needs 808-style kick material');
assert.match(localEminenPipeline.tracks.bass || '', /\bf1\b/i, 'misspelled rap artist prompt should use low F-minor rap bass, not generic C-minor fallback');
assert.doesNotMatch(Object.values(localEminenPipeline.tracks).join(' '), /c2 ~ eb2 ~ g1 ~ bb1|c4 eb4 g4 c5/i, 'misspelled rap artist prompt should not reuse the generic C-minor sine-hook failure');

const localEminenComplaintPipeline = buildLocalMusicAgentPipeline({
    prompt: 'thats no even close to eminen',
    context: rapContextWithMelody,
    intent: eminenComplaintIntent,
    enableOpenRouter: false,
});
assert.equal(localEminenComplaintPipeline.brief.genre, 'hiphop');
assert.equal(localEminenComplaintPipeline.validation.valid, true, JSON.stringify(localEminenComplaintPipeline.validation.issues));
assert.equal(localEminenComplaintPipeline.tracks.melody, 'silence', 'rap artist complaint should remove the melodic hook');
assert.equal(localEminenComplaintPipeline.tracks.voice, 'silence', 'rap artist complaint should preserve vocal space');
assert.match(localEminenComplaintPipeline.tracks.drums || '', /RolandTR808_bd/i, 'rap artist complaint should use the rap beat template');
assert.match(localEminenComplaintPipeline.tracks.bass || '', /\bf1\b/i, 'rap artist complaint should use low F-minor bass, not generic C-minor fallback');
assert.doesNotMatch(Object.values(localEminenComplaintPipeline.tracks).join(' '), /c4 ~ eb4 ~ g4 ~ bb4|square/i, 'rap artist complaint should not add the square-wave hook failure');

const invalidMelodicRap = validateGeneratedTracks({
    drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ ~ RolandTR808_bd ~').gain(0.92), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.75).hpf(400), s('RolandTR909_hh*8').gain(0.12).hpf(8000))",
    bass: "note(m('f1 ~ f1 ~ ab1 ~ eb1 ~ db1 ~')).s('sine').att(0.01).decay(0.3).lpf(110).gain(0.78)",
    melody: "note(m('f4 ~ ab4 ~ c5 ~ eb5 ~ db5 ~')).s('sine').att(0.02).decay(0.25).hpf(300).room(0.25).gain(0.24).slow(2)",
    voice: null,
    fx: null,
}, 'play some rap');
assert.equal(invalidMelodicRap.valid, false, 'old melodic sine-hook rap output should be rejected');
assert.ok(
    invalidMelodicRap.issues.some((issue) => /vocal space|melodic lead/i.test(issue.reason)),
    JSON.stringify(invalidMelodicRap.issues),
);

const invalidEminenStyleRap = validateGeneratedTracks({
    drums: "stack(s('RolandTR909_bd ~ RolandTR909_bd ~').gain(0.85), s('~ RolandTR909_sd ~ RolandTR909_sd').gain(0.7).hpf(400), s('RolandTR909_hh*8').gain(0.2).hpf(6000))",
    bass: "note(m('c2 ~ eb2 ~ g1 ~ bb1')).s('triangle').att(0.01).decay(0.3).lpf(400).gain(0.6)",
    melody: "note(m('c4 eb4 g4 c5')).s('sine').att(0.01).decay(0.15).room(0.3).gain(0.25).slow(2)",
    voice: null,
    fx: null,
}, 'something like eminen');
assert.equal(invalidEminenStyleRap.valid, false, 'generic C-minor sine-hook rap artist output should be rejected');
assert.ok(
    invalidEminenStyleRap.issues.some((issue) => /vocal space|melodic lead/i.test(issue.reason)),
    JSON.stringify(invalidEminenStyleRap.issues),
);

const invalidEminenComplaintRap = validateGeneratedTracks({
    drums: "stack(s('RolandTR909_bd ~ RolandTR909_bd ~ RolandTR909_bd ~ ~ ~').gain(0.85), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.7).hpf(400), s('RolandTR909_hh*16').gain(0.15).hpf(7000))",
    bass: "note(m('c2 ~ c2 eb2 ~ g1 ~ bb1')).s('sawtooth').att(0.01).decay(0.25).lpf(600).gain(0.55)",
    melody: "note(m('c4 ~ eb4 ~ g4 ~ bb4 ~')).s('square').att(0.01).decay(0.15).lpf(1200).gain(0.25)",
    voice: null,
    fx: "s('pink').decay(0.1).hpf(2000).gain(0.05)",
}, 'thats no even close to eminen');
assert.equal(invalidEminenComplaintRap.valid, false, 'square-wave hook correction output should be rejected for misspelled rap artist complaint');
assert.ok(
    invalidEminenComplaintRap.issues.some((issue) => /vocal space|melodic lead/i.test(issue.reason)),
    JSON.stringify(invalidEminenComplaintRap.issues),
);

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

// ─── Regression: clean Strudel chains (no redundant nested parens) ─────────────
const nastyNestedVoice = "(((((stack(note(m('<c4 e4 g4>'))).s('sawtooth').vowel('a').room(0.84)).delay(0.72)).slow(1.10)).gain(0.54)))";
const cleanedVoice = cleanStrudelCode(nastyNestedVoice);
assert.doesNotMatch(cleanedVoice, /\(\s*\(\s*\(\s*\(/, 'cleanStrudelCode must remove deep redundant nesting');
assert.match(cleanedVoice, /^stack\(|^note\(/, 'cleaned voice must start with valid root expr');
assert.ok(!/^\(/.test(cleanedVoice) || cleanedVoice.split('(').length < 8, 'cleaned result must not retain excessive outer parens');

const technoPipeline = buildLocalMusicAgentPipeline({ prompt: 'make techno', enableOpenRouter: false });
assert.equal(technoPipeline.validation.valid, true, JSON.stringify(technoPipeline.validation.issues));
assert.ok(hasTrack(technoPipeline.tracks.drums), 'techno must produce drums');
assert.match(technoPipeline.tracks.drums || '', /RolandTR909_bd\*4/, 'techno must use four-on-floor kick');
assert.match(technoPipeline.tracks.drums || '', /RolandTR909_cp/, 'techno must include clap on 2&4');
assert.match(technoPipeline.tracks.drums || '', /RolandTR909_hh\*16/, 'techno must drive 16th hats');
assert.ok(hasTrack(technoPipeline.tracks.bass), 'techno must produce bass');
assert.match(technoPipeline.tracks.bass || '', /c1|eb1/, 'techno bass must use low roots');
assert.match(technoPipeline.tracks.bass || '', /lpf\(|\.lpf\(/, 'techno bass must be filtered');
assert.doesNotMatch((technoPipeline.tracks.bass || '') + (technoPipeline.tracks.drums || ''), /melody|supersaw.*c4/i, 'techno should not bleed melody into bass/drums by default');
assert.equal(technoPipeline.tracks.melody, null, 'techno default should keep melody null for clear separation');

// Voice must be clean if produced
const voicePipeline = buildLocalMusicAgentPipeline({ prompt: 'add angel choir voices', enableOpenRouter: false });
if (voicePipeline.tracks.voice) {
    assert.doesNotMatch(voicePipeline.tracks.voice, /\(\s*\(\s*\(\s*\(/, 'voice track must never contain redundant triple+ nested parens');
    assert.match(voicePipeline.tracks.voice, /vowel\(|stack\(/, 'voice should use formant or stack');
}

// Role separation and validate still works
const roleCheck = validateGeneratedTracks(technoPipeline.tracks, 'make techno');
assert.equal(roleCheck.valid, true, 'techno output must pass validateGeneratedTracks role separation');

// All final tracks must pass the no-deep-nest test after full pipeline
for (const tid of ['drums', 'bass', 'melody', 'voice', 'fx'] as const) {
    const t = technoPipeline.tracks[tid];
    if (t && t !== 'silence') {
        assert.doesNotMatch(t, /\(\s*\(\s*\(\s*\(/, `${tid} must not emit deeply nested parens`);
    }
}

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

const unsafeCopiedSongScriptPattern = /\b(?:const|let|register|setDefaultVoicings|arrange|samples|setcpm|cpm)\b|\.bank\s*\(|\._pianoroll|\.slider\s*\(|\.analyze\s*\(/i;
const awesomeSongPromptCases = [
    { prompt: 'play grimes music 4 machines cover', genre: 'grimes_m4m', bpm: 135 },
    { prompt: 'play charli xcx 360 remix', genre: 'charli_360', bpm: 120 },
    { prompt: 'play bug from heaven by eefano', genre: 'bug_from_heaven', bpm: 128 },
    { prompt: 'play stranger things theme song', genre: 'stranger_things', bpm: 168 },
    { prompt: 'play radiohead pyramid song cover', genre: 'pyramid_song', bpm: 104 },
    { prompt: 'play rhythm of the night by corona', genre: 'rhythm_of_the_night', bpm: 128 },
    { prompt: 'play pump up the jam cover', genre: 'pump_up_the_jam', bpm: 124 },
    { prompt: 'play happy birthday song', genre: 'happy_birthday', bpm: 120 },
    { prompt: 'play shostakovich waltz 2', genre: 'shostakovich_waltz', bpm: 180 },
    { prompt: 'play old macdonald song', genre: 'old_macdonald', bpm: 70 },
    { prompt: 'play blue monday remix by new order', genre: 'blue_monday', bpm: 130 },
    { prompt: 'play determination theme from undertale', genre: 'undertale_determination', bpm: 115 },
    { prompt: 'play billie eilish birds of a feather cover', genre: 'billie_birds', bpm: 104 },
] as const;

for (const { prompt, genre, bpm } of awesomeSongPromptCases) {
    const songPipeline = buildLocalMusicAgentPipeline({ prompt, enableOpenRouter: false });
    assert.equal(songPipeline.brief.genre, genre, `${prompt} should route to ${genre}`);
    assert.equal(songPipeline.bpm, bpm, `${prompt} should keep the reference BPM`);
    assert.equal(songPipeline.validation.valid, true, `${prompt} pipeline validation failed: ${JSON.stringify(songPipeline.validation.issues)}`);

    const directValidation = validateGeneratedTracks(GENRE_TEMPLATES[genre].tracks, prompt);
    assert.equal(directValidation.valid, true, `${prompt} template validation failed: ${JSON.stringify(directValidation.issues)}`);

    const generatedCode = Object.values(songPipeline.tracks).filter(Boolean).join('\n');
    assert.ok(
        Object.values(songPipeline.tracks).some((track) => track && track !== 'silence'),
        `${prompt} should produce at least one playable track`,
    );
    assert.doesNotMatch(generatedCode, unsafeCopiedSongScriptPattern, `${prompt} must not emit copied helper-heavy full-song code`);
    assert.doesNotMatch(songPipeline.thought, /full arrangement|authentic/i, `${prompt} should describe reference traits, not promise an exact copied cover`);
}

const blueMondayGrounding = formatTrainingExamplesForPrompt('play blue monday remix by new order');
assert.match(blueMondayGrounding, /AWESOME STRUDEL SOURCE REFERENCES/, 'song prompts should retrieve Awesome Strudel reference notes');
assert.match(blueMondayGrounding, /Blue Monday/, 'Blue Monday reference should be named in grounding');
assert.doesNotMatch(blueMondayGrounding, /\bconst\s+kick1\b|arrange\s*\(/, 'grounding should summarize source traits instead of copying raw source scripts');

// Hip-Hop / Rap prompt expansion tests
const hiphopPrompts = ['play some rap', 'play some hip-hop', 'play some hiphop', 'play some boom bap', 'something like eminem', 'something like eminen', 'thats no even close to eminen'];
const invalidMelodicTrackMap = {
    drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ ~ RolandTR808_bd ~').gain(0.92), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.75).hpf(400), s('RolandTR909_hh*8').gain(0.12).hpf(8000))",
    bass: "note(m('f1 ~ f1 ~ ab1 ~ eb1 ~ db1 ~')).s('sine').att(0.01).decay(0.3).lpf(110).gain(0.78)",
    melody: "note(m('f4 ~ ab4 ~ c5 ~ eb5 ~ db5 ~')).s('sine').att(0.02).decay(0.25).hpf(300).room(0.25).gain(0.24).slow(2)",
    voice: null,
    fx: null,
};

for (const prompt of hiphopPrompts) {
    const valResult = validateGeneratedTracks(invalidMelodicTrackMap, prompt);
    assert.equal(valResult.valid, false, `Prompt "${prompt}" should reject high melodic notes in rap/hiphop context`);
    assert.ok(
        valResult.issues.some((issue) => /vocal space|melodic lead/i.test(issue.reason)),
        `Expected issue with vocal space/melodic lead for prompt "${prompt}", got: ${JSON.stringify(valResult.issues)}`
    );
}

// Step count validation tests
const invalid10StepTrackMap = {
    drums: "s('RolandTR909_bd ~ RolandTR909_bd ~').gain(1)",
    bass: "note(m('c1 c1 c1 c1 c1 c1 c1 c1 c1 c1')).s('sawtooth')", // 10 steps (non-standard)
    melody: null,
    voice: null,
    fx: null,
};
const valResult10 = validateGeneratedTracks(invalid10StepTrackMap, 'play some techno');
assert.equal(valResult10.valid, false, '10-step pattern should be rejected by step count validator');
assert.ok(
    valResult10.issues.some((issue) => issue.reason.includes('non-standard step count of 10')),
    `Expected non-standard step count of 10 error, got: ${JSON.stringify(valResult10.issues)}`
);

const invalid9StepTrackMap = {
    drums: "s('RolandTR909_bd ~ RolandTR909_bd ~').gain(1)",
    bass: null,
    melody: "note('c d e f g a b c d')", // 9 steps (non-standard)
    voice: null,
    fx: null,
};
const valResult9 = validateGeneratedTracks(invalid9StepTrackMap, 'play some techno');
assert.equal(valResult9.valid, false, '9-step pattern should be rejected by step count validator');
assert.ok(
    valResult9.issues.some((issue) => issue.reason.includes('non-standard step count of 9')),
    `Expected non-standard step count of 9 error, got: ${JSON.stringify(valResult9.issues)}`
);

const valid8And16StepTrackMap = {
    drums: "s('RolandTR909_bd ~ RolandTR909_bd ~').gain(1)", // 4 steps
    bass: "note(m('c1 c1 c1 c1')).s('sawtooth')", // 4 steps
    melody: "note('c d e f g a b c')", // 8 steps
    voice: null,
    fx: null,
};
const valResultValid = validateGeneratedTracks(valid8And16StepTrackMap, 'play some techno');
assert.equal(valResultValid.valid, true, `Standard step counts should pass validation: ${JSON.stringify(valResultValid.issues)}`);

console.log('Music quality regression tests passed.');
