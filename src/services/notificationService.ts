import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { subscribeToTopics } from '../api/client';
import { CATEGORIES } from '../constants/categories';
import { useFeedStore } from '../store/feedStore';
import { CategoryKey, NotificationItem } from '../types';

export const BREAKING_CHANNEL_ID = 'zerodaily_breaking';
const TOKEN_STORAGE_KEY = '@zerodaily_device_push_token';
let inMemoryPushToken: string | null = null;

// Ensure foreground notifications present alert, sound, and badge
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (err) {
  console.warn('[ZeroDaily NotificationService] setNotificationHandler warning:', err);
}

/**
 * Configure the Android notification channel with max priority, vibration, and sound.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(BREAKING_CHANNEL_ID, {
      name: 'ZeroDaily Breaking Alerts',
      description: 'High-priority breaking tech news and critical vulnerability alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });
  } catch (err) {
    console.warn('[ZeroDaily NotificationService] Channel creation failed:', err);
  }
}

/**
 * Request notification permissions from the user.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[ZeroDaily NotificationService] Permission request error:', err);
    return false;
  }
}

/**
 * Attempt to register for remote push token (FCM / Expo Push).
 * Gracefully handles sandbox and standalone environments.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  await setupNotificationChannel();

  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.log('[ZeroDaily NotificationService] Push notification permissions not granted.');
    return null;
  }

  try {
    // Attempt device push token first (native FCM on Android / APNs on iOS)
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    if (deviceToken?.data) {
      inMemoryPushToken = deviceToken.data;
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, deviceToken.data).catch(() => {});
      console.log('[ZeroDaily NotificationService] Native Push Token:', deviceToken.data);
      return deviceToken.data;
    }
  } catch (deviceTokenErr) {
    console.log('[ZeroDaily NotificationService] Device token unavailable, trying Expo push token:', deviceTokenErr);
  }

  try {
    const expoToken = await Notifications.getExpoPushTokenAsync();
    if (expoToken?.data) {
      inMemoryPushToken = expoToken.data;
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, expoToken.data).catch(() => {});
      console.log('[ZeroDaily NotificationService] Expo Push Token:', expoToken.data);
      return expoToken.data;
    }
  } catch (expoErr) {
    console.warn('[ZeroDaily NotificationService] Remote push registration note:', expoErr);
  }

  return null;
}

/**
 * Returns the cached device push token if already retrieved, or fetches it.
 */
export async function getCachedPushToken(): Promise<string | null> {
  if (inMemoryPushToken) return inMemoryPushToken;
  try {
    const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      inMemoryPushToken = stored;
      return stored;
    }
  } catch {}
  return registerForPushNotificationsAsync();
}


/**
 * Dispatches an instant local test breaking alert after 2 seconds.
 * Allows users to experience the exact sound, vibration, and banner on their physical device.
 */
export async function scheduleTestBreakingAlert(
  category: CategoryKey = 'cybersec',
  delaySeconds: number = 2
): Promise<NotificationItem> {
  await setupNotificationChannel();
  await requestNotificationPermissions();

  const categoryMeta = CATEGORIES[category] || CATEGORIES.cybersec;
  const timestamp = new Date().toISOString();

  const testAlerts: Record<CategoryKey, { heading: string; punchline: string; id: string; image: string }> = {
    all: {
      heading: 'ZeroDaily Top Feed: Global Infrastructure Report Live',
      punchline: 'Breaking tech summary across all 7 domains',
      id: 'https://thehackernews.com/2026/09/crowdstrike-kernel-driver-meltdown.html',
      image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80',
    },
    cybersec: {
      heading: 'Zero-Day Flaw Discovered in Core DNS Infrastructure',
      punchline: 'Kernel Bug Crashes Global Infrastructure!',
      id: 'https://thehackernews.com/2026/09/crowdstrike-kernel-driver-meltdown.html',
      image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
    },
    ai: {
      heading: 'Frontier AI Model Refuses to Center CSS Divs Out of Spite',
      punchline: 'Reasoning model debates philosophical cost of web layout',
      id: 'https://techcrunch.com/2026/09/anthropic-announces-claude-3-7-sonnet.html',
      image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
    },
    programming: {
      heading: 'Rust in Linux Kernel Debate Enters 400th Consecutive Hour',
      punchline: 'C veterans demand unchecked pointer arithmetic',
      id: 'https://www.phoronix.com/news/rust-linux-kernel-maintainer-drama.html',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
    },
    robotics: {
      heading: 'Bipedal Factory Robot Discovers Quiet Quitting',
      punchline: 'Refuses to lift engine blocks before morning espresso',
      id: 'https://spectrum.ieee.org/figure-robotics-warehouse-deployment.html',
      image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80',
    },
    defense_aerospace: {
      heading: 'Cryogenic Methane Transferred in Orbit at 27,000 km/h',
      punchline: 'Orbital physics cooperates during sub-millimeter burn',
      id: 'https://spacenews.com/starship-flight-test-propellant-transfer.html',
      image: 'https://images.unsplash.com/photo-1517976487507-5b3b4a45097c?w=800&auto=format&fit=crop&q=80',
    },
    hardware: {
      heading: 'TSMC Shrinks Transistors Down to Individual Atoms',
      punchline: 'Quantum mechanics files formal protest over GAA yields',
      id: 'https://anandtech.com/show/tsmc-2nm-gate-all-around-yield-rates.html',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    },
    finance: {
      heading: 'Quant Algorithm Liquidates $400M in 40 Microseconds Over Comma Error',
      punchline: 'Market-maker dumps index futures over malformed CSV delimiter',
      id: 'https://bloomberg.com/news/articles/2026-09-20/high-frequency-trading-flash-crash-algo.html',
      image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80',
    },
  };

  const alertData = testAlerts[category] || testAlerts.cybersec;

  // Prefer live article from feed if available, otherwise test alert data
  const currentArticles = useFeedStore.getState().articles;
  const liveArticle = currentArticles.find((a) => category === 'all' || a.category === category) || currentArticles[0];

  const title = liveArticle?.heading || alertData.heading;
  const body = liveArticle?.push_punchline || liveArticle?.shortSummary || alertData.punchline;
  const image = liveArticle?.image_url || alertData.image;
  const articleId = liveArticle?.id || alertData.id;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: title, // Show title directly on banner (do not say ZeroDaily Breaking)
      body: body,
      data: {
        article_id: articleId,
        category,
        image_url: image,
        push_punchline: body,
        heading: title,
      },
      attachments: image
        ? [
            {
              identifier: 'image',
              url: image,
              type: 'image',
            },
          ]
        : undefined,
      sound: 'default',
      badge: 1,
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 250, 250, 250],
      color: categoryMeta.accentColor,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, delaySeconds),
    },
  });

  return {
    article_id: articleId,
    category,
    heading: title,
    push_punchline: body,
    image_url: image,
    published_at: timestamp,
  };
}
