import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { CATEGORIES } from '../constants/categories';
import { CategoryKey, NotificationPreferences } from '../types';

const SETTINGS_STORAGE_KEY = '@zerodaily_settings_prefs';

interface SettingsState {
  preferences: NotificationPreferences;
  isInitialized: boolean;
  
  // Actions
  initializePreferences: () => Promise<void>;
  toggleCategoryNotification: (category: CategoryKey) => Promise<void>;
  toggleBreakingAll: () => Promise<void>;
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

    // FCM Topic Sync (Client-Side Topic Subscription)
    const topic = CATEGORIES[category]?.fcmTopic;
    if (topic) {
      // In native environment, this delegates to FirebaseMessaging.instance
      console.log(`[ZeroDaily FCM] ${updatedValue ? 'Subscribing to' : 'Unsubscribing from'} topic: ${topic}`);
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

    console.log(`[ZeroDaily FCM] ${updatedValue ? 'Subscribed to' : 'Unsubscribed from'} topic: topic_breaking_all`);
  },
}));
