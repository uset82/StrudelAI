import { InstrumentType } from '@/types/sonic';

export type TrackMap = Record<InstrumentType, string | null>;

export type GenreKey =
    | 'rock'
    | 'punk'
    | 'metal'
    | 'funk'
    | 'pop'
    | 'jazz'
    | 'hiphop'
    | 'latin'
    | 'reggae'
    | 'techno'
    | 'house'
    | 'ambient'
    | 'dnb'
    | 'trance'
    | 'acid'
    | 'minimal'
    | 'drums'
    | 'double_tap_drums'
    | 'clean_rock'
    | 'humanized_rock'
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
    drums: {
        id: 'drums',
        aliases: ['drums', 'pure drums', 'drum loop', 'percussion only', 'beat only'],
        intentTags: ['drums', 'percussion', 'drum-only'],
        bpm: 120,
        key: 'N/A',
        scale: 'N/A',
        thought: 'Clean drum-only loop: kick, snare, and hats only. Clearing tonal tracks so the loop stays drum-only.',
        tracks: tracks({
            drums: "stack(note(m('c2 ~ c2 ~')).s('square').decay(0.08).lpf(140).gain(0.78), note(m('~ c4 ~ c4')).s('pink').decay(0.04).hpf(950).gain(0.24), note(m('c6*8')).s('pink').decay(0.012).hpf(7800).gain(0.1))",
            bass: 'silence',
            melody: 'silence',
            voice: 'silence',
            fx: 'silence',
        }),
        requiredTracks: ['drums'],
        qualityNotes: ['Drum-only means no bass, melody, voice, or FX carryover', 'Use low gain hats', 'Keep layers simple'],
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
    return /\b(non\s*even|not\s+even|less\s+even|human|humanize|swing|syncop|groove|too\s+straight|less\s+rigid)\b/i.test(prompt);
}

export function isBroadMusicRequest(prompt: string) {
    const p = prompt.trim().toLowerCase();
    const wordCount = p.split(/\s+/).filter(Boolean).length;
    return wordCount <= 5 || /\b(play|make|create|generate|start|give\s+me|some|music|loop|beat|song)\b/i.test(p);
}

export function isDrumOnlyPrompt(prompt: string) {
    const p = prompt.toLowerCase();
    const explicitOnly = /\b(?:pure|only|just|solo)\s+(?:drums?|percussion|beat|beats)\b/.test(p);
    const drumIntent = /\b(?:drums?|drum\s+loop|beat|beats|percussion|kick|snare|hi-?hat|hats?)\b/.test(p);
    const fullSongOrGenre = /\b(?:rock|punk|metal|techno|house|ambient|dnb|drum\s*(?:and|&)\s*bass|jungle|trance|acid|minimal|funk|pop|jazz|hip\s*hop|hip-hop|reggae|latin|bassline|bass|guitar|riff|melody|chords?|song|full|complete)\b/.test(p);
    return explicitOnly || (drumIntent && !fullSongOrGenre);
}

export function isDoubleTapDrumPrompt(prompt: string) {
    const p = prompt.toLowerCase();
    return isDrumOnlyPrompt(prompt) && /\b(?:double|double\s*tap|two\s*hit|2\s*hit|tap|flam|ratchet|stutter)\b/.test(p);
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

export function getTemplateForPrompt(prompt: string, currentCode?: string): GenreTemplate {
    if (isDoubleTapDrumPrompt(prompt)) return GENRE_TEMPLATES.double_tap_drums;
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
    if (isDrumOnlyPrompt(prompt)) return true;
    if (isRepairPrompt(prompt) || isHumanizePrompt(prompt)) return true;
    return Boolean(detectGenre(prompt)) && isBroadMusicRequest(prompt) && !/\b(add|only|mute|remove|delete|just|change\s+the|make\s+the\s+drums|make\s+the\s+bass)\b/i.test(prompt);
}

export function buildTemplateResponse(template: GenreTemplate, thought?: string): AgentUpdateResponse {
    return {
        type: 'update_tracks',
        bpm: template.bpm,
        tracks: template.tracks,
        thought: thought || template.thought,
    };
}

export function buildDeterministicMusicResponse(prompt: string, currentCode?: string): AgentUpdateResponse | null {
    if (!shouldUseDeterministicTemplate(prompt)) return null;
    return buildTemplateResponse(getTemplateForPrompt(prompt, currentCode));
}

export function buildFallbackResponse(prompt: string, thought: string, currentCode?: string): AgentUpdateResponse {
    const template = getTemplateForPrompt(prompt, currentCode);
    return buildTemplateResponse(template, thought || template.thought);
}

export function buildTemplateGrounding(prompt: string, currentCode?: string) {
    const template = getTemplateForPrompt(prompt, currentCode);
    const required = template.requiredTracks.join(', ');
    return [
        '## TARGET TEMPLATE FOR THIS REQUEST',
        `Genre/template: ${template.id}`,
        `BPM: ${template.bpm}`,
        `Key: ${template.key}`,
        `Required tracks: ${required}`,
        `Quality notes: ${template.qualityNotes.join('; ')}`,
        'Use this template as the musical reference. Return the same public JSON shape: type, thought, bpm, tracks.',
        'Preserve existing tracks unless the user asks for a full replacement. For broad genre requests, provide drums, bass, and a clear musical hook when the template requires them.',
    ].join('\n');
}
