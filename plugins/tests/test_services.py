"""
Test Script: Service Facades
============================
Tests all high-level service facades.

Usage:
    python test_services.py
"""

import asyncio
import os
import sys

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)


async def test_voice_service():
    """Test the VoiceService facade."""

    print("=" * 60)
    print("VOICE SERVICE FACADE TEST")
    print("=" * 60)

    try:
        from services.voice import VoiceService

        print("\n[1/4] Creating voice service...")
        async with VoiceService(
            tts_voice="af_heart",
            stt_model="tiny"  # Use tiny for fast testing
        ) as voice:

            print("  OK Service initialized")
            print(f"  OK TTS device: {voice.tts_device}")
            print(f"  OK STT device: {voice.stt_device}")

            print("\n[2/4] Testing speak()...")
            audio = await voice.speak("Hello, this is a test.")
            print(f"  OK Generated audio: {len(audio)} bytes")

            print("\n[3/4] Testing listen()...")
            text = await voice.listen(audio)
            print(f"  OK Transcribed: \"{text}\"")

            print("\n[4/4] Testing voices list...")
            voices = voice.get_voices()
            print(f"  OK Available voices: {len(voices)}")
            for v in voices[:3]:
                print(f"     - {v['id']}: {v['name']}")

        print("\n" + "=" * 60)
        print("VOICE SERVICE TESTS PASSED!")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_llm_service():
    """Test the LLMService facade."""

    print("\n" + "=" * 60)
    print("LLM SERVICE FACADE TEST")
    print("=" * 60)

    # Check if Ollama is running
    import urllib.request
    try:
        with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=2):
            pass
    except Exception:
        print("\n  SKIP Ollama not running, skipping LLM test")
        return True

    try:
        from services.llm import LLMService

        print("\n[1/3] Creating LLM service...")
        async with LLMService(temperature=0.0) as llm:

            models = llm.get_models()
            if not models:
                print("  SKIP No models available")
                return True

            print("  OK Service initialized")
            print(f"  OK Model: {llm.current_model}")

            print("\n[2/3] Testing ask()...")
            response = await llm.ask("What is 2+2? Answer with just the number.")
            print(f"  OK Response: \"{response.strip()[:50]}\"")

            print("\n[3/3] Testing chat with history...")
            llm.set_system("You are a math tutor. Be very concise.")
            await llm.chat("Hi!")
            response = await llm.chat("What's 10 times 5?")
            print(f"  OK Response: \"{response.strip()[:50]}\"")
            print(f"  OK History length: {len(llm.get_history())}")

        print("\n" + "=" * 60)
        print("LLM SERVICE TESTS PASSED!")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all service tests."""

    print("\n")
    print("*" * 60)
    print("* HIGH-LEVEL SERVICE FACADE TESTS")
    print("*" * 60)
    print("\nThese facades provide SIMPLE APIs for AI agents:\n")
    print("  VoiceService:")
    print("    audio = await voice.speak('Hello!')")
    print("    text = await voice.listen(audio)")
    print("")
    print("  LLMService:")
    print("    answer = await llm.ask('What is 2+2?')")
    print("    response = await llm.chat('Hello!')")
    print("")

    voice_ok = await test_voice_service()
    llm_ok = await test_llm_service()

    print("\n" + "*" * 60)
    print("* SUMMARY")
    print("*" * 60)
    print(f"  VoiceService: {'PASS' if voice_ok else 'FAIL'}")
    print(f"  LLMService:   {'PASS' if llm_ok else 'FAIL'}")
    print("*" * 60)

    return voice_ok and llm_ok


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
