import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { fetchFeed } from '../api/client';
import { Article, CategoryKey } from '../types';

const STORAGE_CACHE_KEY_PREFIX = '@zerodaily_feed_cache_';
const PREFETCH_THRESHOLD = 8; // Fetch next batch when remaining cards <= 8
export const CACHE_TTL_MS = 15 * 60 * 1000; // 15-minute offline cache TTL

/**
 * Monotonic token identifying the newest feed request. Every async load
 * captures the value it started with and refuses to commit if a newer request
 * has since been issued.
 *
 * Without this, tapping "AI" then quickly "Cybersec" lets the slower AI
 * response land last and overwrite the Cybersec feed — and the same applies to
 * a prefetch that resolves after the user has switched category.
 */
let feedRequestSeq = 0;

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
 * `isFresh` is true while the payload is younger than CACHE_TTL_MS.
 */
async function getCachedFeed(
  category: CategoryKey
): Promise<{ payload: FeedCachePayload | null; isFresh: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_CACHE_KEY_PREFIX}${category}`);
    if (!raw) return { payload: null, isFresh: false };

    const parsed = JSON.parse(raw);

    // Backward compatibility: support legacy raw Article[] cache
    if (Array.isArray(parsed)) {
      return {
        payload: { timestamp: 0, data: parsed, cursor: null, hasMore: true },
        isFresh: false,
      };
    }

    if (parsed && Array.isArray(parsed.data)) {
      const isFresh =
        typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp < CACHE_TTL_MS;
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

/** Persists a feed to disk with a timestamp for TTL validation. */
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
function mergeWithNotification(
  articles: Article[],
  notifArticle: Article | null,
  currentCategory: CategoryKey
): Article[] {
  if (!notifArticle) return articles;
  // Only inject if article matches category or if in 'all' feed
  if (currentCategory !== 'all' && notifArticle.category !== currentCategory) {
    return articles;
  }
  const filtered = articles.filter((a) => a.id !== notifArticle.id);
  return [notifArticle, ...filtered];
}

/**
 * Shared load path for both cold boot and category switching: serve fresh disk
 * cache immediately, otherwise go to the network. Returns nothing — callers
 * only differ in the state they set before invoking it.
 *
 * `seq` is the request token; if a newer request has been issued by the time
 * either branch resolves, this one abandons its result.
 */
async function loadCategoryFeed(
  category: CategoryKey,
  seq: number,
  set: (partial: Partial<FeedState>) => void,
  get: () => FeedState
): Promise<void> {
  const { payload, isFresh } = await getCachedFeed(category);
  if (seq !== feedRequestSeq) return;

  if (isFresh && payload && payload.data.length > 0) {
    const notif = get().activeNotificationArticle;
    set({
      articles: mergeWithNotification(payload.data, notif, category),
      cursor: payload.cursor,
      hasMore: payload.hasMore ?? true,
      isLoading: false,
    });
    return;
  }

  try {
    const res = await fetchFeed(category);
    // A newer category/refresh superseded this request while it was in flight.
    if (seq !== feedRequestSeq) return;
    if (get().category !== category) return;

    if (res.data && res.data.length > 0) {
      const notif = get().activeNotificationArticle;
      set({
        articles: mergeWithNotification(res.data, notif, category),
        cursor: res.pagination.next_cursor,
        hasMore: res.pagination.has_more,
        isLoading: false,
      });
      await setCachedFeed(category, res.data, res.pagination.next_cursor, res.pagination.has_more);
    } else {
      set({ isLoading: false });
    }
  } catch {
    if (seq !== feedRequestSeq) return;
    set({ isLoading: false });
  }
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

    const seq = ++feedRequestSeq;

    // If switching to a category that doesn't match the notification article, clear notification lock
    const currentNotif = get().activeNotificationArticle;
    const shouldKeepNotif =
      currentNotif && (category === 'all' || currentNotif.category === category);
    const activeNotif = shouldKeepNotif ? currentNotif : null;

    // Clear the previous category's cards immediately so the deck cannot show
    // stale stories under the newly selected pill.
    set({
      category,
      articles: [],
      currentIndex: 0,
      isLoading: true,
      cursor: null,
      hasMore: true,
      isPrefetching: false,
      activeNotificationArticle: activeNotif,
    });

    await loadCategoryFeed(category, seq, set, get);
  },

  setCurrentIndex: (index: number) => {
    // If the user swipes past the first card, release the notification pin lock
    const updates: Partial<FeedState> = { currentIndex: index };
    if (index > 0 && get().activeNotificationArticle) {
      updates.activeNotificationArticle = null;
    }
    set(updates);

    // Check N - 8 Prefetch Rule from AGENTS.md
    const { articles, isPrefetching, hasMore } = get();
    const remaining = articles.length - index;

    if (remaining <= PREFETCH_THRESHOLD && hasMore && !isPrefetching) {
      get().prefetchNextBatch();
    }
  },

  loadInitialFeed: async (targetCategory?: CategoryKey) => {
    const category = targetCategory || get().category;
    const seq = ++feedRequestSeq;
    set({ isLoading: true });
    await loadCategoryFeed(category, seq, set, get);
  },

  refreshFeed: async () => {
    const { category, cursor } = get();
    const seq = ++feedRequestSeq;
    set({ isRefreshing: true });

    try {
      // Fetch next 20 articles using cursor when available; wrap to beginning if cursor finished
      let res = await fetchFeed(category, cursor || undefined, 20);
      if ((!res.data || res.data.length === 0) && cursor) {
        res = await fetchFeed(category, undefined, 20);
      }

      if (seq !== feedRequestSeq || get().category !== category) return;

      if (res.data && res.data.length > 0) {
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
      if (seq === feedRequestSeq) set({ isRefreshing: false });
    }
  },

  prefetchNextBatch: async () => {
    const { category, cursor, hasMore, isPrefetching, articles } = get();
    if (!hasMore || isPrefetching || !cursor) return;

    const seq = feedRequestSeq;
    set({ isPrefetching: true });

    try {
      const res = await fetchFeed(category, cursor);
      // A category switch (or refresh) happened while this page was loading —
      // appending now would splice another category's stories into the deck.
      if (seq !== feedRequestSeq || get().category !== category) {
        set({ isPrefetching: false });
        return;
      }

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

        await setCachedFeed(category, updated, res.pagination.next_cursor, res.pagination.has_more);
      } else {
        set({ hasMore: false, isPrefetching: false });
      }
    } catch {
      if (seq === feedRequestSeq) set({ isPrefetching: false });
    }
  },

  setArticleDirectly: (article: Article) => {
    const { articles, category } = get();
    const targetCategory =
      category === 'all' || category === article.category ? category : article.category || 'all';

    // Invalidate any in-flight load so it cannot overwrite the pinned article.
    feedRequestSeq += 1;

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
