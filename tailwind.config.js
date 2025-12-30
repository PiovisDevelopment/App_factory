/**
 * D007 - tailwind.config.js
 * =========================
 * Tailwind CSS configuration extending design tokens (D006).
 * 
 * Architecture: Maps CSS custom properties to Tailwind utilities
 * Usage: All components use Tailwind classes referencing these tokens
 * 
 * Rules:
 *   - NO arbitrary values in components (use defined tokens)
 *   - Extend, don't replace default theme
 *   - Semantic naming matches design_tokens.css
 */

/** @type {import('tailwindcss').Config} */
export default {
  // Scan these paths for class usage
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  
  // Enable dark mode via data attribute (matches D006 dark theme)
  darkMode: ["selector", "[data-theme='dark']"],
  
  theme: {
    extend: {
      // ============================================
      // COLORS
      // Reference CSS variables from design_tokens.css
      // ============================================
      colors: {
        // Brand/Primary colors
        primary: {
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          200: "var(--color-primary-200)",
          300: "var(--color-primary-300)",
          400: "var(--color-primary-400)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          800: "var(--color-primary-800)",
          900: "var(--color-primary-900)",
          950: "var(--color-primary-950)",
        },
        
        // Neutral/Gray colors
        neutral: {
          50: "var(--color-neutral-50)",
          100: "var(--color-neutral-100)",
          200: "var(--color-neutral-200)",
          300: "var(--color-neutral-300)",
          400: "var(--color-neutral-400)",
          500: "var(--color-neutral-500)",
          600: "var(--color-neutral-600)",
          700: "var(--color-neutral-700)",
          800: "var(--color-neutral-800)",
          900: "var(--color-neutral-900)",
          950: "var(--color-neutral-950)",
        },
        
        // Semantic status colors
        success: {
          50: "var(--color-success-50)",
          500: "var(--color-success-500)",
          600: "var(--color-success-600)",
          700: "var(--color-success-700)",
        },
        warning: {
          50: "var(--color-warning-50)",
          500: "var(--color-warning-500)",
          600: "var(--color-warning-600)",
          700: "var(--color-warning-700)",
        },
        error: {
          50: "var(--color-error-50)",
          500: "var(--color-error-500)",
          600: "var(--color-error-600)",
          700: "var(--color-error-700)",
        },
        info: {
          50: "var(--color-info-50)",
          500: "var(--color-info-500)",
          600: "var(--color-info-600)",
          700: "var(--color-info-700)",
        },
        
        // Semantic aliases for common use cases
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
          inverse: "var(--bg-inverse)",
          brand: "var(--bg-brand)",
          "brand-hover": "var(--bg-brand-hover)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          inverse: "var(--text-inverse)",
          brand: "var(--text-brand)",
          link: "var(--text-link)",
          "link-hover": "var(--text-link-hover)",
        },
        border: {
          primary: "var(--border-primary)",
          secondary: "var(--border-secondary)",
          focus: "var(--border-focus)",
          error: "var(--border-error)",
          success: "var(--border-success)",
        },
      },
      
      // ============================================
      // SPACING
      // Matches design_tokens.css spacing scale
      // ============================================
      spacing: {
        "0": "var(--space-0)",
        "px": "var(--space-px)",
        "0.5": "var(--space-0-5)",
        "1": "var(--space-1)",
        "1.5": "var(--space-1-5)",
        "2": "var(--space-2)",
        "2.5": "var(--space-2-5)",
        "3": "var(--space-3)",
        "3.5": "var(--space-3-5)",
        "4": "var(--space-4)",
        "5": "var(--space-5)",
        "6": "var(--space-6)",
        "7": "var(--space-7)",
        "8": "var(--space-8)",
        "9": "var(--space-9)",
        "10": "var(--space-10)",
        "11": "var(--space-11)",
        "12": "var(--space-12)",
        "14": "var(--space-14)",
        "16": "var(--space-16)",
        "20": "var(--space-20)",
        "24": "var(--space-24)",
        "28": "var(--space-28)",
        "32": "var(--space-32)",
      },
      
      // ============================================
      // TYPOGRAPHY
      // ============================================
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "var(--leading-normal)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--leading-normal)" }],
        base: ["var(--text-base)", { lineHeight: "var(--leading-normal)" }],
        lg: ["var(--text-lg)", { lineHeight: "var(--leading-normal)" }],
        xl: ["var(--text-xl)", { lineHeight: "var(--leading-tight)" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-tight)" }],
        "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-tight)" }],
        "4xl": ["var(--text-4xl)", { lineHeight: "var(--leading-none)" }],
      },
      fontWeight: {
        thin: "var(--font-thin)",
        light: "var(--font-light)",
        normal: "var(--font-normal)",
        medium: "var(--font-medium)",
        semibold: "var(--font-semibold)",
        bold: "var(--font-bold)",
        extrabold: "var(--font-extrabold)",
      },
      letterSpacing: {
        tighter: "var(--tracking-tighter)",
        tight: "var(--tracking-tight)",
        normal: "var(--tracking-normal)",
        wide: "var(--tracking-wide)",
        wider: "var(--tracking-wider)",
      },
      lineHeight: {
        none: "var(--leading-none)",
        tight: "var(--leading-tight)",
        snug: "var(--leading-snug)",
        normal: "var(--leading-normal)",
        relaxed: "var(--leading-relaxed)",
        loose: "var(--leading-loose)",
      },
      
      // ============================================
      // BORDER RADIUS
      // ============================================
      borderRadius: {
        none: "var(--radius-none)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        full: "var(--radius-full)",
      },
      
      // ============================================
      // BOX SHADOW
      // ============================================
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        inner: "var(--shadow-inner)",
        none: "var(--shadow-none)",
        focus: "var(--shadow-focus)",
        "focus-error": "var(--shadow-focus-error)",
      },
      
      // ============================================
      // TRANSITIONS
      // ============================================
      transitionDuration: {
        75: "var(--duration-75)",
        100: "var(--duration-100)",
        150: "var(--duration-150)",
        200: "var(--duration-200)",
        300: "var(--duration-300)",
        500: "var(--duration-500)",
        700: "var(--duration-700)",
        1000: "var(--duration-1000)",
      },
      transitionTimingFunction: {
        linear: "var(--ease-linear)",
        in: "var(--ease-in)",
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },
      
      // ============================================
      // Z-INDEX
      // ============================================
      zIndex: {
        0: "var(--z-0)",
        10: "var(--z-10)",
        20: "var(--z-20)",
        30: "var(--z-30)",
        40: "var(--z-40)",
        50: "var(--z-50)",
        dropdown: "var(--z-dropdown)",
        sticky: "var(--z-sticky)",
        modal: "var(--z-modal)",
        popover: "var(--z-popover)",
        tooltip: "var(--z-tooltip)",
        toast: "var(--z-toast)",
      },
      
      // ============================================
      // ANIMATIONS
      // ============================================
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-in-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-down": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "fade-in": "fade-in var(--duration-200) var(--ease-out)",
        "fade-out": "fade-out var(--duration-150) var(--ease-in)",
        "slide-in-up": "slide-in-up var(--duration-200) var(--ease-out)",
        "slide-in-down": "slide-in-down var(--duration-200) var(--ease-out)",
        "spin": "spin 1s linear infinite",
        "pulse": "pulse 2s var(--ease-in-out) infinite",
      },
    },
  },
  
  plugins: [],
};
