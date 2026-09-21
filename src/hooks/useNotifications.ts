import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { fetchArticleById, fetchNotificationHistory } from '../api/client';
import { MOCK_ARTICLES } from '../api/mockData';
import {
  registerForPushNotificationsAsync,
  setupNotificationChannel,
} from '../services/notificationService';
import { useFeedStore } from '../store/feedStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSettingsStore } from '../store/settingsStore';
import { Article, CategoryKey, NotificationItem } from '../types';

interface UseNotificationsOptions {
  onArticleSelected?: (article: Article) => void;
}

/**
 * Hook to manage:
 * 1. FCM topic subscriptions & Android notification channel creation
 * 2. Real-time incoming notification listeners & unread badge updates
 * 3. Deep-link routing on notification tap directly to article card
 * 4. Periodic background check for breaking news alerts
 */
export function useNotifications(options?: UseNotificationsOptions) {
  const { setArticleDirectly } = useFeedStore();
  const { initializePreferences, preferences } = useSettingsStore();
  const { addIncomingNotification, markAsRead, loadNotifications } = useNotificationStore();

  const responseListener = useRef<Notifications.Subscription>();
  const receivedListener = useRef<Notifications.Subscription>();
  const lastAlertTimestampRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    // 1. Initialize settings & notifications
    initializePreferences().catch(() => {});
    loadNotifications().catch(() => {});

    // 2. Setup channel & request remote push token
    setupNotificationChannel().catch(() => {});
    registerForPushNotificationsAsync().catch(() => {});

    // 3. Foreground Notification Received Listener (App is Open)
    try {
      receivedListener.current = Notifications.addNotificationReceivedListener((notification) => {
        try {
          const data = notification.request.content.data;
          const articleId = data?.article_id as string;
          const category = (data?.category || 'cybersec') as CategoryKey;
          const punchline = (data?.push_punchline || notification.request.content.body || '') as string;
          const heading = (notification.request.content.title || punchline) as string;
          const imageUrl = (data?.image_url || '') as string;

          if (articleId) {
            const incomingItem: NotificationItem = {
              article_id: articleId,
              category,
              heading,
              push_punchline: punchline,
              image_url: imageUrl,
              published_at: new Date().toISOString(),
            };
            addIncomingNotification(incomingItem);
          }
        } catch (err) {
          console.warn('[ZeroDaily Notifications] Failed to process incoming alert:', err);
        }
      });
    } catch (err) {
      console.warn('[ZeroDaily Notifications] Failed to register received listener:', err);
    }

    // 4. Notification Response Handler (User Tapped Notification Banner)
    const handleNotificationTap = async (response: Notifications.NotificationResponse) => {
      try {
        const content = response.notification.request.content;
        const data = content.data;
        const articleId = (data?.article_id || '') as string;

        if (articleId) {
          console.log(`[ZeroDaily Notifications] Deep-linking to article: ${articleId}`);
          await markAsRead(articleId);

          // 1. Instant local feed or mock search
          const { articles } = useFeedStore.getState();
          let article =
            articles.find((a) => a.id === articleId) ||
            MOCK_ARTICLES.find((a) => a.id === articleId);

          // 2. Immediate resilient fallback from notification payload
          if (!article) {
            const heading = content.title || (data?.heading as string) || 'Breaking News';
            const punchline = (data?.push_punchline as string) || content.body || '';
            const category = (data?.category || 'cybersec') as CategoryKey;
            const imageUrl = (data?.image_url as string) || '';
            const link = (data?.link as string) || (articleId.startsWith('http') ? articleId : 'https://zerodaily.in');

            article = {
              id: articleId,
              category,
              heading,
              shortSummary: punchline,
              fullSummary: punchline,
              published_at: new Date().toISOString(),
              link,
              image_url: imageUrl,
              is_breaking: true,
            };
          }

          // 3. Immediately focus article and notify UI to close modals
          setArticleDirectly(article);
          options?.onArticleSelected?.(article);

          // 4. Background fetch for any richer summary if available
          fetchArticleById(articleId)
            .then((fresh) => {
              if (fresh) {
                setArticleDirectly(fresh);
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        console.warn('[ZeroDaily Notifications] Failed to route notification tap:', err);
      }
    };

    try {
      // Background / Foreground tap listener
      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationTap);

      // Cold start tap listener (app was killed when notification was tapped)
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            handleNotificationTap(response);
          }
        })
        .catch(() => {});
    } catch (err) {
      console.warn('[ZeroDaily Notifications] Failed to register response listener:', err);
    }

    // 5. Periodic & AppState Resume Breaking News Checker
    const checkBreakingAlerts = async () => {
      try {
        const history = await fetchNotificationHistory(5);
        if (history?.data && history.data.length > 0) {
          const newest = history.data[0];
          const newestTime = new Date(newest.published_at).getTime();
          const lastTime = new Date(lastAlertTimestampRef.current).getTime();

          if (newestTime > lastTime) {
            lastAlertTimestampRef.current = newest.published_at;

            // Check if user is interested in this category
            const isCategoryActive = preferences[newest.category] ?? true;
            const isBreakingAllActive = preferences.breaking_all ?? true;

            if (isCategoryActive || isBreakingAllActive) {
              addIncomingNotification(newest);
            }
          }
        }
      } catch {
        // Silently ignore background polling errors
      }
    };

    // Check when user returns to app
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkBreakingAlerts().catch(() => {});
      }
    });

    // Check every 4 minutes while app is running
    const pollInterval = setInterval(() => {
      checkBreakingAlerts().catch(() => {});
    }, 4 * 60 * 1000);

    return () => {
      if (receivedListener.current) {
        try {
          Notifications.removeNotificationSubscription(receivedListener.current);
        } catch {}
      }
      if (responseListener.current) {
        try {
          Notifications.removeNotificationSubscription(responseListener.current);
        } catch {}
      }
      appStateSub.remove();
      clearInterval(pollInterval);
    };
  }, [setArticleDirectly, initializePreferences, loadNotifications, addIncomingNotification, markAsRead, preferences]);
}
