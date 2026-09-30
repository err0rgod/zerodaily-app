import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { fetchFeed } from '../api/client';
import { Article, CategoryKey } from '../types';
import { rankArticlesForUser } from '../utils/personalization';
import { readingTracker } from '../utils/readingTracker';
import { useUserStore } from './userStore';

const STORAGE_CACHE_KEY_PREFIX = '@zerodaily_feed_cache_';
const PREFETCH_THRESHOLD = 8; // Fetch next batch when remaining cards <= 8
export const CACHE_TTL_MS = 15 * 60 * 1000; // 15-minute offline cache TTL
/** How long a refresh may stay in flight before the spinner is force-cleared. */
const REFRESH_TIMEOUT_MS = 20 * 1000;
const MIN_UNREAD_BUFFER_SIZE = 10;
const MAX_AUTO_FILL_PAGES = 3;

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
  isAllCaughtUp: boolean;
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
 * Returns payload and whether the cache is still fresh (< 15 minutes old).
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
 * Saves feed to local storage with timestamp for 15-minute TTL validation.
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

/**
 * Fisher-Yates array shuffle (exported for testing backward compatibility).
 */
export function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Applies user algorithmic affinity weights and topic preferences via Weighted Diverse Interleaving,
 * then merges notification article. (No random shuffling to preserve personalization scores).
 */
function personalizeAndMerge(articles: Article[], notifArticle: Article | null, currentCategory: CategoryKey): Article[] {
  const user = useUserStore.getState().user;
  const personalized = rankArticlesForUser(articles, user, currentCategory);
  return mergeWithNotification(personalized, notifArticle, currentCategory);
}

/**
 * Silently fills the feed buffer with unread articles in the background
 * using the pagination cursor until buffer reaches the minimum threshold.
 */
async function autoFillArticles(
  category: CategoryKey,
  existingArticles: Article[],
  startCursor: string | null,
  startHasMore: boolean
): Promise<{ articles: Article[]; cursor: string | null; hasMore: boolean }> {
  let accumulated = [...existingArticles];
  const seenIds = new Set(accumulated.map((a) => a.id));
  let cursor = startCursor;
  let hasMore = startHasMore;
  let pagesFetched = 0;

  while (accumulated.length < MIN_UNREAD_BUFFER_SIZE && hasMore && cursor && pagesFetched < MAX_AUTO_FILL_PAGES) {
    try {
      pagesFetched++;
      const nextBatch = await fetchFeed(category, cursor);
      if (!nextBatch.data || nextBatch.data.length === 0) {
        hasMore = false;
        break;
      }
      cursor = nextBatch.pagination?.next_cursor ?? null;
      hasMore = nextBatch.pagination?.has_more ?? false;

      const unread = readingTracker.filterUnreadArticles(nextBatch.data);
      for (const a of unread) {
        if (!seenIds.has(a.id)) {
          seenIds.add(a.id);
          accumulated.push(a);
        }
      }
    } catch {
      break;
    }
  }

  return { articles: accumulated, cursor, hasMore };
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
  isAllCaughtUp: false,
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
      isAllCaughtUp: false,
      activeNotificationArticle: activeNotif,
    });

    await readingTracker.ensureLoaded();

    // 1. If cache is fresh (< 15 minutes old), restore from disk cache
    const { payload, isFresh } = await getCachedFeed(category);
    if (isFresh && payload && payload.data.length > 0) {
      const notif = get().activeNotificationArticle;
      let unread = readingTracker.filterUnreadArticles(payload.data);
      let cursor = payload.cursor ?? null;
      let hasMore = payload.hasMore ?? true;
      let isCaughtUp = false;

      if (unread.length < MIN_UNREAD_BUFFER_SIZE && hasMore && cursor) {
        const filled = await autoFillArticles(category, unread, cursor, hasMore);
        unread = filled.articles;
        cursor = filled.cursor;
        hasMore = filled.hasMore;
      }

      if (unread.length === 0) {
        unread = payload.data;
        isCaughtUp = true;
      }

      const displayArticles = personalizeAndMerge(unread, notif, category);
      set({
        articles: displayArticles,
        cursor,
        hasMore,
        isLoading: false,
        isAllCaughtUp: isCaughtUp,
      });
      return;
    }

    // 2. Cache is older than 15 minutes (or empty) -> fetch fresh from web
    try {
      const res = await fetchFeed(category);
      if (res.data && res.data.length > 0) {
        const notif = get().activeNotificationArticle;
        let unread = readingTracker.filterUnreadArticles(res.data);
        let cursor = res.pagination.next_cursor;
        let hasMore = res.pagination.has_more;
        let isCaughtUp = false;

        if (unread.length < MIN_UNREAD_BUFFER_SIZE && hasMore && cursor) {
          const filled = await autoFillArticles(category, unread, cursor, hasMore);
          unread = filled.articles;
          cursor = filled.cursor;
          hasMore = filled.hasMore;
        }

        if (unread.length === 0) {
          unread = res.data;
          isCaughtUp = true;
        }

        const displayArticles = personalizeAndMerge(unread, notif, category);
        set({
          articles: displayArticles,
          cursor,
          hasMore,
          isLoading: false,
          isAllCaughtUp: isCaughtUp,
        });
        await setCachedFeed(category, res.data, cursor, hasMore);
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

    set({ isLoading: true });
    await readingTracker.ensureLoaded();

    // 1. Check local disk cache
    const { payload, isFresh } = await getCachedFeed(category);
    if (isFresh && payload && payload.data.length > 0) {
      // Fresh cache (< 15 minutes) -> display immediately for 0ms cold boot
      const notif = get().activeNotificationArticle;
      let unread = readingTracker.filterUnreadArticles(payload.data);
      let cursor = payload.cursor ?? null;
      let hasMore = payload.hasMore ?? true;
      let isCaughtUp = false;

      // Auto-fill buffer if unread cards are below threshold
      if (unread.length < MIN_UNREAD_BUFFER_SIZE && hasMore && cursor) {
        const filled = await autoFillArticles(category, unread, cursor, hasMore);
        unread = filled.articles;
        cursor = filled.cursor;
        hasMore = filled.hasMore;
      }

      // "All Caught Up" Graceful Fallback: if all stories read, show recent
      if (unread.length === 0) {
        unread = payload.data;
        isCaughtUp = true;
      }

      const displayArticles = personalizeAndMerge(unread, notif, category);
      set({
        articles: displayArticles,
        cursor,
        hasMore,
        isLoading: false,
        isAllCaughtUp: isCaughtUp,
      });
      return;
    }

    // 2. Cache is older than 15 minutes (or empty) -> fetch fresh from web
    try {
      const res = await fetchFeed(category);
      if (res.data && res.data.length > 0) {
        const notif = get().activeNotificationArticle;
        let unread = readingTracker.filterUnreadArticles(res.data);
        let cursor = res.pagination.next_cursor;
        let hasMore = res.pagination.has_more;
        let isCaughtUp = false;

        if (unread.length < MIN_UNREAD_BUFFER_SIZE && hasMore && cursor) {
          const filled = await autoFillArticles(category, unread, cursor, hasMore);
          unread = filled.articles;
          cursor = filled.cursor;
          hasMore = filled.hasMore;
        }

        if (unread.length === 0) {
          unread = res.data;
          isCaughtUp = true;
        }

        const displayArticles = personalizeAndMerge(unread, notif, category);
        set({
          articles: displayArticles,
          cursor,
          hasMore,
          isLoading: false,
          isAllCaughtUp: isCaughtUp,
        });
        await setCachedFeed(category, res.data, cursor, hasMore);
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  refreshFeed: async () => {
    // A second pull while a refresh is already in flight would stack requests
    // and race over the cursor; ignore it.
    if (get().isRefreshing) return;

    const { category, cursor } = get();
    set({ isRefreshing: true });
    await readingTracker.ensureLoaded();

    let settled = false;
    const hangGuard = setTimeout(() => {
      if (!settled) set({ isRefreshing: false });
    }, REFRESH_TIMEOUT_MS);

    try {
      // Fetch next 20 articles using cursor when available; wrap to beginning if cursor finished
      let res = await fetchFeed(category, cursor || undefined, 20);
      if ((!res.data || res.data.length === 0) && cursor) {
        res = await fetchFeed(category, undefined, 20);
      }

      if (res.data && res.data.length > 0) {
        let unread = readingTracker.filterUnreadArticles(res.data);
        let nextCursor = res.pagination?.next_cursor || null;
        let nextHasMore = res.pagination?.has_more ?? true;
        let isCaughtUp = false;

        if (unread.length < MIN_UNREAD_BUFFER_SIZE && nextHasMore && nextCursor) {
          const filled = await autoFillArticles(category, unread, nextCursor, nextHasMore);
          unread = filled.articles;
          nextCursor = filled.cursor;
          nextHasMore = filled.hasMore;
        }

        if (unread.length === 0) {
          unread = res.data;
          isCaughtUp = true;
        }

        const displayArticles = personalizeAndMerge(unread, null, category);
        set({
          articles: displayArticles,
          currentIndex: 0,
          cursor: nextCursor,
          hasMore: nextHasMore,
          isRefreshing: false,
          activeNotificationArticle: null,
          isAllCaughtUp: isCaughtUp,
        });
        await setCachedFeed(category, res.data, nextCursor, nextHasMore);
      } else {
        set({ isRefreshing: false });
      }
    } catch {
      // Offline fallback: keep existing chronological articles
      set({ isRefreshing: false });
    } finally {
      settled = true;
      clearTimeout(hangGuard);
    }
  },

  prefetchNextBatch: async () => {
    const { category, cursor, hasMore, isPrefetching, articles } = get();
    if (!hasMore || isPrefetching || !cursor) return;

    set({ isPrefetching: true });
    await readingTracker.ensureLoaded();

    try {
      const res = await fetchFeed(category, cursor);
      if (res.data && res.data.length > 0) {
        const existingIds = new Set(articles.map((a) => a.id));
        const unread = readingTracker.filterUnreadArticles(res.data);
        let fresh = unread.filter((a) => !existingIds.has(a.id));
        let nextCursor = res.pagination.next_cursor;
        let nextHasMore = res.pagination.has_more;

        if (fresh.length < 8 && nextHasMore && nextCursor) {
          const filled = await autoFillArticles(category, fresh, nextCursor, nextHasMore);
          fresh = filled.articles.filter((a) => !existingIds.has(a.id));
          nextCursor = filled.cursor;
          nextHasMore = filled.hasMore;
        }

        const user = useUserStore.getState().user;
        const personalizedFresh = rankArticlesForUser(fresh, user, category);

        const updated = [...articles, ...personalizedFresh];
        set({
          articles: updated,
          cursor: nextCursor,
          hasMore: nextHasMore,
          isPrefetching: false,
        });

        await setCachedFeed(category, updated, nextCursor, nextHasMore);
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
