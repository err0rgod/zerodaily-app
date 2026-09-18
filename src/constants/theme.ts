/**
 * ZeroDaily Design System & Color Theme
 * Dark-first cyber-hacker aesthetic optimized for OLED displays and long reading sessions.
 */

export const THEME = {
  colors: {
    // Backgrounds
    background: '#090D16',
    surface: '#111827',
    surfaceHover: '#1F2937',
    card: '#0F172A',
    cardBorder: '#1E293B',

    // Text hierarchy
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textHighlight: '#38BDF8',

    // Accents & Signals
    primary: '#10B981', // Emerald terminal accent
    primaryGlow: 'rgba(16, 185, 129, 0.25)',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',

    // Category Accent Colors
    cybersec: '#EF4444',       // Critical Red
    ai: '#A855F7',             // Deep Intelligence Violet
    programming: '#10B981',    // Terminal Emerald
    robotics: '#F59E0B',       // Industrial Amber
    defense_aerospace: '#06B6D4', // Aerospace Cyan
    hardware: '#F97316',       // Silicon Copper

    // Overlays & Borders
    border: '#1E293B',
    borderLight: '#334155',
    overlay: 'rgba(0, 0, 0, 0.75)',
    shimmer: '#1E293B',
  },

  typography: {
    headingFont: 'System',
    bodyFont: 'System',
    monoFont: 'Courier',
    sizes: {
      xs: 11,
      sm: 13,
      base: 15,
      lg: 18,
      xl: 22,
      xxl: 26,
      display: 32,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  radii: {
    sm: 6,
    md: 12,
    lg: 18,
    full: 9999,
  },
} as const;

export type ThemeColors = typeof THEME.colors;
