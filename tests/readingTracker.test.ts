import {
  clearAllHistory,
  clearOldHistory,
  ensureLoaded,
  filterUnreadArticles,
  getReadArticleIds,
  isArticleRead,
  markArticleAsRead,
  markArticleAsSkipped,
  readingTracker,
  READ_HISTORY_STORAGE_KEY,
} from '../src/utils/readingTracker';
import { Article } from '../src/types';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] || null),
  setItem: jest.fn(async (key: string, val: string) => {
    mockStorage[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

describe('ReadingTracker Local-First Storage & Filter Manager', () => {
  const articleA: Article = {
    id: 'https://example.com/story-a',
    category: 'ai',
    heading: 'Article A',
    shortSummary: 'Summary A',
    fullSummary: 'Full Summary A',
    published_at: new Date().toISOString(),
    link: 'https://example.com/story-a',
    image_url: 'https://media.zerodaily.in/a.webp',
  };

  const articleB: Article = {
    id: 'https://example.com/story-b',
    category: 'cybersec',
    heading: 'Article B',
    shortSummary: 'Summary B',
    fullSummary: 'Full Summary B',
    published_at: new Date().toISOString(),
    link: 'https://example.com/story-b',
    image_url: 'https://media.zerodaily.in/b.webp',
  };

  const articleC: Article = {
    id: 'https://example.com/story-c',
    category: 'robotics',
    heading: 'Article C',
    shortSummary: 'Summary C',
    fullSummary: 'Full Summary C',
    published_at: new Date().toISOString(),
    link: 'https://example.com/story-c',
    image_url: 'https://media.zerodaily.in/c.webp',
  };

  beforeEach(async () => {
    for (const key in mockStorage) {
      delete mockStorage[key];
    }
    await clearAllHistory();
  });

  test('markArticleAsRead records read status, dwell time and updates in-memory Set', async () => {
    await markArticleAsRead(articleA.id, articleA.category, 6.5);

    expect(isArticleRead(articleA.id)).toBe(true);
    expect(isArticleRead(articleB.id)).toBe(false);

    const readIds = await getReadArticleIds();
    expect(readIds.has(articleA.id)).toBe(true);
    expect(readIds.has(articleB.id)).toBe(false);

    // Verify persisted to AsyncStorage
    const saved = JSON.parse(mockStorage[READ_HISTORY_STORAGE_KEY] || '[]');
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe(articleA.id);
    expect(saved[0].status).toBe('read');
    expect(saved[0].dwellSec).toBe(6.5);
  });

  test('markArticleAsSkipped records skip without marking as read', async () => {
    await markArticleAsSkipped(articleB.id, articleB.category, 1.2);

    expect(isArticleRead(articleB.id)).toBe(false);

    const readIds = await getReadArticleIds();
    expect(readIds.has(articleB.id)).toBe(false);

    const saved = JSON.parse(mockStorage[READ_HISTORY_STORAGE_KEY] || '[]');
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe(articleB.id);
    expect(saved[0].status).toBe('skipped');
    expect(saved[0].dwellSec).toBe(1.2);
  });

  test('markArticleAsSkipped never overwrites an already read article', async () => {
    await markArticleAsRead(articleA.id, articleA.category, 8.0);
    expect(isArticleRead(articleA.id)).toBe(true);

    // Subsequent skip call must not downgrade read status
    await markArticleAsSkipped(articleA.id, articleA.category, 0.6);
    expect(isArticleRead(articleA.id)).toBe(true);

    const saved = JSON.parse(mockStorage[READ_HISTORY_STORAGE_KEY] || '[]');
    expect(saved[0].status).toBe('read');
    expect(saved[0].dwellSec).toBe(8.0);
  });

  test('filterUnreadArticles excludes read articles and retains unread or skipped', async () => {
    await markArticleAsRead(articleA.id, articleA.category, 5.0);
    await markArticleAsSkipped(articleB.id, articleB.category, 1.0);

    const pool = [articleA, articleB, articleC];
    const unread = filterUnreadArticles(pool);

    // Article A is read -> excluded
    // Article B was only skipped (< 4s) -> retained for re-serving
    // Article C is unvisited -> retained
    expect(unread.map((a) => a.id)).toEqual([articleB.id, articleC.id]);
  });

  test('clearOldHistory auto-prunes entries older than 30 days', async () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const oldEntry = {
      id: 'https://example.com/ancient-article',
      category: 'cybersec',
      status: 'read',
      dwellSec: 10.0,
      timestamp: thirtyOneDaysAgo,
    };
    mockStorage[READ_HISTORY_STORAGE_KEY] = JSON.stringify([oldEntry]);

    // Force reload from mockStorage
    await clearAllHistory();
    mockStorage[READ_HISTORY_STORAGE_KEY] = JSON.stringify([oldEntry]);
    await ensureLoaded();

    expect(isArticleRead(oldEntry.id)).toBe(false); // Pruned on load because > 30 days
  });

  test('readingTracker object exposes all methods cleanly', () => {
    expect(typeof readingTracker.markArticleAsRead).toBe('function');
    expect(typeof readingTracker.markArticleAsSkipped).toBe('function');
    expect(typeof readingTracker.isArticleRead).toBe('function');
    expect(typeof readingTracker.filterUnreadArticles).toBe('function');
    expect(typeof readingTracker.getReadArticleIds).toBe('function');
    expect(typeof readingTracker.clearOldHistory).toBe('function');
  });
});
