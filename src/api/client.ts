import { Article, CategoryKey, FeedResponse, NotificationHistoryResponse, SingleArticleResponse } from '../types';
import { ENDPOINTS } from './endpoints';
import { MOCK_ARTICLES, MOCK_NOTIFICATIONS } from './mockData';

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
    console.warn(`[ZeroDaily API] Feed fetch failed (${category}), falling back to mock:`, error);
    
    // Graceful fallback to mock data filtered by category
    const filtered = category === 'all'
      ? MOCK_ARTICLES
      : MOCK_ARTICLES.filter((item) => item.category === category);

    return {
      status: 'success',
      category: category === 'all' ? undefined : category,
      data: filtered,
      pagination: {
        has_more: false,
        next_cursor: null,
        count: filtered.length,
      },
    };
  }
}

/**
 * Fetch a single article by its canonical URL ID.
 * Conforms to GET /api/v1/articles/{id:path}.
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
    const found = MOCK_ARTICLES.find((a) => a.id === id);
    return found || null;
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
    console.warn('[ZeroDaily API] Notification history fetch failed, using fallback:', error);
    return {
      status: 'success',
      data: MOCK_NOTIFICATIONS,
      count: MOCK_NOTIFICATIONS.length,
    };
  }
}
