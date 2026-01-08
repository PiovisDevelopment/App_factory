"""
D004 - contracts/llm_contract.py
================================
Large Language Model contract defining the interface for LLM plugins.

Extends: PluginBase (D001)
Prefix: llm_ (defined in config/contract_prefixes.yaml D005)

All LLM plugins (Ollama, Gemini, OpenAI, etc.) MUST implement this contract.
"""

from abc import abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

# Import from D001 - no forward references
from .base import PluginBase


class MessageRole(Enum):
    """Role of message sender in conversation."""

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class FinishReason(Enum):
    """Reason for completion termination."""

    STOP = "stop"  # Natural stop (EOS token)
    LENGTH = "length"  # Max tokens reached
    TOOL_CALLS = "tool_calls"  # Model wants to call tools
    CONTENT_FILTER = "content_filter"  # Blocked by safety filter
    ERROR = "error"  # Generation error


@dataclass
class Message:
    """
    A message in the conversation.

    Attributes:
        role: Message sender role (system, user, assistant, tool)
        content: Message text content
        name: Optional name for tool messages
        tool_call_id: ID linking tool result to tool call
        tool_calls: List of tool calls requested by assistant
    """

    role: MessageRole
    content: str
    name: str | None = None
    tool_call_id: str | None = None
    tool_calls: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize message for API calls."""
        result: dict[str, Any] = {
            "role": self.role.value,
            "content": self.content,
        }
        if self.name:
            result["name"] = self.name
        if self.tool_call_id:
            result["tool_call_id"] = self.tool_call_id
        if self.tool_calls:
            result["tool_calls"] = self.tool_calls
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Message":
        """Create message from dictionary."""
        return cls(
            role=MessageRole(data["role"]),
            content=data.get("content", ""),
            name=data.get("name"),
            tool_call_id=data.get("tool_call_id"),
            tool_calls=data.get("tool_calls", []),
        )


@dataclass
class Model:
    """
    LLM model definition.

    Attributes:
        id: Unique model identifier (e.g., "llama3.2:3b")
        name: Human-readable model name
        provider: Model provider (e.g., "ollama", "openai")
        context_length: Maximum context window in tokens
        description: Model description
        capabilities: List of capabilities ("chat", "completion", "vision", "tools")
    """

    id: str
    name: str
    provider: str
    context_length: int = 4096
    description: str = ""
    capabilities: list[str] = field(default_factory=lambda: ["chat"])

    def to_dict(self) -> dict[str, Any]:
        """Serialize model for JSON-RPC responses."""
        return {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "context_length": self.context_length,
            "description": self.description,
            "capabilities": self.capabilities,
        }


@dataclass
class CompletionOptions:
    """
    Options for LLM completion.

    Attributes:
        model: Model ID to use (None = use default)
        temperature: Sampling temperature (0.0 = deterministic)
        max_tokens: Maximum tokens to generate
        top_p: Nucleus sampling parameter
        top_k: Top-k sampling parameter
        stop: Stop sequences
        presence_penalty: Presence penalty (-2.0 to 2.0)
        frequency_penalty: Frequency penalty (-2.0 to 2.0)
        tools: List of tool definitions for function calling
        tool_choice: Tool selection strategy ("auto", "none", or specific tool)
    """

    model: str | None = None
    temperature: float = 0.0  # Default to deterministic per project spec
    max_tokens: int = 1024
    top_p: float = 1.0
    top_k: int = 40
    stop: list[str] = field(default_factory=list)
    presence_penalty: float = 0.0
    frequency_penalty: float = 0.0
    tools: list[dict[str, Any]] = field(default_factory=list)
    tool_choice: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CompletionOptions":
        """Create options from dictionary."""
        return cls(
            model=data.get("model"),
            temperature=data.get("temperature", 0.0),
            max_tokens=data.get("max_tokens", 1024),
            top_p=data.get("top_p", 1.0),
            top_k=data.get("top_k", 40),
            stop=data.get("stop", []),
            presence_penalty=data.get("presence_penalty", 0.0),
            frequency_penalty=data.get("frequency_penalty", 0.0),
            tools=data.get("tools", []),
            tool_choice=data.get("tool_choice"),
        )


@dataclass
class TokenUsage:
    """
    Token usage statistics.

    Attributes:
        prompt_tokens: Tokens in the prompt
        completion_tokens: Tokens in the completion
        total_tokens: Total tokens used
    """

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

    def to_dict(self) -> dict[str, Any]:
        """Serialize usage for JSON-RPC responses."""
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
        }


@dataclass
class CompletionResult:
    """
    Result of LLM completion operation.

    Attributes:
        content: Generated text content
        finish_reason: Reason for completion termination
        model: Model that generated the response
        usage: Token usage statistics
        tool_calls: Tool calls requested by the model (if any)
        metadata: Additional provider-specific metadata
    """

    content: str
    finish_reason: FinishReason
    model: str
    usage: TokenUsage
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize result for JSON-RPC responses."""
        return {
            "content": self.content,
            "finish_reason": self.finish_reason.value,
            "model": self.model,
            "usage": self.usage.to_dict(),
            "tool_calls": self.tool_calls,
            "metadata": self.metadata,
        }


@dataclass
class StreamChunk:
    """
    A chunk from streaming completion.

    Attributes:
        content: Text content in this chunk (may be empty)
        finish_reason: Set on final chunk only
        tool_calls: Partial tool call data (accumulated)
    """

    content: str = ""
    finish_reason: FinishReason | None = None
    tool_calls: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize chunk for JSON-RPC responses."""
        result: dict[str, Any] = {"content": self.content}
        if self.finish_reason:
            result["finish_reason"] = self.finish_reason.value
        if self.tool_calls:
            result["tool_calls"] = self.tool_calls
        return result


class LLMContract(PluginBase):
    """
    Abstract contract for Large Language Model plugins.

    All LLM plugins must implement this interface to be compatible
    with the Plugin Host's LLM slot.

    JSON-RPC Methods (routed by Plugin Host):
        - llm/complete: Generate completion for messages
        - llm/stream: Stream completion tokens
        - llm/models: List available models
        - llm/model/set: Set active model

    Example Implementation:
        class OllamaLLMPlugin(LLMContract):
            async def initialize(self, config):
                self._client = OllamaClient(config["base_url"])
                self._models = await self._client.list_models()
                self._current_model = config.get("default_model", "llama3.2:3b")
                self._status = PluginStatus.READY
                return True

            async def complete(self, messages, options=None):
                response = await self._client.chat(
                    model=options.model or self._current_model,
                    messages=messages,
                    ...
                )
                return CompletionResult(...)
    """

    def __init__(self) -> None:
        """Initialize LLM plugin instance."""
        super().__init__()
        self._current_model: str | None = None
        self._models: list[Model] = []

    @abstractmethod
    async def complete(self, messages: list[Message], options: CompletionOptions | None = None) -> CompletionResult:
        """
        Generate completion for conversation messages.

        Args:
            messages: Conversation history as list of Messages.
            options: Completion options (model, temperature, etc.)

        Returns:
            CompletionResult containing generated content.

        Raises:
            ValueError: If messages list is empty.
            RuntimeError: If completion fails.
        """
        pass

    @abstractmethod
    async def complete_stream(
        self, messages: list[Message], options: CompletionOptions | None = None
    ) -> AsyncIterator[StreamChunk]:
        """
        Stream completion tokens for conversation messages.

        Args:
            messages: Conversation history as list of Messages.
            options: Completion options.

        Yields:
            StreamChunk containing content deltas.

        Raises:
            ValueError: If messages list is empty.
            RuntimeError: If streaming fails.
        """
        pass

    @abstractmethod
    def get_models(self) -> list[Model]:
        """
        Get list of available models.

        Returns:
            List of Model objects supported by this plugin.
        """
        pass

    def set_model(self, model_id: str) -> bool:
        """
        Set the active model for completions.

        Args:
            model_id: ID of model to activate.

        Returns:
            True if model was set successfully, False otherwise.

        Raises:
            ValueError: If model_id is not found.
        """
        model_ids = [m.id for m in self._models]
        if model_id not in model_ids:
            raise ValueError(f"Model '{model_id}' not found. Available: {model_ids}")
        self._current_model = model_id
        return True

    def get_current_model(self) -> str | None:
        """
        Get the currently active model ID.

        Returns:
            Current model ID or None if not set.
        """
        return self._current_model

    def supports_streaming(self) -> bool:
        """
        Check if plugin supports streaming completion.

        Returns:
            True if streaming is supported, False otherwise.
        """
        return True  # Most LLMs support streaming

    def supports_tools(self) -> bool:
        """
        Check if plugin supports function/tool calling.

        Returns:
            True if tools are supported, False otherwise.
        """
        return False

    def supports_vision(self) -> bool:
        """
        Check if plugin supports image inputs.

        Returns:
            True if vision is supported, False otherwise.
        """
        return False

    def get_context_length(self, model_id: str | None = None) -> int:
        """
        Get context length for a model.

        Args:
            model_id: Model to check. Uses current model if None.

        Returns:
            Maximum context length in tokens.
        """
        target = model_id or self._current_model
        for model in self._models:
            if model.id == target:
                return model.context_length
        return 4096  # Default fallback
