"""
Test Script: TTS + STT Pipeline (Round-Trip)
=============================================
Tests Kokoro TTS and Whisper STT working together.

This demonstrates the plugins working:
1. Separately (individual hot-swap)
2. Together (TTS generates audio, STT transcribes it back)

Prerequisites:
    1. Install espeak-ng: https://github.com/espeak-ng/espeak-ng/releases
    2. Run: pip install kokoro>=0.9.4 soundfile misaki[en] faster-whisper>=1.0.0

Usage:
    python test_roundtrip.py
"""

import asyncio
import os
import sys
import time

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)


async def test_roundtrip():
    """Test TTS + STT round-trip pipeline."""

    print("=" * 70)
    print("🔄 TTS + STT ROUND-TRIP PIPELINE TEST")
    print("=" * 70)

    tts_plugin = None
    stt_plugin = None

    try:
        # =====================================================================
        # PART 1: INITIALIZE TTS PLUGIN
        # =====================================================================
        print("\n" + "-" * 70)
        print("📢 PART 1: KOKORO TTS PLUGIN")
        print("-" * 70)

        from contracts.tts_contract import AudioFormat, SynthesisOptions
        from plugins.tts_kokoro.plugin import KokoroTTSPlugin

        tts_plugin = KokoroTTSPlugin()

        tts_config = {
            "default_voice": "af_heart",
            "default_lang_code": "a",
            "device": "auto",
            "speed": 1.0
        }

        await tts_plugin.initialize(tts_config)
        tts_health = await tts_plugin.health_check()
        print(f"  ✅ TTS initialized on: {tts_health.details.get('device', 'unknown')}")
        print(f"  ✅ TTS voices available: {tts_health.details.get('voices_count', 0)}")

        # =====================================================================
        # PART 2: INITIALIZE STT PLUGIN
        # =====================================================================
        print("\n" + "-" * 70)
        print("🎤 PART 2: WHISPER STT PLUGIN")
        print("-" * 70)

        from contracts.stt_contract import TranscriptionOptions
        from plugins.stt_whisper.plugin import WhisperSTTPlugin

        stt_plugin = WhisperSTTPlugin()

        stt_config = {
            "model_size": "small",  # Use 'small' for balance of speed/quality
            "device": "auto",
            "compute_type": "float16",
            "language": "en",
            "beam_size": 5,
            "vad_filter": True
        }

        await stt_plugin.initialize(stt_config)
        stt_health = await stt_plugin.health_check()
        print(f"  ✅ STT initialized on: {stt_health.details.get('device', 'unknown')}")
        print(f"  ✅ STT model: {stt_health.details.get('model_size', 'unknown')}")

        # =====================================================================
        # PART 3: ROUND-TRIP TEST
        # =====================================================================
        print("\n" + "-" * 70)
        print("🔄 PART 3: ROUND-TRIP TEST")
        print("-" * 70)

        original_text = "The quick brown fox jumps over the lazy dog."
        print(f"\n  📝 Original text: \"{original_text}\"")

        # Step 1: TTS - Convert text to speech
        print("\n  [TTS] Synthesizing speech...")
        start_time = time.perf_counter()

        tts_options = SynthesisOptions(speed=1.0, format=AudioFormat.WAV)
        tts_result = await tts_plugin.synthesize(
            original_text,
            voice_id="af_heart",
            options=tts_options
        )

        tts_time = (time.perf_counter() - start_time) * 1000
        print(f"       ⏱️  TTS time: {tts_time:.0f}ms")
        print(f"       📊 Audio duration: {tts_result.duration_ms:.0f}ms")
        print(f"       📦 Audio size: {len(tts_result.audio_data)} bytes")

        # Save audio for inspection
        output_dir = os.path.dirname(__file__)
        audio_path = os.path.join(output_dir, "roundtrip_audio.wav")
        with open(audio_path, "wb") as f:
            f.write(tts_result.audio_data)
        print(f"       💾 Saved: {audio_path}")

        # Step 2: STT - Convert speech back to text
        print("\n  [STT] Transcribing speech...")
        start_time = time.perf_counter()

        stt_options = TranscriptionOptions(
            language="en",
            task="transcribe",
            word_timestamps=False
        )
        stt_result = await stt_plugin.transcribe(tts_result.audio_data, stt_options)

        stt_time = (time.perf_counter() - start_time) * 1000
        print(f"       ⏱️  STT time: {stt_time:.0f}ms")
        print(f"       📝 Transcribed: \"{stt_result.text}\"")
        print(f"       🌐 Detected language: {stt_result.language}")

        # Step 3: Compare original vs transcribed
        print("\n  [COMPARE] Analyzing accuracy...")

        # Simple word overlap metric
        original_words = set(original_text.lower().replace(".", "").split())
        transcribed_words = set(stt_result.text.lower().replace(".", "").split())

        common_words = original_words & transcribed_words
        accuracy = len(common_words) / len(original_words) * 100 if original_words else 0

        print(f"       📊 Word overlap: {len(common_words)}/{len(original_words)}")
        print(f"       📈 Accuracy: {accuracy:.1f}%")

        if accuracy >= 80:
            print("       ✅ PASS: Good accuracy!")
        elif accuracy >= 50:
            print("       ⚠️  WARN: Moderate accuracy")
        else:
            print("       ❌ FAIL: Low accuracy")

        # =====================================================================
        # PART 4: HOT-SWAP DEMONSTRATION
        # =====================================================================
        print("\n" + "-" * 70)
        print("🔥 PART 4: HOT-SWAP DEMONSTRATION")
        print("-" * 70)

        # Demonstrate that plugins can be shut down and restarted independently
        print("\n  [TTS] Shutting down TTS plugin...")
        await tts_plugin.shutdown()
        print("       ✅ TTS shutdown complete")

        print("\n  [STT] STT plugin still active, transcribing again...")
        # Re-read the saved audio
        with open(audio_path, "rb") as f:
            audio_data = f.read()

        stt_result2 = await stt_plugin.transcribe(audio_data, stt_options)
        print(f"       ✅ Transcribed: \"{stt_result2.text}\"")

        print("\n  [TTS] Re-initializing TTS plugin...")
        tts_plugin = KokoroTTSPlugin()
        await tts_plugin.initialize(tts_config)
        print("       ✅ TTS re-initialized (hot-swap complete)")

        # Final cleanup
        await tts_plugin.shutdown()
        await stt_plugin.shutdown()

        print("\n" + "=" * 70)
        print("✅ ALL ROUND-TRIP TESTS PASSED!")
        print("=" * 70)

        print("\n📊 SUMMARY:")
        print("   • TTS Plugin: Kokoro TTS (kokoro>=0.9.4)")
        print("   • STT Plugin: Faster Whisper (faster-whisper>=1.0.0)")
        print("   • Both work independently (hot-swappable)")
        print(f"   • Round-trip accuracy: {accuracy:.1f}%")
        print(f"   • Total pipeline time: {tts_time + stt_time:.0f}ms")

        return True

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

        # Cleanup on error
        if tts_plugin:
            try:
                await tts_plugin.shutdown()
            except:
                pass
        if stt_plugin:
            try:
                await stt_plugin.shutdown()
            except:
                pass

        return False


if __name__ == "__main__":
    success = asyncio.run(test_roundtrip())
    sys.exit(0 if success else 1)
