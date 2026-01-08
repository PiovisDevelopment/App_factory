"""
services/llm.py
================
High-Level LLM Service Facade

Provides a simple, AI-friendly API for language model interactions.
Automatically manages plugin lifecycle and provides sensible defaults.

Usage:
    from services.llm import LLMService

    # Simple one-liner usage
    llm = LLMService()
    response = await llm.ask("What is the capital of France?")

    # Chat with history
    llm.add_message("user", "Hello!")
    response = await llm.chat()

    # Stream responses
    async for chunk in llm.stream("Tell me a story"):
        print(chunk, end="", flush=True)
"""

import asyncio
from collections.abc import AsyncIterator
from typing import Any


class LLMService:
    """
    High-level facade for LLM operations.

    Automatically discovers, loads, and manages LLM plugins.
    Provides simple ask(), chat(), and stream() methods for AI agents.

    Attributes:
        model: Current model ID
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate
    """

    def __init__(
        self,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        base_url: str = "http://localhost:11434",
        auto_init: bool = True
    ):
        """
        Initialize the LLM Service.

        Args:
            model: Model ID to use (auto-selects first available if None)
            temperature: Sampling temperature (0.0 = deterministic)
            max_tokens: Maximum tokens to generate
            base_url: Ollama API base URL
            auto_init: If True, plugin is initialized on first use
        """
        self._plugin = None
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._base_url = base_url
        self._auto_init = auto_init
        self._initialized = False
        self._messages: list[dict[str, str]] = []
        self._system_prompt: str | None = None

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit with cleanup."""
        await self.shutdown()
        return False

    async def initialize(self) -> bool:
        """
        Initialize the LLM plugin.

        Returns:
            True if plugin initialized successfully.
        """
        if self._initialized:
            return True

        from plugins.llm_ollama_v2.plugin import OllamaLLMPlugin

        self._plugin = OllamaLLMPlugin()
        await self._plugin.initialize({
            "base_url": self._base_url,
            "default_model": self._model,
            "timeout": 60
        })

        # Auto-select first model if none specified
        if not self._model:
            models = self._plugin.get_models()
            if models:
                self._model = models[0].id
                self._plugin.set_model(self._model)

        self._initialized = True
        return True

    async def shutdown(self) -> None:
        """Shutdown and cleanup plugin."""
        if self._plugin:
            await self._plugin.shutdown()
            self._plugin = None

        self._initialized = False
        self._messages = []

    async def _ensure_initialized(self) -> None:
        """Ensure plugin is initialized (lazy loading)."""
        if not self._initialized and self._auto_init:
            await self.initialize()

    # =========================================================================
    # HIGH-LEVEL API - Simple methods for AI agents
    # =========================================================================

    async def ask(
        self,
        question: str,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None
    ) -> str:
        """
        Ask a single question and get a response.

        This is a stateless call - does not use or modify chat history.

        Args:
            question: The question or prompt
            model: Model to use (uses default if None)
            temperature: Sampling temperature (uses default if None)
            max_tokens: Max tokens (uses default if None)

        Returns:
            The model's response text

        Example:
            answer = await llm.ask("What is 2+2?")
            answer = await llm.ask("Write a poem", temperature=0.9)
        """
        await self._ensure_initialized()

        from contracts.llm_contract import CompletionOptions, Message, MessageRole

        messages = []
        if self._system_prompt:
            messages.append(Message(role=MessageRole.SYSTEM, content=self._system_prompt))
        messages.append(Message(role=MessageRole.USER, content=question))

        options = CompletionOptions(
            model=model or self._model,
            temperature=temperature if temperature is not None else self._temperature,
            max_tokens=max_tokens or self._max_tokens
        )

        result = await self._plugin.complete(messages, options)
        return result.content

    async def chat(
        self,
        message: str | None = None,
        model: str | None = None,
        temperature: float | None = None
    ) -> str:
        """
        Send a message in an ongoing conversation.

        Maintains chat history across calls.

        Args:
            message: User message to send (uses existing history if None)
            model: Model to use (uses default if None)
            temperature: Sampling temperature

        Returns:
            The assistant's response text

        Example:
            llm.set_system("You are a helpful assistant.")
            response = await llm.chat("Hello!")
            response = await llm.chat("What's the weather?")
        """
        await self._ensure_initialized()

        if message:
            self.add_message("user", message)

        from contracts.llm_contract import CompletionOptions, Message, MessageRole

        messages = []
        if self._system_prompt:
            messages.append(Message(role=MessageRole.SYSTEM, content=self._system_prompt))

        for msg in self._messages:
            messages.append(Message(
                role=MessageRole(msg["role"]),
                content=msg["content"]
            ))

        options = CompletionOptions(
            model=model or self._model,
            temperature=temperature if temperature is not None else self._temperature,
            max_tokens=self._max_tokens
        )

        result = await self._plugin.complete(messages, options)

        # Add assistant response to history
        self.add_message("assistant", result.content)

        return result.content

    async def stream(
        self,
        prompt: str,
        model: str | None = None,
        temperature: float | None = None
    ) -> AsyncIterator[str]:
        """
        Stream a response token by token.

        Args:
            prompt: The prompt to generate from
            model: Model to use (uses default if None)
            temperature: Sampling temperature

        Yields:
            Text chunks as they are generated

        Example:
            async for chunk in llm.stream("Tell me a story"):
                print(chunk, end="", flush=True)
        """
        await self._ensure_initialized()

        from contracts.llm_contract import CompletionOptions, Message, MessageRole

        messages = []
        if self._system_prompt:
            messages.append(Message(role=MessageRole.SYSTEM, content=self._system_prompt))
        messages.append(Message(role=MessageRole.USER, content=prompt))

        options = CompletionOptions(
            model=model or self._model,
            temperature=temperature if temperature is not None else self._temperature,
            max_tokens=self._max_tokens
        )

        async for chunk in self._plugin.complete_stream(messages, options):
            yield chunk.content

    # =========================================================================
    # CONVERSATION MANAGEMENT
    # =========================================================================

    def set_system(self, prompt: str) -> None:
        """
        Set the system prompt for conversations.

        Args:
            prompt: System prompt text

        Example:
            llm.set_system("You are a helpful coding assistant.")
        """
        self._system_prompt = prompt

    def add_message(self, role: str, content: str) -> None:
        """
        Add a message to conversation history.

        Args:
            role: "user" or "assistant"
            content: Message content
        """
        self._messages.append({"role": role, "content": content})

    def clear_history(self) -> None:
        """Clear conversation history."""
        self._messages = []

    def get_history(self) -> list[dict[str, str]]:
        """Get conversation history."""
        return self._messages.copy()

    # =========================================================================
    # MODEL MANAGEMENT
    # =========================================================================

    def get_models(self) -> list[dict[str, Any]]:
        """
        Get available models from Ollama.

        Returns:
            List of model dictionaries with id, name, size info
        """
        if not self._plugin:
            return []

        return [
            {
                "id": m.id,
                "name": m.name,
                "context_length": m.context_length,
                "capabilities": m.capabilities
            }
            for m in self._plugin.get_models()
        ]

    def set_model(self, model_id: str) -> None:
        """
        Set the active model.

        Args:
            model_id: Model ID (e.g., "llama3.2:3b")
        """
        self._model = model_id
        if self._plugin:
            self._plugin.set_model(model_id)

    async def refresh_models(self) -> list[dict[str, Any]]:
        """
        Refresh the list of available models from Ollama.

        Returns:
            Updated list of models
        """
        await self._ensure_initialized()
        await self._plugin._refresh_models()
        return self.get_models()

    # =========================================================================
    # PROPERTIES
    # =========================================================================

    @property
    def is_initialized(self) -> bool:
        """Check if service is initialized."""
        return self._initialized

    @property
    def current_model(self) -> str | None:
        """Get current model ID."""
        return self._model

    @property
    def is_ollama_running(self) -> bool:
        """Check if Ollama server is reachable."""
        if not self._plugin:
            return False
        health = asyncio.run(self._plugin.health_check())
        return health.status.value == "ready"
