Strudel Code & Audio Validation Agent

Y no, Codex/Cursor no debería crear todo desde cero. Lo más inteligente es hacer un sistema modular usando repositorios existentes.

No encontré un solo repo que haga exactamente:
“AI → Strudel code → pre-validation → audio render → post-validation → correction loop”.
Pero sí encontré repositorios muy cercanos que se pueden combinar.

1. Repositorios que conviene usar / forkear
A. Base principal: Strudel + MCP
1. williamzujkowski/live-coding-music-mcp

Este es el más importante para tu proyecto. Es el que se acerca a la idea de un LLM conectado con Strudel mediante MCP. El repo es público y su clone URL aparece como:

git clone https://github.com/williamzujkowski/live-coding-music-mcp.git

Es el candidato principal para actuar como base del backend MCP de AETHER.

Uso dentro de tu app:

Controlar Strudel desde la IA.
Usar tools MCP para generar patrones.
Servir como base para agregar un nuevo agente:
StrudelCodeAudioValidationAgent.
2. tidalcycles/strudel

Este es el repositorio oficial/histórico de Strudel en GitHub, pero aparece como archived, así que yo no lo usaría como base principal de desarrollo, sino como referencia para entender estructura, lenguaje, parser, samples y runtime.

git clone https://github.com/tidalcycles/strudel.git

Uso dentro de tu app:

Referencia para gramática Strudel.
Entender cómo funcionan note(), s(), bank(), n(), scale(), trans(), etc.
Extraer ideas para construir el validador sintáctico.
B. Audio-to-MIDI / detección de notas
3. spotify/basic-pitch-ts

Este es muy importante porque está en TypeScript, perfecto para una app web / Node / Next.js. El repo es público y su clone URL aparece como:

git clone https://github.com/spotify/basic-pitch-ts.git

Uso dentro de tu app:

Convertir audio renderizado por Strudel en notas/MIDI.
Verificar si note("c d eb f") realmente produjo notas cercanas a C, D, Eb, F.
Crear el módulo audioToMidiValidator.
4. spotify/basic-pitch

Versión Python oficial/base de Basic Pitch. Es más pesada, pero puede servir como backend de análisis si necesitas mejor control fuera del navegador.

git clone https://github.com/spotify/basic-pitch.git

Uso dentro de tu app:

Servicio externo Python para análisis más serio.
Batch validation: renderizar 1–2 compases y analizar si las notas son correctas.
Mejor para pruebas offline que para tiempo real.
5. DamRsn/NeuralNote

NeuralNote es muy interesante como referencia porque se enfoca en audio-to-MIDI y corrección/representación musical. El repo público aparece aquí:

git clone https://github.com/DamRsn/NeuralNote.git

Uso dentro de tu app:

Inspiración para convertir audio real en notas.
Referencia para cuantización, pitch bends y detección musical.
Probablemente no sea lo primero que integraría, pero sí lo estudiaría.
C. Análisis de frecuencia, espectro, RMS, energía
6. meyda/meyda

Este es excelente para el navegador porque analiza audio con JavaScript. El repo público aparece como:

git clone https://github.com/meyda/meyda.git

Uso dentro de tu app:

Detectar RMS/loudness.
Detectar spectral centroid.
Detectar brillo, energía, MFCC, etc.
Validar drums por perfil de frecuencia:
Kick = baja frecuencia fuerte.
Hi-hat = alta frecuencia/noise.
Snare/clap = transiente + medios/agudos.

Este debería ser parte del Post-execution Audio Validation.

7. aubio/aubio

Aubio es una biblioteca clásica para detección de pitch, onset, tempo y beat. El repo público aparece como:

git clone https://github.com/aubio/aubio.git

Uso dentro de tu app:

Detectar onsets/transientes.
Detectar tempo.
Detectar pitch.
Verificar si el patrón rítmico realmente tiene eventos donde debería.
8. qiuxiang/aubiojs

Si quieres mantenerlo más JavaScript/browser-friendly, este wrapper de aubio en JS puede ser útil:

git clone https://github.com/qiuxiang/aubiojs.git

Uso dentro de tu app:

Versión JS/WASM-like para pitch/onset/tempo.
Puede ser más fácil de integrar con Next.js/Node que compilar aubio puro.
9. peterkhayes/pitchfinder

Pitchfinder es una opción ligera para detección de pitch en JavaScript:

git clone https://github.com/peterkhayes/pitchfinder.git

Uso dentro de tu app:

Detección rápida de frecuencia fundamental.
Validación simple de notas monofónicas.
Útil para piano simple, cello, bass, voice lead, guitar melody.
2. Mi recomendación realista

No forks todo. Usa esta combinación:

Fork principal
git clone https://github.com/williamzujkowski/live-coding-music-mcp.git

Encima de ese repo agregas tu agente:

src/agents/StrudelCodeAudioValidationAgent/
Librerías / módulos que integras

Para el MVP:

spotify/basic-pitch-ts
meyda/meyda
peterkhayes/pitchfinder

Para versión avanzada:

aubio/aubio
qiuxiang/aubiojs
DamRsn/NeuralNote
3. Arquitectura del agente
Gemini / AI model
        ↓
Generated Strudel code
        ↓
Strudel Code & Audio Validation Agent
        ↓
1. Pre-code validation
2. Instrument registry validation
3. Sample registry validation
4. Scale/note validation
5. Render/capture short audio preview
6. Audio analysis validation
7. Correction report
        ↓
Approved code → Strudel MCP → Strudel engine
Rejected code → AI receives correction request
4. Skills del agente

El agente debería tener estas skills:

Skill 1 — parseStrudelCode

Extrae intención musical desde el código:

note("c d eb f").s("cello")
s("bd sd hh*8").bank("RolandTR909").n("0 1 2 3")

Debe extraer:

{
  "notes": ["c", "d", "eb", "f"],
  "sound": "cello",
  "samples": ["bd", "sd", "hh"],
  "bank": "RolandTR909",
  "sampleIndexes": [0, 1, 2, 3]
}
Skill 2 — validateMusicalSyntax

Revisa:

note()
s()
bank()
n()
scale()
trans()
tempo
efectos
mini-notation básica
Skill 3 — validateNotesAgainstScale

Ejemplo:

Usuario pidió:

C minor cello melody

AI genera:

note("c d e f").s("cello")

El agente detecta:

{
  "approved": false,
  "error": "E natural is outside C minor. Use Eb.",
  "suggestedPatch": "note('c d eb f').s('cello')"
}
Skill 4 — validateInstrumentIntent

Ejemplo:

Usuario pidió:

hard techno kick

AI genera:

s("sd*4")

El agente responde:

{
  "approved": false,
  "error": "User requested kick but AI generated snare.",
  "suggestedPatch": "s('bd*4')"
}
Skill 5 — validateSampleMap

Revisa:

Si bd, sd, hh, cp, oh, rim, etc. existen.
Si el banco existe.
Si el índice n() está dentro del rango.
Si el índice está fuera, advertir o normalizar.

Ejemplo:

s("hh*8").bank("RolandTR909").n("0 1 2 3 4 5")

Resultado:

{
  "warning": "Sample indexes 4 and 5 may wrap around if the bank only has 4 variants.",
  "normalizedIndexes": [0, 1, 2, 3, 0, 1]
}
Skill 6 — renderPreviewAndAnalyze

Después de validar el código, renderiza/captura 1–2 compases y analiza el audio con:

Basic Pitch TS para notas/MIDI.
Meyda para RMS, brillo, espectro.
Pitchfinder para frecuencia fundamental.
Aubio/aubiojs para onset, beat, tempo.
Skill 7 — compareExpectedVsDetectedAudio

Ejemplo para piano/cello:

{
  "expectedNotes": ["C4", "D4", "Eb4", "F4"],
  "detectedNotes": ["C4", "D4", "E4", "F4"],
  "approved": false,
  "reason": "Detected E natural, expected Eb."
}

Ejemplo para drums:

{
  "expected": "kick",
  "detectedProfile": {
    "bassEnergy": 0.12,
    "highEnergy": 0.88
  },
  "approved": false,
  "reason": "Sound profile looks more like hi-hat/noise than kick."
}
5. Prompt listo para Cursor / Codex

Copia esto directamente:

Create a new agent called StrudelCodeAudioValidationAgent.

Do not build everything from scratch. Reuse and integrate existing open-source projects where possible.

Primary repo/reference:
- williamzujkowski/live-coding-music-mcp for Strudel MCP integration.
- tidalcycles/strudel only as reference for Strudel syntax/runtime concepts.

Audio/music validation libraries to prepare or integrate:
- spotify/basic-pitch-ts for TypeScript audio-to-MIDI / note detection.
- spotify/basic-pitch as optional Python backend service for heavier audio transcription.
- meyda/meyda for browser/Node audio feature extraction: RMS, spectral centroid, MFCC, loudness, energy.
- aubio/aubio or qiuxiang/aubiojs for pitch, onset, tempo and beat detection.
- peterkhayes/pitchfinder for lightweight JavaScript pitch detection.
- DamRsn/NeuralNote as reference for audio-to-MIDI and note quantization workflows.

Goal:
Prevent AI-generated Strudel code from going directly to the live audio engine without validation.

Implement a validation pipeline:

1. Pre-execution validation:
- Parse generated Strudel code.
- Extract note() values, s() sample names, bank() values, n() indexes, scale(), trans(), tempo and FX chains.
- Validate syntax and semantic correctness.
- Convert note names to MIDI and frequency values.
- Validate that notes fit the requested scale/key.
- Validate that notes are inside the expected range for the chosen instrument.
- Validate sample aliases and banks.
- Validate instrument intent:
  - piano/cello/guitar should use pitched note() patterns.
  - drums should use s() sample patterns.
  - kick should prefer bd.
  - snare should prefer sd.
  - closed hi-hat should prefer hh.
  - clap should prefer cp.

2. Instrument Registry:
Create an internal registry with:
- pitched instruments: piano, cello, guitar, synth, bass, lead, pad
- drum categories: kick, snare, clap, closed-hihat, open-hihat, tom, ride, crash, percussion
Each entry should include:
- type: pitched | drum | noise | fx | loop
- allowed note range if pitched
- expected frequency profile if drum/noise
- valid Strudel aliases
- validation method: pitch | transient | spectrum | sample-map

3. Post-execution audio validation:
- Render or capture a short Strudel preview, 1–2 bars.
- Analyze the audio.
- For pitched instruments:
  - detect pitch/fundamental frequencies
  - convert frequencies to note names
  - compare detected notes with expected note() values
  - check tuning/cents deviation
  - check key/scale correctness
- For drums:
  - detect onsets/transients
  - analyze spectrum
  - verify kick = low-frequency energy
  - verify hi-hat = high-frequency noisy energy
  - verify snare/clap = mid/high transient profile

4. Correction engine:
If validation fails:
- Do not approve the code.
- Return a structured JSON error to the AI.
- Ask the AI to patch only the incorrect part.

Output JSON format:

Approved:
{
  "approved": true,
  "confidence": 0.92,
  "code": "note('c d eb f').s('cello')",
  "warnings": [],
  "analysis": {
    "expectedNotes": ["C", "D", "Eb", "F"],
    "detectedNotes": ["C", "D", "Eb", "F"],
    "scale": "C minor",
    "instrument": "cello"
  }
}

Rejected:
{
  "approved": false,
  "confidence": 0.61,
  "errors": [
    {
      "type": "scale_error",
      "message": "E natural is outside C minor. Use Eb instead.",
      "suggestedPatch": "replace E with Eb"
    }
  ]
}

Important:
The AI must only send code to the live Strudel MCP engine after StrudelCodeAudioValidationAgent approves it.
6. Mi decisión técnica

Para tu proyecto AETHER, yo haría esto:

Fork principal: williamzujkowski/live-coding-music-mcp.
Agregar agente propio: StrudelCodeAudioValidationAgent.
Integrar primero: basic-pitch-ts, meyda, pitchfinder.
Después integrar: aubiojs o aubio para tempo/onsets.
Mantener NeuralNote como referencia avanzada, no como dependencia principal al inicio.

Así AETHER tendría algo muy poderoso:

Gemini crea la idea.
Strudel MCP ejecuta.
Strudel Code & Audio Validation Agent verifica.
Audio analysis confirma.
La IA corrige antes de sonar mal.