export type DeckLoop = {
    enabled: boolean;
    startSec: number;
    endSec: number;
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export class AudioDeck {
    private readonly ctx: AudioContext;
    private destination: AudioNode;
    private buffer: AudioBuffer | null = null;
    private source: AudioBufferSourceNode | null = null;

    private startTimeSec = 0;
    private offsetSec = 0;
    private rate = 1;
    private detuneCents = 0;
    private loop: DeckLoop = { enabled: false, startSec: 0, endSec: 0 };

    constructor(ctx: AudioContext, destination: AudioNode) {
        this.ctx = ctx;
        this.destination = destination;
    }

    setDestination(destination: AudioNode) {
        this.destination = destination;
    }

    load(buffer: AudioBuffer | null) {
        this.stop();
        this.buffer = buffer;
        this.offsetSec = 0;
        this.loop = {
            enabled: false,
            startSec: 0,
            endSec: buffer?.duration ?? 0,
        };
    }

    isLoaded() {
        return Boolean(this.buffer);
    }

    isPlaying() {
        return Boolean(this.source);
    }

    getDurationSec() {
        return this.buffer?.duration ?? 0;
    }

    getCurrentTimeSec() {
        const buf = this.buffer;
        if (!buf) return 0;

        if (!this.source) {
            return clamp(this.offsetSec, 0, buf.duration);
        }

        const elapsed = this.ctx.currentTime - this.startTimeSec;
        let pos = this.offsetSec + elapsed * this.rate;

        if (this.loop.enabled && this.loop.endSec > this.loop.startSec) {
            const loopLen = this.loop.endSec - this.loop.startSec;
            if (loopLen > 0 && pos >= this.loop.endSec) {
                pos = this.loop.startSec + ((pos - this.loop.startSec) % loopLen);
            }
        }

        return clamp(pos, 0, buf.duration);
    }

    seek(sec: number) {
        const buf = this.buffer;
        if (!buf) return;
        const next = clamp(sec, 0, buf.duration);

        if (!this.source) {
            this.offsetSec = next;
            return;
        }

        this.stopSource();
        this.offsetSec = next;
        this.play();
    }

    setPlaybackRate(rate: number) {
        const next = clamp(rate, 0.25, 4);
        if (Math.abs(next - this.rate) < 0.000001) return;

        if (this.source) {
            const pos = this.getCurrentTimeSec();
            this.offsetSec = pos;
            this.startTimeSec = this.ctx.currentTime;
            this.source.playbackRate.setValueAtTime(next, this.ctx.currentTime);
        }

        this.rate = next;
    }

    setDetuneCents(cents: number) {
        if (Math.abs(cents - this.detuneCents) < 0.000001) return;
        this.detuneCents = cents;
        if (this.source) {
            this.source.detune.setValueAtTime(cents, this.ctx.currentTime);
        }
    }

    setLoop(loop: DeckLoop) {
        const buf = this.buffer;
        if (!buf) {
            this.loop = { ...loop };
            return;
        }

        const next: DeckLoop = {
            enabled: Boolean(loop.enabled),
            startSec: clamp(loop.startSec, 0, buf.duration),
            endSec: clamp(loop.endSec, 0, buf.duration),
        };
        if (next.endSec <= next.startSec) {
            next.enabled = false;
        }

        this.loop = next;

        if (this.source) {
            this.source.loop = next.enabled;
            if (next.enabled) {
                this.source.loopStart = next.startSec;
                this.source.loopEnd = next.endSec;
            }
        }
    }

    play() {
        if (this.source) return;
        const buf = this.buffer;
        if (!buf) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buf;
        source.playbackRate.value = this.rate;
        source.detune.value = this.detuneCents;
        source.loop = this.loop.enabled;
        if (this.loop.enabled) {
            source.loopStart = this.loop.startSec;
            source.loopEnd = this.loop.endSec;
        }

        source.connect(this.destination);
        source.onended = () => {
            // Natural end (no loop).
            this.source = null;
            this.startTimeSec = 0;
            this.offsetSec = 0;
        };

        this.startTimeSec = this.ctx.currentTime;
        source.start(0, this.offsetSec);
        this.source = source;
    }

    pause() {
        if (!this.source) return;
        this.offsetSec = this.getCurrentTimeSec();
        this.stopSource();
    }

    stop() {
        this.stopSource();
        this.offsetSec = 0;
    }

    private stopSource() {
        if (!this.source) return;
        try {
            this.source.onended = null;
        } catch { /* ignore */ }
        try {
            this.source.stop();
        } catch { /* ignore */ }
        try {
            this.source.disconnect();
        } catch { /* ignore */ }
        this.source = null;
        this.startTimeSec = 0;
    }
}

