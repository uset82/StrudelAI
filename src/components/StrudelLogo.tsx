'use client';

import React from 'react';

interface StrudelLogoProps {
    variant?: 'icon' | 'full' | 'hero' | 'compact';
    size?: number | 'sm' | 'md' | 'lg' | 'xl';
    isPlaying?: boolean;
    className?: string;
}

export function StrudelLogo({
    variant = 'full',
    size = 'md',
    isPlaying = false,
    className = '',
}: StrudelLogoProps) {
    // Dimension resolution
    const iconSize = typeof size === 'number'
        ? size
        : size === 'sm' ? 24
        : size === 'md' ? 32
        : size === 'lg' ? 44
        : 64;

    const renderEmblem = () => (
        <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`shrink-0 transition-transform duration-300 ${isPlaying ? 'scale-105' : ''}`}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="strudelGradient1" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <linearGradient id="strudelGradient2" x1="90" y1="10" x2="10" y2="90" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
                <linearGradient id="strudelCore" x1="40" y1="40" x2="60" y2="60" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#67e8f9" />
                    <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <filter id="strudelGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* Background container rounded hex/circle */}
            <rect
                x="4"
                y="4"
                width="92"
                height="92"
                rx="24"
                fill="#0d1117"
                stroke="rgba(34, 211, 238, 0.22)"
                strokeWidth="2"
            />

            {/* Outer Strudel Harmonic Spiral Ring */}
            <path
                d="M 50 14 C 70 14 86 30 86 50 C 86 70 70 86 50 86 C 30 86 16 72 16 52 C 16 34 30 22 46 22 C 60 22 72 32 72 46 C 72 58 62 68 50 68 C 40 68 32 60 32 50 C 32 42 38 36 46 36 C 52 36 56 40 56 46 C 56 50 52 53 49 53"
                stroke="url(#strudelGradient1)"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isPlaying ? 'animate-[spin_8s_linear_infinite] origin-center' : ''}
            />

            {/* Harmonic Sonic Accent Bars / Nodes */}
            <circle cx="50" cy="14" r="3.5" fill="#67e8f9" filter="url(#strudelGlow)" />
            <circle cx="86" cy="50" r="3" fill="#38bdf8" />
            <circle cx="50" cy="86" r="3.5" fill="#818cf8" filter="url(#strudelGlow)" />
            <circle cx="16" cy="52" r="3" fill="#22d3ee" />

            {/* Central Neural Pulse Core */}
            <circle cx="50" cy="50" r="5" fill="url(#strudelCore)" />
            {isPlaying && (
                <circle cx="50" cy="50" r="8" stroke="#67e8f9" strokeWidth="1.5" className="animate-ping origin-center opacity-75" />
            )}
        </svg>
    );

    if (variant === 'icon') {
        return <div className={`inline-flex items-center justify-center ${className}`}>{renderEmblem()}</div>;
    }

    if (variant === 'compact') {
        return (
            <div className={`inline-flex items-center gap-2.5 ${className}`}>
                {renderEmblem()}
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 leading-none">
                        <span className="font-bold tracking-tight text-white text-sm">Strudel</span>
                        <span className="rounded bg-cyan-400/15 border border-cyan-400/30 px-1 py-0.2 text-[9px] font-bold text-cyan-300 tracking-wider uppercase">AI</span>
                    </div>
                </div>
            </div>
        );
    }

    if (variant === 'hero') {
        return (
            <div className={`flex flex-col items-center text-center gap-4 ${className}`}>
                <div className="relative">
                    <div className="absolute -inset-4 rounded-3xl bg-cyan-500/10 blur-xl pointer-events-none" />
                    {renderEmblem()}
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                            STRUDEL<span className="text-cyan-400">.AI</span>
                        </h1>
                        <span className="rounded-full bg-cyan-500/10 border border-cyan-400/30 px-2.5 py-0.5 text-xs font-semibold text-cyan-300 uppercase tracking-widest">
                            Studio v2.5
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400 font-medium tracking-wide">
                        Algorithmic Live Coding & Generative Neural Music Workstation
                    </p>
                </div>
            </div>
        );
    }

    // Default 'full' variant
    return (
        <div className={`inline-flex items-center gap-3 ${className}`}>
            {renderEmblem()}
            <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 leading-none">
                    <span className="text-lg font-bold tracking-tight text-white">Strudel</span>
                    <span className="rounded bg-cyan-400/15 border border-cyan-400/30 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 tracking-wider uppercase">AI</span>
                </div>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 mt-1">
                    Sonic Studio
                </span>
            </div>
        </div>
    );
}
