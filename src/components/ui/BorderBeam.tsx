'use client';

import React from 'react';

interface BorderBeamProps {
    className?: string;
    size?: number;
    duration?: number;
    borderWidth?: number;
    anchor?: number;
    colorFrom?: string;
    colorTo?: string;
    delay?: number;
}

export function BorderBeam({
    className = '',
    size = 200,
    duration = 12,
    borderWidth = 1.5,
    anchor = 90,
    colorFrom = '#f59e0b',
    colorTo = '#3b82f6',
    delay = 0,
}: BorderBeamProps) {
    return (
        <div
            style={
                {
                    '--size': `${size}px`,
                    '--duration': `${duration}s`,
                    '--anchor': `${anchor}%`,
                    '--border-width': `${borderWidth}px`,
                    '--color-from': colorFrom,
                    '--color-to': colorTo,
                    '--delay': `-${delay}s`,
                } as React.CSSProperties
            }
            className={`pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] ${className}`}
        >
            <div
                className="absolute aspect-square w-full animate-border-beam [animation-delay:var(--delay)] [background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] [offset-anchor:calc(var(--anchor))_50%] [offset-path:rect(0_auto_auto_0_round_calc(var(--size)))]"
                style={{
                    width: 'var(--size)',
                    offsetPath: 'rect(0 100% 100% 0 round var(--size))',
                }}
            />
        </div>
    );
}
