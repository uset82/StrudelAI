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
    | 'breakbeat_90s'
    | 'spacesynth'
    | 'cinematic_electronic'
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
} | {
    type: 'chat';
    message: string;
    bpm: number;
    tracks: TrackMap;
    thought?: string;
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
        aliases: ['hip hop', 'hip-hop', 'rap', 'rap beat', 'boom bap', 'trap'],
        intentTags: ['hiphop', 'rap', 'beat', 'bass', 'vocal-space'],
        bpm: 92,
        key: 'F minor',
        scale: 'F minor',
        thought: 'Rap beat: punchy half-time drums, low 808-style bass, and open space for vocals instead of a melodic lead.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ ~ RolandTR808_bd ~').gain(0.96).lpf(185), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.76).hpf(430), s('RolandTR909_hh ~ RolandTR909_hh RolandTR909_hh ~ RolandTR909_hh ~ RolandTR909_hh').gain(0.14).hpf(7600), s('~ ~ ~ RolandTR909_cp ~ ~ ~ ~').gain(0.18).hpf(1200))",
            bass: "note(m('f1 ~ f1 ~ db1 ~ eb1 ~')).s('sine').att(0.006).decay(0.32).lpf(95).gain(0.86)",
            melody: 'silence',
            voice: 'silence',
            fx: "s('pink').hpf(1800).lpf(3600).gain(0.035).room(0.18).slow(8)",
        }),
        requiredTracks: ['drums', 'bass'],
        qualityNotes: ['Leaves room for rap vocals', 'No melodic sine lead unless requested', '808-style bass is low and filtered', 'Kick and snare stay clear'],
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
        aliases: ['reggae', 'dub', 'ska', 'roots reggae', 'jamaican roots', 'dark reggae'],
        intentTags: ['reggae', 'offbeat', 'dub', 'roots', 'jamaican'],
        bpm: 74,
        key: 'G minor',
        scale: 'G minor',
        thought: 'Dark roots reggae: slow one-drop pocket, deep spacious bass, offbeat skank chords, and dub delay space.',
        tracks: tracks({
            drums: "stack(s('~ ~ RolandTR808_bd ~').gain(0.82).lpf(210), s('~ ~ RolandTR909_sd ~').gain(0.62).hpf(470).delay(0.18), s('RolandTR909_hh ~ RolandTR909_hh ~').gain(0.12).hpf(6400), s('~ RolandTR909_rim ~ RolandTR909_rim').gain(0.16).hpf(1300).delay(0.28))",
            bass: "note(m('g1 ~ ~ d2 ~ bb1 ~ d2')).s('triangle').att(0.012).decay(0.38).lpf(360).gain(0.82).slow(2)",
            melody: "note(m('~ <g3 bb3 d4> ~ <f3 a3 c4> ~ <eb3 g3 bb3> ~ <f3 a3 c4>')).s('square').att(0.004).decay(0.09).hpf(420).lpf(2100).delay(0.32).room(0.3).gain(0.32).slow(2)",
            fx: "s('pink').hpf(sine.range(900, 4200).slow(8)).lpf(6800).delay(0.38).room(0.42).gain(sine.range(0.025, 0.12).slow(8))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['One-drop pocket', 'Offbeat skank chops', 'Deep delayed dub bass', 'Slow Jamaican roots feel'],
    },
    techno: {
        id: 'techno',
        aliases: ['techno', 'rave', 'industrial techno'],
        intentTags: ['techno', 'four-on-floor', 'electronic'],
        bpm: 132,
        key: 'C minor',
        scale: 'C minor',
        thought: 'Techno: four-on-floor 909 kick, clap on 2&4, driving 16th hats, dark filtered bass separated from kick.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*4').gain(0.98), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.82), s('RolandTR909_hh*16').gain(0.32), s('~ RolandTR909_oh ~ RolandTR909_oh').gain(0.18))",
            bass: "note(m('c1 ~ c1 ~ eb1 ~ g1 ~')).s('sawtooth').att(0.008).decay(0.22).lpf(sine.range(180, 580).slow(3)).resonance(12).gain(0.72)",
            melody: null,
            fx: "s('pink').hpf(sine.range(180, 11000).slow(8)).gain(sine.range(0.06, 0.28).slow(8))",
        }),
        requiredTracks: ['drums', 'bass'],
        qualityNotes: ['Stable tempo', 'Four-on-floor', 'Bass/kick separated', 'No busy melody by default'],
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
    breakbeat_90s: {
        id: 'breakbeat_90s',
        aliases: ['90s breakbeat', 'old school breakbeat', 'rave breakbeat', 'breakbeat track', 'big beat'],
        intentTags: ['breakbeat', '90s', 'rave', 'broken-beat'],
        bpm: 132,
        key: 'C minor',
        scale: 'C minor',
        thought: '90s breakbeat: broken kick/snare pattern, busy hats, rave stabs, rolling bass, and filter-sweep FX.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ RolandTR909_bd ~ ~').gain(0.96).lpf(220), s('~ ~ RolandTR909_sd ~ ~ RolandTR909_sd ~ RolandTR909_sd').gain(0.78).hpf(520), s('RolandTR909_hh*16').gain(0.18).hpf(7200), s('~ ~ ~ RolandTR909_oh ~ ~ RolandTR909_oh ~').gain(0.14).hpf(5600))",
            bass: "note(m('c1 c1 ~ eb1 c1 ~ g1 bb1')).s('sawtooth').att(0.006).decay(0.16).lpf(sine.range(220, 760).slow(2)).resonance(10).gain(0.72)",
            melody: "stack(note(m('<c4 eb4 g4> ~ ~ <bb3 eb4 g4> ~ <c4 f4 g4> ~ ~')).s('square').att(0.003).decay(0.07).hpf(520).lpf(3400).room(0.16).gain(0.34), note(m('c5 ~ eb5 ~ g5 ~ bb5 ~')).s('supersaw').att(0.004).decay(0.08).hpf(900).lpf(4200).gain(0.2).slow(2))",
            voice: null,
            fx: "stack(s('pink').hpf(sine.range(600, 12000).slow(8)).gain(sine.range(0.04, 0.18).slow(8)), note(m('c6 ~ c6 ~ eb6 ~ g6 ~')).s('square').att(0.001).decay(0.035).hpf(1200).crush(6).gain(0.14).every(4, rev))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Broken beat, not four-on-floor', '90s rave stab color', 'Fast hats and rolling bass', 'Controlled filter movement'],
    },
    spacesynth: {
        id: 'spacesynth',
        aliases: ['spacesynth', 'space synth', 'synthwave', 'spacewave', 'koto-style spacesynth', 'koto style spacesynth'],
        intentTags: ['spacesynth', 'synthwave', 'koto-style', 'cosmic', 'arpeggio'],
        bpm: 122,
        key: 'A minor',
        scale: 'A minor pentatonic',
        thought: 'Koto-style spacesynth: retro electro pulse, octave square bass, pentatonic plucked lead, and wide cosmic pad FX.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd*4').gain(0.76).lpf(190), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.48).hpf(700), s('RolandTR808_hh*8').gain(0.13).hpf(6800), s('~ ~ RolandTR909_oh ~').gain(0.09).hpf(5600))",
            bass: "note(m('a1 a2 e2 a2 g1 g2 e2 g2')).s('square').att(0.004).decay(0.15).lpf(780).gain(0.62)",
            melody: "stack(note(m('a4 c5 d5 e5 g5 e5 d5 c5')).s('piano').att(0.002).decay(0.16).hpf(620).lpf(4300).delay(0.22).room(0.24).gain(0.3).slow(2), note(m('a5 ~ e5 ~ c5 ~ d5 ~')).s('sine').att(0.01).decay(0.18).hpf(700).lpf(3600).gain(0.16).slow(4))",
            voice: null,
            fx: "stack(note(m('<a3 c4 e4> <g3 b3 e4>')).s('sine').slow(8).room(0.9).delay(0.48).lpf(1500).gain(0.24), s('pink').hpf(sine.range(1200, 9000).slow(16)).gain(sine.range(0.025, 0.12).slow(16)).room(0.55))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Pentatonic plucked lead suggests koto without unavailable samples', 'Retro octave bass', 'Cosmic pad/FX bed', 'No generic techno collapse'],
    },
    cinematic_electronic: {
        id: 'cinematic_electronic',
        aliases: ['cinematic electronic', 'relay and capacitor', 'capacitor sounds', 'relay sounds', 'electroacoustic cinematic'],
        intentTags: ['cinematic', 'electronic', 'relay', 'capacitor', 'sound-design'],
        bpm: 96,
        key: 'C minor',
        scale: 'C minor',
        thought: 'Cinematic relay/capacitor electronic: sparse pulse, electrical clicks, capacitor-discharge synth plucks, dark bass, and wide tension FX.',
        tracks: tracks({
            drums: "stack(note(m('c2 ~ ~ c2 ~ ~ c2 ~')).s('square').att(0.001).decay(0.055).lpf(130).gain(0.48), note(m('~ c6 ~ ~ c6 c6 ~ c6')).s('pink').att(0.001).decay(0.018).hpf(1800).crush(5).gain(0.12))",
            bass: "note(m('c1 ~ ~ g1 ~ eb1 ~ g1')).s('sine').att(0.02).decay(0.45).lpf(150).gain(0.58).slow(2)",
            melody: "stack(note(m('c5 ~ g4 ~ eb5 ~ d5 ~')).s('square').att(0.001).decay(0.09).hpf(650).lpf(sine.range(900, 3600).slow(4)).crush(6).delay(0.18).gain(0.24), note(m('<c4 eb4 g4> ~ <g3 bb3 d4> ~')).s('sine').slow(8).room(0.88).lpf(1200).gain(0.2))",
            voice: null,
            fx: "stack(s('pink').hpf(sine.range(200, 11000).slow(16)).gain(sine.range(0.02, 0.2).slow(16)).room(0.65), note(m('c6 ~ c6 ~ g5 c6 ~ eb6')).s('square').att(0.001).decay(0.03).hpf(1600).crush(4).gain(0.13).every(4, rev))",
        }),
        requiredTracks: ['drums', 'bass', 'melody', 'fx'],
        qualityNotes: ['Relay-like clicks use short square/pink transients', 'Capacitor-discharge plucks use fast envelopes and filters', 'Cinematic space without mud', 'Sparse intentional arrangement'],
    },
    trance: {
        id: 'trance',
        aliases: ['trance', 'uplifting', 'euphoric', 'tiesto', 'tiësto', 'festival trance'],
        intentTags: ['trance', 'arpeggio', 'uplifting', 'artist-reference', 'supersaw'],
        bpm: 138,
        key: 'A minor',
        scale: 'A minor',
        thought: 'Tiësto-safe uplifting trance: driving 909 kick, offbeat saw bass, layered supersaw chord/arp hook, breakdown pad, and long riser/downlifter FX.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*4').gain(0.98).lpf(190), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.7).hpf(620), s('~ RolandTR909_oh ~ RolandTR909_oh').gain(0.24).hpf(5600), s('RolandTR909_hh*16').gain(0.16).hpf(7600))",
            bass: "note(m('~ a1 ~ a1 ~ e2 ~ g1')).s('sawtooth').att(0.004).decay(0.16).lpf(sine.range(360, 980).slow(4)).resonance(9).gain(0.72)",
            melody: "stack(note(m('a4 c5 e5 a5 e5 c5 a4 e4')).s('supersaw').att(0.006).decay(0.18).hpf(320).lpf(4200).room(0.42).delay(0.24).gain(0.38).slow(2), note(m('<a3 c4 e4> ~ <c4 e4 a4> ~ <e4 g4 b4> ~ <g4 b4 e5> ~')).s('supersaw').att(0.02).decay(0.42).hpf(260).lpf(sine.range(1600, 5200).slow(8)).room(0.72).delay(0.36).gain(0.24).slow(4))",
            voice: null,
            fx: "stack(s('pink').hpf(sine.range(450, 15000).slow(8)).gain(sine.range(0.03, 0.28).slow(8)).room(0.45), note(m('a5 b5 c6 e6 a6 e6 c6 b5')).s('sine').fast(2).hpf(900).lpf(sine.range(1800, 8000).slow(8)).delay(0.3).gain(0.13).slow(8), s('pink').hpf(sine.range(12000, 500).slow(16)).gain(sine.range(0.12, 0.02).slow(16)).room(0.65))",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['BPM explicit around 138', 'Offbeat bass is audible', 'Layered supersaw arp/chords', 'Breakdown/build FX present', 'Not generic C-minor techno'],
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
            drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ ~ RolandTR808_bd ~').gain(0.9).lpf(180), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.68).hpf(450), s('RolandTR909_hh ~ RolandTR909_hh RolandTR909_hh ~ RolandTR909_hh ~ RolandTR909_hh').gain(0.12).hpf(7600))",
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
    grimes_m4m: {
        id: 'grimes_m4m',
        aliases: ['music 4 machines', 'grimes music 4 machines', 'grimes machines'],
        intentTags: ['song', 'cover', 'reference', 'grimes_m4m'],
        bpm: 135,
        key: 'F major',
        scale: 'F major',
        thought: 'Reference-inspired Music 4 Machines loop: 135 BPM synth-pop drums, low bass, arpeggio, and airy lead. Uses Awesome Strudel source traits without copying the full script.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*4').gain(0.84).lpf(180), s('~ RolandTR909_sd ~ RolandTR909_cp').gain(0.46).hpf(520), s('~ RolandTR909_hh ~ RolandTR909_hh').gain(0.16).hpf(6800))",
            bass: "note(m('f1 ~ c2 ~ eb1 ~ f1 ~')).s('sawtooth').att(0.01).decay(0.18).lpf(260).gain(0.62)",
            melody: "stack(note(m('f3 c4 a4 f3 c4 g4 f3 eb4')).s('sawtooth').att(0.006).decay(0.12).hpf(360).lpf(3600).delay(0.18).room(0.28).gain(0.24), note(m('a4 ~ g4 ~ f4 ~ c5 ~')).s('sine').att(0.02).decay(0.24).room(0.45).gain(0.2))",
            voice: null,
            fx: "s('pink').hpf(5000).lpf(9000).gain(0.035).slow(8).room(0.35)",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Reference-inspired Grimes synth-pop traits', 'Track-separated and validator-safe'],
    },
    charli_360: {
        id: 'charli_360',
        aliases: ['360', 'charli 360', 'charli xcx 360'],
        intentTags: ['song', 'cover', 'reference', 'charli_360'],
        bpm: 120,
        key: 'E minor',
        scale: 'E minor',
        thought: 'Reference-inspired 360 loop: clipped electropop bass, 808-style kick/clap, short saw lead, and camera-flash style accent.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ RolandTR808_bd ~ ~').gain(0.88).lpf(180), s('~ ~ RolandTR909_cp ~ ~ ~ RolandTR909_cp ~').gain(0.58).hpf(650), s('RolandTR909_hh*8').gain(0.12).hpf(7400))",
            bass: "note(m('e1 ~ e1 f1 ~ f1 g1 ~')).s('sawtooth').att(0.004).decay(0.18).lpf(520).gain(0.64)",
            melody: "note(m('g4 ~ g4 g4 ~ a4 g4 ~')).s('sawtooth').att(0.002).decay(0.09).hpf(520).lpf(3100).gain(0.28)",
            voice: null,
            fx: "s('pink').hpf(7200).decay(0.04).gain(0.04)",
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Reference-inspired Charli-style electropop groove', 'No external vocal samples required'],
    },
    bug_from_heaven: {
        id: 'bug_from_heaven',
        aliases: ['bug from heaven', 'bug from heaven eefano'],
        intentTags: ['song', 'cover', 'reference', 'bug_from_heaven'],
        bpm: 128,
        key: 'C minor',
        scale: 'C minor',
        thought: 'Reference-inspired Bug From Heaven loop: strummed guitar-like rhythm, simple low support, and soft vocal-synth contour.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ ~ RolandTR909_bd ~').gain(0.66), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.42).hpf(520), s('RolandTR909_hh*8').gain(0.08).hpf(6800))",
            bass: "note(m('c1 ~ g1 ~ bb1 ~ g1 ~')).s('triangle').att(0.012).decay(0.22).lpf(360).gain(0.5)",
            melody: "stack(note(m('c3 ~ eb3 g3 ~ bb3 g3 ~')).s('sawtooth').att(0.008).decay(0.16).hpf(220).lpf(2800).gain(0.28), note(m('g4 ~ f4 eb4 ~ c4 eb4 ~')).s('sine').att(0.03).decay(0.18).room(0.4).gain(0.18))",
            voice: null,
            fx: null,
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Reference-inspired guitar-song traits', 'Compact and playable in this app'],
    },
    stranger_things: {
        id: 'stranger_things',
        aliases: ['stranger things theme', 'stranger things theme song'],
        intentTags: ['song', 'theme', 'reference', 'stranger_things'],
        bpm: 168,
        key: 'C major',
        scale: 'C major',
        thought: 'Reference-inspired Stranger Things style loop: pulsing low octave and bright arpeggiated supersaw theme.',
        tracks: tracks({
            drums: null,
            bass: "note(m('a1 e2 a1 e2 a1 e2 a1 e2')).s('sawtooth').att(0.004).decay(0.12).lpf(420).gain(0.56)",
            melody: "note(m('a3 c4 e4 g4 a4 g4 e4 c4')).s('supersaw').att(0.004).decay(0.1).hpf(280).lpf(2200).distort(0.12).gain(0.26)",
            voice: null,
            fx: "note(m('a4 e5')).s('sine').slow(8).room(0.8).delay(0.4).gain(0.16)",
        }),
        requiredTracks: ['bass', 'melody'],
        qualityNotes: ['Reference-inspired arpeggiated synth theme', 'Avoids over-distortion'],
    },
    pyramid_song: {
        id: 'pyramid_song',
        aliases: ['pyramid song', 'radiohead pyramid song'],
        intentTags: ['song', 'cover', 'reference', 'pyramid_song'],
        bpm: 104,
        key: 'F# minor',
        scale: 'F# minor',
        thought: 'Reference-inspired Pyramid Song loop: sparse minor piano pulses, low bass anchors, and a breathy ooh-like lead.',
        tracks: tracks({
            drums: "stack(s('~ ~ RolandTR909_bd ~ ~ ~ RolandTR909_sd ~').gain(0.28).lpf(900), s('~ ~ ~ RolandTR909_rd ~ ~ ~ ~').gain(0.06).hpf(6500))",
            bass: "note(m('f#1 ~ c#2 ~ a1 ~ c#2 ~')).s('sine').att(0.02).decay(0.35).lpf(180).gain(0.48)",
            melody: "stack(note(m('<f#3 c#4 a4> ~ <g3 d4 b4> ~ <a3 e4 c#5> ~ <g3 d4 b4> ~')).s('piano').decay(0.32).room(0.55).gain(0.28), note(m('f#5 ~ e5 ~ g#5 e5 f#5 ~')).s('sine').att(0.04).decay(0.25).room(0.75).gain(0.16))",
            voice: null,
            fx: null,
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Reference-inspired sparse piano feel', 'Keeps rhythm playable as a loop'],
    },
    rhythm_of_the_night: {
        id: 'rhythm_of_the_night',
        aliases: ['the rhythm of the night', 'rhythm of the night', 'corona rhythm of the night'],
        intentTags: ['song', 'cover', 'reference', 'rhythm_of_the_night'],
        bpm: 128,
        key: 'G minor',
        scale: 'G minor',
        thought: 'Reference-inspired Rhythm of the Night loop: Eurodance kick, bright square hook, and rolling minor bass.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*4').gain(0.88).lpf(170), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.56).hpf(700), s('RolandTR909_hh*16').gain(0.1).hpf(7600), s('~ RolandTR909_oh ~ RolandTR909_oh').gain(0.08).hpf(6200))",
            bass: "note(m('g1 ~ g1 bb1 ~ f1 g1 ~')).s('sawtooth').att(0.006).decay(0.18).lpf(620).gain(0.62)",
            melody: "note(m('d4 ~ f4 g4 ~ bb4 g4 f4')).s('square').att(0.004).decay(0.11).hpf(420).lpf(3600).delay(0.18).gain(0.34)",
            voice: null,
            fx: null,
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Reference-inspired Eurodance traits', 'Bright but not harsh'],
    },
    pump_up_the_jam: {
        id: 'pump_up_the_jam',
        aliases: ['pump up the jam', 'technotronic pump up the jam'],
        intentTags: ['song', 'cover', 'reference', 'pump_up_the_jam'],
        bpm: 124,
        key: 'F minor',
        scale: 'F minor',
        thought: 'Reference-inspired Pump Up The Jam loop: 90s dance drums, F-minor bass, and short vocal-synth stabs.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd*4').gain(0.9).lpf(170), s('~ RolandTR909_cp ~ RolandTR909_cp').gain(0.54).hpf(680), s('RolandTR909_hh*8').gain(0.14).hpf(7200), s('~ ~ RolandTR909_rd ~').gain(0.08).hpf(6800))",
            bass: "note(m('f1 ~ f1 ~ ab1 ~ eb1 ~')).s('sawtooth').att(0.006).decay(0.2).lpf(540).gain(0.66)",
            melody: "stack(note(m('c4 ~ eb4 f4 ~ ab4 f4 ~')).s('square').att(0.004).decay(0.08).hpf(500).lpf(3200).gain(0.3), note(m('f4 ~ ~ eb4 ~ c4 ~ ~')).s('sawtooth').att(0.006).decay(0.1).hpf(600).lpf(2600).gain(0.18))",
            voice: null,
            fx: null,
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Reference-inspired 90s dance groove', 'No unsupported helper syntax'],
    },
    happy_birthday: {
        id: 'happy_birthday',
        aliases: ['happy birthday', 'happy birthday song'],
        intentTags: ['song', 'traditional', 'happy_birthday'],
        bpm: 120,
        key: 'F major',
        scale: 'F major',
        thought: 'Happy Birthday loop in F major with light drums, simple bass, and a clear melody.',
        tracks: tracks({
            drums: "stack(s('~ RolandTR909_hh ~ RolandTR909_hh ~ RolandTR909_hh ~').gain(0.08).hpf(7000), s('RolandTR909_bd ~ ~ ~ RolandTR909_bd ~ ~ ~').gain(0.42), s('~ ~ ~ RolandTR909_rim ~ ~ ~ RolandTR909_rim').gain(0.18))",
            bass: "note(m('f1 ~ c2 ~ f1 ~ bb1 c2')).s('triangle').att(0.01).decay(0.24).lpf(360).gain(0.5)",
            melody: "note(m('c4 c4 d4 c4 f4 e4 ~ c4 c4 d4 c4 g4 f4 ~ c4 c4 c5 a4 f4 e4 d4 bb4 bb4 a4 f4 g4 f4')).s('piano').att(0.01).decay(0.22).room(0.24).gain(0.32).slow(4)",
            voice: null,
            fx: null,
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Clear traditional melody', 'Separated rhythm and support roles'],
    },
    shostakovich_waltz: {
        id: 'shostakovich_waltz',
        aliases: ['waltz #2', 'shostakovich waltz 2', 'waltz 2'],
        intentTags: ['song', 'classical', 'reference', 'shostakovich_waltz'],
        bpm: 180,
        key: 'C minor',
        scale: 'C minor',
        thought: 'Reference-inspired Waltz #2 loop: C-minor 3/4 pulse with oboe-like melody and soft piano support.',
        tracks: tracks({
            drums: "s('RolandTR909_bd ~ ~ RolandTR909_sd ~ ~').gain(0.22).slow(2)",
            bass: "note(m('c1 ~ ~ g1 ~ ~ eb1 ~ ~ g1 ~ ~')).s('triangle').att(0.02).decay(0.26).lpf(320).gain(0.42)",
            melody: "stack(note(m('g4 eb4 d4 c4 ~ d4 eb4 g4 ~ f4 eb4 d4')).s('sine').att(0.02).decay(0.2).room(0.38).gain(0.28), note(m('<c3 eb3 g3> ~ ~ <g2 b2 d3> ~ ~')).s('piano').decay(0.26).room(0.32).gain(0.2))",
            voice: null,
            fx: null,
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Reference-inspired minor waltz contour', 'Compact loop form'],
    },
    old_macdonald: {
        id: 'old_macdonald',
        aliases: ['old macdonald', 'old mcdonald', 'old macdonald song'],
        intentTags: ['song', 'traditional', 'old_macdonald'],
        bpm: 70,
        key: 'F major',
        scale: 'F major',
        thought: 'Old MacDonald loop in F major with simple piano melody, bass roots, and playful light percussion.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ ~ ~ RolandTR909_bd ~ ~ ~').gain(0.32), s('~ ~ RolandTR909_rim ~ ~ ~ RolandTR909_rim ~').gain(0.16), s('RolandTR909_hh ~ RolandTR909_hh ~ RolandTR909_hh ~').gain(0.055).hpf(7000))",
            bass: "note(m('f1 ~ f1 c2 f1 ~ c2 f1')).s('triangle').att(0.01).decay(0.24).lpf(330).gain(0.46)",
            melody: "note(m('f4 f4 f4 c4 d4 d4 c4 a4 a4 g4 g4 f4 ~ c4 f4 f4 f4 c4 d4 d4 c4 a4 a4 g4 g4 f4')).s('piano').att(0.01).decay(0.2).room(0.25).gain(0.3).slow(4)",
            voice: null,
            fx: null,
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Traditional melody reference', 'No unavailable animal samples required'],
    },
    blue_monday: {
        id: 'blue_monday',
        aliases: ['blue monday', 'blue monday remix', 'blue monday new order'],
        intentTags: ['song', 'cover', 'reference', 'blue_monday'],
        bpm: 130,
        key: 'F minor',
        scale: 'F minor',
        thought: 'Reference-inspired Blue Monday loop: machine kick pattern, dry snare/clap, F-minor synth bass, and filtered saw hook.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd RolandTR808_bd RolandTR808_bd RolandTR808_bd ~ RolandTR808_bd ~ ~').gain(0.88).lpf(170), s('~ RolandTR909_sd ~ RolandTR909_cp').gain(0.5).hpf(650), s('RolandTR909_oh RolandTR909_oh RolandTR909_oh RolandTR909_oh').gain(0.08).hpf(7200))",
            bass: "note(m('f1 f2 f1 f2 g1 g2 c1 c2')).s('sawtooth').att(0.004).decay(0.16).lpf(440).gain(0.62)",
            melody: "note(m('ab3 ~ ab3 bb3 ~ c4 ~ c4')).s('sawtooth').att(0.01).decay(0.12).hpf(900).lpf(2500).room(0.08).gain(0.28).slow(2)",
            voice: null,
            fx: null,
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Reference-inspired Blue Monday traits', 'No .bank or full-song declarations'],
    },
    undertale_determination: {
        id: 'undertale_determination',
        aliases: ['determination', 'undertale determination', 'determination undertale'],
        intentTags: ['song', 'theme', 'reference', 'undertale_determination'],
        bpm: 115,
        key: 'F# minor',
        scale: 'F# minor',
        thought: 'Reference-inspired Determination loop: chiptune square lead, supporting harmony, and light pulse in F# minor.',
        tracks: tracks({
            drums: "stack(s('RolandTR909_bd ~ ~ RolandTR909_bd ~ ~ RolandTR909_bd ~').gain(0.46), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.28).hpf(620), s('RolandTR909_hh*8').gain(0.07).hpf(7600))",
            bass: "note(m('f#1 ~ c#2 ~ d#2 ~ c#2 ~')).s('square').att(0.006).decay(0.13).lpf(360).gain(0.46)",
            melody: "stack(note(m('f#4 f4 d#4 c#4 d#4 a#3 c4 ~')).s('square').att(0.002).decay(0.09).hpf(360).lpf(3200).gain(0.26), note(m('c#4 ~ a#3 ~ d#4 ~ c#4 ~')).s('sine').att(0.006).decay(0.12).gain(0.16))",
            voice: null,
            fx: null,
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Reference-inspired chiptune traits', 'Short loop instead of copied full song script'],
    },
    billie_birds: {
        id: 'billie_birds',
        aliases: ['birds of a feather', 'billie birds', 'billie eilish birds of a feather'],
        intentTags: ['song', 'cover', 'reference', 'billie_birds'],
        bpm: 104,
        key: 'D major',
        scale: 'D major',
        thought: 'Reference-inspired Birds of a Feather loop: soft pop drums, warm bass, muted guitar-like pulse, and gentle hook.',
        tracks: tracks({
            drums: "stack(s('RolandTR808_bd ~ ~ RolandTR808_bd ~ ~ ~ ~').gain(0.58).lpf(180), s('~ ~ RolandTR909_sd ~ ~ ~ RolandTR909_sd ~').gain(0.34).hpf(520), s('RolandTR909_hh ~ RolandTR909_hh ~ RolandTR909_hh ~').gain(0.07).hpf(7000))",
            bass: "note(m('d1 ~ a1 ~ b1 ~ g1 ~')).s('sine').att(0.015).decay(0.28).lpf(180).gain(0.5)",
            melody: "stack(note(m('d3 ~ f#3 a3 ~ b3 a3 ~')).s('triangle').att(0.01).decay(0.18).hpf(240).lpf(2400).gain(0.22), note(m('a4 ~ f#4 ~ e4 ~ d4 ~')).s('sine').att(0.03).decay(0.22).room(0.38).gain(0.16))",
            voice: null,
            fx: null,
        }),
        requiredTracks: ['drums', 'bass', 'melody'],
        qualityNotes: ['Reference-inspired soft pop traits', 'No external vocal samples required'],
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
    ['breakbeat_90s', /\b(90s\s+breakbeat|old\s+school\s+breakbeat|rave\s+breakbeat|big\s+beat)\b/i],
    ['dnb', /\b(dnb|drum\s*(?:and|&)\s*bass|jungle|breakbeat)\b/i],
    ['spacesynth', /\b(koto[-\s]*style\s+spacesynth|spacesynth|space\s+synth|synthwave|spacewave)\b/i],
    ['cinematic_electronic', /\b(cinematic\s+electronic|relay\s+and\s+capacitor|capacitor\s+sounds?|relay\s+sounds?|electroacoustic\s+cinematic)\b/i],
    ['pop_funk', /\b(michael\s+jackson|mj|pop\s*funk|dance\s*pop\s*funk)\b/i],
    ['italo_80s', /\b(italo|italo\s*disco|80s\s*techno|techno\s+italo\s+80s|italo\s+80s)\b/i],
    ['hiphop', /\b(hip\s*hop|hip-hop|rap|boom\s*bap|trap|eminem|eminen|slim\s+shady)\b/i],
    ['metal', /\b(metal|heavy\s*metal|chug|double\s*kick)\b/i],
    ['punk', /\b(punk|pop\s*punk)\b/i],
    ['rock', /\b(rock|guitar|riff|power\s*chords?|distorted\s*guitar|grunge|hard\s*rock)\b/i],
    ['funk', /\b(funk|funky|groove)\b/i],
    ['jazz', /\b(jazz|jazzy|swing)\b/i],
    ['latin', /\b(latin|salsa|cumbia|reggaeton|bachata)\b/i],
    ['reggae', /\b(reggae|dub|ska)\b/i],
    ['trance', /\b(trance|uplifting|euphoric|edm|progressive|big room|festival)\b/i],
    ['acid', /\b(acid|303|squelchy)\b/i],
    ['minimal', /\b(minimal|hypnotic)\b/i],
    ['ambient', /\b(ambient|atmospheric|chill|relax|calm|peaceful|dreamy|ethereal)\b/i],
    ['house', /\b(house|deep\s*house|groovy)\b/i],
    ['techno', /\b(techno|rave|industrial|tech house)\b/i],
    ['pop', /\b(pop|catchy|radio)\b/i],
];

export function detectGenre(prompt: string): GenreKey | null {
    const songKey = detectSpecificSong(prompt);
    if (songKey) return songKey;

    // Call new artist/concept detector (added in 2.1) before falling back to generic patterns.
    // Assumption (noted per instructions): song-specific takes precedence, artist/concept next,
    // then broad patterns. This ensures "tiesto" gets 'trance' even without pattern match.
    const artistOrConcept = detectArtistOrConcept(prompt);
    if (artistOrConcept) return artistOrConcept;

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

// detectArtistOrConcept: new helper (added for phase 2.1) to catch producer/artist names like Tiësto
// and abstract concepts (UFO etc). Returns a GenreKey so existing routing works.
// Assumption: Tiësto-style maps to 'trance' (sensible default as Tiesto is iconic for uplifting trance/EDM);
// other EDM producers default to trance for distinct output vs generic; UFO concepts default to 'ambient'.
// This is called from detectGenre.
export function detectArtistOrConcept(prompt: string): GenreKey | null {
    const p = prompt.toLowerCase();
    // Tiësto / Tiesto and close variants -> trance for uplifting EDM traits
    if (/\b(tiesto|tiësto|tiesto-style|tiesto style|tiësto style)\b/.test(p)) return 'trance';
    if (/\b(koto[-\s]*style|koto)\b.*\b(space\s*synth|spacesynth|synthwave)\b/.test(p)) return 'spacesynth';
    if (/\b(relay|capacitor)\b.*\b(cinematic|electronic|music|sound)\b|\b(cinematic|electronic)\b.*\b(relay|capacitor)\b/.test(p)) return 'cinematic_electronic';
    // Additional EDM/trance/house producers and aliases (8+ for coverage)
    if (/\b(armin van buuren|armin vanbuuren|above & beyond|aboveandbeyond|above and beyond|david guetta|calvin harris|martin garrix|skrillex|zedd|alesso|hardwell)\b/.test(p)) return 'trance';
    // Abstract / concept keywords (UFO communication, alien signals, cosmic etc) -> ambient
    // for sparse atmospheric / fx-heavy output
    if (/\b(ufo|alien|cosmic|space.*(signal|communicat|transmission)| (signal|communicat|transmission).*space|extraterrestrial|otherworldly|alien signal|cosmic signal|ufo communication)\b/.test(p)) return 'ambient';
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
