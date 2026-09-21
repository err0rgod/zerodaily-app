import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { subscribeToTopics, unsubscribeFromTopics } from '../api/client';
import { CATEGORIES } from '../constants/categories';
import { getCachedPushToken } from '../services/notificationService';
import { CategoryKey, NotificationPreferences } from '../types';

const SETTINGS_STORAGE_KEY = '@zerodaily_settings_prefs';

interface SettingsState {
  preferences: NotificationPreferences;
  isInitialized: boolean;
  
  // Actions
  initializePreferences: () => Promise<void>;
  toggleCategoryNotification: (category: CategoryKey) => Promise<void>;
  toggleBreakingAll: () => Promise<void>;
  setInitialCategories: (categories: CategoryKey[]) => Promise<void>;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  breaking_all: true,
  all: true,
  cybersec: true,
  ai: true,
  programming: true,
  robotics: false,
  defense_aerospace: false,
  hardware: false,
  finance: false,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  preferences: DEFAULT_PREFERENCES,
  isInitialized: false,

  initializePreferences: async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ preferences: { ...DEFAULT_PREFERENCES, ...parsed }, isInitialized: true });
        return;
      }
    } catch {
      // Fallback to default
    }
    set({ preferences: DEFAULT_PREFERENCES, isInitialized: true });
  },

  toggleCategoryNotification: async (category: CategoryKey) => {
    const { preferences } = get();
    const updatedValue = !preferences[category];
    const updatedPrefs: NotificationPreferences = {
      ...preferences,
      [category]: updatedValue,
    };

    set({ preferences: updatedPrefs });
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedPrefs));

    // Synchronize subscription with backend
    const topic = CATEGORIES[category]?.fcmTopic;
    if (topic) {
      const token = await getCachedPushToken();
      if (token) {
        if (updatedValue) {
          await subscribeToTopics(token, [topic]);
        } else {
          await unsubscribeFromTopics(token, [topic]);
        }
      }
    }
  },

  toggleBreakingAll: async () => {
    const { preferences } = get();
    const updatedValue = !preferences.breaking_all;
    const updatedPrefs: NotificationPreferences = {
      ...preferences,
      breaking_all: updatedValue,
    };

    set({ preferences: updatedPrefs });
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedPrefs));

    const token = await getCachedPushToken();
    if (token) {
      if (updatedValue) {
        await subscribeToTopics(token, ['topic_breaking_all']);
      } else {
        await unsubscribeFromTopics(token, ['topic_breaking_all']);
      }
    }
  },

  setInitialCategories: async (categories: CategoryKey[]) => {
    const updatedPrefs: NotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      breaking_all: true,
      all: true,
      cybersec: categories.includes('cybersec'),
      ai: categories.includes('ai'),
      programming: categories.includes('programming'),
      robotics: categories.includes('robotics'),
      defense_aerospace: categories.includes('defense_aerospace'),
      hardware: categories.includes('hardware'),
      finance: categories.includes('finance'),
    };

    set({ preferences: updatedPrefs });
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedPrefs));

    const topics: string[] = ['topic_breaking_all'];
    for (const cat of categories) {
      const topic = CATEGORIES[cat]?.fcmTopic;
      if (topic && !topics.includes(topic)) {
        topics.push(topic);
      }
    }

    const token = await getCachedPushToken();
    if (token) {
      await subscribeToTopics(token, topics);
    }
  },
}));

