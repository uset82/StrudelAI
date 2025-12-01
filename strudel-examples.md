## Strudel Cheat Sheet

Quick, copyable snippets to try in the app. Each block is a full Strudel expression.

### Start/Stop
```js
hush() // stop all sound
```

### Tempo & Meter
```js
cps(2)        // 2 cycles per second (≈120 BPM)
cps(1.5)      // slower
```

### Drums
```js
// Basic kick/snare
stack(
  s("bd ~ bd ~").gain(1),
  s("~ sd ~ sd").gain(0.8)
)

// Four-on-the-floor with hats
stack(
  s("bd*4").gain(1),
  s("hh*8").gain(0.4),
  s("~ sd ~ sd").gain(0.8)
)

// Breakbeat
stack(
  s("bd bd ~ bd").gain(1),
  s("sd ~ sd ~").gain(0.9),
  s("ch*6 ~ ch*2").gain(0.4)
)
```

### Basslines
```js
// Simple minor groove
note(m("c2 g1 c2 g1")).s("triangle").sustain(0.2).gain(0.7)

// Rolling bass
note(m("c2 c2 g1 c2")).s("square").decay(0.12).fast(2)
```

### Melodies / Leads
```js
// Arp
note(m("c4 e4 g4 b4")).s("sawtooth").slow(2).gain(0.6)

// Call/response
stack(
  note(m("c4 d4 g4 a4")).s("sawtooth").gain(0.55),
  note(m("~ ~ e4 ~")).s("square").gain(0.4).slow(2)
)
```

### FX / Atmos
```js
note(m("<c5 g5> ~")).s("sine").slow(4).gain(0.4)

// Noise riser
s("~").n("[~ noise]").shape(0.3).slow(8).gain(0.3)
```

### Variations
```js
// Humanize timing/velocity
note(m("c3 ~ c3 ~")).s("square").fast(2).degradeBy(0.25)

// Swing hats
s("hh*8").swingBy(0.12).gain(0.35)
```

### Layered Groove (drop-in starter)
```js
(() => {
  cps(2); // ~120 BPM
  return stack(
    s("bd ~ bd sd").gain(1),
    s("hh*8").gain(0.35),
    note(m("c2 g1 c2 g1")).s("triangle").sustain(0.2).gain(0.7),
    note(m("c4 e4 g4 b4")).s("sawtooth").slow(2).gain(0.55)
  ).analyze(1);
})()
```

### Tips
- `stack(a, b, c...)` layers voices.
- `fast(n)` speeds a pattern; `slow(n)` stretches it.
- Use `gain(x)` to balance layers and avoid clipping.
- Wrap full programs as IIFEs when using multiple statements (see the “Layered Groove”).

