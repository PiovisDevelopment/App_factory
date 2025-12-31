/**
 * D017 - src/components/ui/ThemeCustomizationPanel.tsx
 * =====================================================
 * Theme customization panel with single-tab themes list view.
 * 
 * Features:
 *   - Themes list with load/edit/delete actions
 *   - Modal dialog for editing theme (colors, typography, spacing)
 *   - Google Fonts integration for adding custom fonts
 *   - Save button for persistence
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  useThemeStore,
  defaultLightTheme,
  type ColorScale,
  type ThemeConfig,
  type CustomFont,
} from "../../context/ThemeProvider";
import Button from "./Button";
import Input from "./Input";
import Select, { type SelectOption } from "./Select";
// Panel import removed - not used in simplified UI

// ============================================
// Popular Google Fonts
// ============================================

const POPULAR_GOOGLE_FONTS = [
  { name: "Inter", family: "Inter" },
  { name: "Roboto", family: "Roboto" },
  { name: "Open Sans", family: "Open+Sans" },
  { name: "Lato", family: "Lato" },
  { name: "Montserrat", family: "Montserrat" },
  { name: "Poppins", family: "Poppins" },
  { name: "Source Sans Pro", family: "Source+Sans+Pro" },
  { name: "Raleway", family: "Raleway" },
  { name: "Nunito", family: "Nunito" },
  { name: "Ubuntu", family: "Ubuntu" },
  { name: "Fira Code", family: "Fira+Code" },
  { name: "JetBrains Mono", family: "JetBrains+Mono" },
  { name: "Source Code Pro", family: "Source+Code+Pro" },
  { name: "IBM Plex Mono", family: "IBM+Plex+Mono" },
];

// ============================================
// Icons
// ============================================

const SunIcon = () => (
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TrashIcon = () => (
  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const EditIcon = () => (
  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

// ============================================
// Color Picker Component
// ============================================

interface ColorSwatchProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const ColorSwatch: React.FC<ColorSwatchProps> = ({ value, onChange, disabled }) => (
  <div className="relative">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={[
        "w-11 h-11",                    // HIG: 44px touch target (approx)
        "rounded-lg",                   // HIG: Consistent corner radius
        "border-2 border-neutral-200",  // HIG: Visible boundary
        "cursor-pointer",
        "p-1",
        "transition-all duration-200 ease-out",  // HIG: Smooth state transitions
        "hover:border-neutral-400",
        "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].filter(Boolean).join(" ")}
      aria-label="Color picker"
    />
  </div>
);

interface HexInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const HexInput: React.FC<HexInputProps> = ({ value, onChange, disabled }) => {
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    // Allow typing valid hex chars, validate on blur if needed or purely restrict here
    // For now, pass through if it matches basic hex structure pattern length-wise or char-wise
    if (/^#[0-9A-Fa-f]*$/.test(hex) && hex.length <= 7) {
      onChange(hex);
    }
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleHexChange}
      disabled={disabled}
      className={[
        "font-mono text-sm uppercase",
        "w-24 h-11",                     // HIG: Match 44px height
        "px-3",                          // HIG: 8pt grid padding
        "border-2 border-neutral-200",
        "rounded-lg",
        "text-right",                    // HIG: Right align hex values
        "transition-all duration-200 ease-out",
        "hover:border-neutral-400",
        "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:border-transparent",
        disabled ? "opacity-50 cursor-not-allowed bg-neutral-100" : "bg-white",
      ].filter(Boolean).join(" ")}
      aria-label="Hex value"
    />
  );
};

// ============================================
// Google Fonts Modal
// ============================================

interface GoogleFontsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFont: (font: { name: string; family: string }) => void;
  installedFonts: CustomFont[];
}

const GoogleFontsModal: React.FC<GoogleFontsModalProps> = ({ isOpen, onClose, onSelectFont, installedFonts }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingFont, setLoadingFont] = useState<string | null>(null);

  const filteredFonts = POPULAR_GOOGLE_FONTS.filter(
    (font) => font.name.toLowerCase().includes(searchTerm.toLowerCase()) && !installedFonts.some((f) => f.name === font.name)
  );

  const handleSelectFont = async (font: { name: string; family: string }) => {
    setLoadingFont(font.name);
    // Simulate loading delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));
    onSelectFont(font);
    setLoadingFont(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <h3 className="text-lg font-semibold text-neutral-900">Add Google Font</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-neutral-100">
            <CloseIcon />
          </button>
        </div>
        <div className="p-4">
          <Input size="sm" placeholder="Search fonts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} fullWidth />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {filteredFonts.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-4">No fonts found</p>
          ) : (
            filteredFonts.map((font) => (
              <button
                key={font.name}
                type="button"
                onClick={() => handleSelectFont(font)}
                disabled={loadingFont !== null}
                className="w-full flex items-center justify-between p-3 rounded-md border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                <span className="text-sm font-medium text-neutral-800">{font.name}</span>
                {loadingFont === font.name ? (
                  <span className="text-xs text-neutral-500">Loading...</span>
                ) : (
                  <PlusIcon />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Theme Editor Modal
// ============================================

interface ThemeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeConfig | null;
  isNew: boolean;
  onSave: (theme: ThemeConfig) => void;
  customFonts: CustomFont[];
  onAddFont: (font: CustomFont) => void;
}

const ThemeEditorModal: React.FC<ThemeEditorModalProps> = ({ isOpen, onClose, theme, isNew, onSave, customFonts, onAddFont }) => {
  const [editingTheme, setEditingTheme] = useState<ThemeConfig | null>(null);
  const [showFontsModal, setShowFontsModal] = useState(false);

  useEffect(() => {
    if (theme) {
      setEditingTheme({ ...theme });
    } else if (isNew) {
      setEditingTheme({ ...defaultLightTheme, name: "" });
    }
  }, [theme, isNew]);

  // Helper: Generate color scale from a base color (500 shade)
  const generateColorScale = (baseColor: string): ColorScale => {
    // Parse hex to get HSL for manipulation
    const hexToHsl = (hex: string): [number, number, number] => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return [h * 360, s * 100, l * 100];
    };

    const hslToHex = (h: number, s: number, l: number): string => {
      s /= 100; l /= 100;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (h < 60) { r = c; g = x; }
      else if (h < 120) { r = x; g = c; }
      else if (h < 180) { g = c; b = x; }
      else if (h < 240) { g = x; b = c; }
      else if (h < 300) { r = x; b = c; }
      else { r = c; b = x; }
      const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const [h, s, l] = hexToHsl(baseColor);
    return {
      50: hslToHex(h, Math.min(s * 0.3, 100), Math.min(l + 45, 97)),
      100: hslToHex(h, Math.min(s * 0.4, 100), Math.min(l + 38, 94)),
      200: hslToHex(h, Math.min(s * 0.5, 100), Math.min(l + 28, 88)),
      300: hslToHex(h, Math.min(s * 0.7, 100), Math.min(l + 18, 78)),
      400: hslToHex(h, Math.min(s * 0.85, 100), Math.min(l + 8, 65)),
      500: baseColor,
      600: hslToHex(h, Math.min(s * 1.1, 100), Math.max(l - 8, 25)),
      700: hslToHex(h, Math.min(s * 1.15, 100), Math.max(l - 16, 20)),
      800: hslToHex(h, Math.min(s * 1.2, 100), Math.max(l - 24, 15)),
      900: hslToHex(h, Math.min(s * 1.25, 100), Math.max(l - 32, 10)),
      950: hslToHex(h, Math.min(s * 1.3, 100), Math.max(l - 40, 5)),
    };
  };

  const handleSimplifiedColorChange = (category: "primary" | "neutral" | "info", value: string) => {
    if (!editingTheme) return;
    const scale = generateColorScale(value);
    setEditingTheme({
      ...editingTheme,
      colors: {
        ...editingTheme.colors,
        [category]: category === "primary" || category === "neutral"
          ? scale
          : { 50: scale[50], 500: scale[500], 600: scale[600], 700: scale[700] },
      },
    });
  };

  const handleTypographyChange = (type: "sans" | "mono", value: string) => {
    if (!editingTheme) return;
    setEditingTheme({
      ...editingTheme,
      typography: {
        ...editingTheme.typography,
        fontFamily: {
          ...editingTheme.typography.fontFamily,
          [type]: value,
        },
      },
    });
  };

  // Header/Body text colors mapped to neutral scale endpoints
  const handleTextColorChange = (type: "header" | "body", value: string) => {
    if (!editingTheme) return;
    // Header color maps to neutral-900 (darker), body maps to neutral-700
    const shade = type === "header" ? 900 : 700;
    setEditingTheme({
      ...editingTheme,
      colors: {
        ...editingTheme.colors,
        neutral: {
          ...editingTheme.colors.neutral,
          [shade]: value,
        },
      },
    });
  };

  const handleModeToggle = () => {
    if (!editingTheme) return;
    const newMode = editingTheme.mode === "light" ? "dark" : "light";
    setEditingTheme({
      ...editingTheme,
      mode: newMode,
    });
  };

  const handleSave = () => {
    if (editingTheme && editingTheme.name.trim()) {
      onSave(editingTheme);
      onClose();
    }
  };

  const handleAddGoogleFont = (font: { name: string; family: string }) => {
    const url = `https://fonts.googleapis.com/css2?family=${font.family}:wght@400;500;600;700&display=swap`;

    // Inject the font stylesheet
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);

    const customFont: CustomFont = {
      name: font.name,
      family: `"${font.name}", sans-serif`,
      url,
      loaded: true,
    };
    onAddFont(customFont);
    setShowFontsModal(false);
  };

  // Build font options including custom fonts
  const fontFamilyOptions: SelectOption[] = [
    { value: '"Inter", system-ui, sans-serif', label: "Inter" },
    { value: '"Segoe UI", system-ui, sans-serif', label: "Segoe UI" },
    { value: "system-ui, sans-serif", label: "System Default" },
    { value: '"Roboto", sans-serif', label: "Roboto" },
    { value: '"Poppins", sans-serif', label: "Poppins" },
    { value: '"Montserrat", sans-serif', label: "Montserrat" },
    ...customFonts.map((f) => ({ value: f.family, label: f.name })),
  ];

  if (!isOpen || !editingTheme) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-[520px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50 rounded-t-lg">
            <h3 className="text-lg font-semibold text-neutral-900">{isNew ? "Create Theme" : `Edit: ${theme?.name}`}</h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleModeToggle} className="p-2 rounded-md hover:bg-neutral-200 transition-colors text-neutral-600" aria-label={`Switch to ${editingTheme.mode === "light" ? "dark" : "light"} mode`}>
                {editingTheme.mode === "light" ? <MoonIcon /> : <SunIcon />}
              </button>
              <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-neutral-200 transition-colors text-neutral-600">
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Theme Name */}
          <div className="px-6 py-4 border-b border-neutral-200 bg-white">
            <Input size="sm" label="Theme Name" placeholder="Enter theme name..." value={editingTheme.name} onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })} fullWidth />
          </div>

          {/* Scrolling Content - Removed max-height constraint to use flexible height up to 90vh */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

            {/* Typography Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <h4 className="text-sm font-semibold text-neutral-800">Typography</h4>
                <Button variant="ghost" size="xs" onClick={() => setShowFontsModal(true)} className="text-primary-600 hover:text-primary-700 hover:bg-primary-50">
                  <PlusIcon />
                  <span className="ml-1">Add Google Font</span>
                </Button>
              </div>

              {/* Fonts Grid */}
              <div className="space-y-6">
                {/* Header Font */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-900 block">Header Font</label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Select
                        options={fontFamilyOptions}
                        value={editingTheme.typography.fontFamily.sans}
                        onChange={(e) => handleTypographyChange("sans", e.target.value)}
                        fullWidth
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-neutral-500 mr-1">Color</span>
                      <ColorSwatch
                        value={editingTheme.colors.neutral[900] || "#18181b"}
                        onChange={(value) => handleTextColorChange("header", value)}
                      />
                      <HexInput
                        value={editingTheme.colors.neutral[900] || "#18181b"}
                        onChange={(value) => handleTextColorChange("header", value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Body Font */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-900 block">Body Font</label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Select
                        options={fontFamilyOptions}
                        value={editingTheme.typography.fontFamily.sans}
                        onChange={(e) => handleTypographyChange("sans", e.target.value)}
                        fullWidth
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-neutral-500 mr-1">Color</span>
                      <ColorSwatch
                        value={editingTheme.colors.neutral[700] || "#3f3f46"}
                        onChange={(value) => handleTextColorChange("body", value)}
                      />
                      <HexInput
                        value={editingTheme.colors.neutral[700] || "#3f3f46"}
                        onChange={(value) => handleTextColorChange("body", value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Colors Section - Unified Grid Layout */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-neutral-800 border-b border-neutral-200 pb-2">Colors</h4>

              <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-4 items-center">

                {/* Headers (Implicitly defined by alignment) */}

                {/* Row 1: Backgrounds */}
                <span className="text-sm font-medium text-neutral-700 text-left">Backgrounds & Highlights</span>
                <ColorSwatch
                  value={editingTheme.colors.neutral[100] || "#f4f4f5"}
                  onChange={(value) => handleSimplifiedColorChange("neutral", value)}
                />
                <HexInput
                  value={editingTheme.colors.neutral[100] || "#f4f4f5"}
                  onChange={(value) => handleSimplifiedColorChange("neutral", value)}
                />

                {/* Row 2: Primary Accent */}
                <span className="text-sm font-medium text-neutral-700 text-left">Primary Accent</span>
                <ColorSwatch
                  value={editingTheme.colors.primary[500] || "#3b82f6"}
                  onChange={(value) => handleSimplifiedColorChange("primary", value)}
                />
                <HexInput
                  value={editingTheme.colors.primary[500] || "#3b82f6"}
                  onChange={(value) => handleSimplifiedColorChange("primary", value)}
                />

                {/* Row 3: Accent Elements */}
                <span className="text-sm font-medium text-neutral-700 text-left">Accent Elements</span>
                <ColorSwatch
                  value={editingTheme.colors.info?.[500] || "#3b82f6"}
                  onChange={(value) => handleSimplifiedColorChange("info", value)}
                />
                <HexInput
                  value={editingTheme.colors.info?.[500] || "#3b82f6"}
                  onChange={(value) => handleSimplifiedColorChange("info", value)}
                />

                {/* Row 4: Clean Backgrounds */}
                <span className="text-sm font-medium text-neutral-700 text-left">Clean Backgrounds</span>
                <ColorSwatch
                  value={editingTheme.colors.neutral[50] || "#fafafa"}
                  onChange={(value) => {
                    if (!editingTheme) return;
                    setEditingTheme({
                      ...editingTheme,
                      colors: {
                        ...editingTheme.colors,
                        neutral: {
                          ...editingTheme.colors.neutral,
                          50: value,
                        },
                      },
                    });
                  }}
                />
                <HexInput
                  value={editingTheme.colors.neutral[50] || "#fafafa"}
                  onChange={(value) => {
                    // Same logic as onChange above repeated for hex
                    if (!editingTheme) return;
                    setEditingTheme({
                      ...editingTheme,
                      colors: {
                        ...editingTheme.colors,
                        neutral: {
                          ...editingTheme.colors.neutral,
                          50: value,
                        },
                      },
                    });
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-200 bg-neutral-50 rounded-b-lg">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!editingTheme.name.trim()}>Save Theme</Button>
          </div>
        </div>
      </div>

      <GoogleFontsModal isOpen={showFontsModal} onClose={() => setShowFontsModal(false)} onSelectFont={handleAddGoogleFont} installedFonts={customFonts} />
    </>
  );
};

// ============================================
// Main Component
// ============================================

export interface ThemeCustomizationPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  position?: "left" | "right";
  width?: string;
}

export const ThemeCustomizationPanel: React.FC<ThemeCustomizationPanelProps> = ({ isOpen: controlledOpen, onClose, position = "right", width = "360px" }) => {
  const {
    theme,
    savedThemes,
    isPanelOpen,
    customFonts,
    toggleMode,
    loadTheme,
    saveTheme,
    deleteTheme,
    updateTheme,
    resetToDefault,
    setPanelOpen,
    addCustomFont,
  } = useThemeStore();

  const isOpen = controlledOpen ?? isPanelOpen;
  const [editingTheme, setEditingTheme] = useState<ThemeConfig | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      setPanelOpen(false);
    }
  }, [onClose, setPanelOpen]);

  const handleEditTheme = (themeToEdit: ThemeConfig) => {
    setIsCreatingNew(false);
    setEditingTheme(themeToEdit);
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setEditingTheme(null);
  };

  const handleSaveEditedTheme = (updatedTheme: ThemeConfig) => {
    if (isCreatingNew) {
      // For new themes, save as a new theme entry
      saveTheme(updatedTheme.name);
      // Then update with full theme data
      updateTheme(updatedTheme.name, updatedTheme);
    } else if (editingTheme) {
      // Update existing theme
      updateTheme(editingTheme.name, updatedTheme);
    }
    setEditingTheme(null);
    setIsCreatingNew(false);
  };

  const handleQuickSave = () => {
    if (newThemeName.trim()) {
      saveTheme(newThemeName.trim());
      setNewThemeName("");
    }
  };

  if (!isOpen) {
    return null;
  }

  const positionClasses = position === "right" ? "right-0 border-l" : "left-0 border-r";

  return (
    <>
      <div
        className={["fixed", "top-0", "bottom-0", "z-40", "bg-white", "shadow-xl", "flex", "flex-col", "border-neutral-200", positionClasses].join(" ")}
        style={{ width }}
        role="dialog"
        aria-label="Theme Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50 shrink-0">
          <h2 className="text-lg font-semibold text-neutral-900">Theme Settings</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleMode} className="p-2 rounded-md hover:bg-neutral-200 transition-colors text-neutral-600" aria-label={`Switch to ${theme.mode === "light" ? "dark" : "light"} mode`}>
              {theme.mode === "light" ? <MoonIcon /> : <SunIcon />}
            </button>
            <button type="button" onClick={handleClose} className="p-2 rounded-md hover:bg-neutral-200 transition-colors text-neutral-600" aria-label="Close panel">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Quick Save Current Theme */}
          <div className="space-y-2 mb-4">
            <h3 className="text-sm font-semibold text-neutral-800">Save Current Theme</h3>
            <div className="flex gap-2">
              <Input size="sm" placeholder="Theme name" value={newThemeName} onChange={(e) => setNewThemeName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuickSave()} fullWidth />
              <Button variant="primary" size="sm" onClick={handleQuickSave} disabled={!newThemeName.trim()}>Save</Button>
            </div>
          </div>

          {/* Add New Theme Button */}
          <Button variant="outline" size="sm" onClick={handleCreateNew} fullWidth className="mb-4">
            <PlusIcon />
            <span className="ml-2">Add New Theme</span>
          </Button>

          {/* Themes List */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-800">Saved Themes</h3>
            {savedThemes.map((savedTheme) => (
              <div
                key={savedTheme.name}
                className={["flex", "items-center", "justify-between", "p-3", "rounded-md", "border", theme.name === savedTheme.name ? "border-primary-500 bg-primary-50" : "border-neutral-200 bg-white hover:bg-neutral-50"].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-1">
                    <div className="w-5 h-5 rounded-full border-2 border-white" style={{ backgroundColor: savedTheme.colors.primary[500] }} />
                    <div className="w-5 h-5 rounded-full border-2 border-white" style={{ backgroundColor: savedTheme.colors.neutral[500] }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{savedTheme.name}</p>
                    <p className="text-xs text-neutral-500 capitalize">{savedTheme.mode} Mode</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="xs" onClick={() => loadTheme(savedTheme.name)} disabled={theme.name === savedTheme.name}>Load</Button>
                  <Button variant="ghost" size="xs" onClick={() => handleEditTheme(savedTheme)}>
                    <EditIcon />
                  </Button>
                  {savedTheme.name !== "Default" && savedTheme.name !== "Default Dark" && (
                    <Button variant="ghost" size="xs" onClick={() => deleteTheme(savedTheme.name)} className="text-error-600 hover:text-error-700 hover:bg-error-50">
                      <TrashIcon />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Reset Button */}
          <div className="pt-4 mt-4 border-t border-neutral-200">
            <Button variant="outline" size="sm" onClick={resetToDefault} fullWidth>
              <RefreshIcon />
              <span className="ml-2">Reset to Default</span>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50 shrink-0">
          <p className="text-xs text-neutral-500 text-center">
            Current: <span className="font-medium">{theme.name}</span> ({theme.mode})
          </p>
        </div>
      </div>

      {/* Edit Theme Modal */}
      <ThemeEditorModal
        isOpen={editingTheme !== null || isCreatingNew}
        onClose={() => {
          setEditingTheme(null);
          setIsCreatingNew(false);
        }}
        theme={editingTheme}
        isNew={isCreatingNew}
        onSave={handleSaveEditedTheme}
        customFonts={customFonts}
        onAddFont={addCustomFont}
      />
    </>
  );
};

ThemeCustomizationPanel.displayName = "ThemeCustomizationPanel";

export default ThemeCustomizationPanel;
