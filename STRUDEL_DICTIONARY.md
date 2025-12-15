# 📖 STRUDEL QUICK REFERENCE DICTIONARY

*Fast lookup guide for sounds, effects, synths, and patterns*

---

## 🎹 SYNTHS & WAVEFORMS

### Basic Waveforms
Use with `.s()` or `.sound()`:

| Waveform | Sound Character | Use Case |
|----------|----------------|----------|
| `sine` | Smooth, pure tone | Sub-bass, smooth pads |
| `triangle` | Soft, mellow | Bass lines, warm leads |
| `sawtooth` | Bright, rich harmonics | Leads, basses, brass |
| `square` | Hollow, video-game like | Retro sounds, arpeggios |
| `supersaw` | Thick, wide, lush | EDM super leads, pads |

**Example:**
```javascript
note(m("c3 e3 g3")).s("sawtooth")
```

**Default:** If you use `note()` without `.s()`, default is `triangle`!

---

### Noise Types

| Type | Character | Use Case |
|------|-----------|----------|
| `white` | Harsh, bright | Cymbals, aggressive hi-hats |
| `pink` | Softer, more natural | Softer hi-hats, snares |
| `brown` | Warm, gentle | Ambient textures, soft effects |
| `crackle` | Vinyl-like noise | Lo-fi textures |

**Example:**
```javascript
// Hi-hat with pink noise
s("pink*8").decay(0.04).gain(0.6)

// Add noise to any oscillator
note(m("c3")).s("square").noise(0.25)

// Crackle effect
s("crackle*4").density(0.2)
```

---

### Advanced Synths

| Synth | Description |
|-------|-------------|
| `fm` | FM synthesis (complex tones) |
| `piano` | Piano-like sound |
| `gm_*` | General MIDI instruments |

---

## 🎵 NOTE SYSTEMS

### Letter Notation
```javascript
note("c e g")      // Notes in current octave
note("c3 e3 g3")   // Notes with octave (3 = middle octave)
note("c4 e4 g4")   // Higher octave
note("c2 e2 g2")   // Lower octave
note("c# d# f#")   // Sharps
note("db eb gb")   // Flats
```

### Number Notation (MIDI)
```javascript
note("48 52 55")   // MIDI note numbers
note("60")         // Middle C (C4)
```

### Mini-Notation (m)
```javascript
note(m("c3 e3 g3")) // Preferred way - cleaner syntax
```

---

## 🎛️ MINI-NOTATION OPERATORS

### Speed & Rhythm

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `*N` | Multiply/Speed up | `"c3*4"` | Play c3 four times per cycle |
| `/N` | Divide/Slow down | `"c3/2"` | Play c3 every two cycles |
| `~` | Rest | `"c3 ~ e3 ~"` | c3, silence, e3, silence |

### Grouping & Structure

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `[a b c]` | Subdivision | `"[c3 e3 g3]"` | Play all 3 in time of 1 |
| `<a b c>` | Alternation | `"<c3 e3 g3>"` | Different note each cycle |
| `,` | Chord/Stack | `"[c3,e3,g3]"` | Play all simultaneously |
| `.` | Continuation | `"c3 . e3 ."` | Hold previous value |

### Special Patterns

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `@N` | Elongate | `"c3@3 e3"` | c3 takes 3x the time |
| `!N` | Replicate | `"c3!4"` | Repeat without speeding up |
| `?` | Random | `"c3?"` | 50% chance of playing |
| `(N,M)` | Euclidean | `"c3(3,8)"` | 3 hits spread over 8 steps |

**Examples:**
```javascript
// Fast hi-hats
sound("hh*8")

// Subdivided kicks
sound("bd [bd bd] bd bd")

// Alternating snare
sound("~ <sn:1 sn:2> ~ <sn:3 sn:4>")

// Chord stab
note("[c3,e3,g3,b3]")
```

---

## 🔊 EFFECTS REFERENCE

### Filters

| Effect | Parameters | Example | Description |
|--------|-----------|---------|-------------|
| `.lpf(freq)` `.lowpass(freq)` | 20-20000 Hz | `.lpf(800)` | Low-pass filter (cuts highs) |
| `.hpf(freq)` `.highpass(freq)` | 20-20000 Hz | `.hpf(200)` | High-pass filter (cuts lows) |
| `.bandf(freq)` | 20-20000 Hz | `.bandf(1000)` | Band-pass filter (keeps midrange) |
| `.resonance(Q)` | 0-30 | `.lpf(500).resonance(10)` | Filter resonance/emphasis |

**Dynamic Filter Sweep:**
```javascript
.lpf(sine.range(200, 2000)) // Automated sweep
```

---

### Distortion & Saturation

| Effect | Range | Example | Description |
|--------|-------|---------|-------------|
| `.crush(bits)` | 1-16 | `.crush(6)` | Bit crusher (lo-fi effect) |
| `.shape(amt)` | 0-1 | `.shape(0.5)` | Waveshaping distortion |
| `.distort(amt)` | 0-1 | `.distort(0.7)` | Distortion |
| `.coarse(steps)` | 1-12 | `.coarse(2)` | Pitch quantization (stepped) |

---

### Modulation Effects

| Effect | Parameters | Example | Description |
|--------|----------|---------|-------------|
| `.phaser(rate)` | 0-10 | `.phaser(4)` | Swooshing phase effect |
| `.chorus(amt)` | 0-1 | `.chorus(0.5)` | Thickens sound |
| `.tremolo(rate)` | 0-20 Hz | `.tremolo(8)` | Amplitude modulation |
| `.leslie(rate)` | 0-10 | `.leslie(5)` | Rotary speaker effect |
| `.vibrato()` `.detune()` | Various | `.detune(sine.slow(4))` | Pitch vibrato |

---

### Spatial Effects

| Effect | Parameters | Example | Description |
|--------|----------|---------|-------------|
| `.room(amt)` | 0-5 | `.room(0.8)` | Reverb amount |
| `.roomsize(size)` | 0-20 | `.roomsize(10)` | Reverb size |
| `.delay(amt)` | 0-1 | `.delay(0.5)` | Simple delay |
| `.delay("vol:time:fb")` | String | `.delay("0.8:0.125:0.6")` | Delay with feedback |
| `.pan(pos)` | 0-1 | `.pan(0.5)` | Stereo pan (0=L, 1=R) |
| `.pan(signal)` | Pattern | `.pan(sine.slow(4))` | Auto-pan |

---

### Envelope (ADSR)

| Parameter | Range | Description |
|-----------|-------|-------------|
| `.att(time)` `.attack(time)` | 0-1 | Fade-in time |
| `.decay(time)` | 0-1 | Time to reach sustain level |
| `.sustain(level)` | 0-1 | Hold level |
| `.release(time)` | 0-1 | Fade-out time |

**Short notation:**
```javascript
.adsr("0.1:0.1:0.5:0.2") // attack:decay:sustain:release
```

**Example:**
```javascript
note("c3").s("sawtooth")
  .attack(0.01)
  .decay(0.1)
  .sustain(0.5)
  .release(0.3)
```

---

### Dynamics

| Effect | Example | Description |
|--------|---------|-------------|
| `.gain(vol)` | `.gain(0.8)` | Volume (0-1+) |
| `.duck(pattern)` | `.duck("3:4:5:6")` | Sidechain ducking |
| `.duckdepth(amt)` | `.duckdepth(0.8)` | Ducking amount |

---

### Sample Manipulation

| Effect | Parameters | Example | Description |
|--------|----------|---------|-------------|
| `.speed(rate)` | -4 to 4 | `.speed(2)` | Playback speed (2x = up octave) |
| `.loopAt(cycles)` | 1-16 | `.loopAt(2)` | Loop sample over N cycles |
| `.chop(pieces)` | 2-64 | `.chop(16)` | Chop into segments |
| `.slice(N, "pat")` | Various | `.slice(8, "0 2 4")` | Select specific slices |
| `.striate(grains)` | 2-32 | `.striate(4)` | Granular synthesis |

---

### Voice Effects

| Effect | Example | Description |
|--------|---------|-------------|
| `.vowel("a e i o u")` | `.vowel("a e i")` | Formant filter (vocal-like) |

---

## 🎼 COMMON PATTERNS

### Drum Patterns

```javascript
// Four-on-the-floor (House/Techno)
s("bd*4")

// Classic house beat
s("bd*4, ~ cp ~ cp, [~ hh]*4")

// Breakbeat
s("bd ~ sn ~, hh*8")

// Hip-hop
s("bd ~ ~ ~ sn ~ ~ ~, hh*8")
```

### Bass Patterns

```javascript
// Minimal techno bass
note(m("c2 ~ c2 ~")).s("triangle")

// Groovy bass
note(m("c2 ~ eb2 ~ f2 ~ g2 ~")).s("sawtooth").lpf(400)

// Sub bass
note(m("c1 ~ ~ ~")).s("sine").gain(1.2)
```

### Melody Patterns

```javascript
// Simple arpeggio
note(m("c4 e4 g4 b4")).s("square")

// Chord stabs
note(m("[c4,e4,g4] ~ ~ ~")).s("sawtooth")

// Alternating melody
note(m("<c4 e4 g4 c5>")).s("sine")
```

---

## 🎚️ TEMPO & TIMING

### Set Tempo
```javascript
setcpm(90/4)  // 90 BPM in 4/4 time
setcpm(120/4) // 120 BPM in 4/4 time

// Note: CPM = Cycles Per Minute
// For 4/4 time: cpm = bpm / 4
```

### Speed Modifiers

| Method | Example | Effect |
|--------|---------|--------|
| `.fast(n)` | `.fast(2)` | 2x speed |
| `.slow(n)` | `.slow(2)` | 0.5x speed |
| `.early(offset)` | `.early(0.25)` | Play early |
| `.late(offset)` | `.late(0.25)` | Play late |

---

## 🎨 EFFECT PRESETS (Copy-Paste Ready)

### Robot Voice
```javascript
note(m("c4 e4 g4")).s("square").vowel("o").crush(4).lpf(800).room(0.3)
```

### Ethereal Choir
```javascript
note(m("c4,e4,g4,b4")).s("sawtooth").slow(8).vowel("a").room(0.95).delay(0.3).lpf(2000).gain(0.6)
```

### Acid Bassline
```javascript
note(m("c2 ~ eb2 ~ f2 ~")).s("triangle").lpf(sine.range(200, 1500)).resonance(15).acidenv(0.8)
```

### Lo-Fi Drums
```javascript
note(m("c3*4")).s("square").decay(0.05).crush(6).hpf(100).room(0.2)
```

### Sub Bass
```javascript
note(m("c1 ~ ~ ~")).s("sine").gain(1.2).lpf(80).shape(0.3)
```

### Space Pad
```javascript
note(m("c4,e4,g4")).s("sawtooth").slow(4).room(0.9).delay(0.5).lpf(1200).chorus(0.6)
```

### Glitchy Lead
```javascript
note(m("c5 e5 g5*2")).s("square").fast(2).chop(16).crush(8).phaser(6).delay(0.25).room(0.4)
```

### Retro Synth
```javascript
note(m("c4 e4 g4 b4")).s("square").coarse(1).crush(8).delay(0.25).room(0.3).lpf(1500)
```

---

## 🔁 PATTERN TRANSFORMATIONS

### Time-based

| Function | Example | Description |
|----------|---------|-------------|
| `fast(n)` | `.fast(2)` | Speed up pattern |
| `slow(n)` | `.slow(2)` | Slow down pattern |
| `rev()` | `.rev()` | Reverse pattern |
| `ply(n)` | `.ply(2)` | Repeat each event |
| `iter(n)` | `.iter(4)` | Rotate pattern |

### Structure

| Function | Example | Description |
|----------|---------|-------------|
| `jux(fn)` | `.jux(rev)` | Apply function to right channel |
| `every(n, fn)` | `.every(4, fast(2))` | Apply every N cycles |
| `sometimes(fn)` | `.sometimes(rev)` | Apply randomly (50%) |
| `chunk(n, fn)` | `.chunk(4, fast(2))` | Apply to chunks |

---

## 💡 PRO TIPS

### 1. Stack Multiple Patterns
```javascript
stack(
  note(m("c3*4")).s("square").decay(0.05),      // Kick
  note(m("~ c4 ~ c4")).s("noise").decay(0.02),  // Snare
  note(m("c5*8")).s("square").decay(0.01)       // Hi-hat
)
```

### 2. Use Variables for Reusable Patterns
```javascript
const drums = note(m("c3*4")).s("square")
const bass = note(m("c2 ~ eb2 ~")).s("triangle")
stack(drums, bass)
```

### 3. Dynamic Filter Sweeps
```javascript
.lpf(sine.range(200, 2000))    // Slow sweep
.lpf(saw.range(100, 5000))     // Sawtooth sweep
.lpf(square.range(300, 800))   // Square wave sweep
```

### 4. Sidechain Ducking (EDM Pumping)
```javascript
// Bass ducks when kick hits
note(m("c2*4")).s("triangle").duck("1 0 0 0").duckdepth(0.8)
```

### 5. Create Variation with Randomness
```javascript
note(m("c3? e3? g3?"))         // Random note removal
.gain(rand.range(0.5, 1))      // Random volume variation
.pan(rand)                      // Random panning
```

---

## 🎯 QUICK GENRE TEMPLATES

### Techno
```javascript
stack(
  note(m("c3*4")).s("square").decay(0.05).fast(2),
  note(m("c5*8")).s("square").decay(0.02).gain(0.3),
  note(m("c2 ~ g1 ~")).s("triangle").lpf(400).gain(0.8)
)
```

### House
```javascript
stack(
  note(m("c3 ~ c3 ~")).s("square").decay(0.05),
  note(m("~ c4 ~ c4")).s("square").decay(0.1),
  note(m("c5*8")).s("square").decay(0.02).gain(0.4),
  note(m("c2 g1 c2 g1")).s("triangle").sustain(0.2)
)
```

### Hip-Hop
```javascript
setcpm(90/4)
stack(
  note(m("c3 ~ ~ ~ c3 ~ ~ ~")).s("square").decay(0.1),
  note(m("~ ~ c4 ~")).s("noise").decay(0.05),
  note(m("c5*8")).s("square").decay(0.02).gain(0.3)
)
```

### Ambient
```javascript
stack(
  note(m("c4,e4,g4,b4")).s("sawtooth").slow(8).vowel("a").room(0.95).lpf(2000),
  note(m("c2 ~ ~ ~")).s("sine").slow(4).room(0.8).gain(0.6),
  s("crackle*4").density(0.05).room(0.5).gain(0.3)
)
```

---

## 📚 FREQUENTLY USED COMBINATIONS

### Clean Kick
```javascript
note(m("c3 ~ c3 ~")).s("square").decay(0.05).lpf(100).gain(1)
```

### Snappy Snare
```javascript
note(m("~ c4 ~ c4")).s("noise").decay(0.08).hpf(500).gain(0.8)
```

### Crisp Hi-Hat
```javascript
note(m("c5*8")).s("square").decay(0.02).hpf(5000).gain(0.4)
```

### Warm Bass
```javascript
note(m("c2 g1 eb2 g1")).s("triangle").lpf(300).sustain(0.3).gain(0.9)
```

### Bright Lead
```javascript
note(m("c5 e5 g5 b5")).s("sawtooth").lpf(3000).delay(0.25).room(0.3)
```

---

**Last Updated:** 2024-11-24  
**Version:** 1.0  
**For:** AETHER Sonic Interface / Strudel Live Coding

*Keep this handy while coding! 🎵*
