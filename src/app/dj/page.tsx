'use client';

import Link from 'next/link';
import { Disc3 } from 'lucide-react';
import { DJMixerView } from '@/components/DJMixerView';

export default function DJPage() {
    return (
        <main className="h-screen overflow-y-auto overflow-x-hidden bg-[#0b0f14] text-slate-100">
            <header className="border-b border-white/10 bg-[#141922] px-5 py-4">
                <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                            <Disc3 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-base font-semibold text-white">DJ Mixer</h1>
                            <p className="truncate text-xs text-slate-500">Decks and performance</p>
                        </div>
                    </div>

                    <Link
                        href="/"
                        className="shrink-0 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-cyan-300/35 hover:text-cyan-100"
                    >
                        Studio
                    </Link>
                </div>
            </header>

            <DJMixerView bpm={128} />
        </main>
    );
}
