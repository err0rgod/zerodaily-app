import { Share } from 'react-native';
import { Article } from '../types';

/**
 * Share article card using the native OS share sheet.
 */
export async function shareArticle(article: Article): Promise<void> {
  try {
    const message = `${article.heading}\n\nRead more on ZeroDaily:\n${article.link}`;
    await Share.share({
      title: article.heading,
      message,
      url: article.link,
    });
  } catch (error) {
    console.warn('[ZeroDaily Share] Failed to share article:', error);
  }
}
