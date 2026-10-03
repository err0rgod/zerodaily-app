const mockShare = jest.fn();

jest.mock('react-native', () => ({
  Share: {
    share: (...args: any[]) => mockShare(...args),
  },
}));

import { shareArticle } from '../src/utils/share';
import { Article } from '../src/types';

describe('Share Utility', () => {
  beforeEach(() => {
    mockShare.mockClear();
  });

  test('uses short_code when available and formats download call-to-action', async () => {
    const article: Article = {
      id: 'https://example.com/long-article-url-that-is-very-long',
      short_code: 'abc12345',
      heading: 'Breaking Tech Story',
      category: 'ai',
      shortSummary: 'Summary',
      fullSummary: 'Full summary',
      published_at: new Date().toISOString(),
      link: 'https://example.com/article',
      image_url: 'https://example.com/img.png',
    };

    await shareArticle(article);

    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockShare).toHaveBeenCalledWith({
      title: 'Breaking Tech Story',
      message: 'Breaking Tech Story\n\nDownload ZeroDaily for fastest tech news:\nhttps://zerodaily.in/a/abc12345',
      url: 'https://zerodaily.in/a/abc12345',
    });
  });

  test('falls back to encoded id if short_code is not present', async () => {
    const article: Article = {
      id: 'abc-def',
      heading: 'Standard Story',
      category: 'programming',
      shortSummary: 'Summary',
      fullSummary: 'Full summary',
      published_at: new Date().toISOString(),
      link: 'https://example.com/article',
      image_url: 'https://example.com/img.png',
    };

    await shareArticle(article);

    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockShare).toHaveBeenCalledWith({
      title: 'Standard Story',
      message: 'Standard Story\n\nDownload ZeroDaily for fastest tech news:\nhttps://zerodaily.in/a/abc-def',
      url: 'https://zerodaily.in/a/abc-def',
    });
  });
});
