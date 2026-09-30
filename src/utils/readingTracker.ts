import AsyncStorage from '@react-native-async-storage/async-storage';
import { Article } from '../types';

export const READ_HISTORY_STORAGE_KEY = '@zerodaily_read_history';
export const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type ArticleReadStatus = 'read' | 'skipped';

export interface ReadHistoryEntry {
  id: string;
  category: string;
  status: ArticleReadStatus;
  dwellSec: number;
  timestamp: number;
}

// In-memory cache for O(1) instantaneous lookups during rendering and filtering
const readHistoryCache = new Map<string, ReadHistoryEntry>();
const readArticleIds = new Set<string>();

let loadPromise: Promise<void> | null = null;

/**
 * Ensures history has been loaded into memory from AsyncStorage.
 */
export function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(READ_HISTORY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const entries: ReadHistoryEntry[] = Array.isArray(parsed)
            ? parsed
            : Object.values(parsed);

          const now = Date.now();
          for (const entry of entries) {
            if (
              entry &&
              entry.id &&
              typeof entry.timestamp === 'number' &&
              now - entry.timestamp <= HISTORY_RETENTION_MS
            ) {
              readHistoryCache.set(entry.id, entry);
              if (entry.status === 'read') {
                readArticleIds.add(entry.id);
              }
            }
          }
        }
      } catch {
        // Fallback gracefully on disk read error
      }
    })();
  }
  return loadPromise;
}

// Automatically initiate load on module import
ensureLoaded();

/**
 * Persists in-memory read history to AsyncStorage.
 */
async function persistHistory(): Promise<void> {
  try {
    const list = Array.from(readHistoryCache.values());
    await AsyncStorage.setItem(READ_HISTORY_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Disk write fallback
  }
}

/**
 * Marks an article as read (dwell duration >= 4.0s or full roast modal opened).
 * Synchronously updates the in-memory cache and asynchronously persists to storage.
 */
export async function markArticleAsRead(
  id: string,
  category: string = 'all',
  dwellSec: number = 4.0
): Promise<void> {
  if (!id) return;
  await ensureLoaded();

  readArticleIds.add(id);
  readHistoryCache.set(id, {
    id,
    category,
    status: 'read',
    dwellSec: Math.max(0, dwellSec),
    timestamp: Date.now(),
  });

  await persistHistory();
}

/**
 * Marks an article as skipped (viewed for < 4.0s).
 * Will NOT overwrite or downgrade an article that is already marked as 'read'.
 */
export async function markArticleAsSkipped(
  id: string,
  category: string = 'all',
  dwellSec: number = 0.5
): Promise<void> {
  if (!id) return;
  await ensureLoaded();

  // If already marked as read, preserve read status
  if (readArticleIds.has(id)) {
    return;
  }

  readHistoryCache.set(id, {
    id,
    category,
    status: 'skipped',
    dwellSec: Math.max(0, dwellSec),
    timestamp: Date.now(),
  });

  await persistHistory();
}

/**
 * Synchronous check whether an article has been consumed/read.
 */
export function isArticleRead(id: string): boolean {
  if (!id) return false;
  return readArticleIds.has(id);
}

/**
 * Filters out all articles that have been marked as read.
 * Synchronous and O(N) using the in-memory Set.
 */
export function filterUnreadArticles(articles: Article[]): Article[] {
  if (!articles || articles.length === 0) return [];
  return articles.filter((article) => !readArticleIds.has(article.id));
}

/**
 * Asynchronously returns a copy of the read article IDs Set,
 * ensuring storage has completed loading.
 */
export async function getReadArticleIds(): Promise<Set<string>> {
  await ensureLoaded();
  return new Set(readArticleIds);
}

/**
 * Auto-prunes entries older than the retention period (default: 30 days).
 */
export async function clearOldHistory(maxAgeDays: number = 30): Promise<void> {
  await ensureLoaded();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let changed = false;

  for (const [id, entry] of readHistoryCache.entries()) {
    if (now - entry.timestamp > maxAgeMs) {
      readHistoryCache.delete(id);
      readArticleIds.delete(id);
      changed = true;
    }
  }

  if (changed) {
    await persistHistory();
  }
}

/**
 * Clears all read/skipped history both from memory and AsyncStorage (useful for testing and debug resets).
 */
export async function clearAllHistory(): Promise<void> {
  readHistoryCache.clear();
  readArticleIds.clear();
  loadPromise = Promise.resolve();
  try {
    await AsyncStorage.removeItem(READ_HISTORY_STORAGE_KEY);
  } catch {
    // Disk removal fallback
  }
}

/**
 * Returns all history entries currently in memory.
 */
export function getAllHistory(): ReadHistoryEntry[] {
  return Array.from(readHistoryCache.values());
}

export const readingTracker = {
  markArticleAsRead,
  markArticleAsSkipped,
  isArticleRead,
  filterUnreadArticles,
  getReadArticleIds,
  clearOldHistory,
  clearAllHistory,
  ensureLoaded,
  getAllHistory,
};

export default readingTracker;
