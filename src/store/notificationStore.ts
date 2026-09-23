import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { fetchNotificationHistory } from '../api/client';
import { CategoryKey, NotificationItem } from '../types';

const STORAGE_KEY_READ = '@zerodaily_read_alerts_v1';
const STORAGE_KEY_DISMISSED = '@zerodaily_dismissed_alerts_v1';

export interface NotificationState {
  notifications: NotificationItem[];
  readIds: Set<string>;
  dismissedIds: Set<string>;
  unreadCount: number;
  hasUnread: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  selectedCategory: CategoryKey | 'all';

  // Actions
  loadNotifications: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAsRead: (articleId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (articleId: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  setSelectedCategory: (category: CategoryKey | 'all') => void;
  addIncomingNotification: (item: NotificationItem) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  readIds: new Set<string>(),
  dismissedIds: new Set<string>(),
  unreadCount: 0,
  hasUnread: false,
  isLoading: false,
  isRefreshing: false,
  selectedCategory: 'all',

  loadNotifications: async () => {
    set({ isLoading: true });
    try {
      // 1. Restore persistent read and dismissed sets
      const [storedRead, storedDismissed] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_READ),
        AsyncStorage.getItem(STORAGE_KEY_DISMISSED),
      ]);

      const readIds = new Set<string>(storedRead ? JSON.parse(storedRead) : []);
      const dismissedIds = new Set<string>(storedDismissed ? JSON.parse(storedDismissed) : []);

      // 2. Fetch recent alerts from backend
      let fetchedAlerts: NotificationItem[] = [];
      try {
        const response = await fetchNotificationHistory(30);
        if (response?.data && response.data.length > 0) {
          fetchedAlerts = response.data;
        }
      } catch {
        // Network unavailable or server down
      }

      // Filter out user-dismissed alerts
      const visible = fetchedAlerts.filter((item) => !dismissedIds.has(item.article_id));
      const unreadCount = visible.filter((item) => !readIds.has(item.article_id)).length;

      set({
        notifications: visible,
        readIds,
        dismissedIds,
        unreadCount,
        hasUnread: unreadCount > 0,
        isLoading: false,
      });
    } catch (err) {
      console.warn('[ZeroDaily NotificationStore] Load failed:', err);
      set({ isLoading: false });
    }
  },

  refreshNotifications: async () => {
    set({ isRefreshing: true });
    try {
      const { readIds, dismissedIds } = get();
      const response = await fetchNotificationHistory(30);
      const fetchedAlerts = response?.data || [];

      const visible = fetchedAlerts.filter((item) => !dismissedIds.has(item.article_id));
      const unreadCount = visible.filter((item) => !readIds.has(item.article_id)).length;

      set({
        notifications: visible,
        unreadCount,
        hasUnread: unreadCount > 0,
        isRefreshing: false,
      });
    } catch {
      set({ isRefreshing: false });
    }
  },

  markAsRead: async (articleId: string) => {
    const { readIds, notifications } = get();
    if (readIds.has(articleId)) return;

    const newRead = new Set(readIds);
    newRead.add(articleId);

    const unreadCount = notifications.filter((item) => !newRead.has(item.article_id)).length;

    set({
      readIds: newRead,
      unreadCount,
      hasUnread: unreadCount > 0,
    });

    try {
      await AsyncStorage.setItem(STORAGE_KEY_READ, JSON.stringify(Array.from(newRead)));
    } catch (err) {
      console.warn('[ZeroDaily NotificationStore] Persist readIds failed:', err);
    }
  },

  markAllAsRead: async () => {
    const { notifications, readIds } = get();
    const newRead = new Set(readIds);
    notifications.forEach((item) => newRead.add(item.article_id));

    set({
      readIds: newRead,
      unreadCount: 0,
      hasUnread: false,
    });

    try {
      await AsyncStorage.setItem(STORAGE_KEY_READ, JSON.stringify(Array.from(newRead)));
    } catch (err) {
      console.warn('[ZeroDaily NotificationStore] Persist markAllAsRead failed:', err);
    }
  },

  dismissNotification: async (articleId: string) => {
    const { notifications, readIds, dismissedIds } = get();
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(articleId);

    const updatedList = notifications.filter((item) => item.article_id !== articleId);
    const unreadCount = updatedList.filter((item) => !readIds.has(item.article_id)).length;

    set({
      notifications: updatedList,
      dismissedIds: newDismissed,
      unreadCount,
      hasUnread: unreadCount > 0,
    });

    try {
      await AsyncStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify(Array.from(newDismissed)));
    } catch (err) {
      console.warn('[ZeroDaily NotificationStore] Persist dismissedIds failed:', err);
    }
  },

  clearAllNotifications: async () => {
    const { notifications, dismissedIds } = get();
    const newDismissed = new Set(dismissedIds);
    notifications.forEach((item) => newDismissed.add(item.article_id));

    set({
      notifications: [],
      dismissedIds: newDismissed,
      unreadCount: 0,
      hasUnread: false,
    });

    try {
      await AsyncStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify(Array.from(newDismissed)));
    } catch (err) {
      console.warn('[ZeroDaily NotificationStore] Persist clearAll failed:', err);
    }
  },

  setSelectedCategory: (category: CategoryKey | 'all') => {
    set({ selectedCategory: category });
  },

  addIncomingNotification: async (item: NotificationItem) => {
    const { notifications, readIds, dismissedIds } = get();
    if (dismissedIds.has(item.article_id)) return;

    // Prepend or update
    const filtered = notifications.filter((n) => n.article_id !== item.article_id);
    const updatedList = [item, ...filtered];
    const unreadCount = updatedList.filter((n) => !readIds.has(n.article_id)).length;

    set({
      notifications: updatedList,
      unreadCount,
      hasUnread: unreadCount > 0,
    });
  },
}));
