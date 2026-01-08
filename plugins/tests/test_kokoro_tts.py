"""
Test Script: Kokoro TTS Plugin
==============================
Verifies the Kokoro TTS plugin works correctly.

Prerequisites:
    1. Install espeak-ng: https://github.com/espeak-ng/espeak-ng/releases
    2. Run: pip install kokoro>=0.9.4 soundfile misaki[en]

Usage:
    python test_kokoro_tts.py
"""

import asyncio
import os
import sys

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)


async def test_kokoro_tts():
    """Test the Kokoro TTS plugin."""

    print("=" * 60)
    print("🔊 KOKORO TTS PLUGIN TEST")
    print("=" * 60)

    # 1. Check dependencies
    print("\n[1/5] Checking dependencies...")
    try:
        import torch

        print(f"  ✅ PyTorch: {torch.__version__}")
        print(f"  ✅ CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"  ✅ GPU: {torch.cuda.get_device_name(0)}")
    except ImportError as e:
        print(f"  ❌ PyTorch not found: {e}")
        return False

    try:
        import kokoro

        print("  ✅ Kokoro: installed")
    except ImportError as e:
        print(f"  ❌ Kokoro not found: {e}")
        print("     Run: pip install kokoro>=0.9.4 soundfile misaki[en]")
        return False

    try:
        import soundfile as sf

        print("  ✅ SoundFile: installed")
    except ImportError as e:
        print(f"  ❌ SoundFile not found: {e}")
        return False

    # 2. Load plugin
    print("\n[2/5] Loading Kokoro TTS plugin...")
    try:
        from plugins.tts_kokoro.plugin import KokoroTTSPlugin

        plugin = KokoroTTSPlugin()
        print("  ✅ Plugin instantiated")
    except Exception as e:
        print(f"  ❌ Failed to load plugin: {e}")
        return False

    # 3. Initialize plugin
    print("\n[3/5] Initializing plugin...")
    config = {"default_voice": "af_heart", "default_lang_code": "a", "device": "auto", "speed": 1.0}
    try:
        result = await plugin.initialize(config)
        print(f"  ✅ Initialized: {result}")

        health = await plugin.health_check()
        print(f"  ✅ Device: {health.details.get('device', 'unknown')}")
        print(f"  ✅ Voices available: {health.details.get('voices_count', 0)}")
    except Exception as e:
        print(f"  ❌ Initialization failed: {e}")
        return False

    # 4. List voices
    print("\n[4/5] Listing voices...")
    voices = plugin.get_voices()
    print(f"  ✅ Found {len(voices)} voices")

    # Show first few voices
    for v in voices[:5]:
        print(f"     - {v.id}: {v.name} ({v.language})")
    if len(voices) > 5:
        print(f"     ... and {len(voices) - 5} more")

    # 5. Synthesize speech
    print("\n[5/5] Synthesizing speech...")
    test_text = "Hello! This is a test of the Kokoro text-to-speech plugin."

    try:
        from contracts.tts_contract import AudioFormat, SynthesisOptions

        options = SynthesisOptions(speed=1.0, format=AudioFormat.WAV)

        result = await plugin.synthesize(test_text, voice_id="af_heart", options=options)

        print("  ✅ Synthesis complete!")
        print(f"     - Duration: {result.duration_ms:.0f}ms")
        print(f"     - Format: {result.format.value}")
        print(f"     - Sample rate: {result.sample_rate}Hz")
        print(f"     - Audio size: {len(result.audio_data)} bytes")
        print(f"     - Device used: {result.metadata.get('device', 'unknown')}")

        # Save to file
        output_path = os.path.join(os.path.dirname(__file__), "test_output_kokoro.wav")
        with open(output_path, "wb") as f:
            f.write(result.audio_data)
        print(f"  📁 Saved to: {output_path}")

    except Exception as e:
        print(f"  ❌ Synthesis failed: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Cleanup
    await plugin.shutdown()

    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = asyncio.run(test_kokoro_tts())
    sys.exit(0 if success else 1)
