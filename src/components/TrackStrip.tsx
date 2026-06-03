import React from 'react';
import { InstrumentType, TrackState } from '@/types/sonic';

interface TrackStripProps {
    track: TrackState;
    onMute: (id: InstrumentType) => void;
    onSolo: (id: InstrumentType) => void;
    onVolumeChange: (id: InstrumentType, val: number) => void;
    onTrackFx?: (id: InstrumentType, type: 'lpf' | 'reverb' | 'delay' | 'speed' | 'pitch', val: number) => void;
}

export function TrackStrip({ track, onMute, onSolo, onVolumeChange, onTrackFx }: TrackStripProps) {
    const trackThemes: Record<InstrumentType, { dot: string; text: string; accent: string; rail: string }> = {
        drums: { dot: 'bg-cyan-300', text: 'text-cyan-200', accent: 'accent-cyan-300', rail: 'bg-cyan-300/10' },
        bass: { dot: 'bg-violet-300', text: 'text-violet-200', accent: 'accent-violet-300', rail: 'bg-violet-300/10' },
        melody: { dot: 'bg-amber-300', text: 'text-amber-200', accent: 'accent-amber-300', rail: 'bg-amber-300/10' },
        voice: { dot: 'bg-emerald-300', text: 'text-emerald-200', accent: 'accent-emerald-300', rail: 'bg-emerald-300/10' },
        fx: { dot: 'bg-rose-300', text: 'text-rose-200', accent: 'accent-rose-300', rail: 'bg-rose-300/10' }
    };

    const theme = trackThemes[track.id];
    const commonSliderClass = `studio-range w-full ${theme.accent}`;

    return (
        <div className="min-w-[148px] snap-start rounded-lg border border-white/10 bg-[#111820] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] max-sm:min-w-[136px] max-sm:p-2.5">
            <div className="mb-3 flex items-center justify-between gap-2">
                <span className={`truncate text-xs font-semibold uppercase tracking-[0.12em] max-sm:text-[11px] ${theme.text}`}>
                    {track.name}
                </span>
                <div className={`h-2 w-2 rounded-full ${track.muted ? 'bg-slate-700' : theme.dot}`} />
            </div>

            <div className="mb-3 grid grid-cols-2 gap-1.5">
                <button
                    onClick={() => onMute(track.id)}
                    className={`flex h-7 items-center justify-center rounded-md text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${track.muted
                        ? 'bg-rose-400 text-rose-950'
                        : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-100'
                        }`}
                    title="Mute"
                >
                    M
                </button>
                <button
                    onClick={() => onSolo(track.id)}
                    className={`flex h-7 items-center justify-center rounded-md text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${track.solo
                        ? 'bg-cyan-300 text-slate-950'
                        : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-100'
                        }`}
                    title="Solo"
                >
                    S
                </button>
            </div>

            <div className={`space-y-2 rounded-md ${theme.rail} p-2 max-sm:p-1.5`}>
                <div className="grid grid-cols-[32px_1fr] items-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500">Vol</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.volume}
                        onChange={(e) => onVolumeChange(track.id, parseFloat(e.target.value))}
                        className={commonSliderClass}
                        title={`Volume: ${(track.volume * 100).toFixed(0)}%`}
                    />
                </div>

                <div className="grid grid-cols-[32px_1fr] items-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500">LP</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.fx?.lpf || 0}
                        onChange={(e) => onTrackFx?.(track.id, 'lpf', parseFloat(e.target.value))}
                        className={commonSliderClass}
                        title={`Low Pass: ${((track.fx?.lpf || 0) * 100).toFixed(0)}%`}
                    />
                </div>

                <div className="grid grid-cols-[32px_1fr] items-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500">Rev</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.fx?.reverb || 0}
                        onChange={(e) => onTrackFx?.(track.id, 'reverb', parseFloat(e.target.value))}
                        className={commonSliderClass}
                        title={`Reverb: ${((track.fx?.reverb || 0) * 100).toFixed(0)}%`}
                    />
                </div>

                <div className="grid grid-cols-[32px_1fr] items-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500">Dly</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.fx?.delay || 0}
                        onChange={(e) => onTrackFx?.(track.id, 'delay', parseFloat(e.target.value))}
                        className={commonSliderClass}
                        title={`Delay: ${((track.fx?.delay || 0) * 100).toFixed(0)}%`}
                    />
                </div>

                <div className="grid grid-cols-[32px_1fr] items-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500">Spd</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.fx?.speed ?? 0.5}
                        onChange={(e) => onTrackFx?.(track.id, 'speed', parseFloat(e.target.value))}
                        className={commonSliderClass}
                        title={`Speed: ${Math.pow(2, ((track.fx?.speed ?? 0.5) - 0.5) * 2).toFixed(2)}x`}
                    />
                </div>

                <div className="grid grid-cols-[32px_1fr] items-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500">Pit</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.fx?.pitch ?? 0.5}
                        onChange={(e) => onTrackFx?.(track.id, 'pitch', parseFloat(e.target.value))}
                        className={commonSliderClass}
                        title={`Pitch: ${((track.fx?.pitch ?? 0.5) - 0.5) * 24} semitones`}
                    />
                </div>
            </div>
        </div>
    );
}
