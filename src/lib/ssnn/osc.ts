// Simulated OSC and NNnotes MIDI converter system for the SSNN

export interface OSCSpikeMessage {
    neuronIndex: number;
    layer: number;
    col: number;
    freq: number;
    intensity: number;
    port: number; // 9000 to 9003 based on 4 neural columns
    timestamp: number;
}

export type MIDIEventHandler = (midiNote: number, velocity: number, port: number) => void;

class OSCBroadcaster {
    private socketEmitFn: ((event: string, data: unknown) => void) | null = null;
    private midiHandlers: Set<MIDIEventHandler> = new Set();
    
    // Map column index to MIDI Note number (standard equal temperament MIDI note mapping)
    public freqToMidi(freq: number): number {
        // midi = 69 + 12 * log2(freq / 440)
        const midi = 69 + 12 * Math.log2(freq / 440.0);
        return Math.round(midi);
    }

    /**
     * Connect to socket.io emitter function
     */
    public connectSocket(emitFn: (event: string, data: unknown) => void) {
        this.socketEmitFn = emitFn;
    }

    /**
     * Register a callback handler for NNnotes MIDI conversion
     */
    public onMidiNote(handler: MIDIEventHandler) {
        this.midiHandlers.add(handler);
        return () => this.midiHandlers.delete(handler);
    }

    /**
     * Broadcast a neuron spike event
     */
    public broadcastSpike(neuronIndex: number, layer: number, col: number, freq: number, intensity: number) {
        // Each of the 4 Neural Columns spike instances is routed on a different port number (9000 - 9003)
        const portColumn = col % 4;
        const portNumber = 9000 + portColumn;
        
        const spikeMessage: OSCSpikeMessage = {
            neuronIndex,
            layer,
            col,
            freq,
            intensity,
            port: portNumber,
            timestamp: Date.now()
        };

        // 1. Emit simulated OSC broadcast over socket
        if (this.socketEmitFn) {
            this.socketEmitFn('ssnn:osc_spike', spikeMessage);
        }

        // 2. NNnotes MIDI conversion
        const midiNote = this.freqToMidi(freq);
        const velocity = Math.round(intensity * 127);
        
        this.midiHandlers.forEach(handler => {
            handler(midiNote, velocity, portNumber);
        });
    }
}

export const oscSpikeBroadcaster = new OSCBroadcaster();
