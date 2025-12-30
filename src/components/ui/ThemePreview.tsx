/**
 * D018 - src/components/ui/ThemePreview.tsx
 * ==========================================
 * Theme preview component that updates in real-time as theme changes.
 * No page reload required - uses CSS custom properties injection.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies:
 *   - D006 (design_tokens.css)
 *   - D007 (tailwind.config.js)
 *   - D010 (Button.tsx)
 *   - D011 (Input.tsx)
 *   - D012 (Select.tsx)
 *   - D013 (Checkbox.tsx)
 *   - D015 (Panel.tsx)
 *   - D016 (ThemeProvider.tsx)
 *   - D017 (ThemeCustomizationPanel.tsx)
 *
 * Features:
 *   - Real-time preview of all atomic components
 *   - Showcases all variants, sizes, and states
 *   - Responsive to theme changes without refresh
 *   - Demonstrates color palette usage
 */

import React, { useState } from "react";
import { useThemeStore } from "../../context/ThemeProvider";
import Button from "./Button";
import Input from "./Input";
import Select from "./Select";
import Checkbox from "./Checkbox";
import Panel, { PanelHeader, PanelBody, PanelFooter } from "./Panel";

// ============================================
// Preview Section Component
// ============================================

interface PreviewSectionProps {
  title: string;
  children: React.ReactNode;
}

const PreviewSection: React.FC<PreviewSectionProps> = ({ title, children }) => (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide">
      {title}
    </h3>
    <div className="space-y-3">{children}</div>
  </div>
);

// ============================================
// Color Swatch Component
// ============================================

interface ColorSwatchProps {
  name: string;
  shades: Record<string | number, string>;
}

const ColorSwatch: React.FC<ColorSwatchProps> = ({ name, shades }) => {
  const displayShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].filter(
    (s) => shades[s]
  );

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-neutral-600 capitalize">{name}</p>
      <div className="flex rounded-md overflow-hidden">
        {displayShades.map((shade) => (
          <div
            key={shade}
            className="flex-1 h-8 relative group"
            style={{ backgroundColor: shades[shade] }}
            title={`${name}-${shade}: ${shades[shade]}`}
          >
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 text-white">
              {shade}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// Main Preview Component
// ============================================

export interface ThemePreviewProps {
  /** Whether to show color palette section */
  showColorPalette?: boolean;
  /** Whether to show component examples */
  showComponents?: boolean;
  /** Whether to show typography examples */
  showTypography?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * ThemePreview component.
 *
 * Displays a live preview of the current theme settings, showcasing
 * all atomic components and the color palette. Updates in real-time
 * as theme values change without requiring a page reload.
 *
 * @example
 * ```tsx
 * // Full preview with all sections
 * <ThemePreview />
 *
 * // Only components
 * <ThemePreview showColorPalette={false} showTypography={false} />
 *
 * // Only color palette
 * <ThemePreview showComponents={false} showTypography={false} />
 * ```
 */
export const ThemePreview: React.FC<ThemePreviewProps> = ({
  showColorPalette = true,
  showComponents = true,
  showTypography = true,
  className = "",
}) => {
  const { theme } = useThemeStore();
  const [inputValue, setInputValue] = useState("");
  const [selectValue, setSelectValue] = useState("");
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  return (
    <div
      className={[
        "space-y-8",
        "p-6",
        "bg-white",
        "rounded-lg",
        "border",
        "border-neutral-200",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-neutral-900">Theme Preview</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">Current:</span>
          <span className="text-sm font-medium text-neutral-800">
            {theme.name}
          </span>
          <span
            className={[
              "px-2",
              "py-0.5",
              "text-xs",
              "font-medium",
              "rounded-full",
              theme.mode === "dark"
                ? "bg-neutral-800 text-neutral-200"
                : "bg-neutral-100 text-neutral-700",
            ].join(" ")}
          >
            {theme.mode}
          </span>
        </div>
      </div>

      {/* Color Palette Section */}
      {showColorPalette && (
        <PreviewSection title="Color Palette">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorSwatch name="Primary" shades={theme.colors.primary} />
            <ColorSwatch name="Neutral" shades={theme.colors.neutral} />
            <ColorSwatch name="Success" shades={theme.colors.success as Record<number, string>} />
            <ColorSwatch name="Warning" shades={theme.colors.warning as Record<number, string>} />
            <ColorSwatch name="Error" shades={theme.colors.error as Record<number, string>} />
            <ColorSwatch name="Info" shades={theme.colors.info as Record<number, string>} />
          </div>
        </PreviewSection>
      )}

      {/* Typography Section */}
      {showTypography && (
        <PreviewSection title="Typography">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">Sans-serif Font</p>
              <p
                className="text-lg text-neutral-800"
                style={{ fontFamily: theme.typography.fontFamily.sans }}
              >
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">Monospace Font</p>
              <p
                className="text-lg text-neutral-800"
                style={{ fontFamily: theme.typography.fontFamily.mono }}
              >
                const greeting = "Hello, World!";
              </p>
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              {(Object.keys(theme.typography.fontSize) as Array<keyof typeof theme.typography.fontSize>).map(
                (size) => (
                  <div key={size} className="text-center">
                    <span
                      className="text-neutral-800 block"
                      style={{ fontSize: theme.typography.fontSize[size] }}
                    >
                      Aa
                    </span>
                    <span className="text-xs text-neutral-500">{size}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </PreviewSection>
      )}

      {/* Components Section */}
      {showComponents && (
        <>
          {/* Buttons */}
          <PreviewSection title="Buttons">
            <div className="space-y-4">
              {/* Variants */}
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Variants</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="success">Success</Button>
                </div>
              </div>

              {/* Sizes */}
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Sizes</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="xs">Extra Small</Button>
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                  <Button size="xl">Extra Large</Button>
                </div>
              </div>

              {/* States */}
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">States</p>
                <div className="flex flex-wrap gap-2">
                  <Button>Default</Button>
                  <Button loading>Loading</Button>
                  <Button disabled>Disabled</Button>
                  <Button pill>Pill Shape</Button>
                </div>
              </div>

              {/* With Icons */}
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">With Icons</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    leftIcon={
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    }
                  >
                    Add Item
                  </Button>
                  <Button
                    variant="outline"
                    rightIcon={
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    }
                  >
                    Continue
                  </Button>
                  <Button
                    variant="ghost"
                    iconOnly
                    aria-label="Settings"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          </PreviewSection>

          {/* Inputs */}
          <PreviewSection title="Inputs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Default Input"
                placeholder="Enter text..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <Input
                label="With Helper Text"
                placeholder="Enter email..."
                helperText="We'll never share your email."
              />
              <Input
                label="Error State"
                placeholder="Enter password..."
                error
                errorMessage="Password must be at least 8 characters."
              />
              <Input
                label="Disabled"
                placeholder="Can't edit this..."
                disabled
                value="Disabled value"
              />
              <Input
                label="With Left Icon"
                placeholder="Search..."
                leftElement={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                }
              />
              <Input
                variant="filled"
                label="Filled Variant"
                placeholder="Filled style input..."
              />
            </div>
          </PreviewSection>

          {/* Selects */}
          <PreviewSection title="Selects">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Basic Select"
                placeholder="Choose an option..."
                options={[
                  { value: "option1", label: "Option 1" },
                  { value: "option2", label: "Option 2" },
                  { value: "option3", label: "Option 3" },
                ]}
                value={selectValue}
                onChange={(e) => setSelectValue(e.target.value)}
              />
              <Select
                label="With Helper Text"
                placeholder="Select country..."
                helperText="Choose your home country."
                options={[
                  { value: "us", label: "United States" },
                  { value: "uk", label: "United Kingdom" },
                  { value: "ca", label: "Canada" },
                ]}
              />
              <Select
                label="Error State"
                placeholder="Required field"
                error
                errorMessage="Please select an option."
                options={[
                  { value: "a", label: "Choice A" },
                  { value: "b", label: "Choice B" },
                ]}
              />
              <Select
                label="Disabled"
                placeholder="Cannot change"
                disabled
                options={[
                  { value: "locked", label: "Locked Option" },
                ]}
              />
            </div>
          </PreviewSection>

          {/* Checkboxes */}
          <PreviewSection title="Checkboxes">
            <div className="space-y-3">
              <Checkbox
                label="Default checkbox"
                checked={checkboxChecked}
                onChange={(e) => setCheckboxChecked(e.target.checked)}
              />
              <Checkbox
                label="With description"
                description="This is a helpful description for the checkbox."
              />
              <Checkbox
                label="Checked by default"
                defaultChecked
              />
              <Checkbox
                label="Error state"
                error
                errorMessage="You must accept the terms."
              />
              <Checkbox
                label="Disabled"
                disabled
              />
              <Checkbox
                label="Disabled checked"
                disabled
                checked
              />
              <Checkbox
                label="Indeterminate"
                indeterminate
              />
              <div className="flex gap-4">
                <Checkbox label="Small" size="sm" />
                <Checkbox label="Medium" size="md" />
                <Checkbox label="Large" size="lg" />
              </div>
              <div className="flex gap-4">
                <Checkbox label="Primary" colorScheme="primary" defaultChecked />
                <Checkbox label="Success" colorScheme="success" defaultChecked />
                <Checkbox label="Warning" colorScheme="warning" defaultChecked />
                <Checkbox label="Error" colorScheme="error" defaultChecked />
              </div>
            </div>
          </PreviewSection>

          {/* Panels */}
          <PreviewSection title="Panels">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel variant="default" padding="md">
                <PanelHeader title="Default Panel" subtitle="With header components" />
                <PanelBody>
                  <p className="text-sm text-neutral-600">
                    This is the panel content area. It can contain any React components.
                  </p>
                </PanelBody>
              </Panel>

              <Panel variant="elevated" padding="md">
                <PanelHeader title="Elevated Panel" />
                <PanelBody>
                  <p className="text-sm text-neutral-600">
                    This panel has a shadow for depth.
                  </p>
                </PanelBody>
              </Panel>

              <Panel variant="filled" padding="md">
                <PanelHeader title="Filled Panel" />
                <PanelBody>
                  <p className="text-sm text-neutral-600">
                    This panel has a filled background.
                  </p>
                </PanelBody>
              </Panel>

              <Panel
                variant="default"
                padding="md"
                collapsible
                header="Collapsible Panel"
                defaultCollapsed={false}
              >
                <p className="text-sm text-neutral-600">
                  Click the header to collapse this panel.
                </p>
              </Panel>
            </div>

            <Panel variant="default" padding="md">
              <PanelHeader
                title="Panel with Actions"
                subtitle="Includes footer with buttons"
                actions={
                  <Button variant="ghost" size="sm">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                  </Button>
                }
              />
              <PanelBody>
                <p className="text-sm text-neutral-600">
                  This panel demonstrates the full structure with header, body, and footer.
                </p>
              </PanelBody>
              <PanelFooter>
                <Button variant="secondary" size="sm">Cancel</Button>
                <Button variant="primary" size="sm">Save Changes</Button>
              </PanelFooter>
            </Panel>
          </PreviewSection>
        </>
      )}
    </div>
  );
};

ThemePreview.displayName = "ThemePreview";

export default ThemePreview;
