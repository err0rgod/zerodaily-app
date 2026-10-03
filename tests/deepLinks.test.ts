jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  getInitialURL: jest.fn(async () => null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

import { extractArticleIdFromUrl } from '../src/hooks/useDeepLinks';

describe('extractArticleIdFromUrl', () => {
  it('extracts ID from https://zerodaily.in/a/:id', () => {
    expect(extractArticleIdFromUrl('https://zerodaily.in/a/quantum_chip_2026')).toBe('quantum_chip_2026');
    expect(extractArticleIdFromUrl('https://zerodaily.in/a/art-9912?ref=twitter')).toBe('art-9912');
  });

  it('extracts ID from https://zerodaily.in/story/:id', () => {
    expect(extractArticleIdFromUrl('https://zerodaily.in/story/story_abc')).toBe('story_abc');
  });

  it('extracts ID from custom scheme zerodaily://a/:id', () => {
    expect(extractArticleIdFromUrl('zerodaily://a/article_456')).toBe('article_456');
    expect(extractArticleIdFromUrl('zerodaily://a/article_456?channel=push')).toBe('article_456');
  });

  it('extracts ID from query parameters', () => {
    expect(extractArticleIdFromUrl('https://zerodaily.in/?id=param_id_77')).toBe('param_id_77');
    expect(extractArticleIdFromUrl('zerodaily://open?article_id=param_id_88')).toBe('param_id_88');
  });

  it('extracts canonical full URL IDs whether encoded or unencoded', () => {
    const rawUrl = 'https://www.tomshardware.com/tech-industry/cyber-security/malicious-vpn';
    expect(extractArticleIdFromUrl(`https://zerodaily.in/a/${encodeURIComponent(rawUrl)}`)).toBe(rawUrl);
    expect(extractArticleIdFromUrl(`https://zerodaily.in/a/${rawUrl}`)).toBe(rawUrl);
    expect(extractArticleIdFromUrl(`zerodaily://a/${encodeURIComponent(rawUrl)}`)).toBe(rawUrl);
    expect(extractArticleIdFromUrl(`zerodaily://a/${rawUrl}`)).toBe(rawUrl);
    expect(extractArticleIdFromUrl(`https://zerodaily.in/?id=${encodeURIComponent(rawUrl)}`)).toBe(rawUrl);
  });

  it('returns null for unrelated URLs', () => {
    expect(extractArticleIdFromUrl('https://zerodaily.in/privacy')).toBeNull();
    expect(extractArticleIdFromUrl('https://google.com')).toBeNull();
    expect(extractArticleIdFromUrl('')).toBeNull();
  });
});
