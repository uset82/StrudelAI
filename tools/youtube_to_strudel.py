#!/usr/bin/env python3
"""
YouTube to Strudel Code Converter
Analyzes audio from YouTube videos and generates Strudel code patterns.

Features:
- Downloads audio from YouTube
- Analyzes BPM, key, and rhythm patterns
- Detects drums, bass, and melody elements
- Generates Strudel code approximating the music

Requirements:
    pip install yt-dlp librosa numpy scipy

Usage:
    python youtube_to_strudel.py "https://www.youtube.com/watch?v=VIDEO_ID"
    python youtube_to_strudel.py "https://www.youtube.com/watch?v=VIDEO_ID" --output code.txt
    python youtube_to_strudel.py "https://www.youtube.com/watch?v=VIDEO_ID" --duration 30
"""

import argparse
import os
import sys
import tempfile
import json
from pathlib import Path

# Check dependencies
def check_dependencies():
    missing = []
    try:
        import yt_dlp
    except ImportError:
        missing.append('yt-dlp')
    try:
        import librosa
    except ImportError:
        missing.append('librosa')
    try:
        import numpy
    except ImportError:
        missing.append('numpy')
    
    if missing:
        print(f"Missing dependencies: {', '.join(missing)}")
        print(f"Install with: pip install {' '.join(missing)}")
        sys.exit(1)

check_dependencies()

import numpy as np
import librosa
import yt_dlp


# ═══════════════════════════════════════════════════════════════════════════
# AUDIO ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

class AudioAnalyzer:
    """Analyzes audio to extract musical features."""
    
    # Note name mapping
    NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    
    def __init__(self, audio_path: str, duration: float = None):
        """Load and analyze audio file."""
        print(f"Loading audio: {audio_path}")
        self.y, self.sr = librosa.load(audio_path, sr=22050, duration=duration, mono=True)
        self.duration = librosa.get_duration(y=self.y, sr=self.sr)
        print(f"Loaded {self.duration:.1f}s of audio at {self.sr}Hz")
        
    def analyze_tempo(self) -> tuple[float, np.ndarray]:
        """Detect BPM and beat frames."""
        print("Analyzing tempo...")
        tempo, beat_frames = librosa.beat.beat_track(y=self.y, sr=self.sr)
        # Handle both old and new librosa versions
        if isinstance(tempo, np.ndarray):
            tempo = float(tempo[0]) if len(tempo) > 0 else 120.0
        self.bpm = round(tempo)
        self.beat_times = librosa.frames_to_time(beat_frames, sr=self.sr)
        print(f"Detected BPM: {self.bpm}")
        return self.bpm, self.beat_times
    
    def analyze_key(self) -> tuple[str, str]:
        """Detect musical key using chroma features."""
        print("Analyzing key...")
        chroma = librosa.feature.chroma_cqt(y=self.y, sr=self.sr)
        chroma_mean = np.mean(chroma, axis=1)
        
        # Find root note
        root_idx = int(np.argmax(chroma_mean))
        root_note = self.NOTE_NAMES[root_idx]
        
        # Determine major/minor using simple heuristic
        # Check relative strength of major vs minor third
        major_third_idx = (root_idx + 4) % 12
        minor_third_idx = (root_idx + 3) % 12
        
        is_minor = chroma_mean[minor_third_idx] > chroma_mean[major_third_idx]
        mode = 'minor' if is_minor else 'major'
        
        self.key = root_note
        self.mode = mode
        print(f"Detected key: {root_note} {mode}")
        return root_note, mode
    
    def analyze_drums(self) -> dict:
        """Analyze percussive elements."""
        print("Analyzing drums...")
        
        # Separate harmonic and percussive
        y_harmonic, y_percussive = librosa.effects.hpss(self.y)
        
        # Onset detection on percussive
        onset_env = librosa.onset.onset_strength(y=y_percussive, sr=self.sr)
        onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=self.sr)
        onset_times = librosa.frames_to_time(onset_frames, sr=self.sr)
        
        # Analyze frequency bands for kick/snare/hihat
        # Low freq (kick): 60-150 Hz
        # Mid freq (snare): 150-400 Hz  
        # High freq (hihat): 5000-15000 Hz
        
        S = np.abs(librosa.stft(y_percussive))
        freqs = librosa.fft_frequencies(sr=self.sr)
        
        kick_band = (freqs >= 60) & (freqs <= 150)
        snare_band = (freqs >= 150) & (freqs <= 400)
        hihat_band = (freqs >= 5000) & (freqs <= 15000)
        
        kick_energy = np.mean(S[kick_band, :], axis=0)
        snare_energy = np.mean(S[snare_band, :], axis=0)
        hihat_energy = np.mean(S[hihat_band, :], axis=0)
        
        # Detect hits using peaks
        def detect_hits(energy, threshold_percentile=75):
            threshold = np.percentile(energy, threshold_percentile)
            peaks = librosa.util.peak_pick(energy, pre_max=3, post_max=3, pre_avg=3, post_avg=5, delta=threshold*0.5, wait=4)
            return librosa.frames_to_time(peaks, sr=self.sr)
        
        self.drum_hits = {
            'kick': detect_hits(kick_energy, 80),
            'snare': detect_hits(snare_energy, 80),
            'hihat': detect_hits(hihat_energy, 70),
        }
        
        print(f"Detected drums - Kick: {len(self.drum_hits['kick'])}, Snare: {len(self.drum_hits['snare'])}, Hihat: {len(self.drum_hits['hihat'])}")
        return self.drum_hits
    
    def analyze_bass(self) -> list:
        """Analyze bass line notes."""
        print("Analyzing bass...")
        
        # Low-pass filter for bass
        y_bass = librosa.effects.preemphasis(self.y, coef=-0.97)
        
        # Get pitch using piptrack in bass range
        pitches, magnitudes = librosa.piptrack(y=y_bass, sr=self.sr, fmin=30, fmax=300)
        
        # Extract strongest pitches over time
        bass_notes = []
        hop_length = 512
        
        for t in range(magnitudes.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            if pitch > 0:
                # Convert frequency to MIDI note
                midi_note = librosa.hz_to_midi(pitch)
                time = librosa.frames_to_time(t, sr=self.sr, hop_length=hop_length)
                bass_notes.append({
                    'time': time,
                    'midi': int(round(midi_note)),
                    'freq': pitch
                })
        
        # Quantize and deduplicate
        self.bass_notes = self._quantize_notes(bass_notes)
        print(f"Detected {len(self.bass_notes)} bass notes")
        return self.bass_notes
    
    def analyze_melody(self) -> list:
        """Analyze melody/lead notes."""
        print("Analyzing melody...")
        
        # High-pass for melody
        y_harmonic, _ = librosa.effects.hpss(self.y)
        
        # Get pitch in melody range
        pitches, magnitudes = librosa.piptrack(y=y_harmonic, sr=self.sr, fmin=200, fmax=2000)
        
        melody_notes = []
        hop_length = 512
        
        for t in range(magnitudes.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            mag = magnitudes[index, t]
            if pitch > 0 and mag > np.percentile(magnitudes[magnitudes > 0], 50):
                midi_note = librosa.hz_to_midi(pitch)
                time = librosa.frames_to_time(t, sr=self.sr, hop_length=hop_length)
                melody_notes.append({
                    'time': time,
                    'midi': int(round(midi_note)),
                    'freq': pitch
                })
        
        self.melody_notes = self._quantize_notes(melody_notes)
        print(f"Detected {len(self.melody_notes)} melody notes")
        return self.melody_notes
    
    def _quantize_notes(self, notes: list, resolution: float = 0.125) -> list:
        """Quantize notes to grid and remove duplicates."""
        if not notes:
            return []
        
        quantized = []
        last_time = -1
        last_midi = -1
        
        for note in notes:
            q_time = round(note['time'] / resolution) * resolution
            if q_time != last_time or note['midi'] != last_midi:
                quantized.append({
                    'time': q_time,
                    'midi': note['midi'],
                    'note': self._midi_to_note(note['midi'])
                })
                last_time = q_time
                last_midi = note['midi']
        
        return quantized
    
    def _midi_to_note(self, midi: int) -> str:
        """Convert MIDI number to note name."""
        octave = (midi // 12) - 1
        note_idx = midi % 12
        return f"{self.NOTE_NAMES[note_idx].lower()}{octave}"


# ═══════════════════════════════════════════════════════════════════════════
# STRUDEL CODE GENERATOR
# ═══════════════════════════════════════════════════════════════════════════

class StrudelGenerator:
    """Generates Strudel code from analyzed audio features."""
    
    def __init__(self, analyzer: AudioAnalyzer):
        self.analyzer = analyzer
        self.bpm = getattr(analyzer, 'bpm', 120)
        self.key = getattr(analyzer, 'key', 'C')
        self.mode = getattr(analyzer, 'mode', 'minor')
        
    def generate(self) -> str:
        """Generate complete Strudel code."""
        sections = []
        
        # Header comment
        sections.append(self._generate_header())
        
        # Global settings
        sections.append(self._generate_settings())
        
        # Drum pattern
        if hasattr(self.analyzer, 'drum_hits'):
            drum_code = self._generate_drums()
            if drum_code:
                sections.append(drum_code)
        
        # Bass line
        if hasattr(self.analyzer, 'bass_notes') and self.analyzer.bass_notes:
            bass_code = self._generate_bass()
            if bass_code:
                sections.append(bass_code)
        
        # Melody
        if hasattr(self.analyzer, 'melody_notes') and self.analyzer.melody_notes:
            melody_code = self._generate_melody()
            if melody_code:
                sections.append(melody_code)
        
        return '\n\n'.join(sections)
    
    def _generate_header(self) -> str:
        """Generate header comment."""
        return f"""// Generated from YouTube audio analysis
// Key: {self.key} {self.mode}
// BPM: {self.bpm}
// Duration: {self.analyzer.duration:.1f}s"""
    
    def _generate_settings(self) -> str:
        """Generate global settings."""
        return f'setcpm({self.bpm})'
    
    def _generate_drums(self) -> str:
        """Generate drum pattern from detected hits."""
        drum_hits = self.analyzer.drum_hits
        
        # Calculate beats per bar based on BPM
        beat_duration = 60.0 / self.bpm
        bar_duration = beat_duration * 4  # Assuming 4/4 time
        
        # Analyze first 4 bars to create pattern
        num_bars = min(4, int(self.analyzer.duration / bar_duration))
        
        # Quantize hits to 16th notes
        def hits_to_pattern(hits, num_bars, bar_duration):
            steps_per_bar = 16
            total_steps = num_bars * steps_per_bar
            step_duration = bar_duration / steps_per_bar
            
            pattern = ['~'] * steps_per_bar  # Single bar pattern
            hit_counts = [0] * steps_per_bar
            
            for hit_time in hits:
                if hit_time < num_bars * bar_duration:
                    bar_num = int(hit_time / bar_duration)
                    position_in_bar = (hit_time % bar_duration) / step_duration
                    step = int(round(position_in_bar)) % steps_per_bar
                    hit_counts[step] += 1
            
            # Mark positions that have hits in most bars
            threshold = max(1, num_bars // 2)
            for i, count in enumerate(hit_counts):
                if count >= threshold:
                    pattern[i] = 'x'
            
            return pattern
        
        kick_pattern = hits_to_pattern(drum_hits['kick'], num_bars, bar_duration)
        snare_pattern = hits_to_pattern(drum_hits['snare'], num_bars, bar_duration)
        hihat_pattern = hits_to_pattern(drum_hits['hihat'], num_bars, bar_duration)
        
        # Simplify patterns
        def simplify_pattern(pattern):
            # Group into beats (4 steps each)
            result = []
            for i in range(0, 16, 4):
                beat = pattern[i:i+4]
                # Check if any hits in this beat
                if 'x' in beat:
                    # Find which subdivisions have hits
                    subdivs = []
                    for j, step in enumerate(beat):
                        if step == 'x':
                            if j == 0:
                                subdivs.append('x')
                            elif j == 2:
                                subdivs.append('x')
                            else:
                                subdivs.append('x')
                    if subdivs:
                        if len(subdivs) == 1:
                            result.append('x')
                        else:
                            result.append(f"[{' '.join(subdivs)}]")
                    else:
                        result.append('~')
                else:
                    result.append('~')
            return ' '.join(result)
        
        # Build drum stack
        lines = ['// Drums']
        drum_parts = []
        
        # Kick - use low square wave
        kick_str = simplify_pattern(kick_pattern)
        if 'x' in kick_str:
            drum_parts.append(f'note("c2").struct("{kick_str}").s("square").decay(0.08).lpf(150).gain(0.9)')
        
        # Snare - use noise/square with high pass
        snare_str = simplify_pattern(snare_pattern)
        if 'x' in snare_str:
            drum_parts.append(f'note("c3").struct("{snare_str}").s("square").hpf(400).decay(0.06).gain(0.7)')
        
        # Hihat - use pink noise with high pass
        if hihat_pattern.count('x') >= 12:
            drum_parts.append('note("c6*8").s("pink").hpf(8000).decay(0.02).gain(0.4)')
        elif hihat_pattern.count('x') >= 8:
            drum_parts.append('note("c6*4").s("pink").hpf(8000).decay(0.02).gain(0.4)')
        elif 'x' in simplify_pattern(hihat_pattern):
            drum_parts.append(f'note("c6").struct("{simplify_pattern(hihat_pattern)}").s("pink").hpf(8000).decay(0.02).gain(0.4)')
        
        if drum_parts:
            lines.append(f'stack({", ".join(drum_parts)})')
        else:
            lines.append('note("c2*4").s("square").decay(0.08).lpf(150)')
        
        return '\n'.join(lines)
    
    def _generate_bass(self) -> str:
        """Generate bass line from detected notes."""
        bass_notes = self.analyzer.bass_notes[:32]  # First 32 notes
        
        if not bass_notes:
            return ''
        
        # Group notes into bars
        beat_duration = 60.0 / self.bpm
        bar_duration = beat_duration * 4
        
        # Get notes from first few bars
        first_bar_notes = [n for n in bass_notes if n['time'] < bar_duration * 2]
        
        if not first_bar_notes:
            first_bar_notes = bass_notes[:8]
        
        # Create pattern
        note_names = [n['note'] for n in first_bar_notes[:8]]
        
        # Remove consecutive duplicates
        unique_notes = []
        last_note = None
        for note in note_names:
            if note != last_note:
                unique_notes.append(note)
                last_note = note
        
        if not unique_notes:
            return ''
        
        pattern = ' '.join(unique_notes[:4])  # Use first 4 unique notes
        
        lines = ['// Bass']
        lines.append(f'note("{pattern}").s("sawtooth").lpf(400).decay(0.2).sustain(0.3).gain(0.6)')
        
        return '\n'.join(lines)
    
    def _generate_melody(self) -> str:
        """Generate melody from detected notes."""
        melody_notes = self.analyzer.melody_notes[:64]
        
        if not melody_notes:
            return ''
        
        # Get first bar of melody
        beat_duration = 60.0 / self.bpm
        bar_duration = beat_duration * 4
        
        first_bar_notes = [n for n in melody_notes if n['time'] < bar_duration * 2]
        
        if not first_bar_notes:
            first_bar_notes = melody_notes[:8]
        
        # Create pattern
        note_names = [n['note'] for n in first_bar_notes[:8]]
        
        # Remove consecutive duplicates
        unique_notes = []
        last_note = None
        for note in note_names:
            if note != last_note:
                unique_notes.append(note)
                last_note = note
        
        if not unique_notes:
            return ''
        
        pattern = ' '.join(unique_notes[:8])
        
        lines = ['// Melody']
        lines.append(f'note("{pattern}").s("triangle").decay(0.3).sustain(0.4).delay(0.2).gain(0.5)')
        
        return '\n'.join(lines)


# ═══════════════════════════════════════════════════════════════════════════
# YOUTUBE DOWNLOADER
# ═══════════════════════════════════════════════════════════════════════════

class YouTubeDownloader:
    """Downloads audio from YouTube videos."""
    
    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or tempfile.gettempdir()
        
    def download(self, url: str) -> tuple[str, dict]:
        """Download audio from YouTube URL. Returns (audio_path, metadata)."""
        print(f"Downloading from: {url}")
        
        output_template = os.path.join(self.output_dir, '%(id)s.%(ext)s')
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
            'outtmpl': output_template,
            'quiet': False,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info['id']
            audio_path = os.path.join(self.output_dir, f"{video_id}.wav")
            
            metadata = {
                'title': info.get('title', 'Unknown'),
                'artist': info.get('artist') or info.get('uploader', 'Unknown'),
                'duration': info.get('duration', 0),
                'url': url,
            }
            
            print(f"Downloaded: {metadata['title']}")
            return audio_path, metadata


# ═══════════════════════════════════════════════════════════════════════════
# FLASK SERVER (Optional)
# ═══════════════════════════════════════════════════════════════════════════

def create_server():
    """Create Flask server for web API."""
    try:
        from flask import Flask, request, jsonify
        from flask_cors import CORS
    except ImportError:
        print("Flask not installed. Run: pip install flask flask-cors")
        return None
    
    app = Flask(__name__)
    CORS(app)
    
    @app.route('/')
    def index():
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>YouTube to Strudel</title>
            <style>
                body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; background: #1a1a2e; color: #eee; }
                h1 { color: #00d9ff; }
                input, button { padding: 12px; margin: 5px; border-radius: 8px; border: none; }
                input { width: 400px; background: #16213e; color: white; }
                button { background: #00d9ff; color: black; cursor: pointer; font-weight: bold; }
                button:hover { background: #00b8d4; }
                pre { background: #16213e; padding: 20px; border-radius: 8px; overflow-x: auto; }
                .status { color: #888; margin: 10px 0; }
                .error { color: #ff6b6b; }
            </style>
        </head>
        <body>
            <h1>🎵 YouTube to Strudel</h1>
            <p>Convert YouTube music to Strudel code patterns</p>
            
            <div>
                <input type="text" id="url" placeholder="YouTube URL (e.g., https://www.youtube.com/watch?v=...)">
                <input type="number" id="duration" placeholder="Duration (seconds)" value="30" style="width: 100px;">
                <button onclick="convert()">Convert</button>
            </div>
            
            <div id="status" class="status"></div>
            <pre id="output"></pre>
            
            <script>
                async function convert() {
                    const url = document.getElementById('url').value;
                    const duration = document.getElementById('duration').value;
                    const status = document.getElementById('status');
                    const output = document.getElementById('output');
                    
                    if (!url) {
                        status.innerHTML = '<span class="error">Please enter a YouTube URL</span>';
                        return;
                    }
                    
                    status.textContent = 'Downloading and analyzing... (this may take a minute)';
                    output.textContent = '';
                    
                    try {
                        const response = await fetch('/convert', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url, duration: parseInt(duration) })
                        });
                        
                        const data = await response.json();
                        
                        if (data.error) {
                            status.innerHTML = '<span class="error">Error: ' + data.error + '</span>';
                        } else {
                            status.textContent = `Converted: ${data.metadata.title} (${data.metadata.duration}s)`;
                            output.textContent = data.code;
                        }
                    } catch (err) {
                        status.innerHTML = '<span class="error">Error: ' + err.message + '</span>';
                    }
                }
            </script>
        </body>
        </html>
        """
    
    @app.route('/convert', methods=['POST'])
    def convert():
        try:
            data = request.json
            url = data.get('url')
            duration = data.get('duration', 30)
            
            if not url:
                return jsonify({'error': 'No URL provided'}), 400
            
            # Download
            downloader = YouTubeDownloader()
            audio_path, metadata = downloader.download(url)
            
            # Analyze
            analyzer = AudioAnalyzer(audio_path, duration=duration)
            analyzer.analyze_tempo()
            analyzer.analyze_key()
            analyzer.analyze_drums()
            analyzer.analyze_bass()
            analyzer.analyze_melody()
            
            # Generate
            generator = StrudelGenerator(analyzer)
            code = generator.generate()
            
            # Cleanup
            try:
                os.remove(audio_path)
            except:
                pass
            
            return jsonify({
                'code': code,
                'metadata': metadata,
                'analysis': {
                    'bpm': analyzer.bpm,
                    'key': analyzer.key,
                    'mode': analyzer.mode,
                }
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/health')
    def health():
        return jsonify({'status': 'ok', 'service': 'youtube-to-strudel'})
    
    return app


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Convert YouTube audio to Strudel code')
    parser.add_argument('url', nargs='?', help='YouTube URL to convert')
    parser.add_argument('--output', '-o', help='Output file for generated code')
    parser.add_argument('--duration', '-d', type=int, default=30, help='Duration to analyze (seconds)')
    parser.add_argument('--server', action='store_true', help='Run as web server')
    parser.add_argument('--port', type=int, default=5002, help='Server port (default: 5002)')
    
    args = parser.parse_args()
    
    if args.server:
        app = create_server()
        if app:
            print(f"\n🎵 YouTube to Strudel Server")
            print(f"   http://localhost:{args.port}")
            print(f"   POST /convert - Convert YouTube URL to Strudel code")
            print()
            app.run(host='0.0.0.0', port=args.port, debug=False)
        return
    
    if not args.url:
        parser.print_help()
        print("\nExamples:")
        print('  python youtube_to_strudel.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ"')
        print('  python youtube_to_strudel.py "https://youtu.be/VIDEO_ID" --duration 60')
        print('  python youtube_to_strudel.py --server')
        return
    
    try:
        # Download
        downloader = YouTubeDownloader()
        audio_path, metadata = downloader.download(args.url)
        
        print(f"\nAnalyzing: {metadata['title']}")
        print("=" * 50)
        
        # Analyze
        analyzer = AudioAnalyzer(audio_path, duration=args.duration)
        analyzer.analyze_tempo()
        analyzer.analyze_key()
        analyzer.analyze_drums()
        analyzer.analyze_bass()
        analyzer.analyze_melody()
        
        # Generate
        generator = StrudelGenerator(analyzer)
        code = generator.generate()
        
        print("\n" + "=" * 50)
        print("Generated Strudel Code:")
        print("=" * 50)
        print(code)
        
        # Save if output specified
        if args.output:
            with open(args.output, 'w') as f:
                f.write(code)
            print(f"\nSaved to: {args.output}")
        
        # Cleanup
        try:
            os.remove(audio_path)
        except:
            pass
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
