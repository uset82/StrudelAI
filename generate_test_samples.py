"""Generate a few test samples"""
import requests
import base64
import os

os.makedirs('generated_samples', exist_ok=True)

prompts = [
    ('angel_choir', 'angelic choir voices singing ahhh, ethereal, heavenly, reverb, soft', 8),
    ('acid_bass', 'acid techno bassline, 303 synth, resonant filter, squelchy, 130 bpm', 5),
]

for name, prompt, dur in prompts:
    print(f'Generating {name}...')
    r = requests.post('http://localhost:5001/generate', json={'prompt': prompt, 'duration': dur}, timeout=300)
    if r.status_code == 200:
        data = r.json()
        audio = base64.b64decode(data['audio_base64'])
        path = f'generated_samples/{name}.wav'
        with open(path, 'wb') as f:
            f.write(audio)
        gen_time = data.get('generation_time', 0)
        print(f'  OK: {path} ({gen_time:.1f}s)')
    else:
        print(f'  Error: {r.text}')

print('Done!')
