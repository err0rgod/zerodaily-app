import { CATEGORIES, CATEGORY_LIST } from '../src/constants/categories';
import { formatRelativeTime } from '../src/utils/date';

describe('ZeroDaily Taxonomy & Notification Topic Mappings', () => {
  test('all 6 core tech domains plus all-feed are registered', () => {
    expect(CATEGORY_LIST.length).toBe(7);
  });

  test('FCM topics conform strictly to notification-arch.md', () => {
    expect(CATEGORIES.all.fcmTopic).toBe('topic_breaking_all');
    expect(CATEGORIES.cybersec.fcmTopic).toBe('topic_cybersec');
    expect(CATEGORIES.ai.fcmTopic).toBe('topic_ai');
    expect(CATEGORIES.programming.fcmTopic).toBe('topic_programming');
    expect(CATEGORIES.robotics.fcmTopic).toBe('topic_robotics');
    expect(CATEGORIES.defense_aerospace.fcmTopic).toBe('topic_defense_aerospace');
    expect(CATEGORIES.hardware.fcmTopic).toBe('topic_hardware');
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
