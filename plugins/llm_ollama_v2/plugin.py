"""
llm_ollama_v2/plugin.py
=======================
Ollama LLM Plugin Implementation

Local LLM inference via Ollama server API.
Connects to locally installed models including Llama, Mistral, Gemma, Phi, etc.

API Documentation: https://github.com/ollama/ollama/blob/main/docs/api.md

Dependencies:
    - D001: contracts/base.py (PluginBase)
    - D004: contracts/llm_contract.py (LLMContract)
"""

import asyncio
import json
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional, AsyncIterator

from contracts.base import PluginStatus, HealthStatus
from contracts.llm_contract import (
    LLMContract,
    Message,
    MessageRole,
    Model,
    CompletionOptions,
    CompletionResult,
    StreamChunk,
    TokenUsage,
    FinishReason,
)


class OllamaLLMPlugin(LLMContract):
    """
    Ollama LLM Plugin - Local language model inference.
    
    Connects to a locally running Ollama server to provide access
    to installed models like Llama, Mistral, Gemma, Phi, and more.
    
    Features:
        - Auto-discovery of installed models
        - Streaming and non-streaming completions
        - Chat and single-turn modes
        - Model hot-swapping
        - Graceful fallback when Ollama is unavailable
    
    Prerequisites:
        1. Install Ollama: https://ollama.com/download
        2. Start Ollama: ollama serve (or it runs as a service)
        3. Pull models: ollama pull llama3.2
    """

    def __init__(self):
        """Initialize the Ollama LLM plugin."""
        super().__init__()
        self._base_url: str = "http://localhost:11434"
        self._timeout: int = 60
        self._keep_alive: str = "5m"
        self._initialized: bool = False
        self._ollama_available: bool = False

    async def initialize(self, config: Dict[str, Any]) -> bool:
        """
        Initialize the Ollama LLM plugin.
        
        Args:
            config: Configuration from manifest or user overrides.
                - base_url: str (Ollama API URL)
                - default_model: str (model to use by default)
                - timeout: int (request timeout in seconds)
                - keep_alive: str (how long to keep model loaded)
        
        Returns:
            True if initialization succeeded.
        """
        try:
            self._base_url = config.get("base_url", "http://localhost:11434")
            self._timeout = config.get("timeout", 60)
            self._keep_alive = config.get("keep_alive", "5m")
            default_model = config.get("default_model")
            
            # Check if Ollama is available and fetch models
            await self._refresh_models()
            
            # Set default model
            if default_model and any(m.id == default_model for m in self._models):
                self._current_model = default_model
            elif self._models:
                self._current_model = self._models[0].id
            
            self._initialized = True
            self._status = PluginStatus.READY
            
            return True
            
        except Exception as e:
            self._status = PluginStatus.ERROR
            raise RuntimeError(f"Ollama initialization failed: {e}")

    async def shutdown(self) -> None:
        """Clean up plugin resources."""
        self._models = []
        self._current_model = None
        self._initialized = False
        self._status = PluginStatus.UNLOADED

    async def health_check(self) -> HealthStatus:
        """
        Check plugin health and Ollama availability.
        
        Returns:
            HealthStatus with current state and diagnostics.
        """
        # Check Ollama connectivity
        ollama_status = await self._check_ollama()
        
        details = {
            "initialized": self._initialized,
            "ollama_available": ollama_status,
            "base_url": self._base_url,
            "current_model": self._current_model,
            "models_count": len(self._models),
            "models": [m.id for m in self._models[:5]],  # First 5
        }
        
        if ollama_status:
            return HealthStatus(
                status=PluginStatus.READY,
                message="Ollama LLM operational",
                details=details
            )
        else:
            return HealthStatus(
                status=PluginStatus.ERROR,
                message="Ollama server not reachable",
                details=details
            )

    async def _check_ollama(self) -> bool:
        """Check if Ollama server is reachable."""
        def check():
            try:
                req = urllib.request.Request(f"{self._base_url}/api/tags")
                with urllib.request.urlopen(req, timeout=2) as response:
                    return response.status == 200
            except Exception:
                return False
        
        return await asyncio.to_thread(check)

    async def _refresh_models(self) -> None:
        """Fetch available models from Ollama."""
        def fetch_models():
            try:
                req = urllib.request.Request(f"{self._base_url}/api/tags")
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        return data.get("models", [])
            except Exception:
                pass
            return []
        
        raw_models = await asyncio.to_thread(fetch_models)
        
        self._models = []
        for m in raw_models:
            model_name = m.get("name", "unknown")
            
            # Parse model details
            details = m.get("details", {})
            param_size = details.get("parameter_size", "")
            family = details.get("family", "")
            
            # Estimate context length based on model family
            context_length = self._estimate_context_length(model_name, family)
            
            # Determine capabilities
            capabilities = ["chat"]
            if "vision" in model_name.lower() or "llava" in model_name.lower():
                capabilities.append("vision")
            if "embed" in model_name.lower():
                capabilities.append("embeddings")
            
            self._models.append(Model(
                id=model_name,
                name=model_name,
                provider="ollama",
                context_length=context_length,
                description=f"{family} {param_size}".strip(),
                capabilities=capabilities
            ))
        
        self._ollama_available = len(self._models) > 0

    def _estimate_context_length(self, model_name: str, family: str) -> int:
        """Estimate context length based on model name/family."""
        name_lower = model_name.lower()
        
        # Known context lengths
        if "llama3" in name_lower or "llama-3" in name_lower:
            return 128000
        if "llama2" in name_lower or "llama-2" in name_lower:
            return 4096
        if "mistral" in name_lower:
            return 32768
        if "gemma" in name_lower:
            return 8192
        if "phi" in name_lower:
            return 16384
        if "qwen" in name_lower:
            return 32768
        if "codellama" in name_lower:
            return 16384
        
        # Default
        return 4096

    async def complete(
        self,
        messages: List[Message],
        options: Optional[CompletionOptions] = None
    ) -> CompletionResult:
        """
        Generate completion for conversation messages.
        
        Args:
            messages: Conversation history as list of Messages.
            options: Completion options (model, temperature, etc.)
        
        Returns:
            CompletionResult containing generated content.
        """
        if not messages:
            raise ValueError("Messages list cannot be empty")
        
        opts = options or CompletionOptions()
        model = opts.model or self._current_model
        
        if not model:
            raise RuntimeError("No model selected. Call set_model() first or ensure Ollama has models.")
        
        # Build API request
        api_messages = [
            {"role": m.role.value, "content": m.content}
            for m in messages
        ]
        
        payload = {
            "model": model,
            "messages": api_messages,
            "stream": False,
            "options": {
                "temperature": opts.temperature,
                "num_predict": opts.max_tokens,
                "top_p": opts.top_p,
                "top_k": opts.top_k,
            }
        }
        
        if opts.stop:
            payload["options"]["stop"] = opts.stop
        
        def do_request():
            try:
                data = json.dumps(payload).encode()
                req = urllib.request.Request(
                    f"{self._base_url}/api/chat",
                    data=data,
                    headers={"Content-Type": "application/json"}
                )
                
                with urllib.request.urlopen(req, timeout=self._timeout) as response:
                    if response.status == 200:
                        result = json.loads(response.read().decode())
                        return result
            except Exception as e:
                raise RuntimeError(f"Ollama API error: {e}")
        
        result = await asyncio.to_thread(do_request)
        
        # Parse response
        message = result.get("message", {})
        content = message.get("content", "")
        
        # Token usage (Ollama provides these)
        prompt_tokens = result.get("prompt_eval_count", 0)
        completion_tokens = result.get("eval_count", 0)
        
        return CompletionResult(
            content=content,
            finish_reason=FinishReason.STOP,
            model=model,
            usage=TokenUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens
            ),
            metadata={
                "plugin": "llm_ollama_v2",
                "total_duration_ns": result.get("total_duration"),
                "load_duration_ns": result.get("load_duration"),
                "eval_duration_ns": result.get("eval_duration"),
            }
        )

    async def complete_stream(
        self,
        messages: List[Message],
        options: Optional[CompletionOptions] = None
    ) -> AsyncIterator[StreamChunk]:
        """
        Stream completion tokens for conversation messages.
        
        Args:
            messages: Conversation history as list of Messages.
            options: Completion options.
        
        Yields:
            StreamChunk containing content deltas.
        """
        if not messages:
            raise ValueError("Messages list cannot be empty")
        
        opts = options or CompletionOptions()
        model = opts.model or self._current_model
        
        if not model:
            raise RuntimeError("No model selected.")
        
        # Build API request
        api_messages = [
            {"role": m.role.value, "content": m.content}
            for m in messages
        ]
        
        payload = {
            "model": model,
            "messages": api_messages,
            "stream": True,
            "options": {
                "temperature": opts.temperature,
                "num_predict": opts.max_tokens,
                "top_p": opts.top_p,
                "top_k": opts.top_k,
            }
        }
        
        def stream_request():
            """Generator that yields response lines."""
            try:
                data = json.dumps(payload).encode()
                req = urllib.request.Request(
                    f"{self._base_url}/api/chat",
                    data=data,
                    headers={"Content-Type": "application/json"}
                )
                
                with urllib.request.urlopen(req, timeout=self._timeout) as response:
                    for line in response:
                        if line:
                            yield json.loads(line.decode())
            except Exception as e:
                raise RuntimeError(f"Ollama streaming error: {e}")
        
        # Run streaming in thread and yield chunks
        import queue
        import threading
        
        q = queue.Queue()
        error_holder = [None]
        
        def producer():
            try:
                for chunk in stream_request():
                    q.put(chunk)
            except Exception as e:
                error_holder[0] = e
            finally:
                q.put(None)  # Sentinel
        
        thread = threading.Thread(target=producer, daemon=True)
        thread.start()
        
        while True:
            # Get chunk with timeout to allow async cancellation
            chunk = await asyncio.to_thread(q.get, timeout=self._timeout)
            
            if chunk is None:
                if error_holder[0]:
                    raise error_holder[0]
                break
            
            message = chunk.get("message", {})
            content = message.get("content", "")
            done = chunk.get("done", False)
            
            yield StreamChunk(
                content=content,
                finish_reason=FinishReason.STOP if done else None
            )

    def get_models(self) -> List[Model]:
        """
        Get list of available models from Ollama.
        
        Returns:
            List of Model objects for installed Ollama models.
        """
        return self._models.copy()

    def supports_streaming(self) -> bool:
        """Ollama supports streaming."""
        return True

    def supports_tools(self) -> bool:
        """Tool calling support depends on model."""
        return False  # Conservative default

    def supports_vision(self) -> bool:
        """Vision support depends on model (e.g., llava)."""
        # Check if current model has vision capability
        for m in self._models:
            if m.id == self._current_model and "vision" in m.capabilities:
                return True
        return False


# Export for plugin discovery
Plugin = OllamaLLMPlugin
