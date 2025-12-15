import { Server } from 'socket.io';
import {
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents,
    SocketData,
    SonicSessionState
} from '../types/sonic';
import { AgentRuntime } from '../lib/agent/runtime';
import fs from 'fs';
import path from 'path';

// In-memory session store
const sessions = new Map<string, SonicSessionState>();
// In-memory agent store
const agents = new Map<string, AgentRuntime>();

const DEFAULT_STATE: SonicSessionState = {
    bpm: 128,
    scale: 'C minor',
    isPlaying: false,
    tracks: {
        drums: { id: 'drums', name: 'Drums', pattern: '', muted: false, solo: false, volume: 1 },
        bass: { id: 'bass', name: 'Bass', pattern: '', muted: false, solo: false, volume: 1 },
        melody: { id: 'melody', name: 'Melody', pattern: '', muted: false, solo: false, volume: 1 },
        voice: { id: 'voice', name: 'Voice', pattern: '', muted: false, solo: false, volume: 1 },
        fx: { id: 'fx', name: 'FX', pattern: '', muted: false, solo: false, volume: 1 },
    },
};

export function setupSocket(io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    const sessionFilePath = path.join(process.cwd(), 'live-session.json');

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        const rawRoom =
            (typeof socket.handshake.query.room === 'string' && socket.handshake.query.room) ||
            (typeof socket.handshake.query.roomId === 'string' && socket.handshake.query.roomId) ||
            '';
        const roomId = rawRoom.trim() || 'default';
        socket.data.sessionId = roomId;
        socket.join(roomId);

        // Initialize (or reuse) room session
        const sessionId = roomId;
        if (!sessions.has(sessionId)) {
            // Try to load state from live-session.json (only when creating a new room)
            let initialState = JSON.parse(JSON.stringify(DEFAULT_STATE));
            try {
                const fileContent = fs.readFileSync(sessionFilePath, 'utf-8');
                initialState = JSON.parse(fileContent);
                console.log(`[Room:${sessionId}] Loaded initial state from live-session.json`);
            } catch (err) {
                console.warn(`[Room:${sessionId}] Could not load live-session.json, using default state:`, err);
            }

            sessions.set(sessionId, initialState);
            agents.set(sessionId, new AgentRuntime());
        }

        // Send initial state
        socket.emit('sonic:state', sessions.get(sessionId)!);

        socket.on('sonic:command', async (text) => {
            console.log(`[${sessionId}] 🎤 Received Command: "${text}"`);

            try {
                const currentState = sessions.get(sessionId)!;
                const agent = agents.get(sessionId)!;

                console.log(`[${sessionId}] Current BPM: ${currentState.bpm}`);
                console.log(`[${sessionId}] Current state tracks:`, JSON.stringify(currentState.tracks, null, 2));

                // Process with Agent
                const result = await agent.processMessage(text, currentState);

                console.log(`[${sessionId}] 🤖 AI Response: "${result.response}"`);
                console.log(`[${sessionId}] New BPM: ${result.newState.bpm}`);
                console.log(`[${sessionId}] New state tracks:`, JSON.stringify(result.newState.tracks, null, 2));

                // Update state
                if (result.newState) {
                    sessions.set(sessionId, result.newState);
                    io.to(sessionId).emit('sonic:state', result.newState);
                    console.log(`[${sessionId}] 📤 Sent new state to client`);
                }

                // Send AI response
                if (result.response) {
                    io.to(sessionId).emit('sonic:message', result.response);
                }
            } catch (error) {
                console.error('Error processing command:', error);
                socket.emit('sonic:error', 'Failed to process command.');
            }
        });

        socket.on('sonic:analysis', (analysis) => {
            const session = sessions.get(sessionId);
            if (session) {
                session.lastAnalysis = analysis;
            }
        });

        socket.on('sonic:togglePlayback', () => {
            const session = sessions.get(sessionId);
            if (session) {
                session.isPlaying = !session.isPlaying;
                sessions.set(sessionId, session);
                io.to(sessionId).emit('sonic:state', session);
                console.log(`[${sessionId}] Playback toggled: ${session.isPlaying}`);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            const room = socket.data.sessionId || sessionId;
            // Wait a tick so socket.io updates room membership.
            setTimeout(() => {
                const size = io.sockets.adapter.rooms.get(room)?.size ?? 0;
                if (size <= 0) {
                    sessions.delete(room);
                    agents.delete(room);
                    console.log(`[Room:${room}] Cleaned up (no clients remaining)`);
                }
            }, 0);
        });
    });

    // DIRECT LINK: Watch for changes in live-session.json
    console.log(`[DirectLink] Watching: ${sessionFilePath}`);

    try {
        fs.watch(sessionFilePath, (eventType: string) => {
            if (eventType === 'change') {
                try {
                    const fileContent = fs.readFileSync(sessionFilePath, 'utf-8');
                    if (!fileContent.trim()) return; // Ignore empty files
                    const newState = JSON.parse(fileContent);
                    console.log('[DirectLink] State updated from file. Broadcasting...');
                    sessions.set('default', newState);
                    io.to('default').emit('sonic:state', newState);
                } catch (err) {
                    console.error('[DirectLink] Error reading/parsing session file:', err);
                }
            }
        });
    } catch (err) {
        console.error('[DirectLink] Failed to setup file watcher:', err);
    }
}
