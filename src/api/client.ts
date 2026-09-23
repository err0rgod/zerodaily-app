import { Article, CategoryKey, FeedResponse, NotificationHistoryResponse, SingleArticleResponse } from '../types';
import { ENDPOINTS } from './endpoints';

const REQUEST_TIMEOUT_MS = 6000;

/**
 * Custom fetch wrapper with configurable timeout and error handling.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ZeroDaily-Mobile/1.0',
        ...(options.headers || {}),
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch feed articles (Global or Category-specific).
 * Conforms to GET /api/v1/feed and GET /api/v1/feed/{category}.
 */
export async function fetchFeed(
  category: CategoryKey = 'all',
  cursor?: string,
  limit: number = 20
): Promise<FeedResponse> {
  const url = category === 'all'
    ? new URL(ENDPOINTS.GLOBAL_FEED)
    : new URL(ENDPOINTS.CATEGORY_FEED(category));

  url.searchParams.set('limit', String(limit));
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  try {
    const response = await fetchWithTimeout(url.toString());

    if (!response.ok) {
      throw new Error(`API Feed Error: ${response.status} ${response.statusText}`);
    }

    const json: FeedResponse = await response.json();
    return json;
  } catch (error) {
    console.warn(`[ZeroDaily API] Feed fetch failed (${category}):`, error);

    return {
      status: 'error',
      category: category === 'all' ? undefined : category,
      data: [],
      pagination: {
        has_more: false,
        next_cursor: null,
        count: 0,
      },
    };
  }
}

/**
 * Fetch a single article by its canonical URL ID.
 * Conforms to GET /api/v1/article?id={id}.
 */
export async function fetchArticleById(id: string): Promise<Article | null> {
  try {
    const url = ENDPOINTS.ARTICLE_BY_ID(id);
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`API Article Error: ${response.status}`);
    }

    const json: SingleArticleResponse = await response.json();
    return json.data;
  } catch (error) {
    console.warn(`[ZeroDaily API] Article fetch failed for ${id}:`, error);
    return null;
  }
}

/**
 * Fetch breaking notification alerts history.
 * Conforms to GET /api/v1/notifications/history.
 */
export async function fetchNotificationHistory(limit: number = 20): Promise<NotificationHistoryResponse> {
  try {
    const url = new URL(ENDPOINTS.NOTIFICATION_HISTORY);
    url.searchParams.set('limit', String(limit));

    const response = await fetchWithTimeout(url.toString());

    if (!response.ok) {
      throw new Error(`API Notification Error: ${response.status}`);
    }

    const json: NotificationHistoryResponse = await response.json();
    return json;
  } catch (error) {
    console.warn('[ZeroDaily API] Notification history fetch failed:', error);
    return {
      status: 'error',
      data: [],
      count: 0,
    };
  }
}

/**
 * Subscribes a device registration token to FCM topics on the backend.
 * Conforms to POST /api/v1/notifications/subscribe.
 */
export async function subscribeToTopics(token: string, topics: string[]): Promise<boolean> {
  if (!token || !topics.length) return false;
  try {
    const response = await fetchWithTimeout(ENDPOINTS.NOTIFICATIONS_SUBSCRIBE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, topics }),
    });
    return response.ok;
  } catch (error) {
    console.warn('[ZeroDaily API] subscribeToTopics failed:', error);
    return false;
  }
}

/**
 * Unsubscribes a device registration token from FCM topics on the backend.
 * Conforms to POST /api/v1/notifications/unsubscribe.
 */
export async function unsubscribeFromTopics(token: string, topics: string[]): Promise<boolean> {
  if (!token || !topics.length) return false;
  try {
    const response = await fetchWithTimeout(ENDPOINTS.NOTIFICATIONS_UNSUBSCRIBE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, topics }),
    });
    return response.ok;
  } catch (error) {
    console.warn('[ZeroDaily API] unsubscribeFromTopics failed:', error);
    return false;
  }
}

