import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { fetchFeed } from '../api/client';
import { Article, CategoryKey } from '../types';

const STORAGE_CACHE_KEY_PREFIX = '@zerodaily_feed_cache_';
const PREFETCH_THRESHOLD = 8; // Fetch next batch when remaining cards <= 8
export const CACHE_TTL_MS = 30 * 60 * 1000; // 30-minute offline cache TTL

export interface FeedCachePayload {
  timestamp: number;
  data: Article[];
  cursor?: string | null;
  hasMore?: boolean;
}

interface FeedState {
  category: CategoryKey;
  articles: Article[];
  currentIndex: number;
  cursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  isPrefetching: boolean;
  activeNotificationArticle: Article | null;

  // Actions
  setCategory: (category: CategoryKey) => Promise<void>;
  setCurrentIndex: (index: number) => void;
  loadInitialFeed: (category?: CategoryKey) => Promise<void>;
  refreshFeed: () => Promise<void>;
  prefetchNextBatch: () => Promise<void>;
  setArticleDirectly: (article: Article) => void;
  clearNotificationArticle: () => void;
}

/**
 * Reads cached feed from local storage with backward compatibility.
 * Returns payload and whether the cache is still fresh (< 30 minutes old).
 */
async function getCachedFeed(category: CategoryKey): Promise<{ payload: FeedCachePayload | null; isFresh: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_CACHE_KEY_PREFIX}${category}`);
    if (!raw) return { payload: null, isFresh: false };

    const parsed = JSON.parse(raw);

    // Backward compatibility: support legacy raw Article[] cache
    if (Array.isArray(parsed)) {
      return {
        payload: {
          timestamp: 0,
          data: parsed,
          cursor: null,
          hasMore: true,
        },
        isFresh: false,
      };
    }

    if (parsed && Array.isArray(parsed.data)) {
      const isFresh = typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp < CACHE_TTL_MS;
      return {
        payload: {
          timestamp: parsed.timestamp || 0,
          data: parsed.data,
          cursor: parsed.cursor ?? null,
          hasMore: parsed.hasMore ?? true,
        },
        isFresh,
      };
    }
  } catch {
    // Disk read fallback
  }
  return { payload: null, isFresh: false };
}

/**
 * Saves feed to local storage with timestamp for 30-minute TTL validation.
 */
async function setCachedFeed(
  category: CategoryKey,
  data: Article[],
  cursor: string | null = null,
  hasMore: boolean = true
): Promise<void> {
  try {
    const payload: FeedCachePayload = {
      timestamp: Date.now(),
      data: data.slice(0, 50),
      cursor,
      hasMore,
    };
    await AsyncStorage.setItem(`${STORAGE_CACHE_KEY_PREFIX}${category}`, JSON.stringify(payload));
  } catch {
    // Disk write fallback
  }
}

/**
 * Merges active notification article into the article list if present,
 * ensuring it stays at index 0 and isn't duplicated or overwritten.
 */
function mergeWithNotification(articles: Article[], notifArticle: Article | null, currentCategory: CategoryKey): Article[] {
  if (!notifArticle) return articles;
  // Only inject if article matches category or if in 'all' feed
  if (currentCategory !== 'all' && notifArticle.category !== currentCategory) {
    return articles;
  }
  const filtered = articles.filter((a) => a.id !== notifArticle.id);
  return [notifArticle, ...filtered];
}

export const useFeedStore = create<FeedState>((set, get) => ({
  category: 'all',
  articles: [],
  currentIndex: 0,
  cursor: null,
  hasMore: true,
  isLoading: false,
  isRefreshing: false,
  isPrefetching: false,
  activeNotificationArticle: null,

  setCategory: async (category: CategoryKey) => {
    if (get().category === category && get().articles.length > 0) return;

    // If switching to a category that doesn't match the notification article, clear notification lock
    const currentNotif = get().activeNotificationArticle;
    const shouldKeepNotif = currentNotif && (category === 'all' || currentNotif.category === category);
    const activeNotif = shouldKeepNotif ? currentNotif : null;

    set({
      category,
      currentIndex: 0,
      isLoading: true,
      cursor: null,
      hasMore: true,
      activeNotificationArticle: activeNotif,
    });

    // 1. Try restoring from local disk cache immediately (0ms UI render)
    const { payload, isFresh } = await getCachedFeed(category);
    if (payload && payload.data.length > 0) {
      const displayArticles = mergeWithNotification(payload.data, activeNotif, category);
      set({
        articles: displayArticles,
        cursor: payload.cursor,
        hasMore: payload.hasMore ?? true,
        isLoading: false,
      });

      // If disk cache is fresh within 30-min TTL, skip immediate network fetch
      if (isFresh) return;
    }

    // 2. Fetch fresh articles from network if cache was stale or empty
    try {
      const res = await fetchFeed(category);
      if (res.data && res.data.length > 0) {
        const notif = get().activeNotificationArticle;
        const displayArticles = mergeWithNotification(res.data, notif, category);
        set({
          articles: displayArticles,
          cursor: res.pagination.next_cursor,
          hasMore: res.pagination.has_more,
          isLoading: false,
        });
        await setCachedFeed(category, res.data, res.pagination.next_cursor, res.pagination.has_more);
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setCurrentIndex: (index: number) => {
    // If the user swipes past the first card, release the notification pin lock
    const updates: Partial<FeedState> = { currentIndex: index };
    if (index > 0 && get().activeNotificationArticle) {
      updates.activeNotificationArticle = null;
    }
    set(updates as any);

    // Check N - 8 Prefetch Rule from AGENTS.md
    const { articles, isPrefetching, hasMore } = get();
    const remaining = articles.length - index;

    if (remaining <= PREFETCH_THRESHOLD && hasMore && !isPrefetching) {
      get().prefetchNextBatch();
    }
  },

  loadInitialFeed: async (targetCategory?: CategoryKey) => {
    const category = targetCategory || get().category;
    const activeNotif = get().activeNotificationArticle;

    set({ isLoading: true });

    // 1. Try restore from local disk cache immediately (0ms UI render)
    const { payload, isFresh } = await getCachedFeed(category);
    if (payload && payload.data.length > 0) {
      const displayArticles = mergeWithNotification(payload.data, activeNotif, category);
      set({
        articles: displayArticles,
        cursor: payload.cursor,
        hasMore: payload.hasMore ?? true,
        isLoading: false,
      });

      // If disk cache is fresh within 30-min TTL, do not overwrite with network fetch
      if (isFresh) return;
    }

    // 2. Fetch fresh articles from network (when cache is stale or empty)
    try {
      const res = await fetchFeed(category);
      if (res.data && res.data.length > 0) {
        const notif = get().activeNotificationArticle;
        const displayArticles = mergeWithNotification(res.data, notif, category);
        set({
          articles: displayArticles,
          cursor: res.pagination.next_cursor,
          hasMore: res.pagination.has_more,
          isLoading: false,
        });
        await setCachedFeed(category, res.data, res.pagination.next_cursor, res.pagination.has_more);
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  refreshFeed: async () => {
    const { category, articles: currentArticles } = get();
    set({ isRefreshing: true });

    try {
      const res = await fetchFeed(category);
      if (res.data && res.data.length > 0) {
        // Strictly chronological order - no random array shuffling
        set({
          articles: res.data,
          currentIndex: 0,
          cursor: res.pagination?.next_cursor || null,
          hasMore: res.pagination?.has_more ?? true,
          isRefreshing: false,
          activeNotificationArticle: null,
        });
        await setCachedFeed(category, res.data, res.pagination?.next_cursor, res.pagination?.has_more);
      } else {
        set({ isRefreshing: false });
      }
    } catch {
      // Offline fallback: keep existing chronological articles
      set({ isRefreshing: false });
    }
  },

  prefetchNextBatch: async () => {
    const { category, cursor, hasMore, isPrefetching, articles } = get();
    if (!hasMore || isPrefetching || !cursor) return;

    set({ isPrefetching: true });

    try {
      const res = await fetchFeed(category, cursor);
      if (res.data && res.data.length > 0) {
        // Deduplicate incoming articles by ID
        const existingIds = new Set(articles.map((a) => a.id));
        const fresh = res.data.filter((a) => !existingIds.has(a.id));

        const updated = [...articles, ...fresh];
        set({
          articles: updated,
          cursor: res.pagination.next_cursor,
          hasMore: res.pagination.has_more,
          isPrefetching: false,
        });

        // Update local disk cache with updated batch
        await setCachedFeed(category, updated, res.pagination.next_cursor, res.pagination.has_more);
      } else {
        set({ hasMore: false, isPrefetching: false });
      }
    } catch {
      set({ isPrefetching: false });
    }
  },

  setArticleDirectly: (article: Article) => {
    const { articles, category } = get();
    const targetCategory =
      category === 'all' || category === article.category
        ? category
        : article.category || 'all';

    // Move or insert target article at index 0 so it is immediately active on screen
    const filtered = articles.filter((a) => a.id !== article.id);
    set({
      activeNotificationArticle: article,
      category: targetCategory,
      articles: [article, ...filtered],
      currentIndex: 0,
      isLoading: false,
    });
  },

  clearNotificationArticle: () => {
    set({ activeNotificationArticle: null });
  },
}));
