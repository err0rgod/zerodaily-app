import * as WebBrowser from 'expo-web-browser';
import { THEME } from '../../constants/theme';

/**
 * Opens an external source article URL using native in-app browser
 * (Chrome Custom Tabs on Android, SFSafariViewController on iOS).
 */
export async function openArticleSource(url: string): Promise<void> {
  if (!url) return;

  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: THEME.colors.background,
      controlsColor: THEME.colors.primary,
      showTitle: true,
      enableBarCollapsing: true,
      secondaryToolbarColor: THEME.colors.surface,
    });
  } catch (error) {
    console.warn('[ZeroDaily Reader] Failed to open in-app browser:', error);
  }
}
