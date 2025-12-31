/**
 * src/components/templates/layoutTemplates.ts
 * ============================================
 * Pre-built FE UI layout templates.
 * 
 * These are complete, ready-to-use layouts with positioned elements.
 * Users can load these as starting points and make tweaks.
 * 
 * Implements EUR-1.1.10 (template browser with thumbnails).
 */

import type { CanvasElement } from "../factory/CanvasEditor";

/**
 * Layout template definition.
 */
export interface LayoutTemplate {
    /** Unique template ID */
    id: string;
    /** Template name */
    name: string;
    /** Short description */
    description: string;
    /** Category for filtering */
    category: "chat" | "database" | "settings" | "widget" | "dashboard" | "form";
    /** Tags for search */
    tags: string[];
    /** Thumbnail emoji (for simple preview) */
    icon: string;
    /** Recommended window dimensions */
    windowSize: { width: number; height: number };
    /** Pre-positioned canvas elements */
    elements: CanvasElement[];
    /** Whether this is a floating widget (smaller window) */
    isWidget?: boolean;
}

// =============================================================================
// CHAT APPLICATION TEMPLATE
// =============================================================================

const chatApplicationTemplate: LayoutTemplate = {
    id: "layout-chat-app",
    name: "Chat Application",
    description: "ChatGPT/Claude-style chat interface with sidebar, history, and input area",
    category: "chat",
    tags: ["chat", "llm", "ai", "conversation", "messaging"],
    icon: "💬",
    windowSize: { width: 1200, height: 800 },
    elements: [
        // Left Sidebar (Conversation History)
        {
            id: "chat-sidebar",
            type: "component",
            name: "Conversation Sidebar",
            componentId: "container_sidebar",
            bounds: { x: 0, y: 0, width: 280, height: 800 },
            zIndex: 1,
            props: {
                backgroundColor: "#1e1e2e",
                padding: "16px",
            },
        },
        // Sidebar Header (New Chat Button)
        {
            id: "chat-sidebar-header",
            type: "component",
            name: "New Chat Button",
            componentId: "button_primary",
            bounds: { x: 16, y: 16, width: 248, height: 44 },
            zIndex: 2,
            props: {
                label: "+ New Chat",
                variant: "primary",
                fullWidth: true,
            },
        },
        // Sidebar Search
        {
            id: "chat-sidebar-search",
            type: "component",
            name: "Search Conversations",
            componentId: "input_text",
            bounds: { x: 16, y: 76, width: 248, height: 40 },
            zIndex: 2,
            props: {
                placeholder: "Search conversations...",
                icon: "search",
            },
        },
        // Conversation List
        {
            id: "chat-conversation-list",
            type: "component",
            name: "Conversation List",
            componentId: "list_standard",
            bounds: { x: 16, y: 132, width: 248, height: 600 },
            zIndex: 2,
            props: {
                itemHeight: 56,
                showIcons: true,
            },
        },
        // Settings Gear (Bottom of Sidebar)
        {
            id: "chat-settings-btn",
            type: "component",
            name: "Settings Button",
            componentId: "button_secondary",
            bounds: { x: 16, y: 748, width: 40, height: 40 },
            zIndex: 2,
            props: {
                icon: "settings",
                variant: "ghost",
            },
        },
        // Main Chat Area Header
        {
            id: "chat-main-header",
            type: "component",
            name: "Chat Header",
            componentId: "container_header",
            bounds: { x: 280, y: 0, width: 920, height: 64 },
            zIndex: 1,
            props: {
                backgroundColor: "#ffffff",
                borderBottom: "1px solid #e5e5e5",
            },
        },
        // Model Selector (in header)
        {
            id: "chat-model-selector",
            type: "component",
            name: "Model Selector",
            componentId: "select_dropdown",
            bounds: { x: 300, y: 14, width: 200, height: 36 },
            zIndex: 3,
            props: {
                options: ["GPT-4", "GPT-3.5", "Claude 3", "Ollama"],
                placeholder: "Select model",
            },
        },
        // Chat Messages Area
        {
            id: "chat-messages-area",
            type: "component",
            name: "Chat Messages",
            componentId: "container_fluid",
            bounds: { x: 280, y: 64, width: 920, height: 636 },
            zIndex: 1,
            props: {
                backgroundColor: "#f9fafb",
                overflow: "auto",
                padding: "24px",
            },
        },
        // Input Area Container
        {
            id: "chat-input-container",
            type: "component",
            name: "Input Container",
            componentId: "container_footer",
            bounds: { x: 280, y: 700, width: 920, height: 100 },
            zIndex: 1,
            props: {
                backgroundColor: "#ffffff",
                borderTop: "1px solid #e5e5e5",
                padding: "16px 24px",
            },
        },
        // Chat Input Field
        {
            id: "chat-input-field",
            type: "component",
            name: "Message Input",
            componentId: "input_text",
            bounds: { x: 304, y: 720, width: 800, height: 56 },
            zIndex: 2,
            props: {
                placeholder: "Send a message...",
                multiline: true,
                rows: 2,
            },
        },
        // Send Button
        {
            id: "chat-send-btn",
            type: "component",
            name: "Send Button",
            componentId: "button_primary",
            bounds: { x: 1120, y: 720, width: 56, height: 56 },
            zIndex: 2,
            props: {
                icon: "send",
                variant: "primary",
            },
        },
    ],
};

// =============================================================================
// POSTGRES DATABASE VIEWER TEMPLATE
// =============================================================================

const databaseViewerTemplate: LayoutTemplate = {
    id: "layout-db-viewer",
    name: "Database Viewer",
    description: "View, edit, and query PostgreSQL database with table browser and SQL editor",
    category: "database",
    tags: ["database", "postgres", "sql", "query", "table", "data"],
    icon: "🗄️",
    windowSize: { width: 1400, height: 900 },
    elements: [
        // Left Panel - Table Browser
        {
            id: "db-table-browser",
            type: "component",
            name: "Table Browser",
            componentId: "container_sidebar",
            bounds: { x: 0, y: 0, width: 260, height: 900 },
            zIndex: 1,
            props: {
                backgroundColor: "#1a1a2e",
            },
        },
        // Connection Status Header
        {
            id: "db-connection-header",
            type: "component",
            name: "Connection Status",
            componentId: "container_header",
            bounds: { x: 0, y: 0, width: 260, height: 56 },
            zIndex: 2,
            props: {
                backgroundColor: "#16213e",
            },
        },
        // Connection Indicator
        {
            id: "db-connection-indicator",
            type: "component",
            name: "Connection Badge",
            componentId: "badge_status",
            bounds: { x: 16, y: 18, width: 120, height: 20 },
            zIndex: 3,
            props: {
                status: "connected",
                label: "Connected",
            },
        },
        // Database Name
        {
            id: "db-name-label",
            type: "component",
            name: "Database Name",
            componentId: "text_label",
            bounds: { x: 140, y: 18, width: 110, height: 20 },
            zIndex: 3,
            props: {
                text: "mydb",
                variant: "caption",
            },
        },
        // Schema Tree
        {
            id: "db-schema-tree",
            type: "component",
            name: "Schema Tree",
            componentId: "tree_view",
            bounds: { x: 8, y: 64, width: 244, height: 780 },
            zIndex: 2,
            props: {
                expandable: true,
                showIcons: true,
            },
        },
        // Refresh Tables Button
        {
            id: "db-refresh-btn",
            type: "component",
            name: "Refresh Tables",
            componentId: "button_secondary",
            bounds: { x: 8, y: 852, width: 244, height: 36 },
            zIndex: 2,
            props: {
                label: "Refresh",
                icon: "refresh",
            },
        },
        // Main Content Area - Tabs Header
        {
            id: "db-tabs-header",
            type: "component",
            name: "Tabs Header",
            componentId: "container_header",
            bounds: { x: 260, y: 0, width: 1140, height: 48 },
            zIndex: 1,
            props: {
                backgroundColor: "#ffffff",
                borderBottom: "1px solid #e5e5e5",
            },
        },
        // Tab: Query
        {
            id: "db-tab-query",
            type: "component",
            name: "Query Tab",
            componentId: "tab_item",
            bounds: { x: 276, y: 8, width: 80, height: 32 },
            zIndex: 2,
            props: {
                label: "Query",
                active: true,
            },
        },
        // Tab: Table View
        {
            id: "db-tab-table",
            type: "component",
            name: "Table View Tab",
            componentId: "tab_item",
            bounds: { x: 364, y: 8, width: 100, height: 32 },
            zIndex: 2,
            props: {
                label: "Table View",
                active: false,
            },
        },
        // Tab: Structure
        {
            id: "db-tab-structure",
            type: "component",
            name: "Structure Tab",
            componentId: "tab_item",
            bounds: { x: 472, y: 8, width: 90, height: 32 },
            zIndex: 2,
            props: {
                label: "Structure",
                active: false,
            },
        },
        // SQL Editor Section
        {
            id: "db-sql-editor-container",
            type: "component",
            name: "SQL Editor Container",
            componentId: "container_fluid",
            bounds: { x: 260, y: 48, width: 1140, height: 280 },
            zIndex: 1,
            props: {
                backgroundColor: "#1e1e1e",
                padding: "0",
            },
        },
        // SQL Code Editor
        {
            id: "db-sql-editor",
            type: "component",
            name: "SQL Editor",
            componentId: "code_editor",
            bounds: { x: 268, y: 56, width: 1124, height: 220 },
            zIndex: 2,
            props: {
                language: "sql",
                theme: "dark",
                placeholder: "SELECT * FROM users LIMIT 100;",
            },
        },
        // Query Toolbar
        {
            id: "db-query-toolbar",
            type: "component",
            name: "Query Toolbar",
            componentId: "container_header",
            bounds: { x: 260, y: 280, width: 1140, height: 48 },
            zIndex: 1,
            props: {
                backgroundColor: "#f3f4f6",
                borderTop: "1px solid #e5e5e5",
                borderBottom: "1px solid #e5e5e5",
            },
        },
        // Run Query Button
        {
            id: "db-run-query-btn",
            type: "component",
            name: "Run Query",
            componentId: "button_primary",
            bounds: { x: 276, y: 288, width: 120, height: 32 },
            zIndex: 2,
            props: {
                label: "Run Query",
                icon: "play",
                variant: "primary",
            },
        },
        // Export Button
        {
            id: "db-export-btn",
            type: "component",
            name: "Export Results",
            componentId: "button_secondary",
            bounds: { x: 408, y: 288, width: 100, height: 32 },
            zIndex: 2,
            props: {
                label: "Export",
                icon: "download",
            },
        },
        // Row Count Label
        {
            id: "db-row-count",
            type: "component",
            name: "Row Count",
            componentId: "text_label",
            bounds: { x: 1280, y: 294, width: 100, height: 20 },
            zIndex: 2,
            props: {
                text: "0 rows",
                variant: "caption",
            },
        },
        // Results Table Container
        {
            id: "db-results-container",
            type: "component",
            name: "Results Container",
            componentId: "container_fluid",
            bounds: { x: 260, y: 328, width: 1140, height: 520 },
            zIndex: 1,
            props: {
                backgroundColor: "#ffffff",
                overflow: "auto",
            },
        },
        // Data Grid/Table
        {
            id: "db-data-grid",
            type: "component",
            name: "Data Grid",
            componentId: "data_table",
            bounds: { x: 268, y: 336, width: 1124, height: 504 },
            zIndex: 2,
            props: {
                columns: [],
                rows: [],
                pagination: true,
                sortable: true,
                editable: true,
            },
        },
        // Status Bar
        {
            id: "db-status-bar",
            type: "component",
            name: "Status Bar",
            componentId: "container_footer",
            bounds: { x: 260, y: 856, width: 1140, height: 44 },
            zIndex: 1,
            props: {
                backgroundColor: "#f9fafb",
                borderTop: "1px solid #e5e5e5",
            },
        },
        // Query Execution Time
        {
            id: "db-exec-time",
            type: "component",
            name: "Execution Time",
            componentId: "text_label",
            bounds: { x: 276, y: 868, width: 150, height: 18 },
            zIndex: 2,
            props: {
                text: "Query executed in 0ms",
                variant: "caption",
            },
        },
    ],
};

// =============================================================================
// SETTINGS PANEL TEMPLATE
// =============================================================================

const settingsPanelTemplate: LayoutTemplate = {
    id: "layout-settings-panel",
    name: "Settings Panel",
    description: "Comprehensive settings panel with navigation, sections, and form controls",
    category: "settings",
    tags: ["settings", "configuration", "preferences", "options", "form"],
    icon: "⚙️",
    windowSize: { width: 900, height: 700 },
    elements: [
        // Left Navigation
        {
            id: "settings-nav",
            type: "component",
            name: "Settings Navigation",
            componentId: "container_sidebar",
            bounds: { x: 0, y: 0, width: 220, height: 700 },
            zIndex: 1,
            props: {
                backgroundColor: "#f8fafc",
                borderRight: "1px solid #e2e8f0",
            },
        },
        // Settings Title
        {
            id: "settings-title",
            type: "component",
            name: "Settings Title",
            componentId: "text_heading",
            bounds: { x: 20, y: 24, width: 180, height: 32 },
            zIndex: 2,
            props: {
                text: "Settings",
                level: "h2",
            },
        },
        // Nav Item: General
        {
            id: "settings-nav-general",
            type: "component",
            name: "General Nav",
            componentId: "nav_item",
            bounds: { x: 12, y: 72, width: 196, height: 40 },
            zIndex: 2,
            props: {
                label: "General",
                icon: "settings",
                active: true,
            },
        },
        // Nav Item: Appearance
        {
            id: "settings-nav-appearance",
            type: "component",
            name: "Appearance Nav",
            componentId: "nav_item",
            bounds: { x: 12, y: 116, width: 196, height: 40 },
            zIndex: 2,
            props: {
                label: "Appearance",
                icon: "palette",
                active: false,
            },
        },
        // Nav Item: API Keys
        {
            id: "settings-nav-api",
            type: "component",
            name: "API Keys Nav",
            componentId: "nav_item",
            bounds: { x: 12, y: 160, width: 196, height: 40 },
            zIndex: 2,
            props: {
                label: "API Keys",
                icon: "key",
                active: false,
            },
        },
        // Nav Item: Plugins
        {
            id: "settings-nav-plugins",
            type: "component",
            name: "Plugins Nav",
            componentId: "nav_item",
            bounds: { x: 12, y: 204, width: 196, height: 40 },
            zIndex: 2,
            props: {
                label: "Plugins",
                icon: "puzzle",
                active: false,
            },
        },
        // Nav Item: Advanced
        {
            id: "settings-nav-advanced",
            type: "component",
            name: "Advanced Nav",
            componentId: "nav_item",
            bounds: { x: 12, y: 248, width: 196, height: 40 },
            zIndex: 2,
            props: {
                label: "Advanced",
                icon: "code",
                active: false,
            },
        },
        // Nav Item: About
        {
            id: "settings-nav-about",
            type: "component",
            name: "About Nav",
            componentId: "nav_item",
            bounds: { x: 12, y: 648, width: 196, height: 40 },
            zIndex: 2,
            props: {
                label: "About",
                icon: "info",
                active: false,
            },
        },
        // Main Content Header
        {
            id: "settings-content-header",
            type: "component",
            name: "Content Header",
            componentId: "container_header",
            bounds: { x: 220, y: 0, width: 680, height: 72 },
            zIndex: 1,
            props: {
                backgroundColor: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                padding: "20px 32px",
            },
        },
        // Section Title
        {
            id: "settings-section-title",
            type: "component",
            name: "Section Title",
            componentId: "text_heading",
            bounds: { x: 252, y: 24, width: 200, height: 28 },
            zIndex: 2,
            props: {
                text: "General",
                level: "h3",
            },
        },
        // Settings Form Container
        {
            id: "settings-form-container",
            type: "component",
            name: "Form Container",
            componentId: "container_fluid",
            bounds: { x: 220, y: 72, width: 680, height: 560 },
            zIndex: 1,
            props: {
                backgroundColor: "#ffffff",
                padding: "32px",
                overflow: "auto",
            },
        },
        // Form Group: Language
        {
            id: "settings-form-language",
            type: "component",
            name: "Language Select",
            componentId: "form_group",
            bounds: { x: 252, y: 104, width: 400, height: 72 },
            zIndex: 2,
            props: {
                label: "Language",
                type: "select",
                options: ["English", "Spanish", "French", "German"],
            },
        },
        // Form Group: Theme
        {
            id: "settings-form-theme",
            type: "component",
            name: "Theme Toggle",
            componentId: "form_group",
            bounds: { x: 252, y: 192, width: 400, height: 72 },
            zIndex: 2,
            props: {
                label: "Dark Mode",
                type: "toggle",
                description: "Use dark theme across the application",
            },
        },
        // Form Group: Notifications
        {
            id: "settings-form-notifications",
            type: "component",
            name: "Notifications Toggle",
            componentId: "form_group",
            bounds: { x: 252, y: 280, width: 400, height: 72 },
            zIndex: 2,
            props: {
                label: "Enable Notifications",
                type: "toggle",
                description: "Receive system notifications",
            },
        },
        // Form Group: Auto-save
        {
            id: "settings-form-autosave",
            type: "component",
            name: "Auto-save Toggle",
            componentId: "form_group",
            bounds: { x: 252, y: 368, width: 400, height: 72 },
            zIndex: 2,
            props: {
                label: "Auto-save",
                type: "toggle",
                description: "Automatically save changes",
            },
        },
        // Form Group: Save Interval
        {
            id: "settings-form-interval",
            type: "component",
            name: "Save Interval",
            componentId: "form_group",
            bounds: { x: 252, y: 456, width: 400, height: 72 },
            zIndex: 2,
            props: {
                label: "Save Interval (seconds)",
                type: "number",
                placeholder: "30",
            },
        },
        // Action Footer
        {
            id: "settings-action-footer",
            type: "component",
            name: "Action Footer",
            componentId: "container_footer",
            bounds: { x: 220, y: 632, width: 680, height: 68 },
            zIndex: 1,
            props: {
                backgroundColor: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                padding: "16px 32px",
            },
        },
        // Reset Button
        {
            id: "settings-reset-btn",
            type: "component",
            name: "Reset Button",
            componentId: "button_secondary",
            bounds: { x: 252, y: 650, width: 120, height: 36 },
            zIndex: 2,
            props: {
                label: "Reset to Defaults",
                variant: "outline",
            },
        },
        // Save Button
        {
            id: "settings-save-btn",
            type: "component",
            name: "Save Button",
            componentId: "button_primary",
            bounds: { x: 768, y: 650, width: 100, height: 36 },
            zIndex: 2,
            props: {
                label: "Save",
                variant: "primary",
            },
        },
    ],
};

// =============================================================================
// LLM CONVERSATION WIDGET TEMPLATE
// =============================================================================

const llmWidgetTemplate: LayoutTemplate = {
    id: "layout-llm-widget",
    name: "LLM Conversation Widget",
    description: "Floating widget for real-time conversation with an LLM assistant",
    category: "widget",
    tags: ["widget", "llm", "assistant", "ai", "floating", "compact"],
    icon: "🤖",
    windowSize: { width: 380, height: 520 },
    isWidget: true,
    elements: [
        // Widget Container (rounded, shadow)
        {
            id: "widget-container",
            type: "component",
            name: "Widget Container",
            componentId: "container_card",
            bounds: { x: 0, y: 0, width: 380, height: 520 },
            zIndex: 1,
            props: {
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                overflow: "hidden",
            },
        },
        // Widget Header
        {
            id: "widget-header",
            type: "component",
            name: "Widget Header",
            componentId: "container_header",
            bounds: { x: 0, y: 0, width: 380, height: 56 },
            zIndex: 2,
            props: {
                backgroundColor: "#6366f1",
                padding: "12px 16px",
            },
        },
        // Assistant Avatar
        {
            id: "widget-avatar",
            type: "component",
            name: "Assistant Avatar",
            componentId: "avatar",
            bounds: { x: 16, y: 12, width: 32, height: 32 },
            zIndex: 3,
            props: {
                src: null,
                fallback: "AI",
                size: "sm",
            },
        },
        // Assistant Name
        {
            id: "widget-assistant-name",
            type: "component",
            name: "Assistant Name",
            componentId: "text_label",
            bounds: { x: 56, y: 12, width: 120, height: 20 },
            zIndex: 3,
            props: {
                text: "AI Assistant",
                color: "#ffffff",
                fontWeight: "semibold",
            },
        },
        // Status Badge
        {
            id: "widget-status",
            type: "component",
            name: "Status Badge",
            componentId: "badge_status",
            bounds: { x: 56, y: 34, width: 60, height: 16 },
            zIndex: 3,
            props: {
                status: "online",
                label: "Online",
                size: "xs",
            },
        },
        // Minimize Button
        {
            id: "widget-minimize-btn",
            type: "component",
            name: "Minimize Button",
            componentId: "button_icon",
            bounds: { x: 300, y: 12, width: 32, height: 32 },
            zIndex: 3,
            props: {
                icon: "minimize",
                variant: "ghost",
                color: "#ffffff",
            },
        },
        // Close Button
        {
            id: "widget-close-btn",
            type: "component",
            name: "Close Button",
            componentId: "button_icon",
            bounds: { x: 336, y: 12, width: 32, height: 32 },
            zIndex: 3,
            props: {
                icon: "x",
                variant: "ghost",
                color: "#ffffff",
            },
        },
        // Messages Container
        {
            id: "widget-messages",
            type: "component",
            name: "Messages Container",
            componentId: "container_fluid",
            bounds: { x: 0, y: 56, width: 380, height: 380 },
            zIndex: 2,
            props: {
                backgroundColor: "#f9fafb",
                padding: "16px",
                overflow: "auto",
            },
        },
        // Welcome Message Bubble
        {
            id: "widget-welcome-msg",
            type: "component",
            name: "Welcome Message",
            componentId: "chat_bubble",
            bounds: { x: 16, y: 72, width: 280, height: 64 },
            zIndex: 3,
            props: {
                message: "Hi! I'm your AI assistant. How can I help you today?",
                sender: "assistant",
                timestamp: "Just now",
            },
        },
        // Quick Action Chips Container
        {
            id: "widget-quick-actions",
            type: "component",
            name: "Quick Actions",
            componentId: "container_fluid",
            bounds: { x: 16, y: 152, width: 348, height: 44 },
            zIndex: 3,
            props: {
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
            },
        },
        // Quick Chip 1
        {
            id: "widget-chip-1",
            type: "component",
            name: "Quick Chip 1",
            componentId: "chip",
            bounds: { x: 16, y: 156, width: 100, height: 32 },
            zIndex: 4,
            props: {
                label: "Summarize",
                variant: "outline",
                clickable: true,
            },
        },
        // Quick Chip 2
        {
            id: "widget-chip-2",
            type: "component",
            name: "Quick Chip 2",
            componentId: "chip",
            bounds: { x: 124, y: 156, width: 100, height: 32 },
            zIndex: 4,
            props: {
                label: "Translate",
                variant: "outline",
                clickable: true,
            },
        },
        // Quick Chip 3
        {
            id: "widget-chip-3",
            type: "component",
            name: "Quick Chip 3",
            componentId: "chip",
            bounds: { x: 232, y: 156, width: 100, height: 32 },
            zIndex: 4,
            props: {
                label: "Explain",
                variant: "outline",
                clickable: true,
            },
        },
        // Input Container
        {
            id: "widget-input-container",
            type: "component",
            name: "Input Container",
            componentId: "container_footer",
            bounds: { x: 0, y: 436, width: 380, height: 84 },
            zIndex: 2,
            props: {
                backgroundColor: "#ffffff",
                borderTop: "1px solid #e5e7eb",
                padding: "16px",
            },
        },
        // Message Input
        {
            id: "widget-input-field",
            type: "component",
            name: "Message Input",
            componentId: "input_text",
            bounds: { x: 16, y: 452, width: 296, height: 48 },
            zIndex: 3,
            props: {
                placeholder: "Type a message...",
                borderRadius: "24px",
            },
        },
        // Send Button
        {
            id: "widget-send-btn",
            type: "component",
            name: "Send Button",
            componentId: "button_icon",
            bounds: { x: 320, y: 452, width: 48, height: 48 },
            zIndex: 3,
            props: {
                icon: "send",
                variant: "primary",
                borderRadius: "50%",
            },
        },
    ],
};

// =============================================================================
// EXPORT ALL TEMPLATES
// =============================================================================

/**
 * All available pre-built layout templates.
 */
export const layoutTemplates: LayoutTemplate[] = [
    chatApplicationTemplate,
    databaseViewerTemplate,
    settingsPanelTemplate,
    llmWidgetTemplate,
];

/**
 * Get template by ID.
 */
export const getTemplateById = (id: string): LayoutTemplate | undefined => {
    return layoutTemplates.find((t) => t.id === id);
};

/**
 * Get templates by category.
 */
export const getTemplatesByCategory = (category: LayoutTemplate["category"]): LayoutTemplate[] => {
    return layoutTemplates.filter((t) => t.category === category);
};

/**
 * Search templates by query.
 */
export const searchTemplates = (query: string): LayoutTemplate[] => {
    const q = query.toLowerCase();
    return layoutTemplates.filter(
        (t) =>
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
};

export default layoutTemplates;
