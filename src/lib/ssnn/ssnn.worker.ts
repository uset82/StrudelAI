import { SSNNEngine } from './engine';

let engine: SSNNEngine | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

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

        case 'START':
            if (intervalId) clearInterval(intervalId);
            
            // Run SNN updates at ~60Hz
            const tickRate = 16.67; // ms
            intervalId = setInterval(() => {
                if (!engine) return;
                
                const externalInput = data?.externalInput;
                const spikes = engine.step(externalInput);
                
                ctx.postMessage({
                    type: 'TICK',
                    spikes,
                    potentials: Array.from(engine.potentials),
                    visualSpikes: Array.from(engine.visualSpikes)
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
