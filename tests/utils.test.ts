import { CATEGORIES, CATEGORY_LIST, getDynamicFallbackImage } from '../src/constants/categories';
import { DARK_THEME, LIGHT_THEME } from '../src/constants/theme';
import { formatRelativeTime } from '../src/utils/date';
import { extractDomain, getReadingEstimate } from '../src/utils/url';

describe('ZeroDaily Taxonomy & Notification Topic Mappings', () => {
  test('all 7 core tech domains plus all-feed are registered', () => {
    expect(CATEGORY_LIST.length).toBe(8);
  });

  test('FCM topics conform strictly to notification-arch.md', () => {
    expect(CATEGORIES.all.fcmTopic).toBe('topic_breaking_all');
    expect(CATEGORIES.cybersec.fcmTopic).toBe('topic_cybersec');
    expect(CATEGORIES.ai.fcmTopic).toBe('topic_ai');
    expect(CATEGORIES.programming.fcmTopic).toBe('topic_programming');
    expect(CATEGORIES.robotics.fcmTopic).toBe('topic_robotics');
    expect(CATEGORIES.defense_aerospace.fcmTopic).toBe('topic_defense_aerospace');
    expect(CATEGORIES.hardware.fcmTopic).toBe('topic_hardware');
    expect(CATEGORIES.finance.fcmTopic).toBe('topic_finance');
  });
});

describe('Date & Relative Time Utility', () => {
  test('formats seconds, minutes, and hours properly', () => {
    const now = Date.now();
    const tenMinAgo = new Date(now - 1000 * 60 * 10).toISOString();
    const twoHoursAgo = new Date(now - 1000 * 60 * 60 * 2).toISOString();

    expect(formatRelativeTime(tenMinAgo)).toBe('10m ago');
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });
});

describe('Editorial URL & Reading Utilities', () => {
  test('extracts clean publisher domain from URLs', () => {
    expect(extractDomain('https://www.tomshardware.com/tech/news-123')).toBe('tomshardware.com');
    expect(extractDomain('https://dev.to/username/article-title')).toBe('dev.to');
    expect(extractDomain('https://techcrunch.com/2026/09/18/story/')).toBe('techcrunch.com');
    expect(extractDomain('https://economictimes.indiatimes.com/tech/technology/news-123.cms')).toBe('economictimes.com');
    expect(extractDomain('https://m.economictimes.indiatimes.com/markets/stocks')).toBe('economictimes.com');
    expect(extractDomain('')).toBe('Source');
  });

  test('calculates reading estimate accurately', () => {
    const shortText = 'In a stunning display of corporate energy efficiency, a company kept reports.';
    expect(getReadingEstimate(shortText)).toBe('60s read');
  });
});

describe('Theme Palettes & Dual-Mode Contrast', () => {
  test('dark and light themes have distinct background and card values', () => {
    expect(DARK_THEME.colors.background).toBe('#000000');
    expect(LIGHT_THEME.colors.background).toBe('#F1F3F6');
    expect(DARK_THEME.colors.card).toBe('#0A0A0A');
    expect(LIGHT_THEME.colors.card).toBe('#FFFFFF');
    expect(DARK_THEME.colors.statusBarStyle).toBe('light');
    expect(LIGHT_THEME.colors.statusBarStyle).toBe('dark');
  });
});

describe('Dynamic Category Image Fallback System', () => {
  test('all categories provide multi-image pools', () => {
    CATEGORY_LIST.forEach((cat) => {
      expect(cat.fallbackImages.length).toBeGreaterThanOrEqual(4);
    });
  });

  test('different article IDs in same category get different fallback images', () => {
    const img1 = getDynamicFallbackImage('article-alpha', 'programming');
    const img2 = getDynamicFallbackImage('article-beta', 'programming');
    const img3 = getDynamicFallbackImage('article-gamma', 'programming');
    const set = new Set([img1, img2, img3]);
    // With 4 images in pool and different hashes, set size should be > 1
    expect(set.size).toBeGreaterThan(1);
  });
});

describe('Search Utility', () => {
  const sampleArticles = [
    {
      id: '1',
      category: 'cybersec' as const,
      heading: 'CrowdStrike Meltdown in Windows Drivers',
      shortSummary: 'Blue screens across the airport departure boards.',
      fullSummary: 'Detailed breakdown',
      published_at: new Date().toISOString(),
      link: 'https://example.com/1',
      image_url: 'https://example.com/1.png',
    },
    {
      id: '2',
      category: 'ai' as const,
      heading: 'Anthropic Launches Claude 3.7 Thinking',
      shortSummary: 'Hybrid reasoning models struggle with centering a CSS div.',
      fullSummary: 'Detailed breakdown',
      published_at: new Date().toISOString(),
      link: 'https://example.com/2',
      image_url: 'https://example.com/2.png',
    },
  ];

  test('filters by keyword across heading and shortSummary', () => {
    const { searchArticles } = require('../src/utils/search');
    const res1 = searchArticles(sampleArticles, 'CrowdStrike');
    expect(res1.length).toBe(1);
    expect(res1[0].id).toBe('1');

    const res2 = searchArticles(sampleArticles, 'centering');
    expect(res2.length).toBe(1);
    expect(res2[0].id).toBe('2');
  });

  test('filters by category taxonomy', () => {
    const { searchArticles } = require('../src/utils/search');
    const res = searchArticles(sampleArticles, '', 'ai');
    expect(res.length).toBe(1);
    expect(res[0].category).toBe('ai');
  });
});

