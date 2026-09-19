import * as WebBrowser from 'expo-web-browser';
import { useThemeStore } from '../../store/themeStore';

/**
 * Opens an external source article URL using native in-app browser
 * (Chrome Custom Tabs on Android, SFSafariViewController on iOS).
 */
export async function openArticleSource(url: string): Promise<void> {
  if (!url) return;

  try {
    const { colors } = useThemeStore.getState().theme;
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: colors.background,
      controlsColor: colors.primary,
      showTitle: true,
      enableBarCollapsing: true,
      secondaryToolbarColor: colors.surface,
    });
  } catch (error) {
    console.warn('[ZeroDaily Reader] Failed to open in-app browser:', error);
  }
}
