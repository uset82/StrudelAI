"""
MusicGen Server - AI Music Generation API
Uses Facebook's MusicGen model via Hugging Face Transformers

Requirements:
    pip install transformers torch scipy flask flask-cors

For GPU acceleration (recommended):
    pip install torch --index-url https://download.pytorch.org/whl/cu118

Usage:
    python tools/musicgen_server.py
    
Then POST to http://localhost:5001/generate with JSON:
    {"prompt": "energetic techno beat with heavy bass", "duration": 8}
"""

import os
import io
import base64
import time
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
import scipy.io.wavfile as wavfile

# Check for GPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[MusicGen] Using device: {device}")

app = Flask(__name__)
CORS(app)

# Global model (lazy loaded)
model = None
processor = None

def load_model():
    """Lazy load the MusicGen model"""
    global model, processor
    if model is None:
        print("[MusicGen] Loading model... (this may take a minute)")
        from transformers import AutoProcessor, MusicgenForConditionalGeneration
        
        # Use small model for faster generation (300M params)
        # Options: facebook/musicgen-small, facebook/musicgen-medium, facebook/musicgen-melody
        model_name = os.environ.get("MUSICGEN_MODEL", "facebook/musicgen-small")
        
        processor = AutoProcessor.from_pretrained(model_name)
        model = MusicgenForConditionalGeneration.from_pretrained(model_name)
        model = model.to(device)
        
        print(f"[MusicGen] Model '{model_name}' loaded on {device}")
    return model, processor


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "device": device,
        "model_loaded": model is not None
    })


@app.route('/', methods=['GET'])
def index():
    """Landing page"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>MusicGen Server</title>
        <style>
            body { font-family: system-ui; background: #1a1a2e; color: #eee; padding: 40px; }
            h1 { color: #00d9ff; }
            .status { background: #16213e; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .endpoint { background: #0f3460; padding: 10px 15px; border-radius: 4px; margin: 5px 0; }
            code { color: #00ff88; }
            a { color: #00d9ff; }
        </style>
    </head>
    <body>
        <h1>🎵 MusicGen Server</h1>
        <div class="status">
            <strong>Status:</strong> Running on """ + device.upper() + """<br>
            <strong>Model:</strong> """ + ("Loaded ✅" if model else "Not loaded (will load on first request)") + """
        </div>
        <h2>API Endpoints</h2>
        <div class="endpoint"><code>GET /health</code> - Check server status</div>
        <div class="endpoint"><code>POST /generate</code> - Generate music from text prompt</div>
        <div class="endpoint"><code>POST /generate_stem</code> - Generate specific instrument stem</div>
        <h2>Example Usage</h2>
        <pre style="background:#0f3460;padding:15px;border-radius:8px;overflow-x:auto;">
curl -X POST http://localhost:5001/generate \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "energetic techno beat", "duration": 5}'
        </pre>
        <p>Use the main app at <a href="http://localhost:3000">http://localhost:3000</a></p>
    </body>
    </html>
    """


@app.route('/generate', methods=['POST'])
def generate():
    """
    Generate music from a text prompt
    
    Request JSON:
        {
            "prompt": "energetic techno beat with bass",
            "duration": 8,  // seconds (default: 8, max: 30)
            "format": "wav"  // or "base64"
        }
    
    Response:
        - If format="wav": Returns WAV file
        - If format="base64": Returns JSON with base64 audio
    """
    try:
        data = request.get_json()
        
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request"}), 400
        
        prompt = data['prompt']
        duration = min(data.get('duration', 8), 30)  # Cap at 30 seconds
        output_format = data.get('format', 'base64')
        
        print(f"[MusicGen] Generating: '{prompt}' ({duration}s)")
        start_time = time.time()
        
        # Load model if not already loaded
        model, processor = load_model()
        
        # Process input
        inputs = processor(
            text=[prompt],
            padding=True,
            return_tensors="pt",
        ).to(device)
        
        # Calculate tokens for duration
        # MusicGen generates at ~50 tokens per second of audio
        max_new_tokens = int(duration * 50)
        
        # Generate
        with torch.no_grad():
            audio_values = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                guidance_scale=3.0,
            )
        
        # Get audio data
        audio_data = audio_values[0, 0].cpu().numpy()
        sampling_rate = model.config.audio_encoder.sampling_rate
        
        elapsed = time.time() - start_time
        print(f"[MusicGen] Generated in {elapsed:.2f}s")
        
        if output_format == 'wav':
            # Return as WAV file
            buffer = io.BytesIO()
            wavfile.write(buffer, sampling_rate, audio_data)
            buffer.seek(0)
            return send_file(
                buffer,
                mimetype='audio/wav',
                as_attachment=True,
                download_name='musicgen_output.wav'
            )
        else:
            # Return as base64
            buffer = io.BytesIO()
            wavfile.write(buffer, sampling_rate, audio_data)
            audio_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return jsonify({
                "success": True,
                "prompt": prompt,
                "duration": duration,
                "sampling_rate": sampling_rate,
                "audio_base64": audio_base64,
                "generation_time": elapsed
            })
            
    except Exception as e:
        print(f"[MusicGen] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/generate_stem', methods=['POST'])
def generate_stem():
    """
    Generate a specific instrument stem/layer
    
    Request JSON:
        {
            "type": "drums" | "bass" | "melody" | "voice" | "fx",
            "style": "techno",
            "mood": "energetic",
            "key": "C minor",
            "bpm": 128,
            "duration": 8
        }
    """
    try:
        data = request.get_json()
        
        stem_type = data.get('type', 'drums')
        style = data.get('style', 'electronic')
        mood = data.get('mood', 'energetic')
        key = data.get('key', 'C minor')
        bpm = data.get('bpm', 128)
        duration = min(data.get('duration', 8), 30)
        
        # Build optimized prompt for specific stem type
        stem_prompts = {
            'drums': f"{mood} {style} drum pattern, {bpm} bpm, punchy kicks, crisp snares, clear hi-hats, no melody, no bass, percussion only",
            'bass': f"{mood} {style} bassline in {key}, {bpm} bpm, deep sub bass, rhythmic, no drums, no melody, bass only",
            'melody': f"{mood} {style} melody in {key}, {bpm} bpm, synth lead, melodic, no drums, no bass, lead instrument only",
            'voice': f"ethereal vocal choir in {key}, {bpm} bpm, heavenly voices, angelic, pad-like, atmospheric",
            'fx': f"{mood} {style} ambient texture in {key}, atmospheric pad, evolving, no rhythm, ambient soundscape only"
        }
        
        prompt = stem_prompts.get(stem_type, stem_prompts['drums'])
        
        print(f"[MusicGen] Generating {stem_type} stem: '{prompt}'")
        
        # Reuse generate logic
        data['prompt'] = prompt
        data['duration'] = duration
        return generate()
        
    except Exception as e:
        print(f"[MusicGen] Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Pre-load model on startup (optional - can be slow)
    preload = os.environ.get("MUSICGEN_PRELOAD", "false").lower() == "true"
    if preload:
        load_model()
    
    port = int(os.environ.get("MUSICGEN_PORT", 5001))
    print(f"[MusicGen] Server starting on http://localhost:{port}")
    print(f"[MusicGen] Endpoints:")
    print(f"  GET  /health - Check server status")
    print(f"  POST /generate - Generate music from text prompt")
    print(f"  POST /generate_stem - Generate specific instrument stem")
    
    app.run(host='0.0.0.0', port=port, debug=False)
