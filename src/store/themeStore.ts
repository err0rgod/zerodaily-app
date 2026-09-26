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

/**
 * Resolves a mode to a concrete light/dark decision.
 *
 * `Appearance.getColorScheme()` only ever reports the real OS scheme when
 * app.json declares `userInterfaceStyle: "automatic"` — with "dark" the
 * native layer pins the app to dark and this can never return light.
 * A null scheme (web, some Android builds) falls back to dark.
 */
function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return Appearance.getColorScheme() === 'light' ? false : true;
}

/**
 * Seeded synchronously from the OS so the very first painted frame is already
 * on the correct side. `initTheme` then applies the stored preference once
 * AsyncStorage resolves.
 */
const BOOT_MODE: ThemeMode = 'system';
const BOOT_IS_DARK = resolveIsDark(BOOT_MODE);

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: BOOT_MODE,
  isDark: BOOT_IS_DARK,
  theme: BOOT_IS_DARK ? DARK_THEME : LIGHT_THEME,
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

    set({ isInitialized: true });
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

// Follow live OS appearance changes, but only while the user is on 'system'.
Appearance.addChangeListener(({ colorScheme }) => {
  const { themeMode, isDark } = useThemeStore.getState();
  if (themeMode !== 'system') return;
  const nextIsDark = colorScheme === 'light' ? false : true;
  if (nextIsDark === isDark) return;
  useThemeStore.setState({
    isDark: nextIsDark,
    theme: nextIsDark ? DARK_THEME : LIGHT_THEME,
  });
});

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
