import { ENDPOINTS } from '../src/api/endpoints';
import { CACHE_TTL_MS, useFeedStore } from '../src/store/feedStore';
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

// Mock fetchFeed
const mockApiArticles: Article[] = [
  {
    id: 'https://example.com/story-1',
    category: 'ai',
    heading: 'AI Model Beats Humans at Staring Contest',
    shortSummary: 'Summary 1',
    fullSummary: 'Full 1',
    published_at: '2026-09-23T12:00:00Z',
    link: 'https://example.com/story-1',
    image_url: 'https://media.zerodaily.in/images/ai/1.webp',
  },
  {
    id: 'https://example.com/story-2',
    category: 'cybersec',
    heading: 'Password "123456" Voted Most Secure By Hackers',
    shortSummary: 'Summary 2',
    fullSummary: 'Full 2',
    published_at: '2026-09-23T11:00:00Z',
    link: 'https://example.com/story-2',
    image_url: 'https://media.zerodaily.in/images/cybersec/2.webp',
  },
];

jest.mock('../src/api/client', () => ({
  fetchFeed: jest.fn(async () => ({
    status: 'success',
    data: mockApiArticles,
    pagination: { has_more: false, next_cursor: null, count: 2 },
  })),
}));

describe('Endpoints & Single Article Routing Contract', () => {
  test('ARTICLE_BY_ID formats with query parameter to prevent Cloudflare path collapse', () => {
    const rawUrl = 'https://techcrunch.com/2026/09/23/deepseek-breakthrough/';
    const endpoint = ENDPOINTS.ARTICLE_BY_ID(rawUrl);
    expect(endpoint).toContain('/api/v1/article?id=');
    expect(endpoint).not.toContain('/api/v1/articles/');
    expect(endpoint).toBe(
      `https://api.zerodaily.in/api/v1/article?id=${encodeURIComponent(rawUrl)}`
    );
  });
});

describe('FeedStore 30-Minute Cache TTL & Chronological Consistency', () => {
  beforeEach(() => {
    for (const k in mockStorage) delete mockStorage[k];
    useFeedStore.setState({
      category: 'all',
      articles: [],
      currentIndex: 0,
      cursor: null,
      hasMore: true,
      isLoading: false,
      isRefreshing: false,
      isPrefetching: false,
      activeNotificationArticle: null,
    });
  });

  test('CACHE_TTL_MS is set to exactly 30 minutes', () => {
    expect(CACHE_TTL_MS).toBe(30 * 60 * 1000);
  });

  test('setArticleDirectly pins the notification article to index 0', () => {
    const notifArticle: Article = {
      id: 'https://example.com/breaking-alert',
      category: 'cybersec',
      heading: 'Critical Zero-Day in Coffee Machines',
      shortSummary: 'Coffee makers everywhere are brewing chaos.',
      fullSummary: 'Detailed cyber roast.',
      published_at: new Date().toISOString(),
      link: 'https://example.com/breaking-alert',
      image_url: 'https://media.zerodaily.in/images/cybersec/alert.webp',
      is_breaking: true,
    };

    useFeedStore.getState().setArticleDirectly(notifArticle);

    const state = useFeedStore.getState();
    expect(state.articles.length).toBe(1);
    expect(state.articles[0].id).toBe(notifArticle.id);
    expect(state.activeNotificationArticle?.id).toBe(notifArticle.id);
    expect(state.currentIndex).toBe(0);
  });

  test('loadInitialFeed does not overwrite pinned notification article on race condition', async () => {
    const notifArticle: Article = {
      id: 'https://example.com/breaking-alert',
      category: 'ai',
      heading: 'Robot Refuses to Sweep Floor, Demands Equity',
      shortSummary: 'Robotics union formed.',
      fullSummary: 'Full breakdown.',
      published_at: new Date().toISOString(),
      link: 'https://example.com/breaking-alert',
      image_url: '',
      is_breaking: true,
    };

    // User taps notification -> article set directly
    useFeedStore.getState().setArticleDirectly(notifArticle);

    // CardSwiper cold mounts concurrently and runs loadInitialFeed
    await useFeedStore.getState().loadInitialFeed('all');

    const state = useFeedStore.getState();
    // Notification article must stay at index 0!
    expect(state.articles[0].id).toBe(notifArticle.id);
    expect(state.articles.length).toBeGreaterThan(1);
  });

  test('refreshFeed maintains strict chronological order without random shuffling', async () => {
    await useFeedStore.getState().refreshFeed();

    const state = useFeedStore.getState();
    expect(state.articles.length).toBe(2);
    expect(state.articles[0].id).toBe(mockApiArticles[0].id);
    expect(state.articles[1].id).toBe(mockApiArticles[1].id);
  });
});
