import { AgentRuntime } from './src/lib/agent/runtime';
import { SonicSessionState } from './src/types/sonic';

// Mock initial state
const mockState: SonicSessionState = {
    bpm: 120,
    scale: 'C major',
    isPlaying: false,
    tracks: {
        drums: { id: 'drums', name: 'Drums', pattern: '', muted: false, solo: false, volume: 1 },
        bass: { id: 'bass', name: 'Bass', pattern: '', muted: false, solo: false, volume: 1 },
        melody: { id: 'melody', name: 'Melody', pattern: '', muted: false, solo: false, volume: 1 },
        voice: { id: 'voice', name: 'Voice', pattern: '', muted: false, solo: false, volume: 1 },
        fx: { id: 'fx', name: 'FX', pattern: '', muted: false, solo: false, volume: 1 },
    },
};

async function runTest() {
    console.log("Initializing Agent Runtime...");
    const agent = new AgentRuntime();

    const userCommand = "Make a rap beat";
    console.log(`\nUser Command: "${userCommand}"`);

    try {
        const result = await agent.processMessage(userCommand, mockState);

        console.log("\n--- Result ---");
        console.log("Response:", result.response);
        console.log("New BPM:", result.newState.bpm);
        console.log("Drums Pattern:", result.newState.tracks.drums.pattern);

        if (result.newState.bpm !== 120) {
            console.log(`\n✅ SUCCESS: BPM updated to ${result.newState.bpm} (Rap tempo).`);
        } else {
            console.log("\n❌ FAILURE: BPM did not change from default 120.");
        }

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

runTest();
