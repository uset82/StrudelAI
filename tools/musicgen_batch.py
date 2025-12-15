"""
MusicGen Batch Generator - Generate multiple samples for testing
"""
import requests
import base64
import os
import time
from datetime import datetime

BASE_URL = "http://localhost:5001"

# Test prompts for different styles
TEST_PROMPTS = [
    {
        "name": "techno_kick",
        "prompt": "punchy techno kick drum, 128 bpm, dance music, electronic",
        "duration": 5
    },
    {
        "name": "ambient_pad",
        "prompt": "ethereal ambient pad, dreamy, reverb, evolving texture, calm",
        "duration": 8
    },
    {
        "name": "bass_wobble",
        "prompt": "deep dubstep bass, wobble bass, aggressive, dark, 140 bpm",
        "duration": 5
    },
    {
        "name": "synth_lead",
        "prompt": "catchy synth melody, trance, uplifting, major key, 138 bpm",
        "duration": 8
    },
    {
        "name": "drum_loop",
        "prompt": "breakbeat drums, funky, sampled breaks, hip hop, 95 bpm",
        "duration": 5
    }
]

def check_server():
    """Check if MusicGen server is running"""
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        return r.status_code == 200
    except:
        return False

def generate_sample(prompt_data, output_dir="generated_samples"):
    """Generate a single sample"""
    os.makedirs(output_dir, exist_ok=True)
    
    name = prompt_data["name"]
    prompt = prompt_data["prompt"]
    duration = prompt_data["duration"]
    
    print(f"\nGenerating: {name}")
    print(f"  Prompt: {prompt}")
    print(f"  Duration: {duration}s")
    
    start = time.time()
    
    response = requests.post(
        f"{BASE_URL}/generate",
        json={
            "prompt": prompt,
            "duration": duration,
            "format": "base64"
        },
        timeout=300
    )
    
    if response.status_code == 200:
        data = response.json()
        elapsed = time.time() - start
        
        # Save audio
        audio_bytes = base64.b64decode(data["audio_base64"])
        filename = f"{name}_{datetime.now().strftime('%H%M%S')}.wav"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        
        print(f"  [OK] Saved: {filepath}")
        print(f"  Time: {elapsed:.1f}s | Size: {len(audio_bytes)/1024:.1f} KB")
        return filepath
    else:
        print(f"  [ERROR] {response.status_code}: {response.text}")
        return None

def generate_stem(stem_type, style="techno", mood="energetic", output_dir="generated_stems"):
    """Generate a specific instrument stem"""
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\nGenerating {stem_type} stem...")
    print(f"  Style: {style}, Mood: {mood}")
    
    start = time.time()
    
    response = requests.post(
        f"{BASE_URL}/generate_stem",
        json={
            "type": stem_type,
            "style": style,
            "mood": mood,
            "bpm": 128,
            "duration": 8,
            "format": "base64"
        },
        timeout=300
    )
    
    if response.status_code == 200:
        data = response.json()
        elapsed = time.time() - start
        
        audio_bytes = base64.b64decode(data["audio_base64"])
        filename = f"{stem_type}_{style}_{datetime.now().strftime('%H%M%S')}.wav"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        
        print(f"  [OK] Saved: {filepath}")
        print(f"  Time: {elapsed:.1f}s")
        return filepath
    else:
        print(f"  [ERROR] {response.status_code}: {response.text}")
        return None

def main():
    print("=" * 50)
    print("MusicGen Batch Generator")
    print("=" * 50)
    
    if not check_server():
        print("\n[ERROR] MusicGen server not running!")
        print("Start it with: python tools/musicgen_server.py")
        return
    
    print("\n[OK] Server is running")
    
    # Generate test samples
    print("\n--- Generating Test Samples ---")
    for prompt_data in TEST_PROMPTS:
        generate_sample(prompt_data)
    
    # Generate stems
    print("\n--- Generating Stems ---")
    for stem in ["drums", "bass", "melody"]:
        generate_stem(stem, style="techno", mood="energetic")
    
    print("\n" + "=" * 50)
    print("Done! Check 'generated_samples/' and 'generated_stems/' folders")
    print("=" * 50)

if __name__ == "__main__":
    main()
