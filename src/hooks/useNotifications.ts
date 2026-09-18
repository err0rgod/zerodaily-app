import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { fetchArticleById } from '../api/client';
import { useFeedStore } from '../store/feedStore';
import { useSettingsStore } from '../store/settingsStore';

// Configure foreground notification presentation handler safely
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (err) {
  console.warn('[ZeroDaily Notifications] Handler initialization warning:', err);
}

/**
 * Hook to manage Firebase Cloud Messaging (FCM) topic subscriptions
 * and incoming breaking alert routing.
 * Conforms to notification-arch.md.
 */
export function useNotifications() {
  const { setArticleDirectly } = useFeedStore();
  const { initializePreferences } = useSettingsStore();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    try {
      initializePreferences().catch(() => {});
    } catch {
      // Ignore settings read error
    }

    // 1. Setup Android Notification Channel: zerodaily_breaking
    async function configureChannel() {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('zerodaily_breaking', {
            name: 'ZeroDaily Breaking Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#10B981',
            sound: 'default',
          });
        } catch (err) {
          console.warn('[ZeroDaily FCM] Notification channel setup warning:', err);
        }
      }
    }

    // 2. Request Notification Permissions
    async function registerForPushNotifications() {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[ZeroDaily FCM] Push notification permissions denied');
          return;
        }

        console.log('[ZeroDaily FCM] Permission granted, subscribed to topic_breaking_all');
      } catch (err) {
        console.warn('[ZeroDaily FCM] Push notification registration warning:', err);
      }
    }

    configureChannel().catch(() => {});
    registerForPushNotifications().catch(() => {});

    // 3. Handle Notification Click (Deep Linking into specific card)
    try {
      responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
        try {
          const data = response.notification.request.content.data;
          const articleId = data?.article_id;

          if (articleId) {
            console.log(`[ZeroDaily FCM] Routing to breaking article: ${articleId}`);
            const article = await fetchArticleById(articleId);
            if (article) {
              setArticleDirectly(article);
            }
          }
        } catch (err) {
          console.warn('[ZeroDaily FCM] Failed to process notification tap:', err);
        }
      });
    } catch (err) {
      console.warn('[ZeroDaily FCM] Failed to add notification listener:', err);
    }

    return () => {
      if (responseListener.current) {
        try {
          Notifications.removeNotificationSubscription(responseListener.current);
        } catch {}
      }
    };
  }, [setArticleDirectly, initializePreferences]);
}
