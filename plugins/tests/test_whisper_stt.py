"""
Test Script: Whisper STT Plugin
===============================
Verifies the faster-whisper STT plugin works correctly.

Prerequisites:
    1. Run: pip install faster-whisper>=1.0.0 soundfile

Usage:
    python test_whisper_stt.py [path_to_audio_file]
"""

import asyncio
import os
import sys

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)


async def test_whisper_stt(audio_file: str = None):
    """Test the Whisper STT plugin."""

    print("=" * 60)
    print("🎤 WHISPER STT PLUGIN TEST")
    print("=" * 60)

    # 1. Check dependencies
    print("\n[1/5] Checking dependencies...")
    try:
        import ctranslate2
        print("  ✅ CTranslate2: installed")
        # Check CUDA availability
        try:
            cuda_types = ctranslate2.get_supported_compute_types("cuda")
            print(f"  ✅ CUDA compute types: {cuda_types}")
            cuda_available = len(cuda_types) > 0
        except Exception:
            cuda_available = False
        print(f"  ✅ CUDA available: {cuda_available}")
    except ImportError as e:
        print(f"  ⚠️  CTranslate2 not found: {e}")

    try:
        import faster_whisper
        print("  ✅ faster-whisper: installed")
    except ImportError as e:
        print(f"  ❌ faster-whisper not found: {e}")
        print("     Run: pip install faster-whisper>=1.0.0")
        return False

    try:
        import soundfile as sf
        print("  ✅ SoundFile: installed")
    except ImportError as e:
        print(f"  ❌ SoundFile not found: {e}")
        return False

    # 2. Load plugin
    print("\n[2/5] Loading Whisper STT plugin...")
    try:
        from plugins.stt_whisper.plugin import WhisperSTTPlugin
        plugin = WhisperSTTPlugin()
        print("  ✅ Plugin instantiated")
    except Exception as e:
        print(f"  ❌ Failed to load plugin: {e}")
        return False

    # 3. Initialize plugin with smaller model for testing
    print("\n[3/5] Initializing plugin...")
    config = {
        "model_size": "tiny",  # Use tiny for fast testing
        "device": "auto",
        "compute_type": "float16",
        "language": None,  # Auto-detect
        "beam_size": 5,
        "vad_filter": True
    }
    try:
        result = await plugin.initialize(config)
        print(f"  ✅ Initialized: {result}")

        health = await plugin.health_check()
        print(f"  ✅ Device: {health.details.get('device', 'unknown')}")
        print(f"  ✅ Model: {health.details.get('model_size', 'unknown')}")
        print(f"  ✅ Compute type: {health.details.get('compute_type', 'unknown')}")
    except Exception as e:
        print(f"  ❌ Initialization failed: {e}")
        return False

    # 4. Check supported languages
    print("\n[4/5] Checking capabilities...")
    languages = plugin.get_supported_languages()
    print(f"  ✅ Supported languages: {len(languages)}")
    print(f"  ✅ Translation support: {plugin.supports_translation()}")
    print(f"  ✅ Streaming support: {plugin.supports_streaming()}")

    models = plugin.get_available_models()
    print(f"  ✅ Available models: {len(models)}")
    for m in models[:3]:
        print(f"     - {m['id']}: {m['params']} params, {m['vram_gb']}GB VRAM")

    # 5. Transcribe audio (if file provided or TTS output exists)
    print("\n[5/5] Testing transcription...")

    # Check for audio file
    test_audio = None

    if audio_file and os.path.exists(audio_file):
        test_audio = audio_file
        print(f"  📁 Using provided file: {test_audio}")
    else:
        # Check for Kokoro test output
        kokoro_output = os.path.join(os.path.dirname(__file__), "test_output_kokoro.wav")
        if os.path.exists(kokoro_output):
            test_audio = kokoro_output
            print(f"  📁 Using Kokoro TTS output: {test_audio}")

    if test_audio:
        try:
            # Read audio file
            with open(test_audio, "rb") as f:
                audio_data = f.read()
            print(f"  📊 Audio size: {len(audio_data)} bytes")

            from contracts.stt_contract import TranscriptionOptions

            options = TranscriptionOptions(
                language=None,  # Auto-detect
                task="transcribe",
                word_timestamps=True
            )

            result = await plugin.transcribe(audio_data, options)

            print("  ✅ Transcription complete!")
            print(f"     - Text: \"{result.text}\"")
            print(f"     - Language: {result.language}")
            print(f"     - Duration: {result.duration_ms:.0f}ms")
            print(f"     - Segments: {len(result.segments)}")

            if result.segments and result.segments[0].words:
                print(f"     - Words in first segment: {len(result.segments[0].words)}")

        except Exception as e:
            print(f"  ❌ Transcription failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    else:
        print("  ⚠️  No audio file available for testing.")
        print("     Run test_kokoro_tts.py first, or provide an audio file:")
        print("     python test_whisper_stt.py path/to/audio.wav")

    # Cleanup
    await plugin.shutdown()

    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    audio_file = sys.argv[1] if len(sys.argv) > 1 else None
    success = asyncio.run(test_whisper_stt(audio_file))
    sys.exit(0 if success else 1)
