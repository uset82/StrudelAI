export type InstrumentType = 'drums' | 'bass' | 'melody' | 'fx' | 'voice';

// ═══════════════════════════════════════════════════════════════════════════
// LAYER/ARRANGEMENT SYSTEM (Ableton-style)
// ═══════════════════════════════════════════════════════════════════════════

/** A single clip - a timed pattern that plays at a specific position */
export interface Clip {
    id: string;
    name: string;
    pattern: string;           // Strudel pattern code
    startBar: number;          // Which bar this clip starts on (0-indexed)
    lengthBars: number;        // How many bars this clip lasts
    color: string;             // UI color (hex)
    muted: boolean;
}

/** A lane/track in the arrangement - holds multiple clips that don't overlap */
export interface Lane {
    id: string;
    name: string;
    type: 'synth' | 'drums' | 'bass' | 'melody' | 'fx' | 'voice' | 'audio';
    synthType: string;         // e.g., 'square', 'sawtooth', 'triangle', 'sine'
    clips: Clip[];
    volume: number;            // 0-1
    pan: number;               // -1 (left) to 1 (right)
    muted: boolean;
    solo: boolean;
    color: string;             // Lane color in UI
    fx?: {
        reverb?: number;
        delay?: number;
        filter?: { type: 'lpf' | 'hpf' | 'bpf'; cutoff: number; q?: number };
    };
}

/** A group of lanes that play together (like Ableton's groups) */
export interface LaneGroup {
    id: string;
    name: string;
    lanes: Lane[];
    collapsed: boolean;
    color: string;
    muted: boolean;
    solo: boolean;
    volume: number;
}

/** The full arrangement state */
export interface ArrangementState {
    bpm: number;
    timeSignature: { beats: number; noteValue: number }; // e.g., { beats: 4, noteValue: 4 } for 4/4
    totalBars: number;
    loopStart: number;         // Bar to start loop
    loopEnd: number;           // Bar to end loop
    loopEnabled: boolean;
    groups: LaneGroup[];
    currentBar: number;        // Playhead position
    isPlaying: boolean;
    scale: string;             // Musical scale e.g., "C minor"
}

export interface TrackState {
    id: InstrumentType;
    name: string;
    pattern: string; // Strudel pattern string
    muted: boolean;
    solo?: boolean;
    volume: number;
    fx?: {
        lpf?: number;    // 0 to 1 (mapped to 200Hz - 20000Hz)
        reverb?: number; // 0 to 1 (room size)
        delay?: number;  // 0 to 1 (feedback/mix)
        speed?: number;  // 0 to 1 (mapped to 0.5x - 2x)
        pitch?: number;  // 0 to 1 (mapped to -12 to +12 semitones)
    };
}

export interface SonicSessionState {
    bpm: number;
    scale: string; // e.g., "C minor"
    tracks: Record<InstrumentType, TrackState>;
    isPlaying: boolean;
    lastAnalysis?: {
        rms: number;
        peakFrequency: number;
    };
    // New: arrangement mode
    arrangement?: ArrangementState;
    useArrangement?: boolean; // If true, use arrangement instead of tracks
    trackDescription?: string; // Description of the current track style/vibe
}

// WebSocket Messages
export type ServerToClientEvents = {
    'sonic:state': (state: SonicSessionState) => void;
    'sonic:message': (message: string) => void; // AI response text
    'sonic:error': (error: string) => void;
};

export type ClientToServerEvents = {
    'sonic:command': (text: string) => void; // Voice command transcribed
    'sonic:analysis': (analysis: { rms: number; peakFrequency: number }) => void;
    'sonic:togglePlayback': () => void;
};

export type InterServerEvents = {
    ping: () => void;
};

export type SocketData = {
    sessionId: string;
};

export interface SystemMessage {
    role: 'system';
    content: string;
}

export interface UserMessage {
    role: 'user';
    content: string;
}

export interface AssistantMessage {
    role: 'assistant';
    content: string | null;
    tool_calls?: ToolCall[];
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface ToolResultMessage {
    role: 'tool';
    tool_call_id: string;
    content: string;
}

export type ChatMessage = SystemMessage | UserMessage | AssistantMessage | ToolResultMessage;
