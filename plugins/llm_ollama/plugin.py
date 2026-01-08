"""
Plugin: llm_ollama
Description: Local LLM inference via Ollama with fallback mock mode.
"""

import json
import time
import urllib.error
import urllib.request

from plugins._host import PluginBase


class Plugin(PluginBase):
    def initialize(self):
        """Initialize the plugin."""
        self.logger.info("Initializing llm_ollama...")
        self.register_method("complete", self.complete)
        self.register_method("complete_stream", self.complete_stream)
        self.register_method("get_models", self.get_models)
        self.logger.info("llm_ollama initialized")

    def shutdown(self):
        """Shutdown the plugin."""
        self.logger.info("Shutting down llm_ollama")

    def health_check(self) -> dict:
        """Check if Ollama is reachable."""
        try:
            with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=1) as response:
                if response.status == 200:
                    return {"status": "healthy", "details": "Ollama is running"}
        except Exception:
            pass
        return {"status": "degraded", "details": "Ollama unreachable, using mock mode"}

    def get_models(self) -> list:
        """Get available models."""
        try:
            with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=2) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    return [model["name"] for model in data.get("models", [])]
        except Exception:
            pass
        return ["mock-model-v1"]

    def complete(self, prompt: str, model: str = "llama3") -> dict:
        """Generate a completion."""
        self.logger.info(f"Generating completion for prompt: {prompt[:50]}...")

        # Try Ollama first
        try:
            data = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode()

            req = urllib.request.Request(
                "http://localhost:11434/api/generate", data=data, headers={"Content-Type": "application/json"}
            )

            with urllib.request.urlopen(req, timeout=30) as response:
                if response.status == 200:
                    result = json.loads(response.read().decode())
                    return {"text": result.get("response", "")}
        except Exception as e:
            self.logger.warning(f"Ollama connection failed: {e}. Using mock fallback.")

        # Fallback Mock Mode
        time.sleep(1)  # Simulate latency

        # Simple heuristic to generate relevant mock code
        if "button" in prompt.lower():
            code = """import React from 'react';
import { Button } from '@/components/ui/button';

export const GeneratedButton = () => {
  return (
    <Button variant="primary" onClick={() => alert('Clicked!')}>
      Click Me
    </Button>
  );
};"""
        elif "input" in prompt.lower():
            code = """import React from 'react';
import { Input } from '@/components/ui/input';

export const GeneratedInput = () => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Email Address</label>
      <Input type="email" placeholder="Enter your email" />
    </div>
  );
};"""
        else:
            code = """import React from 'react';

export const GeneratedComponent = () => {
  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-2">Generated Component</h3>
      <p className="text-gray-600">
        This is a placeholder component generated in mock mode.
      </p>
    </div>
  );
};"""

        return {"text": code, "mock": True}

    def complete_stream(self, prompt: str, model: str = "llama3"):
        """Stream a completion (Generator)."""
        # Not implemented for this MVP, falling back to complete behavior wrapped in generator
        result = self.complete(prompt, model)
        yield {"chunk": result["text"], "done": True}
