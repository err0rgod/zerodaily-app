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

  test('Anti-Clumping Rule: does not serve consecutive cards from same category when alternatives exist', () => {
    // 3 AI articles and 3 cybersec articles
    const ai1: Article = { ...baseArticle, id: 'ai-1', heading: 'AI 1' };
    const ai2: Article = { ...baseArticle, id: 'ai-2', heading: 'AI 2' };
    const ai3: Article = { ...baseArticle, id: 'ai-3', heading: 'AI 3' };

    const cyber1: Article = { ...oldCybersecArticle, id: 'cy-1', heading: 'Cyber 1' };
    const cyber2: Article = { ...oldCybersecArticle, id: 'cy-2', heading: 'Cyber 2' };
    const cyber3: Article = { ...oldCybersecArticle, id: 'cy-3', heading: 'Cyber 3' };

    const pool = [ai1, ai2, ai3, cyber1, cyber2, cyber3];
    const interleaved = rankArticlesForUser(pool, mockUser, 'all');

    expect(interleaved.length).toBe(6);

    // Verify no two adjacent items share the same category when both are active
    for (let i = 0; i < interleaved.length - 1; i++) {
      expect(interleaved[i].category).not.toBe(interleaved[i + 1].category);
    }
  });

  test('Anti-Clumping Rule: gracefully relaxes when only one category has remaining articles', () => {
    // 4 AI articles and 1 cybersec article
    const ai1: Article = { ...baseArticle, id: 'ai-1' };
    const ai2: Article = { ...baseArticle, id: 'ai-2' };
    const ai3: Article = { ...baseArticle, id: 'ai-3' };
    const ai4: Article = { ...baseArticle, id: 'ai-4' };
    const cyber1: Article = { ...oldCybersecArticle, id: 'cy-1' };

    const pool = [ai1, ai2, ai3, ai4, cyber1];
    const interleaved = rankArticlesForUser(pool, mockUser, 'all');

    expect(interleaved.length).toBe(5);
    // First two must alternate
    expect(interleaved[0].category).toBe('ai');
    expect(interleaved[1].category).toBe('cybersec');
    // Once cybersec is exhausted, remaining 3 AI articles are served without crashing
    expect(interleaved[2].category).toBe('ai');
    expect(interleaved[3].category).toBe('ai');
    expect(interleaved[4].category).toBe('ai');
  });

  test('calculateArticleScore handles malformed or missing published_at without returning NaN', () => {
    const invalidArticle: Article = {
      ...baseArticle,
      published_at: 'not-a-valid-date',
    };
    const score = calculateArticleScore(invalidArticle, mockUser);
    expect(Number.isNaN(score)).toBe(false);
    expect(score).toBeGreaterThan(0);
  });

  test('interleaveArticles handles null or empty input gracefully', () => {
    expect(rankArticlesForUser([], mockUser, 'ai')).toEqual([]);
  });
});

