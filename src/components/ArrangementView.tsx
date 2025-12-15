'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrangementState, Lane, LaneGroup, Clip } from '@/types/sonic';
import {
    Play, Pause, Plus, Trash2, Volume2, VolumeX,
    ChevronDown, ChevronRight, Copy,
    Music, Drum, Guitar, Sparkles, Layers, Code, Mic
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

const LANE_COLORS = [
    '#22d3ee', // cyan
    '#a855f7', // purple
    '#f59e0b', // amber
    '#22c55e', // green
    '#ef4444', // red
    '#3b82f6', // blue
    '#ec4899', // pink
    '#84cc16', // lime
];

const CLIP_COLORS = [
    '#06b6d4', // cyan
    '#8b5cf6', // violet
    '#f97316', // orange
    '#10b981', // emerald
    '#f43f5e', // rose
    '#6366f1', // indigo
    '#eab308', // yellow
    '#14b8a6', // teal
];

const BAR_WIDTH = 80; // pixels per bar
const LANE_HEIGHT = 60;
const HEADER_WIDTH = 180;

const LANE_ICON_MAP: Record<Lane['type'], typeof Music> = {
    drums: Drum,
    bass: Guitar,
    melody: Music,
    fx: Sparkles,
    voice: Mic,
    synth: Music,
    audio: Mic,
};

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT ARRANGEMENT STATE
// ═══════════════════════════════════════════════════════════════════════════

export const createDefaultArrangement = (): ArrangementState => ({
    bpm: 120,
    timeSignature: { beats: 4, noteValue: 4 },
    totalBars: 16,
    loopStart: 0,
    loopEnd: 8,
    loopEnabled: true,
    currentBar: 0,
    isPlaying: false,
    scale: 'C minor',
    groups: [
        {
            id: 'group-synths',
            name: 'Synths',
            collapsed: false,
            color: '#22d3ee',
            muted: false,
            solo: false,
            volume: 1,
            lanes: [
                {
                    id: 'lane-lead',
                    name: 'Lead',
                    type: 'melody',
                    synthType: 'sawtooth',
                    volume: 0.7,
                    pan: 0,
                    muted: false,
                    solo: false,
                    color: '#22d3ee',
                    clips: [
                        {
                            id: 'clip-lead-1',
                            name: 'Lead 1',
                            pattern: 'note(m("c4 e4 g4 b4")).s("sawtooth").decay(0.2).sustain(0.3).slow(2)',
                            startBar: 0,
                            lengthBars: 4,
                            color: '#06b6d4',
                            muted: false,
                        },
                    ],
                },
                {
                    id: 'lane-pad',
                    name: 'Pad',
                    type: 'synth',
                    synthType: 'sine',
                    volume: 0.5,
                    pan: 0,
                    muted: false,
                    solo: false,
                    color: '#a855f7',
                    clips: [],
                },
            ],
        },
        {
            id: 'group-rhythm',
            name: 'Rhythm',
            collapsed: false,
            color: '#f59e0b',
            muted: false,
            solo: false,
            volume: 1,
            lanes: [
                {
                    id: 'lane-kick',
                    name: 'Kick',
                    type: 'drums',
                    synthType: 'square',
                    volume: 0.9,
                    pan: 0,
                    muted: false,
                    solo: false,
                    color: '#f59e0b',
                    clips: [
                        {
                            id: 'clip-kick-1',
                            name: 'Kick',
                            pattern: 'note(m("c2*4")).s("square").decay(0.1).lpf(200)',
                            startBar: 0,
                            lengthBars: 8,
                            color: '#f97316',
                            muted: false,
                        },
                    ],
                },
                {
                    id: 'lane-snare',
                    name: 'Snare',
                    type: 'drums',
                    synthType: 'square',
                    volume: 0.8,
                    pan: 0,
                    muted: false,
                    solo: false,
                    color: '#a855f7',
                    clips: [
                        {
                            id: 'clip-snare-1',
                            name: 'Snare',
                            pattern: 'note(m("~ c3 ~ c3")).s("square").hpf(500).decay(0.08)',
                            startBar: 0,
                            lengthBars: 8,
                            color: '#8b5cf6',
                            muted: false,
                        },
                    ],
                },
                {
                    id: 'lane-hats',
                    name: 'Hi-Hats',
                    type: 'drums',
                    synthType: 'pink',
                    volume: 0.6,
                    pan: 0.2,
                    muted: false,
                    solo: false,
                    color: '#22c55e',
                    clips: [
                        {
                            id: 'clip-hats-1',
                            name: 'Hats',
                            pattern: 'note(m("c5*8")).s("pink").hpf(6000).decay(0.02).gain(0.5)',
                            startBar: 0,
                            lengthBars: 8,
                            color: '#10b981',
                            muted: false,
                        },
                    ],
                },
            ],
        },
        {
            id: 'group-bass',
            name: 'Bass',
            collapsed: false,
            color: '#3b82f6',
            muted: false,
            solo: false,
            volume: 1,
            lanes: [
                {
                    id: 'lane-bass',
                    name: 'Sub Bass',
                    type: 'bass',
                    synthType: 'triangle',
                    volume: 0.8,
                    pan: 0,
                    muted: false,
                    solo: false,
                    color: '#3b82f6',
                    clips: [
                        {
                            id: 'clip-bass-1',
                            name: 'Bass Line',
                            pattern: 'note(m("c2 ~ g1 ~")).s("triangle").decay(0.15).sustain(0.2)',
                            startBar: 0,
                            lengthBars: 4,
                            color: '#6366f1',
                            muted: false,
                        },
                    ],
                },
            ],
        },
    ],
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ═══════════════════════════════════════════════════════════════════════════
// CLIP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ClipProps {
    clip: Clip;
    isSelected: boolean;
    onSelect: () => void;
    onUpdate: (clip: Clip) => void;
    onDelete: () => void;
    onDuplicate: () => void;
}

const ClipComponent: React.FC<ClipProps> = ({
    clip, isSelected, onSelect, onUpdate, onDelete, onDuplicate
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const startX = useRef(0);
    const startBar = useRef(clip.startBar);
    const startLength = useRef(clip.lengthBars);

    const handleMouseDown = (e: React.MouseEvent, mode: 'drag' | 'resize') => {
        e.stopPropagation();
        onSelect();
        startX.current = e.clientX;
        startBar.current = clip.startBar;
        startLength.current = clip.lengthBars;

        if (mode === 'drag') {
            setIsDragging(true);
        } else {
            setIsResizing(true);
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startX.current;
            const deltaBars = Math.round(deltaX / BAR_WIDTH);

            if (isDragging) {
                const newStart = Math.max(0, startBar.current + deltaBars);
                onUpdate({ ...clip, startBar: newStart });
            } else if (isResizing) {
                const newLength = Math.max(1, startLength.current + deltaBars);
                onUpdate({ ...clip, lengthBars: newLength });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, clip, onUpdate]);

    return (
        <div
            className={`absolute h-[52px] top-1 rounded cursor-pointer transition-all
                ${isSelected ? 'ring-2 ring-white shadow-lg z-10' : 'hover:brightness-110'}
                ${clip.muted ? 'opacity-40' : ''}`}
            style={{
                left: `${clip.startBar * BAR_WIDTH}px`,
                width: `${clip.lengthBars * BAR_WIDTH - 4}px`,
                backgroundColor: clip.color,
            }}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            onMouseDown={(e) => handleMouseDown(e, 'drag')}
            onDoubleClick={(e) => { e.stopPropagation(); onUpdate({ ...clip, muted: !clip.muted }); }}
        >
            {/* Clip Content */}
            <div className="h-full flex flex-col p-1 overflow-hidden">
                <span className="text-[10px] font-bold text-white/90 truncate">
                    {clip.name}
                </span>
                <div className="flex-1 flex items-center">
                    {/* Mini waveform visualization (placeholder) */}
                    <div className="flex gap-0.5 items-end h-6">
                        {Array.from({ length: Math.min(clip.lengthBars * 4, 32) }).map((_, i) => (
                            <div
                                key={i}
                                className="clip-waveform-bar"
                                style={{ height: `${4 + ((i * 13 + clip.id.length) % 16)}px` }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Resize Handle */}
            <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
                onMouseDown={(e) => handleMouseDown(e, 'resize')}
            />

            {/* Context Menu (shown when selected) */}
            {isSelected && (
                <div className="absolute -top-8 left-0 flex gap-1 bg-gray-900 rounded px-1 py-0.5 shadow-lg z-20">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                        className="p-1 hover:bg-gray-700 rounded"
                        title="Duplicate"
                    >
                        <Copy className="w-3 h-3 text-cyan-400" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1 hover:bg-gray-700 rounded"
                        title="Delete"
                    >
                        <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// LANE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface LaneComponentProps {
    lane: Lane;
    group: LaneGroup;
    totalBars: number;
    selectedClipId: string | null;
    onSelectClip: (clipId: string | null) => void;
    onUpdateLane: (lane: Lane) => void;
    onAddClip: (laneId: string, bar: number) => void;
}

const LaneComponent: React.FC<LaneComponentProps> = ({
    lane, group, totalBars, selectedClipId, onSelectClip, onUpdateLane, onAddClip
}) => {
    const Icon = LANE_ICON_MAP[lane.type] ?? Music;
    const isMuted = lane.muted || group.muted;

    const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const bar = Math.floor(x / BAR_WIDTH);

        // Check if clicking on empty space
        const clickedOnClip = lane.clips.some(
            clip => bar >= clip.startBar && bar < clip.startBar + clip.lengthBars
        );

        if (!clickedOnClip) {
            onSelectClip(null);
        }
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const bar = Math.floor(x / BAR_WIDTH);

        // Check for overlap
        const hasOverlap = lane.clips.some(
            clip => bar >= clip.startBar && bar < clip.startBar + clip.lengthBars
        );

        if (!hasOverlap) {
            onAddClip(lane.id, bar);
        }
    };

    const updateClip = (clipId: string, updatedClip: Clip) => {
        onUpdateLane({
            ...lane,
            clips: lane.clips.map(c => c.id === clipId ? updatedClip : c),
        });
    };

    const deleteClip = (clipId: string) => {
        onUpdateLane({
            ...lane,
            clips: lane.clips.filter(c => c.id !== clipId),
        });
        if (selectedClipId === clipId) onSelectClip(null);
    };

    const duplicateClip = (clip: Clip) => {
        const newClip: Clip = {
            ...clip,
            id: generateId(),
            name: `${clip.name} (copy)`,
            startBar: clip.startBar + clip.lengthBars,
        };
        onUpdateLane({
            ...lane,
            clips: [...lane.clips, newClip],
        });
    };

    return (
        <div className="flex" style={{ height: LANE_HEIGHT }}>
            {/* Lane Header */}
            <div
                className={`lane-header ${isMuted ? 'opacity-50' : ''}`}
                style={{ width: HEADER_WIDTH, backgroundColor: lane.color + '20' }}
            >
                <Icon className="w-4 h-4" style={{ color: lane.color }} />
                <span className="text-xs font-medium text-white truncate flex-1">
                    {lane.name}
                </span>
                <button
                    onClick={() => onUpdateLane({ ...lane, muted: !lane.muted })}
                    className={`p-1 rounded ${lane.muted ? 'bg-red-500/30' : 'hover:bg-white/10'}`}
                    title={lane.muted ? 'Unmute' : 'Mute'}
                >
                    {lane.muted ? (
                        <VolumeX className="w-3 h-3 text-red-400" />
                    ) : (
                        <Volume2 className="w-3 h-3 text-gray-400" />
                    )}
                </button>
                <button
                    onClick={() => onUpdateLane({ ...lane, solo: !lane.solo })}
                    className={`px-1 text-[10px] font-bold rounded ${lane.solo ? 'bg-yellow-500 text-black' : 'text-gray-500 hover:bg-white/10'}`}
                >
                    S
                </button>
            </div>

            {/* Lane Track Area */}
            <div
                className="lane-track-area"
                style={{ minWidth: totalBars * BAR_WIDTH }}
                onClick={handleTrackClick}
                onDoubleClick={handleDoubleClick}
            >
                {/* Bar Grid Lines */}
                {Array.from({ length: totalBars }).map((_, i) => (
                    <div
                        key={i}
                        className={`bar-grid-line ${i % 4 === 0 ? 'bar-grid-line--major' : 'bar-grid-line--minor'}`}
                        style={{ left: i * BAR_WIDTH }}
                    />
                ))}

                {/* Clips */}
                {lane.clips.map(clip => (
                    <ClipComponent
                        key={clip.id}
                        clip={clip}
                        isSelected={selectedClipId === clip.id}
                        onSelect={() => onSelectClip(clip.id)}
                        onUpdate={(c) => updateClip(clip.id, c)}
                        onDelete={() => deleteClip(clip.id)}
                        onDuplicate={() => duplicateClip(clip)}
                    />
                ))}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// GROUP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface GroupComponentProps {
    group: LaneGroup;
    totalBars: number;
    selectedClipId: string | null;
    onSelectClip: (clipId: string | null) => void;
    onUpdateGroup: (group: LaneGroup) => void;
    onAddLane: (groupId: string) => void;
}

const GroupComponent: React.FC<GroupComponentProps> = ({
    group, totalBars, selectedClipId, onSelectClip, onUpdateGroup, onAddLane
}) => {
    const updateLane = (laneId: string, updatedLane: Lane) => {
        onUpdateGroup({
            ...group,
            lanes: group.lanes.map(l => l.id === laneId ? updatedLane : l),
        });
    };

    const addClipToLane = (laneId: string, bar: number) => {
        const lane = group.lanes.find(l => l.id === laneId);
        if (!lane) return;

        const newClip: Clip = {
            id: generateId(),
            name: `${lane.name} ${lane.clips.length + 1}`,
            pattern: getDefaultPattern(lane.type, lane.synthType),
            startBar: bar,
            lengthBars: 4,
            color: CLIP_COLORS[lane.clips.length % CLIP_COLORS.length],
            muted: false,
        };

        updateLane(laneId, {
            ...lane,
            clips: [...lane.clips, newClip],
        });
    };

    return (
        <div className="border-b-2 border-gray-700">
            {/* Group Header */}
            <div
                className="group-header"
                style={{ backgroundColor: group.color + '15' }}
                onClick={() => onUpdateGroup({ ...group, collapsed: !group.collapsed })}
            >
                {group.collapsed ? (
                    <ChevronRight className="w-4 h-4" style={{ color: group.color }} />
                ) : (
                    <ChevronDown className="w-4 h-4" style={{ color: group.color }} />
                )}
                <Layers className="w-4 h-4" style={{ color: group.color }} />
                <span className="text-sm font-bold" style={{ color: group.color }}>
                    {group.name}
                </span>
                <span className="text-[10px] text-gray-500 ml-auto">
                    {group.lanes.length} lanes
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); onUpdateGroup({ ...group, muted: !group.muted }); }}
                    className={`p-1 rounded ${group.muted ? 'bg-red-500/30' : 'hover:bg-white/10'}`}
                >
                    {group.muted ? (
                        <VolumeX className="w-3 h-3 text-red-400" />
                    ) : (
                        <Volume2 className="w-3 h-3 text-gray-400" />
                    )}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onAddLane(group.id); }}
                    className="p-1 hover:bg-white/10 rounded"
                    title="Add Lane"
                >
                    <Plus className="w-3 h-3 text-gray-400" />
                </button>
            </div>

            {/* Lanes */}
            {!group.collapsed && group.lanes.map(lane => (
                <LaneComponent
                    key={lane.id}
                    lane={lane}
                    group={group}
                    totalBars={totalBars}
                    selectedClipId={selectedClipId}
                    onSelectClip={onSelectClip}
                    onUpdateLane={(l) => updateLane(lane.id, l)}
                    onAddClip={addClipToLane}
                />
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getDefaultPattern(type: Lane['type'], synthType: string): string {
    switch (type) {
        case 'drums':
            if (synthType === 'pink') return 'note(m("c5*8")).s("pink").hpf(6000).decay(0.02).gain(0.5)';
            return 'note(m("c2*4")).s("square").decay(0.1).lpf(200)';
        case 'bass':
            return 'note(m("c2 ~ g1 ~")).s("triangle").decay(0.15).sustain(0.2)';
        case 'melody':
            return 'note(m("c4 e4 g4 b4")).s("sawtooth").decay(0.2).sustain(0.3).slow(2)';
        case 'voice':
            return 'note(m("c4 e4 g4")).s("sawtooth").vowel("a").decay(0.3).slow(2)';
        case 'fx':
            return 'note(m("<c5 g5> ~")).s("sine").decay(0.5).room(0.8).slow(4)';
        default:
            return 'note(m("c4")).s("sine").decay(0.2)';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ARRANGEMENT VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ArrangementViewProps {
    arrangement: ArrangementState;
    onUpdate: (arrangement: ArrangementState) => void;
    onBuildCode: (arrangement: ArrangementState) => string;
}

export const ArrangementView: React.FC<ArrangementViewProps> = ({
    arrangement,
    onUpdate,
    onBuildCode,
}) => {
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [playheadPosition, setPlayheadPosition] = useState(0);

    // Animate playhead
    useEffect(() => {
        if (!arrangement.isPlaying) return;

        const barsPerSecond = arrangement.bpm / 60 / arrangement.timeSignature.beats;
        let animationFrame: number;
        let lastTime = performance.now();

        const animate = (time: number) => {
            const delta = (time - lastTime) / 1000;
            lastTime = time;

            setPlayheadPosition(prev => {
                let next = prev + delta * barsPerSecond;
                if (arrangement.loopEnabled && next >= arrangement.loopEnd) {
                    next = arrangement.loopStart;
                }
                if (next >= arrangement.totalBars) {
                    next = 0;
                }
                return next;
            });

            animationFrame = requestAnimationFrame(animate);
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [arrangement.isPlaying, arrangement.bpm, arrangement.loopEnabled, arrangement.loopStart, arrangement.loopEnd, arrangement.totalBars, arrangement.timeSignature.beats]);

    const updateGroup = (groupId: string, updatedGroup: LaneGroup) => {
        onUpdate({
            ...arrangement,
            groups: arrangement.groups.map(g => g.id === groupId ? updatedGroup : g),
        });
    };

    const addGroup = () => {
        const newGroup: LaneGroup = {
            id: generateId(),
            name: `Group ${arrangement.groups.length + 1}`,
            collapsed: false,
            color: LANE_COLORS[arrangement.groups.length % LANE_COLORS.length],
            muted: false,
            solo: false,
            volume: 1,
            lanes: [],
        };
        onUpdate({
            ...arrangement,
            groups: [...arrangement.groups, newGroup],
        });
    };

    const addLaneToGroup = (groupId: string) => {
        const group = arrangement.groups.find(g => g.id === groupId);
        if (!group) return;

        const types: Lane['type'][] = ['melody', 'synth', 'drums', 'bass', 'fx'];
        const newLane: Lane = {
            id: generateId(),
            name: `Lane ${group.lanes.length + 1}`,
            type: types[group.lanes.length % types.length],
            synthType: 'sawtooth',
            clips: [],
            volume: 0.8,
            pan: 0,
            muted: false,
            solo: false,
            color: LANE_COLORS[(group.lanes.length + 2) % LANE_COLORS.length],
        };

        updateGroup(groupId, {
            ...group,
            lanes: [...group.lanes, newLane],
        });
    };

    return (
        <div className="flex flex-col h-full bg-gray-950 text-white">
            {/* Transport Bar */}
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-800">
                <button
                    onClick={() => onUpdate({ ...arrangement, isPlaying: !arrangement.isPlaying })}
                    className={`p-2 rounded-full ${arrangement.isPlaying ? 'bg-cyan-500 text-black' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                    {arrangement.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>

                <div className="flex items-center gap-2">
                    <label htmlFor="arrangement-bpm" className="text-xs text-gray-500">BPM</label>
                    <input
                        id="arrangement-bpm"
                        type="number"
                        value={arrangement.bpm}
                        onChange={(e) => onUpdate({ ...arrangement, bpm: parseInt(e.target.value) || 120 })}
                        className="w-16 bg-gray-800 rounded px-2 py-1 text-sm text-center"
                        aria-label="Beats per minute"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <label htmlFor="arrangement-bars" className="text-xs text-gray-500">BARS</label>
                    <input
                        id="arrangement-bars"
                        type="number"
                        value={arrangement.totalBars}
                        onChange={(e) => onUpdate({ ...arrangement, totalBars: parseInt(e.target.value) || 16 })}
                        className="w-12 bg-gray-800 rounded px-2 py-1 text-sm text-center"
                        aria-label="Total bars"
                    />
                </div>

                <button
                    onClick={() => onUpdate({ ...arrangement, loopEnabled: !arrangement.loopEnabled })}
                    className={`px-3 py-1 rounded text-xs font-bold ${arrangement.loopEnabled ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500' : 'bg-gray-800 text-gray-500'}`}
                >
                    LOOP {arrangement.loopStart + 1}-{arrangement.loopEnd}
                </button>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={async () => {
                            const code = onBuildCode(arrangement);
                            console.log('[ArrangementView] Generated code:', code);
                            // Copy to clipboard for debugging when allowed
                            if (typeof document !== 'undefined' && document.hasFocus() && navigator?.clipboard?.writeText) {
                                try {
                                    await navigator.clipboard.writeText(code);
                                } catch (err) {
                                    console.warn('[ArrangementView] Clipboard write failed:', err);
                                }
                            } else {
                                console.warn('[ArrangementView] Clipboard write skipped (no focus or unsupported).');
                            }
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-xs"
                        title="Build code and copy to clipboard"
                    >
                        <Code className="w-3 h-3" /> Build
                    </button>
                    <button
                        onClick={addGroup}
                        className="flex items-center gap-1 px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs"
                    >
                        <Plus className="w-3 h-3" /> Add Group
                    </button>
                </div>
            </div>

            {/* Timeline & Tracks */}
            <div className="flex-1 overflow-auto" ref={scrollRef}>
                <div className="flex flex-col min-w-max">
                    {/* Timeline Header */}
                    <div className="flex sticky top-0 z-20 bg-gray-900 border-b border-gray-700">
                        <div style={{ width: HEADER_WIDTH }} className="shrink-0 border-r border-gray-700" />
                        <div className="flex-1 relative" style={{ minWidth: arrangement.totalBars * BAR_WIDTH }}>
                            {/* Bar Numbers */}
                            {Array.from({ length: arrangement.totalBars }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`timeline-bar-number ${i % 4 === 0 ? 'timeline-bar-number--major' : 'timeline-bar-number--minor'}`}
                                    style={{ left: i * BAR_WIDTH, width: BAR_WIDTH }}
                                >
                                    {i + 1}
                                </div>
                            ))}

                            {/* Loop Region */}
                            {arrangement.loopEnabled && (
                                <div
                                    className="loop-region"
                                    style={{
                                        left: arrangement.loopStart * BAR_WIDTH,
                                        width: (arrangement.loopEnd - arrangement.loopStart) * BAR_WIDTH,
                                    }}
                                />
                            )}

                            {/* Playhead */}
                            <div
                                className="playhead"
                                style={{ left: playheadPosition * BAR_WIDTH }}
                            >
                                <div className="playhead-marker" />
                            </div>
                        </div>
                    </div>

                    {/* Groups */}
                    {arrangement.groups.map(group => (
                        <GroupComponent
                            key={group.id}
                            group={group}
                            totalBars={arrangement.totalBars}
                            selectedClipId={selectedClipId}
                            onSelectClip={setSelectedClipId}
                            onUpdateGroup={(g) => updateGroup(group.id, g)}
                            onAddLane={addLaneToGroup}
                        />
                    ))}

                    {/* Empty State */}
                    {arrangement.groups.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                            <Layers className="w-12 h-12 mb-4" />
                            <p className="text-sm">No groups yet</p>
                            <button
                                onClick={addGroup}
                                className="mt-4 flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30"
                            >
                                <Plus className="w-4 h-4" /> Create First Group
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ArrangementView;
