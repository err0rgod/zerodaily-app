import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { fetchFeed } from '../api/client';
import { CATEGORY_LIST } from '../constants/categories';
import { Article, CategoryKey } from '../types';
import { rankArticlesForUser } from '../utils/personalization';
import { readingTracker } from '../utils/readingTracker';
import { useUserStore } from './userStore';
import { useSettingsStore } from './settingsStore';

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
    return parseCachedFeed(raw);
  } catch {
    return { payload: null, isFresh: false };
  }
}

function parseCachedFeed(raw: string | null): { payload: FeedCachePayload | null; isFresh: boolean } {
  try {
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
 * In-memory copy of the last feed written per category, so switching back to a recently
 * viewed category can render its cards synchronously instead of flashing the old category.
 */
const memoryFeeds = new Map<CategoryKey, FeedCachePayload>();
let memoryFeedsWarmed = false;

/** Loads every category's fresh disk cache into memory once, so first-time switches are instant. */
async function warmMemoryFeeds(): Promise<void> {
  if (memoryFeedsWarmed) return;
  memoryFeedsWarmed = true;
  try {
    const keys = CATEGORY_LIST.map((c) => `${STORAGE_CACHE_KEY_PREFIX}${c.key}`);
    const entries = await AsyncStorage.multiGet(keys);
    entries.forEach(([key, raw]) => {
      const category = key.slice(STORAGE_CACHE_KEY_PREFIX.length) as CategoryKey;
      const { payload, isFresh } = parseCachedFeed(raw);
      if (isFresh && payload && !memoryFeeds.has(category)) {
        memoryFeeds.set(category, payload);
      }
    });
  } catch {
    // Memory warm-up is best effort
  }
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
    memoryFeeds.set(category, payload);
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
  const notifPrefs = useSettingsStore.getState().preferences;
  const personalized = rankArticlesForUser(articles, user, currentCategory, notifPrefs);
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

    // 0. Recently viewed in this session: swap the cards in the same update as the category,
    //    so the deck never renders the previous category's articles under the new one.
    const memory = memoryFeeds.get(category);
    if (memory && memory.data.length > 0 && Date.now() - memory.timestamp < CACHE_TTL_MS) {
      let unread = readingTracker.filterUnreadArticles(memory.data);
      const isCaughtUp = unread.length === 0;
      if (isCaughtUp) unread = memory.data;
      set({
        category,
        currentIndex: 0,
        articles: personalizeAndMerge(unread, activeNotif, category),
        isLoading: false,
        cursor: memory.cursor ?? null,
        hasMore: memory.hasMore ?? true,
        isAllCaughtUp: isCaughtUp,
        activeNotificationArticle: activeNotif,
      });
      return;
    }

    // Otherwise clear the deck (the loader shows) rather than keep the old category's cards.
    set({
      category,
      articles: [],
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
    if (get().category !== category) return; // user already moved on to another category
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

      if (get().category !== category) return;
      const displayArticles = personalizeAndMerge(unread, notif, category);
      set({
        articles: displayArticles,
        cursor,
        hasMore,
        isLoading: false,
        isAllCaughtUp: isCaughtUp,
      });
      await setCachedFeed(category, displayArticles, cursor, hasMore);
      return;
    }

    // 2. Cache is older than 15 minutes (or empty) -> fetch fresh from web
    // Falls back to the stale disk cache when the network is unavailable.
    const showStaleCache = () => {
      if (get().category !== category) return;
      if (payload && payload.data.length > 0) {
        set({
          articles: personalizeAndMerge(payload.data, get().activeNotificationArticle, category),
          cursor: payload.cursor ?? null,
          hasMore: payload.hasMore ?? true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    };

    try {
      const res = await fetchFeed(category);
      if (get().category !== category) return;
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

        if (get().category !== category) return;
        const displayArticles = personalizeAndMerge(unread, notif, category);
        set({
          articles: displayArticles,
          cursor,
          hasMore,
          isLoading: false,
          isAllCaughtUp: isCaughtUp,
        });
        await setCachedFeed(category, displayArticles, cursor, hasMore);
      } else {
        showStaleCache();
      }
    } catch {
      showStaleCache();
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

    set({ isLoading: true, currentIndex: 0 });
    await readingTracker.ensureLoaded();
    void warmMemoryFeeds();

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
        currentIndex: 0,
      });
      await setCachedFeed(category, displayArticles, cursor, hasMore);
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
          currentIndex: 0,
        });
        await setCachedFeed(category, displayArticles, cursor, hasMore);
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
        await setCachedFeed(category, displayArticles, nextCursor, nextHasMore);
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
        const notifPrefs = useSettingsStore.getState().preferences;
        const personalizedFresh = rankArticlesForUser(fresh, user, category, notifPrefs);

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

    // If buffer had no other articles, populate the rest of the swiper in the background
    // so the user can continue swiping smoothly after the notification card!
    if (filtered.length === 0) {
      get().loadInitialFeed(targetCategory);
    }
  },

  clearNotificationArticle: () => {
    set({ activeNotificationArticle: null });
  },
}));
