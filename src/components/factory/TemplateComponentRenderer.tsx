/**
 * src/components/factory/TemplateComponentRenderer.tsx
 * ====================================================
 * Renders styled representations of template component types.
 * Extracted from CanvasEditor.tsx for reuse in thumbnails.
 */

import React from "react";
import { resolveColor } from "../../utils/tokenMap";
import { getComponent, isComponentRegistered } from "../../utils/ComponentRegistry";
import type { CanvasElementType } from "./canvasTypes";

/**
 * Element type colors - EDIT mode only.
 * Only borders - NO backgrounds, so TemplateComponentRenderer colors show through.
 */
export const elementTypeColors: Record<CanvasElementType, string> = {
    component: "border-primary-400",
    container: "border-neutral-400",
    text: "border-success-400",
    image: "border-warning-400",
    spacer: "border-neutral-300 border-dashed",
};

export interface TemplateComponentRendererProps {
    componentId: string;
    props?: Record<string, unknown>;
    bounds: { width: number; height: number };
    demoMode?: boolean;
}

/**
 * Template component renderer.
 * Renders styled representations of template component types (EUR-1.1.10).
 * These are visual previews of what the final component would look like.
 */
export const TemplateComponentRenderer: React.FC<TemplateComponentRendererProps> = ({
    componentId,
    props = {},
    // bounds,
    demoMode = false
}) => {
    const baseClasses = demoMode ? "" : "pointer-events-none";

    // Extract common props
    const label = (props.label as string) || "";
    const placeholder = (props.placeholder as string) || "";
    const variant = (props.variant as string) || "default";
    const backgroundColor = (props.backgroundColor as string) || "";

    // Resolve hex colors to design tokens
    const resolvedBg = resolveColor(backgroundColor, "");
    // const _resolvedBorderColor = resolveBorder(props.borderBottom as string) || resolveBorder(props.borderTop as string);

    // Check if component is in registry (for external/dynamic components like mui-button)
    if (isComponentRegistered(componentId)) {
        // console.log(`[TemplateComponentRenderer] Rendering registered component: ${componentId}`, props);
        const RegisteredComponent = getComponent(componentId);
        return (
            <div className={`w-full h-full ${baseClasses} overflow-hidden`}>
                <RegisteredComponent {...props} />
            </div>
        );
    }

    // Render based on component type
    switch (componentId) {
        // Buttons
        case "button_primary":
            return (
                <button
                    className={`w-full h-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg text-sm transition-colors ${baseClasses}`}
                    style={{ backgroundColor: variant === "ghost" ? "transparent" : undefined }}
                >
                    {props.icon === "send" && (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    )}
                    {props.icon === "settings" && (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    )}
                    {label || (props.icon ? "" : "+ New Chat")}
                </button>
            );

        case "button_secondary":
            return (
                <button
                    className={`w-full h-full flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm border border-neutral-300 transition-colors ${baseClasses}`}
                >
                    {props.icon === "refresh" && (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                    )}
                    {label || "Refresh"}
                </button>
            );

        // Text Inputs
        case "input_text":
            return (
                <div className={`w-full h-full flex items-center ${baseClasses}`}>
                    <input
                        type="text"
                        placeholder={placeholder || "Enter text..."}
                        className="w-full h-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        readOnly={!demoMode}
                    />
                </div>
            );

        // Select/Dropdown
        case "select_dropdown":
            return (
                <div className={`w-full h-full flex items-center ${baseClasses}`}>
                    <select className="w-full h-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-sm appearance-none cursor-pointer">
                        <option>{placeholder || "Select..."}</option>
                        {Array.isArray(props.options) && props.options.map((opt, i) => (
                            <option key={i}>{String(opt)}</option>
                        ))}
                    </select>
                </div>
            );

        // Containers
        case "container_sidebar":
            return (
                <div
                    className={`w-full h-full ${baseClasses}`}
                    style={{ backgroundColor: resolvedBg || "var(--color-neutral-900)" }}
                />
            );

        case "container_header":
        case "container_footer":
            return (
                <div
                    className={`w-full h-full ${baseClasses}`}
                    style={{
                        backgroundColor: resolvedBg || "var(--bg-primary)",
                        borderBottom: componentId === "container_header" ? "1px solid var(--border-primary)" : undefined,
                        borderTop: componentId === "container_footer" ? "1px solid var(--border-primary)" : undefined,
                    }}
                />
            );

        case "container_fluid":
        case "container_card":
            return (
                <div
                    className={`w-full h-full ${baseClasses}`}
                    style={{
                        backgroundColor: resolvedBg || "var(--color-neutral-50)",
                        borderRadius: componentId === "container_card" ? "12px" : undefined,
                        boxShadow: componentId === "container_card" ? "var(--shadow-md)" : undefined,
                    }}
                />
            );

        // List
        case "list_standard":
            return (
                <div className={`w-full h-full flex flex-col gap-1 p-2 ${baseClasses}`}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors">
                            <div className="w-6 h-6 rounded-full bg-neutral-500/30" />
                            <div className="flex-1">
                                <div className="h-3 w-24 bg-neutral-500/30 rounded" />
                                <div className="h-2 w-16 bg-neutral-500/20 rounded mt-1" />
                            </div>
                        </div>
                    ))}
                </div>
            );

        // Tree View
        case "tree_view":
            return (
                <div className={`w-full h-full flex flex-col gap-1 p-2 text-neutral-300 text-sm ${baseClasses}`}>
                    <div className="flex items-center gap-2 px-2 py-1"><span>📁</span> public</div>
                    <div className="flex items-center gap-2 px-2 py-1 pl-6"><span>📁</span> tables</div>
                    <div className="flex items-center gap-2 px-2 py-1 pl-10"><span>📄</span> users</div>
                    <div className="flex items-center gap-2 px-2 py-1 pl-10"><span>📄</span> orders</div>
                    <div className="flex items-center gap-2 px-2 py-1 pl-10"><span>📄</span> products</div>
                </div>
            );

        // Form Group
        case "form_group":
            return (
                <div className={`w-full h-full flex flex-col gap-2 ${baseClasses}`}>
                    <label className="text-sm font-medium text-neutral-700">{label || "Field Label"}</label>
                    {props.type === "toggle" ? (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-5 bg-primary-500 rounded-full relative">
                                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                            </div>
                            <span className="text-xs text-neutral-500">{props.description as string}</span>
                        </div>
                    ) : props.type === "select" ? (
                        <select className="px-3 py-2 border border-neutral-300 rounded-lg text-sm">
                            <option>Select...</option>
                        </select>
                    ) : (
                        <input type="text" className="px-3 py-2 border border-neutral-300 rounded-lg text-sm" placeholder={placeholder} />
                    )}
                </div>
            );

        // Navigation Item
        case "nav_item":
            return (
                <div
                    className={`w-full h-full flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${props.active ? "bg-primary-100 text-primary-700" : "text-neutral-600 hover:bg-neutral-100"
                        } ${baseClasses}`}
                >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                    {label || "Nav Item"}
                </div>
            );

        // Tab Item
        case "tab_item":
            return (
                <div
                    className={`w-full h-full flex items-center justify-center text-sm font-medium rounded-md transition-colors cursor-pointer ${props.active ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                        } ${baseClasses}`}
                >
                    {label || "Tab"}
                </div>
            );

        // Headings
        case "text_heading":
            return (
                <div className={`w-full h-full flex items-center text-lg font-semibold text-neutral-900 ${baseClasses}`}>
                    {props.text as string || "Heading"}
                </div>
            );

        case "text_label":
            return (
                <div className={`w-full h-full flex items-center text-xs text-neutral-500 ${baseClasses}`}>
                    {props.text as string || "Label text"}
                </div>
            );

        // Badge/Status
        case "badge_status":
            return (
                <div className={`w-full h-full flex items-center gap-1.5 ${baseClasses}`}>
                    <div className={`w-2 h-2 rounded-full ${props.status === "connected" ? "bg-success-500" : "bg-neutral-400"}`} />
                    <span className="text-xs font-medium text-neutral-300">{label || "Status"}</span>
                </div>
            );

        // Code Editor
        case "code_editor":
            return (
                <div className={`w-full h-full bg-[#1e1e1e] p-3 font-mono text-xs text-neutral-300 ${baseClasses}`}>
                    <div className="text-purple-400">SELECT</div>
                    <div className="pl-4 text-neutral-300">*</div>
                    <div className="text-purple-400">FROM</div>
                    <div className="pl-4 text-yellow-400">users</div>
                    <div className="text-purple-400">LIMIT</div>
                    <div className="pl-4 text-orange-400">100</div>
                    <div className="text-neutral-500">;</div>
                </div>
            );

        // Data Table
        case "data_table":
            return (
                <div className={`w-full h-full bg-white overflow-hidden ${baseClasses}`}>
                    <div className="grid grid-cols-4 bg-neutral-100 text-xs font-medium text-neutral-600 border-b">
                        <div className="px-3 py-2">ID</div>
                        <div className="px-3 py-2">Name</div>
                        <div className="px-3 py-2">Email</div>
                        <div className="px-3 py-2">Status</div>
                    </div>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="grid grid-cols-4 text-xs text-neutral-700 border-b border-neutral-100">
                            <div className="px-3 py-2">{i}</div>
                            <div className="px-3 py-2">User {i}</div>
                            <div className="px-3 py-2">user{i}@example.com</div>
                            <div className="px-3 py-2">
                                <span className="px-1.5 py-0.5 bg-success-100 text-success-700 rounded text-[10px]">Active</span>
                            </div>
                        </div>
                    ))}
                </div>
            );

        // Avatar
        case "avatar":
            return (
                <div className={`w-full h-full flex items-center justify-center ${baseClasses}`}>
                    <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-semibold">
                        {props.fallback as string || "AI"}
                    </div>
                </div>
            );

        // Icon Button
        case "button_icon":
            return (
                <button
                    className={`w-full h-full flex items-center justify-center rounded-full transition-colors ${variant === "primary"
                        ? "bg-primary-500 hover:bg-primary-600 text-white"
                        : "text-neutral-500 hover:bg-neutral-100"
                        } ${baseClasses}`}
                >
                    {props.icon === "send" && (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    )}
                    {props.icon === "minimize" && (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    )}
                    {props.icon === "x" && (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    )}
                </button>
            );

        // Chat Bubble
        case "chat_bubble":
            return (
                <div className={`w-full h-full p-3 rounded-lg ${props.sender === "assistant"
                    ? "bg-neutral-100 text-neutral-800"
                    : "bg-primary-500 text-white"
                    } ${baseClasses}`}>
                    <p className="text-sm">{props.message as string || "Message text"}</p>
                    {props.timestamp && (
                        <span className="text-[10px] opacity-70 mt-1 block">{props.timestamp as string}</span>
                    )}
                </div>
            );

        // Chip/Tag
        case "chip":
            return (
                <div
                    className={`w-full h-full flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${variant === "outline"
                        ? "border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                        : "bg-primary-100 text-primary-700 border-primary-200"
                        } ${baseClasses}`}
                >
                    {label || "Chip"}
                </div>
            );

        // Default fallback - show component type name
        default:
            return (
                <div className={`w-full h-full flex items-center justify-center text-xs text-neutral-400 bg-neutral-50 ${baseClasses}`}>
                    {componentId}
                </div>
            );
    }
};
