import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';
import { AppTheme, DARK_THEME, LIGHT_THEME } from '../constants/theme';

export type ThemeMode = 'dark' | 'light' | 'system';

const THEME_STORAGE_KEY = '@zerodaily_theme_mode_v1';

interface ThemeState {
  themeMode: ThemeMode;
  isDark: boolean;
  theme: AppTheme;
  isInitialized: boolean;

  // Actions
  initTheme: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  // 'system'
  const sys = Appearance.getColorScheme();
  return sys !== 'light'; // Default to dark if system is null or dark
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'dark',
  isDark: true,
  theme: DARK_THEME,
  isInitialized: false,

  initTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        const isDark = resolveIsDark(stored);
        set({
          themeMode: stored,
          isDark,
          theme: isDark ? DARK_THEME : LIGHT_THEME,
          isInitialized: true,
        });
        return;
      }
    } catch {
      // Ignore storage read error
    }

    set({
      themeMode: 'dark',
      isDark: true,
      theme: DARK_THEME,
      isInitialized: true,
    });
  },

  setThemeMode: async (mode: ThemeMode) => {
    const isDark = resolveIsDark(mode);
    set({
      themeMode: mode,
      isDark,
      theme: isDark ? DARK_THEME : LIGHT_THEME,
    });
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore write errors
    }
  },

  toggleTheme: async () => {
    const { isDark } = get();
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    await get().setThemeMode(nextMode);
  },
}));

/** Convenient hook to access active theme and actions */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const isDark = useThemeStore((s) => s.isDark);
  const themeMode = useThemeStore((s) => s.themeMode);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return {
    theme,
    colors: theme.colors,
    typography: theme.typography,
    spacing: theme.spacing,
    radii: theme.radii,
    isDark,
    themeMode,
    setThemeMode,
    toggleTheme,
  };
}
