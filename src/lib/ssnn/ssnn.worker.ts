import { SSNNEngine } from './engine';

let engine: SSNNEngine | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let externalInput: Float32Array | undefined;

// Self typing for Web Worker scope
const ctx: Worker = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent) => {
    const { type, data } = e.data;

    switch (type) {
        case 'INIT':
            engine = new SSNNEngine(data.state);
            break;

        case 'UPDATE_STATE':
            if (engine) {
                engine.updateState(data.state);
            }
            break;

        case 'LEARN':
            if (engine && data.spectrum) {
                engine.learnFromFFT(data.spectrum);
            }
            break;

        case 'SET_INPUT':
            externalInput = data?.spectrum
                ? new Float32Array(data.spectrum)
                : undefined;
            if (engine && externalInput && data?.learn) {
                engine.learnFromFFT(externalInput);
            }
            break;

        case 'START':
            if (intervalId) clearInterval(intervalId);
            
            // A 25 Hz simulation clock is sufficient for musical events and
            // keeps the 960-neuron matrix away from the React/UI thread.
            const tickRate = 40;
            intervalId = setInterval(() => {
                if (!engine) return;
                const steps = Math.max(1, Math.min(8, Math.round(engine.getState().updateRate)));
                const spikes: number[] = [];
                for (let step = 0; step < steps; step++) {
                    spikes.push(...engine.step(externalInput));
                }
                
                ctx.postMessage({
                    type: 'TICK',
                    spikes,
                    visualSpikes: engine.visualSpikes.slice(),
                });
            }, tickRate);
            break;

        case 'STOP':
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            break;
    }
};
