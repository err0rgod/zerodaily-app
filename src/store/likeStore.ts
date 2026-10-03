import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { Article } from '../types';
import { useUserStore } from './userStore';

const STORAGE_KEY = '@zerodaily_liked_articles';

interface LikeState {
  likedIds: string[];
  isLoaded: boolean;
  loadLikes: () => Promise<void>;
  isLiked: (articleId: string) => boolean;
  toggleLike: (article: Article) => Promise<boolean>;
}

export const useLikeStore = create<LikeState>((set, get) => ({
  likedIds: [],
  isLoaded: false,

  loadLikes: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
          set({ likedIds: ids, isLoaded: true });
          return;
        }
      }
    } catch (err) {
      console.warn('[ZeroDaily LikeStore] Failed to load liked articles:', err);
    }
    set({ likedIds: [], isLoaded: true });
  },

  isLiked: (articleId: string) => {
    return get().likedIds.includes(articleId);
  },

  toggleLike: async (article: Article) => {
    const { likedIds } = get();
    const currentlyLiked = likedIds.includes(article.id);
    let updatedIds: string[];
    let isNowLiked: boolean;

    if (currentlyLiked) {
      // Un-like: remove from list and decrease category affinity weight
      updatedIds = likedIds.filter((id) => id !== article.id);
      isNowLiked = false;
      useUserStore.getState().boostCategoryWeight(article.category, -0.35).catch(() => {});
    } else {
      // Like: add to list, boost category affinity weight, and track event
      updatedIds = [article.id, ...likedIds];
      isNowLiked = true;
      useUserStore.getState().boostCategoryWeight(article.category, 0.35).catch(() => {});
      useUserStore.getState().trackEvent(article.id, article.category, 'like').catch(() => {});
    }

    set({ likedIds: updatedIds });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedIds)).catch((err) => {
      console.warn('[ZeroDaily LikeStore] Failed to save liked articles:', err);
    });

    return isNowLiked;
  },
}));
