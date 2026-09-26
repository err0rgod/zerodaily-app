/**
 * ZeroDaily API Endpoints Contract
 * Mirrors the FastAPI backend specification from Docs.md.
 */

// Base URL for Cloudflare Edge Proxy (can be overridden via EXPO_PUBLIC_API_URL)
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.zerodaily.in';

export const ENDPOINTS = {
  /** GET /api/v1/feed?limit={limit}&cursor={cursor} */
  GLOBAL_FEED: `${API_BASE_URL}/api/v1/feed`,

  /** GET /api/v1/feed/{category}?limit={limit}&cursor={cursor} */
  CATEGORY_FEED: (category: string) => `${API_BASE_URL}/api/v1/feed/${encodeURIComponent(category)}`,

  /** GET /api/v1/article?id={id} */
  ARTICLE_BY_ID: (id: string) => `${API_BASE_URL}/api/v1/article?id=${encodeURIComponent(id)}`,

  /** GET /api/v1/categories */
  CATEGORIES: `${API_BASE_URL}/api/v1/categories`,

  /** GET /api/v1/notifications/history?limit={limit} */
  NOTIFICATION_HISTORY: `${API_BASE_URL}/api/v1/notifications/history`,

  /** POST /api/v1/notifications/subscribe */
  NOTIFICATIONS_SUBSCRIBE: `${API_BASE_URL}/api/v1/notifications/subscribe`,

  /** POST /api/v1/notifications/unsubscribe */
  NOTIFICATIONS_UNSUBSCRIBE: `${API_BASE_URL}/api/v1/notifications/unsubscribe`,

  /** GET /health */
  HEALTH: `${API_BASE_URL}/health`,

  /** Authentication & User Tracking Endpoints */
  AUTH_REGISTER: `${API_BASE_URL}/api/v1/auth/register`,
  AUTH_LOGIN: `${API_BASE_URL}/api/v1/auth/login`,
  AUTH_GUEST: `${API_BASE_URL}/api/v1/auth/guest`,
  AUTH_FIREBASE_LOGIN: `${API_BASE_URL}/api/v1/auth/firebase-login`,
  AUTH_ME: `${API_BASE_URL}/api/v1/auth/me`,
  AUTH_PREFERENCES: `${API_BASE_URL}/api/v1/auth/preferences`,
  AUTH_TRACK: `${API_BASE_URL}/api/v1/auth/track`,
  AUTH_SYNC_BOOKMARKS: `${API_BASE_URL}/api/v1/auth/sync-bookmarks`,
  AUTH_DELETE_ACCOUNT: `${API_BASE_URL}/api/v1/auth/account`,
} as const;

