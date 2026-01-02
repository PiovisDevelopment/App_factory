/**
 * D016 - src/context/ThemeProvider.tsx
 * =====================================
 * Theme context provider managing theme state with Zustand.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010-D015 (atomic components)
 *
 * Features:
 *   - Centralized theme state management via Zustand
 *   - CSS custom properties injection for real-time theme updates
 *   - Persistence to localStorage
 *   - Light/Dark mode support
 *   - Custom color palette support
 */

import React, {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ============================================
// Theme Types
// ============================================

/**
 * Color scale type (50-950 shades).
 */
export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

/**
 * Semantic color definitions.
 */
export interface SemanticColors {
  primary: ColorScale;
  neutral: ColorScale;
  success: Partial<ColorScale>;
  warning: Partial<ColorScale>;
  error: Partial<ColorScale>;
  info: Partial<ColorScale>;
}

/**
 * Typography settings.
 */
export interface TypographySettings {
  fontFamily: {
    sans: string;
    mono: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
  };
}

/**
 * Spacing scale.
 */
export interface SpacingScale {
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
  8: string;
  10: string;
  12: string;
  16: string;
  20: string;
  24: string;
}

/**
 * Border radius presets.
 */
export interface RadiusScale {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
  full: string;
}

/**
 * Shadow presets.
 */
export interface ShadowScale {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
}

/**
 * Complete theme configuration.
 */
export interface ThemeConfig {
  name: string;
  mode: "light" | "dark";
  colors: SemanticColors;
  typography: TypographySettings;
  spacing: SpacingScale;
  radius: RadiusScale;
  shadows: ShadowScale;
}

/**
 * Theme store state.
 */
/**
 * Custom font entry for Google Fonts integration.
 */
export interface CustomFont {
  name: string;
  family: string;
  url: string;
  loaded: boolean;
}

export interface ThemeState {
  // Current theme configuration
  theme: ThemeConfig;
  // List of saved theme presets
  savedThemes: ThemeConfig[];
  // Whether the theme panel is open
  isPanelOpen: boolean;
  // Custom fonts loaded from Google Fonts
  customFonts: CustomFont[];

  // Actions
  setMode: (mode: "light" | "dark") => void;
  toggleMode: () => void;
  setColor: (
    category: keyof SemanticColors,
    shade: keyof ColorScale,
    value: string
  ) => void;
  setTypography: (key: keyof TypographySettings, value: unknown) => void;
  setRadius: (key: keyof RadiusScale, value: string) => void;
  setShadow: (key: keyof ShadowScale, value: string) => void;
  saveTheme: (name: string) => void;
  loadTheme: (name: string) => void;
  deleteTheme: (name: string) => void;
  updateTheme: (name: string, updatedTheme: ThemeConfig) => void;
  resetToDefault: () => void;
  setTheme: (theme: Partial<ThemeConfig>) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  addCustomFont: (font: CustomFont) => void;
  removeCustomFont: (fontName: string) => void;
}

// ============================================
// Default Theme
// ============================================

/**
 * Default light theme configuration.
 */
export const defaultLightTheme: ThemeConfig = {
  name: "Default",
  mode: "light",
  colors: {
    primary: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
      950: "#172554",
    },
    neutral: {
      50: "#fafafa",
      100: "#f4f4f5",
      200: "#e4e4e7",
      300: "#d4d4d8",
      400: "#a1a1aa",
      500: "#71717a",
      600: "#52525b",
      700: "#3f3f46",
      800: "#27272a",
      900: "#18181b",
      950: "#09090b",
    },
    success: {
      50: "#f0fdf4",
      500: "#22c55e",
      600: "#16a34a",
      700: "#15803d",
    },
    warning: {
      50: "#fffbeb",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
    },
    error: {
      50: "#fef2f2",
      500: "#ef4444",
      600: "#dc2626",
      700: "#b91c1c",
    },
    info: {
      50: "#eff6ff",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
    },
  },
  typography: {
    fontFamily: {
      sans: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      mono: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
    },
  },
  spacing: {
    0: "0",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
    20: "5rem",
    24: "6rem",
  },
  radius: {
    none: "0",
    sm: "0.125rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    full: "9999px",
  },
  shadows: {
    none: "none",
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  },
};

/**
 * Default dark theme configuration.
 */
export const defaultDarkTheme: ThemeConfig = {
  ...defaultLightTheme,
  name: "Default Dark",
  mode: "dark",
  colors: {
    ...defaultLightTheme.colors,
    neutral: {
      50: "#09090b",
      100: "#18181b",
      200: "#27272a",
      300: "#3f3f46",
      400: "#52525b",
      500: "#71717a",
      600: "#a1a1aa",
      700: "#d4d4d8",
      800: "#e4e4e7",
      900: "#f4f4f5",
      950: "#fafafa",
    },
  },
};

// ============================================
// Zustand Store
// ============================================

/**
 * Theme store with persistence.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: defaultLightTheme,
      savedThemes: [defaultLightTheme, defaultDarkTheme],
      isPanelOpen: false,
      customFonts: [],

      setMode: (mode) =>
        set((state) => ({
          theme: {
            ...state.theme,
            mode,
            colors:
              mode === "dark"
                ? defaultDarkTheme.colors
                : defaultLightTheme.colors,
          },
        })),

      toggleMode: () =>
        set((state) => {
          const newMode = state.theme.mode === "light" ? "dark" : "light";
          return {
            theme: {
              ...state.theme,
              mode: newMode,
              colors:
                newMode === "dark"
                  ? defaultDarkTheme.colors
                  : defaultLightTheme.colors,
            },
          };
        }),

      setColor: (category, shade, value) =>
        set((state) => ({
          theme: {
            ...state.theme,
            colors: {
              ...state.theme.colors,
              [category]: {
                ...state.theme.colors[category],
                [shade]: value,
              },
            },
          },
        })),

      setTypography: (key, value) =>
        set((state) => ({
          theme: {
            ...state.theme,
            typography: {
              ...state.theme.typography,
              [key]: value,
            },
          },
        })),

      setRadius: (key, value) =>
        set((state) => ({
          theme: {
            ...state.theme,
            radius: {
              ...state.theme.radius,
              [key]: value,
            },
          },
        })),

      setShadow: (key, value) =>
        set((state) => ({
          theme: {
            ...state.theme,
            shadows: {
              ...state.theme.shadows,
              [key]: value,
            },
          },
        })),

      saveTheme: (name) =>
        set((state) => {
          const newTheme = { ...state.theme, name };
          const existingIndex = state.savedThemes.findIndex(
            (t) => t.name === name
          );
          const updatedThemes =
            existingIndex >= 0
              ? state.savedThemes.map((t, i) =>
                i === existingIndex ? newTheme : t
              )
              : [...state.savedThemes, newTheme];
          return {
            theme: newTheme,
            savedThemes: updatedThemes,
          };
        }),

      loadTheme: (name) =>
        set((state) => {
          const theme = state.savedThemes.find((t) => t.name === name);
          if (theme) {
            return { theme };
          }
          return {};
        }),

      deleteTheme: (name) =>
        set((state) => ({
          savedThemes: state.savedThemes.filter((t) => t.name !== name),
        })),

      updateTheme: (name, updatedTheme) =>
        set((state) => {
          const existingIndex = state.savedThemes.findIndex(
            (t) => t.name === name
          );
          if (existingIndex >= 0) {
            const updatedThemes = state.savedThemes.map((t, i) =>
              i === existingIndex ? updatedTheme : t
            );
            return {
              savedThemes: updatedThemes,
              // If the updated theme is the current theme, update it too
              theme: state.theme.name === name ? updatedTheme : state.theme,
            };
          }
          return {};
        }),

      resetToDefault: () =>
        set((state) => ({
          theme:
            state.theme.mode === "dark" ? defaultDarkTheme : defaultLightTheme,
        })),

      setTheme: (partialTheme) =>
        set((state) => ({
          theme: {
            ...state.theme,
            ...partialTheme,
          },
        })),

      setPanelOpen: (open) => set({ isPanelOpen: open }),

      togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),

      addCustomFont: (font) =>
        set((state) => ({
          customFonts: [...state.customFonts.filter(f => f.name !== font.name), font],
        })),

      removeCustomFont: (fontName) =>
        set((state) => ({
          customFonts: state.customFonts.filter((f) => f.name !== fontName),
        })),
    }),
    {
      name: "app-factory-theme",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        savedThemes: state.savedThemes,
        customFonts: state.customFonts,
      }),
    }
  )
);

// ============================================
// CSS Variable Injection
// ============================================

/**
 * Injects theme values as CSS custom properties on the document root.
 */
function injectThemeVariables(theme: ThemeConfig): void {
  const root = document.documentElement;

  // Inject colors
  Object.entries(theme.colors).forEach(([category, scale]) => {
    Object.entries(scale).forEach(([shade, value]) => {
      root.style.setProperty(`--color-${category}-${shade}`, value as string);
    });
  });

  // Inject typography
  root.style.setProperty(
    "--font-family-sans",
    theme.typography.fontFamily.sans
  );
  root.style.setProperty(
    "--font-family-mono",
    theme.typography.fontFamily.mono
  );

  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    root.style.setProperty(`--font-size-${key}`, value);
  });

  // Inject spacing
  Object.entries(theme.spacing).forEach(([key, value]) => {
    root.style.setProperty(`--spacing-${key}`, value);
  });

  // Inject radius
  Object.entries(theme.radius).forEach(([key, value]) => {
    root.style.setProperty(`--radius-${key}`, value);
  });

  // Inject shadows
  Object.entries(theme.shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value);
  });

  // Set color scheme for native elements
  root.style.setProperty("color-scheme", theme.mode);

  // Add/remove dark mode class
  if (theme.mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/**
 * Generate CSS custom property styles for a theme.
 * Use this to apply a theme to a specific container element (for scoped theming).
 *
 * @param theme - The theme configuration to generate styles for
 * @returns An object with CSS custom properties as style object
 */
export function generateThemeStyles(theme: ThemeConfig): React.CSSProperties {
  const styles: Record<string, string> = {};

  // Inject colors
  Object.entries(theme.colors).forEach(([category, scale]) => {
    Object.entries(scale).forEach(([shade, value]) => {
      styles[`--color-${category}-${shade}`] = value as string;
    });
  });

  // Inject typography
  styles["--font-family-sans"] = theme.typography.fontFamily.sans;
  styles["--font-family-mono"] = theme.typography.fontFamily.mono;

  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    styles[`--font-size-${key}`] = value;
  });

  // Inject spacing
  Object.entries(theme.spacing).forEach(([key, value]) => {
    styles[`--spacing-${key}`] = value;
  });

  // Inject radius
  Object.entries(theme.radius).forEach(([key, value]) => {
    styles[`--radius-${key}`] = value;
  });

  // Inject shadows
  Object.entries(theme.shadows).forEach(([key, value]) => {
    styles[`--shadow-${key}`] = value;
  });

  // Set color scheme for native elements
  styles["colorScheme"] = theme.mode;

  return styles as React.CSSProperties;
}

// ============================================
// Theme Context
// ============================================

/**
 * Theme context for components that need theme access outside React tree.
 */
const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Hook to access theme context.
 */
export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fall back to Zustand store if not in provider
    return useThemeStore.getState();
  }
  return context;
}

// ============================================
// Theme Provider Component
// ============================================

export interface ThemeProviderProps {
  /** Child components */
  children: ReactNode;
  /** Initial theme to use (overrides stored theme) */
  initialTheme?: Partial<ThemeConfig>;
  /** Whether to sync with system color scheme preference */
  syncWithSystem?: boolean;
}

/**
 * ThemeProvider component.
 *
 * Provides theme context and injects CSS custom properties for real-time
 * theme updates. Wraps the application to enable theme functionality.
 *
 * @example
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 *
 * // With system sync
 * <ThemeProvider syncWithSystem>
 *   <App />
 * </ThemeProvider>
 *
 * // With initial theme override
 * <ThemeProvider initialTheme={{ mode: "dark" }}>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme,
  syncWithSystem = false,
}) => {
  const store = useThemeStore();

  // Apply initial theme on mount if provided
  useEffect(() => {
    if (initialTheme) {
      store.setTheme(initialTheme);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync with system preference if enabled
  useEffect(() => {
    if (!syncWithSystem) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      store.setMode(e.matches ? "dark" : "light");
    };

    // Set initial mode based on system preference
    store.setMode(mediaQuery.matches ? "dark" : "light");

    // Listen for changes
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [syncWithSystem]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inject CSS variables whenever theme changes
  useEffect(() => {
    injectThemeVariables(store.theme);
  }, [store.theme]);

  // Subscribe to store changes and update CSS variables
  useEffect(() => {
    const unsubscribe = useThemeStore.subscribe((state) => {
      injectThemeVariables(state.theme);
    });

    return unsubscribe;
  }, []);

  return (
    <ThemeContext.Provider value={store}>
      {children}
    </ThemeContext.Provider>
  );
};

ThemeProvider.displayName = "ThemeProvider";

export default ThemeProvider;
