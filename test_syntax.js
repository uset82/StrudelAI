
const code = `stack(((stack(note(m("c3")).struct("x x x x").s("square").hpf(400).decay(0.06).gain(0.7))).gain(0.600)).add(note(8)), (note(m("b3 a3 d4 db4")).s("sawtooth").lpf(400).decay(0.2).sustain(0.3).gain(0.6)).add(note(-2)), note(m("d4 db4 d4 db4 d4 d5")).s("triangle").decay(0.3).sustain(0.4).delay(0.2).gain(0.5), (note(m("<d4 f4 a4> <a4 c5 e5>")).s("sawtooth").vowel("a").slow(4).room(0.9).delay(0.3).gain(0.45)).add(note(10)))`;

console.log("Testing code syntax...");

try {
    // Mock functions to allow execution
    const m = (s) => ({ type: 'mini', val: s });
    const note = (v) => ({
        struct: () => note(v),
        s: () => note(v),
        hpf: () => note(v),
        lpf: () => note(v),
        decay: () => note(v),
        gain: () => note(v),
        sustain: () => note(v),
        delay: () => note(v),
        vowel: () => note(v),
        slow: () => note(v),
        room: () => note(v),
        add: () => note(v)
    });
    const stack = (...args) => ({ gain: () => stack(...args), add: () => stack(...args) });

    // Try to parse and execute
    const func = new Function('stack', 'note', 'm', 'return ' + code);
    func(stack, note, m);
    console.log("✅ Syntax is VALID");
} catch (e) {
    console.log("❌ Syntax Error:", e.message);
    console.log(e);
}
