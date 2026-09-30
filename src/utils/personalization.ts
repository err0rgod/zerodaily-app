import { Article, CategoryKey, UserProfile } from '../types';

export const MAX_CONSECUTIVE_SAME_CATEGORY = 1;
export const EXPLORATION_RATE = 0.18; // ~18% exploration probability for discovery

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
 * Interleaves articles across categories based on scores and algo weights,
 * strictly enforcing the Anti-Clumping Rule: at most 1 consecutive card from
 * the same category unless no other categories have remaining articles.
 * Incorporates ~18% exploration probability for discovery after card 0.
 */
export function interleaveArticles(
  articles: Article[],
  user: UserProfile | null,
  options?: { maxConsecutive?: number; explorationRate?: number }
): Article[] {
  if (!articles || articles.length <= 1) {
    return articles ? [...articles] : [];
  }

  const maxConsecutive = options?.maxConsecutive ?? MAX_CONSECUTIVE_SAME_CATEGORY;
  const explorationRate = options?.explorationRate ?? EXPLORATION_RATE;

  // 1. Group articles by category with calculated scores
  const categoryQueues = new Map<CategoryKey, { article: Article; score: number }[]>();

  for (const article of articles) {
    const cat = article.category;
    if (!categoryQueues.has(cat)) {
      categoryQueues.set(cat, []);
    }
    categoryQueues.get(cat)!.push({
      article,
      score: calculateArticleScore(article, user),
    });
  }

  // 2. Sort within each category descending by score
  for (const queue of categoryQueues.values()) {
    queue.sort((a, b) => b.score - a.score);
  }

  const result: Article[] = [];
  let lastCategory: CategoryKey | null = null;
  let consecutiveCount = 0;

  while (true) {
    // Collect active categories that still have articles
    const activeCategories: CategoryKey[] = [];
    for (const [cat, queue] of categoryQueues.entries()) {
      if (queue.length > 0) {
        activeCategories.push(cat);
      }
    }

    if (activeCategories.length === 0) {
      break;
    }

    // Determine eligible categories based on Anti-Clumping Rule
    let eligibleCategories = activeCategories;
    if (lastCategory !== null && consecutiveCount >= maxConsecutive) {
      const otherCategories = activeCategories.filter((cat) => cat !== lastCategory);
      if (otherCategories.length > 0) {
        eligibleCategories = otherCategories;
      }
      // If no other categories remain, relax anti-clumping to avoid empty feed
    }

    // Determine the highest-scored category among eligible categories
    let bestCategory = eligibleCategories[0];
    let highestScore = categoryQueues.get(bestCategory)![0].score;

    for (let i = 1; i < eligibleCategories.length; i++) {
      const cat = eligibleCategories[i];
      const score = categoryQueues.get(cat)![0].score;
      if (score > highestScore) {
        highestScore = score;
        bestCategory = cat;
      }
    }

    // Exploration / Discovery: for position > 0, explore other categories with ~18% probability
    let chosenCategory = bestCategory;
    const isExploration =
      result.length > 0 &&
      eligibleCategories.length > 1 &&
      Math.random() < explorationRate;

    if (isExploration) {
      const otherCategories = eligibleCategories.filter((cat) => cat !== bestCategory);
      if (otherCategories.length > 0) {
        const randomIndex = Math.floor(Math.random() * otherCategories.length);
        chosenCategory = otherCategories[randomIndex];
      }
    }

    // Pop the winning article from the chosen category queue
    const queue = categoryQueues.get(chosenCategory)!;
    const candidate = queue.shift()!;
    result.push(candidate.article);

    // Update consecutive tracker
    if (chosenCategory === lastCategory) {
      consecutiveCount++;
    } else {
      lastCategory = chosenCategory;
      consecutiveCount = 1;
    }
  }

  return result;
}

/**
 * Ranks and filters articles for feed personalization:
 * - In single category views, articles remain strictly chronological (newest first).
 * - In the unified 'all' feed, filters out categories explicitly disabled in topic_preferences
 *   and re-ranks the batch using Weighted Diverse Interleaving with Anti-Clumping.
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

  // 2. Weighted Diverse Interleaving with Anti-Clumping
  return interleaveArticles(filtered, user);
}
