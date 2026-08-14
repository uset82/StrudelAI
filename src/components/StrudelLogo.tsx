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
                <linearGradient id="proLogoGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="50%" stopColor="#d97706" />
                    <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <linearGradient id="proCoreGrad" x1="35" y1="35" x2="65" y2="65" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <filter id="proLogoGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* Hardware Chassis Hex Base */}
            <rect
                x="6"
                y="6"
                width="88"
                height="88"
                rx="20"
                fill="#0f1218"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1.5"
            />

            {/* Precision Spiral Track */}
            <path
                d="M 50 16 C 68 16 84 32 84 50 C 84 68 68 84 50 84 C 32 84 18 70 18 52 C 18 36 32 24 46 24 C 58 24 70 34 70 48 C 70 58 60 66 50 66 C 42 66 34 58 34 50 C 34 44 40 38 46 38 C 50 38 54 42 54 46 C 54 50 50 52 48 52"
                stroke="url(#proLogoGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isPlaying ? 'animate-[spin_12s_linear_infinite] origin-center' : ''}
            />

            {/* Precision Micro-Nodes */}
            <circle cx="50" cy="16" r="3" fill="#fbbf24" filter="url(#proLogoGlow)" />
            <circle cx="84" cy="50" r="2.5" fill="#f59e0b" />
            <circle cx="50" cy="84" r="3" fill="#3b82f6" filter="url(#proLogoGlow)" />
            <circle cx="18" cy="52" r="2.5" fill="#60a5fa" />

            {/* Pulse Center */}
            <circle cx="50" cy="50" r="4.5" fill="url(#proCoreGrad)" />
            {isPlaying && (
                <circle cx="50" cy="50" r="7" stroke="#fbbf24" strokeWidth="1.2" className="animate-ping origin-center opacity-60" />
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
                        <span className="font-semibold tracking-tight text-slate-100 text-sm">Strudel</span>
                        <span className="rounded bg-amber-400/10 border border-amber-400/30 px-1 py-0.2 text-[9px] font-mono font-bold text-amber-300 tracking-wider uppercase">STUDIO</span>
                    </div>
                </div>
            </div>
        );
    }

    if (variant === 'hero') {
        return (
            <div className={`flex flex-col items-center text-center gap-4 ${className}`}>
                <div className="relative">
                    <div className="absolute -inset-4 rounded-3xl bg-amber-500/5 blur-xl pointer-events-none" />
                    {renderEmblem()}
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                            AETHER<span className="text-amber-400 font-mono">SONIC</span>
                        </h1>
                        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-mono font-medium text-slate-300 tracking-wider">
                            v2.5 PRO
                        </span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-slate-400 font-normal tracking-wide">
                        Algorithmic Live Coding & Neural Music Production System
                    </p>
                </div>
            </div>
        );
    }

    // Default 'full' variant
    return (
        <div className={`inline-flex items-center gap-2.5 ${className}`}>
            {renderEmblem()}
            <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 leading-none">
                    <span className="text-base font-semibold tracking-tight text-slate-100">Aether Sonic</span>
                    <span className="rounded bg-amber-400/10 border border-amber-400/25 px-1 py-0.2 text-[9px] font-mono font-bold text-amber-300 tracking-widest uppercase">DAW</span>
                </div>
                <span className="text-[10px] font-mono tracking-wider text-slate-500 mt-1">
                    STRUDEL ENGINE
                </span>
            </div>
        </div>
    );
}
