'use client';

import React from 'react';

export type OrbState =
    | 'idle'
    | 'listening'
    | 'searching'
    | 'working'
    | 'solving'
    | 'composing'
    | 'shaping'
    | 'error';

interface ThinkingOrbProps {
    state?: OrbState;
    size?: 'sm' | 'md' | 'lg' | 'hero';
    className?: string;
    label?: string;
    showStatusText?: boolean;
}

const SIZE_MAP = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    hero: 'w-24 h-24 sm:w-32 sm:h-32',
};

const STATE_CONFIG: Record<
    OrbState,
    {
        title: string;
        color1: string;
        color2: string;
        color3: string;
        pulseDuration: string;
        spinDuration: string;
        glowIntensity: string;
    }
> = {
    idle: {
        title: 'Ready',
        color1: '#3b82f6', // Cobalt
        color2: '#0ea5e9', // Sky
        color3: '#6366f1', // Indigo
        pulseDuration: '6s',
        spinDuration: '16s',
        glowIntensity: 'rgba(59, 130, 246, 0.25)',
    },
    listening: {
        title: 'Listening',
        color1: '#10b981', // Emerald
        color2: '#06b6d4', // Cyan
        color3: '#3b82f6', // Blue
        pulseDuration: '2.5s',
        spinDuration: '8s',
        glowIntensity: 'rgba(16, 185, 129, 0.45)',
    },
    searching: {
        title: 'Searching Knowledge',
        color1: '#06b6d4',
        color2: '#3b82f6',
        color3: '#8b5cf6',
        pulseDuration: '2s',
        spinDuration: '6s',
        glowIntensity: 'rgba(6, 182, 212, 0.45)',
    },
    working: {
        title: 'Processing',
        color1: '#f59e0b', // Amber
        color2: '#ef4444', // Red
        color3: '#f97316', // Orange
        pulseDuration: '1.8s',
        spinDuration: '4s',
        glowIntensity: 'rgba(245, 158, 11, 0.5)',
    },
    solving: {
        title: 'Synthesizing Patterns',
        color1: '#10b981',
        color2: '#f59e0b',
        color3: '#3b82f6',
        pulseDuration: '1.4s',
        spinDuration: '3.5s',
        glowIntensity: 'rgba(16, 185, 129, 0.5)',
    },
    composing: {
        title: 'Composing Music',
        color1: '#f59e0b',
        color2: '#ec4899',
        color3: '#6366f1',
        pulseDuration: '1.2s',
        spinDuration: '3s',
        glowIntensity: 'rgba(245, 158, 11, 0.55)',
    },
    shaping: {
        title: 'Shaping Sound',
        color1: '#14b8a6',
        color2: '#3b82f6',
        color3: '#8b5cf6',
        pulseDuration: '2s',
        spinDuration: '5s',
        glowIntensity: 'rgba(20, 184, 166, 0.4)',
    },
    error: {
        title: 'Attention Needed',
        color1: '#ef4444',
        color2: '#dc2626',
        color3: '#b91c1c',
        pulseDuration: '1s',
        spinDuration: '2s',
        glowIntensity: 'rgba(239, 68, 68, 0.6)',
    },
};

export function ThinkingOrb({
    state = 'idle',
    size = 'md',
    className = '',
    label,
    showStatusText = false,
}: ThinkingOrbProps) {
    const config = STATE_CONFIG[state] || STATE_CONFIG.idle;
    const sizeClass = SIZE_MAP[size];

    return (
        <div className={`inline-flex flex-col items-center justify-center gap-1.5 ${className}`}>
            <div
                className={`relative ${sizeClass} flex items-center justify-center`}
                style={{
                    filter: `drop-shadow(0 0 16px ${config.glowIntensity})`,
                }}
            >
                {/* Outer Fluid Plasma SVG */}
                <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full animate-spin"
                    style={{
                        animationDuration: config.spinDuration,
                        animationTimingFunction: 'linear',
                        animationIterationCount: 'infinite',
                    }}
                >
                    <defs>
                        <radialGradient id={`orb-grad-${state}`} cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor={config.color1} stopOpacity="0.9" />
                            <stop offset="50%" stopColor={config.color2} stopOpacity="0.75" />
                            <stop offset="100%" stopColor={config.color3} stopOpacity="0.1" />
                        </radialGradient>
                        <filter id="orb-blur" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" />
                        </filter>
                    </defs>

                    <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill={`url(#orb-grad-${state})`}
                        filter="url(#orb-blur)"
                    />
                    
                    {/* Inner dynamic nodes */}
                    <circle
                        cx="38"
                        cy="42"
                        r="14"
                        fill={config.color1}
                        opacity="0.8"
                        className="animate-pulse"
                        style={{ animationDuration: config.pulseDuration }}
                    />
                    <circle
                        cx="62"
                        cy="56"
                        r="18"
                        fill={config.color2}
                        opacity="0.7"
                        className="animate-pulse"
                        style={{ animationDuration: config.pulseDuration, animationDelay: '0.4s' }}
                    />
                    <circle
                        cx="48"
                        cy="65"
                        r="12"
                        fill={config.color3}
                        opacity="0.6"
                    />
                </svg>

                {/* Core specular highlight */}
                <div
                    className="absolute inset-2 rounded-full border border-white/20 pointer-events-none"
                    style={{
                        background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.4) 0%, transparent 60%)',
                    }}
                />
            </div>

            {showStatusText && (
                <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400">
                    {label || config.title}
                </span>
            )}
        </div>
    );
}
