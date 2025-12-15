# Strudel Comprehensive Knowledge Base

## Mini-Notation Syntax Reference

### Basic Structure
```javascript
note("c3 e3 g3")  // Three notes in sequence
note("c3 ~ e3 ~")  // ~ = rest/silence
note("c3*4")        // * = repeat (c3 c3 c3 c3)
```

### Subdivision with Brackets [ ]
```javascript
note("e5 [b4 c5] d5 e5")         // [b4 c5] plays in time of one note
note("e5 [b4 c5] d5 [c5 b4]")    // Multiple subdivisions
note("e5 [b4 c5] d5 [c5 b4 [d5 e5]]")  // Nested subdivisions
```

### Angle Brackets < > (Slower Sequences)
```javascript
note("<e5 b4 d5 c5>")      // Each note takes one cycle
note("<e5 b4 d5 c5>*2")    // Play 2 notes per cycle
```

### Multiplication and Division
```javascript
note("[e5 b4 d5 c5]*2")    // 2x faster
note("[e5 b4 d5 c5]/2")    // 2x slower (spans 2 cycles)
note("[e5 b4 d5 c5]*2.75") // Decimal multipliers work too
```

### Chords (Comma Separator)
```javascript
note("<[g3,b3,e4] [a3,c3,e4] [b3,d3,f#4]>")   // Chord progression
```

### Elongation with @
```javascript
note("<[g3,b3,e4]@2 [a3,c3,e4] [b3,d3,f#4]>")  // First chord 2x longer
```

### Replication with !
```javascript
note("<[g3,b3,e4]!2 [a3,c3,e4]>")  // Repeat without speeding up
```

### Randomness
```javascript
note("[g3,b3,e4]*8?")       // 50% chance of removal
note("[g3,b3,e4]*8?0.1")    // 10% chance of removal
note("[g3,b3,e4] | [a3,c3,e4] | [b3,d3,f#4]")  // Random choice
```

## Pattern Functions

### Core Functions
```javascript
note("c3 e3 g3")           // Play notes
s("triangle")              // Set sound/synth
stack(pattern1, pattern2)  // Layer patterns
```

### Effects
```javascript
.gain(0.8)                 // Volume (0.0 - 1.0)
.decay(0.1)                // Envelope decay time
.sustain(0.3)              // Envelope sustain
.release(0.2)              // Envelope release
.lowpass(500)              // Low-pass filter (Hz)
.highpass(2000)            // High-pass filter (Hz)
.resonance(10)             // Filter resonance
.room(0.8)                 // Reverb amount
.roomsize(10)              // Reverb size
.delay(0.5)                // Delay effect
```

### Time Modifiers
```javascript
.slow(2)                   // 2x slower
.fast(2)                   // 2x faster
.early(0.1)                // Shift earlier
.late(0.1)                 // Shift later
```

### Pitch Modifiers
```javascript
.transpose(7)              // Transpose semitones
.detune(-5)                // Detune in cents
```

## Real-World Examples

### Techno Beat
```javascript
stack(
  note("c3*4").s("square").decay(0.05).fast(2),     // Kick
  note("c5*8").s("square").decay(0.02).gain(0.3),   // Hi-hat
  note("c2 ~ c2 ~").s("triangle").sustain(0.2)      // Bass
)
```

### House Groove
```javascript
stack(
  note("c3 ~ c3 ~").s("square").decay(0.05).gain(1),        // Kick
  note("~ c4 ~ c4").s("square").decay(0.1).gain(0.8),       // Snare
  note("c5*8").s("square").decay(0.02).gain(0.4),           // Hi-hat
  note("c2 g1 c2 g1").s("triangle").sustain(0.2).gain(0.7") // Bass
)
```

### Melodic Pattern
```javascript
stack(
  note("<c4 e4 g4 b4>").s("sawtooth").slow(2),  // melody
  note("<c3 g2>").s("triangle").sustain(0.5)    //  bass
)
```

### Using Subdivisions
```javascript
note("c3 [e3 g3] b3 [a3 c4 e4]").s("square")
```

## Advanced Patterns

### Euclidean Rhythms
```javascript
note("c3(3,8)").s("square")     // 3 hits distributed in 8 steps
note("c3(5,8,2)").s("square")   // 5 hits in 8 steps, offset by 2
```

### Layered Drum Pattern
```javascript
stack(
  note("c3 ~ c3 [~ c3]").s("square").decay(0.05),       // Kick
  note("~ c4 [~ c4] c4").s("square").decay(0.1),        // Snare
  note("[c5*4] [c5*3] [c5*4] [c5*5]").s("square").decay(0.02).gain(0.5)  // Hi-hat variations
)
```

## Advanced Features (from Live Coding Examples)

### Multi-Line Patterns with $:
```javascript
$: note("<0 4 0 9 7>*16").scale('g:minor').trans(-12)
.o(3).s("sawtooth").acidenv(0.8)

$: note("-7 _ _ 6 5 _ <5 3> <6 4>>*2").scale("g:minor").trans(-24)
.detune(rand).o(4).s("supersaw")
```

### Musical Scales
```javascript
note("0 2 4 5 7").scale('g:minor')      // G minor scale
note("<0 4 0 9 7>").scale('c:major')    // C major scale
.trans(-12)                              // Transpose down octave
.trans(7)                                // Transpose up perfect fifth
```

### Pattern Operations
```javascript
note("<0 4 0 9>").add("-7 _ _ 6 5")     // Add patterns together
note("c3 e3").sub(2)                     // Subtract from pattern
```

### Advanced Synthesis
```javascript
.acidenv(0.8)              // Acid-style envelope (TB-303 style)
.detune(rand)              // Random detuning
.att(0.4)                  // Attack time
.duckdepth(0.8)            // Ducking depth
.duck("3:4:5:6")           // Sidechain ducking
```

### Interactive Controls
```javascript
.acidenv(slider(0.5))      // Interactive slider control
```

### Visualization
```javascript
._pianoroll()              // Show piano roll visualization
```

### Output Routing
```javascript
.o(3)                      // Route to output 3
.o(5)                      // Route to output 5
```

## Common Patterns from Live Coding

### Trance Lead
```javascript
note("<0 4 0 9 7>*16").scale('g:minor').trans(-12)
.o(3).s("sawtooth").acidenv(0.8).delay(0.4)
```

### Bass with Supersaw
```javascript
note("-7 _ _ 6 5 _ <5 3> <6 4>>*2").scale("g:minor").trans(-24)
.detune(rand).o(4).s("supersaw").acidenv(1)
```

### Pattern Addition
```javascript
note("<0 4 0 9 7>*16").add("-7 _ _ 6 5 _ _ 6>*2")
.scale("g:minor").s("sawtooth")
```
