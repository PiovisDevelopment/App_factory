"""
Test Script: Ollama LLM Plugin
==============================
Verifies the Ollama LLM plugin works correctly.

Prerequisites:
    1. Install Ollama: https://ollama.com/download
    2. Start Ollama: ollama serve (may run as service)
    3. Pull a model: ollama pull llama3.2

Usage:
    python test_ollama_llm.py
"""

import asyncio
import sys
import os

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)


async def test_ollama_llm():
    """Test the Ollama LLM plugin."""
    
    print("=" * 60)
    print("LLM OLLAMA PLUGIN TEST")
    print("=" * 60)
    
    # 1. Check Ollama availability
    print("\n[1/5] Checking Ollama server...")
    import urllib.request
    try:
        with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=2) as response:
            if response.status == 200:
                import json
                data = json.loads(response.read().decode())
                models = [m["name"] for m in data.get("models", [])]
                print(f"  OK Ollama is running")
                print(f"  OK Models installed: {len(models)}")
                for m in models[:5]:
                    print(f"     - {m}")
                if len(models) > 5:
                    print(f"     ... and {len(models) - 5} more")
    except Exception as e:
        print(f"  ERROR Ollama not running: {e}")
        print("     Start with: ollama serve")
        print("     Or install from: https://ollama.com/download")
        return False
    
    # 2. Load plugin
    print("\n[2/5] Loading Ollama LLM plugin...")
    try:
        from plugins.llm_ollama_v2.plugin import OllamaLLMPlugin
        plugin = OllamaLLMPlugin()
        print("  OK Plugin instantiated")
    except Exception as e:
        print(f"  ERROR Failed to load plugin: {e}")
        return False
    
    # 3. Initialize plugin
    print("\n[3/5] Initializing plugin...")
    config = {
        "base_url": "http://localhost:11434",
        "default_model": None,  # Auto-select first
        "timeout": 60
    }
    try:
        result = await plugin.initialize(config)
        print(f"  OK Initialized: {result}")
        
        health = await plugin.health_check()
        print(f"  OK Current model: {health.details.get('current_model', 'none')}")
        print(f"  OK Models available: {health.details.get('models_count', 0)}")
    except Exception as e:
        print(f"  ERROR Initialization failed: {e}")
        return False
    
    # 4. List models
    print("\n[4/5] Listing models...")
    models = plugin.get_models()
    print(f"  OK Found {len(models)} models")
    for m in models[:3]:
        print(f"     - {m.id}: ctx={m.context_length}, caps={m.capabilities}")
    
    if not models:
        print("  WARN No models found. Pull one with: ollama pull llama3.2")
        await plugin.shutdown()
        return True  # Not a failure, just no models
    
    # 5. Generate completion
    print("\n[5/5] Testing completion...")
    try:
        from contracts.llm_contract import Message, MessageRole, CompletionOptions
        
        messages = [
            Message(role=MessageRole.USER, content="What is 2+2? Reply with just the number.")
        ]
        
        options = CompletionOptions(
            temperature=0.0,
            max_tokens=50
        )
        
        print("  Generating response (this may take a moment)...")
        result = await plugin.complete(messages, options)
        
        print(f"  OK Completion received!")
        print(f"     - Response: \"{result.content.strip()[:100]}\"")
        print(f"     - Model: {result.model}")
        print(f"     - Tokens: {result.usage.total_tokens}")
        
    except Exception as e:
        print(f"  ERROR Completion failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Cleanup
    await plugin.shutdown()
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED!")
    print("=" * 60)
    return True


async def test_llm_service():
    """Test the high-level LLM service facade."""
    
    print("\n" + "=" * 60)
    print("LLM SERVICE FACADE TEST")
    print("=" * 60)
    
    try:
        from services.llm import LLMService
        
        print("\n[1/3] Creating LLM service...")
        async with LLMService(temperature=0.0) as llm:
            print(f"  OK Service initialized")
            print(f"  OK Current model: {llm.current_model}")
            
            models = llm.get_models()
            if not models:
                print("  WARN No models available")
                return True
            
            print("\n[2/3] Testing ask()...")
            response = await llm.ask("What is the capital of France? One word only.")
            print(f"  OK Response: \"{response.strip()[:50]}\"")
            
            print("\n[3/3] Testing chat()...")
            llm.set_system("You are a helpful assistant. Be concise.")
            response = await llm.chat("Hello!")
            print(f"  OK Response: \"{response.strip()[:50]}\"")
            
            response = await llm.chat("What's 5+5?")
            print(f"  OK Follow-up: \"{response.strip()[:50]}\"")
        
        print("\n" + "=" * 60)
        print("LLM SERVICE TESTS PASSED!")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Run plugin test
    success1 = asyncio.run(test_ollama_llm())
    
    # Run service test if plugin test passed
    if success1:
        success2 = asyncio.run(test_llm_service())
        sys.exit(0 if success2 else 1)
    else:
        sys.exit(1)
