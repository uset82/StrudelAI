
/* eslint-disable @typescript-eslint/no-unused-vars */
// This file is for debugging a syntax error in the evalStrudelCode pipeline.
// It simulates the pipeline and then tries to parse the prepared code.

function escapePattern(pattern) {
    return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function replaceSampleCalls(src) {
    const percSynth = (body, kind) => {
        const escaped = escapePattern(body);
        const base = `note(m("${escaped}"))`;
        if (kind === 'bd' || kind === 'kick') return `${base}.s("square").decay(0.08).lpf(180).gain(1)`;
        if (kind === 'sd' || kind === 'sn') return `${base}.s("square").decay(0.08).hpf(400).gain(0.9)`;
        if (kind === 'hh' || kind === 'hat') return `${base}.s("pink").decay(0.02).hpf(6000).gain(0.6)`;
        return base;
    };

    return src.replace(/s\(\s*(['"])([^'"]+)\1\s*\)/gi, (full, _quote, body) => {
        const b = body.trim().toLowerCase();
        if (/(^|[^a-z])(bd|kick)([^a-z]|$)/.test(b)) return percSynth(body, 'bd');
        if (/(^|[^a-z])(sd|sn)([^a-z]|$)/.test(b)) return percSynth(body, 'sd');
        if (/(^|[^a-z])(hh|hat)([^a-z]|$)/.test(b)) return percSynth(body, 'hh');
        return full;
    });
}

function wrapComplexNoteLiterals(src) {
    const percFallback = {
        bd: 's("square").decay(0.1).lpf(150)',
        kick: 's("square").decay(0.12).lpf(120)',
        sd: 's("square").hpf(500).decay(0.08)',
        sn: 's("square").hpf(500).decay(0.08)',
        snare: 's("square").hpf(500).decay(0.08)',
        hh: 's("pink").hpf(6000).decay(0.02).gain(0.6)',
        hat: 's("pink").hpf(6000).decay(0.02).gain(0.6)',
    };

    return src.replace(/note\(\s*(['"])([^'"]+)\1\s*\)/gi, (full, quote, body) => {
        const trimmed = body.trim().toLowerCase();
        if (percFallback[trimmed]) {
            return percFallback[trimmed];
        }
        // Skip if it already calls m(...)
        if (/^\s*m\(/.test(body)) return full;

        // Wrap ALL note literals with m() - not just complex ones
        const escaped = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `note(m("${escaped}"))`;
    });
}

function sanitizeCodeForEval(code) {
    let cleaned = code;

    // Strip comments (both // and /* */)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    cleaned = cleaned.replace(/\/\/.*/g, '');

    // Drop markdown bullets or list markers that are not valid JS
    cleaned = cleaned.replace(/^\s*[-*]\s+/gm, '');

    // Remove stray leading return statements
    while (/^\s*return\b\s*/.test(cleaned)) {
        cleaned = cleaned.replace(/^\s*return\b\s*/, '');
    }

    // Strip forbidden / brittle helpers
    cleaned = cleaned.replace(/\.analyze\([^)]*\)/gi, '');
    cleaned = cleaned.replace(/\banalyze\([^)]*\)/gi, '');
    cleaned = cleaned.replace(/\.cpm\([^)]*\)/gi, '');
    cleaned = cleaned.replace(/\bcpm\([^)]*\)/gi, '');
    cleaned = cleaned.replace(/setcpm\([^)]*\)/gi, '');

    // Remove dangling commas at the end
    cleaned = cleaned.replace(/,\s*$/, '');

    // Replace missing-sample calls with synth fallbacks
    cleaned = replaceSampleCalls(cleaned);

    return cleaned.trim();
}

const userCode = `stack((stack(note(m("c1*4")).s("square").decay(0.12).lpf(100).gain(1), note(m("~ c3 ~ c3")).s("square").hpf(800).decay(0.06).room(0.15).gain(0.7), note(m("~ g1 ~ ~")).s("triangle").decay(0.25).lpf(180).gain(0.8), note(m("c5 ~ c5 c5 ~ c5 c5 ~")).s("pink").hpf(4000).decay(0.02).gain(0.35), note(m("c6*16")).s("pink").hpf(8000).decay(0.015).gain(0.25), note(m("~ ~ c3 ~ ~ c3 ~ c3")).s("triangle").decay(0.1).lpf(400).gain(0.45).room(0.2), note(m("c7*32")).s("pink").hpf(10000).decay(0.008).gain(0.2), note(m("~ ~ ~ c4")).s("triangle").hpf(2000).decay(0.2).gain(0.5), note(m("~ ~ e3 ~ ~ e3 ~ ~")).s("square").decay(0.08).hpf(1000).gain(0.55), note(m("<a5 d6> ~ <d6 a5> ~")).s("sine").decay(0.12).hpf(1500).gain(0.45), note(m("~ c4 ~ eb4")).s("sine").vowel("i").decay(0.18).hpf(800).lpf(2500).gain(0.35), note(m("c8*64")).s("pink").hpf(12000).decay(0.005).gain(0.18).pan(sine.slow(2)), note(m("e3 [g3 c4] ~ e3 ~ ~" )).s("square").decay(0.1).hpf(1200).gain(0.55))).gain(0.650), (note(m("c2 c2 ~ c2 eb2 ~ c2 ~")).s("sawtooth").lpf(sine.range(300, 900).slow(8)).decay(0.15).gain(0.75)).gain(0.850), (note(m("<c4 eb4 g4> ~ ~ ~")).s("square").decay(0.08).hpf(500).room(0.3).delay(0.2).gain(0.4).slow(2)).gain(0.700), (stack(note(m("<c5 eb5 g5 bb5>")).s("sine").slow(8).room(0.95).delay(0.5).lpf(sine.range(800,3000).slow(4)).chorus(0.4).gain(0.3), note("c7").s("pink").hpf(sine.range(1000,6000).slow(16)).pan(sine.slow(8)).room(0.8).tremolo(3).phaser(2).gain(0.22))).gain(0.850), s("~"))`;

// Simulate evalStrudelCode pipeline
const trimmed = userCode.trim();
const normalized = trimmed.replace(/^\)\s*/, '');
const sanitized = sanitizeCodeForEval(normalized);
const prepared = wrapComplexNoteLiterals(sanitized);

console.log('Prepared Code:');
console.log(prepared);

// Try to parse
try {
    const stack = (...args) => args;
    const note = () => ({ s: () => ({ decay: () => ({ lpf: () => ({ gain: () => { } }) }) }) });
    const m = () => { };
    const s = () => ({ decay: () => ({ lpf: () => ({ gain: () => { } }) }) });
    const sine = { range: () => ({ slow: () => { } }), slow: () => { } };

    new Function('stack', 'note', 'm', 's', 'sine', 'return ' + prepared);
    console.log('Syntax Check: PASSED');
} catch (e) {
    console.log('Syntax Check: FAILED');
    console.log(e.message);
}
