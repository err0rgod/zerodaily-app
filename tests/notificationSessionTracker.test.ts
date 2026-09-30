import { notificationSessionTracker } from '../src/services/notificationService';
import * as client from '../src/api/client';
import { useUserStore } from '../src/store/userStore';

// Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({

  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

// Mock Expo Notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getDevicePushTokenAsync: jest.fn(async () => ({ data: 'test_token' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'test_expo_token' })),
  scheduleNotificationAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  removeNotificationSubscription: jest.fn(),
  AndroidImportance: { MAX: 5 },
  AndroidNotificationPriority: { MAX: 2 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

describe('NotificationSessionTracker CTR & Retention Tracking', () => {
  let trackSpy: jest.SpyInstance;

  beforeEach(() => {
    notificationSessionTracker.endSession();
    jest.clearAllMocks();
    trackSpy = jest.spyOn(client, 'trackNotificationEvent').mockResolvedValue({
      status: 'success',
      message: 'Notification interaction recorded successfully',
    });
  });

  afterEach(() => {
    notificationSessionTracker.endSession();
    trackSpy.mockRestore();
  });

  it('starts session and records initial state', () => {
    notificationSessionTracker.startSession('https://example.com/breaking-1', 'cybersec');
    const session = notificationSessionTracker.getActiveSession();

    expect(session).not.toBeNull();
    expect(session?.articleId).toBe('https://example.com/breaking-1');
    expect(session?.category).toBe('cybersec');
    expect(session?.swipesCount).toBe(0);
    expect(typeof session?.startTime).toBe('number');
  });

  it('increments swipesCount on recordSwipe when session is active', () => {
    notificationSessionTracker.startSession('https://example.com/breaking-2', 'ai');
    notificationSessionTracker.recordSwipe();
    notificationSessionTracker.recordSwipe();
    notificationSessionTracker.recordSwipe();

    const session = notificationSessionTracker.getActiveSession();
    expect(session?.swipesCount).toBe(3);
  });

  it('ignores recordSwipe when no session is active', () => {
    notificationSessionTracker.recordSwipe();
    expect(notificationSessionTracker.getActiveSession()).toBeNull();
  });

  it('ends session and dispatches notification_session_complete beacon', async () => {
    notificationSessionTracker.startSession('https://example.com/breaking-3', 'programming');
    notificationSessionTracker.recordSwipe();
    notificationSessionTracker.recordSwipe();

    notificationSessionTracker.endSession();

    expect(notificationSessionTracker.getActiveSession()).toBeNull();
    expect(trackSpy).toHaveBeenCalledTimes(1);

    const payload = trackSpy.mock.calls[0][0];
    expect(payload.article_id).toBe('https://example.com/breaking-3');
    expect(payload.category).toBe('programming');
    expect(payload.action).toBe('notification_session_complete');
    expect(payload.swipes_count).toBe(2);
    expect(typeof payload.dwell_seconds).toBe('number');
    expect(payload.trigger_article_id).toBe('https://example.com/breaking-3');
    expect(payload.articles_swiped_count).toBe(2);
  });

  it('does not fire duplicate beacon when endSession is called multiple times', () => {
    notificationSessionTracker.startSession('https://example.com/breaking-4', 'robotics');
    notificationSessionTracker.endSession();
    notificationSessionTracker.endSession();

    expect(trackSpy).toHaveBeenCalledTimes(1);
  });

  it('auto-flushes previous session when starting a new session', () => {
    notificationSessionTracker.startSession('https://example.com/first', 'hardware');
    notificationSessionTracker.recordSwipe();

    // Start second session without explicitly ending first
    notificationSessionTracker.startSession('https://example.com/second', 'finance');

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy.mock.calls[0][0].article_id).toBe('https://example.com/first');
    expect(trackSpy.mock.calls[0][0].swipes_count).toBe(1);

    const currentSession = notificationSessionTracker.getActiveSession();
    expect(currentSession?.articleId).toBe('https://example.com/second');
    expect(currentSession?.category).toBe('finance');
    expect(currentSession?.swipesCount).toBe(0);
  });

  it('dispatches session complete beacon with auth token when user is logged in', () => {
    useUserStore.setState({ token: 'test_jwt_bearer_token' });
    notificationSessionTracker.startSession('https://example.com/auth-story', 'cybersec');
    notificationSessionTracker.endSession();

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy.mock.calls[0][1]).toBe('test_jwt_bearer_token');

    // Clean up
    useUserStore.setState({ token: null });
  });
});
