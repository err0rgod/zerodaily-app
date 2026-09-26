import { Article, CategoryKey, UserProfile } from '../types';

/**
 * Calculates a personalized relevance score for an article based on:
 * 1. Time decay (half-life of ~24 hours).
 * 2. User category affinity multiplier from algo_weights (0.1 to 3.0).
 */
export function calculateArticleScore(article: Article, user: UserProfile | null): number {
  const publishedMs = new Date(article.published_at).getTime();
  const nowMs = Date.now();
  const ageHours = Math.max(0, (nowMs - publishedMs) / (1000 * 60 * 60));

  // Time decay function: fresh articles receive near 1.0, 24h old receive ~0.5
  const timeDecay = 1.0 / (1.0 + Math.pow(ageHours / 24.0, 1.3));

  // Category engagement affinity multiplier
  const categoryWeight = user?.algo_weights?.[article.category] ?? 1.0;

  return timeDecay * categoryWeight;
}

/**
 * Ranks and filters articles for feed personalization:
 * - In single category views, articles remain strictly chronological (newest first).
 * - In the unified 'all' feed, filters out categories explicitly disabled in topic_preferences
 *   and re-ranks the batch by algorithm affinity score.
 */
export function rankArticlesForUser(
  articles: Article[],
  user: UserProfile | null,
  currentCategory: CategoryKey
): Article[] {
  if (!articles || articles.length === 0) {
    return [];
  }

  // Single category feed remains pure chronological
  if (currentCategory !== 'all') {
    return articles;
  }

  // 1. Topic Preferences Filtering
  const preferences = user?.topic_preferences;
  let filtered = articles;
  if (preferences) {
    filtered = articles.filter((article) => {
      // If user explicitly unsubscribed from category, exclude from 'all' feed
      return preferences[article.category] !== false;
    });
    // If filtering excluded all articles, fallback to unfiltered so feed never empties
    if (filtered.length === 0) {
      filtered = articles;
    }
  }

  // 2. Algorithmic Re-ranking based on engagement weights
  if (!user || !user.algo_weights) {
    return filtered;
  }

  const scored = filtered.map((article) => ({
    article,
    score: calculateArticleScore(article, user),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.article);
}
