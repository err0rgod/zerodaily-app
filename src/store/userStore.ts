import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  createGuestSession,
  deleteUserAccount,
  fetchCurrentUser,
  fetchCurrentUserResult,
  loginUser,
  loginWithFirebase,
  registerUser,
  syncUserBookmarks,
  trackUserEvent,
  updateUserPreferences,
} from '../api/client';
import { TrackingEventPayload, UserProfile } from '../types';
import { useBookmarkStore } from './bookmarkStore';

const STORAGE_KEYS = {
  TOKEN: '@zerodaily_auth_token',
  USER: '@zerodaily_user_profile',
};

interface UserState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isGuest: boolean;
  isAuthenticated: boolean;

  // Global Auth Modal Presentation State (prevents nested Modal collisions)
  isAuthModalOpen: boolean;
  authModalMode: 'signup' | 'signin';
  openAuthModal: (mode?: 'signup' | 'signin') => void;
  closeAuthModal: () => void;

  // Lifecycle
  initSession: () => Promise<void>;

  // Authentication
  signUp: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  signInWithFirebase: (idToken: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; message?: string }>;

  // Preferences & Algorithmic Tracking
  updatePreferences: (preferences: Record<string, boolean>) => Promise<void>;
  trackEvent: (articleId: string, category: string, action: 'read' | 'dwell' | 'skip' | 'bookmark' | 'share' | 'full_roast', durationSeconds?: number) => Promise<void>;
  syncBookmarks: (bookmarks: string[], mode?: 'merge' | 'replace') => Promise<string[]>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isGuest: true,
  isAuthenticated: false,

  isAuthModalOpen: false,
  authModalMode: 'signup',
  openAuthModal: (mode: 'signup' | 'signin' = 'signup') => {
    set({ isAuthModalOpen: true, authModalMode: mode });
  },
  closeAuthModal: () => {
    set({ isAuthModalOpen: false });
  },

  initSession: async () => {
    set({ isLoading: true });
    try {
      const [storedToken, storedUserJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER),
      ]);

      if (storedToken) {
        // Fast UI boot with cached profile for instant offline rendering
        let localUser: UserProfile | null = null;
        if (storedUserJson) {
          try {
            localUser = JSON.parse(storedUserJson);
            if (localUser) {
              set({
                token: storedToken,
                user: localUser,
                isGuest: localUser.is_anonymous,
                isAuthenticated: !localUser.is_anonymous,
              });
            }
          } catch {}
        }

        // Validate token & sync freshest profile from cloud
        const result = await fetchCurrentUserResult(storedToken);
        if (result.user) {
          await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(result.user));
          set({
            token: storedToken,
            user: result.user,
            isGuest: result.user.is_anonymous,
            isAuthenticated: !result.user.is_anonymous,
            isLoading: false,
          });
          return;
        }

        // If offline / network error occurred, keep the valid cached session!
        if (result.isNetworkError && localUser) {
          set({ isLoading: false });
          return;
        }

        // Only when the server explicitly confirms 401 Unauthorized, invalidate session
        if (result.isUnauthorized) {
          await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
        }
      }

      // First run or invalid session: Create an anonymous guest session
      const guestRes = await createGuestSession();
      if (guestRes.status === 'success' && guestRes.access_token) {
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.TOKEN, guestRes.access_token),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(guestRes.user)),
        ]);
        set({
          token: guestRes.access_token,
          user: guestRes.user,
          isGuest: true,
          isAuthenticated: false,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.warn('[ZeroDaily UserStore] Session init error:', err);
      set({ isLoading: false });
    }
  },

  signUp: async (email: string, password: string, displayName?: string) => {
    set({ isLoading: true });
    const currentGuestId = get().isGuest ? get().user?.user_id : undefined;

    const res = await registerUser(email, password, displayName, currentGuestId);
    if (res.status === 'success' && res.access_token) {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.access_token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user)),
      ]);

      set({
        token: res.access_token,
        user: res.user,
        isGuest: false,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    }

    set({ isLoading: false });
    return { success: false, error: res.message || 'Registration failed' };
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    const currentGuestId = get().isGuest ? get().user?.user_id : undefined;
    const res = await loginUser(email, password, currentGuestId);

    if (res.status === 'success' && res.access_token) {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.access_token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user)),
      ]);

      set({
        token: res.access_token,
        user: res.user,
        isGuest: false,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true, message: res.message };
    }

    set({ isLoading: false });
    return { success: false, error: res.message || 'Login failed' };
  },

  signInWithFirebase: async (idToken: string) => {
    set({ isLoading: true });
    const currentGuestId = get().isGuest ? get().user?.user_id : undefined;
    const res = await loginWithFirebase(idToken, currentGuestId);

    if (res.status === 'success' && res.access_token) {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.access_token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user)),
      ]);

      set({
        token: res.access_token,
        user: res.user,
        isGuest: false,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true, message: res.message };
    }

    set({ isLoading: false });
    return { success: false, error: res.message || 'Firebase authentication failed' };
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
      // Clear bookmarks on sign out to prevent account leak on shared device
      await useBookmarkStore.getState().clearAllBookmarks().catch(() => {});

      set({ user: null, token: null, isAuthenticated: false, isGuest: true });

      // Seamlessly generate a fresh guest session
      const guestRes = await createGuestSession();
      if (guestRes.status === 'success') {
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.TOKEN, guestRes.access_token),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(guestRes.user)),
        ]);
        set({
          token: guestRes.access_token,
          user: guestRes.user,
          isGuest: true,
          isAuthenticated: false,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.warn('[ZeroDaily UserStore] Sign out error:', err);
      set({ isLoading: false });
    }
  },

  deleteAccount: async () => {
    set({ isLoading: true });
    const { token } = get();
    if (!token) {
      set({ isLoading: false });
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const res = await deleteUserAccount(token);
      if (res.status === 'success') {
        // Clear saved user credentials and local bookmarks
        await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
        await useBookmarkStore.getState().clearAllBookmarks().catch(() => {});

        set({ user: null, token: null, isAuthenticated: false, isGuest: true });

        // Seamlessly provision a fresh guest session
        const guestRes = await createGuestSession();
        if (guestRes.status === 'success') {
          await Promise.all([
            AsyncStorage.setItem(STORAGE_KEYS.TOKEN, guestRes.access_token),
            AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(guestRes.user)),
          ]);
          set({
            token: guestRes.access_token,
            user: guestRes.user,
            isGuest: true,
            isAuthenticated: false,
            isLoading: false,
          });
        } else {
          set({ isLoading: false });
        }

        return { success: true, message: res.message };
      } else {
        set({ isLoading: false });
        return { success: false, message: res.message || 'Failed to delete account' };
      }
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, message: err?.message || 'Error deleting account' };
    }
  },

  updatePreferences: async (preferences: Record<string, boolean>) => {
    const { token, user } = get();
    if (user) {
      const updatedUser = { ...user, topic_preferences: preferences };
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser)).catch(() => {});
      set({ user: updatedUser });
    }

    if (token) {
      const updated = await updateUserPreferences(token, preferences);
      if (updated) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated)).catch(() => {});
        set({ user: updated });
      }
    }
  },

  trackEvent: async (
    articleId: string,
    category: string,
    action: 'read' | 'dwell' | 'skip' | 'bookmark' | 'share' | 'full_roast',
    durationSeconds: number = 0.0
  ) => {
    const { token, user } = get();
    if (!token) return;

    try {
      const payload: TrackingEventPayload = {
        article_id: articleId,
        category,
        action,
        duration_seconds: durationSeconds,
      };

      const res = await trackUserEvent(token, payload);
      if (res && res.status === 'success' && res.algo_weights && user) {
        const updatedUser: UserProfile = {
          ...user,
          algo_weights: res.algo_weights,
          reading_count: user.reading_count + (['read', 'dwell', 'full_roast'].includes(action) ? 1 : 0),
        };
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser)).catch(() => {});
        set({ user: updatedUser });
      }
    } catch (err) {
      console.warn('[ZeroDaily UserStore] Tracking dispatch failed:', err);
    }
  },

  syncBookmarks: async (bookmarks: string[], mode: 'merge' | 'replace' = 'merge'): Promise<string[]> => {
    const { token, user } = get();
    if (!token) return bookmarks;

    const merged = await syncUserBookmarks(token, bookmarks, mode);
    if (user) {
      const updatedUser: UserProfile = { ...user, bookmarked_articles: merged };
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser)).catch(() => {});
      set({ user: updatedUser });
    }
    return merged;
  },
}));
