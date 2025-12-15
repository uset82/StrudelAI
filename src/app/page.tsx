'use client';

import dynamic from 'next/dynamic';

const SonicInterface = dynamic(() => import('@/components/SonicInterface'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-screen text-white">Loading Aether Sonic...</div>
});

export default function Home() {
  return (
    <main>
      <SonicInterface />
    </main>
  );
}
