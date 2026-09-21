import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { fetchFeed } from '../api/client';
import { MOCK_ARTICLES } from '../api/mockData';
import { Article, CategoryKey } from '../types';

const STORAGE_CACHE_KEY_PREFIX = '@zerodaily_feed_cache_';
const PREFETCH_THRESHOLD = 8; // Fetch next batch when remaining cards <= 8

interface FeedState {
  category: CategoryKey;
  articles: Article[];
  currentIndex: number;
  cursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  isPrefetching: boolean;

  // Actions
  setCategory: (category: CategoryKey) => Promise<void>;
  setCurrentIndex: (index: number) => void;
  loadInitialFeed: (category?: CategoryKey) => Promise<void>;
  refreshFeed: () => Promise<void>;
  prefetchNextBatch: () => Promise<void>;
  setArticleDirectly: (article: Article) => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  category: 'all',
  articles: MOCK_ARTICLES, // Seeded with mock data for instant 0ms cold boot
  currentIndex: 0,
  cursor: null,
  hasMore: true,
  isLoading: false,
  isRefreshing: false,
  isPrefetching: false,

  setCategory: async (category: CategoryKey) => {
    if (get().category === category && get().articles.length > 0) return;

    set({ category, currentIndex: 0, isLoading: true, cursor: null, hasMore: true });

    // Try loading local cached batch for this category
    try {
      const cached = await AsyncStorage.getItem(`${STORAGE_CACHE_KEY_PREFIX}${category}`);
      if (cached) {
        const parsed = JSON.parse(cached) as Article[];
        if (parsed && parsed.length > 0) {
          set({ articles: parsed, isLoading: false });
        }
      }
    } catch {
      // Ignore cache read failures
    }

    // Background network sync
    try {
      const res = await fetchFeed(category);
      if (res.data && res.data.length > 0) {
        set({
          articles: res.data,
          cursor: res.pagination.next_cursor,
          hasMore: res.pagination.has_more,
          isLoading: false,
        });
        await AsyncStorage.setItem(
          `${STORAGE_CACHE_KEY_PREFIX}${category}`,
          JSON.stringify(res.data)
        );
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setCurrentIndex: (index: number) => {
    set({ currentIndex: index });

    // Check N - 8 Prefetch Rule from Docs.md
    const { articles, isPrefetching, hasMore } = get();
    const remaining = articles.length - index;

    if (remaining <= PREFETCH_THRESHOLD && hasMore && !isPrefetching) {
      get().prefetchNextBatch();
    }
  },

  loadInitialFeed: async (targetCategory?: CategoryKey) => {
    const category = targetCategory || get().category;
    set({ isLoading: true });

    // 1. Try restore from disk
    try {
      const cached = await AsyncStorage.getItem(`${STORAGE_CACHE_KEY_PREFIX}${category}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({ articles: parsed, isLoading: false });
        }
      }
    } catch {
      // Disk error fallback
    }

    // 2. Fetch fresh articles from network
    try {
      const res = await fetchFeed(category);
      if (res.data && res.data.length > 0) {
        set({
          articles: res.data,
          cursor: res.pagination.next_cursor,
          hasMore: res.pagination.has_more,
          isLoading: false,
        });
        await AsyncStorage.setItem(
          `${STORAGE_CACHE_KEY_PREFIX}${category}`,
          JSON.stringify(res.data)
        );
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
      const incoming = res.data && res.data.length > 0 ? res.data : currentArticles;
      if (incoming && incoming.length > 0) {
        // Rotate or shift the feed so the user sees a fresh/different top article every time they refresh
        const currentTopId = currentArticles[0]?.id;
        let freshArticles = [...incoming];
        if (incoming.length > 1) {
          // Pick an offset so the top article changes
          const shift = Math.floor(Math.random() * (incoming.length - 1)) + 1;
          freshArticles = [...incoming.slice(shift), ...incoming.slice(0, shift)];
        }

        set({
          articles: freshArticles,
          currentIndex: 0,
          cursor: res.pagination?.next_cursor || null,
          hasMore: res.pagination?.has_more ?? true,
          isRefreshing: false,
        });
        await AsyncStorage.setItem(
          `${STORAGE_CACHE_KEY_PREFIX}${category}`,
          JSON.stringify(freshArticles)
        );
      } else {
        set({ isRefreshing: false });
      }
    } catch {
      // If offline on refresh, rotate local stories to give immediate fresh article feedback
      if (currentArticles.length > 1) {
        const shift = Math.floor(Math.random() * (currentArticles.length - 1)) + 1;
        const rotated = [...currentArticles.slice(shift), ...currentArticles.slice(0, shift)];
        set({ articles: rotated, currentIndex: 0, isRefreshing: false });
      } else {
        set({ isRefreshing: false });
      }
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

        // Update local disk cache
        AsyncStorage.setItem(
          `${STORAGE_CACHE_KEY_PREFIX}${category}`,
          JSON.stringify(updated.slice(0, 50))
        ).catch(() => {});
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
      category: targetCategory,
      articles: [article, ...filtered],
      currentIndex: 0,
    });
  },
}));
