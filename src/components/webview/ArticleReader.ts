import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { useThemeStore } from '../../store/themeStore';

/**
 * Normalizes and sanitizes external article links.
 * Fixes protocol, trims accidental whitespace/newlines,
 * and forces HTTPS for publishers that block or fail on HTTP cleartext (e.g. Economic Times).
 */
export function sanitizeArticleUrl(rawUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let url = rawUrl.trim();
  if (!url) return null;

  // Ensure scheme is present
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // Force HTTPS for known domains like Economic Times to prevent Android cleartext blocks
  if (url.startsWith('http://') && (url.includes('economictimes') || url.includes('indiatimes'))) {
    url = url.replace(/^http:\/\//i, 'https://');
  }

  return url;
}

/**
 * Opens an external source article URL using native in-app browser
 * (Chrome Custom Tabs on Android, SFSafariViewController on iOS).
 * Automatically falls back to system browser if in-app browser is unavailable.
 */
export async function openArticleSource(url: string): Promise<void> {
  const targetUrl = sanitizeArticleUrl(url);
  if (!targetUrl) return;

  try {
    const { colors } = useThemeStore.getState().theme;
    await WebBrowser.openBrowserAsync(targetUrl, {
      toolbarColor: colors.background,
      controlsColor: colors.primary,
      showTitle: true,
      enableBarCollapsing: true,
      secondaryToolbarColor: colors.surface,
    });
  } catch (error) {
    console.warn('[ZeroDaily Reader] In-app browser failed, trying system browser:', error);
    try {
      const supported = await Linking.canOpenURL(targetUrl);
      if (supported) {
        await Linking.openURL(targetUrl);
      }
    } catch (linkError) {
      console.error('[ZeroDaily Reader] Failed to open URL with system browser:', linkError);
    }
  }
}

