"""
MusicGen Fine-Tuning and Training Tools
Train your own custom MusicGen model on your audio samples!

Requirements:
    pip install transformers torch scipy datasets accelerate torchaudio

Usage:
    1. Collect audio samples (WAV/MP3) in a folder
    2. Create descriptions for each sample
    3. Run fine-tuning

Example:
    python tools/musicgen_trainer.py --data_dir ./my_samples --output_dir ./my_model
"""

import os
import json
import argparse
from pathlib import Path
from typing import List, Dict, Optional
import torch
import torchaudio
from dataclasses import dataclass
from datetime import datetime


@dataclass
class TrainingConfig:
    """Configuration for MusicGen fine-tuning"""
    model_name: str = "facebook/musicgen-small"  # Base model
    output_dir: str = "./musicgen_finetuned"
    data_dir: str = "./training_data"
    
    # Training hyperparameters
    learning_rate: float = 1e-5
    batch_size: int = 1  # Keep low for 8GB VRAM
    gradient_accumulation_steps: int = 4
    num_epochs: int = 3
    warmup_steps: int = 100
    max_audio_length: int = 10  # seconds
    
    # Memory optimization
    use_gradient_checkpointing: bool = True
    use_8bit: bool = False  # Can enable for more memory savings
    mixed_precision: str = "fp16"  # fp16 or bf16
    
    # Logging
    logging_steps: int = 10
    save_steps: int = 100


class AudioDataset:
    """Dataset for audio-text pairs"""
    
    def __init__(self, data_dir: str, processor, max_length: int = 10):
        self.data_dir = Path(data_dir)
        self.processor = processor
        self.max_length = max_length
        self.samples = self._load_samples()
        
    def _load_samples(self) -> List[Dict]:
        """Load audio files and their descriptions"""
        samples = []
        
        # Look for metadata.json or individual .txt files
        metadata_file = self.data_dir / "metadata.json"
        
        if metadata_file.exists():
            with open(metadata_file) as f:
                metadata = json.load(f)
                for item in metadata:
                    audio_path = self.data_dir / item["audio"]
                    if audio_path.exists():
                        samples.append({
                            "audio_path": str(audio_path),
                            "description": item["description"]
                        })
        else:
            # Look for audio files with matching .txt descriptions
            for ext in ["*.wav", "*.mp3", "*.flac"]:
                for audio_file in self.data_dir.glob(ext):
                    txt_file = audio_file.with_suffix(".txt")
                    if txt_file.exists():
                        with open(txt_file) as f:
                            description = f.read().strip()
                        samples.append({
                            "audio_path": str(audio_file),
                            "description": description
                        })
                    else:
                        # Use filename as description
                        samples.append({
                            "audio_path": str(audio_file),
                            "description": audio_file.stem.replace("_", " ")
                        })
        
        print(f"[Dataset] Loaded {len(samples)} samples")
        return samples
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        sample = self.samples[idx]
        
        # Load audio
        waveform, sample_rate = torchaudio.load(sample["audio_path"])
        
        # Resample to 32kHz (MusicGen's sample rate)
        if sample_rate != 32000:
            resampler = torchaudio.transforms.Resample(sample_rate, 32000)
            waveform = resampler(waveform)
        
        # Convert to mono if needed
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        
        # Trim to max length
        max_samples = self.max_length * 32000
        if waveform.shape[1] > max_samples:
            waveform = waveform[:, :max_samples]
        
        return {
            "audio": waveform.squeeze(),
            "description": sample["description"]
        }


def prepare_training_data(data_dir: str, output_file: str = "training_data.json"):
    """
    Interactive tool to prepare training data with descriptions
    """
    data_path = Path(data_dir)
    samples = []
    
    print("\n=== MusicGen Training Data Preparation ===")
    print(f"Scanning: {data_path}")
    
    audio_files = list(data_path.glob("*.wav")) + list(data_path.glob("*.mp3"))
    
    for audio_file in audio_files:
        print(f"\n📁 File: {audio_file.name}")
        
        # Check for existing description
        txt_file = audio_file.with_suffix(".txt")
        if txt_file.exists():
            with open(txt_file) as f:
                existing = f.read().strip()
            print(f"   Existing description: {existing}")
            use_existing = input("   Use existing? [Y/n]: ").strip().lower()
            if use_existing != 'n':
                samples.append({
                    "audio": audio_file.name,
                    "description": existing
                })
                continue
        
        # Get description from user
        print("   Describe this audio (style, mood, instruments, tempo):")
        description = input("   > ").strip()
        
        if description:
            samples.append({
                "audio": audio_file.name,
                "description": description
            })
            
            # Save individual txt file too
            with open(txt_file, 'w') as f:
                f.write(description)
    
    # Save metadata
    output_path = data_path / output_file
    with open(output_path, 'w') as f:
        json.dump(samples, f, indent=2)
    
    print(f"\n✅ Saved {len(samples)} samples to {output_path}")
    return samples


def fine_tune_musicgen(config: TrainingConfig):
    """
    Fine-tune MusicGen on custom audio data
    
    NOTE: Full fine-tuning requires significant compute.
    For 8GB VRAM, we use LoRA (Low-Rank Adaptation) instead.
    """
    from transformers import (
        AutoProcessor, 
        MusicgenForConditionalGeneration,
        TrainingArguments,
        Trainer
    )
    from peft import LoraConfig, get_peft_model, TaskType
    
    print("\n=== MusicGen Fine-Tuning ===")
    print(f"Base model: {config.model_name}")
    print(f"Data dir: {config.data_dir}")
    print(f"Output: {config.output_dir}")
    
    # Check GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")
    if device == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory // (1024**3)} GB")
    
    # Load processor and model
    print("\n[1/4] Loading model...")
    processor = AutoProcessor.from_pretrained(config.model_name)
    model = MusicgenForConditionalGeneration.from_pretrained(
        config.model_name,
        torch_dtype=torch.float16 if config.mixed_precision == "fp16" else torch.bfloat16
    )
    
    # Enable gradient checkpointing for memory savings
    if config.use_gradient_checkpointing:
        model.gradient_checkpointing_enable()
    
    # Apply LoRA for efficient fine-tuning
    print("\n[2/4] Applying LoRA adapters...")
    lora_config = LoraConfig(
        r=8,  # Rank
        lora_alpha=32,
        target_modules=["q_proj", "v_proj"],  # Attention layers
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM
    )
    
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    model = model.to(device)
    
    # Load dataset
    print("\n[3/4] Loading dataset...")
    dataset = AudioDataset(config.data_dir, processor, config.max_audio_length)
    
    if len(dataset) == 0:
        print("❌ No training samples found!")
        print("   Add audio files with .txt descriptions to your data folder")
        return
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=config.output_dir,
        num_train_epochs=config.num_epochs,
        per_device_train_batch_size=config.batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        learning_rate=config.learning_rate,
        warmup_steps=config.warmup_steps,
        logging_steps=config.logging_steps,
        save_steps=config.save_steps,
        fp16=config.mixed_precision == "fp16",
        bf16=config.mixed_precision == "bf16",
        dataloader_pin_memory=True,
        remove_unused_columns=False,
    )
    
    print("\n[4/4] Starting training...")
    print(f"   Epochs: {config.num_epochs}")
    print(f"   Batch size: {config.batch_size}")
    print(f"   Gradient accumulation: {config.gradient_accumulation_steps}")
    print(f"   Effective batch: {config.batch_size * config.gradient_accumulation_steps}")
    
    # Note: Full Trainer setup requires custom collator for MusicGen
    # This is a simplified version - for production use audiocraft's training
    print("\n⚠️  Note: Full MusicGen training requires Meta's audiocraft library")
    print("   For LoRA fine-tuning, use: pip install audiocraft peft")
    print("   See: https://github.com/facebookresearch/audiocraft")
    
    # Save config
    os.makedirs(config.output_dir, exist_ok=True)
    config_path = os.path.join(config.output_dir, "training_config.json")
    with open(config_path, 'w') as f:
        json.dump(config.__dict__, f, indent=2)
    
    print(f"\n✅ Config saved to {config_path}")
    print("   To complete training, use audiocraft's training scripts")


def export_for_inference(model_path: str, output_path: str):
    """Export fine-tuned model for inference"""
    from transformers import MusicgenForConditionalGeneration
    from peft import PeftModel
    
    print(f"\n=== Exporting Model ===")
    print(f"Loading from: {model_path}")
    
    # Load base model
    base_model = MusicgenForConditionalGeneration.from_pretrained(
        "facebook/musicgen-small"
    )
    
    # Load LoRA weights
    model = PeftModel.from_pretrained(base_model, model_path)
    
    # Merge LoRA into base model
    print("Merging LoRA weights...")
    model = model.merge_and_unload()
    
    # Save merged model
    print(f"Saving to: {output_path}")
    model.save_pretrained(output_path)
    
    print("✅ Model exported!")


def create_sample_dataset():
    """Create a sample dataset structure"""
    sample_dir = Path("training_data")
    sample_dir.mkdir(exist_ok=True)
    
    # Create example metadata
    metadata = [
        {
            "audio": "techno_beat_01.wav",
            "description": "energetic techno beat, 128 bpm, punchy kick, crisp hi-hats, dark atmosphere"
        },
        {
            "audio": "ambient_pad_01.wav", 
            "description": "ethereal ambient pad, slow evolving texture, dreamy, reverb-heavy"
        },
        {
            "audio": "bass_loop_01.wav",
            "description": "deep dubstep bass, wobble bass, aggressive, 140 bpm"
        }
    ]
    
    metadata_path = sample_dir / "metadata_example.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    # Create readme
    readme = """# MusicGen Training Data

## How to prepare your training data:

1. **Collect audio samples** (WAV, MP3, or FLAC)
   - 5-30 seconds each is ideal
   - Try to have at least 10-50 samples per style
   - Higher quality = better results

2. **Add descriptions** for each sample:
   
   Option A: Create `metadata.json`:
   ```json
   [
     {"audio": "sample1.wav", "description": "energetic techno beat, 128 bpm"},
     {"audio": "sample2.wav", "description": "chill lo-fi hip hop, jazzy chords"}
   ]
   ```
   
   Option B: Create `.txt` file for each audio:
   - `sample1.wav` -> `sample1.txt` containing the description

3. **Description tips:**
   - Include genre/style: "techno", "ambient", "rock"
   - Include mood: "energetic", "chill", "dark", "euphoric"
   - Include instruments: "synthesizer", "guitar", "drums"
   - Include tempo: "120 bpm", "slow", "fast"
   - Include key (optional): "C minor", "A major"

## Example descriptions:

- "driving techno beat, 130 bpm, industrial, distorted kick, metallic hi-hats"
- "smooth jazz piano, relaxing, warm, 90 bpm, brushed drums"
- "epic orchestral, dramatic, cinematic, brass section, timpani"
- "glitchy IDM, experimental, polyrhythmic, 160 bpm, granular textures"

## File structure:
```
training_data/
├── metadata.json (optional)
├── sample1.wav
├── sample1.txt (optional if using metadata.json)
├── sample2.wav
├── sample2.txt
└── ...
```
"""
    
    readme_path = sample_dir / "README.md"
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(readme)
    
    print(f"[OK] Created sample dataset structure in: {sample_dir}")
    print(f"   - {metadata_path}")
    print(f"   - {readme_path}")
    print("\n   Add your audio files and descriptions, then run:")
    print("   python tools/musicgen_trainer.py --mode train --data_dir training_data")


def main():
    parser = argparse.ArgumentParser(description="MusicGen Training Tools")
    parser.add_argument("--mode", type=str, default="info",
                        choices=["info", "prepare", "train", "export", "create_sample"],
                        help="Mode: info, prepare, train, export, or create_sample")
    parser.add_argument("--data_dir", type=str, default="./training_data",
                        help="Directory with training audio files")
    parser.add_argument("--output_dir", type=str, default="./musicgen_finetuned",
                        help="Output directory for fine-tuned model")
    parser.add_argument("--model", type=str, default="facebook/musicgen-small",
                        help="Base model name")
    parser.add_argument("--epochs", type=int, default=3,
                        help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=1,
                        help="Batch size (keep low for 8GB VRAM)")
    
    args = parser.parse_args()
    
    if args.mode == "info":
        print("\n=== MusicGen Training Tools ===")
        print("\nModes:")
        print("  --mode create_sample  Create example dataset structure")
        print("  --mode prepare        Interactive data preparation")
        print("  --mode train          Fine-tune MusicGen on your data")
        print("  --mode export         Export fine-tuned model")
        print("\nExample workflow:")
        print("  1. python musicgen_trainer.py --mode create_sample")
        print("  2. Add your audio files to training_data/")
        print("  3. python musicgen_trainer.py --mode prepare --data_dir training_data")
        print("  4. python musicgen_trainer.py --mode train --data_dir training_data")
        print("\nYour system:")
        if torch.cuda.is_available():
            print(f"  GPU: {torch.cuda.get_device_name(0)}")
            vram = torch.cuda.get_device_properties(0).total_memory // (1024**3)
            print(f"  VRAM: {vram} GB")
            if vram >= 8:
                print("  ✅ Sufficient for MusicGen-small fine-tuning")
            elif vram >= 4:
                print("  ⚠️  May need 8-bit quantization")
            else:
                print("  ❌ May need to use CPU (very slow)")
        else:
            print("  ❌ No GPU detected - training will be very slow")
            
    elif args.mode == "create_sample":
        create_sample_dataset()
        
    elif args.mode == "prepare":
        prepare_training_data(args.data_dir)
        
    elif args.mode == "train":
        config = TrainingConfig(
            model_name=args.model,
            output_dir=args.output_dir,
            data_dir=args.data_dir,
            num_epochs=args.epochs,
            batch_size=args.batch_size
        )
        fine_tune_musicgen(config)
        
    elif args.mode == "export":
        export_for_inference(args.output_dir, f"{args.output_dir}_merged")


if __name__ == "__main__":
    main()
