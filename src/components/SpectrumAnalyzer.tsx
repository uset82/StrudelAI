import React, { useEffect, useRef, useState } from 'react';

interface SpectrumAnalyzerProps {
    analyser: AnalyserNode | null;
}

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({ analyser }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | undefined>(undefined);
    const peakDataRef = useRef<number[]>([]);
    const dataArrayRef = useRef<Uint8Array>(new Uint8Array(0));
    const [peakHold, setPeakHold] = useState(true);

    useEffect(() => {
        if (!analyser || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initial setup
        if (dataArrayRef.current.length !== analyser.frequencyBinCount) {
            dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
            peakDataRef.current = new Array(analyser.frequencyBinCount).fill(0);
        }

        // Set canvas size with device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * dpr;
        canvas.height = canvas.offsetHeight * dpr;
        ctx.scale(dpr, dpr);

        const WIDTH = canvas.offsetWidth;
        const HEIGHT = canvas.offsetHeight;

        // Frequency band definitions (like professional analyzers)
        const frequencyBands = {
            subBass: { start: 20, end: 60, color: '#4a1a4a' },      // Deep purple
            bass: { start: 60, end: 250, color: '#6a2a8a' },        // Purple
            lowMid: { start: 250, end: 500, color: '#3a4a9a' },     // Blue
            mid: { start: 500, end: 2000, color: '#aa3a3a' },       // Red
            highMid: { start: 2000, end: 4000, color: '#ca5a2a' },  // Orange
            presence: { start: 4000, end: 8000, color: '#4a8a3a' }, // Green
            brilliance: { start: 8000, end: 20000, color: '#5aaa4a' } // Light green
        };

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw);

            // Handle dynamic resizing of FFT size (Strudel defaults to 8192, but might change)
            if (dataArrayRef.current.length !== analyser.frequencyBinCount) {
                dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
                // Resize peak data preserving what we can, or just reset
                const newPeak = new Array(analyser.frequencyBinCount).fill(0);
                peakDataRef.current = newPeak;
            }

            const dataArray = dataArrayRef.current;
            const bufferLength = dataArray.length;
            
            analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);

            // Update peak hold
            if (peakHold) {
                for (let i = 0; i < bufferLength; i++) {
                    if (dataArray[i] > peakDataRef.current[i]) {
                        peakDataRef.current[i] = dataArray[i];
                    } else {
                        // Slow decay
                        peakDataRef.current[i] *= 0.98;
                    }
                }
            }

            // Dark gradient background
            const bgGradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
            bgGradient.addColorStop(0, '#0a0a0a');
            bgGradient.addColorStop(1, '#1a1a1a');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            // Draw detailed grid
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 0.5;

            // Horizontal lines (every 6dB)
            for (let i = 0; i <= 10; i++) {
                const y = (HEIGHT / 10) * i;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(WIDTH, y);
                ctx.stroke();
            }

            // Vertical lines at musical frequency points
            const musicalFreqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
            const sampleRate = analyser.context.sampleRate;

            musicalFreqs.forEach(freq => {
                // Convert frequency to x position (logarithmic scale)
                const nyquist = sampleRate / 2;
                const logMin = Math.log10(20);
                const logMax = Math.log10(nyquist);
                const logFreq = Math.log10(freq);
                const x = ((logFreq - logMin) / (logMax - logMin)) * WIDTH;

                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, HEIGHT);
                ctx.strokeStyle = freq % 1000 === 0 ? '#3a3a3a' : '#2a2a2a';
                ctx.stroke();
            });

            // Draw spectrum bars with frequency band coloring
            const barCount = 256;
            const barWidth = WIDTH / barCount;

            for (let i = 0; i < barCount; i++) {
                // Logarithmic frequency mapping
                const logIndex = Math.pow(i / barCount, 1.5) * bufferLength;
                const index = Math.floor(logIndex);
                const value = dataArray[index] || 0;
                const peakValue = peakDataRef.current[index] || 0;

                const normalizedValue = value / 255;
                const normalizedPeak = peakValue / 255;

                const barHeight = normalizedValue * HEIGHT;
                const peakHeight = normalizedPeak * HEIGHT;
                const x = i * barWidth;
                const y = HEIGHT - barHeight;
                const peakY = HEIGHT - peakHeight;

                // Determine frequency for this bar
                const freq = (index / bufferLength) * (sampleRate / 2);

                // Get color based on frequency band
                let barColor = '#4aaa4a'; // default green
                Object.values(frequencyBands).forEach(band => {
                    if (freq >= band.start && freq < band.end) {
                        barColor = band.color;
                    }
                });

                // Draw bar with gradient
                const barGradient = ctx.createLinearGradient(x, y, x, HEIGHT);

                if (normalizedValue > 0.85) {
                    // Hot/clipping
                    barGradient.addColorStop(0, '#ff3333');
                    barGradient.addColorStop(0.3, '#ff8833');
                    barGradient.addColorStop(1, barColor);
                } else if (normalizedValue > 0.6) {
                    // Warm
                    barGradient.addColorStop(0, '#ffaa33');
                    barGradient.addColorStop(1, barColor);
                } else {
                    // Normal - use frequency band color
                    const lightColor = (() => {
                        const hex = barColor.replace('#', '');
                        const r = Math.min(255, Math.floor(parseInt(hex.substr(0, 2), 16) * 1.3));
                        const g = Math.min(255, Math.floor(parseInt(hex.substr(2, 2), 16) * 1.3));
                        const b = Math.min(255, Math.floor(parseInt(hex.substr(4, 2), 16) * 1.3));
                        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                    })();
                    barGradient.addColorStop(0, lightColor);
                    barGradient.addColorStop(1, barColor);
                }

                ctx.fillStyle = barGradient;
                ctx.fillRect(x, y, barWidth - 0.5, barHeight);

                // Draw peak hold line
                if (peakHold && normalizedPeak > 0.05) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(x, peakY);
                    ctx.lineTo(x + barWidth - 0.5, peakY);
                    ctx.stroke();
                }

                // Add glow for prominent frequencies
                if (normalizedValue > 0.3) {
                    ctx.shadowColor = normalizedValue > 0.7 ? '#ff4444' : barColor;
                    ctx.shadowBlur = 6 * normalizedValue;
                    ctx.fillRect(x, y, barWidth - 0.5, barHeight);
                    ctx.shadowBlur = 0;
                }
            }

            // Draw frequency labels
            ctx.fillStyle = '#888';
            ctx.font = '9px "Courier New", monospace';
            ctx.textAlign = 'center';

            const freqLabels = [
                { freq: 20, label: '20' },
                { freq: 100, label: '100' },
                { freq: 500, label: '500' },
                { freq: 1000, label: '1k' },
                { freq: 2000, label: '2k' },
                { freq: 5000, label: '5k' },
                { freq: 10000, label: '10k' },
                { freq: 20000, label: '20k' }
            ];

            freqLabels.forEach(({ freq, label }) => {
                const nyquist = sampleRate / 2;
                const logMin = Math.log10(20);
                const logMax = Math.log10(nyquist);
                const logFreq = Math.log10(freq);
                const x = ((logFreq - logMin) / (logMax - logMin)) * WIDTH;
                ctx.fillText(label, x, HEIGHT - 3);
            });

            // Draw dB scale
            ctx.textAlign = 'right';
            const dbLabels = ['0', '-12', '-24', '-36', '-48', '-60'];
            dbLabels.forEach((label, i) => {
                const y = (HEIGHT / 5) * i + 10;
                ctx.fillText(label + 'dB', WIDTH - 5, y);
            });
        };

        draw();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [analyser, peakHold]);

    // Helper function to adjust color brightness (unused after inline refactor)

    return (
        <div className="spectrum-container relative w-full h-full">
            <canvas
                ref={canvasRef}
                className="spectrum-canvas spectrum-canvas-container"
            />
            <button
                onClick={() => setPeakHold(!peakHold)}
                className="absolute top-2 right-2 px-2 py-1 text-xs font-mono bg-black/80 border border-cyan-500/30 rounded text-cyan-400 hover:bg-cyan-900/20 transition-colors"
            >
                {peakHold ? 'PEAK: ON' : 'PEAK: OFF'}
            </button>
        </div>
    );
};
