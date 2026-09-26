import {
  AccountDeletionResult,
  Article,
  AuthResponse,
  CategoryKey,
  FeedResponse,
  NotificationHistoryResponse,
  SingleArticleResponse,
  SyncBookmarksResponse,
  TrackingEventPayload,
  TrackingResponse,
  UserProfile,
} from '../types';
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

/**
 * Register a permanent user account.
 * Conforms to POST /api/v1/auth/register.
 */
export async function registerUser(
  email: string,
  password: string,
  displayName?: string,
  guestUserId?: string
): Promise<AuthResponse> {
  try {
    const response = await fetchWithTimeout(ENDPOINTS.AUTH_REGISTER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        display_name: displayName,
        guest_user_id: guestUserId,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      return {
        status: 'error',
        access_token: '',
        token_type: 'bearer',
        user: {} as UserProfile,
        message: json?.detail || 'Registration failed. Please check credentials.',
      };
    }
    return json;
  } catch (error: any) {
    return {
      status: 'error',
      access_token: '',
      token_type: 'bearer',
      user: {} as UserProfile,
      message: error?.message || 'Network error during registration.',
    };
  }
}

/**
 * Log in to an existing account with email & password.
 * Conforms to POST /api/v1/auth/login.
 */
export async function loginUser(
  email: string,
  password: string,
  guestUserId?: string
): Promise<AuthResponse> {
  try {
    const response = await fetchWithTimeout(ENDPOINTS.AUTH_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        guest_user_id: guestUserId,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      return {
        status: 'error',
        access_token: '',
        token_type: 'bearer',
        user: {} as UserProfile,
        message: json?.detail || 'Invalid email or password.',
      };
    }
    return json;
  } catch (error: any) {
    return {
      status: 'error',
      access_token: '',
      token_type: 'bearer',
      user: {} as UserProfile,
      message: error?.message || 'Network error during login.',
    };
  }
}

/**
 * Exchanges a Firebase Auth ID token for a ZeroDaily user session.
 * Conforms to POST /api/v1/auth/firebase-login.
 */
export async function loginWithFirebase(
  idToken: string,
  guestUserId?: string
): Promise<AuthResponse> {
  try {
    const response = await fetchWithTimeout(ENDPOINTS.AUTH_FIREBASE_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: idToken,
        guest_user_id: guestUserId,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      return {
        status: 'error',
        access_token: '',
        token_type: 'bearer',
        user: {} as UserProfile,
        message: json?.detail || 'Failed to authenticate with Firebase.',
      };
    }
    return json;
  } catch (error: any) {
    return {
      status: 'error',
      access_token: '',
      token_type: 'bearer',
      user: {} as UserProfile,
      message: error?.message || 'Network error during Firebase authentication.',
    };
  }
}

/**
 * Creates an anonymous guest user account for immediate feed personalization.
 * Conforms to POST /api/v1/auth/guest.
 */
export async function createGuestSession(
  deviceId?: string,
  initialPreferences?: Record<string, boolean>
): Promise<AuthResponse> {
  try {
    const response = await fetchWithTimeout(ENDPOINTS.AUTH_GUEST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        initial_preferences: initialPreferences,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      return {
        status: 'error',
        access_token: '',
        token_type: 'bearer',
        user: {} as UserProfile,
        message: json?.detail || 'Failed to create guest session.',
      };
    }
    return json;
  } catch (error: any) {
    return {
      status: 'error',
      access_token: '',
      token_type: 'bearer',
      user: {} as UserProfile,
      message: error?.message || 'Network error creating guest session.',
    };
  }
}

export interface CurrentUserResult {
  user: UserProfile | null;
  isUnauthorized: boolean;
  isNetworkError: boolean;
}

/**
 * Validates session token and fetches profile with explicit status indicators:
 * isUnauthorized: true if token is 401 (expired/invalid).
 * isNetworkError: true if offline or network failure occurred (session should NOT be cleared).
 */
export async function fetchCurrentUserResult(token: string): Promise<CurrentUserResult> {
  if (!token) {
    return { user: null, isUnauthorized: true, isNetworkError: false };
  }
  try {
    const response = await fetchWithTimeout(ENDPOINTS.AUTH_ME, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      return { user: null, isUnauthorized: true, isNetworkError: false };
    }
    if (!response.ok) {
      return { user: null, isUnauthorized: false, isNetworkError: true };
    }

    const json: UserProfile = await response.json();
    return { user: json, isUnauthorized: false, isNetworkError: false };
  } catch (error) {
    console.warn('[ZeroDaily API] fetchCurrentUser failed:', error);
    return { user: null, isUnauthorized: false, isNetworkError: true };
  }
}

/**
 * Fetch the authenticated user's profile and algorithmic status.
 * Conforms to GET /api/v1/auth/me.
 */
export async function fetchCurrentUser(token: string): Promise<UserProfile | null> {
  const res = await fetchCurrentUserResult(token);
  return res.user;
}

/**
 * Updates user category topic preferences.
 * Conforms to PATCH /api/v1/auth/preferences.
 */
export async function updateUserPreferences(
  token: string,
  preferences: Record<string, boolean>
): Promise<UserProfile | null> {
  if (!token) return null;
  try {
    const response = await fetchWithTimeout(ENDPOINTS.AUTH_PREFERENCES, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ topic_preferences: preferences }),
    });

    if (!response.ok) return null;
    const json: UserProfile = await response.json();
    return json;
  } catch (error) {
    console.warn('[ZeroDaily API] updateUserPreferences failed:', error);
    return null;
  }
}

/**
 * Dispatches a reading or interaction event to the user personalization algorithm.
 * Conforms to POST /api/v1/auth/track.
 */
export async function trackUserEvent(
  token: string,
  payload: TrackingEventPayload
): Promise<TrackingResponse | null> {
  if (!token) return null;
  try {
    const response = await fetchWithTimeout(ENDPOINTS.AUTH_TRACK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return null;
    const json: TrackingResponse = await response.json();
    return json;
  } catch (error) {
    console.warn('[ZeroDaily API] trackUserEvent failed:', error);
    return null;
  }
}

/**
 * Syncs local saved bookmarks with the user's DynamoDB profile.
 * mode="merge" performs union; mode="replace" overwrites.
 * Conforms to POST /api/v1/auth/sync-bookmarks.
 */
export async function syncUserBookmarks(
  token: string,
  bookmarks: string[],
  mode: 'merge' | 'replace' = 'merge'
): Promise<string[]> {
  if (!token) return bookmarks;
  try {
    const response = await fetchWithTimeout(ENDPOINTS.AUTH_SYNC_BOOKMARKS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ bookmarks, mode }),
    });

    if (!response.ok) return bookmarks;
    const json: SyncBookmarksResponse = await response.json();
    return json.bookmarks || bookmarks;
  } catch (error) {
    console.warn('[ZeroDaily API] syncUserBookmarks failed:', error);
    return bookmarks;
  }
}

/**
 * Schedules account deletion with a 1-day (24-hour) recovery grace period.
 * Conforms to DELETE /api/v1/auth/account.
 */
export async function deleteUserAccount(token: string): Promise<AccountDeletionResult> {
  if (!token) {
    return { status: 'error', message: 'No authentication token provided.' };
  }
  try {
    const response = await fetchWithTimeout(ENDPOINTS.AUTH_DELETE_ACCOUNT, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await response.json();
    if (!response.ok) {
      return {
        status: 'error',
        message: json?.detail || 'Failed to request account deletion.',
      };
    }
    return json;
  } catch (error: any) {
    return {
      status: 'error',
      message: error?.message || 'Network error requesting account deletion.',
    };
  }
}

