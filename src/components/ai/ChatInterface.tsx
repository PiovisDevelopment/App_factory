/**
 * D069 - src/components/ai/ChatInterface.tsx
 * ==========================================
 * AI chat interface component for conversational interactions.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D010, D011, D014
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Panel } from "../ui/Panel";

/**
 * Message role types for chat messages.
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * Chat message structure.
 */
export interface ChatMessage {
  /** Unique message identifier */
  id: string;
  /** Message role (user, assistant, system) */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Timestamp when message was created */
  timestamp: Date;
  /** Whether message is still being streamed */
  isStreaming?: boolean;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chat interface props.
 */
export interface ChatInterfaceProps {
  /** Array of chat messages */
  messages: ChatMessage[];
  /** Callback when user sends a message */
  onSendMessage: (content: string) => void;
  /** Whether AI is currently generating a response */
  isLoading?: boolean;
  /** Placeholder text for input */
  placeholder?: string;
  /** Whether to show timestamp on messages */
  showTimestamps?: boolean;
  /** Title displayed in header */
  title?: string;
  /** Callback when user requests to clear chat */
  onClear?: () => void;
  /** Custom className for the container */
  className?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** System prompt displayed at top (optional) */
  systemPrompt?: string;
  /** Maximum height for the chat container */
  maxHeight?: string;
}

/**
 * Send icon for the submit button.
 */
const SendIcon: React.FC = () => (
  <svg
    className="h-5 w-5"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

/**
 * Clear icon for the clear button.
 */
const ClearIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/**
 * User avatar icon.
 */
const UserIcon: React.FC = () => (
  <svg
    className="h-5 w-5"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/**
 * AI assistant avatar icon.
 */
const AssistantIcon: React.FC = () => (
  <svg
    className="h-5 w-5"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
    <circle cx="7.5" cy="14.5" r="1.5" />
    <circle cx="16.5" cy="14.5" r="1.5" />
  </svg>
);

/**
 * Loading dots animation component.
 */
const LoadingDots: React.FC = () => (
  <div className="flex items-center gap-1" aria-label="Loading">
    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
  </div>
);

/**
 * Format timestamp for display.
 */
const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Single chat message component.
 */
const ChatMessageItem: React.FC<{
  message: ChatMessage;
  showTimestamp: boolean;
}> = ({ message, showTimestamp }) => {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const containerStyles = [
    "flex",
    "gap-3",
    "p-3",
    "rounded-lg",
    isUser ? "bg-primary-50" : isSystem ? "bg-warning-50" : "bg-neutral-50",
  ].join(" ");

  const avatarStyles = [
    "flex",
    "items-center",
    "justify-center",
    "w-8",
    "h-8",
    "rounded-full",
    "shrink-0",
    isUser ? "bg-primary-100 text-primary-700" : isSystem ? "bg-warning-100 text-warning-700" : "bg-neutral-200 text-neutral-700",
  ].join(" ");

  const contentStyles = [
    "flex-1",
    "min-w-0",
  ].join(" ");

  const roleStyles = [
    "text-xs",
    "font-medium",
    "mb-1",
    isUser ? "text-primary-700" : isSystem ? "text-warning-700" : "text-neutral-600",
  ].join(" ");

  const textStyles = [
    "text-sm",
    "text-neutral-900",
    "whitespace-pre-wrap",
    "break-words",
  ].join(" ");

  const timeStyles = [
    "text-xs",
    "text-neutral-400",
    "mt-1",
  ].join(" ");

  return (
    <div className={containerStyles}>
      <div className={avatarStyles}>
        {isUser ? <UserIcon /> : <AssistantIcon />}
      </div>
      <div className={contentStyles}>
        <div className={roleStyles}>
          {isUser ? "You" : isSystem ? "System" : "Assistant"}
        </div>
        <div className={textStyles}>
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-primary-500 animate-pulse" />
          )}
        </div>
        {showTimestamp && (
          <div className={timeStyles}>
            {formatTimestamp(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ChatInterface component.
 *
 * A conversational AI chat interface with message history, streaming support,
 * and accessibility features. Uses design tokens exclusively.
 *
 * @example
 * ```tsx
 * const [messages, setMessages] = useState<ChatMessage[]>([]);
 * const [isLoading, setIsLoading] = useState(false);
 *
 * const handleSend = async (content: string) => {
 *   setMessages(prev => [...prev, {
 *     id: crypto.randomUUID(),
 *     role: "user",
 *     content,
 *     timestamp: new Date(),
 *   }]);
 *   setIsLoading(true);
 *   // Call AI API...
 * };
 *
 * <ChatInterface
 *   messages={messages}
 *   onSendMessage={handleSend}
 *   isLoading={isLoading}
 *   title="AI Assistant"
 * />
 * ```
 */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  showTimestamps = true,
  title = "Chat",
  onClear,
  className = "",
  disabled = false,
  systemPrompt,
  maxHeight = "600px",
}) => {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmedValue = inputValue.trim();
      if (trimmedValue && !isLoading && !disabled) {
        onSendMessage(trimmedValue);
        setInputValue("");
      }
    },
    [inputValue, isLoading, disabled, onSendMessage]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as FormEvent);
      }
    },
    [handleSubmit]
  );

  const containerStyles = [
    "flex",
    "flex-col",
    "h-full",
    className,
  ].filter(Boolean).join(" ");

  const messagesContainerStyles = [
    "flex-1",
    "overflow-y-auto",
    "space-y-3",
    "p-4",
  ].join(" ");

  const inputContainerStyles = [
    "flex",
    "items-center",
    "gap-2",
    "p-4",
    "border-t",
    "border-neutral-200",
    "bg-white",
  ].join(" ");

  const headerActions = onClear ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClear}
      leftIcon={<ClearIcon />}
      disabled={messages.length === 0 || isLoading}
    >
      Clear
    </Button>
  ) : undefined;

  return (
    <Panel
      variant="default"
      padding="none"
      radius="lg"
      header={title}
      showHeaderDivider
      className={containerStyles}
      style={{ maxHeight }}
    >
      {/* System prompt display */}
      {systemPrompt && (
        <div className="px-4 py-2 bg-info-50 border-b border-info-200 text-sm text-info-700">
          <span className="font-medium">System: </span>
          {systemPrompt}
        </div>
      )}

      {/* Messages area */}
      <div className={messagesContainerStyles}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-12">
            <AssistantIcon />
            <p className="mt-2 text-sm">Start a conversation</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessageItem
                key={message.id}
                message={message}
                showTimestamp={showTimestamps}
              />
            ))}
            {isLoading && (
              <div className="flex gap-3 p-3 rounded-lg bg-neutral-50">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-200 text-neutral-700 shrink-0">
                  <AssistantIcon />
                </div>
                <div className="flex items-center">
                  <LoadingDots />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className={inputContainerStyles}>
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            fullWidth
            size="md"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!inputValue.trim() || isLoading || disabled}
          loading={isLoading}
          iconOnly
          aria-label="Send message"
        >
          <SendIcon />
        </Button>
      </form>
    </Panel>
  );
};

ChatInterface.displayName = "ChatInterface";

export default ChatInterface;
