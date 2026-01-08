"""
Audio-UI neutrality helpers for ppf_create_application.

Implements:
- Intent classification to derive a `audio_intent` feature flag from user prompts.
- A static validator that checks generated React files for audio-specific UI
  patterns when `audio_intent` is False.

This module is read-only with respect to the filesystem: it never mutates files.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

AudioIntentTokens = dict[str, list[str]]


# Tokens that strongly indicate explicit audio intent.
EXPLICIT_AUDIO_TOKENS: AudioIntentTokens = {
    "microphone": ["microphone", "mic ", " mic", "press to talk", "push to talk"],
    "recording": ["start recording", "stop recording", "record audio", "record my voice"],
    "speech": ["speech input", "speech recognition"],
    "voice": ["voice input", "voice control", "speak into", "talk to the app"],
}

# Tokens that are ambiguous and should not, by themselves, flip audio_intent.
AMBIGUOUS_TOKENS: list[str] = [
    "assistant",
    "respond",
    "reply",
    "conversation",
    "chatbot",
    "voice of the brand",
]


@dataclass
class AudioIntentClassification:
    audio_intent: bool
    reason: str
    matches: list[str]


def classify_audio_intent(prompt: str) -> AudioIntentClassification:
    """
    Classify whether the user explicitly requested audio / microphone UI.

    Rules:
    - Only explicit audio tokens are considered strong signals.
    - Ambiguous tokens (assistant, chat, respond, voice of the brand, etc.)
      do NOT set audio_intent to True on their own.
    """
    text = prompt.lower()
    matches: list[str] = []

    for _category, tokens in EXPLICIT_AUDIO_TOKENS.items():
        for token in tokens:
            if token in text:
                matches.append(token)

    if matches:
        return AudioIntentClassification(
            audio_intent=True,
            reason="Explicit audio-related tokens detected in prompt.",
            matches=matches,
        )

    return AudioIntentClassification(
        audio_intent=False,
        reason="No explicit audio-related tokens detected; defaulting to text-only UI.",
        matches=[],
    )


@dataclass
class AudioUiViolation:
    file: Path
    line_number: int
    pattern: str
    line: str


@dataclass
class AudioUiValidationResult:
    ok: bool
    violations: list[AudioUiViolation]


# Simple blocklist for obvious audio-UI patterns in React/MUI code.
BLOCKLIST_PATTERNS: list[str] = [
    # MUI icons commonly used for audio/microphone controls
    "MicIcon",
    "MicNoneIcon",
    "MicOffIcon",
    "GraphicEqIcon",
    "EqualizerIcon",
    "@mui/icons-material/Mic",
    "@mui/icons-material/MicNone",
    "@mui/icons-material/MicOff",
    "@mui/icons-material/GraphicEq",
    "@mui/icons-material/Equalizer",
    # Browser APIs for microphone capture / recording
    "navigator.mediaDevices.getUserMedia",
    "MediaRecorder",
    # HTML audio elements and common audio UI text
    "<audio",
    "Tap to speak",
    "Tap to Talk",
    "Start recording",
    "Stop recording",
    "Listening...",
]


def validate_audio_ui_neutrality(
    files: Iterable[str], audio_intent: bool
) -> AudioUiValidationResult:
    """
    Validate that the given React files remain audio-UI neutral when
    `audio_intent` is False.

    - When audio_intent is False: any blocklisted pattern is a violation.
    - When audio_intent is True: this validator currently passes (no-op), as
      audio UI is intentionally requested and allowed.
    """
    if audio_intent:
        return AudioUiValidationResult(ok=True, violations=[])

    violations: list[AudioUiViolation] = []

    for file_path in files:
        path = Path(file_path)
        if not path.is_file():
            # Skip non-existent files; caller decides if this is acceptable.
            continue

        try:
            contents = path.read_text(encoding="utf-8")
        except Exception:
            # If we cannot read the file, treat it as non-violating for this validator;
            # higher-level tooling can surface IO errors separately if needed.
            continue

        lines = contents.splitlines()
        for idx, line in enumerate(lines, start=1):
            for pattern in BLOCKLIST_PATTERNS:
                if pattern in line:
                    violations.append(
                        AudioUiViolation(
                            file=path, line_number=idx, pattern=pattern, line=line.strip()
                        )
                    )

    return AudioUiValidationResult(ok=len(violations) == 0, violations=violations)

