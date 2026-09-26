import { calculateArticleScore, rankArticlesForUser } from '../src/utils/personalization';
import { Article, UserProfile } from '../src/types';

describe('Personalization & Algorithmic Feed Ranking', () => {
  const baseArticle: Article = {
    id: 'https://example.com/test-ai',
    category: 'ai',
    heading: 'AI Model Beats All Benchmarks',
    shortSummary: 'AI models are getting smarter.',
    fullSummary: 'Full roast on AI hype.',
    published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours old
    link: 'https://example.com/test-ai',
    image_url: 'https://media.zerodaily.in/ai.webp',
  };

  const oldCybersecArticle: Article = {
    id: 'https://example.com/old-cyber',
    category: 'cybersec',
    heading: 'Firewall Breach at Major Tech Firm',
    shortSummary: 'Cybersecurity failure.',
    fullSummary: 'Cybersec roast.',
    published_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours old
    link: 'https://example.com/old-cyber',
    image_url: 'https://media.zerodaily.in/cyber.webp',
  };

  const disabledHardwareArticle: Article = {
    id: 'https://example.com/hardware-chip',
    category: 'hardware',
    heading: 'New 2nm Chip Architecture',
    shortSummary: 'Silicon breakthrough.',
    fullSummary: 'Hardware roast.',
    published_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour old
    link: 'https://example.com/hardware-chip',
    image_url: 'https://media.zerodaily.in/hw.webp',
  };

  const mockUser: UserProfile = {
    user_id: 'usr_test_algo',
    email: 'user@example.com',
    display_name: 'Algo Reader',
    avatar_url: null,
    is_anonymous: false,
    created_at: '2026-09-26T12:00:00Z',
    last_active_at: '2026-09-26T12:00:00Z',
    topic_preferences: {
      ai: true,
      cybersec: true,
      hardware: false, // User unsubscribed from hardware
    },
    algo_weights: {
      ai: 2.5, // High affinity for AI
      cybersec: 0.8, // Low affinity for cybersec
      hardware: 1.0,
    },
    bookmarked_articles: [],
    reading_count: 10,
  };

  test('calculateArticleScore applies time decay and category weight multiplier', () => {
    const aiScore = calculateArticleScore(baseArticle, mockUser);
    expect(aiScore).toBeGreaterThan(1.5); // 2.5 weight * ~0.95 decay

    const cyberScore = calculateArticleScore(oldCybersecArticle, mockUser);
    expect(cyberScore).toBeLessThan(0.5); // 0.8 weight * ~0.24 decay
  });

  test('rankArticlesForUser excludes categories disabled in topic preferences in all feed', () => {
    const articles = [baseArticle, oldCybersecArticle, disabledHardwareArticle];
    const ranked = rankArticlesForUser(articles, mockUser, 'all');

    const ids = ranked.map((a) => a.id);
    expect(ids).toContain(baseArticle.id);
    expect(ids).toContain(oldCybersecArticle.id);
    expect(ids).not.toContain(disabledHardwareArticle.id); // Filtered out
  });

  test('rankArticlesForUser ranks high-affinity category above lower-affinity even if slightly older', () => {
    const freshCyber: Article = {
      ...oldCybersecArticle,
      id: 'https://example.com/fresh-cyber',
      published_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min old
    };

    const articles = [freshCyber, baseArticle];
    const ranked = rankArticlesForUser(articles, mockUser, 'all');

    // AI article with weight 2.5 ranks first over cybersec with weight 0.8
    expect(ranked[0].id).toBe(baseArticle.id);
  });

  test('rankArticlesForUser preserves pure chronological order in single-category feed', () => {
    const articles = [baseArticle, disabledHardwareArticle];
    // In category 'hardware', topic filter and ranking are bypassed
    const result = rankArticlesForUser(articles, mockUser, 'hardware');
    expect(result).toEqual(articles);
  });

  test('rankArticlesForUser handles empty array or null user gracefully', () => {
    expect(rankArticlesForUser([], mockUser, 'all')).toEqual([]);
    expect(rankArticlesForUser([baseArticle], null, 'all')).toEqual([baseArticle]);
  });
});
