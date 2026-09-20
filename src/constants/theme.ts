/**
 * ZeroDaily Editorial Design System & Adaptive Color Architecture
 * Dual-palette: Deep Obsidian OLED Dark Mode & Crisp Editorial Light Mode.
 */

export interface ThemeColors {
  // Backgrounds & Canvas
  background: string;
  surface: string;
  surfaceHover: string;
  card: string;
  cardBorder: string;
  cardElevated: string;

  // Text Hierarchy
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textHighlight: string;

  // Accents & Signals
  primary: string;
  primaryGlow: string;
  primarySoft: string;
  danger: string;
  warning: string;
  warningSoft: string;
  info: string;

  // Category Taxonomy Accents
  all: string;
  cybersec: string;
  ai: string;
  programming: string;
  robotics: string;
  defense_aerospace: string;
  hardware: string;
  finance: string;

  // Overlays, Scrims & Borders
  border: string;
  borderLight: string;
  borderSubtle: string;
  overlay: string;
  shimmer: string;
  scrimStart: string;
  scrimMid: string;
  scrimEnd: string;
  statusBarStyle: 'light' | 'dark';
}

const SHARED_DESIGN = {
  typography: {
    headingFont: 'System',
    bodyFont: 'System',
    monoFont: 'Courier',
    sizes: {
      xs: 11,
      sm: 13,
      base: 15,
      lg: 18,
      xl: 21,
      xxl: 25,
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
    xs: 4,
    sm: 8,
    md: 12,
    lg: 18,
    full: 9999,
  },
} as const;

export const DARK_THEME_COLORS: ThemeColors = {
  background: '#090A0F',
  surface: '#121520',
  surfaceHover: '#1B2030',
  card: '#11141F',
  cardBorder: '#1E2538',
  cardElevated: '#171B2B',

  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textHighlight: '#38BDF8',

  primary: '#10B981',
  primaryGlow: 'rgba(16, 185, 129, 0.25)',
  primarySoft: 'rgba(16, 185, 129, 0.12)',
  danger: '#EF4444',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.12)',
  info: '#3B82F6',

  all: '#10B981',
  cybersec: '#EF4444',
  ai: '#A855F7',
  programming: '#10B981',
  robotics: '#F59E0B',
  defense_aerospace: '#06B6D4',
  hardware: '#F97316',
  finance: '#14B8A6',

  border: '#1E2538',
  borderLight: '#2B354F',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.78)',
  shimmer: '#1E2538',
  scrimStart: 'transparent',
  scrimMid: 'rgba(17, 20, 31, 0.65)',
  scrimEnd: '#11141F',
  statusBarStyle: 'light',
};

export const LIGHT_THEME_COLORS: ThemeColors = {
  background: '#F1F3F6',
  surface: '#FFFFFF',
  surfaceHover: '#F8FAFC',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  cardElevated: '#F8FAFC',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#8592A6',
  textHighlight: '#0284C7',

  primary: '#059669',
  primaryGlow: 'rgba(5, 150, 105, 0.18)',
  primarySoft: 'rgba(5, 150, 105, 0.10)',
  danger: '#DC2626',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.10)',
  info: '#2563EB',

  all: '#059669',
  cybersec: '#DC2626',
  ai: '#9333EA',
  programming: '#059669',
  robotics: '#D97706',
  defense_aerospace: '#0891B2',
  hardware: '#EA580C',
  finance: '#0D9488',

  border: '#E2E8F0',
  borderLight: '#CBD5E1',
  borderSubtle: 'rgba(0, 0, 0, 0.06)',
  overlay: 'rgba(15, 23, 42, 0.5)',
  shimmer: '#E2E8F0',
  scrimStart: 'transparent',
  scrimMid: 'rgba(255, 255, 255, 0.7)',
  scrimEnd: '#FFFFFF',
  statusBarStyle: 'dark',
};

export interface AppTheme {
  isDark: boolean;
  colors: ThemeColors;
  typography: typeof SHARED_DESIGN.typography;
  spacing: typeof SHARED_DESIGN.spacing;
  radii: typeof SHARED_DESIGN.radii;
}

export const DARK_THEME: AppTheme = {
  isDark: true,
  colors: DARK_THEME_COLORS,
  ...SHARED_DESIGN,
};

export const LIGHT_THEME: AppTheme = {
  isDark: false,
  colors: LIGHT_THEME_COLORS,
  ...SHARED_DESIGN,
};

/** Default backwards-compatible export (defaults to Dark) */
export const THEME = DARK_THEME;
