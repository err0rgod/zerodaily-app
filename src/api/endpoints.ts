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

  /** GET /api/v1/articles/{id:path} */
  ARTICLE_BY_ID: (id: string) => `${API_BASE_URL}/api/v1/articles/${encodeURIComponent(id)}`,

  /** GET /api/v1/categories */
  CATEGORIES: `${API_BASE_URL}/api/v1/categories`,

  /** GET /api/v1/notifications/history?limit={limit} */
  NOTIFICATION_HISTORY: `${API_BASE_URL}/api/v1/notifications/history`,

  /** GET /health */
  HEALTH: `${API_BASE_URL}/health`,
} as const;
