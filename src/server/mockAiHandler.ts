import { SonicSessionState } from '../types/sonic';

// "Gemini 3" - The most advanced (mock) AI in the universe
// Returns instant, deterministic responses for testing

export async function handleVoiceCommand(text: string, currentState: SonicSessionState) {
    console.log('[Gemini 3 Mock] Processing:', text);

    const newState = JSON.parse(JSON.stringify(currentState)); // Deep clone
    let responseText = "I've updated the session.";
    const lowerText = text.toLowerCase();

    // Mock Logic - Keyword Matching
    if (lowerText.includes('techno')) {
        newState.bpm = 135;
        // Use synthetic sounds for guaranteed playback (no sample loading)
        newState.tracks.drums.pattern = 'bd ~ ~ ~ bd ~ ~ ~';
        newState.tracks.bass.pattern = 'c2 ~ c2 ~ c2 ~ c2 ~';
        newState.tracks.melody.pattern = 'c4 ~ eb4 ~ g4 ~ ~ ~';
        newState.isPlaying = true;
        responseText = "Initiating high-energy Techno sequence at 135 BPM.";
    }
    else if (lowerText.includes('house')) {
        newState.bpm = 124;
        newState.tracks.drums.pattern = 'bd ~ sd ~';
        newState.tracks.bass.pattern = 'c2 ~ g2 ~';
        newState.tracks.melody.pattern = 'c4 e4 g4 b4';
        newState.isPlaying = true;
        responseText = "Dropping a House beat at 124 BPM.";
    }
    else if (lowerText.includes('ambient') || lowerText.includes('chill')) {
        newState.bpm = 80;
        newState.tracks.drums.pattern = 'bd(3,8)';
        newState.tracks.bass.pattern = 'c2*4';
        newState.tracks.melody.pattern = 'scale("minor", "c4 ~ ~ g4 ~ ~ eb4 ~ ~")';
        newState.isPlaying = true;
        responseText = "Setting the mood with some Ambient textures.";
    }
    else if (lowerText.includes('stop') || lowerText.includes('silence')) {
        newState.isPlaying = false;
        newState.tracks.drums.muted = true;
        newState.tracks.bass.muted = true;
        newState.tracks.melody.muted = true;
        newState.tracks.fx.muted = true;
        responseText = "Stopping all audio.";
    }
    else if (lowerText.includes('start') || lowerText.includes('play')) {
        newState.isPlaying = true;
        newState.tracks.drums.muted = false;
        newState.tracks.bass.muted = false;
        newState.tracks.melody.muted = false;
        newState.tracks.fx.muted = false;
        responseText = "Resuming playback.";
    }
    else if (lowerText.includes('faster')) {
        newState.bpm += 10;
        responseText = `Increasing tempo to ${newState.bpm} BPM.`;
    }
    else if (lowerText.includes('slower')) {
        newState.bpm -= 10;
        responseText = `Decreasing tempo to ${newState.bpm} BPM.`;
    }
    else if (lowerText.includes('beat') || lowerText.includes('drums') || lowerText.includes('music')) {
        // Default to a simple beat if no specific genre is found
        newState.bpm = 100;
        newState.tracks.drums.pattern = 'bd sd';
        newState.tracks.bass.pattern = 'c2*2';
        newState.tracks.melody.pattern = 'c4 e4 g4';
        newState.isPlaying = true;
        responseText = "Playing a simple beat for you.";
    }
    else {
        responseText = "I heard you, but I'm not sure what musical style to apply. Try 'techno', 'house', 'ambient', or just 'play a beat'.";
    }

    return { newState, response: responseText };
}
