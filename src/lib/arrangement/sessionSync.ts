import {
    ArrangementMarker,
    ArrangementState,
    Clip,
    InstrumentType,
    Lane,
    SonicSessionState,
} from '@/types/sonic';

const CLIP_COLORS = ['#06b6d4', '#8b5cf6', '#f97316', '#10b981', '#f43f5e', '#6366f1', '#eab308', '#14b8a6'];

const SESSION_TRACKS: Array<{ id: InstrumentType; name: string; type: Lane['type']; laneName: string; color: string }> = [
    { id: 'voice', name: 'Vocals', type: 'voice', laneName: 'Vocals', color: '#22d3ee' },
    { id: 'drums', name: 'Drums', type: 'drums', laneName: 'Drums', color: '#f59e0b' },
    { id: 'bass', name: 'Bass', type: 'bass', laneName: 'Bass', color: '#3b82f6' },
    { id: 'melody', name: 'Melody', type: 'melody', laneName: 'Guitar', color: '#a855f7' },
    { id: 'fx', name: 'FX', type: 'fx', laneName: 'Reverb', color: '#14b8a6' },
];

const DAW_TRACK_PRESETS: Array<Omit<Lane, 'id' | 'clips'>> = [
    { name: 'Audio', type: 'audio', synthType: 'audio', volume: 0.9, pan: 0, muted: false, solo: false, color: '#22c55e' },
    { name: 'Vocals', type: 'voice', synthType: 'sawtooth', volume: 0.82, pan: 0, muted: false, solo: false, color: '#22d3ee' },
    { name: 'Drums', type: 'drums', synthType: 'square', volume: 0.95, pan: 0, muted: false, solo: false, color: '#f59e0b' },
    { name: 'Bass', type: 'bass', synthType: 'triangle', volume: 0.88, pan: 0, muted: false, solo: false, color: '#3b82f6' },
    { name: 'Guitar', type: 'melody', synthType: 'sawtooth', volume: 0.72, pan: 0.08, muted: false, solo: false, color: '#a855f7' },
    { name: 'Piano', type: 'melody', synthType: 'sine', volume: 0.68, pan: -0.08, muted: false, solo: false, color: '#ec4899' },
    { name: 'Other', type: 'synth', synthType: 'sine', volume: 0.65, pan: 0, muted: false, solo: false, color: '#64748b' },
    { name: 'Reverb', type: 'fx', synthType: 'sine', volume: 0.55, pan: 0, muted: false, solo: false, color: '#14b8a6' },
];

function stripExpr(pattern: string): string {
    const trimmed = pattern.trim();
    return trimmed.startsWith('expr:') ? trimmed.slice(5) : trimmed;
}

function generateId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeClip(name: string, pattern: string, startBar: number, lengthBars: number, color: string, muted: boolean): Clip {
    return {
        id: generateId('clip'),
        name,
        pattern,
        startBar,
        lengthBars,
        color,
        muted,
        gain: 1,
        phaseInverted: false,
    };
}

export function flattenLanes(arrangement: ArrangementState): Lane[] {
    return arrangement.groups.flatMap((group) => group.lanes);
}

export function createDefaultArrangement(): ArrangementState {
    const totalBars = 16;
    const loopEnd = 8;

    const lanes: Lane[] = [
        {
            id: 'lane-vocals',
            name: 'Vocals',
            type: 'voice',
            synthType: 'sawtooth',
            volume: 0.75,
            pan: 0,
            muted: false,
            solo: false,
            color: '#22d3ee',
            clips: [{
                id: 'clip-vocals-1',
                name: 'Verse',
                pattern: 'note(m("c4 ~ e4 ~ g4 ~")).s("sawtooth").vowel("a").decay(0.25).slow(2)',
                startBar: 0,
                lengthBars: 8,
                color: '#06b6d4',
                muted: false,
                gain: 1,
                phaseInverted: false,
            }],
        },
        {
            id: 'lane-drums',
            name: 'Drums',
            type: 'drums',
            synthType: 'square',
            volume: 0.9,
            pan: 0,
            muted: false,
            solo: false,
            color: '#f59e0b',
            clips: [{
                id: 'clip-drums-1',
                name: 'Beat',
                pattern: 'stack(note(m("c2*4")).s("square").decay(0.1).lpf(200), note(m("~ c3 ~ c3")).s("square").hpf(500).decay(0.08), note(m("c5*8")).s("pink").hpf(6000).decay(0.02).gain(0.45))',
                startBar: 0,
                lengthBars: 16,
                color: '#f97316',
                muted: false,
                gain: 1,
                phaseInverted: false,
            }],
        },
        {
            id: 'lane-bass',
            name: 'Bass',
            type: 'bass',
            synthType: 'triangle',
            volume: 0.85,
            pan: 0,
            muted: false,
            solo: false,
            color: '#3b82f6',
            clips: [{
                id: 'clip-bass-1',
                name: 'Sub',
                pattern: 'note(m("c2 ~ g1 ~ c2 ~")).s("triangle").decay(0.15).sustain(0.2)',
                startBar: 8,
                lengthBars: 8,
                color: '#6366f1',
                muted: false,
                gain: 1,
                phaseInverted: false,
            }],
        },
        {
            id: 'lane-melody',
            name: 'Guitar',
            type: 'melody',
            synthType: 'sawtooth',
            volume: 0.65,
            pan: 0.1,
            muted: false,
            solo: false,
            color: '#a855f7',
            clips: [{
                id: 'clip-melody-1',
                name: 'Keys',
                pattern: 'note(m("c4 e4 g4 b4")).s("sawtooth").decay(0.2).sustain(0.3).slow(2)',
                startBar: 4,
                lengthBars: 8,
                color: '#8b5cf6',
                muted: false,
                gain: 1,
                phaseInverted: false,
            }],
        },
        {
            id: 'lane-fx',
            name: 'Reverb',
            type: 'fx',
            synthType: 'sine',
            volume: 0.4,
            pan: 0,
            muted: false,
            solo: false,
            color: '#22c55e',
            clips: [],
        },
    ];

    const markers: ArrangementMarker[] = [
        { id: 'marker-intro', name: 'Intro', bar: 0, color: '#eab308' },
        { id: 'marker-build', name: 'Bass buildup', bar: 8, color: '#f97316' },
        { id: 'marker-drop', name: 'Drop', bar: 9, color: '#f43f5e' },
    ];

    return {
        bpm: 120,
        timeSignature: { beats: 4, noteValue: 4 },
        totalBars,
        loopStart: 0,
        loopEnd,
        loopEnabled: true,
        currentBar: 0,
        isPlaying: false,
        scale: 'C minor',
        markers,
        groups: [{
            id: 'group-main',
            name: 'Session',
            collapsed: false,
            color: '#22d3ee',
            muted: false,
            solo: false,
            volume: 1,
            lanes,
        }],
    };
}

export function createArrangementFromSession(
    state: SonicSessionState | null,
    existing?: ArrangementState,
): ArrangementState {
    const base = existing ?? createDefaultArrangement();
    if (!state) return base;

    const loopSpan = Math.max(4, base.loopEnd - base.loopStart);
    const activeTrackNames = new Set(SESSION_TRACKS.filter((track) => Boolean(state.tracks[track.id]?.pattern?.trim())).map((track) => track.laneName));
    const presets = activeTrackNames.size > 0 ? DAW_TRACK_PRESETS : DAW_TRACK_PRESETS;

    const lanes: Lane[] = presets.map((preset) => {
        const sessionTrack = SESSION_TRACKS.find((track) => track.laneName === preset.name);
        const pattern = sessionTrack ? stripExpr(state.tracks[sessionTrack.id]?.pattern ?? '') : '';
        const muted = sessionTrack ? Boolean(state.tracks[sessionTrack.id]?.muted) : preset.muted;
        const clips: Clip[] = pattern
            ? [makeClip(
                preset.name,
                pattern,
                base.loopStart,
                loopSpan,
                CLIP_COLORS[preset.name.length % CLIP_COLORS.length],
                muted,
            )]
            : [];

        return {
            id: `lane-${preset.name.toLowerCase()}`,
            name: preset.name,
            type: preset.type,
            synthType: preset.synthType,
            volume: sessionTrack ? (state.tracks[sessionTrack.id]?.volume ?? preset.volume) : preset.volume,
            pan: preset.pan,
            muted,
            solo: sessionTrack ? Boolean(state.tracks[sessionTrack.id]?.solo) : preset.solo,
            color: sessionTrack ? sessionTrack.color : preset.color,
            clips,
        };
    });

    const markers = base.markers.length > 0 ? base.markers : [
        { id: 'marker-intro', name: 'Intro', bar: 0, color: '#eab308' },
        { id: 'marker-drop', name: 'Drop', bar: Math.min(base.loopEnd, base.totalBars), color: '#f43f5e' },
    ];

    return {
        ...base,
        bpm: state.bpm,
        scale: state.scale,
        isPlaying: false,
        markers,
        groups: [{
            id: 'group-main',
            name: 'Session',
            collapsed: false,
            color: '#22d3ee',
            muted: false,
            solo: false,
            volume: 1,
            lanes,
        }],
    };
}

export function createEmptyDawArrangement(): ArrangementState {
    return {
        bpm: 120,
        timeSignature: { beats: 4, noteValue: 4 },
        totalBars: 32,
        loopStart: 0,
        loopEnd: 8,
        loopEnabled: true,
        groups: [{
            id: 'group-main',
            name: 'Session',
            collapsed: false,
            color: '#22d3ee',
            muted: false,
            solo: false,
            volume: 1,
            lanes: DAW_TRACK_PRESETS.map((preset) => ({
                id: generateId('lane'),
                name: preset.name,
                type: preset.type,
                synthType: preset.synthType,
                clips: [],
                volume: preset.volume,
                pan: preset.pan,
                muted: preset.muted,
                solo: preset.solo,
                color: preset.color,
            })),
        }],
        markers: [
            { id: generateId('marker'), name: 'Intro', bar: 0, color: '#eab308' },
            { id: generateId('marker'), name: 'Build', bar: 8, color: '#f97316' },
            { id: generateId('marker'), name: 'Drop', bar: 16, color: '#f43f5e' },
        ],
        currentBar: 0,
        isPlaying: false,
        scale: 'C minor',
    };
}

export function updateLaneInArrangement(
    arrangement: ArrangementState,
    laneId: string,
    updater: (lane: Lane) => Lane,
): ArrangementState {
    return {
        ...arrangement,
        groups: arrangement.groups.map((group) => ({
            ...group,
            lanes: group.lanes.map((lane) => (lane.id === laneId ? updater(lane) : lane)),
        })),
    };
}

export function formatBarTime(bar: number, bpm: number, beatsPerBar = 4): string {
    const seconds = (bar * beatsPerBar * 60) / Math.max(bpm, 1);
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
