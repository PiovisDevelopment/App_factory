/**
 * src/context/index.ts
 * =====================
 * Barrel export for context providers.
 *
 * Usage:
 *   import { ThemeProvider, useTheme, useThemeStore } from "@/context";
 */

// D016 - ThemeProvider
export {
  ThemeProvider,
  useTheme,
  useThemeStore,
  defaultLightTheme,
  defaultDarkTheme,
  default as ThemeProviderComponent,
} from "./ThemeProvider";

export type {
  ThemeProviderProps,
  ThemeConfig,
  ThemeState,
  ColorScale,
  SemanticColors,
  TypographySettings,
  SpacingScale,
  RadiusScale,
  ShadowScale,
} from "./ThemeProvider";
