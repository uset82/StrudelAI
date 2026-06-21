# 🎤 Voice & Effects Guide for AETHER

## 🗣️ Adding Voices

### 1. **Formant Synthesis (Vowel Sounds)**
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

### 2. **Vocoder-Style Effects**
Simulate a vocoder using noise and band-pass filters:

```javascript
// Moving vocoder
note(m("c3*8")).s("noise").bandf(sine.range(400, 2000)).gain(0.5)

// Rhythmic vocoder
note(m("c3 ~ e3 ~ g3 ~")).s("noise").bandf(800).resonance(10).gain(0.6)
```

### 3. **Vocal Sample Chopping** (Advanced)
If you load vocal samples, you can chop and manipulate them:

```javascript
// Vocal chops (requires sample loading)
s("vocal:0").chop(16).fast(2).room(0.5)

// Granular vocal texture
s("vocal:0").striate(4).speed(0.5).room(0.8)

// Pitched vocal
s("vocal:0").note("c3 e3 g3").loopAt(2).room(0.4)
```

---

## 🎛️ Effects Catalog

### **Filters**
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

### **Distortion & Saturation**
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

### **Modulation Effects**
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

### **Spatial Effects**
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

### **Dynamics**
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

### **Sample Manipulation**
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

---

## 🎵 Effect Combinations (Presets)

### **Robot Voice**
```javascript
note(m("c4 e4 g4")).s("square")
  .vowel("o").crush(4).lpf(800).room(0.3)
```

### **Space Pad**
```javascript
note(m("c4,e4,g4")).s("sawtooth").slow(4)
  .room(0.9).delay(0.5).lpf(1200).chorus(0.6)
```

### **Acid Bassline**
```javascript
note(m("c2 ~ eb2 ~ f2 ~")).s("triangle")
  .lpf(sine.range(200, 1500)).resonance(15).acidenv(0.8)
```

### **Lo-Fi Drums**
```javascript
note(m("c3*4")).s("square").decay(0.05)
  .crush(6).hpf(100).room(0.2)
```

### **Ethereal Choir**
```javascript
note(m("c4,e4,g4,b4")).s("sawtooth").slow(8)
  .vowel("a").room(0.95).delay(0.3).lpf(2000).gain(0.6)
```

### **Glitchy Lead**
```javascript
note(m("c5 e5 g5*2")).s("square").fast(2)
  .chop(16).crush(8).phaser(6).delay(0.25).room(0.4)
```

### **Sub Bass**
```javascript
note(m("c1 ~ ~ ~")).s("sine")
  .gain(1.2).lpf(80).shape(0.3)
```

### **Retro Synth**
```javascript
note(m("c4 e4 g4 b4")).s("square")
  .coarse(1).crush(8).delay(0.25).room(0.3).lpf(1500)
```

---

## 🎯 How to Request Effects from AI

You can now ask the AI directly:

- **"Add a robot voice melody"**
- **"Make the bass sound lo-fi"**
- **"Add a choir pad with reverb"**
- **"Create a phaser effect on the lead"**
- **"Add a vocoder-style texture"**

The AI now knows about all these effects and will use them appropriately!

---

## 🔊 Testing Effects

Try these commands in the app:

1. **"Make a melody with vowel sounds"**
2. **"Add a phaser effect to the drums"**
3. **"Create a lo-fi beat with bit crusher"**
4. **"Add a choir pad with lots of reverb"**
5. **"Make a robot voice pattern"**

All effects are now available! 🎉
