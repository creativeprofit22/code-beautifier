/**
 * Shared Theme Constants
 * Centralized color and style definitions for consistent theming
 */

export const THEME = {
  colors: {
    accent: {
      violet: "#8b5cf6", // violet-500
      indigo: "#6366f1", // indigo-500
    },
  },
} as const;

// Convenience export for the primary accent color
export const ACCENT_COLOR = THEME.colors.accent.violet;
