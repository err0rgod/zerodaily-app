import { Share } from 'react-native';
import { Article } from '../types';

/**
 * Share article card using the native OS share sheet.
 */
export async function shareArticle(article: Article): Promise<void> {
  try {
    const shareUrl = `https://zerodaily.in/a/${encodeURIComponent(article.id)}`;
    const message = `${article.heading}\n\nDownload ZeroDaily for fastest tech news:\n${shareUrl}`;
    await Share.share({
      title: article.heading,
      message,
      url: shareUrl,
    });
  } catch (error) {
    console.warn('[ZeroDaily Share] Failed to share article:', error);
  }
}
