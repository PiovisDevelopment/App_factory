/**
 * src/components/ui/index.ts
 * ==========================
 * Barrel export for all atomic UI components (D010-D019).
 *
 * Usage:
 *   import { Button, Input, Select, Checkbox, Modal, Panel } from "@/components/ui";
 *   import { ThemeCustomizationPanel, ThemePreview, WindowConfigPanel } from "@/components/ui";
 */

// D010 - Button
export { Button, default as ButtonComponent } from "./Button";
export type { ButtonProps } from "./Button";

// D011 - Input
export { Input, default as InputComponent } from "./Input";
export type { InputProps } from "./Input";

// D012 - Select
export { Select, default as SelectComponent } from "./Select";
export type { SelectProps, SelectOption, SelectOptionGroup } from "./Select";

// D013 - Checkbox
export { Checkbox, default as CheckboxComponent } from "./Checkbox";
export type { CheckboxProps } from "./Checkbox";

// D014 - Modal
export { Modal, default as ModalComponent } from "./Modal";
export type { ModalProps } from "./Modal";

// D015 - Panel
export { Panel, PanelHeader, PanelBody, PanelFooter, default as PanelComponent } from "./Panel";
export type { PanelProps, PanelHeaderProps, PanelBodyProps, PanelFooterProps } from "./Panel";

// D017 - ThemeCustomizationPanel
export { ThemeCustomizationPanel, default as ThemeCustomizationPanelComponent } from "./ThemeCustomizationPanel";
export type { ThemeCustomizationPanelProps } from "./ThemeCustomizationPanel";

// D018 - ThemePreview
export { ThemePreview, default as ThemePreviewComponent } from "./ThemePreview";
export type { ThemePreviewProps } from "./ThemePreview";

// D019 - WindowConfigPanel
export { WindowConfigPanel, useWindowConfigStore, default as WindowConfigPanelComponent } from "./WindowConfigPanel";
export type { WindowConfigPanelProps, WindowConfig } from "./WindowConfigPanel";

// Tabs (UJ-1.1.3)
export { Tabs, default as TabsComponent } from "./Tabs";
export type { TabsProps, TabItem } from "./Tabs";
