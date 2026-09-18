import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { Article } from '../types';

const BOOKMARKS_STORAGE_KEY = '@zerodaily_bookmarks';

interface BookmarkState {
  bookmarks: Article[];
  isLoaded: boolean;

  // Actions
  loadBookmarks: () => Promise<void>;
  toggleBookmark: (article: Article) => Promise<boolean>;
  isBookmarked: (articleId: string) => boolean;
  clearAllBookmarks: () => Promise<void>;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  isLoaded: false,

  loadBookmarks: async () => {
    try {
      const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Article[];
        set({ bookmarks: parsed, isLoaded: true });
        return;
      }
    } catch {
      // Storage read error fallback
    }
    set({ bookmarks: [], isLoaded: true });
  },

  toggleBookmark: async (article: Article) => {
    const { bookmarks } = get();
    const exists = bookmarks.some((b) => b.id === article.id);

    let updated: Article[];
    let newState: boolean;

    if (exists) {
      updated = bookmarks.filter((b) => b.id !== article.id);
      newState = false;
    } else {
      updated = [article, ...bookmarks];
      newState = true;
    }

    set({ bookmarks: updated });
    await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
    return newState;
  },

  isBookmarked: (articleId: string) => {
    return get().bookmarks.some((b) => b.id === articleId);
  },

  clearAllBookmarks: async () => {
    set({ bookmarks: [] });
    await AsyncStorage.removeItem(BOOKMARKS_STORAGE_KEY);
  },
}));
