/**
 * AiAppChatPanel.tsx
 * ==================
 * AI App Chat panel component for the left sidebar.
 *
 * Features:
 * - Brain with speech bubble icon for sidebar tab
 * - Two modes: Chat (read-only) and Change (edit with approval)
 * - Three scopes: Backend, Frontend, Full
 * - Integrates with aiChatStore for state management
 * - Uses systematic debugging workflow for Change mode
 * - Ctrl+Enter to send, Enter for soft newline
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D010, D011, D014, aiChatStore, aiChatLlmService
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { useAiChatStore, type AiChatScope } from '../../stores/aiChatStore';
import { generateWithConfig, type ChatMessage } from '../../services/aiChatLlmService';
import { AiChatSettingsModal } from './AiChatSettingsModal';
import type { CanvasElement } from '../factory/canvasTypes';

/**
 * Brain with Speech Bubble icon for AI App Chat.
 */
export const AiAppChatIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Brain outline - left hemisphere */}
        <path d="M9.5 2C8 2 7 3 7 4.5C7 5 7 5.5 6.5 6C5.5 6.5 5 7.5 5 8.5C5 9.5 5.5 10 6 10.5C5.5 11.5 5.5 12.5 6 13.5C6.5 14.5 7.5 15 8.5 15C8.5 15.5 8.5 16 9 16.5" />
        {/* Brain outline - right hemisphere */}
        <path d="M14.5 2C16 2 17 3 17 4.5C17 5 17 5.5 17.5 6C18.5 6.5 19 7.5 19 8.5C19 9.5 18.5 10 18 10.5C18.5 11.5 18.5 12.5 18 13.5C17.5 14.5 16.5 15 15.5 15C15.5 15.5 15.5 16 15 16.5" />
        {/* Brain center/connection */}
        <path d="M12 2C12 2 11 4 11 6C11 8 12 9 12 9C12 9 13 8 13 6C13 4 12 2 12 2Z" />
        <path d="M9 10C10 10 11 9.5 12 9.5C13 9.5 14 10 15 10" />
        {/* Speech bubble */}
        <path d="M6 17H4C3 17 2 18 2 19V20C2 21 3 22 4 22H7L9 20L7 18" />
        <circle cx="4.5" cy="19.5" r="0.5" fill="currentColor" />
        <circle cx="6" cy="19.5" r="0.5" fill="currentColor" />
        {/* Connection point */}
        <path d="M12 16.5V15" />
    </svg>
);

/**
 * Settings gear icon.
 */
const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
);

/**
 * Clear/trash icon.
 */
const ClearIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
);

/**
 * Resize handle icon (double arrow vertical).
 */
const ResizeHandleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5l-3 3h6l-3-3z" fill="currentColor" />
        <path d="M12 19l-3-3h6l-3 3z" fill="currentColor" />
        <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
);

/**
 * Chat icon (message bubble).
 */
const ChatIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
);

/**
 * Edit/pencil icon for Change mode.
 */
const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

/**
 * User icon.
 */
const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

/**
 * AI assistant icon.
 */
const AssistantIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
        <circle cx="7.5" cy="14.5" r="1.5" />
        <circle cx="16.5" cy="14.5" r="1.5" />
    </svg>
);

/**
 * Loading dots component.
 */
const LoadingDots: React.FC = () => (
    <div className="flex items-center gap-1">
        <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
);

/**
 * Scope config for styling.
 */
const SCOPE_CONFIG: Record<AiChatScope, { label: string; short: string; color: string; activeColor: string }> = {
    backend: {
        label: 'Backend',
        short: 'BE',
        color: 'text-amber-600',
        activeColor: 'bg-amber-500 text-white',
    },
    frontend: {
        label: 'Frontend',
        short: 'FE',
        color: 'text-blue-600',
        activeColor: 'bg-blue-500 text-white',
    },
    full: {
        label: 'Full',
        short: 'Full',
        color: 'text-purple-600',
        activeColor: 'bg-purple-500 text-white',
    },
};

/**
 * Canvas change from AI response.
 */
export interface CanvasChange {
    elementId?: string;
    action?: 'add' | 'update' | 'delete';
    name?: string;
    code: string;
}

/**
 * Props for AiAppChatPanel.
 */
export interface AiAppChatPanelProps {
    /** Custom className */
    className?: string;
    /** Callback to apply generated code to the canvas (legacy) */
    onApplyCode?: (code: string, language: string) => void;
    /** Canvas elements for context injection */
    canvasElements?: CanvasElement[];
    /** Function to get component code by ID */
    getComponentCode?: (componentId: string) => { code?: string;[key: string]: unknown } | null;
    /** Callback to apply structured canvas changes */
    onApplyCanvasChanges?: (changes: CanvasChange[]) => void;
}

/**
 * Single chat message component with code block detection and Apply button.
 */
const ChatMessageItem: React.FC<{
    message: ChatMessage;
    showTimestamp?: boolean;
    onApplyCode?: (code: string, language: string) => void;
    onApplyCanvasChanges?: (changes: CanvasChange[]) => void;
}> = ({
    message,
    showTimestamp = true,
    onApplyCode,
    onApplyCanvasChanges,
}) => {
        const isUser = message.role === 'user';
        const isSystem = message.role === 'system';

        const containerStyles = [
            'flex gap-2 p-2 rounded-lg text-sm',
            isUser ? 'bg-primary-50' : isSystem ? 'bg-amber-50' : 'bg-neutral-50',
        ].join(' ');

        const avatarStyles = [
            'flex items-center justify-center w-6 h-6 rounded-full shrink-0',
            isUser ? 'bg-primary-100 text-primary-600' : isSystem ? 'bg-amber-100 text-amber-600' : 'bg-neutral-200 text-neutral-600',
        ].join(' ');

        // Parse content to detect code blocks
        const renderContent = (content: string) => {
            // Regex to detect ```language\n...code...\n``` blocks
            const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
            const parts: React.ReactNode[] = [];
            let lastIndex = 0;
            let match;

            while ((match = codeBlockRegex.exec(content)) !== null) {
                // Text before the code block
                if (match.index > lastIndex) {
                    parts.push(<span key={`text-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
                }

                const language = match[1] || 'javascript';
                const code = match[2] ?? '';

                parts.push(
                    <div key={`code-${match.index}`} className="my-2 rounded-md overflow-hidden border border-neutral-200">
                        <div className="flex items-center justify-between px-2 py-1 bg-neutral-800 text-xs">
                            <span className="text-neutral-300 uppercase">{language}</span>
                            {language === 'json' && onApplyCanvasChanges ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        // Debugging: Alert start
                                        alert('Clicked Apply Changes');
                                        try {
                                            const parsed = JSON.parse(code.trim());
                                            if (parsed.changes && Array.isArray(parsed.changes)) {
                                                if (onApplyCanvasChanges) {
                                                    // alert('Calling onApplyCanvasChanges with ' + parsed.changes.length + ' changes');
                                                    onApplyCanvasChanges(parsed.changes);
                                                } else {
                                                    alert('Error: onApplyCanvasChanges prop is missing!');
                                                }
                                            } else {
                                                console.warn('[ChatMessageItem] JSON does not contain valid changes array');
                                                alert('Error: JSON missing "changes" array');
                                            }
                                        } catch (e) {
                                            console.error('[ChatMessageItem] Failed to parse JSON changes', e);
                                            alert('Error parsing JSON changes:\n' + (e instanceof Error ? e.message : String(e)));
                                        }
                                    }}
                                    className="px-2 py-0.5 bg-green-600 text-white rounded text-[10px] font-medium hover:bg-green-700 transition-colors"
                                >
                                    Apply Changes
                                </button>
                            ) : onApplyCode ? (
                                <button
                                    type="button"
                                    onClick={() => onApplyCode(code.trim(), language)}
                                    className="px-2 py-0.5 bg-primary-500 text-white rounded text-[10px] font-medium hover:bg-primary-600 transition-colors"
                                >
                                    Apply to Canvas
                                </button>
                            ) : null}
                        </div>
                        <pre className="p-2 bg-neutral-900 text-neutral-100 text-xs overflow-x-auto">
                            <code>{code}</code>
                        </pre>
                    </div>
                );

                lastIndex = match.index + match[0].length;
            }

            // Remaining text after the last code block
            if (lastIndex < content.length) {
                parts.push(<span key={`text-${lastIndex}`}>{content.slice(lastIndex)}</span>);
            }

            return parts.length > 0 ? parts : content;
        };

        return (
            <div className={containerStyles}>
                <div className={avatarStyles}>
                    {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <AssistantIcon className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-neutral-700">
                            {isUser ? 'You' : isSystem ? 'System' : 'AI'}
                        </span>
                        {showTimestamp && (
                            <span className="text-[10px] text-neutral-400">
                                {new Date(message.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                    <div className="text-neutral-800 whitespace-pre-wrap break-words">
                        {renderContent(message.content)}
                    </div>
                </div>
            </div>
        );
    };

/**
 * AI App Chat Panel component.
 * Replaces left sidebar content when AI Chat tab is active.
 */
export const AiAppChatPanel: React.FC<AiAppChatPanelProps> = ({
    className = '',
    onApplyCode,
    canvasElements = [],
    getComponentCode,
    onApplyCanvasChanges,
}) => {
    // Store state
    const {
        mode,
        scope,
        chatHistory,
        isGenerating,
        error,
        isSettingsOpen,
        setMode,
        setScope,
        addMessage,
        clearHistory,
        setIsGenerating,
        setError,
        toggleSettings,
        getCurrentConfig,
    } = useAiChatStore();

    // Local state
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inputContainerRef = useRef<HTMLDivElement>(null);

    // Persisted textarea height
    const STORAGE_KEY = 'ai-chat-input-height';
    const DEFAULT_HEIGHT = 60;
    const MIN_HEIGHT = 32;
    const MAX_HEIGHT = 300;

    const [inputHeight, setInputHeight] = useState<number>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, parseInt(saved, 10))) : DEFAULT_HEIGHT;
    });

    // Resize drag state
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartY = useRef<number>(0);
    const resizeStartHeight = useRef<number>(0);

    // Get current scope's messages
    const messages = chatHistory[scope];

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus textarea on mount
    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    // Handle resize drag
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = resizeStartY.current - e.clientY;
            const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartHeight.current + delta));
            setInputHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            // Persist to localStorage
            localStorage.setItem(STORAGE_KEY, inputHeight.toString());
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, inputHeight]);

    // Start resize
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        resizeStartY.current = e.clientY;
        resizeStartHeight.current = inputHeight;
    }, [inputHeight]);

    /**
     * Handle sending a message.
     */
    const handleSend = useCallback(async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || isGenerating) return;

        setInputValue('');
        setError(null);

        // Add user message
        addMessage({ role: 'user', content: trimmed });

        // Get current config
        const config = getCurrentConfig();

        // Generate response
        setIsGenerating(true);
        console.log('[AiAppChatPanel] Starting generation for prompt:', trimmed);
        try {
            // Convert ChatMessage[] to expected format
            const history = messages.map(m => ({
                ...m,
                timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp),
            }));

            // Capture canvas if frontend/full scope
            const images: string[] = [];
            // Build canvas context for AI
            let canvasContext = '';

            if (scope === 'frontend' || scope === 'full') {
                // Build structured canvas context with element codes
                if (canvasElements.length > 0 && getComponentCode) {
                    canvasContext = '\n\n--- CANVAS_CONTEXT ---\n';
                    canvasElements.forEach((el, idx) => {
                        const codeInfo = el.componentId ? getComponentCode(el.componentId) : null;
                        const componentCode = typeof codeInfo?.code === 'string' ? codeInfo.code : '';
                        canvasContext += `### Element ${idx + 1}: ${el.name} (ID: ${el.id})\n`;
                        canvasContext += `- Type: ${el.type}\n`;
                        canvasContext += `- Position: (${el.bounds.x}, ${el.bounds.y}) Size: ${el.bounds.width}x${el.bounds.height}\n`;
                        if (componentCode) {
                            canvasContext += '```jsx\n' + componentCode + '\n```\n\n';
                        } else {
                            canvasContext += '(No code available)\n\n';
                        }
                    });
                    canvasContext += '--- END CANVAS_CONTEXT ---\n';
                    console.log('[AiAppChatPanel] Canvas context built for', canvasElements.length, 'elements');
                }

                // Also capture screenshot
                const canvasElement = document.getElementById('canvas-editor');
                if (canvasElement) {
                    console.log('[AiAppChatPanel] Capturing canvas...', {
                        width: canvasElement.clientWidth,
                        height: canvasElement.clientHeight
                    });
                    try {
                        const canvas = await html2canvas(canvasElement, {
                            useCORS: true,
                            logging: false,
                            ignoreElements: (element) => element.classList.contains('canvas-controls')
                        });
                        const base64Image = canvas.toDataURL('image/png');
                        images.push(base64Image);
                        console.log(`[AiAppChatPanel] Canvas captured. Size: ~${Math.round(base64Image.length / 1024)}KB`);
                    } catch (captureErr) {
                        console.error('[AiAppChatPanel] Failed to capture canvas:', captureErr);
                    }
                } else {
                    console.warn('[AiAppChatPanel] #canvas-editor element not found');
                }
            }

            // Build final prompt with canvas context
            const finalPrompt = canvasContext ? `${trimmed}\n${canvasContext}` : trimmed;

            console.log('[AiAppChatPanel] Calling generateWithConfig with history:', history.length, 'images:', images.length);
            const result = await generateWithConfig(config, finalPrompt, history, images);
            console.log('[AiAppChatPanel] Result:', result.success);

            if (result.success && typeof result.text === 'string') {
                const assistantText = result.text;
                addMessage({ role: 'assistant', content: assistantText });

                // Try to parse JSON changes from AI response
                if (onApplyCanvasChanges && mode === 'change') {
                    try {
                        // Extract JSON from code block if present
                        const jsonMatch = assistantText.match(/```json\s*([\s\S]*?)\s*```/);
                        if (jsonMatch && jsonMatch[1]) {
                            const parsed = JSON.parse(jsonMatch[1]);
                            if (parsed.changes && Array.isArray(parsed.changes)) {
                                console.log('[AiAppChatPanel] Parsed', parsed.changes.length, 'changes from AI response');
                                // Auto-apply in change mode - could add confirmation UI later
                                onApplyCanvasChanges(parsed.changes);
                            }
                        }
                    } catch (parseErr) {
                        console.log('[AiAppChatPanel] No JSON changes in response (chat mode or plain text)');
                    }
                }
            } else {
                console.error('[AiAppChatPanel] Generation failed:', result.error);
                setError(result.error || 'Failed to generate response');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    }, [inputValue, isGenerating, messages, addMessage, getCurrentConfig, setIsGenerating, setError, scope, canvasElements, getComponentCode, mode, onApplyCanvasChanges]);

    /**
     * Handle key press in textarea.
     * Ctrl+Enter sends, Enter is soft newline.
     */
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Compact Header with all controls in one row */}
            <div className="px-2 py-1.5 border-b border-neutral-200 bg-white">
                <div className="flex items-center gap-1">
                    {/* Mode Toggle (Chat/Change) */}
                    <button
                        type="button"
                        onClick={() => setMode(mode === 'chat' ? 'change' : 'chat')}
                        className={[
                            'p-1.5 rounded-md transition-colors',
                            mode === 'chat'
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-amber-100 text-amber-600',
                        ].join(' ')}
                        title={mode === 'chat' ? 'Chat mode (read-only)' : 'Change mode (can edit)'}
                    >
                        {mode === 'chat' ? <ChatIcon className="h-4 w-4" /> : <EditIcon className="h-4 w-4" />}
                    </button>

                    {/* Divider */}
                    <div className="w-px h-5 bg-neutral-200" />

                    {/* Scope Switches (BE/FE/Full) */}
                    {(['backend', 'frontend', 'full'] as AiChatScope[]).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setScope(s)}
                            className={[
                                'px-2 py-1 text-[10px] font-semibold rounded transition-colors',
                                scope === s
                                    ? SCOPE_CONFIG[s].activeColor
                                    : `bg-neutral-100 ${SCOPE_CONFIG[s].color} hover:bg-neutral-200`,
                            ].join(' ')}
                            title={SCOPE_CONFIG[s].label}
                        >
                            {SCOPE_CONFIG[s].short}
                        </button>
                    ))}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Clear Chat */}
                    <button
                        type="button"
                        onClick={clearHistory}
                        disabled={messages.length === 0 || isGenerating}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Clear chat"
                    >
                        <ClearIcon className="h-4 w-4" />
                    </button>

                    {/* Settings */}
                    <button
                        type="button"
                        onClick={toggleSettings}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        title="Settings"
                    >
                        <SettingsIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-neutral-50">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-8">
                        <AiAppChatIcon className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-xs text-center px-4">
                            Ctrl+Enter to send
                        </p>
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => (
                            <ChatMessageItem
                                key={msg.id}
                                message={msg}
                                showTimestamp
                                {...(onApplyCode ? { onApplyCode } : {})}
                                {...(onApplyCanvasChanges ? { onApplyCanvasChanges } : {})}
                            />
                        ))}
                        {isGenerating && (
                            <div className="flex gap-2 p-2 rounded-lg bg-neutral-50">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 shrink-0">
                                    <AssistantIcon className="h-3.5 w-3.5" />
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

            {/* Error Display */}
            {error && (
                <div className="px-2 py-1.5 bg-error-50 border-t border-error-200 text-error-700 text-xs">
                    {error}
                </div>
            )}

            {/* Input Area - Textarea with resizable height */}
            <div ref={inputContainerRef} className="border-t border-neutral-200 bg-white">
                {/* Resize Handle */}
                <div
                    className="flex items-center justify-center h-4 cursor-ns-resize hover:bg-neutral-100 transition-colors group"
                    onMouseDown={handleResizeStart}
                    title="Drag to resize"
                >
                    <ResizeHandleIcon className="h-3 w-3 text-neutral-300 group-hover:text-neutral-500" />
                </div>
                {/* Textarea */}
                <div className="px-2 pb-2">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={mode === 'chat' ? 'Ask a question... (Ctrl+Enter)' : 'Describe changes... (Ctrl+Enter)'}
                        disabled={isGenerating}
                        className="w-full px-2 py-1.5 text-sm border border-neutral-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-400"
                        style={{ height: `${inputHeight}px` }}
                    />
                </div>
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && <AiChatSettingsModal />}
        </div>
    );
};

AiAppChatPanel.displayName = 'AiAppChatPanel';

export default AiAppChatPanel;
