"""Test MusicGen generation"""
import requests
import base64

print("Testing MusicGen generation...")
print("This will download the model on first run (~1GB)")
print()

# Generate 5 seconds of techno
response = requests.post(
    'http://localhost:5001/generate',
    json={
        'prompt': 'energetic techno beat with punchy kicks and acid synth',
        'duration': 5,
        'format': 'base64'
    },
    timeout=300  # 5 min timeout for model download + generation
)

if response.status_code == 200:
    data = response.json()
    print("Success!")
    print(f"  Generation time: {data.get('generation_time', 0):.2f}s")
    print(f"  Sample rate: {data.get('sampling_rate')} Hz")
    
    # Save the audio
    audio_bytes = base64.b64decode(data['audio_base64'])
    output_path = 'generated_techno.wav'
    with open(output_path, 'wb') as f:
        f.write(audio_bytes)
    print(f"  Saved to: {output_path}")
    print(f"  File size: {len(audio_bytes) / 1024:.1f} KB")
else:
    print(f"Error: {response.status_code}")
    print(response.text)
