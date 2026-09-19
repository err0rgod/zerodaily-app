import { Article, CategoryKey } from '../types';

/**
 * Filters articles based on search query matching headline, summary, or category.
 */
export function searchArticles(
  articles: Article[],
  query: string,
  categoryFilter?: CategoryKey
): Article[] {
  if (!query.trim() && !categoryFilter) {
    return articles;
  }

  const cleanQuery = query.toLowerCase().trim();

  return articles.filter((article) => {
    // Category match
    if (categoryFilter && categoryFilter !== 'all' && article.category !== categoryFilter) {
      return false;
    }

    if (!cleanQuery) {
      return true;
    }

    const headingMatch = article.heading?.toLowerCase().includes(cleanQuery);
    const summaryMatch =
      article.shortSummary?.toLowerCase().includes(cleanQuery) ||
      article.fullSummary?.toLowerCase().includes(cleanQuery);
    const titleMatch = article.title?.toLowerCase().includes(cleanQuery);
    const categoryMatch = article.category.toLowerCase().includes(cleanQuery);

    return headingMatch || summaryMatch || titleMatch || categoryMatch;
  });
}
