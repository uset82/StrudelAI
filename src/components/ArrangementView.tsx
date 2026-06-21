'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrangementMarker,
    ArrangementState,
    Clip,
    Lane,
    SonicSessionState,
} from '@/types/sonic';
import {
    createArrangementFromSession,
    createDefaultArrangement,
    flattenLanes,
    formatBarTime,
    updateLaneInArrangement,
} from '@/lib/arrangement/sessionSync';
import {
    Play, Pause, Square, Plus, Trash2, Copy, Scissors, Wand2, Music,
    Drum, Guitar, Sparkles, Mic, RefreshCw, Code, MapPin, GripVertical,
    Volume2, VolumeX, Split, Waves, Repeat, Zap,
} from 'lucide-react';

export { createDefaultArrangement, createArrangementFromSession };

const BAR_WIDTH = 72;
const LANE_HEIGHT = 64;
const HEADER_WIDTH = 188;
const MARKER_ROW_HEIGHT = 32;
const RULER_HEIGHT = 34;
const MIXER_HEIGHT = 112;

const CLIP_COLORS = ['#06b6d4', '#8b5cf6', '#f97316', '#10b981', '#f43f5e', '#6366f1', '#eab308', '#14b8a6'];

const LANE_ICON: Record<Lane['type'], typeof Music> = {
    drums: Drum,
    bass: Guitar,
    melody: Music,
    fx: Sparkles,
    voice: Mic,
    synth: Music,
    audio: Waves,
};

const DAW_LANE_PRESETS: Array<Pick<Lane, 'name' | 'type' | 'color' | 'synthType'>> = [
    { name: 'Audio', type: 'audio', color: '#22c55e', synthType: 'audio' },
    { name: 'Vocals', type: 'voice', color: '#22d3ee', synthType: 'sawtooth' },
    { name: 'Drums', type: 'drums', color: '#f59e0b', synthType: 'square' },
    { name: 'Bass', type: 'bass', color: '#3b82f6', synthType: 'triangle' },
    { name: 'Guitar', type: 'melody', color: '#a855f7', synthType: 'sawtooth' },
    { name: 'Piano', type: 'melody', color: '#ec4899', synthType: 'sine' },
    { name: 'Other', type: 'synth', color: '#64748b', synthType: 'sine' },
    { name: 'Reverb', type: 'fx', color: '#14b8a6', synthType: 'sine' },
];

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

type ClipAction = 'ai' | 'transform' | 'cut' | 'copy' | 'paste' | 'phase' | 'gain' | 'delete';

function getDefaultPattern(type: Lane['type']): string {
    switch (type) {
        case 'drums':
            return 'stack(note(m("c2*4")).s("square").decay(0.1).lpf(200), note(m("~ c3 ~ c3")).s("square").hpf(500).decay(0.08), note(m("c5*8")).s("pink").hpf(6000).decay(0.02).gain(0.4))';
        case 'bass':
            return 'note(m("c2 ~ g1 ~")).s("triangle").decay(0.15).sustain(0.2)';
        case 'melody':
            return 'note(m("c4 e4 g4 b4")).s("sawtooth").decay(0.2).slow(2)';
        case 'voice':
            return 'note(m("c4 ~ e4 ~")).s("sawtooth").vowel("a").decay(0.25).slow(2)';
        case 'fx':
            return 'note(m("<c5 g5> ~")).s("sine").room(0.6).slow(4)';
        case 'audio':
            return 'silence';
        default:
            return 'note(m("c4")).s("sine").decay(0.2)';
    }
}

function barFromClientX(clientX: number, rect: DOMRect): number {
    const x = clientX - rect.left;
    return Math.max(0, Math.floor(x / BAR_WIDTH));
}

function clampGain(value: number) {
    return Math.max(0, Math.min(1.5, value));
}

function makeClip(lane: Lane, index: number, startBar: number): Clip {
    return {
        id: generateId(),
        name: `${lane.name} ${index + 1}`,
        pattern: getDefaultPattern(lane.type),
        startBar,
        lengthBars: 4,
        color: CLIP_COLORS[index % CLIP_COLORS.length],
        muted: false,
        gain: 1,
        phaseInverted: false,
    };
}

function transformClipPattern(clip: Clip): Clip {
    const pattern = clip.pattern.trim();
    if (!pattern || pattern === 'silence') return clip;

    const variants = [
        `(${pattern}).slow(2)`,
        `(${pattern}).fast(2)`,
        pattern.replace(/c4/g, 'c5').replace(/c3/g, 'c4'),
        pattern.replace(/c2/g, 'c3').replace(/g1/g, 'g2'),
        pattern.replace(/(\*4)/g, '*8'),
        pattern.replace(/(\*8)/g, '*4'),
    ];
    const index = Math.floor(Math.abs(hashString(clip.id)) % variants.length);

    return {
        ...clip,
        pattern: variants[index],
    };
}

function hashString(input: string): number {
    return input.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function waveformBars(clip: Clip) {
    const count = Math.min(Math.max(Math.round(clip.lengthBars * 6), 18), 56);
    return Array.from({ length: count }).map((_, i) => ({
        height: 8 + ((i * 19 + clip.id.length + Math.round((clip.gain ?? 1) * 10)) % 28),
        width: 2 + ((i + clip.lengthBars) % 3),
    }));
}

interface ClipBlockProps {
    clip: Clip;
    selected: boolean;
    onSelect: () => void;
    onChange: (clip: Clip) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onAction: (action: ClipAction, clip: Clip) => void;
    openContextMenu: (clip: Clip, x: number, y: number) => void;
}

function ClipBlock({ clip, selected, onSelect, onChange, onDelete, onDuplicate, onAction, openContextMenu }: ClipBlockProps) {
    const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startBar: number; startLen: number } | null>(null);

    const beginDrag = (e: React.PointerEvent, mode: 'move' | 'resize') => {
        if (e.button !== undefined && e.button !== 0) return;
        e.stopPropagation();
        onSelect();
        dragRef.current = {
            mode,
            startX: e.clientX,
            startBar: clip.startBar,
            startLen: clip.lengthBars,
        };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            if (!dragRef.current) return;
            const deltaBars = Math.round((e.clientX - dragRef.current.startX) / BAR_WIDTH);
            if (dragRef.current.mode === 'move') {
                onChange({
                    ...clip,
                    startBar: Math.max(0, dragRef.current.startBar + deltaBars),
                });
            } else {
                onChange({
                    ...clip,
                    lengthBars: Math.max(1, dragRef.current.startLen + deltaBars),
                });
            }
        };
        const onUp = () => { dragRef.current = null; };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [clip, onChange]);

    const bars = useMemo(() => waveformBars(clip), [clip]);

    return (
        <div
            className={`absolute top-1 bottom-1 overflow-hidden rounded-md border border-black/20 shadow-sm transition-all ${selected ? 'ring-2 ring-white/80 z-20' : 'hover:brightness-110'} ${clip.muted ? 'opacity-35 grayscale' : ''}`}
            style={{
                left: clip.startBar * BAR_WIDTH + 2,
                width: Math.max(28, clip.lengthBars * BAR_WIDTH - 4),
                backgroundColor: clip.color,
            }}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect();
                openContextMenu(clip, e.clientX, e.clientY);
            }}
            onPointerDown={(e) => beginDrag(e, 'move')}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-black/20" />
            <div className="relative flex h-full flex-col justify-between px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] font-semibold text-white/95">{clip.name}</span>
                    <span className="rounded bg-black/25 px-1 text-[9px] text-white/70">{clip.lengthBars}b</span>
                </div>
                <div className="flex items-end gap-px opacity-70">
                    {bars.map((bar, i) => (
                        <div
                            key={i}
                            className="rounded-sm bg-black/35"
                            style={{ height: `${bar.height}px`, width: `${bar.width}px` }}
                        />
                    ))}
                </div>
                <div className="flex items-center justify-between gap-1 text-[9px] text-white/70">
                    <span>{Math.round((clip.gain ?? 1) * 100)}%</span>
                    {clip.phaseInverted && <span>phase</span>}
                </div>
            </div>
            <div
                className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-black/10 hover:bg-white/25"
                onPointerDown={(e) => beginDrag(e, 'resize')}
            />
            {selected && (
                <div className="absolute -top-8 left-0 z-30 flex gap-1 rounded-md border border-white/10 bg-[#0f1319] px-1 py-0.5 shadow-lg">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="rounded p-1 hover:bg-white/10" title="Duplicate">
                        <Copy className="h-3 w-3 text-cyan-300" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onAction('transform', clip); }} className="rounded p-1 hover:bg-white/10" title="Transform">
                        <Wand2 className="h-3 w-3 text-violet-300" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded p-1 hover:bg-white/10" title="Delete">
                        <Trash2 className="h-3 w-3 text-rose-400" />
                    </button>
                </div>
            )}
        </div>
    );
}

interface ContextMenuProps {
    x: number;
    y: number;
    clip: Clip | null;
    onClose: () => void;
    onAction: (action: ClipAction, clip: Clip) => void;
}

function ClipContextMenu({ x, y, clip, onClose, onAction }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!clip) return;
        const onClick = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) onClose();
        };
        window.addEventListener('mousedown', onClick);
        return () => window.removeEventListener('mousedown', onClick);
    }, [clip, onClose]);

    if (!clip) return null;

    const items: Array<{ action: ClipAction; label: string; icon: React.ReactNode; danger?: boolean; disabled?: boolean }> = [
        { action: 'ai', label: 'AI Assist', icon: <Wand2 className="h-3.5 w-3.5" /> },
        { action: 'transform', label: 'Transform', icon: <Repeat className="h-3.5 w-3.5" /> },
        { action: 'cut', label: 'Cut', icon: <Scissors className="h-3.5 w-3.5" /> },
        { action: 'copy', label: 'Copy', icon: <Copy className="h-3.5 w-3.5" /> },
        { action: 'phase', label: 'Invert phase', icon: <Split className="h-3.5 w-3.5" /> },
        { action: 'gain', label: 'Clip gain', icon: <Volume2 className="h-3.5 w-3.5" /> },
        { action: 'delete', label: 'Delete selection', icon: <Trash2 className="h-3.5 w-3.5" />, danger: true },
    ];

    return (
        <div
            ref={menuRef}
            className="fixed z-[100] min-w-[190px] rounded-xl border border-white/10 bg-[#11161d]/95 p-1 shadow-2xl backdrop-blur-xl"
            style={{ left: x, top: y }}
        >
            <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{clip.name}</div>
            {items.map((item) => (
                <button
                    key={item.action}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                        onAction(item.action, clip);
                        onClose();
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs ${item.danger ? 'text-rose-300 hover:bg-rose-500/15' : 'text-slate-200 hover:bg-white/10'} disabled:opacity-40`}
                >
                    <span className="text-slate-400">{item.icon}</span>
                    {item.label}
                </button>
            ))}
        </div>
    );
}

interface ArrangementViewProps {
    arrangement: ArrangementState;
    onUpdate: (arrangement: ArrangementState) => void;
    onBuildCode: (arrangement: ArrangementState) => string;
    sessionState?: SonicSessionState | null;
    isAudioReady?: boolean;
}

export const ArrangementView: React.FC<ArrangementViewProps> = ({
    arrangement,
    onUpdate,
    onBuildCode,
    sessionState,
    isAudioReady = false,
}) => {
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [playheadBar, setPlayheadBar] = useState(arrangement.currentBar);
    const [context, setContext] = useState<{ clip: Clip; x: number; y: number } | null>(null);
    const [clipboard, setClipboard] = useState<Clip | null>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const lanes = useMemo(() => flattenLanes(arrangement), [arrangement]);
    const selectedClip = useMemo(() => lanes.find((lane) => lane.clips.some((clip) => clip.id === selectedClipId))?.clips.find((clip) => clip.id === selectedClipId) ?? null, [lanes, selectedClipId]);

    const updateLane = useCallback((laneId: string, updater: (lane: Lane) => Lane) => {
        onUpdate(updateLaneInArrangement(arrangement, laneId, updater));
    }, [arrangement, onUpdate]);

    const addClipAtBar = useCallback((laneId: string, bar: number) => {
        updateLane(laneId, (lane) => {
            const overlap = lane.clips.some((c) => bar >= c.startBar && bar < c.startBar + c.lengthBars);
            if (overlap) return lane;
            return { ...lane, clips: [...lane.clips, makeClip(lane, lane.clips.length, bar)] };
        });
    }, [updateLane]);

    useEffect(() => {
        if (!arrangement.isPlaying) return;
        const beatsPerBar = arrangement.timeSignature.beats;
        const barsPerSecond = arrangement.bpm / 60 / beatsPerBar;
        let frame = 0;
        let last = performance.now();

        const tick = (now: number) => {
            const delta = (now - last) / 1000;
            last = now;
            setPlayheadBar((prev) => {
                let next = prev + delta * barsPerSecond;
                if (arrangement.loopEnabled && next >= arrangement.loopEnd) {
                    next = arrangement.loopStart;
                }
                if (next >= arrangement.totalBars) next = 0;
                return next;
            });
            frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [
        arrangement.isPlaying,
        arrangement.bpm,
        arrangement.loopEnabled,
        arrangement.loopStart,
        arrangement.loopEnd,
        arrangement.totalBars,
        arrangement.timeSignature.beats,
    ]);

    const updateClip = useCallback((clipId: string, updater: Clip | ((clip: Clip) => Clip)) => {
        onUpdate({
            ...arrangement,
            groups: arrangement.groups.map((group) => ({
                ...group,
                lanes: group.lanes.map((lane) => ({
                    ...lane,
                    clips: lane.clips.map((clip) => (clip.id === clipId ? (typeof updater === 'function' ? updater(clip) : updater) : clip)),
                })),
            })),
        });
    }, [arrangement, onUpdate]);

    const deleteClip = useCallback((clipId: string) => {
        onUpdate({
            ...arrangement,
            groups: arrangement.groups.map((group) => ({
                ...group,
                lanes: group.lanes.map((lane) => ({
                    ...lane,
                    clips: lane.clips.filter((clip) => clip.id !== clipId),
                })),
            })),
        });
        if (selectedClipId === clipId) setSelectedClipId(null);
    }, [arrangement, selectedClipId, onUpdate]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
            if (event.code === 'Space') {
                event.preventDefault();
                onUpdate({ ...arrangement, isPlaying: !arrangement.isPlaying });
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c' && selectedClip) {
                event.preventDefault();
                setClipboard({ ...selectedClip });
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v' && selectedClip && clipboard) {
                event.preventDefault();
                updateClip(selectedClip.id, { ...clipboard, id: generateId(), name: `${clipboard.name} copy`, startBar: Math.max(0, selectedClip.startBar + clipboard.lengthBars) });
            }
            if (event.key === 'Delete' && selectedClip) {
                event.preventDefault();
                deleteClip(selectedClip.id);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [arrangement, selectedClip, clipboard, deleteClip, onUpdate, updateClip]);

    const addLane = useCallback(() => {
        const preset = DAW_LANE_PRESETS[lanes.length % DAW_LANE_PRESETS.length];
        const lane: Lane = {
            id: generateId(),
            name: preset.name,
            type: preset.type,
            synthType: preset.synthType,
            clips: [],
            volume: 0.8,
            pan: 0,
            muted: false,
            solo: false,
            color: preset.color,
        };
        const groups = arrangement.groups.length > 0 ? [...arrangement.groups] : [{
            id: 'group-main',
            name: 'Session',
            collapsed: false,
            color: '#22d3ee',
            muted: false,
            solo: false,
            volume: 1,
            lanes: [] as Lane[],
        }];
        groups[0] = { ...groups[0], lanes: [...groups[0].lanes, lane] };
        onUpdate({ ...arrangement, groups });
    }, [arrangement, lanes.length, onUpdate]);

    const addMarkerAtBar = useCallback((bar: number) => {
        const marker: ArrangementMarker = {
            id: generateId(),
            name: `Marker ${arrangement.markers.length + 1}`,
            bar,
            color: '#eab308',
        };
        onUpdate({ ...arrangement, markers: [...arrangement.markers, marker] });
    }, [arrangement, onUpdate]);

    const syncFromSession = useCallback(() => {
        onUpdate(createArrangementFromSession(sessionState ?? null, arrangement));
    }, [arrangement, onUpdate, sessionState]);

    const handleClipAction = useCallback((action: ClipAction, clip: Clip) => {
        switch (action) {
            case 'transform':
                updateClip(clip.id, transformClipPattern(clip));
                break;
            case 'phase':
                updateClip(clip.id, { ...clip, phaseInverted: !clip.phaseInverted });
                break;
            case 'gain':
                updateClip(clip.id, { ...clip, gain: clampGain((clip.gain ?? 1) + 0.1) });
                break;
            case 'copy':
                setClipboard({ ...clip });
                break;
            case 'paste':
                if (clipboard) {
                    updateClip(clip.id, { ...clipboard, id: generateId(), name: `${clipboard.name} copy`, startBar: Math.max(0, clip.startBar) });
                }
                break;
            case 'cut':
                setClipboard({ ...clip });
                deleteClip(clip.id);
                break;
            case 'delete':
                deleteClip(clip.id);
                break;
            case 'ai':
                updateClip(clip.id, {
                    ...clip,
                    pattern: clip.pattern.includes('slow')
                        ? clip.pattern.replace(/\.slow\([0-9.]+\)/, '.fast(2)')
                        : `${clip.pattern}.slow(2)`,
                });
                break;
        }
    }, [clipboard, deleteClip, updateClip]);

    const timelineWidth = arrangement.totalBars * BAR_WIDTH;

    return (
        <div className="flex h-full min-h-0 flex-col bg-[#07090c] text-slate-100">
            <div className="shrink-0 border-b border-white/10 bg-[#10131a]">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setPlayheadBar(arrangement.loopStart);
                                onUpdate({ ...arrangement, isPlaying: true, currentBar: arrangement.loopStart });
                            }}
                            disabled={!isAudioReady}
                            className="rounded bg-cyan-400 p-2 text-black hover:bg-cyan-300 disabled:opacity-40"
                            title="Play"
                        >
                            <Play className="h-4 w-4 fill-current" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onUpdate({ ...arrangement, isPlaying: false })}
                            className="rounded bg-white/5 p-2 text-slate-200 hover:bg-white/10"
                            title="Pause"
                        >
                            <Pause className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPlayheadBar(0);
                                onUpdate({ ...arrangement, isPlaying: false, currentBar: 0 });
                            }}
                            className="rounded bg-white/5 p-2 text-slate-200 hover:bg-white/10"
                            title="Stop"
                        >
                            <Square className="h-4 w-4 fill-current" />
                        </button>
                    </div>

                    <div className="rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-lg tabular-nums text-cyan-100">
                        {formatBarTime(playheadBar, arrangement.bpm, arrangement.timeSignature.beats)}
                    </div>

                    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-400">
                        <span className="uppercase tracking-wider">BPM</span>
                        <input
                            type="number"
                            min={40}
                            max={240}
                            value={arrangement.bpm}
                            onChange={(e) => onUpdate({ ...arrangement, bpm: parseInt(e.target.value, 10) || 120 })}
                            className="w-14 rounded border border-white/10 bg-[#0b0e12] px-2 py-1 text-right text-white"
                            aria-label="Arrangement tempo in beats per minute"
                            title="Arrangement BPM"
                        />
                    </div>
                    <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-400">
                        {arrangement.timeSignature.beats}/{arrangement.timeSignature.noteValue} SIG
                    </div>
                    <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-300">
                        {arrangement.scale.split(' ')[0]} KEY
                    </div>
                    <button
                        type="button"
                        onClick={() => onUpdate({ ...arrangement, loopEnabled: !arrangement.loopEnabled })}
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${arrangement.loopEnabled ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/40' : 'bg-white/5 text-slate-500'}`}
                    >
                        LOOP {arrangement.loopStart + 1}–{arrangement.loopEnd}
                    </button>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={syncFromSession}
                            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:border-cyan-400/30 hover:text-cyan-100"
                            title="Pull patterns from the live session tracks"
                        >
                            <RefreshCw className="h-3 w-3" /> Sync session
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                const code = onBuildCode(arrangement);
                                try {
                                    await navigator.clipboard.writeText(code);
                                } catch {
                                    console.log('[Arrangement] Generated code:', code);
                                }
                            }}
                            className="flex items-center gap-1 rounded-md bg-violet-600/80 px-2 py-1 text-xs hover:bg-violet-500"
                        >
                            <Code className="h-3 w-3" /> Build
                        </button>
                        <button
                            type="button"
                            onClick={addLane}
                            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
                        >
                            <Plus className="h-3 w-3" /> Track
                        </button>
                    </div>
                </div>
                {!isAudioReady && (
                    <div className="border-t border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100">
                        Initialize audio from the control panel before playback.
                    </div>
                )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 overflow-auto" ref={timelineRef}>
                    <div className="flex min-w-max flex-col">
                        <div className="sticky top-0 z-30 flex border-b border-white/10 bg-[#0f1319]">
                            <div
                                className="sticky left-0 z-40 shrink-0 border-r border-white/10 bg-[#11161d] px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                style={{ width: HEADER_WIDTH, height: MARKER_ROW_HEIGHT + RULER_HEIGHT }}
                            >
                                <div className="flex h-8 items-center gap-1 border-b border-white/5">
                                    <MapPin className="h-3.5 w-3.5" /> Markers
                                </div>
                                <div className="flex h-8 items-center gap-1 border-b border-white/5">
                                    <Zap className="h-3.5 w-3.5" /> Tracks
                                </div>
                            </div>
                            <div className="relative" style={{ width: timelineWidth, minHeight: MARKER_ROW_HEIGHT + RULER_HEIGHT }}>
                                <div className="relative h-8 border-b border-white/5 bg-[#0b0f15]">
                                    {arrangement.markers.map((marker) => (
                                        <button
                                            key={marker.id}
                                            type="button"
                                            className="absolute top-0 flex max-w-[160px] -translate-x-1/2 items-center gap-1 truncate rounded-b-md px-2 py-0.5 text-[10px] font-semibold text-black shadow-sm"
                                            style={{
                                                left: marker.bar * BAR_WIDTH + BAR_WIDTH / 2,
                                                backgroundColor: marker.color ?? '#eab308',
                                            }}
                                            title={`${marker.name} (bar ${marker.bar + 1})`}
                                        >
                                            {marker.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative h-8">
                                    {Array.from({ length: arrangement.totalBars }).map((_, bar) => (
                                        <div
                                            key={bar}
                                            className={`absolute top-0 flex h-full items-center justify-center border-l text-[10px] ${bar % 4 === 0 ? 'border-white/15 text-slate-300' : 'border-white/5 text-slate-600'}`}
                                            style={{ left: bar * BAR_WIDTH, width: BAR_WIDTH }}
                                        >
                                            {bar + 1}
                                        </div>
                                    ))}
                                    {arrangement.loopEnabled && (
                                        <div
                                            className="pointer-events-none absolute inset-y-0 border-x-2 border-cyan-400/35 bg-cyan-400/5"
                                            style={{
                                                left: arrangement.loopStart * BAR_WIDTH,
                                                width: (arrangement.loopEnd - arrangement.loopStart) * BAR_WIDTH,
                                            }}
                                        />
                                    )}
                                    <div
                                        className="playhead pointer-events-none absolute inset-y-0 z-20"
                                        style={{ left: playheadBar * BAR_WIDTH }}
                                    >
                                        <div className="playhead-marker" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {lanes.map((lane) => {
                            const Icon = LANE_ICON[lane.type] ?? Music;
                            return (
                                <div key={lane.id} className="flex border-b border-white/5" style={{ height: LANE_HEIGHT }}>
                                    <div
                                        className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-white/10 bg-[#11161d] px-3"
                                        style={{ width: HEADER_WIDTH }}
                                    >
                                        <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                                        <Icon className="h-4 w-4 shrink-0" style={{ color: lane.color }} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-xs font-semibold">{lane.name}</div>
                                            <div className="truncate text-[10px] text-slate-500">{lane.type}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => updateLane(lane.id, (l) => ({ ...l, muted: !l.muted }))}
                                            className={`rounded px-1 text-[10px] font-bold ${lane.muted ? 'bg-rose-500/30 text-rose-200' : 'text-slate-500 hover:bg-white/10'}`}
                                            title="Mute"
                                        >
                                            M
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateLane(lane.id, (l) => ({ ...l, solo: !l.solo }))}
                                            className={`rounded px-1 text-[10px] font-bold ${lane.solo ? 'bg-amber-400 text-black' : 'text-slate-500 hover:bg-white/10'}`}
                                            title="Solo"
                                        >
                                            S
                                        </button>
                                        {lane.muted ? <VolumeX className="h-3.5 w-3.5 text-rose-300" /> : <Volume2 className="h-3.5 w-3.5 text-slate-500" />}
                                    </div>
                                    <div
                                        className="lane-track-area relative bg-[#0a0d12]"
                                        style={{ width: timelineWidth }}
                                        onClick={(e) => {
                                            if (e.detail > 1) return;
                                            setSelectedClipId(null);
                                        }}
                                        onDoubleClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            addClipAtBar(lane.id, barFromClientX(e.clientX, rect));
                                        }}
                                    >
                                        {Array.from({ length: arrangement.totalBars }).map((_, bar) => (
                                            <div
                                                key={bar}
                                                className={`bar-grid-line ${bar % 4 === 0 ? 'bar-grid-line--major' : 'bar-grid-line--minor'}`}
                                                style={{ left: bar * BAR_WIDTH }}
                                            />
                                        ))}
                                        <div
                                            className="playhead pointer-events-none absolute inset-y-0 z-10 opacity-60"
                                            style={{ left: playheadBar * BAR_WIDTH }}
                                        />
                                        {lane.clips.map((clip) => (
                                            <ClipBlock
                                                key={clip.id}
                                                clip={clip}
                                                selected={selectedClipId === clip.id}
                                                onSelect={() => setSelectedClipId(clip.id)}
                                                onChange={(updated) => updateClip(clip.id, updated)}
                                                onDelete={() => deleteClip(clip.id)}
                                                onDuplicate={() => {
                                                    updateClip(clip.id, {
                                                        ...clip,
                                                        id: generateId(),
                                                        name: `${clip.name} copy`,
                                                        startBar: clip.startBar + clip.lengthBars,
                                                    });
                                                }}
                                                onAction={handleClipAction}
                                                openContextMenu={(selectedClip, x, y) => setContext({ clip: selectedClip, x, y })}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {lanes.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <Music className="mb-4 h-12 w-12 opacity-40" />
                                <p className="text-sm">No tracks yet</p>
                                <p className="text-xs">Sync your session or add a DAW track.</p>
                                <div className="mt-4 flex gap-2">
                                    <button type="button" onClick={syncFromSession} className="rounded-md bg-cyan-400/15 px-3 py-1.5 text-xs text-cyan-200">
                                        Sync session
                                    </button>
                                    <button type="button" onClick={addLane} className="rounded-md bg-white/5 px-3 py-1.5 text-xs text-slate-200">
                                        Add first track
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="shrink-0 border-t border-white/10 bg-[#0d1016]" style={{ height: MIXER_HEIGHT }}>
                    <div className="flex h-full min-w-max overflow-x-auto px-3 py-3">
                        {lanes.map((lane) => (
                            <div
                                key={`mix-${lane.id}`}
                                className="mx-1 flex w-20 flex-col items-center gap-2 rounded-xl border border-white/5 bg-[#12161d] px-2 py-2"
                            >
                                <span className="w-full truncate text-center text-[10px] font-semibold text-slate-300">{lane.name}</span>
                                <div className="relative h-24 w-2 rounded-full bg-black/40">
                                    <div
                                        className="absolute bottom-0 w-full rounded-full bg-gradient-to-t from-cyan-500 to-cyan-300"
                                        style={{ height: `${Math.round(lane.volume * 100)}%` }}
                                    />
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={Math.round(lane.volume * 100)}
                                    onChange={(e) => updateLane(lane.id, (l) => ({
                                        ...l,
                                        volume: parseInt(e.target.value, 10) / 100,
                                    }))}
                                    className="h-16 w-8 cursor-pointer accent-cyan-400 [writing-mode:vertical-lr] rotate-180"
                                    aria-label={`${lane.name} volume`}
                                />
                                <span className="text-[9px] tabular-nums text-slate-500">
                                    {lane.volume >= 0.99 ? '0.0' : `-${((1 - lane.volume) * 24).toFixed(0)}`}
                                </span>
                            </div>
                        ))}
                        <div className="mx-1 flex w-20 flex-col items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-2 py-2">
                            <span className="text-[10px] font-semibold text-cyan-200">Master</span>
                            <div className="relative h-24 w-2 rounded-full bg-black/40">
                                <div className="absolute bottom-0 h-[85%] w-full rounded-full bg-gradient-to-t from-violet-500 to-cyan-300" />
                            </div>
                            <span className="text-[9px] text-slate-500">0.0</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="shrink-0 border-t border-white/5 px-3 py-1.5 text-[10px] text-slate-600">
                Double-click a track to add a region · Drag clips to move · Drag right edge to resize · Right-click for DAW actions · Space play/pause
                <button type="button" className="ml-2 text-cyan-500/80 hover:text-cyan-300" onClick={() => addMarkerAtBar(Math.round(playheadBar))}>
                    Add marker at playhead
                </button>
            </div>

            <ClipContextMenu
                x={context?.x ?? 0}
                y={context?.y ?? 0}
                clip={context?.clip ?? null}
                onClose={() => setContext(null)}
                onAction={handleClipAction}
            />
        </div>
    );
};

export default ArrangementView;
