import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';
import { fetchArticleById } from '../api/client';
import { useFeedStore } from '../store/feedStore';

interface UseDeepLinksOptions {
  onArticleOpened?: () => void;
}

/**
 * Extracts article ID from supported deep links:
 * - https://zerodaily.in/a/:articleId
 * - https://zerodaily.in/story/:articleId
 * - zerodaily://a/:articleId
 * - zerodaily://story/:articleId
 * - Any URL with query params ?id=:id or ?article_id=:id
 */
export function extractArticleIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();

  // 1. Custom scheme: zerodaily://a/:id or zerodaily://story/:id
  const customSchemeMatch = clean.match(/^zerodaily:\/\/(?:a|story)\/([^?#/]+)/i);
  if (customSchemeMatch && customSchemeMatch[1]) {
    return decodeURIComponent(customSchemeMatch[1]);
  }

  // 2. Web universal link: https://zerodaily.in/a/:id or https://zerodaily.in/story/:id
  const httpMatch = clean.match(/^https?:\/\/(?:[a-zA-Z0-9-]+\.)?zerodaily\.in\/(?:a|story)\/([^?#/]+)/i);
  if (httpMatch && httpMatch[1]) {
    return decodeURIComponent(httpMatch[1]);
  }

  // 3. Query param fallback: ?id=:id or ?article_id=:id
  const queryMatch = clean.match(/[?&](?:id|article_id)=([^&#]+)/i);
  if (queryMatch && queryMatch[1]) {
    return decodeURIComponent(queryMatch[1]);
  }

  return null;
}

/**
 * Hook to manage:
 * 1. Cold-boot launch from deep link (e.g. user tapped link while app was closed)
 * 2. Hot-boot listener for incoming deep link events while app is open
 * 3. Navigates directly to the target story card in the main feed
 */
export function useDeepLinks(options?: UseDeepLinksOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const lastHandledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const processUrl = async (rawUrl: string | null) => {
      if (!rawUrl || rawUrl === lastHandledUrlRef.current) return;
      lastHandledUrlRef.current = rawUrl;

      const articleId = extractArticleIdFromUrl(rawUrl);
      if (!articleId) return;

      console.log(`[ZeroDaily DeepLink] Navigating to article from link: ${articleId}`);

      // 1. Check if article is already in local feed
      const { articles, setArticleDirectly } = useFeedStore.getState();
      const existing = articles.find((a) => a.id === articleId);

      if (existing) {
        setArticleDirectly(existing);
        optionsRef.current?.onArticleOpened?.();
        return;
      }

      // 2. Fetch fresh article from API
      try {
        const fresh = await fetchArticleById(articleId);
        if (fresh) {
          useFeedStore.getState().setArticleDirectly(fresh);
          optionsRef.current?.onArticleOpened?.();
        }
      } catch (err) {
        console.warn(`[ZeroDaily DeepLink] Could not resolve article ${articleId}:`, err);
      }
    };

    // Cold-boot URL handling
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          processUrl(url);
        }
      })
      .catch((err) => {
        console.warn('[ZeroDaily DeepLink] getInitialURL error:', err);
      });

    // Hot-boot listener (App running in background)
    const subscription = Linking.addEventListener('url', (event) => {
      processUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
