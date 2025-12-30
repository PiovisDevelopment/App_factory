/**
 * D017 - src/components/ui/ThemeCustomizationPanel.tsx
 * =====================================================
 * Theme customization panel with color pickers for: primary, secondary,
 * accent, background, text colors.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies:
 *   - D006 (design_tokens.css)
 *   - D007 (tailwind.config.js)
 *   - D010 (Button.tsx)
 *   - D011 (Input.tsx)
 *   - D012 (Select.tsx)
 *   - D015 (Panel.tsx)
 *   - D016 (ThemeProvider.tsx)
 *
 * Features:
 *   - Color pickers for all semantic color categories
 *   - Typography settings (font family, sizes)
 *   - Spacing and radius controls
 *   - Light/Dark mode toggle
 *   - Theme preset management (save, load, delete)
 *   - Real-time preview updates
 */

import React, { useState, useCallback, type ChangeEvent } from "react";
import {
  useThemeStore,
  defaultLightTheme,
  defaultDarkTheme,
  type ColorScale,
  type SemanticColors,
  type ThemeConfig,
} from "../../context/ThemeProvider";
import Button from "./Button";
import Input from "./Input";
import Select, { type SelectOption } from "./Select";
import Panel from "./Panel";

// ============================================
// Icons
// ============================================

const SunIcon = () => (
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
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
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
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const CloseIcon = () => (
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TrashIcon = () => (
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

// ============================================
// Color Picker Component
// ============================================

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value,
  onChange,
  disabled = false,
}) => {
  const handleColorChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleHexChange = (e: ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-neutral-700 w-16 shrink-0">
        {label}
      </label>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={value}
          onChange={handleColorChange}
          disabled={disabled}
          className={[
            "w-8",
            "h-8",
            "rounded",
            "border",
            "border-neutral-300",
            "cursor-pointer",
            "p-0.5",
            disabled ? "opacity-50 cursor-not-allowed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`${label} color picker`}
        />
        <input
          type="text"
          value={value}
          onChange={handleHexChange}
          disabled={disabled}
          className={[
            "font-mono",
            "text-xs",
            "uppercase",
            "w-20",
            "px-2",
            "py-1",
            "border",
            "border-neutral-300",
            "rounded",
            "focus:outline-none",
            "focus:ring-2",
            "focus:ring-primary-500",
            disabled ? "opacity-50 cursor-not-allowed bg-neutral-100" : "bg-white",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`${label} hex value`}
        />
      </div>
    </div>
  );
};

// ============================================
// Color Scale Editor
// ============================================

interface ColorScaleEditorProps {
  category: keyof SemanticColors;
  scale: Partial<ColorScale>;
  onShadeChange: (shade: keyof ColorScale, value: string) => void;
  disabled?: boolean;
}

const ColorScaleEditor: React.FC<ColorScaleEditorProps> = ({
  category,
  scale,
  onShadeChange,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(category === "primary");

  const shades: (keyof ColorScale)[] =
    category === "primary" || category === "neutral"
      ? [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      : [50, 500, 600, 700];

  return (
    <div className="border border-neutral-200 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={[
          "w-full",
          "flex",
          "items-center",
          "justify-between",
          "px-3",
          "py-2",
          "bg-neutral-50",
          "hover:bg-neutral-100",
          "transition-colors",
          "text-left",
        ].join(" ")}
      >
        <span className="capitalize text-sm font-medium text-neutral-800">
          {category}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {[500, 600, 700].map((shade) => (
              <div
                key={shade}
                className="w-4 h-4 rounded-full border border-white"
                style={{ backgroundColor: scale[shade as keyof ColorScale] || "#000" }}
              />
            ))}
          </div>
          <svg
            className={[
              "h-4 w-4 text-neutral-500 transition-transform",
              isExpanded ? "rotate-180" : "",
            ].join(" ")}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      {isExpanded && (
        <div className="p-3 space-y-2 bg-white">
          {shades.map((shade) => (
            <ColorPicker
              key={shade}
              label={String(shade)}
              value={(scale[shade] as string) || "#000000"}
              onChange={(value) => onShadeChange(shade, value)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// Tab Navigation
// ============================================

type TabId = "colors" | "typography" | "spacing" | "presets";

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing" },
  { id: "presets", label: "Presets" },
];

// ============================================
// Main Component
// ============================================

export interface ThemeCustomizationPanelProps {
  /** Whether the panel is open */
  isOpen?: boolean;
  /** Callback when panel should close */
  onClose?: () => void;
  /** Position of the panel */
  position?: "left" | "right";
  /** Width of the panel */
  width?: string;
}

/**
 * ThemeCustomizationPanel component.
 *
 * A comprehensive panel for customizing theme colors, typography,
 * spacing, and managing theme presets. Changes are reflected immediately
 * in the preview (no page reload required).
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <ThemeCustomizationPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   position="right"
 * />
 * ```
 */
export const ThemeCustomizationPanel: React.FC<ThemeCustomizationPanelProps> = ({
  isOpen: controlledOpen,
  onClose,
  position = "right",
  width = "360px",
}) => {
  const {
    theme,
    savedThemes,
    isPanelOpen,
    setColor,
    setTypography,
    setRadius,
    toggleMode,
    saveTheme,
    loadTheme,
    deleteTheme,
    resetToDefault,
    setPanelOpen,
  } = useThemeStore();

  const isOpen = controlledOpen ?? isPanelOpen;
  const [activeTab, setActiveTab] = useState<TabId>("colors");
  const [newThemeName, setNewThemeName] = useState("");

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      setPanelOpen(false);
    }
  }, [onClose, setPanelOpen]);

  const handleSaveTheme = useCallback(() => {
    if (newThemeName.trim()) {
      saveTheme(newThemeName.trim());
      setNewThemeName("");
    }
  }, [newThemeName, saveTheme]);

  const handleColorChange = useCallback(
    (category: keyof SemanticColors, shade: keyof ColorScale, value: string) => {
      setColor(category, shade, value);
    },
    [setColor]
  );

  if (!isOpen) {
    return null;
  }

  const positionClasses =
    position === "right"
      ? "right-0 border-l"
      : "left-0 border-r";

  const fontFamilyOptions: SelectOption[] = [
    { value: '"Inter", system-ui, sans-serif', label: "Inter" },
    { value: '"Segoe UI", system-ui, sans-serif', label: "Segoe UI" },
    { value: 'system-ui, sans-serif', label: "System Default" },
    { value: '"Roboto", sans-serif', label: "Roboto" },
  ];

  const monoFontOptions: SelectOption[] = [
    { value: '"JetBrains Mono", monospace', label: "JetBrains Mono" },
    { value: '"Fira Code", monospace', label: "Fira Code" },
    { value: '"Consolas", monospace', label: "Consolas" },
    { value: 'monospace', label: "System Mono" },
  ];

  return (
    <div
      className={[
        "fixed",
        "top-0",
        "bottom-0",
        "z-40",
        "bg-white",
        "shadow-xl",
        "flex",
        "flex-col",
        "border-neutral-200",
        positionClasses,
      ].join(" ")}
      style={{ width }}
      role="dialog"
      aria-label="Theme Customization Panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50 shrink-0">
        <h2 className="text-lg font-semibold text-neutral-900">
          Theme Settings
        </h2>
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <button
            type="button"
            onClick={toggleMode}
            className={[
              "p-2",
              "rounded-md",
              "hover:bg-neutral-200",
              "transition-colors",
              "text-neutral-600",
            ].join(" ")}
            aria-label={`Switch to ${theme.mode === "light" ? "dark" : "light"} mode`}
          >
            {theme.mode === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className={[
              "p-2",
              "rounded-md",
              "hover:bg-neutral-200",
              "transition-colors",
              "text-neutral-600",
            ].join(" ")}
            aria-label="Close panel"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-neutral-200 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex-1",
              "px-3",
              "py-2",
              "text-sm",
              "font-medium",
              "transition-colors",
              "border-b-2",
              "-mb-px",
              activeTab === tab.id
                ? "border-primary-500 text-primary-600 bg-primary-50"
                : "border-transparent text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Colors Tab */}
        {activeTab === "colors" && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Customize your color palette. Changes apply immediately.
            </p>
            {(Object.keys(theme.colors) as Array<keyof SemanticColors>).map(
              (category) => (
                <ColorScaleEditor
                  key={category}
                  category={category}
                  scale={theme.colors[category]}
                  onShadeChange={(shade, value) =>
                    handleColorChange(category, shade, value)
                  }
                />
              )
            )}
          </div>
        )}

        {/* Typography Tab */}
        {activeTab === "typography" && (
          <div className="space-y-6">
            <p className="text-sm text-neutral-600">
              Configure fonts and text sizes for your application.
            </p>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-neutral-800">
                Font Families
              </h3>
              <Select
                label="Sans-serif Font"
                options={fontFamilyOptions}
                value={theme.typography.fontFamily.sans}
                onChange={(e) =>
                  setTypography("fontFamily", {
                    ...theme.typography.fontFamily,
                    sans: e.target.value,
                  })
                }
                fullWidth
              />
              <Select
                label="Monospace Font"
                options={monoFontOptions}
                value={theme.typography.fontFamily.mono}
                onChange={(e) =>
                  setTypography("fontFamily", {
                    ...theme.typography.fontFamily,
                    mono: e.target.value,
                  })
                }
                fullWidth
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-neutral-800">
                Font Sizes
              </h3>
              {(Object.keys(theme.typography.fontSize) as Array<keyof typeof theme.typography.fontSize>).map(
                (size) => (
                  <div key={size} className="flex items-center gap-3">
                    <label className="text-sm text-neutral-700 w-12">{size}</label>
                    <Input
                      size="sm"
                      value={theme.typography.fontSize[size]}
                      onChange={(e) =>
                        setTypography("fontSize", {
                          ...theme.typography.fontSize,
                          [size]: e.target.value,
                        })
                      }
                      className="w-24"
                    />
                    <span
                      style={{ fontSize: theme.typography.fontSize[size] }}
                      className="text-neutral-800"
                    >
                      Sample
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Spacing Tab */}
        {activeTab === "spacing" && (
          <div className="space-y-6">
            <p className="text-sm text-neutral-600">
              Adjust spacing scale and border radius values.
            </p>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-neutral-800">
                Border Radius
              </h3>
              {(Object.keys(theme.radius) as Array<keyof typeof theme.radius>).map(
                (key) => (
                  <div key={key} className="flex items-center gap-3">
                    <label className="text-sm text-neutral-700 w-12">{key}</label>
                    <Input
                      size="sm"
                      value={theme.radius[key]}
                      onChange={(e) => setRadius(key, e.target.value)}
                      className="w-24"
                    />
                    <div
                      className="w-10 h-10 bg-primary-500"
                      style={{ borderRadius: theme.radius[key] }}
                    />
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Presets Tab */}
        {activeTab === "presets" && (
          <div className="space-y-6">
            <p className="text-sm text-neutral-600">
              Save and load theme configurations.
            </p>

            {/* Save New Preset */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-800">
                Save Current Theme
              </h3>
              <div className="flex gap-2">
                <Input
                  size="sm"
                  placeholder="Theme name"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTheme()}
                  fullWidth
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveTheme}
                  disabled={!newThemeName.trim()}
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Saved Presets */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-800">
                Saved Themes
              </h3>
              <div className="space-y-2">
                {savedThemes.map((savedTheme) => (
                  <div
                    key={savedTheme.name}
                    className={[
                      "flex",
                      "items-center",
                      "justify-between",
                      "p-3",
                      "rounded-md",
                      "border",
                      theme.name === savedTheme.name
                        ? "border-primary-500 bg-primary-50"
                        : "border-neutral-200 bg-white hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1">
                        <div
                          className="w-5 h-5 rounded-full border-2 border-white"
                          style={{ backgroundColor: savedTheme.colors.primary[500] }}
                        />
                        <div
                          className="w-5 h-5 rounded-full border-2 border-white"
                          style={{ backgroundColor: savedTheme.colors.neutral[500] }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-800">
                          {savedTheme.name}
                        </p>
                        <p className="text-xs text-neutral-500 capitalize">
                          {savedTheme.mode} mode
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => loadTheme(savedTheme.name)}
                        disabled={theme.name === savedTheme.name}
                      >
                        Load
                      </Button>
                      {savedTheme.name !== "Default" &&
                        savedTheme.name !== "Default Dark" && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => deleteTheme(savedTheme.name)}
                            className="text-error-600 hover:text-error-700 hover:bg-error-50"
                          >
                            <TrashIcon />
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reset Button */}
            <div className="pt-4 border-t border-neutral-200">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefault}
                fullWidth
              >
                Reset to Default
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50 shrink-0">
        <p className="text-xs text-neutral-500 text-center">
          Current: <span className="font-medium">{theme.name}</span> ({theme.mode})
        </p>
      </div>
    </div>
  );
};

ThemeCustomizationPanel.displayName = "ThemeCustomizationPanel";

export default ThemeCustomizationPanel;
