# Strudel Live Coding Context Reference

Version: 1.0  
Last Updated: November 21, 2025  
Purpose: Context for generating and understanding Strudel live coding patterns.

---

## Table of Contents

1. What is Strudel?  
2. Core Concepts  
3. Mini-Notation Syntax  
4. Pattern Constructors  
5. Control Parameters  
6. Effects & Modifiers  
7. Sound Sources  
8. Common Patterns & Examples  
9. Best Practices  
10. Syntax Patterns Reference  
11. Example: Complete Track  
12. Reference Corpus (Real-World Strudel Code)  
13. Key Takeaways for AI Code Generation  
14. Common Errors to Avoid  
15. Resources

---

## 1. What is Strudel?

Strudel is a browser-based live coding environment for creating music with pattern-based code. It is inspired by TidalCycles and uses JavaScript syntax with pattern functions and compact mini-notation.

### Key Features

- Real-time REPL: read, evaluate, play, loop.
- Mini-notation for dense rhythmic expression.
- Function chaining for effects and modifiers.
- WebAudio-based synthesis and sample playback.
- Visual feedback of active events.

---

## 2. Core Concepts

### Patterns
Patterns map time spans to events. Each event has a value, begin time, and end time.

```js
const pattern = seq("c3", ["e3", "g3"]);
const events = pattern.queryArc(0, 1); // events with timing and values
```

### Cycles
A cycle is one loop iteration. Patterns repeat each cycle unless slowed or sped up.

```js
s("bd sd hh cp");      // completes in 1 cycle
s("bd sd hh cp").slow(2); // takes 2 cycles
```

### Time Representation

- 0/1 = start of cycle
- 1/2 = halfway
- 1/1 = end of cycle (start of next)

---

## 3. Mini-Notation Syntax

Mini-notation uses double-quoted strings. Single quotes remain normal JS strings.

### Basic Symbols

- Space: sequential steps — `"bd sd hh"`
- `~`: rest/silence — `"bd ~ hh"`
- `,`: parallel/stack — `"bd, hh*4"`
- `[ ]`: grouping/subdivision — `"bd [sd cp]"`
- `< >`: alternation (slowcat) — `"<bd sd>"`
- `*`: repetition — `"bd*4"`
- `/`: slowdown — `"bd/2"`
- `!`: replication — `"bd!3"`
- `_`: elongation — `"bd _ _"`
- `@`: weight/duration — `"bd@3 sd"`
- `:`: sample selection — `"bd:3"`
- `( )`: Euclidean rhythm — `"bd(3,8)"`

### Advanced Patterns

```js
s("bd [sd [cp hh]]");          // nested subdivision
s("bd2 ~ sd/2 hh4");           // rests and speed changes
s("bd(5,8)");                  // Euclidean kicks
s("<bd sd, hh*8>");            // alternation and parallel hats
s("bd@3 sd@1 hh@2");           // weighted steps
note("<[c3 e3 g3] [d3 f3 a3]>"); // pattern of patterns
```

---

## 4. Pattern Constructors

### Sequential

```js
seq("a", "b", "c"); // mini: "a b c"
cat("a", "b", "c"); // mini: "<a b c>"
```

### Parallel

```js
stack("a", "b", "c"); // mini: "a, b, c"
stack(
  s("bd*4"),
  s("~ sd"),
  s("hh8")
);
```

### Time-Based

```js
timeCat([3, "a"], [1, "b"]); // mini: "a@3 b@1"
polymeter(["a", "b", "c"], ["x", "y"]); // mini: "{a b c, x y}"
polymeterSteps(2, ["c", "d", "e", "f"]); // mini: "{c d e f}%2"
```

### Utilities

```js
silence;        // mini: "~"
pure("c3");     // single value pattern
```

---

## 5. Control Parameters

### Note & Pitch

- `note("c3 e3 g3")`
- `n("0 2 4")` with `.scale()`
- `freq(220)`
- `octave(4)`
- `scale("C:minor")`

### Sound Selection

- `s("bd")` (alias: `sound("bd")`)
- `bank("RolandTR808")`
- `n(3)` selects variant (0-indexed)

### Timing & Rhythm

- `fast(2)`, `slow(2)`
- `early(0.1)`, `late(0.1)`
- `hurry(2)`

### Amplitude

- `gain(0.8)`, `amp(0.5)`
- `velocity(0.9)`

### Filters

- `cutoff(1000)` (alias `lpf(1000)`)
- `hpf(500)`, `bpf(1000)`
- `lpq(10)`, `hpq(10)`

### Synthesis Envelopes

- `attack(0.1)`, `decay(0.2)`, `sustain(0.5)`, `release(0.3)`
- `shape(0.5)` for waveshaping/distortion

---

## 6. Effects & Modifiers

### Audio Effects

- Reverb: `.room(0.5)`, `.roomsize(0.8)`
- Delay: `.delay(0.5)`, `.delaytime(0.25)`, `.delayfeedback(0.6)`
- Distortion: `.distort(0.5)`, `.shape(0.3)`, `.crush(8)`
- Modulation: `.phaser(4)`, `.leslie(1)`, `.tremolo(4)`
- FM: `.fm(2)`, `.fmh(2)`

### Pattern Transformations

- Structural: `.rev()`, `.palindrome()`, `.jux(rev)`, `.chunk(4, fast(2))`
- Density: `.ply(2)`, `.stutter(4)`, `.echo(4, 0.125, 0.5)`
- Probability: `.sometimes(rev)`, `.often(rev)`, `.rarely(rev)`, `.degradeBy(0.5)`, `.mask("<1 0 1 1>")`
- Randomization: `.shuffle()`, `.scramble(4)`

### Panning & Spatial

- `.pan(0.5)` or `.pan(sine)` for autopan

---

## 7. Sound Sources

### Built-in Samples

- Drums: `s("bd")`, `s("sd")`, `s("hh")`, `s("cp")`, `s("rim")`, `s("tom")`, `s("perc")`
- Melodic / Synth: `s("piano")`, `s("sawtooth")`, `s("square")`, `s("triangle")`, `s("sine")`

### Built-in Synths

```js
note("c3 e3 g3").s("sawtooth");
note("a2").s("square").cutoff(800);
s("gm_acoustic_bass");
s("gm_epiano1");
s("gm_synth_strings_1");
```

### External Samples

```js
samples("github:username/repo/path");
samples("github:tidalcycles/Dirt-Samples/master/");
```

---

## 8. Common Patterns & Examples

```js
// Basic drum beat
stack(
  s("bd*4"),
  s("~ sd"),
  s("hh8")
);

// Four-on-the-floor techno
setcpm(130);
stack(
  s("bd*4").gain(0.9),
  s("~ cp ~ cp").room(0.2),
  s("hh16").gain(0.4).pan(sine.range(0, 1)),
  note("c2 c2 eb2 c2").s("sawtooth").cutoff(800)
).swing(0.05);

// Melodic pattern
note("c3 [e3 g3]*2 <a3 f3>").s("piano").scale("C:minor").room(0.3).delay(0.25);

// Bassline with filter sweep
note("c2 ~ eb2 ~ g2 ~ bb2 ~")
  .s("sawtooth")
  .cutoff(sine.slow(4).range(200, 2000))
  .lpq(10)
  .gain(0.7);

// Euclidean rhythm
stack(
  s("bd(5,8)"),
  s("hh(11,16)")
);

// Chord progression
stack(
  "<Am7 Dm7 G7 Cmaj7>".chord().voicing().s("sawtooth").lpf(1200).room(0.4)
);

// Generative pattern
note("0 [2 4] 7 [9 11]")
  .add(perlin.range(0, 7))
  .scale("C:minor")
  .s("piano")
  .decay(0.2)
  .degradeBy(0.3);
```

---

## 9. Best Practices

1. Start simple, layer gradually: build rhythm first, then add hats, then melody.
2. Use chaining: apply effects after choosing notes and sound.
3. Create reusable functions: register custom transforms and reuse.
4. Prefer mini-notation: `"bd ~ sd hh"` instead of many `seq()` calls.
5. Control timing early: set tempo with `setcpm()`/`setbpm()`.
6. Use patterns for automation: parameters can be static, patterned, or continuous functions.
7. Structure with `stack()`: drums, bass, chords, melody as layers.

---

## 10. Syntax Patterns Reference

- Sequential: `"a b c"`
- Parallel: `"a, b, c"`
- Subdivision: `"a [b c]"`
- Alternation: `"<a b c>"`
- Repetition: `"a*3"`
- Slowdown: `"a/2"`
- Rest: `"~"`
- Elongate: `"a _ _"`
- Weight: `"a@3 b@1"`
- Euclidean: `"a(3,8)"`
- Sample select: `"bd:3"`
- Replication: `"a!3"`

### Function Chaining Template

```js
pattern
  .param1(value)
  .param2(value)
  .effect1(amount)
  .effect2(amount);
```

### Stack Template

```js
stack(
  pattern1,
  pattern2,
  pattern3
);
```

---

## 11. Example: Complete Track

```js
// Set tempo and load samples
setcpm(130);
samples("github:tidalcycles/Dirt-Samples/master/");

// Chord progression
const chords = "<Am7 Dm7 Em7 Fmaj7>".chord();

// Main pattern
stack(
  s("bd*4").gain(0.9).sometimes(ply(2)),          // kick
  s("~ sd").room(0.3).often(jux(rev)),             // snare
  s("hh*8").gain(0.5).pan(sine.range(0.3, 0.7)).degradeBy(0.2), // hats
  chords.sub(note(12)).s("sawtooth").cutoff(sine.slow(4).range(300, 800)).lpq(8).gain(0.7), // bass
  chords.voicing().s("gm_epiano1").room(0.5).gain(0.6).delay(0.125), // chords
  n("0 2 4 7 9 7 4 2".slow(2)).scale("A:minor").s("piano").decay(0.2).room(0.4).degradeBy(0.3).add(perlin.range(0, 2)) // melody
);
```

---

## 12. Reference Corpus (Real-World Strudel Code)

### 12.1 Trance Lead & Bass (Switch Angel)

```js
// Trance lead - melodic sequence in G minor
$: n("<0 4 0 9 7>*16".add("<7 _ _ 6 5 _ _ 6>*2")).scale("g:minor")
  .o(3).s("sawtooth").acidenv(slider(0.869)).delay(0.4).pianoroll();

// Lead variation with random detuning, octave shift
$: n("<7 _ _ 6 5 _ <5 3> <6 4>>>*2").scale("g:minor").trans(-24).detune(rand)
  .o(4).s("supersaw").acidenv(slider(1)).pianoroll();

// Bass mono pattern, two octaves down, supersaw
$: n("<0>*16").scale("g:minor").trans(-24).detune(rand)
  .o(4).s("supersaw").acidenv(slider(0.751)).pianoroll();

// Drum tops and effects
$: s("top:1|2").fit().o(0.5);
$: s("tbd:2|4").duck("3:4:5:6").duckdepth(0.8);
$: s("white|4").att(0.4).o(0.6);
$: s("jcp:9:4").o(0.8);
```

### 12.2 DJ_Dave — Hard Refresh (Full Project Patterns)

```js
setCps(150/60/4);
samples("github:algorave-dave/samples");
samples("github:tidalcycles/dirt-samples");

const Structures = [
  "{x!6 ~ ~ x ~ ~|3 x ~}%16",
  "{xx4}",
  "{x}"
];

const PG = [
  "{0.3 0.8!6 0.3 0.8!2 0.3 0.8!3 0.3 1}",
  "{0.3 0.8}*8",
  "0.8"
];

const beat = 2;

DRUMS: stack(
  s("tech:5").postgain(5).pcurve(2).pdec(1).struct(pick(Structures, beat)),
  s("~ cp").bank("KorgDM110").speed(1).fast(2).postgain(0.15).lpf(3000)
);

s("breaks165").gain(0.4).loopAt(1).chop(16).fit().postgain(pick(PG, beat));
s("psr:[2|12|24|25]").fast(4).struct("xl7 ~ xl3 ~ xl3 ~").jux(rev).hpf(1000).postgain(pick(PG, beat)).speed(0.5).gain(0.2);

note("f#3 g#3 a3 ... c#3 a3 ...").slow(8)
  .struct("x!16")
  .sustain(0.5)
  .sound("square, sawtooth")
  .transpose([-12, 0])
  .coarse(2)
  .decay(0.75).gain(0.75)
  .hpf(150)
  .lpf(mouseX.segment(4).range(350, 2000))
  .postgain(pick(PG, beat))
  .punchcard({ width: 600 });

VOXCHOP1: s("heartbeat:0".slow(2)).note("g#1").slice(8, "<5 6>").fast(2)
  .chop(32).cut(1).loopAt(4)
  .room(2)
  .gain("<0.6 1.6>").slow(2)
  .lpf(slider(600, 600, 4000))
  .postgain(pick(PG, beat))
  .scope({ width: 600 });

VOXCHOP2: s("heartbeat:<1 0>".slow(2)).striate("<2 4>".slow(2))
  .ply("[4|8]".fast(8)).note("a1")
  .phaser(8).room(2).rfade(30)
  .cut(1).clip(1)
  .lpf(slider(5000, 600, 5000))
  .postgain(1.75)
  .room(1)
  .scope({ width: 600 });
```

### 12.3 Live Coding Screenshot (Chunks, Stack, Chords)

```js
// Drum and polyrhythm chunking example
chunk(4, fast(2),
  stack([
    sound("kick:1|2*4"),
    sometimesBy(0.2,
      release(1,
        sound("cr:4").hpf(4000).release(0.2).speed("0.9 1 1 1")
        .sound("<[~ rim:5] <-> rim:1> snare:3 [~ snare:1]>")
      )
    ),
    fast(2, sound("<[~ t]> <-> t <-> [~ t]>")),
    fast(2, struct("<- [~ t]> <- t <- [~ t]>")),
    sound("cp")
  ])
);

// Live-coded chord stack
d2
  .slow(2)
  .stack([
    note("g6 --------- e6 --------- d7 --------- d7 --------- f#7 --------- f#7"),
    note("e6 --------- g6 --------- b6 --------- d7 --------- d7 --------- f#7 --------- f#7"),
    note("b6 --------- b6 --------- g6 --------- g6 --------- b6 --------- b6")
  ]);

// Pad chords with gain, pan, degrade, and arpy
d2
  .degradeBy("0.2")
  .slow(2)
  .stack([
    note("g6 --------- e6 --------- d7 --------- d7 --------- f#7 --------- f#7"),
    note("e6 --------- g6 --------- b6 --------- d7 --------- d7 --------- f#7 --------- f#7"),
    note("b6 --------- b6 --------- g6 --------- g6 --------- b6 --------- b6"),
    pan(0.2),
    pan(0.8),
    gain(0.9)
  ]);
```

### 12.4 Solstice Jam (eddyflux / Solstice Jam)

```js
await samples("github:yaxu/clean-breaks/master");

// hello, this is eddyflux (aka froos)! happy solstice everyone
stack(
  s("oneshots:<0 1 2 16>").room(0.5).delay(0.5).late(8),
  run("<12>").add(4).slow(8).chord("Fm7/2").dict("ireal").voicing()
    .juxBy(0.5, rev)
    .ds("0.1:0")
    .lpf(perlin.range(400, 800))
    .s("sawtooth").vib("0.4:0.5"),
  s("mechanicalman/2").fit().ds("0.15:0")
    .shape(0.4).chop(8)
    .hush()
);

stack(
  s("bd(5,8)2").bank("RolandTR707").shape(0.5),
  // s("<sd rim>").bank("RolandTR909").room("<0 0.5>").hush()
  .hpf(800),
  fit(1/8, mul(speed(1.5), gain(0.5))).room(0.25)
);

s("loop2/[4]").fit().ds("<2.0>").chop("<16 32>").room(0.75)
  .lpf(perlin.range(500, 2000)).juxBy(0.5, rev).gain(0.75)
  .lastof(8, mul(speed(-2)))
  .late("<10>")
  .hurry(0.5).delay(0.5).room(0.5).juxBy(0.5, rev);
```

### 12.5 Jam Session & Experimental Patterns

```js
// Welcome to our strudel jam, live from Sweden, France and Germany
await samples("github:tidalcycles/Dirt-Samples/master");
await samples("github:yaxu/clean-breaks/master");

stack(
  run(4).s("jazz").d("0.2:0").gain(1).shape(0.5)
    .almostNever(ply(4))
    .juxBy(0.6, rev)
    .hpf(500).room(0.5).hush(),
  s("impeach/2").fit().chop(8).d("0.2:0").shape(0.85).chunk(4, hurry(2)),
  s("bd(3,8,<@ 1>) <- rim cp, [~ hh]2").end(1).bank("RolandTR909").shape(0.75).hush(),
  hurry(1)
);
```

```js
// Experimental stack with bastterd / terrorhawk samples
await samples({ bastterd: "asmr/basterdstrudel.mp3" });
await samples("github:terrorhawk/samples/main");

stack(
  n("<4 3 2 0 2 4>/4".euclidRot("<3 5>", 8, 2)).scale("F#:chromatic")
    .n(undefined)
    .s("bastterd").clip(1)
    .splice(32, [
      0, 1, 2, 3, 4, 5, 6, 7,
      8, 9, 10, 11, 12, 13, 14, 15,
      16, 17, 18, 19, 20, 21, 22, 23,
      24, 25, 26, 27, 28, 29, 30
    ])
    .shape(0.8).velocity(0.5)
    .room(0.3).size(5)
    .superimpose((x) => s("sawtooth").velocity(0.5))
    .lpf(perlin.range(200, 800).slow(1))
    .lpa(0.1).lpenv(-2).dm("0.1:0")
    .delay(2).rev()
);
```

### 12.6 Switch Angel — TOPLAP Solstice Stream 2024

```js
setCps(140/60/4);

const tran = pick("d#0", "b4", "-6", "-4", "-2", "1");
const acid = "e4".add("d#5").add("b4").add("a#4").ribbon(0.5, 1)
  .add(tran).grab("g#:b:g:a:c:d#:f#");

// Lead synth pattern
struct("x2 a x2").ribbon(0.5, 1)
  .s("tear").lpenv(slider(2, 2.96, 0.8, 1.2).segment(16).slow(18))
  .lpsustain(0.41).lpd(0.37).lpq(0.7)
  .begin("saw").hpf(200).distort("d#4").delay(0.5).orbit(2).postgain(0.8);

// Kick drum pattern
const kick = s("bd:47").struct("x(1,32)").slow(2).gain(0.9);

// Noise/hat patterns
const noisePat = [
  "{~ x b2 x x2 x x2 x}",
  "{x x x x x x x}%16"
];

const basskick = s("jsbd8").note("c2").and(tran)
  .struct("x[4]").clip(1).hpf(0.06).lpenv(13).hatpack().hpdecay(0.19)
  .orbit(2).postgain(0.76);

const shell = s("white, jsd:9:6").struct(pick(noisePat, 0.96))
  .hpf(600).bpenv(13).bpdacay(0.46).phaser(0.2)
  .pan(fast(0.4)).delay(0.8).delayfeedback(0.5).delaytime(3/8);

const hats = s("joh:17, joh:6:5, white")
  .struct("{[0] 1[48]}").clip(1)
  .gain(slider(0, 0, 1))
  .decay(slider(0.08, 0.15)).begin.tri.range(0.08, 0.3).slow(4)
  .almostNever((x) => x.ply("1"));

const claps = s("jcp:24:1, jsd:26:7, x[1:4]").struct("x(16,16,2)").clip(1)
  .decay(0.2).gain(slider(0, 0, 1));

const chords = ["E3", "B3", "F#5", "G5"];

const arp = note(chords[0].arp("0 1 2 3 2 1") * 16)
  .add("7 0 7 12 0").mul(sine.range(1.1).fast(1.2))
  .grab("e:b:g:f#").room(1).z1("5:3");

// Lead with pulse, filter, pan, envelope
s("pulse:3").lpf(300).lpenv("6").lpd(0.9).lpq(0.2).release(1).pan(sine.fast(0.4)).chorus(0.5).distort("d#4").hpf(100).postgain(0.8);

const goldeneye = s("block:4").struct("<e0 0 1 0 0 0 0>").postgain(1.3).orbit(3)
  .struct("x(11,16)").chorus(0.5).coarse(12)
  .segment(16).postgain(0.8).pan(rand);

const hypelead = note("[f#] g a [d e] [e] [~ | g] [f#] [[a g] g | [g f#]] d4") * 8
  .add(12).add(tran).grab("e:b:g:a:c:d#:f#")
  .s("tear").begin.rand.range(0, 0.3).clip(0.6).delay(0.7).delaytime(0.183)
  .postgain(0.61).shimmer(0.7).room(1).phaser(0.5).roomsize(0.9).gain("{[0.9 | 0.7] 1 0.7 1}*8");

const drums = stack(
  kick, hats, claps, goldeneye
).postgain(0.68);

d1: drums.orbit(1);
d2: basskick.orbit(2);
d3: acid.orbit(3);
d4: hypelead.orbit(4);
d5: shell.orbit(5);
d6: arp.orbit(6).roomsize(slider(0, 1, 0, 1));

all((x) => x.outgain(1));
```

---

## 13. Key Takeaways for AI Code Generation

1. Mini-notation first: use double quotes for patterns.
2. Chain functions: select sound, then chain parameters and effects.
3. Use `stack()` for layering parts.
4. Think in cycles: timing is fractional and loops by default.
5. Parameters accept patterns: automation via patterns and oscillators.
6. Continuous functions: use `sine`, `saw`, `perlin` for motion.
7. Start with rhythm: `s("...")` for drums, `note("...")` for melody.
8. Probability helpers: `sometimes()`, `often()`, `degradeBy()` for variation.
9. Set tempo early: `setcpm()` / `setbpm()`.
10. Keep snippets copy-paste ready for live coding.

---

## 14. Common Errors to Avoid

1. Avoid `localStorage` in sandboxed contexts.
2. Use double quotes for mini-notation; single quotes are plain strings.
3. Chaining does not mutate; each call returns a new pattern.
4. Time is in cycles unless specified otherwise.
5. Parameters are lowercase: `gain()`, not `Gain()`.

---

## 15. Voice & Effects Guide

### 15.1 Adding Voices

#### Formant Synthesis (Vowel Sounds)
Create vocal-like timbres using the `.vowel()` method:

```javascript
// Basic vowel sequence
note(m("c3 e3 g3 c4")).s("square").vowel("a e i o u")

// Choir-like pad
note(m("c4,e4,g4")).s("sawtooth").vowel("a").slow(4).room(0.9).gain(0.7)

// Robot voice
note(m("c4 ~ e4 ~")).s("square").vowel("o").crush(4).lpf(800)

// Talking bass
note(m("c2 ~ g1 ~")).s("triangle").vowel("o u").fast(2).gain(0.9)
```

**Available Vowels**: `a`, `e`, `i`, `o`, `u`

#### Vocoder-Style Effects
Simulate a vocoder using noise and band-pass filters:

```javascript
// Moving vocoder
note(m("c3*8")).s("noise").bandf(sine.range(400, 2000)).gain(0.5)

// Rhythmic vocoder
note(m("c3 ~ e3 ~ g3 ~")).s("noise").bandf(800).resonance(10).gain(0.6)
```

### 15.2 Effects Catalog

#### Filters
```javascript
// Low-pass filter (cuts high frequencies)
.lpf(1000)

// High-pass filter (cuts low frequencies)
.hpf(200)

// Band-pass filter (keeps middle frequencies)
.bandf(800)

// Dynamic filter sweep
.lpf(sine.range(200, 2000))

// Filter with resonance (Q)
.lpf(500).resonance(10)
```

#### Distortion & Saturation
```javascript
// Bit crusher (retro/lo-fi effect)
.crush(8)   // 8-bit sound
.crush(4)   // 4-bit (harsher)

// Waveshaping distortion
.shape(0.5)

// Distortion
.distort(0.5)

// Coarse pitch (stepped pitch)
.coarse(2)  // Chromatic steps
```

#### Modulation Effects
```javascript
// Phaser
.phaser(4)  // Swooshing sound

// Chorus (thickens sound)
.chorus(0.5)

// Tremolo (amplitude modulation)
.tremolo(8)  // 8 Hz rate

// Leslie speaker (rotary effect)
.leslie(5)

// Vibrato (pitch modulation)
.detune(sine.slow(4))
```

#### Spatial Effects
```javascript
// Reverb
.room(0.8)        // Reverb amount
.roomsize(10)     // Room size

// Delay
.delay(0.5)       // Delay amount

// Stereo panning
.pan(0.5)         // Static (0=left, 0.5=center, 1=right)
.pan(sine.slow(4)) // Auto-pan

// Stereo width
.jux(rev)         // Reverses pattern in right channel
```

#### Dynamics
```javascript
// Sidechain ducking (EDM pumping)
.duck("3:4:5:6")
.duckdepth(0.8)

// Volume envelope
.gain(0.8)
.att(0.01)      // Attack
.decay(0.1)     // Decay
.sustain(0.5)   // Sustain
.release(0.3)   // Release
```

#### Sample Manipulation
```javascript
// Speed/pitch
.speed(2)       // Double speed (up an octave)
.speed(0.5)     // Half speed (down an octave)

// Tempo sync
.loopAt(2)      // Loop over 2 cycles

// Chopping
.chop(16)       // Chop into 16 pieces
.slice(8, "0 2 4 6")  // Select specific slices

// Granular synthesis
.striate(4)     // Granulate into 4 grains
```

### 15.3 Effect Combinations (Presets)

**Robot Voice:**
```javascript
note(m("c4 e4 g4")).s("square").vowel("o").crush(4).lpf(800).room(0.3)
```

**Space Pad:**
```javascript
note(m("c4,e4,g4")).s("sawtooth").slow(4).room(0.9).delay(0.5).lpf(1200).chorus(0.6)
```

**Acid Bassline:**
```javascript
note(m("c2 ~ eb2 ~ f2 ~")).s("triangle").lpf(sine.range(200, 1500)).resonance(15).acidenv(0.8)
```

**Lo-Fi Drums:**
```javascript
note(m("c3*4")).s("square").decay(0.05).crush(6).hpf(100).room(0.2)
```

**Ethereal Choir:**
```javascript
note(m("c4,e4,g4,b4")).s("sawtooth").slow(8).vowel("a").room(0.95).delay(0.3).lpf(2000).gain(0.6)
```

**Glitchy Lead:**
```javascript
note(m("c5 e5 g5*2")).s("square").fast(2).chop(16).crush(8).phaser(6).delay(0.25).room(0.4)
```

**Sub Bass:**
```javascript
note(m("c1 ~ ~ ~")).s("sine").gain(1.2).lpf(80).shape(0.3)
```

**Retro Synth:**
```javascript
note(m("c4 e4 g4 b4")).s("square").coarse(1).crush(8).delay(0.25).room(0.3).lpf(1500)
```

---


## 16. Dedicated Voice Track

The application now supports a dedicated **Voice** track layer, separate from Melody and FX. This is optimized for:
- Vocal chops and samples
- Formant synthesis (`.vowel()`)
- Speech synthesis (if available)
- Vocoder effects

### Targeting the Voice Track
When generating code, the AI agent can now output a specific `voice` track in the JSON response:

```json
{
  "type": "update_tracks",
  "tracks": {
    "drums": "...",
    "bass": "...",
    "melody": "...",
    "voice": "note(m('a e i')).s('sawtooth').vowel('a e i').slow(2)",
    "fx": "..."
  }
}
```

### Recommended Voice Patterns
- **Choir Pads**: `note(m("c4,e4,g4")).s("sawtooth").vowel("a").slow(4).room(0.9)`
- **Robot Speech**: `note(m("c3*8")).s("square").vowel("o").crush(4)`
- **Vocal Chops**: `s("voice_sample:1").chop(8).scramble(4)`

---

## 17. Samba & Batucada Percussion Kit

Samba and Batucada rhythms are built on the interplay between the steady Surdo bass drums and syncopated high percussion. Traditional batucada is **purely percussive** with no defined melodic pitch, but we can simulate it with synthesizers.

### Instrument Reference (Synthetic Notes)

| Instrument | Note | Frequency | Role |
|------------|------|-----------|------|
| Surdo 1 (grave) | C1 | ~32 Hz | Deep heartbeat, hits on beat 2 |
| Surdo 2 (médio) | G1 | ~49 Hz | Response drum, hits on beat 1 |
| Surdo 3 (agudo) | C2 | ~65 Hz | Fill patterns |
| Repinique | C3-E3 | 130-165 Hz | Call patterns, breaks |
| Caixa/Tarol | C4 | ~262 Hz | Driving 16th notes |
| Tamborim | G5 | ~784 Hz | Syncopated "teleco-teco" |
| Agogô (low) | A5 | 880 Hz | Two-tone bell (low) |
| Agogô (high) | D6 | 1175 Hz | Two-tone bell (high) |
| Ganzá/Chocalho | C6+ | 1000+ Hz | Continuous shaker |
| Cuíca | Variable | 200-600 Hz | Friction drum (pitch bends) |

### Basic Batucada Patterns

**Surdo Pattern (The Heartbeat)**
```javascript
stack(
  // Surdo 1 (grave) - marks beat 2
  note(m("~ c1 ~ ~")).s("triangle").decay(0.3).lpf(100).gain(0.95),
  // Surdo 2 (médio) - responds on beat 1
  note(m("g1 ~ ~ ~")).s("triangle").decay(0.25).lpf(150).gain(0.85)
)
```

**Tamborim Pattern (Teleco-Teco)**
```javascript
// Classic syncopated pattern
note(m("g5 ~ g5 g5 ~ g5 g5 ~")).s("square").hpf(4000).decay(0.02).gain(0.5)
```

**Agogô Pattern (Two-Tone Bell)**
```javascript
// Alternating high/low bells
note(m("<a5 d6> ~ <d6 a5> ~")).s("sine").decay(0.1).gain(0.4)
```

**Caixa Pattern (Snare Roll)**
```javascript
// Continuous 16th notes with accents
note(m("[c4 c4 c4 c4]*4")).s("pink").hpf(2000).decay(0.03).gain(0.5)
```

**Ganzá/Shaker Pattern**
```javascript
// Fast continuous subdivision
note(m("c6*16")).s("pink").hpf(8000).decay(0.01).gain(0.3)
```

### Full Batucada Stack (Complete Escola de Samba)

```javascript
stack(
  // SURDO 1 (grave) - the deep heartbeat on beat 2
  note(m("~ c1 ~ ~")).s("triangle").decay(0.35).lpf(100).gain(0.95),
  
  // SURDO 2 (médio) - responds on beat 1
  note(m("g1 ~ ~ ~")).s("triangle").decay(0.28).lpf(150).gain(0.85),
  
  // SURDO 3 (agudo) - fill patterns
  note(m("~ ~ c2 ~")).s("square").decay(0.18).lpf(200).gain(0.7),
  
  // CAIXA (snare) - driving 16ths with dynamics
  note(m("[c4 c4 c4 c4]*4")).s("pink").hpf(2000).decay(0.03).gain(0.5),
  
  // TAMBORIM - syncopated "teleco-teco"
  note(m("g5 ~ g5 g5 ~ g5 g5 ~")).s("square").hpf(4000).decay(0.02).gain(0.45),
  
  // AGOGÔ - two-tone bell alternating
  note(m("<a5 d6> ~ <d6 a5> ~")).s("sine").decay(0.1).gain(0.35),
  
  // GANZÁ - continuous shaker
  note(m("c6*16")).s("pink").hpf(8000).decay(0.01).gain(0.25)
)
```

### Simplified Batucada (Easier to Hear)

```javascript
stack(
  // Surdo grave (boom on beat 2)
  note(m("~ c1")).s("triangle").decay(0.4).lpf(80).gain(0.95),
  
  // Surdo resposta (beat 1)
  note(m("g1 ~")).s("triangle").decay(0.3).lpf(120).gain(0.8),
  
  // Tamborim groove
  note(m("c5 ~ c5 c5")).s("square").hpf(3000).decay(0.025).gain(0.5),
  
  // Shaker constante
  note(m("c6*8")).s("pink").hpf(6000).decay(0.015).gain(0.3)
)
```

### Samba-Reggae Variation (Bahia Style)

```javascript
stack(
  // Heavy surdo pattern (more syncopated)
  note(m("c1 ~ ~ c1 ~ c1 ~ ~")).s("triangle").decay(0.35).lpf(100).gain(0.9),
  
  // Repinique calls
  note(m("~ ~ e3 ~ ~ e3 e3 ~")).s("square").decay(0.08).hpf(300).gain(0.6),
  
  // Timbal pattern
  note(m("c4*8")).s("square").hpf(1500).decay(0.04).gain(0.5),
  
  // Agogô reggae pattern
  note(m("a5 ~ a5 d6 ~ d6 a5 ~")).s("sine").decay(0.12).gain(0.4)
)
```

### Carnival Breaks (Paradinha)

```javascript
// The famous "stop" moment in batucada
stack(
  note(m("c1 c1 ~ ~")).s("triangle").decay(0.2).lpf(100).gain(1),
  note(m("c4 c4 c4 ~")).s("pink").hpf(2000).decay(0.03).gain(0.7),
  note(m("g5 g5 g5 ~")).s("square").hpf(4000).decay(0.02).gain(0.5)
).slow(2)
```

### Keywords for AI Detection
When user mentions: "batucada", "samba", "brazilian", "carnival", "escola de samba", "surdo", "tamborim", "agogô", "rio", "brazil drums", "feel the rhythm", "ANNA", "Vintage Culture", "techno samba", "afro house" → Generate this Peak Time Techno + Afro-Brazilian fusion pattern.

---

### Peak Time Techno + Afro-Brazilian Fusion (Style: ANNA x Vintage Culture - "Feel The Rhythm")

The definitive batucada pattern for this app. Combines industrial Peak Time Techno (128 BPM) with authentic Brazilian batucada percussion. Key: **C minor**.

**DRUMS (Industrial Kick + Brazilian Percussion):**
```javascript
stack(
  // Industrial 4/4 Kick - deep, punchy
  note(m("c1*4")).s("square").decay(0.12).lpf(100).gain(1),
  // Clap/Snare on 2 and 4
  note(m("~ c3 ~ c3")).s("square").hpf(800).decay(0.06).room(0.15).gain(0.7),
  // Surdo (Brazilian bass drum) - responds on beat 2
  note(m("~ g1 ~ ~")).s("triangle").decay(0.25).lpf(180).gain(0.8),
  // Tamborim - syncopated Brazilian rhythm
  note(m("c5 ~ c5 c5 ~ c5 c5 ~")).s("pink").hpf(4000).decay(0.02).gain(0.35),
  // 16th Hi-hats - driving techno pulse
  note(m("c6*16")).s("pink").hpf(8000).decay(0.015).gain(0.25),
  // Tribal Toms - fills and accents
  note(m("~ ~ c3 ~ ~ c3 ~ c3")).s("triangle").decay(0.1).lpf(400).gain(0.45).room(0.2)
)
```

**BASS (Dark Rolling C Minor with Filter Sweep):**
```javascript
note(m("c2 c2 ~ c2 eb2 ~ c2 ~")).s("sawtooth").lpf(sine.range(300, 900).slow(8)).decay(0.15).gain(0.75)
```

**MELODY (Minor Chord Stab with Delay):**
```javascript
note(m("<c4 eb4 g4> ~ ~ ~")).s("square").decay(0.08).hpf(500).room(0.3).delay(0.2).gain(0.4).slow(2)
```

**FX (Vowel Chant - "Magalenha" vibe):**
```javascript
note(m("<c4 g4> <eb4 c4>")).s("sawtooth").vowel("a").decay(0.4).room(0.6).gain(0.3).slow(4)
```

**COMPLETE PATTERN (all layers):**
```javascript
stack(
  // Drums
  note(m("c1*4")).s("square").decay(0.12).lpf(100).gain(1),
  note(m("~ c3 ~ c3")).s("square").hpf(800).decay(0.06).room(0.15).gain(0.7),
  note(m("~ g1 ~ ~")).s("triangle").decay(0.25).lpf(180).gain(0.8),
  note(m("c5 ~ c5 c5 ~ c5 c5 ~")).s("pink").hpf(4000).decay(0.02).gain(0.35),
  note(m("c6*16")).s("pink").hpf(8000).decay(0.015).gain(0.25),
  note(m("~ ~ c3 ~ ~ c3 ~ c3")).s("triangle").decay(0.1).lpf(400).gain(0.45).room(0.2),
  // Bass
  note(m("c2 c2 ~ c2 eb2 ~ c2 ~")).s("sawtooth").lpf(sine.range(300, 900).slow(8)).decay(0.15).gain(0.75),
  // Melody stab
  note(m("<c4 eb4 g4> ~ ~ ~")).s("square").decay(0.08).hpf(500).room(0.3).delay(0.2).gain(0.4).slow(2),
  // Vowel chant FX
  note(m("<c4 g4> <eb4 c4>")).s("sawtooth").vowel("a").decay(0.4).room(0.6).gain(0.3).slow(4)
)
```

---

## 18. Resources

- [Official Docs](https://strudel.cc/)
- [Getting Started](https://strudel.cc/workshop/getting-started/)
- [Technical Manual](https://strudel.cc/technical-manual/)
- [Pattern Reference](https://strudel.cc/learn/factories/)
- [Awesome Strudel](https://github.com/terryds/awesome-strudel)

