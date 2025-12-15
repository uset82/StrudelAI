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
    const dotColors: Record<InstrumentType, string> = {
        drums: 'bg-cyan-500',
        bass: 'bg-purple-500',
        melody: 'bg-yellow-500',
        voice: 'bg-green-500',
        fx: 'bg-pink-500'
    };

    const sliderColors: Record<string, string> = {
        vol: 'accent-cyan-500',
        lp: 'accent-yellow-500',
        rv: 'accent-purple-500',
        dl: 'accent-green-500'
    };

    return (
        <div className="flex flex-col p-2 rounded-lg border border-cyan-900/30 bg-black/40 min-w-[120px]">
            {/* Header: Name + Activity */}
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold tracking-widest uppercase text-cyan-400">
                    {track.name}
                </span>
                <div className={`w-2 h-2 rounded-full ${track.muted ? 'bg-gray-700' : `${dotColors[track.id]} animate-pulse`}`} />
            </div>

            {/* M / S Buttons */}
            <div className="flex gap-1 mb-2">
                <button
                    onClick={() => onMute(track.id)}
                    className={`flex-1 h-6 text-[10px] font-bold rounded flex items-center justify-center transition-colors ${track.muted
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                    title="Mute"
                >
                    M
                </button>
                <button
                    onClick={() => onSolo(track.id)}
                    className={`flex-1 h-6 text-[10px] font-bold rounded flex items-center justify-center transition-colors ${track.solo
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                    title="Solo"
                >
                    S
                </button>
            </div>

            {/* Sliders */}
            <div className="space-y-1">
                {/* Volume */}
                <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-gray-500 w-3">Q1</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.volume}
                        onChange={(e) => onVolumeChange(track.id, parseFloat(e.target.value))}
                        className={`w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer ${sliderColors.vol}`}
                        title={`Volume: ${(track.volume * 100).toFixed(0)}%`}
                    />
                </div>

                {/* LP Filter */}
                <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-gray-500 w-3">LP</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.fx?.lpf || 0}
                        onChange={(e) => onTrackFx?.(track.id, 'lpf', parseFloat(e.target.value))}
                        className={`w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer ${sliderColors.lp}`}
                        title={`Low Pass: ${((track.fx?.lpf || 0) * 100).toFixed(0)}%`}
                    />
                </div>

                {/* Reverb */}
                <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-gray-500 w-3">RV</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.fx?.reverb || 0}
                        onChange={(e) => onTrackFx?.(track.id, 'reverb', parseFloat(e.target.value))}
                        className={`w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer ${sliderColors.rv}`}
                        title={`Reverb: ${((track.fx?.reverb || 0) * 100).toFixed(0)}%`}
                    />
                </div>

                {/* Delay */}
                <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-gray-500 w-3">DL</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.fx?.delay || 0}
                        onChange={(e) => onTrackFx?.(track.id, 'delay', parseFloat(e.target.value))}
                        className={`w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer ${sliderColors.dl}`}
                        title={`Delay: ${((track.fx?.delay || 0) * 100).toFixed(0)}%`}
                    />
                </div>

                {/* Speed (Tempo) */}
                <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-gray-500 w-3">SP</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.fx?.speed ?? 0.5}
                        onChange={(e) => onTrackFx?.(track.id, 'speed', parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-400"
                        title={`Speed: ${Math.pow(2, ((track.fx?.speed ?? 0.5) - 0.5) * 2).toFixed(2)}x`}
                    />
                </div>

                {/* Pitch (Deep Voice) */}
                <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-gray-500 w-3">PT</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.fx?.pitch ?? 0.5}
                        onChange={(e) => onTrackFx?.(track.id, 'pitch', parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-400"
                        title={`Pitch: ${((track.fx?.pitch ?? 0.5) - 0.5) * 24} semitones`}
                    />
                </div>
            </div>
        </div>
    );
}
