let mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] || null),
  setItem: jest.fn(async (key: string, val: string) => {
    mockStorage[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
  clear: jest.fn(async () => {
    mockStorage = {};
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLikeStore } from '../src/store/likeStore';
import { useUserStore } from '../src/store/userStore';
import { Article } from '../src/types';

const mockArticle: Article = {
  id: 'art_test_1',
  category: 'ai',
  heading: 'OpenAI Releases GPT-5',
  shortSummary: 'Next generation models released.',
  fullSummary: 'Detailed overview of GPT-5 architecture and training.',
  published_at: new Date().toISOString(),
  link: 'https://example.com/gpt5',
  image_url: 'https://example.com/gpt5.png',
};

describe('useLikeStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLikeStore.setState({ likedIds: [], isLoaded: false });
    useUserStore.setState({
      user: {
        user_id: 'u1',
        email: 'test@example.com',
        is_anonymous: false,
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        topic_preferences: {},
        algo_weights: { ai: 1.0 },
        reading_count: 0,
        bookmarked_articles: [],
      },
    });
  });

  it('loads empty liked list on clean state', async () => {
    await useLikeStore.getState().loadLikes();
    expect(useLikeStore.getState().likedIds).toEqual([]);
    expect(useLikeStore.getState().isLoaded).toBe(true);
  });

  it('toggles like on and off, updating storage and boosting category weight', async () => {
    await useLikeStore.getState().loadLikes();

    // 1. Like article
    const liked = await useLikeStore.getState().toggleLike(mockArticle);
    expect(liked).toBe(true);
    expect(useLikeStore.getState().isLiked(mockArticle.id)).toBe(true);
    expect(useLikeStore.getState().likedIds).toContain(mockArticle.id);

    // Verify category weight boosted by +0.35
    expect(useUserStore.getState().user?.algo_weights?.ai).toBe(1.35);

    // Verify persisted in AsyncStorage
    const saved = await AsyncStorage.getItem('@zerodaily_liked_articles');
    expect(JSON.parse(saved || '[]')).toContain(mockArticle.id);

    // 2. Unlike article
    const unliked = await useLikeStore.getState().toggleLike(mockArticle);
    expect(unliked).toBe(false);
    expect(useLikeStore.getState().isLiked(mockArticle.id)).toBe(false);
    expect(useLikeStore.getState().likedIds).not.toContain(mockArticle.id);

    // Verify category weight decreased back
    expect(useUserStore.getState().user?.algo_weights?.ai).toBe(1.0);
  });
});
