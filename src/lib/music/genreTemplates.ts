import { InstrumentType } from '@/types/sonic';
import type { MusicContext, MusicIntent } from './musicIntent';

export type TrackMap = Record<InstrumentType, string | null>;

export type GenreKey =
    | 'rock'
    | 'punk'
    | 'metal'
    | 'funk'
    | 'pop_funk'
    | 'pop'
    | 'jazz'
    | 'hiphop'
    | 'latin'
    | 'reggae'
    | 'techno'
    | 'italo_80s'
    | 'italo_80s_alt'
    | 'house'
    | 'ambient'
    | 'dnb'
    | 'trance'
    | 'acid'
    | 'minimal'
    | 'drums'
    | 'clean_drums'
    | 'tight_clean_drums'
    | 'double_tap_drums'
    | 'triple_tap_drums'
    | 'low_drums'
    | 'humanized_drums'
    | 'repaired_drums'
    | 'pop_punk_drums'
    | 'punk_fast_hats'
    | 'metal_double_kick'
    | 'boom_bap_drums'
    | 'dnb_breakbeat'
    | 'clean_rock'
    | 'humanized_rock'
    | 'grimes_m4m'
    | 'charli_360'
    | 'bug_from_heaven'
    | 'stranger_things'
    | 'pyramid_song'
    | 'rhythm_of_the_night'
    | 'pump_up_the_jam'
    | 'happy_birthday'
    | 'shostakovich_waltz'
    | 'old_macdonald'
    | 'blue_monday'
    | 'undertale_determination'
    | 'billie_birds'
    | 'generic';

export type AgentUpdateResponse = {
    type: 'update_tracks';
    thought: string;
    bpm: number;
    tracks: TrackMap;
};

export type GenreTemplate = {
    id: GenreKey;
    aliases: string[];
    intentTags: string[];
    bpm: number;
    key: string;
    scale: string;
    thought: string;
    tracks: TrackMap;
    requiredTracks: InstrumentType[];
    qualityNotes: string[];
};

const tracks = (value: Partial<TrackMap>): TrackMap => ({
    drums: null,
    bass: null,
    melody: null,
    voice: null,
    fx: null,
    ...value,
});

export const GENRE_TEMPLATES: Record<GenreKey, GenreTemplate> = {
    rock: {
        id: 'rock',
        aliases: ['rock', 'classic rock', 'guitar rock', 'power chord', 'riff'],
        intentTags: ['rock', 'guitar', 'riff', 'backbeat', 'power-chords'],
        bpm: 136,
        key: 'E minor',
        scale: 'E minor',
        thought: 'Rock: tight backbeat drums, root-note bass, and a controlled distorted power-chord riff in E minor.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ RolandTR909_bd ~').gain(0.95), s('~ RolandTR909_sd ~ RolandTR909_sd').gain(0.78).hpf(450), s('RolandTR909_hh*8').gain(0.22).hpf(6000), s('~ ~ RolandTR909_oh ~').gain(0.16))",
            bass: "note(m('e1 e1 ~ e1 g1 ~ a1 g1')).s('sawtooth').att(0.01).decay(0.18).lpf(520).gain(0.68)",
            melody: "stack(note(m('e2 ~ g2 a2')).s('sawtooth').att(0.01).decay(0.18).hpf(120).lpf(2600).distort(0.18).gain(0.42), note(m('b2 ~ d3 e3')).s('sawtooth').att(0.01).decay(0.18).hpf(120).lpf(2600).distort(0.18).gain(0.32))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Backbeat snare on 2 and 4', 'Controlled distortion', 'Bass and riff share E minor'],
    },
    punk: {
        id: 'punk',
        aliases: ['punk', 'pop punk', 'fast punk'],
        intentTags: ['punk', 'fast', 'downstrokes', 'guitar'],
        bpm: 176,
        key: 'A minor',
        scale: 'A minor',
        thought: 'Punk: fast straight drums, driving eighth-note bass, and short distorted power chords in A minor.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*4').gain(0.95), s('~ RolandTR909_sd ~ RolandTR909_sd').gain(0.82).hpf(500), s('RolandTR909_hh*16').gain(0.24).hpf(6500))",
            bass: "note(m('a1 a1 a1 a1 g1 g1 e1 e1')).s('sawtooth').att(0.005).decay(0.11).lpf(650).gain(0.72)",
            melody: "stack(note(m('a2 a2 g2 e2')).s('sawtooth').att(0.005).decay(0.12).hpf(160).lpf(2800).distort(0.22).gain(0.44), note(m('e3 e3 d3 b2')).s('sawtooth').att(0.005).decay(0.12).hpf(160).lpf(2800).distort(0.2).gain(0.32))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Fast but simple', 'No random effects', 'Short envelopes keep the riff clear'],
    },
    metal: {
        id: 'metal',
        aliases: ['metal', 'heavy metal', 'hard metal', 'chug'],
        intentTags: ['metal', 'heavy', 'chug', 'double-kick', 'guitar'],
        bpm: 150,
        key: 'E minor',
        scale: 'E minor',
        thought: 'Metal: tight double-kick pulse, heavy palm-muted E minor chug, and low bass support without excess mud.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*8').gain(0.85).lpf(180), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.78).hpf(520), s('RolandTR909_hh*16').gain(0.18).hpf(7000))",
            bass: "note(m('e1 e1 e1 ~ e1 g1 e1 d1')).s('sawtooth').att(0.005).decay(0.12).lpf(420).gain(0.74)",
            melody: "stack(note(m('e2 e2 e2 ~ e2 g2 e2 d2')).s('sawtooth').att(0.002).decay(0.09).hpf(140).lpf(2300).distort(0.28).gain(0.45), note(m('b2 b2 b2 ~ b2 d3 b2 a2')).s('sawtooth').att(0.002).decay(0.09).hpf(140).lpf(2300).distort(0.24).gain(0.3))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Aggressive but not clipped', 'Kick low-pass avoids harsh click', 'Guitar highs capped'],
    },
    funk: {
        id: 'funk',
        aliases: ['funk', 'funky', 'groove'],
        intentTags: ['funk', 'syncopated', 'groove', 'bass'],
        bpm: 104,
        key: 'C minor',
        scale: 'C minor',
        thought: 'Funk: syncopated kick, snappy backbeat, active bass, and clipped chord stabs.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ RolandTR808_bd ~ ~').gain(0.9), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.72), s('RolandTR909_hh*16').gain(0.16).hpf(6500))",
            bass: "note(m('c2 ~ eb2 g1 ~ c2 bb1 ~')).s('triangle').att(0.005).decay(0.16).lpf(760).gain(0.76)",
            melody: "note(m('~ <eb4 g4> ~ <c4 eb4> ~ <g4 bb4> ~ ~')).s('square').att(0.005).decay(0.08).hpf(500).lpf(3200).gain(0.34)",
        }),
        requiredTracks: ['drums', 'bass'],
        qualityNotes: ['Syncopation stays readable', 'Bass leads the groove'],
    },
    pop_funk: {
        id: 'pop_funk',
        aliases: ['pop funk', 'dance pop funk', 'michael jackson', 'mj pop'],
        intentTags: ['pop-funk', 'dance-pop', 'funk', 'artist-reference'],
        bpm: 116,
        key: 'F minor',
        scale: 'F minor pentatonic',
        thought: 'Pop-funk dance traits: tight backbeat, syncopated bass, and a bright short hook without copying any artist melody.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ RolandTR808_bd ~ ~').gain(0.9), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.72).hpf(520), s('RolandTR909_hh*16').gain(0.16).hpf(7000), s('~ RolandTR909_cp ~ ~ ~ RolandTR909_cp ~ ~').gain(0.26).hpf(1400))",
            bass: "note(m('f1 ~ f1 ab1 ~ c2 eb2 ~')).s('triangle').att(0.006).decay(0.15).lpf(760).gain(0.72)",
            melody: "note(m('~ f4 ab4 ~ c5 ~ eb5 c5')).s('square').att(0.004).decay(0.08).hpf(520).lpf(3400).gain(0.3)",
            fx: "s('pink').hpf(sine.range(1800, 7000).slow(8)).gain(sine.range(0.025, 0.09).slow(8)).room(0.18)",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Safe artist reference maps to genre traits only', 'Syncopated bass', 'Short hook is original', 'Dance-pop backbeat'],
    },
    pop: {
        id: 'pop',
        aliases: ['pop', 'radio pop', 'catchy'],
        intentTags: ['pop', 'catchy', 'simple', 'hook'],
        bpm: 118,
        key: 'C major',
        scale: 'C major',
        thought: 'Pop: clean beat, supportive bass, and a simple hook that leaves room for vocals.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd*4').gain(0.82), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.62), s('RolandTR909_hh*8').gain(0.18).hpf(6500))",
            bass: "note(m('c2 ~ g1 ~ a1 ~ f1 ~')).s('triangle').att(0.01).decay(0.2).lpf(620).gain(0.62)",
            melody: "note(m('e4 g4 a4 g4 e4 d4 c4 ~')).s('sine').att(0.01).decay(0.22).room(0.25).gain(0.38).slow(2)",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Memorable hook', 'Low distortion', 'Moderate density'],
    },
    jazz: {
        id: 'jazz',
        aliases: ['jazz', 'swing', 'jazzy'],
        intentTags: ['jazz', 'walking-bass', 'chords'],
        bpm: 92,
        key: 'D minor',
        scale: 'D minor',
        thought: 'Jazz: brushed-feel percussion, walking bass, and warm piano-like chord color.',
        tracks: tracks({
            drums: "stack(s('~ RolandTR808_sd ~ RolandTR808_sd').gain(0.38).hpf(450), s('RolandTR909_hh ~ RolandTR909_hh ~').gain(0.16).hpf(6500), s('~ ~ RolandTR808_bd ~').gain(0.5))",
            bass: "note(m('d2 f2 a1 c2 e2 f2 a1 c2')).s('triangle').att(0.01).decay(0.28).lpf(520).gain(0.62).slow(2)",
            melody: "note(m('<d4 f4 a4> ~ <c4 e4 g4> ~')).s('piano').decay(0.25).room(0.32).lpf(4200).gain(0.34).slow(2)",
        }),
        requiredTracks: ['bass', 'melody'],
        qualityNotes: ['Soft drums', 'Walking contour', 'Warm chords'],
    },
    hiphop: {
        id: 'hiphop',
        aliases: ['hip hop', 'hip-hop', 'rap beat', 'boom bap', 'trap'],
        intentTags: ['hiphop', 'beat', 'bass'],
        bpm: 92,
        key: 'F minor',
        scale: 'F minor',
        thought: 'Hip-hop: punchy half-time drums, sub bass, and sparse minor-key hook.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ ~ RolandTR808_bd ~').gain(0.95), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.76), s('RolandTR909_hh*8').gain(0.2).hpf(7000))",
            bass: "note(m('f1 ~ f1 ~ ab1 ~ eb1 ~')).s('sine').att(0.01).decay(0.28).lpf(110).gain(0.82)",
            melody: "note(m('f4 ~ ab4 ~ c5 ~ eb5 ~')).s('sine').att(0.01).decay(0.2).hpf(450).room(0.35).gain(0.28).slow(2)",
        }),
        requiredTracks: ['drums', 'bass'],
        qualityNotes: ['Sparse top line', 'Sub is filtered', 'Kick and snare stay clear'],
    },
    latin: {
        id: 'latin',
        aliases: ['latin', 'salsa', 'cumbia', 'reggaeton'],
        intentTags: ['latin', 'syncopated', 'percussion'],
        bpm: 116,
        key: 'A minor',
        scale: 'A minor',
        thought: 'Latin: syncopated percussion, warm bass movement, and bright bell-like accents.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ RolandTR808_bd ~ ~').gain(0.86), s('~ RolandTR909_cp ~ ~ ~ RolandTR909_cp ~ ~').gain(0.58), note(m('c6 ~ c6 c6 ~ c6 ~ c6')).s('pink').hpf(7200).decay(0.014).gain(0.24))",
            bass: "note(m('a1 ~ e2 ~ g1 ~ e2 ~')).s('triangle').att(0.01).decay(0.18).lpf(620).gain(0.68)",
            melody: "note(m('a4 c5 e5 ~ g4 e5 c5 ~')).s('sine').att(0.005).decay(0.16).hpf(700).room(0.25).gain(0.34).slow(2)",
        }),
        requiredTracks: ['drums', 'bass'],
        qualityNotes: ['Percussion is bright but quiet', 'Bass follows clave-like accents'],
    },
    reggae: {
        id: 'reggae',
        aliases: ['reggae', 'dub', 'ska'],
        intentTags: ['reggae', 'offbeat', 'dub'],
        bpm: 76,
        key: 'G minor',
        scale: 'G minor',
        thought: 'Reggae: laid-back one-drop feel, deep bass, and offbeat chord chops.',
        tracks: tracks({
            drums: "stack(s('~ ~ RolandTR808_bd ~').gain(0.85), s('~ ~ RolandTR909_sd ~').gain(0.68), s('RolandTR909_hh ~ RolandTR909_hh ~').gain(0.15).hpf(6500))",
            bass: "note(m('g1 ~ ~ d2 ~ bb1 ~ d2')).s('triangle').att(0.01).decay(0.32).lpf(420).gain(0.78).slow(2)",
            melody: "note(m('~ <g3 bb3> ~ <f3 a3>')).s('square').att(0.005).decay(0.08).hpf(450).lpf(2200).delay(0.22).room(0.25).gain(0.3)",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Offbeat chops', 'Deep but controlled bass', 'Slow pocket'],
    },
    techno: {
        id: 'techno',
        aliases: ['techno', 'rave', 'industrial techno'],
        intentTags: ['techno', 'four-on-floor', 'electronic'],
        bpm: 132,
        key: 'C minor',
        scale: 'C minor',
        thought: 'Techno: industrial 4/4 kick, clap on 2 and 4, driving hats, and dark bass.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*4').gain(1), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.8), s('RolandTR909_hh*16').gain(0.35), s('~ RolandTR909_oh ~ RolandTR909_oh').gain(0.22))",
            bass: "note(m('c1 ~ c1 ~ eb1 ~ g1 ~')).s('sawtooth').att(0.01).decay(0.2).lpf(sine.range(220, 650).slow(4)).resonance(10).gain(0.7)",
            melody: "note(m('<c4 eb4 g4> ~ ~ <c4 eb4 g4>')).s('supersaw').att(0.01).decay(0.18).lpf(2600).room(0.25).delay(0.15).gain(0.35).slow(2)",
            fx: "s('pink').hpf(sine.range(200, 12000).slow(8)).gain(sine.range(0.1, 0.4).slow(8))",
        }),
        requiredTracks: ['drums', 'bass'],
        qualityNotes: ['Stable tempo', 'Four-on-floor', 'Bass/kick separated'],
    },
    italo_80s: {
        id: 'italo_80s',
        aliases: ['italo 80s', 'italo disco', '80s italo techno', 'techno italo 80s'],
        intentTags: ['italo', '80s', 'retro', 'electronic', 'arpeggio'],
        bpm: 124,
        key: 'C minor',
        scale: 'C minor',
        thought: 'Italo 80s techno: bright retro drums, octave bass motion, and a simple neon arpeggio instead of generic dark techno.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd*4').gain(0.88), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.62), s('RolandTR808_hh*8').gain(0.18).hpf(6500), s('~ ~ RolandTR909_oh ~').gain(0.12))",
            bass: "note(m('c2 c3 c2 g1 bb1 g1 c2 g1')).s('square').att(0.005).decay(0.14).lpf(900).gain(0.66)",
            melody: "note(m('c5 eb5 g5 bb5 g5 eb5 c5 bb4')).s('sawtooth').att(0.005).decay(0.08).lpf(3600).delay(0.18).room(0.22).gain(0.32).slow(2)",
            fx: "s('pink').hpf(sine.range(1800, 9000).slow(8)).gain(sine.range(0.04, 0.16).slow(8))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Retro octave bass', 'Bright but not harsh', 'Different from generic techno'],
    },
    italo_80s_alt: {
        id: 'italo_80s_alt',
        aliases: ['italo 80s variation', 'more italo 80s', 'techno italo 80s variation'],
        intentTags: ['italo', '80s', 'retro', 'electronic', 'variation'],
        bpm: 124,
        key: 'A minor',
        scale: 'A minor',
        thought: 'Italo 80s variation: snappier electro drums, octave-jump bass, and a brighter arpeggio so the repeated request actually changes.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd ~ RolandTR808_bd ~').gain(0.9), s('~ RolandTR909_sd ~ RolandTR909_sd').gain(0.6), s('RolandTR808_hh*16').gain(0.14).hpf(7000), s('~ RolandTR909_cp ~ ~').gain(0.18))",
            bass: "note(m('a1 a2 e2 a2 g1 g2 e2 g2')).s('square').att(0.004).decay(0.12).lpf(980).gain(0.64)",
            melody: "note(m('a4 c5 e5 a5 g5 e5 c5 e5')).s('sawtooth').att(0.004).decay(0.07).hpf(450).lpf(4200).delay(0.16).room(0.18).gain(0.34).slow(2)",
            fx: "s('pink').hpf(sine.range(2500, 11000).slow(6)).gain(sine.range(0.03, 0.13).slow(6))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Variation for repeated Italo prompt', 'Octave-jump bass', 'Retro electro drums'],
    },
    house: {
        id: 'house',
        aliases: ['house', 'deep house', 'groovy house'],
        intentTags: ['house', 'groove', 'offbeat-hats'],
        bpm: 124,
        key: 'C major',
        scale: 'C major',
        thought: 'House: warm kick, clap on 2 and 4, offbeat hats, and simple chord color.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd*4').gain(0.95), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.75), s('~ RolandTR909_hh ~ RolandTR909_hh').gain(0.32), s('RolandTR909_hh*8').gain(0.2))",
            bass: "note(m('c2 ~ ~ c2 ~ g1 ~ ~')).s('triangle').att(0.01).decay(0.25).lpf(700).gain(0.7)",
            melody: "note(m('<c4 e4 g4> ~ <d4 f4 a4> ~')).s('piano').decay(0.2).room(0.35).lpf(5000).gain(0.35).slow(2)",
            fx: "s('pink').lpf(sine.range(500, 8000).slow(16)).gain(sine.range(0.05, 0.25).slow(16)).room(0.4)",
        }),
        requiredTracks: ['drums', 'bass'],
        qualityNotes: ['Warm and readable', 'Offbeat hats', 'No harsh lead'],
    },
    ambient: {
        id: 'ambient',
        aliases: ['ambient', 'atmospheric', 'chill', 'calm'],
        intentTags: ['ambient', 'pad', 'slow'],
        bpm: 72,
        key: 'C major',
        scale: 'C major',
        thought: 'Ambient: slow evolving tones, no forced drums, heavy space, and gentle filter movement.',
        tracks: tracks({
            bass: "note(m('c2 ~ ~ ~ e2 ~ ~ ~')).s('sine').lpf(300).room(0.7).slow(4).gain(0.5)",
            fx: "note(m('<c5 e5 g5> <g4 b4 d5>')).s('sine').slow(8).room(0.95).delay(0.6).lpf(1500).gain(0.4)",
        }),
        requiredTracks: ['fx'],
        qualityNotes: ['No drums by default', 'Long timescale', 'Soft spectrum'],
    },
    dnb: {
        id: 'dnb',
        aliases: ['dnb', 'drum and bass', 'jungle', 'breakbeat'],
        intentTags: ['dnb', 'fast', 'breakbeat'],
        bpm: 174,
        key: 'C minor',
        scale: 'C minor',
        thought: 'DnB: fast broken beat, rolling bass, and minimal high melody.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ RolandTR909_bd ~').gain(1), s('~ ~ RolandTR909_sd ~ ~ RolandTR909_sd ~ RolandTR909_sd').gain(0.9), s('RolandTR909_hh*16').gain(0.22))",
            bass: "note(m('c1 c1 c1 ~ eb1 eb1 ~ c1')).s('sawtooth').att(0.01).decay(0.2).lpf(sine.range(200, 900).slow(2)).gain(0.8)",
            melody: "note(m('c5 ~ eb5 ~ g5 ~ ~ ~')).s('sine').att(0.01).decay(0.12).hpf(500).room(0.25).gain(0.3)",
        }),
        requiredTracks: ['drums', 'bass'],
        qualityNotes: ['Fast BPM is explicit', 'Breakbeat is dense but controlled'],
    },
    trance: {
        id: 'trance',
        aliases: ['trance', 'uplifting', 'euphoric'],
        intentTags: ['trance', 'arpeggio', 'uplifting'],
        bpm: 138,
        key: 'A minor',
        scale: 'A minor',
        thought: 'Trance: driving 4/4 kick, offbeat bass, uplifting arpeggio, and airy FX.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*4').gain(0.95), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.75), s('~ RolandTR909_hh ~ RolandTR909_hh').gain(0.32), s('RolandTR909_hh*16').gain(0.18))",
            bass: "note(m('~ a1 ~ a1 ~ a1 ~ a1')).s('sawtooth').att(0.01).decay(0.25).lpf(900).resonance(8).gain(0.7)",
            melody: "note(m('a4 c5 e5 a5 e5 c5 a4 e4')).s('supersaw').att(0.01).decay(0.22).lpf(3200).room(0.45).delay(0.22).gain(0.45).slow(2)",
            fx: "s('pink').hpf(sine.range(500, 15000).slow(8)).gain(sine.range(0.1, 0.35).slow(8))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['BPM explicit', 'Arp stays musical', 'FX not dominant'],
    },
    acid: {
        id: 'acid',
        aliases: ['acid', 'acid house', '303', 'squelchy'],
        intentTags: ['acid', '303', 'filter'],
        bpm: 128,
        key: 'A minor',
        scale: 'A minor',
        thought: 'Acid: classic 303-style bass with a resonant filter sweep and simple drums.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*4').gain(1), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.75), s('RolandTR909_hh*16').gain(0.25))",
            bass: "note(m('a1 a2 a1 c2 a1 a2 d2 a1')).s('sawtooth').att(0.01).decay(0.18).lpf(sine.range(200, 2200).slow(1)).resonance(18).gain(0.8)",
            fx: "note(m('<a3 c4 e4>')).s('sawtooth').lpf(sine.range(500, 3000).slow(2)).resonance(12).room(0.3).gain(0.35).slow(4)",
        }),
        requiredTracks: ['drums', 'bass'],
        qualityNotes: ['Resonance is intentional', 'No extra lead clutter'],
    },
    minimal: {
        id: 'minimal',
        aliases: ['minimal', 'hypnotic'],
        intentTags: ['minimal', 'sparse', 'hypnotic'],
        bpm: 126,
        key: 'C minor',
        scale: 'C minor',
        thought: 'Minimal: sparse kick, subtle hats, and a hypnotic bass loop.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ ~ RolandTR909_bd ~').gain(0.9), s('~ ~ ~ RolandTR909_hh ~ ~ RolandTR909_hh ~').gain(0.22))",
            bass: "note(m('c2 ~ c2 ~ c2 ~ ~ ~')).s('triangle').att(0.01).decay(0.25).lpf(420).gain(0.65)",
        }),
        requiredTracks: ['drums', 'bass'],
        qualityNotes: ['Sparse', 'No melody unless requested'],
    },
    clean_drums: {
        id: 'clean_drums',
        aliases: ['clean drums', 'pure drums', 'drum loop', 'percussion only', 'beat only'],
        intentTags: ['drums', 'percussion', 'drum-only', 'clean'],
        bpm: 120,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Clean drum-only loop: audible sample-safe kick, snare, and hats only. Clearing tonal tracks so the loop stays drum-only.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ RolandTR909_bd ~').gain(1.02).lpf(260), s('~ RolandTR909_sd ~ RolandTR909_sd').gain(0.68).hpf(520), s('RolandTR909_hh*8').gain(0.22).hpf(6500))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Drum-only means no bass, melody, voice, or FX carryover', 'Use balanced sample-safe drums', 'Keep layers simple'],
    },
    drums: {
        id: 'drums',
        aliases: ['drums', 'pure drums', 'drum loop', 'percussion only', 'beat only'],
        intentTags: ['drums', 'percussion', 'drum-only'],
        bpm: 120,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Drum-only groove: a clear sample-safe kick, snare, hat, and light open-hat pattern. Clearing tonal tracks.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ RolandTR909_bd ~ ~').gain(1.05).lpf(260), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.72).hpf(520), s('RolandTR909_hh*8').gain(0.22).hpf(6500), s('~ ~ ~ RolandTR909_oh ~ ~ ~ ~').gain(0.14).hpf(5200))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Drum-only means no bass, melody, voice, or FX carryover', 'Distinct from clean drums', 'Clear sample transients', 'Light open-hat motion'],
    },
    tight_clean_drums: {
        id: 'tight_clean_drums',
        aliases: ['very clean drums', 'i said clean drums', 'cleaner drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'clean', 'correction'],
        bpm: 120,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Tight clean drum-only loop: stripped down kick/snare and quieter hats, with tonal tracks kept silent.',
        tracks: tracks({
            drums: "stack(note(m('c2 ~ ~ ~ c2 ~ ~ ~')).s('square').decay(0.065).lpf(125).gain(0.66), note(m('~ ~ c4 ~ ~ ~ c4 ~')).s('pink').decay(0.03).hpf(920).gain(0.16), note(m('c6 ~ c6 ~ c6 ~ c6 ~')).s('pink').decay(0.008).hpf(7600).gain(0.045))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Correction template', 'Very sparse hats', 'No tonal carryover'],
    },
    double_tap_drums: {
        id: 'double_tap_drums',
        aliases: ['double tap drums', 'double drums', 'drum flam', 'ratchet drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'double-tap'],
        bpm: 120,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Double-tap drum-only loop: quick kick and snare doubles with hats kept quiet, clearing all tonal tracks.',
        tracks: tracks({
            drums: "stack(note(m('[c2 c2] ~ c2 ~')).s('square').decay(0.07).lpf(145).gain(0.76), note(m('~ [c4 c4] ~ c4')).s('pink').decay(0.038).hpf(950).gain(0.25), note(m('c6*8')).s('pink').decay(0.011).hpf(7800).gain(0.095))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Double hits use mini-notation subdivisions', 'No tonal carryover', 'Hats stay quiet'],
    },
    triple_tap_drums: {
        id: 'triple_tap_drums',
        aliases: ['triple tap drums', 'triple drums', 'three hit drums', '3 hit drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'triple-tap'],
        bpm: 120,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Triple-tap drum-only loop: three-hit kick and snare bursts, clearly different from double taps.',
        tracks: tracks({
            drums: "stack(note(m('[c2 c2 c2] ~ c2 ~')).s('square').decay(0.058).lpf(150).gain(0.72), note(m('~ [c4 c4 c4] ~ c4')).s('pink').decay(0.03).hpf(980).gain(0.23), note(m('c6*12')).s('pink').decay(0.009).hpf(8000).gain(0.07))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Triple hits use three-note subdivisions', 'Different from double tap', 'No tonal carryover'],
    },
    low_drums: {
        id: 'low_drums',
        aliases: ['low drums', 'deeper drums', 'lower drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'low', 'deeper'],
        bpm: 120,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Lower drum-only loop: deeper kick, darker snare, and quieter hats without adding bass or pads.',
        tracks: tracks({
            drums: "stack(note(m('c1 ~ c1 ~ c1 ~ ~ c1')).s('square').decay(0.11).lpf(95).gain(0.82), note(m('~ ~ c3 ~ ~ ~ c3 ~')).s('pink').decay(0.045).hpf(520).lpf(2400).gain(0.18), note(m('c6 ~ c6 ~ c6 ~ c6 ~')).s('pink').decay(0.008).hpf(7200).gain(0.045))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Lower drum register', 'No bass layer', 'No pad layer'],
    },
    humanized_drums: {
        id: 'humanized_drums',
        aliases: ['humanized drums', 'less even drums', 'more human drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'humanize', 'syncopated'],
        bpm: 120,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Humanized drum-only loop: controlled kick variation and a steady snare anchor, with tonal tracks cleared.',
        tracks: tracks({
            drums: "stack(note(m('c2 ~ ~ c2 ~ c2 ~ ~')).s('square').decay(0.075).lpf(140).gain(0.74), note(m('~ ~ c4 ~ ~ ~ c4 ~')).s('pink').decay(0.038).hpf(940).gain(0.22), note(m('c6*8')).s('pink').decay(0.012).hpf(7800).gain(0.085), note(m('~ ~ ~ c6 ~ ~ ~ ~')).s('pink').decay(0.018).hpf(6400).gain(0.05))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Adds groove without chaos', 'Keeps snare readable', 'No tonal carryover'],
    },
    repaired_drums: {
        id: 'repaired_drums',
        aliases: ['repaired drums', 'clean up drums', 'less harsh drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'repair', 'clean'],
        bpm: 120,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Repairing the drum-only loop: simpler kick/snare, lower hat gain, and no added bass or melody.',
        tracks: tracks({
            drums: "stack(note(m('c2 ~ c2 ~')).s('square').decay(0.07).lpf(130).gain(0.68), note(m('~ c4 ~ c4')).s('pink').decay(0.035).hpf(900).gain(0.18), note(m('c6 ~ c6 ~')).s('pink').decay(0.01).hpf(7600).gain(0.055))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Repair simplifies', 'Lower hats', 'No genre switch'],
    },
    pop_punk_drums: {
        id: 'pop_punk_drums',
        aliases: ['pop punk drums', 'blink 182 drums', 'blink-182 drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'punk', 'pop-punk', 'style-reference'],
        bpm: 176,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Pop-punk drum traits: loud sample-safe kick doubles, punchy snare backbeat, and fast 16th-note hats without copying any artist.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd RolandTR909_bd ~ RolandTR909_bd ~ RolandTR909_bd RolandTR909_bd ~').gain(1.04).lpf(270), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.78).hpf(520), s('RolandTR909_hh*16').gain(0.26).hpf(6800), s('~ ~ ~ RolandTR909_oh ~ ~ ~ RolandTR909_oh').gain(0.16).hpf(5400))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Reference maps to genre traits only', 'Fast hats', 'Sample-safe kick and snare', 'Backbeat remains clear'],
    },
    punk_fast_hats: {
        id: 'punk_fast_hats',
        aliases: ['punk fast hats', 'fast punk drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'punk', 'fast-hats'],
        bpm: 178,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Fast punk drum-only loop: straight fast hats, backbeat snare, and compact kick accents.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ RolandTR909_bd RolandTR909_bd ~ RolandTR909_bd ~ RolandTR909_bd').gain(0.98).lpf(260), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.76).hpf(520), s('RolandTR909_hh*16').gain(0.24).hpf(6900))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Fast hats carry energy', 'No extra tonal tracks'],
    },
    metal_double_kick: {
        id: 'metal_double_kick',
        aliases: ['metal double kick', 'double kick drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'metal', 'double-kick'],
        bpm: 156,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Metal drum-only loop: tight double-kick pulse, strong snare, and restrained hats.',
        tracks: tracks({
            drums: "stack(note(m('c2*8')).s('square').decay(0.055).lpf(135).gain(0.66), note(m('~ ~ c4 ~ ~ ~ c4 ~')).s('pink').decay(0.036).hpf(980).gain(0.24), note(m('c6*16')).s('pink').decay(0.008).hpf(8200).gain(0.06))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Double kick without clipping', 'Hats are restrained', 'No guitar added'],
    },
    boom_bap_drums: {
        id: 'boom_bap_drums',
        aliases: ['boom bap drums', 'hip hop drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'hiphop', 'boom-bap'],
        bpm: 92,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Boom bap drum-only loop: laid-back kick variation, dry snare, and quiet hats.',
        tracks: tracks({
            drums: "stack(note(m('c2 ~ ~ c2 ~ ~ c2 ~')).s('square').decay(0.09).lpf(125).gain(0.76), note(m('~ ~ c4 ~ ~ ~ c4 ~')).s('pink').decay(0.045).hpf(900).gain(0.24), note(m('c6 ~ c6 c6 ~ c6 ~ c6')).s('pink').decay(0.012).hpf(7600).gain(0.07))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Loose half-time feel', 'Dry snare', 'No melodic layer'],
    },
    dnb_breakbeat: {
        id: 'dnb_breakbeat',
        aliases: ['dnb breakbeat drums', 'jungle drums', 'breakbeat drums'],
        intentTags: ['drums', 'percussion', 'drum-only', 'dnb', 'breakbeat'],
        bpm: 174,
        key: 'N/A',
        scale: 'N/A',
        thought: 'DnB breakbeat drum-only loop: fast hats, broken kick placement, and busy but controlled snares.',
        tracks: tracks({
            drums: "stack(note(m('c2 ~ ~ c2 ~ c2 ~ ~')).s('square').decay(0.055).lpf(145).gain(0.78), note(m('~ ~ c4 ~ ~ c4 ~ c4')).s('pink').decay(0.032).hpf(980).gain(0.25), note(m('c6*16')).s('pink').decay(0.008).hpf(8300).gain(0.072))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Breakbeat density', 'Fast BPM explicit', 'No bass unless requested'],
    },
    clean_rock: {
        id: 'clean_rock',
        aliases: ['clean rock repair'],
        intentTags: ['repair', 'clean', 'rock'],
        bpm: 132,
        key: 'E minor',
        scale: 'E minor',
        thought: 'Cleaning the rock loop: simpler drums, lower distortion, clearer bass, and less high-frequency harshness.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ RolandTR909_bd ~').gain(0.82), s('~ RolandTR909_sd ~ RolandTR909_sd').gain(0.62).hpf(450), s('RolandTR909_hh*8').gain(0.14).hpf(6500))",
            bass: "note(m('e1 ~ e1 ~ g1 ~ a1 ~')).s('triangle').att(0.01).decay(0.22).lpf(430).gain(0.58)",
            melody: "stack(note(m('e2 ~ g2 ~')).s('sawtooth').att(0.01).decay(0.16).hpf(160).lpf(1900).distort(0.1).gain(0.32), note(m('b2 ~ d3 ~')).s('sawtooth').att(0.01).decay(0.16).hpf(160).lpf(1900).distort(0.08).gain(0.24))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Repair template', 'Gain reduced', 'Distortion reduced', 'Highs filtered'],
    },
    humanized_rock: {
        id: 'humanized_rock',
        aliases: ['humanized rock', 'syncopated rock'],
        intentTags: ['humanize', 'syncopated', 'rock'],
        bpm: 136,
        key: 'E minor',
        scale: 'E minor',
        thought: 'Adding a more human rock feel: syncopated kick accents and riff gaps while keeping the backbeat stable.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ RolandTR909_bd ~ ~').gain(0.88), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.68).hpf(480), s('RolandTR909_hh*8').gain(0.18).hpf(6500), s('~ ~ ~ RolandTR909_oh ~ ~ ~ ~').gain(0.12))",
            bass: "note(m('e1 ~ e1 g1 ~ a1 g1 ~')).s('sawtooth').att(0.01).decay(0.16).lpf(520).gain(0.62)",
            melody: "stack(note(m('e2 ~ ~ g2 a2 ~ g2 ~')).s('sawtooth').att(0.01).decay(0.15).hpf(140).lpf(2400).distort(0.16).gain(0.36), note(m('b2 ~ ~ d3 e3 ~ d3 ~')).s('sawtooth').att(0.01).decay(0.15).hpf(140).lpf(2400).distort(0.14).gain(0.26))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Syncopated but stable', 'Keeps snare anchor', 'Not a random Euclidean groove'],
    },
    bug_from_heaven: {
        id: 'bug_from_heaven',
        aliases: ["bug from heaven"],
        intentTags: ['cover', 'bug_from_heaven'],
        bpm: 128,
        key: 'C minor',
        scale: 'C minor',
        thought: "Bug From Heaven by eefano. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "// \"Bug From Heaven (wip)\"\n// song @by Tim Smith\n// script @by eefano\nconst standardtuning = [40,45,50,55,59,64];\nconst fingering = \n{A:\"0:0:2:2:2:0\",Am:\"0:0:2:2:1:0\",A7:\"x:0:2:0:2:0\",D:\"x:0:0:2:3:2\",Dm:\"x:0:0:2:3:1\",D7:\"x:0:0:2:1:2\",\n E:\"0:2:2:1:0:0\",Em:\"0:2:2:0:0:0\",E7:\"0:2:2:1:3:0\",G7:\"3:2:0:0:0:1\",C:\"x:3:2:0:1:0\",\n // guitar only chords\n Dx:\"x:0:0:2:3:2\",Ds:\"x:0:0:1:3:0\",\n Ax:\"0:0:2:2:2:0\",Amx:\"0:0:2:2:1:0\",\n Ex:\"0:2:2:1:0:0\",Emx:\"0:2:2:0:0:0\",\n};\nconst gstrum = \n{u:\"<[[1,[~ 3@10],4]@2 ~]!2 [1,4,5]>*3\", \n v:\"<[[0,[~ 3@10],5]@2 ~]!2 [0,3,4]>*3\", \n w:\"<[[1,[~ 3@10],4]@2 ~]!2 [1,2,3]>*3\", \n x:\"<[1,[~ 2@50],[~ ~ 4@50]] ~@3>/4\",\n z:\"<[[3,4,5] ~]*2>\", \n k:\"<[[2,3,4] ~]*2>\",\n n:\"~\"\n};\nconst bstrum = {u:\"<[1 2]>\", v:\"<[2 1]>\", w:\"<[1 0]>\", x:\"~\", z:\"~\", k:\"~\", n:\"0\"};\n\nconst gString = register('gString', (n, pat) => \n  (pat.fmap((v) => { if(v[n]=='x') return note(0).velocity(0);\n      return note(v[n]+standardtuning[n]); } \n  ).innerJoin()));\nconst guitar = (strums,fingers,tuning=standardtuning) => (strums.pickOut(\n    [fingers.pickOut(fingering).gString(0),fingers.pickOut(fingering).gString(1),fingers.pickOut(fingering).gString(2)\n    ,fingers.pickOut(fingering).gString(3),fingers.pickOut(fingering).gString(4),fingers.pickOut(fingering).gString(5)]));\nconst split = register('split', (deflt, callback, pat) => callback(deflt.map((d,i)=> pat.withValue((v)=>{\n  const isobj = v.value !== undefined; const value = isobj ? v.value : v;\n  const result = Array.isArray(value)?(i<value.length?value[i]:d):(i==0?value:d);\n  return (i==0 && isobj) ? {...v,value:result} : result; }))));\n\ngtr: \"<~@2 [[0 1]!2]@16 2@3 3@13 4@3 3@4 5@2 3@13 4@3 3@4 5@2 3@4 3@2 6@11 3@4 5@2 3@13 4@3 3@4 5@2 3@4 3@2 6@11 3@4 5@2 7@8 [[0 1]!2]@16 8@5>\"\n  .pickRestart([\n  \"<Am:u:6 E:v:5 Am:u:4 E:v:3>\",\"<Am:u:2 A:w:7>\",\"<Am:u:2 E:x A:x>\",\n  \"<Dx:z Ds:z>\",\"<Ax:z Emx:k:2 Ax:z:2>\",\"<Ax:k:2 Ex:z:5>\",\n  \"<A:n:2 E:n A:n E:n E:n:4 A:n:4 E:n:2 E:n:6 A:n:6 A:n:11 E:n:9>\",\n  \"<E:k:2!3 A:k:1 E:k:5!3 A:k:2 >\",/* 157 */\"<Am:u:2 E:x@2 ~@2>\"\n  ]).split([0,0,0],s=>s[0].layer(\n  x=>guitar(s[1].pick(gstrum),x).s(\"gm_acoustic_guitar_steel:1\").release(.1).gain(.75).room(.5).hpf(300).lpf(5000).late(1/64),\n  x=>guitar(s[1].pick(bstrum),x).s(\"gm_pizzicato_strings:1\").transpose(-12).release(.1).gain(.65).room(.6).lpf(1000),\n  x=>chord(x).anchor(\"g5\").voicing().s(\"gm_string_ensemble_1\").gain(.15).room(1).layer(p=>p.pan(1),p=>p.pan(0).late(.1))\n    ).transpose(s[2]))\n\nvox: \"<~@25 0@22 0@22 1@13 2@10 0@22 1@13 3@8 ~@30>\".pickRestart([\n \"<f#4@2 f#4@3 [e4!2]@6 [f#4!2]@6 g#4@19 f#4@2 f#4@3 [e4!2]@6 [f#4!2]@6 c#4@13 b3@3 f#3@13 ~@100>*6\",\n /*69*/\"<f#4@2 f#4@3 [e4!2]@6 [f#4!2]@6 [g#4!2]@6 [a4!2]@6 [g#4!3]@9 d#4@3 [f4!2]@6 [f#4!2]@6 [f4!2]@6 [d#4!4]@12 c#4@3 f4@3 f#4@3>*6\",\n /*82*/\"<f#4@2 f#4@3 [e4!2]@6 [f#4!2]@6 b3@16 c#4@3 d4@12 ~@100>*6\",\n /*127*/\"<f#4 e4 [d4@2 ~] e4 [f#4@2 ~] a4 f#4@2>\"\n]).s(\"sawtooth\").note().attack(.05).release(.05).gain(.30).hpf(500).clip(0.95)\n\ndrm: \"< 0@2 [0,1]@17 2 ~ 0@32>\".pick([\n     s(\"<rd>*2\"),\n     s(\"<~ sd>*2\"),\n     s(\"<rd>\")\n  ]).bank(\"BossDR110\").room(1).lpf(1800).gain(.6)\n\nuff: \"<[gm_acoustic_guitar_steel:1,gm_string_ensemble_1,gm_pizzicato_strings:1] ~@1000>\".gain(0)",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of Bug From Heaven', 'Cleaned syntax and sanitised helpers'],
    },
    charli_360: {
        id: 'charli_360',
        aliases: ["360","charli 360","charli xcx 360"],
        intentTags: ['cover', 'charli_360'],
        bpm: 120,
        key: 'E minor',
        scale: 'E minor',
        thought: "Charli XCX 360 cover/remix in E minor. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "/*\n  @title Charli xcx - 360 (cover / remix)\n  @by KAIXI\n  @details Brat  and it's  the same  but \n           we're live coding so it's not\n*/\n\nlet cpm = 120/4;\n\nsamples({\n  camera_flash: '360_camera_flash.wav',\n  vox: '360_vocals.wav'\n}, 'https://raw.githubusercontent.com/kai-xi/360/main/samples/');\n\n// section 1: intro\nlet lead_synth = arrange(\n  [3, \"<[[e3,b3] - c4 -] [e3 - f3 c4] [- c4 a4 -] [- - - -]>*4\"],\n  [1, \"<[- - [g3,b3] -] [g3 - a3 c4] [- c4 c5 -] [c4 - g4 -]>*4\"]\n)\n  .note().sound(\"sawtooth\")\n  .attack(0).decay(.25).sustain(0).release(.3)\n  .lpf(300).lpq(0).lpenv(3).lpa(0).lpd(.15).lps(0)\n  .delay(.2).delaytime(.25).delayfeedback(.1);\n\nlet section_1 = lead_synth;\n\n// section 2: i went my own way and i made it\nlet bass = arrange(\n  [2, \"<[e2 -] [- - e2 f2] [- f1] [-]>*4\"],\n  [1, \"<[- e2] [e2 - e2 f2] [- f1] [-]>*4\"],\n  [1, \"<[g2 -] [g2 - g2 a2] [-] [-]>*4\"],\n)\n  .note().sound(\"gm_synth_bass_2:0\")\n  .attack(0).decay(.5).release(.3)\n  .lpf(1800);\n\nlet sub_bass = bass.transpose(-12);\n\nlet bass_drum = arrange(\n  [2, \"<[bd -] [- - bd bd] [- bd] [-]>*4\"],\n  [1, \"<[- bd] [bd - bd bd] [- bd] [-]>*4\"],\n  [1, \"<[bd -] [bd - bd bd] [-] [-]>*4\"],\n)\n  .sound().bank(\"RolandTR808\").gain(1.5);\n\nlet clap = arrange(\n  [4, \"<[-] [cp] [-] [cp]>*4\"]\n)\n  .sound().bank(\"RolandTR808\").gain(1.15);\n\nlet drums = stack(bass_drum, clap);\n \nlet section_2 = stack(lead_synth, bass, sub_bass, drums);\n\n// section 3: drop down, yeah\nlet lead_saw = arrange(\n  [4, \"<[g4 - g4 g4] [g4 g4@2 g4] [g4 g4 g4@2] [g4@2 g4 g4]>*4\"]\n)\n  .note().sound(\"gm_lead_2_sawtooth:0\")\n  .attack(0).decay(.3).sustain(0).release(.15)\n  .lpf(3000).lpenv(10).lpa(0).lpd(.25).lps(0).lpr(0)\n  .gain(.25);\n\nlet camera_flash = s(\"<[- [- camera_flash] - -] [-]>/4\");\nlet section_3 = stack(\n  lead_synth, \n  bass,\n  sub_bass,\n  drums.mask(\"<[1 [1 0] 1 1] [1 1 1 [1 0]]>/4\"),\n  lead_saw.mask(\"<1 [1 1 1 [1 0]]>/4\"),\n  camera_flash\n);\n\n// section 4: yeah, 360\nlet section_4 = stack(\n  lead_synth, \n  bass.lpf(\"<20000 [20000 20000 20000 500]>/4\"), \n  sub_bass.lpf(\"<20000 [20000 20000 20000 500]>/4\"), \n  drums.mask(\"<1 [1 1 1 [1 0]]>/4\")\n);\n\n// section 5: bumpin' that\nlet bass_modified = arrange(\n  [1, \"<[e2 -] [- - e2 f2] [- f1] [-]>*4\"],\n  [1, \"<[e2 -] [- - e2 f2] [- f1] [e2 e2 e2 -]>*4\"],\n  [1, \"<[e2 e2] [- - e2 f2] [- f1] [-]>*4\"],\n  [1, \"<[g2 -] [g2 - g2 a2] [-] [-]>*4\"],\n)\n  .note().sound(\"gm_synth_bass_2:0\")\n  .attack(0).decay(.5).release(.3)\n  .lpf(1800);\n\nlet sub_bass_modified = bass_modified.transpose(-12);\n\nlet bass_drum_modified = arrange(\n  [1, \"<[bd -] [- - bd bd] [- bd] [-]>*4\"],\n  [1, \"<[bd -] [- - bd bd] [- bd] [bd bd bd -]>*4\"],\n  [1, \"<[bd bd] [- - bd bd] [- bd] [-]>*4\"],\n  [1, \"<[bd -] [bd - bd bd] [-] [-]>*4\"],\n)\n  .sound().bank(\"RolandTR808\").gain(1.5);\n\nlet section_5 = stack(\n  lead_synth, \n  bass_modified,\n  sub_bass_modified,\n  bass_drum_modified,\n  clap.mask(\"<1 [1 1 1 [1 0]]>/4\"),\n  lead_saw.mask(\"<[1 1 1 [1 0]]>/4\")\n);\n\n// instrumental arrangement\nlet instrumental = arrange(\n  [4, section_1],\n  [8, section_2],\n  [8, section_3],\n  [8, section_4],\n  [4, section_5]\n);\n\n// slicing the vocals so it stops playing after each cycle\nlet vocals = s(\"vox\")\n  .slice(32, \n         \"<0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31>\")\n  ;\n\n// cover (1st half of the song)\nlet cover = stack(instrumental, vocals);\n\n// WORKING IT OUT ON THE REMIX !!!\n// extending section 5\nlet section_5_ext = stack(\n  lead_synth, \n  bass,\n  sub_bass,\n  bass_drum,\n  clap.mask(\"<1 [1 1 1 [1 0]]>/4\"),\n  lead_saw.mask(\"<1 [1 1 1 [1 0]]>/4\")\n);\n\n// bumpin' that\nlet vox_chop_1 = s(\"vox\").slice(32, \"<30 30 30 30>\");\n// ah-ah ah-ah-ah\nlet vox_chop_2 = \n    s(\"<- - - vox>\").begin((27*4 + 1)/(32 *4)).end(\"0.89\").late(1/4).gain(.8);\n\nlet remix_vox = arrange(\n  [4, stack(vox_chop_1.mask(\"<1 1 1 1 1 1 1 0>\"), vox_chop_2.mask(\"<0 1>/4\"))]\n);\n\n// section 6\nlet hihats = arrange(\n  [4, \"<[hh - hh hh] [hh hh@2 hh] [hh hh hh@2] [hh@2 hh hh]>*4\"]\n)\n  .sound().bank(\"RolandTR808\").gain(.85);\n\nlet section_6 = stack(\n  bass_modified, \n  sub_bass_modified, \n  bass_drum_modified,\n  clap.mask(\"<1 [1 1 1 [1 0]]>/4\"),\n  hihats.mask(\"<1 [1 1 1 [1 0]]>/4\")\n);\n\n// section 7\nlet bass_modified_2 = arrange(\n  [1, \"<[e2 -] [- - e2 f2] [- - f1 -] [-]>*4\"],\n  [1, \"<[e2 -] [- - e2 f2] [- - f1 -] [e2 e2 e2 -]>*4\"],\n  [1, \"<[e2 e2] [- - e2 f2] [- - f1 - ] [-]>*4\"],\n  [1, \"<[g2 -] [g2 - g2 a2] [-] [-]>*4\"],\n).transpose(24).gain(1.1)\n  .note().sound(\"gm_fx_brightness:4\")\n  .attack(0).decay(.5).release(.3)\n  .lpf(8000).lpa(0).lpd(.08).lpq(10);\n\nlet section_7 = stack(\n  bass_modified_2,\n  sub_bass_modified,\n  clap.mask(\"<1 [1 1 1 [1 0]]>/4\")\n);\n\n// section 8\nlet bass_modified_3 = arrange(\n  [1, \"<[e2 -] [- - e2 f2] [- f1] [-]>*4\"],\n  [1, \"<[e2 -] [- - e2 f2] [- f1] [e2 e2 e2 -]>*4\"],\n  [1, \"<[e2 e2] [- - e2 f2] [- f1] [-]>*4\"],\n  [1, \"<[g2 -] [g2 - g2 a2] [-] [-]>*4\"],\n).transpose(24)\n  .note().sound(\"gm_lead_2_sawtooth:0\")\n  .attack(0).decay(.4).release(.3)\n  .lpf(500).lpa(0).lpd(.03).lpq(0);\n\n// 360\nlet vox_chop_3 = s(\"<vox - - ->*4\").begin(79 / (32 * 4)).end((0.630)).gain(.5);\n\nlet section_8 = stack(\n  bass_modified_3.lpf(\"<500 600 700 [[800 [1000 1200]] 1200]>\"),\n  sub_bass_modified,\n  clap.mask(\"<1 [1 1 1 [1 0]]>/4\")\n);\n\n// section 9\nlet section_9 = stack(section_5, hihats.gain(.8).mask(\"<1 [1 1 1 [1 0]]>/4\"));\n\n// down\nlet vox_chop_4 = s(\"vox\").slice(32 * 4, \"<- 50 - 50 - 50 - 50>*4\");\n// bumping that beat\nlet vox_chop_5 = s(\"<- - - - vox@2 vox@2>*4\").begin(99 / (32 * 4)).end(0.7852)\n  .delay(.2).delaytime(.25).delayfeedback(.1);\n// i'm everwhere, i'm so julia\nlet vox_chop_6 = s(\"vox\").slice(32 * 4, \"<- - - - 89 90 91 92>*4\").gain(.8);\n\narrange(\n  [32, cover],\n  [8, stack(section_5_ext, remix_vox.lpf(\"<1500 1500 1500 1500 1500 1500 1500 2000>\"))],\n  [8, stack(section_6)],\n  [4, stack(section_7)],\n  [4, stack(section_8, vox_chop_3.lpf(\"<600 1000 1350 0>\").mask(\"<1 1 1 0>\"))],\n  [8, stack(\n    section_9, \n    vox_chop_4.mask(\"<[1 0] [1 0] [1 0] [1 0]>/2\"), \n    vox_chop_5.mask(\"<[0 1] [0 1] [0 1] [0 0]>/2\"), \n    vox_chop_6.lpf(1500).lpa(.25).lpd(.25).pan(sine).mask(\"<[0 0] [0 0] [0 0] [0 1]>/2\"), \n    vox_chop_2.mask(\"<0 1>/4\")\n  )],\n  [8, stack(section_5, remix_vox.mask(\"<1 1 1 0 1 1 1 1>\"))],\n  [4, vox_chop_1.delay(.25).delayt(.5).dfb(.2).mask(\"<1 0 0 0>\")]\n)\n  \n  .theme(\"<[greenText whitescreen] [blackscreen whitescreen]>/2\")\n  .color(\"<[#99CC3E #FFFFFF] [#99CC3E #000000]>\")\n  .fontFamily(\"x3270\")\n  .punchcard({\n    vertical: 1, flipTime: 1, fold: 0, stroke: 1,\n    playheadColor: 'rgba(0, 0, 0, 0)'\n  });\n\n// @version 1.2",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of 360', 'Cleaned syntax and sanitised helpers'],
    },
    grimes_m4m: {
        id: 'grimes_m4m',
        aliases: ["music 4 machines","grimes music 4 machines"],
        intentTags: ['cover', 'grimes_m4m'],
        bpm: 135,
        key: 'F major',
        scale: 'F major',
        thought: "Music 4 Machines (Grimes cover) in F major. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "/*\n  @title Grimes - Music 4 Machines (cover)\n  @by KAIXI\n  @details THIS IS MUSIC FOR MACHINES\n           an intro to live coding on strudel\n           ability to divide by 2 recommended\n*/\n\n// the song should be 135 beats per minute, in 4/4 time\n// 1 beat = 1 quarter note\n// 4 quarter notes = 1 measure = 1 \"cycle\"\n// 135 quarter notes per minute = 135/4 cycles per min\nlet cpm = 135/4;\n\n// load in the vocals\n// these are just from the original song by grimes ai\nsamples({\n  vox: 'vox_chorus.wav',\n}, 'https://raw.githubusercontent.com/kai-xi/music4machines/main/samples/');\n\nlet drums = stack(\n  // when you do sound() you are writing what goes in one cycle (measure)\n  // you can write 4 quarter notes for the cycle like so:\n  // sound(\"bd bd bd bd\").bank(\"RolandTR909\"),\n  // or just writing it once and multiplying by 4\n  // sound(\"<bd>*4\").bank(\"RolandTR909\"),\n  // alternate between the sound and a rest using a '-'\n  // sound(\"<- sd:10>*4\").bank(\"RolandTR909\"),\n  // you could combine these like this\n  // and layer a clap\n  sound(`\n    <bd>*4,\n    <- sd>*4,\n    <- cp:3>*4\n  `).bank(\"RolandTR909\"),\n  // add a hihat on the off beat (8th note)\n  sound(\"<- hh>*8\").bank(\"LinnDrum\").gain(.2),\n  // add a shaker on every 8th note\n  sound(\"<sh>*8\").bank(\"RolandTR808\").gain(.25)\n);\n\n// you can concatenate cycles to change up the notes on each measure\nlet bass = cat(\n  \"<c2>*4\",\n  \"<g1>*4\",\n  // use flats with b and sharps with #\n  \"<eb1>*4\",\n  // !n will repeat the note n times\n  // this is equivalent to \"<eb1 eb1 f1 f1>*4\"\n  \"<eb1!2 f1!2>*4\",\n  \"<c2>*4\",\n  \"<g1!2 bb1!2>*4\",\n  \"<eb1>*4\",\n  \"<f1>*4\"\n).note()\n  .n(3).sound(\"gm_synth_bass_1\")\n  // use effects to modify a sound\n  // low pass filter allows low frequencies to pass through\n  .lpf(200).lpenv(5).lpa(.5).lps(.8).lpd(.1);\n\n// you can also write notes based on a scale\n// let scaleExample = cat(\n//   \"<3>*4\",\n//   \"<0>*4\",\n//   \"<-2>*4\",\n//   \"<-2!2 -1!2>*4\",\n//   \"<3>*4\",\n//   \"<0!2 2!2>*4\",\n//   \"<-2>*4\",\n//   \"<-1!2>*4\",\n// ).n()\n//   .scale(\"G:minor\")\n//   // lower by 2 octaves\n//   .scaleTranspose(-7 * 2)\n//   .n(3)\n//   .sound(\"gm_synth_bass_1\")\n//   .lpf(200).lpenv(5).lpa(.5).lps(.8).lpd(.1);\n\nlet synth_arpeggio = cat(\n  \"<c3 c4 eb5 c3 c4 d5 c3 bb4>*8\",\n  \"<g2 g3 bb4 g2 g3 a4 g2 g4>*8\",\n  \"<eb2 eb3 g4 eb2 eb3 f4 eb2 g4>*8\",\n  \"<eb2 eb3 g4 eb2 eb3 f4 f2 g4>*8\",\n  \"<c3 c4 eb5 c3 c4 d5 c3 bb4>*8\",\n  \"<g2 g3 bb4 g2 bb4 c5 bb2 g4>*8\",\n  \"<eb2 eb3 g4 eb2 eb3 f4 eb2 g4>*8\",\n  \"<f2 f3 g4 f2 f3 a4 f2 a4>*8\",\n).note()\n  .n(1).sound(\"gm_pad_poly\")\n  .decay(.95).lpf(5000).lpenv(-3).lpa(.2)\n  // add delay & reverb for an echo effect\n  // format delay as \"level:time:feedback\"\n  // delay level: relative volume (0 - 1)\n  // delay time: in seconds\n  // delay feedback: amt fed back into delay (0 - 1)\n  .delay(\".3:.225:.45\")\n  // room: reverb volume\n  // rsize: reverb size\n  .room(.8).rsize(2);\n\nlet synth_bass = cat(\n  \"<c3 c4 - c3 c4 - c3 ->*8\",\n  \"<g2 g3 - g2 g3 - g2 ->*8\",\n  \"<eb2 eb3 - eb2 eb3 - eb2 ->*8\",\n  \"<eb2 eb3 - eb2 eb3 - f2 ->*8\",\n  \"<c3 c4 - c3 c4 - c3 ->*8\",\n  \"<g2 g3 - g2 g3 - bb2 ->*8\",\n  \"<eb2 eb3 - eb2 eb3 - eb2 ->*8\",\n  \"<f2 f3 - f2 f3 - f2 ->*8\"\n).note()\n  .n(0).sound(\"gm_synth_bass_1\")\n  .attack(.1).decay(.25).release(.25)\n  .lpf(2250).lpenv(2).lpa(.03).lpr(.2).lpd(.3)\n  .gain(.5);\n\nlet synth_lead = cat(\n  \"<- - eb5 - - d5 - bb4>*8\",\n  \"<- - bb4 - - a4 - g4>*8\",\n  \"<- - g4 - - f4 - g4>*8\",\n  \"<- - g4 - - f4 - g4>*8\",\n  \"<- - eb5 - - d5 - bb4>*8\",\n  \"<- - bb4 - bb4 c5 - g4>*8\",\n  \"<- - g4 - - f4 - g4>*8\",\n  \"<- - g4 - - a4 - a4>*8\",\n).note()\n  .n(1).sound(\"gm_pad_metallic\")\n  .decay(.95).delay(\".3:.225:.45\")\n  .room(.4).rsize(2).gain(.6);\n\n// use custom samples based on the name you assigned them earlier\nlet intro_vocals = s(\"vox\").room(.3).rsize(2);\n\n// modify when the sample begins and ends\n// this sample has 4 lines and we want the first one\n// so start at 0 and cut it just after 1/4\nlet vocals01 = s(\"vox\").begin(0).end(.25 + (.25 * .25 * .5))\n  .attack(.25).delay(\".25:.45:.4\").room(.2).rsize(2);\n// start the second one at 1/4 and cut it just after 2/4\nlet vocals02 = s(\"vox\").begin(.25).end(.5 + (.25 * .25 * .5))\n  .attack(.25).delay(\".25:.45:.4\").room(.2).rsize(2);\n\n// create sections to divide up your song\nlet section00 = stack(\n  intro_vocals.mask(\"<1 0 0 0 0 0 0 0>\")\n);\n\nlet section01 = stack(\n  drums,\n  bass,\n  synth_arpeggio,\n  synth_bass,\n  synth_lead\n);\n\nlet section02 = stack(\n  drums,\n  bass,\n  synth_arpeggio,\n  synth_bass,\n  synth_lead,\n  vocals01.mask(\"<1 0 0 0 0 0 0 0>\"),\n  vocals02.mask(\"<0 0 0 0 1 0 0 0>\")\n);\n\nlet end = stack(\n  vocals01.mask(\"<1 0 0 0 0 0 0 0>\")\n);\n\n// arrange the number of cycles for each section\narrange (\n  [8, section00],\n  [8, section01],\n  [8, section02],\n  [8, end]\n);\n\n\n// @version 1.0",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of Music 4 Machines', 'Cleaned syntax and sanitised helpers'],
    },
    happy_birthday: {
        id: 'happy_birthday',
        aliases: ["happy birthday"],
        intentTags: ['cover', 'happy_birthday'],
        bpm: 120,
        key: 'F major',
        scale: 'F major',
        thought: "Happy Birthday song. Drums, bass, and harmonica melody separated.",
        tracks: tracks({
            drums: "s(\"hh*3, <bd ~>, ~ ~ rim\").bank(\"RolandTR909\").gain(0.2)",
            bass: "const chrds = \"F@3 C@6 F@6 Bb@3 F@2 C F@3\".slow(8);\nsetDefaultVoicings('legacy');\nn(\"2 ~ ~ 2 1 ~\").chord(chrds).anchor(chrds.rootNotes(2)).voicing().s(\"gm_electric_bass_finger\").lpf(190).gain(1).color('blue')",
            melody: "const chrds = \"F@3 C@6 F@6 Bb@3 F@2 C F@3\".slow(8);\nsetDefaultVoicings('legacy');\nstack(\n  \"[C4@3 C4] D4 C4 F4 E4@2 [C4@3 C4] D4 C4 G4 F4@2 [C4@3 C4] C5 A4 F4 E4 D4 [Bb4@3 Bb4] A4 F4 G4 F4@2\".slow(8).early(1/3).note().s(\"gm_harmonica\").gain(0.4).color('green'),\n  chord(chrds).anchor(\"G4\").struct(\"x*3\").voicing().piano().gain(0.2).color('yellow')\n)",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["drums","bass","melody"],
        qualityNotes: ['Authentic cover of Happy Birthday', 'Cleaned syntax and sanitised helpers'],
    },
    blue_monday: {
        id: 'blue_monday',
        aliases: ["blue monday","blue monday remix","blue monday new order"],
        intentTags: ['cover', 'blue_monday'],
        bpm: 130,
        key: 'F minor',
        scale: 'F minor',
        thought: "New Order - Blue Monday cover. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "/*\n  @title New Order - Blue Monday (cover / remix)\n  @by Lewis\n*/\n\nconst kick1 = sound(\"<[bd bd [bd*4] [bd*4]] [bd*4]>\").bank(\"linn\").decay(0.15)\nconst kick2 = sound(\"[bd*4]\").bank(\"linn\").decay(.15)\n\nconst hats1 = sound(\"[oh oh*2]*4\").bank(\"dmx\").decay(.1).gain(.12)\nconst hats2 = sound(\"[- oh]*4\").bank(\"dmx\").decay(.2).sustain(0.1).gain(.12)\n\nconst snare = stack(\n  sound(\"[- sd]*2\").bank(\"linn\").gain(.5),\n  sound(\"[- cp]*2\").bank(\"linn\").gain(.1)\n)\n\nconst drums1 = stack(kick1,hats1,snare)\nconst drums2 = stack(kick2,hats2,snare)\n\nconst drums3 = stack(\n  sound(\"bd bd bd bd -\").bank(\"linn\").decay(0.15),\n  sound(\"oh oh oh oh -\").bank(\"dmx\").decay(0.2).sustain(0.1).gain(0.2)\n)\n\nconst bass1 = stack(\n  note(\"<<[f1 f2*2]*2 [g1 g2*2]*2> [c1 c2*2]*2 [d1 d2*2]*2 [d1 d2*2]*2>*2\"),\n).sound(\"<sine, gm_synth_bass_1>\").decay(.2).sustain(.1)\n\nconst bass2 = stack(\n  note(\"<<[f1 f2]*2 [g1 g2]*2> [c1 c2]*2 [d1 d2]*2 [d1 d2]*2>*2\"),\n).sound(\"<sine, gm_synth_bass_1>\").decay(.2).sustain(.4)\n\nconst synth = stack(\n  n(\"<[[2 ~] [2 ~] 2 3] [[3 ~] [3 ~] 3 3]>@4 [-1 ~] -1 -1 [0 ~] 0 0 [0 ~] 0 0 [0 ~] 0 0\"),\n).sound(\"<gm_lead_2_sawtooth>\").slow(2).scale(\"d4:minor\").attack(.05).hpf(\"<1000 2000>*12\").gain(\".4\")\n\nstack(\n  arrange([16,kick1],[16,drums1],[2,drums3],[16,drums2],[1,silence]).room(0.1),\n  arrange([8,silence],[24,synth],[19,silence]).room(0.05),\n  arrange([16,silence],[16,bass1],[2,silence],[16,bass2],[1,silence])\n  )",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of Blue Monday', 'Cleaned syntax and sanitised helpers'],
    },
    old_macdonald: {
        id: 'old_macdonald',
        aliases: ["old mcdonalds"],
        intentTags: ['cover', 'old_macdonald'],
        bpm: 70,
        key: 'F major',
        scale: 'F major',
        thought: "Old McDonalds song with animal sounds. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "// old mcdonalds has bad samples\r\nsetDefaultVoicings('legacy')\r\nconst beast = [\"crow\",\"space\",\"gm_bird_tweet\",\"space:4\",\"clash\",\"space:1\"]\r\nconst bsequ = \"<~@2 0 ~@3 1 0 ~@3 2 1 0 ~@3 3 2 1 0 ~@3 4 3 2 1 0 ~@2>\".pick(beast)\r\nconst chrds = \"F [A# F] [F C] [F@3 ~]\";\r\nconst strct = \"[[x ~]!2] [[x ~]!2 x  ~]\";\r\nconst bstrc = \"[[~ x]!2] [[~ x]!2 ~  x]\";\r\nconst trnsp = \"<0!4 1!5 2!6 3!7 4!8 ~>\";\r\n\r\n\"<[0,3] [0,1] 2 0!2 [0,1] [2,1] 2 0!2 [0,1] [2,1]!2 2 0!2 [0,1] [2,1]!3 2 0!2 [0,1] [2,1]!4 2 [0@7 ~] ~>\".pick(\r\n[stack(\r\n  \"F5*2 [F5 C5] D5*2 C5 A5*2 G5*2 F5@2\".note().clip(0.9),\r\n  chord(chrds).anchor(\"G4\").voicing().struct(\"[~ x]*4 [[~ x]*2 [x@3 ~]]\").gain(0.6),\r\n  n(\"[2 1]*4\").chord(chrds).anchor(\"F2\").voicing().struct(\"[x ~]*8\").gain(0.6),\r\n ).piano().add(note(trnsp))\r\n,\"~@7 [C5 D5]\".note().clip(0.8).piano().add(note(trnsp)) \r\n,stack(\r\n  stack(\r\n  \"[[F5*2 ~]!2] [[F5 ~]!2 F5*2 ~]\".note(),\r\n chord(\"F\").anchor(\"G4\").voicing().struct(strct).gain(0.6),\r\n  \"F2\".struct(strct).note().gain(0.6)\r\n    ).clip(0.8).piano().add(note(trnsp)),\r\n \"F\".struct(bstrc).s(bsequ).release(0))\r\n \r\n,\"0,1,2,3,4,5\".pick(beast).gain(0) // samples preload trick\r\n]).room(0.4)",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of Old McDonalds', 'Cleaned syntax and sanitised helpers'],
    },
    pump_up_the_jam: {
        id: 'pump_up_the_jam',
        aliases: ["pump up the jam"],
        intentTags: ['cover', 'pump_up_the_jam'],
        bpm: 124,
        key: 'F minor',
        scale: 'F minor',
        thought: "Technotronic - Pump Up The Jam cover in F minor. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "// \"Pump Up The Jam\" - Work In Progress\n// song @by Technotronic\n// script @by eefano\nconst pickRestart = register('pickRestart', (arr, pat) => pat.pick(arr.map((x)=>x.restart(pat.collect().fmap(v=>v+1)))))\nconst as = register('as', (mapping, pat) => { mapping = Array.isArray(mapping) ? mapping : [mapping];\n  return pat.fmap((v) => { v = Array.isArray(v) ? v : [v, 0];\n    return Object.fromEntries(mapping.map((prop, i) => [prop, v[i]])); }); });\nstack(\"~\"\n,\"<~@8 0@4 1@4 ~@8>\".pickRestart(\n  [\"[u [u e] a [u i] [u ~] [a u] [i a] [o@3 i] ~ [a e] [a i] [o@3 i] [~ u@2 a] [e e] [o i] [o@3 i]]/4\"\n  ,\"~ [u i] [u ~ ~ a] [i i@2 o]\"\n]).vowel().s(\"z_sawtooth\").clip(0.8).gain(1.4)\n             \n,\"<~@16 0@8>\".pickRestart(\n  [\"[ ~@2 4 [5:1 ~] ~ [~ 0] [3:-1@5 3:1@2 2]@2 ~ [4@3:1 3 3@3 2 2@3 3 4:1@3 0 0@2 2:2@2]@5 [~ ~ 0@2 ~ 0@2 -2:-3]@2 ]/4\"\n]).as(\"n:penv\").scale(\"c4:minor\").clip(0.90).patt(\"0.15\").s(\"square\").delay(0.3).dfb(0.3).dt(60/128).gain(0.7)\n            \n,\"<0@32>\".pickRestart(\n  [\"[~@13 [[~@3 [0,-2,-4]@2 ~]@3 [0,-2,-4] [1,-1,-3]!2]@3 ]/4\"\n]).scale(\"c4:minor\").note().clip(0.7).s(\"z_sawtooth\").color(\"red\").adsr(\"0.07:.1:0.6:0.1\").gain(0.5)\n\n,\"<0@12 0 1 ~@2 3@8>\".pickRestart(\n  [\"[0 ~@23]/2\"\n  ,\"~@2 [~ [e2 ~]] [[0 2] ~]\"\n  ,\"[0 ~ ~ 0 ~ ~ 0 ~] <[[~ [0 1]] [2 ~]] ~>\"\n]).scale(\"c2:minor\").note().clip(0.9)\n      .layer(x=>x.s(\"z_sawtooth\").delay(0.6).dfb(0.5).dt(60/125*3/4).pan(0.55).gain(0.8)\n            ,x=>x.s(\"z_square\").lpf(300).lpe(2).lpa(-1.5).lpd(0.1).lpr(0.05).pan(0.45).gain(1)).color(\"green\")\n\n,\"<0@4 [0,1]@12 [0,1,2]@4 [0,1,2,3]@4>\".pickRestart(\n [stack(s(\"oh*16\").pan(0.45).gain(\"[0.08 0.16]*4\").release(0),s(\"hh*4\").pan(0.7).gain(0.20))\n ,s(\"bd*4\").lpf(150).gain(1)\n ,s(\"[~ cp]*2\").gain(0.5).pan(0.25)\n ,s(\"[~ rd]*4\").gain(0.15).release(0).hpf(1500).pan(0.75)\n ,s(\"[~ sd!3]!4 [sd*4]!4\").slow(2).gain(run(32).slow(2).mul(1/31).add(0.1).mul(0.4))\n ,s(\"cr\").gain(0.2)\n ,s(\"bd\").gain(0.8)\n ]).bank(\"RolandTR909\").color(\"yellow\").velocity(0.7)\n \n).room(0.3)",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of Pump Up The Jam', 'Cleaned syntax and sanitised helpers'],
    },
    pyramid_song: {
        id: 'pyramid_song',
        aliases: ["pyramid song"],
        intentTags: ['cover', 'pyramid_song'],
        bpm: 104,
        key: 'F# minor',
        scale: 'F# minor',
        thought: "Radiohead Pyramid Song cover. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "// \"Pyramid Song (wip)\"\n// song @by Radiohead\n// script @by eefano\nconst split = register('split', (deflt, callback, pat) => callback(deflt.map((d,i)=> pat.withValue((v)=>{\n  const isobj = v.value !== undefined; const value = isobj ? v.value : v;\n  const result = Array.isArray(value)?(i<value.length?value[i]:d):(i==0?value:d);\n  return (i==0 && isobj) ? {...v,value:result} : result; }))));\n\nlet chr = {X:\"f#2,c#3,a#3,c#4,f#4\", Y:\"g2,d3,b3,d4,f#4\", Z:\"a2,e3,a3,c#4,f#4\", J:\"g2,d3,b3,d4,g4\", K:\"f#2,c#3,a#3,c#4,g4\",\n           V:\"f#2,c#3,a3,c#4,f#4\", W:\"e2,b2,g#3,b3,f#4\"}\n\npiano: \"<[i1 i2 i3 i4] ooooh [v1 v2]!4 ooooh@2 [v1 v2]!3 [v1 v3] [v3 v2] [i1 i2 i3 i2] [i3 i2 i3 i2] end>/8\".pickRestart(\n {i1:`<[[X:.6 X:.8]@3 Y:.5@2 [Z:.5 Z:.5]@3]>/2`, i2: `<[[Z:.4 Y:.4]@3 Y:.3@2 [J:.6 J:.9]@3]>/2`, \n  i3:`<[[K:.8 X:.6]@3 Y:.5@2 [Z:.5 Z:.5]@3]>/2`, i4: `<[[Z:.4 Y:.4]@3 Y:.4@2 [Y:.4 Y:.7]@3]>/2`,\n  ooooh:`<[[X X]@3 Y@2 [Z Z]@3] [[Z Y]@3 Y@2 [X X]@3] [[X X]@3 Y@2 [Z Z]@3] [[Z Y]@3 Y@2 [Y Y]@3]>/2`,\n  v1:`<[[X X]@3 Y@2 [Z Z]@3] [[Z Y]@3 Y@2 [X X]@3]>/2`,\n  v2:`<[[V V]@3 W@2 [W W]@3] [[Y Y]@3 Y@2 [Y Y]@3]>/2`,\n  v3:`<[[V V]@3 W@2 [W W]@3] [[Y Y]@3 X@2 [X X]@3]>/2`,\n  end:`<X:1>/8`, \n }).split([0,.5],(x)=>x[0].pickOut(chr).velocity(x[1])).note().piano().gain(0.8).room(.6)\n\nooooh: \"<~ 0 ~@4 0@2 ~@8>/8\".pickRestart([\n  \"<f#5@11 e5:-2 g#5:4 e5:-4 [f#5:2 ~] [~ g#5 e5] f#5@4 g#5 f#5 e5 d5 c#5@5 ~@3>*4\"\n  ]).split([0,0],(x)=>x[0].penv(x[1])).patt(0.04).s(\"triangle\").attack(.08).release(.08).note().vmod(.1).vib(5).gain(0.3).lpf(2000).room(1.5)\n\ndrums: \"<~@6 [~@15 0@15 1@2] [2,3]@8 3>/8\".pick([\n  \"<[bd,rd] ~ [~ sf*3] [bd,rd] ~ [~ sf*3] [bd,rd] ~ ~ [~ sf*3] [bd,rd] ~ [~ sf*3] [bd,rd] ~ [~ sf*3]>*8\",\n  \"<[sd sf bd] [sf sd sd]>*4\",\n  \"<[rd*4],[<~ ~ ~ bd ~ bd ~ ~ bd ~ bd ~ ~ bd ~ bd> <~!14 sf!2> <~ sd bd ~ sd ~ sd bd ~ sd ~ ~ sd ~ sd sd>]*4>\",\n  \"<cr,bd>/8\",\n]).pickOut({\n  bd: s('bd').bank('Linn9000').lpf(1000),\n  sd: s('sd').bank('RolandMT32').velocity(.5),\n  sf: s('sd').bank('RolandMT32').velocity(.2),\n  rd: s('rd').bank('Linn9000').velocity(0.3).hpf(8000),\n  mt: s('mt').bank('RolandMT32'),\n  lt: s('lt').bank('RolandMT32'),\n  cr: s('cr').bank('Linn9000').speed(0.4).velocity(0.3).hpf(4000),\n}).room(.2).gain(0.5)",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of Pyramid Song', 'Cleaned syntax and sanitised helpers'],
    },
    rhythm_of_the_night: {
        id: 'rhythm_of_the_night',
        aliases: ["the rhythm of the night"],
        intentTags: ['cover', 'rhythm_of_the_night'],
        bpm: 128,
        key: 'G minor',
        scale: 'G minor',
        thought: "Corona - The Rhythm of the Night cover. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "// \"The Rhythm Of The Night\" - Work In Progress\n// song @by Corona\n// script @by eeefano\nsetDefaultVoicings('legacy')\nconst as = register('as', (mapping, pat) => { mapping = Array.isArray(mapping) ? mapping : [mapping];\n  return pat.fmap((v) => { v = Array.isArray(v) ? v : [v, 0];\n    return Object.fromEntries(mapping.map((prop, i) => [prop, v[i]])); }); });\n\nconst crdpart = \"<~ 0@10 1@24 0@19>\".pickRestart(\n[\"Ab Cm Bb F@2\".slow(5)\n,\"Bb@3 Ab@3 Cm@2\".slow(8)\n]);\nstack \n(\"<0 1@4 0 1@4 ~@8 2 3@7 2 3@7 0 1@4 0 1@4 0 1@4 0 1@4>\".pickRestart(\n  [\"~ [4@3 ~]!3 7:5 6 4 3\"\n  ,\"2:-1 0:-2 ~@4 6:1 4:-1 6 4:2 ~@4 [4:2 3]@3 ~@6 4 7:5 6 [4@2 ~] [3:-1 2@3]@2 0 ~@2\".slow(4)\n  ,\"~@6 [6 ~]!2\"\n  ,\"6 5@0.5 [5 ~] [4 ~]!2 [3 ~] 3:2@1.5 ~@7 6@2 6:2 [5 ~ ]!2 4 3@2 4 2 0:-2 ~@7 [0 2]@3 3@2 4 6:4 4:-4 ~ 0 2 0 4 ~ 0 0:2@2 ~@7\".slow(7)\n]).as(\"n:penv\").scale(\"c4:minor\").patt(\"0.07\").s(\"gm_lead_1_square\").room(0.4).delay(0.3).dfb(0.35).dt(60/128).gain(0.85)\n\n,crdpart.chord().anchor(\"F4\").voicing().s(\"gm_synth_strings_1\").color(\"blue\").gain(0.4)\n\n,\"<~@11 1@23 ~ 0@19>\".pickRestart(\n  [\"2 ~@2 2 ~@2 2 ~@3 2 ~@3 2 ~\"\n  ,\"[2 ~@2 2 ~@2 2 ~]!2\"\n]).n().chord(crdpart).anchor(crdpart.rootNotes(2)).voicing().s(\"gm_synth_bass_1\").lpf(1500).room(0.5).color(\"green\").gain(0.9)\n\n,\"<~@11 1@8 ~@16 0@19>\".pickRestart(\n  [\"<5 7 6 3!2> ~ 9 ~ 10 ~ ~ 12 ~ 11 ~ 10 ~ 11 9 ~\"\n  ,\"<6!3 5!3 7!2> ~ 9 ~ 10 ~ ~ 12 ~ 11 ~ 10 ~ 11 9 ~\"\n]).scale(\"c3:minor\").note().s(\"gm_lead_2_sawtooth\").room(0.3).delay(0.3).dfb(0.5).dt(60/128*2).color(\"red\").gain(0.6)\n\n,\"<[2,3] ~@10 0@6 [0,1]@2 [0,2] 0@5 [0,1]@2 [0,2] 0@6 [2,3] 0@8 [0,1]@2 [0,2] 0@8>\".pickRestart(\n [stack(s(\"bd*4\").gain(0.8),s(\"[~ oh]*4\").gain(0.14),s(\"hh*16\").gain(0.09),s(\"[~ cp]*2\").gain(0.4))\n ,s(\"[~ sd!3]!4 [sd*4]!4\").slow(2).gain(run(32).slow(2).mul(1/31).add(0.1).mul(0.4))\n ,s(\"cr\").gain(0.2)\n ,s(\"bd\").gain(0.8)\n ]).bank(\"RolandTR909\").room(0.2).color(\"yellow\").velocity(1)\n \n)",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of The Rhythm of the Night', 'Cleaned syntax and sanitised helpers'],
    },
    stranger_things: {
        id: 'stranger_things',
        aliases: ["stranger things theme","stranger things theme","stranger things theme song"],
        intentTags: ['cover', 'stranger_things'],
        bpm: 168,
        key: 'C major',
        scale: 'C major',
        thought: "Stranger Things Netflix theme. Bass and melody separated.",
        tracks: tracks({
            drums: "silence",
            bass: "\"<a1 e2>/8\".clip(0.8).struct(\"x*8\").s(\"supersaw\").note()",
            melody: "n(\"0 2 4 6 7 6 4 2\")\n  .scale(\"<c3:major>/2\")\n  .s(\"supersaw\")\n  .distort(0.7)\n  .superimpose((x) => x.detune(\"<0.5>\"))\n  .lpenv(perlin.slow(3).range(1, 4))\n  .lpf(perlin.slow(2).range(100, 2000))\n  .gain(0.3)",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["bass","melody"],
        qualityNotes: ['Authentic cover of Stranger Things Theme', 'Cleaned syntax and sanitised helpers'],
    },
    undertale_determination: {
        id: 'undertale_determination',
        aliases: ["determination"],
        intentTags: ['cover', 'undertale_determination'],
        bpm: 115,
        key: 'F# minor',
        scale: 'F# minor',
        thought: "Undertale Determination (Toby Fox cover) in F# minor. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "/*@Determination · Toby Fox(cover)\n  @by Claffystic\n  @details: This is an unofficial fanmade content. I made this to learn about Strudel and that's it\n            Reference: https://soundcloud.com/radixan/undertale-determination-midi-in-description\n            Pulled from YouTube description below. (https://www.youtube.com/watch?v=sRLQnlglfrI)\n            \n  Determination · Toby Fox\n  UNDERTALE Soundtrack\n  ℗ Toby Fox under license to Materia Collective\n  Released on: 2015-09-15\n  Producer: Toby Fox\n  Music  Publisher: Materia Collective Music Publishing\n  Composer: Toby Fox\n*/\n\n$lead: note(`<\n[F#5 F5 D#5 C#5 D#5 A#4 C5 ~]\n[G#4 ~ D#5 F5 F#5 ~ G#5 ~]\n[C#6 ~ A#5@5 ~]\n[F#5 F5 D#5 C#5 D#5 A#4 C5 ~]\n[G#4 ~ D#4 F4 F#4 ~ F4 ~]\n[C#4 ~ D#4@5 ~]\n\n[F#5 F5 D#5 C#5 D#5 A#4 C5 ~]\n[G#4 ~ D#5 F5 F#5 ~ G#5 ~]\n[C#6 ~ A#5@5 ~]\n[F#5 F5 D#5 C#5 D#5 A#4 C5 ~]\n[G#4 ~ D#4 F4 F#4 ~ F4 ~]\n[C#4 ~ D#4@5 ~] \n\n[[G#5,F5] [F#5,D#5] [E5,C#5] [D#5,B4] [C#5,A#4] [E5,C#5] [D#5,A#4] ~]\n[[A#4,F#4] ~ [A#4,F#4] [D#5,A#4] [G#5,E5] [F#5,D#5] [E5,C#5] [D#5,B4]]\n[[C#5,A#4] [E5,C#5] [D#5,A#4]@3 ~ [D#4,A#3] [G#4,D#4]]\n[[C#5,A#4] [C5,G#4] [A#4,F#4] [G#4,F4] [A#4,F#4] [C5,G#4] [A#4,F#4] ~]\n[[D#4,A#3] ~ [D#4,A#3] [F4,C#4] [F#4,D#4] ~ [B4,F#4] ~]\n[[D#5,B4]@2 [D5,A#4]@4 ~@2]\n\n[[G#5,F5] [F#5,D#5] [E5,C#5] [D#5,B4] [C#5,A#4] [E5,C#5] [D#5,A#4] ~]\n[[A#4,F#4] ~ [A#4,F#4] [D#5,A#4] [G#5,E5] [F#5,D#5] [E5,C#5] [D#5,B4]]\n[[C#5,A#4] [E5,C#5] [D#5,A#4]@3 ~ [D#4,A#3] [G#4,D#4]]\n[[C#5,A#4] [C5,G#4] [A#4,F#4] [G#4,F4] [A#4,F#4] [C5,G#4] [A#4,F#4] ~]\n[[D#4,A#3] ~ [D#4,A#3] [F4,C#4] [F#4,D#4] ~ [F4,C#4] ~]\n[[C#4,G#3]@2 [D#4,A#3]@4 ~@2]\n\n[~@8]\n>`).sound(\"square\").room(.5).roomsize(6).gain(.25).detune(\"[-5, 5]\")\n\n$harmony: note(`<\n[~ D#4 F#4 G#4 A#4 F#4 ~ G#4]\n[C5 D#5 C5 G#4 ~ D#4 F4 D#4]\n[G#4 F4 F#4 F4 D#4 C#4 D#4 A#3]\n[~ D#4 F#4 G#4 A#4 F#4 ~ D#4] \n[F#4 G#4 A#4 F#4 ~ D#4 F4 A#4]\n[F4 C#4 F#4 F4 D#4 C#4 D#4 F4]\n\n[~ D#4 F#4 G#4 A#4 F#4 ~ G#4]\n[C5 D#5 C5 G#4 ~ D#4 F4 D#4]\n[G#4 F4 F#4 F4 D#4 C#4 D#4 A#3]\n[~ D#4 F#4 G#4 A#4 F#4 ~ D#4] \n[F#4 G#4 A#4 F#4 ~ D#4 F4 A#4]\n[F4 C#4 F#4 F4 D#4 C#4 D#4 A#3]\n\n[G#3 D#4 G#4 F#4 A#4 G#4 F#4 G#4]\n[D#4 F#4 C#4 D#4 G#3 D#4 G#4 F#4]\n[A#4 G#4 F#4@3 ~@3]\n[~ D#3 C#4 A#3 G#4 F4 D#4 F4]\n[F#4 F4 d#4 F4 F#4 ~@3]\n[B4 ~ G#4 F#4 F4 D#4 D4 F4]\n\n[G#3 D#4 G#4 F#4 A#4 G#4 F#4 G#4]\n[D#4 F#4 C#4 D#4 G#3 D#4 G#4 F#4]\n[A#4 G#4 F#4@3 ~@3]\n[~@8]\n[~@2 D#4 F4 F#4 ~ F4 ~]\n[C#4@2 D#4@4 ~@2]\n\n[~@8]\n>`)",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of Determination', 'Cleaned syntax and sanitised helpers'],
    },
    shostakovich_waltz: {
        id: 'shostakovich_waltz',
        aliases: ["waltz #2","shostakovich waltz 2","waltz 2"],
        intentTags: ['cover', 'shostakovich_waltz'],
        bpm: 180,
        key: 'C minor',
        scale: 'C minor',
        thought: "Dmitri Shostakovich Waltz #2 cover in C minor. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "// \"Waltz #2\" (cps function demo)\n// composed @by Dmitri Shostakovich\n// script @by eefano\nsetDefaultVoicings('legacy')\n\nmelody: \"<~@4 0@16 1@7 2@11.5 ~@3.5>\".pickRestart([\n  `<4 [2@2 1] [0@4 0 1]@2 [2 0 2] [4@2 5] 4 3 \n    3 [1@2 0] [0b@4 -3 0b]@2 [1 0b 1] [3 4 5] 4b 4>`,\n    \"<[9,7] [[8,6]@2 [7,5]] [[6,4]@2 [5,3]] [3,0] [8,6] [[7,5]@2 [6,4]] [6,4]>\", \n  \"<[~ [2 ~] [3 ~]] [[4 ~] [4 3] [4 5]] [[3 ~] [3 2] [3 4]] [[2 ~] ~ [4 ~]] > \".sub(\"<0 0 [0,2]>/4\") ])\n      .scale(\"c4:minor\").note().s(\"gm_oboe:2\").gain(0.7)\n   \npiano: \"<0@28 1@10 0@4>\".pickRestart([\n     n(\"<<0 -1> [4,5]!2>*3\").chord(\"<Cm@10 Fm@4 G@4 Cm@4 Fm@2 Bb@2 Eb Ab>\"),\n     n(\"<3 <[4,5] > ~>*3\").chord(\"<G Ab Cm Ab>\")\n          ]).anchor('f2').mode('root').voicing().piano()\n\ntempochanges: cps(sine.segment(32).slow(16).mul(30).add(160).div(60*3)).gain(0)\n\nall(x=>x\n  //.ribbon(24,16)\n  .room(0.6))",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of Waltz #2', 'Cleaned syntax and sanitised helpers'],
    },
    billie_birds: {
        id: 'billie_birds',
        aliases: ["birds of a feather", "birds of feather", "feather"],
        intentTags: ['cover', 'billie_birds'],
        bpm: 105,
        key: 'D major',
        scale: 'D major',
        thought: "Birds of a Feather (Billie Eilish cover) in D major. Full arrangement in melody track.",
        tracks: tracks({
            drums: "silence",
            bass: "silence",
            melody: "/*\n@title BIRDS OF A FEATHER (REMAKE)\n@by saga_3k <https://linktr.ee/saga3k>\n@license CC BY-NC-SA\n*/\n\n// melody (1 bar loop)\nlet m1 = \nnote(\"<[D@3 A@2 ~ D@2] [Cs@2 ~ A@2 ~ Cs@2]>\".add(\"12,24\")).s(\"gm_kalimba:3\").legato(1.5).fast(2)\n.attack(.025).release(.2).lp(1000)\n.room(\".6:2\").postgain(1.5).color('#4dbcf4')\n\n// melody with guitar layer (1 bar loop)\nlet m2 = \nnote(\"<[D@3 A@2 ~ D@2] [Cs@2 ~ A@2 ~ Cs@2]>\".add(\"12,24\"))\n.layer(\nx=>x.s(\"gm_kalimba:3\").legato(1.5).attack(.025).release(.2).lp(1000).room(\".6:2\").postgain(2),\nx=>x.s(\"gm_acoustic_guitar_steel:6\").clip(1.5).release(.2).room(\".6:2\").postgain(1)\n).fast(2)\n\n// drum pattern (1 bar loop)\nlet dr =\nstack( s(\"[bd:<1 0>(<3 1>,8,<0 2>:1.3)] , [~ sd:<15>:2.5]\").note(\"B1\").bank(\"LinnDrum\")\n.decay(.3).room(\".3:2\").fast(2),\n\ns(\"[LinnDrum_hh(<3 2>,8)]\").hp(\"1000\").lp(\"9000\").decay(.3).velocity([\".8 .6\"]).room(\".3:2\").fast(2),\ns(\"sh*8\").note(\"B1\").bank(\"RolandTR808\").room(\".6:2\").velocity(\"[.8 .5]!4\").postgain(1.5).fast(2))\n\n// chord progression (8 bar loop)\nlet chord =\nn(`<[[0,2,4,6] ~!3] ~ ~ ~\n[[-1,0,2,4] ~!3] ~ ~ ~ \n[[1,3,5,7] ~!3]  ~ ~ ~\n[[-2,0,1,3] ~!3]  ~ [[-2,-1,1,3] ~!3] ~ \n>`).scale(\"D:major\").s(\"gm_epiano1:6\")  //gm_epiano1:6 or gm_bandoneon:6\n.decay(1.5).release(.25).lp(2500).delay(\".45:.1:.3\").room(\".6:2\")\n.postgain(1.5).fast(2)\n\n// bass root note (8 bar loop)\nlet bass1note =\nn(\"<0 -1 1 -2>/2\").scale(\"D1:major\").s(\"gm_lead_8_bass_lead:1\")\n.lp(800).clip(.1).attack(.2).release(.12)\n.delay(\".45:.1:.3\").room(\".6:2\")\n.postgain(1.3)\n\n// bassline fast guitar (8 bar loop)\nlet bassline =\nnote(\"<[D2!28 Cs2!4] B1*32 [E2!28 D2!4] A1*32>/2\").s(\"gm_electric_bass_pick\")\n.decay(.5).velocity(rand.range(.7,1).fast(4))\n.lp(1000).compressor(\"-20:20:10:.002:.02\").room(\".6:2\")\n.postgain(1.5).color('white')\n\n// chord progession organ layer (8 bar loop)\nlet chordOrg =\nn(`<[0,2,4,6]\n[-1,0,2,4]\n[1,3,5,7]\n[-2,0,1,3]\n>/2`).scale(\"D2:major\").s(\"gm_church_organ:4\")\n.legato(1).delay(\".45:.1:.3\").room(\".6:2\")\n.postgain(.6)\n\n// chord progession arp layer (8 bar loop)\nlet chordArp =\nn(`<[0 2 4 6]*8\n[-1 0 2 4]*8\n[1 3 5 7]*8\n[-2 0 1 3]*8\n>/2`).scale(\"D4:major\").s(\"gm_electric_guitar_jazz:<2 3>\")\n.legato(.08).delay(\".45:.1:.3\").room(\".6:2\").velocity(saw.range(.8,1).fast(4))\n.juxBy(1,rev())\n.postgain(1.8)\n\n// arrangement\n$:arrange(\n  [2,stack(m1,dr)],\n  [8,s_polymeter(m1,dr,chord,bass1note)],\n  [8,s_polymeter(m1,dr,chord,bass1note,bassline)],\n  [8,s_polymeter(m2,dr,chord,bass1note,bassline,chordArp)],\n  [8,s_polymeter(m2,dr,chord,bass1note,bassline,chordOrg,chordArp)],\n  [4,s_polymeter(m2,dr,chord,bass1note,bassline,chordOrg,chordArp)],\n  [4,s_polymeter(m2,arrange([2,dr],[2,silence]).fast(4),bass1note,bassline,chordOrg)]\n  )",
            voice: "silence",
            fx: "silence",
        }),
        requiredTracks: ["melody"],
        qualityNotes: ['Authentic cover of Birds of a Feather', 'Cleaned syntax and sanitised helpers'],
    },
    generic: {
        id: 'generic',
        aliases: ['music', 'loop'],
        intentTags: ['generic', 'safe'],
        bpm: 120,
        key: 'C minor',
        scale: 'C minor',
        thought: 'Creating a safe balanced loop with drums, bass, and a simple melodic hook.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*4').gain(0.78), s('~ RolandTR909_sd ~ RolandTR909_sd').gain(0.58), s('RolandTR909_hh*8').gain(0.16).hpf(6500))",
            bass: "note(m('c2 ~ eb2 ~ g1 ~ eb2 ~')).s('triangle').att(0.01).decay(0.2).lpf(520).gain(0.58)",
            melody: "note(m('c4 eb4 g4 bb4')).s('sine').att(0.01).decay(0.2).room(0.25).gain(0.32).slow(2)",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Fallback only', 'Balanced gain', 'Simple structure'],
    },
};

const GENRE_PATTERNS: Array<[GenreKey, RegExp]> = [
    ['dnb', /\b(dnb|drum\s*(?:and|&)\s*bass|jungle|breakbeat)\b/i],
    ['pop_funk', /\b(michael\s+jackson|mj|pop\s*funk|dance\s*pop\s*funk)\b/i],
    ['italo_80s', /\b(italo|italo\s*disco|80s\s*techno|techno\s+italo\s+80s|italo\s+80s)\b/i],
    ['hiphop', /\b(hip\s*hop|hip-hop|rap|boom\s*bap|trap)\b/i],
    ['metal', /\b(metal|heavy\s*metal|chug|double\s*kick)\b/i],
    ['punk', /\b(punk|pop\s*punk)\b/i],
    ['rock', /\b(rock|guitar|riff|power\s*chords?|distorted\s*guitar|grunge|hard\s*rock)\b/i],
    ['funk', /\b(funk|funky|groove)\b/i],
    ['jazz', /\b(jazz|jazzy|swing)\b/i],
    ['latin', /\b(latin|salsa|cumbia|reggaeton|bachata)\b/i],
    ['reggae', /\b(reggae|dub|ska)\b/i],
    ['trance', /\b(trance|uplifting|euphoric)\b/i],
    ['acid', /\b(acid|303|squelchy)\b/i],
    ['minimal', /\b(minimal|hypnotic)\b/i],
    ['ambient', /\b(ambient|atmospheric|chill|relax|calm|peaceful)\b/i],
    ['house', /\b(house|deep\s*house)\b/i],
    ['techno', /\b(techno|rave|industrial)\b/i],
    ['pop', /\b(pop|catchy|radio)\b/i],
];

export function detectGenre(prompt: string): GenreKey | null {
    for (const [genre, pattern] of GENRE_PATTERNS) {
        if (pattern.test(prompt)) return genre;
    }
    return null;
}

export function isRepairPrompt(prompt: string) {
    return /\b(sounds?\s+horrible|horrible|bad|awful|terrible|muddy|harsh|too\s+distorted|too\s+loud|clean(?:er)?|fix|repair)\b/i.test(prompt);
}

export function isHumanizePrompt(prompt: string) {
    return /\b(non\s*even|not\s+even|less\s+even|human|humanize|swing|syncop|groove|too\s+straight|less\s+rigid|robotic|mechanical|stiff)\b/i.test(prompt);
}

export function isBroadMusicRequest(prompt: string) {
    const p = prompt.trim().toLowerCase();
    const wordCount = p.split(/\s+/).filter(Boolean).length;
    return wordCount <= 5 || /\b(play|make|create|generate|start|give\s+me|some|music|loop|beat|song)\b/i.test(p);
}

export function isMichaelJacksonPrompt(prompt: string) {
    return /\bmichael\s+jackson\b|\bmj\b/i.test(prompt);
}

export function isDrumOnlyPrompt(prompt: string) {
    const p = prompt.toLowerCase();
    const explicitOnly = /\b(?:pure|only|just|solo)\s+(?:drums?|percussion|beat|beats)\b/.test(p);
    const drumIntent = /\b(?:drums?|drum\s+loop|beat|beats|percussion|kick|snare|hi-?hat|hats?)\b/.test(p);
    const fullArrangementSignals = /\b(?:bassline|bass|guitar|riff|melody|chords?|song|full|complete)\b/.test(p);
    const drumAndBassGenre = /\bdrum\s*(?:and|&)\s*bass\b/.test(p) && !/\b(?:dnb|jungle|breakbeat)\s+drums?\b/.test(p);
    return explicitOnly || (drumIntent && !fullArrangementSignals && !drumAndBassGenre);
}

export function isDoubleTapDrumPrompt(prompt: string) {
    const p = prompt.toLowerCase();
    return isDrumOnlyPrompt(prompt) && !/\b(?:triple|three\s*hit|3\s*hit)\b/.test(p) && /\b(?:double|double\s*tap|two\s*hit|2\s*hit|tap|flam|ratchet|stutter)\b/.test(p);
}

export function inferGenreFromCode(currentCode?: string): GenreKey | null {
    if (!currentCode) return null;
    const code = currentCode.toLowerCase();
    if (/distort\(|power|e1|e2|guitar|riff|sawtooth/.test(code) && /rolandtr909_sd|snare|sd/.test(code)) {
        return 'rock';
    }
    if (/rolandtr909_bd\*4|resonance\(1[02468]|acid/.test(code)) return 'techno';
    if (/room\(0\.9|slow\(8|ambient|pink/.test(code)) return 'ambient';
    return null;
}

export function detectSpecificSong(prompt: string): GenreKey | null {
    const p = prompt.toLowerCase();
    if (p.includes('blue monday')) return 'blue_monday';
    if (p.includes('stranger things')) return 'stranger_things';
    if (p.includes('music 4 machines') || p.includes('music4machines') || (p.includes('grimes') && p.includes('machines'))) return 'grimes_m4m';
    if (p.includes('360') && (p.includes('charli') || p.includes('xcx'))) return 'charli_360';
    if (p.includes('birds of a feather') || (p.includes('billie') && p.includes('feather'))) return 'billie_birds';
    if (p.includes('bug from heaven') || p.includes('bugfromheaven')) return 'bug_from_heaven';
    if (p.includes('pyramid song') || (p.includes('radiohead') && p.includes('pyramid'))) return 'pyramid_song';
    if (p.includes('rhythm of the night') || p.includes('rhythmofthenight') || p.includes('rhythm of night')) return 'rhythm_of_the_night';
    if (p.includes('pump up the jam') || p.includes('pumpupthejam')) return 'pump_up_the_jam';
    if (p.includes('happy birthday')) return 'happy_birthday';
    if (p.includes('waltz 2') || p.includes('waltz #2') || p.includes('shostakovich waltz')) return 'shostakovich_waltz';
    if (p.includes('old macdonald') || p.includes('old mcdonald')) return 'old_macdonald';
    if (p.includes('determination') || (p.includes('undertale') && p.includes('determination'))) return 'undertale_determination';
    return null;
}

export function getTemplateForPrompt(prompt: string, currentCode?: string): GenreTemplate {
    const songKey = detectSpecificSong(prompt);
    if (songKey) {
        return GENRE_TEMPLATES[songKey];
    }
    if (isMichaelJacksonPrompt(prompt)) {
        return GENRE_TEMPLATES.pop_funk;
    }
    if (/\bdrums?\b/i.test(prompt) && /\bblink\s*-?\s*182\b|\bblink182\b/i.test(prompt)) {
        return GENRE_TEMPLATES.pop_punk_drums;
    }
    if (/\b(?:triple\s*tap|triple|three\s*hit|3\s*hit)\b/i.test(prompt) && isDrumOnlyPrompt(prompt)) return GENRE_TEMPLATES.triple_tap_drums;
    if (isDoubleTapDrumPrompt(prompt)) return GENRE_TEMPLATES.double_tap_drums;
    if (/\b(?:i\s+said|actually|no,?|cleaner|very\s+clean|super\s+clean)\b/i.test(prompt) && /\bclean\s+drums?\b/i.test(prompt)) return GENRE_TEMPLATES.tight_clean_drums;
    if (/\bclean\s+drums?\b/i.test(prompt)) return GENRE_TEMPLATES.clean_drums;
    if (isDrumOnlyPrompt(prompt)) return GENRE_TEMPLATES.drums;

    if (isRepairPrompt(prompt)) {
        const genre = detectGenre(prompt) || inferGenreFromCode(currentCode);
        if (genre === 'metal') return GENRE_TEMPLATES.metal;
        return GENRE_TEMPLATES.clean_rock;
    }

    if (isHumanizePrompt(prompt)) {
        const genre = detectGenre(prompt) || inferGenreFromCode(currentCode);
        if (!genre || genre === 'rock' || genre === 'metal' || genre === 'punk') return GENRE_TEMPLATES.humanized_rock;
    }

    const genre = detectGenre(prompt);
    return genre ? GENRE_TEMPLATES[genre] : GENRE_TEMPLATES.generic;
}

export function shouldUseDeterministicTemplate(prompt: string) {
    if (detectSpecificSong(prompt)) return true;
    if (isMichaelJacksonPrompt(prompt)) return true;
    if (isDrumOnlyPrompt(prompt)) return true;
    if (/\bdrums?\b/i.test(prompt) && /\bblink\s*-?\s*182\b|\bblink182\b/i.test(prompt)) return true;
    if (isRepairPrompt(prompt) || isHumanizePrompt(prompt)) return true;
    return Boolean(detectGenre(prompt)) && isBroadMusicRequest(prompt) && !/\b(add|only|mute|remove|delete|just|change\s+the|make\s+the\s+drums|make\s+the\s+bass)\b/i.test(prompt);
}

export function buildTemplateResponse(template: GenreTemplate, thought?: string, bpmOverride?: number | null): AgentUpdateResponse {
    return {
        type: 'update_tracks',
        bpm: bpmOverride ?? template.bpm,
        tracks: template.tracks,
        thought: thought || template.thought,
    };
}

const cloneTrackMap = (value: Partial<TrackMap>): TrackMap => ({
    drums: value.drums ?? null,
    bass: value.bass ?? null,
    melody: value.melody ?? null,
    voice: value.voice ?? null,
    fx: value.fx ?? null,
});

const applyIntentClears = (tracks: TrackMap, intent: MusicIntent): TrackMap => {
    const next = cloneTrackMap(tracks);
    for (const trackId of intent.clearTracks) {
        next[trackId] = 'silence';
    }
    return next;
};

export function buildIntentFallback(intent: MusicIntent, context: MusicContext, thought?: string): AgentUpdateResponse {
    if (intent.kind === 'tempo_change') {
        return {
            type: 'update_tracks',
            thought: thought || `Tempo changed to ${intent.nextBpm ?? context.currentBpm} BPM while preserving the current tracks.`,
            bpm: intent.nextBpm ?? context.currentBpm,
            tracks: applyIntentClears(cloneTrackMap(context.tracks), intent),
        };
    }

    if (!intent.templateId) {
        return {
            type: 'update_tracks',
            thought: thought || intent.reason,
            bpm: intent.nextBpm ?? context.currentBpm,
            tracks: applyIntentClears(cloneTrackMap(context.tracks), intent),
        };
    }

    const template = GENRE_TEMPLATES[intent.templateId] || GENRE_TEMPLATES.generic;
    return {
        ...buildTemplateResponse(template, thought || template.thought, intent.nextBpm),
        tracks: applyIntentClears(template.tracks, intent),
    };
}

export function buildDeterministicMusicResponse(prompt: string, currentCode?: string): AgentUpdateResponse | null;
export function buildDeterministicMusicResponse(intent: MusicIntent, context: MusicContext): AgentUpdateResponse | null;
export function buildDeterministicMusicResponse(
    promptOrIntent: string | MusicIntent,
    currentCodeOrContext?: string | MusicContext,
): AgentUpdateResponse | null {
    if (typeof promptOrIntent !== 'string') {
        const intent = promptOrIntent;
        const context = currentCodeOrContext as MusicContext;
        if (intent.kind === 'create_full_style' && intent.templateId === 'generic') return null;
        return buildIntentFallback(intent, context);
    }

    const prompt = promptOrIntent;
    const currentCode = typeof currentCodeOrContext === 'string' ? currentCodeOrContext : undefined;
    if (!shouldUseDeterministicTemplate(prompt)) return null;
    return buildTemplateResponse(getTemplateForPrompt(prompt, currentCode));
}

export function buildFallbackResponse(prompt: string, thought: string, currentCode?: string): AgentUpdateResponse {
    const template = getTemplateForPrompt(prompt, currentCode);
    return buildTemplateResponse(template, thought || template.thought);
}

export function buildTemplateGrounding(prompt: string, currentCode?: string): string;
export function buildTemplateGrounding(intent: MusicIntent, context: MusicContext): string;
export function buildTemplateGrounding(promptOrIntent: string | MusicIntent, currentCodeOrContext?: string | MusicContext) {
    const template = typeof promptOrIntent === 'string'
        ? getTemplateForPrompt(promptOrIntent, typeof currentCodeOrContext === 'string' ? currentCodeOrContext : undefined)
        : (promptOrIntent.templateId ? GENRE_TEMPLATES[promptOrIntent.templateId] : GENRE_TEMPLATES.generic);
    const intentLines = typeof promptOrIntent === 'string'
        ? []
        : [
            `Intent: ${promptOrIntent.kind}`,
            `Target tracks: ${promptOrIntent.targetTracks.join(', ') || 'none'}`,
            `Preserve tracks: ${promptOrIntent.preserveTracks.join(', ') || 'none'}`,
            `Clear tracks: ${promptOrIntent.clearTracks.join(', ') || 'none'}`,
            `Reason: ${promptOrIntent.reason}`,
        ];
    const required = template.requiredTracks.join(', ');
    return [
        '## TARGET TEMPLATE FOR THIS REQUEST',
        ...intentLines,
        `Genre/template: ${template.id}`,
        `BPM: ${template.bpm}`,
        `Key: ${template.key}`,
        `Required tracks: ${required}`,
        `Quality notes: ${template.qualityNotes.join('; ')}`,
        'Use this template as the musical reference. Return the same public JSON shape: type, thought, bpm, tracks.',
        'Preserve existing tracks unless the user asks for a full replacement. For broad genre requests, provide drums, bass, and a clear musical hook when the template requires them.',
    ].join('\n');
}
