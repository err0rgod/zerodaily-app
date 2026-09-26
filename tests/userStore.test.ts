import { useUserStore } from '../src/store/userStore';
import { UserProfile } from '../src/types';

// Mock AsyncStorage
let mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] || null),
  setItem: jest.fn(async (key: string, val: string) => {
    mockStorage[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => delete mockStorage[k]);
  }),
}));

// Mock bookmark store
jest.mock('../src/store/bookmarkStore', () => ({
  useBookmarkStore: {
    getState: () => ({
      clearAllBookmarks: jest.fn(async () => {}),
      bookmarks: [],
    }),
  },
}));

const mockGuestUser: UserProfile = {
  user_id: 'guest_test_123',
  email: null,
  display_name: 'Guest Reader',
  avatar_url: null,
  is_anonymous: true,
  created_at: '2026-09-26T12:00:00Z',
  last_active_at: '2026-09-26T12:00:00Z',
  topic_preferences: { ai: true, cybersec: true },
  algo_weights: { ai: 1.0, cybersec: 1.0 },
  bookmarked_articles: [],
  reading_count: 0,
};

const mockPermUser: UserProfile = {
  user_id: 'usr_registered_456',
  email: 'reader@example.com',
  display_name: 'Satire Reader',
  avatar_url: null,
  is_anonymous: false,
  created_at: '2026-09-26T12:05:00Z',
  last_active_at: '2026-09-26T12:05:00Z',
  topic_preferences: { ai: true, cybersec: true, hardware: true },
  algo_weights: { ai: 1.25, cybersec: 1.15, hardware: 1.0 },
  bookmarked_articles: ['https://example.com/roast-1'],
  reading_count: 4,
};

// Mock api client
jest.mock('../src/api/client', () => ({
  createGuestSession: jest.fn(async () => ({
    status: 'success',
    access_token: 'mock_guest_token_abc',
    token_type: 'bearer',
    user: mockGuestUser,
  })),
  registerUser: jest.fn(async (email, password, displayName, guestId) => ({
    status: 'success',
    access_token: 'mock_registered_token_xyz',
    token_type: 'bearer',
    user: {
      ...mockPermUser,
      email,
      display_name: displayName || 'Satire Reader',
    },
  })),
  loginUser: jest.fn(async (email, password, guestId) => {
    if (password === 'wrong') {
      return {
        status: 'error',
        access_token: '',
        token_type: 'bearer',
        user: {} as any,
        message: 'Invalid credentials',
      };
    }
    return {
      status: 'success',
      access_token: 'mock_login_token_789',
      token_type: 'bearer',
      user: mockPermUser,
    };
  }),
  fetchCurrentUser: jest.fn(async (token: string) => {
    if (token === 'invalid_token') return null;
    return mockPermUser;
  }),
  fetchCurrentUserResult: jest.fn(async (token: string) => {
    if (token === 'invalid_token') {
      return { user: null, isUnauthorized: true, isNetworkError: false };
    }
    if (token === 'network_error_token') {
      return { user: null, isUnauthorized: false, isNetworkError: true };
    }
    return { user: mockPermUser, isUnauthorized: false, isNetworkError: false };
  }),
  updateUserPreferences: jest.fn(async (token, prefs) => ({
    ...mockPermUser,
    topic_preferences: prefs,
  })),
  trackUserEvent: jest.fn(async (token, payload) => ({
    status: 'success',
    user_id: 'usr_registered_456',
    action: payload.action,
    algo_weights: { ai: 1.45, cybersec: 1.2 },
  })),
  syncUserBookmarks: jest.fn(async (token, bookmarks, mode) => bookmarks),
  deleteUserAccount: jest.fn(async (token: string) => {
    if (token === 'error_token') {
      return { status: 'error', message: 'Failed to delete account' };
    }
    return {
      status: 'success',
      message: 'Account scheduled for deletion in 24 hours. Log back in to reactivate.',
      deletion_scheduled_at: '2026-09-27T12:00:00Z',
      is_pending_deletion: true,
    };
  }),
}));

describe('UserStore & Authentication State Machine', () => {
  beforeEach(() => {
    mockStorage = {};
    jest.clearAllMocks();
    useUserStore.setState({
      user: null,
      token: null,
      isLoading: false,
      isGuest: true,
      isAuthenticated: false,
      isAuthModalOpen: false,
      authModalMode: 'signup',
    });
  });

  test('initSession creates guest account on fresh first launch', async () => {
    await useUserStore.getState().initSession();

    const state = useUserStore.getState();
    expect(state.isGuest).toBe(true);
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBe('mock_guest_token_abc');
    expect(state.user?.user_id).toBe('guest_test_123');
    expect(mockStorage['@zerodaily_auth_token']).toBe('mock_guest_token_abc');
  });

  test('initSession restores cached profile and refreshes from cloud for authenticated user', async () => {
    mockStorage['@zerodaily_auth_token'] = 'valid_saved_token';
    mockStorage['@zerodaily_user_profile'] = JSON.stringify(mockPermUser);

    await useUserStore.getState().initSession();

    const state = useUserStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isGuest).toBe(false);
    expect(state.user?.email).toBe('reader@example.com');
  });

  test('initSession preserves cached profile when offline or network error occurs', async () => {
    mockStorage['@zerodaily_auth_token'] = 'network_error_token';
    mockStorage['@zerodaily_user_profile'] = JSON.stringify(mockPermUser);

    await useUserStore.getState().initSession();

    const state = useUserStore.getState();
    // Must remain authenticated as mockPermUser and NOT wipe credentials or switch to guest
    expect(state.isAuthenticated).toBe(true);
    expect(state.isGuest).toBe(false);
    expect(state.token).toBe('network_error_token');
    expect(state.user?.email).toBe('reader@example.com');
    expect(mockStorage['@zerodaily_auth_token']).toBe('network_error_token');
  });

  test('initSession clears session and creates guest when token is unauthorized (401)', async () => {
    mockStorage['@zerodaily_auth_token'] = 'invalid_token';
    mockStorage['@zerodaily_user_profile'] = JSON.stringify(mockPermUser);

    await useUserStore.getState().initSession();

    const state = useUserStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isGuest).toBe(true);
    expect(state.token).toBe('mock_guest_token_abc');
    expect(mockStorage['@zerodaily_auth_token']).toBe('mock_guest_token_abc');
  });

  test('openAuthModal and closeAuthModal control presentation state', () => {
    expect(useUserStore.getState().isAuthModalOpen).toBe(false);

    useUserStore.getState().openAuthModal('signin');
    expect(useUserStore.getState().isAuthModalOpen).toBe(true);
    expect(useUserStore.getState().authModalMode).toBe('signin');

    useUserStore.getState().closeAuthModal();
    expect(useUserStore.getState().isAuthModalOpen).toBe(false);
  });

  test('signUp successfully transitions from guest to permanent account', async () => {
    useUserStore.setState({
      token: 'mock_guest_token_abc',
      user: mockGuestUser,
      isGuest: true,
      isAuthenticated: false,
    });

    const res = await useUserStore.getState().signUp('new@example.com', 'SecurePass123', 'My Nickname');
    expect(res.success).toBe(true);

    const state = useUserStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isGuest).toBe(false);
    expect(state.token).toBe('mock_registered_token_xyz');
    expect(state.user?.email).toBe('new@example.com');
    expect(state.user?.display_name).toBe('My Nickname');
    expect(mockStorage['@zerodaily_auth_token']).toBe('mock_registered_token_xyz');
  });

  test('signIn handles successful login and populates user session', async () => {
    useUserStore.setState({
      token: 'mock_guest_token_abc',
      user: mockGuestUser,
      isGuest: true,
      isAuthenticated: false,
    });

    const res = await useUserStore.getState().signIn('reader@example.com', 'CorrectPass123');
    expect(res.success).toBe(true);

    const state = useUserStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isGuest).toBe(false);
    expect(state.token).toBe('mock_login_token_789');
    expect(state.user?.user_id).toBe('usr_registered_456');
  });

  test('signIn handles login failure gracefully', async () => {
    const res = await useUserStore.getState().signIn('reader@example.com', 'wrong');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Invalid credentials');

    const state = useUserStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });

  test('signOut removes credentials and creates seamless anonymous guest session', async () => {
    useUserStore.setState({
      token: 'mock_login_token_789',
      user: mockPermUser,
      isAuthenticated: true,
      isGuest: false,
    });

    await useUserStore.getState().signOut();

    const state = useUserStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isGuest).toBe(true);
    expect(state.token).toBe('mock_guest_token_abc');
    expect(state.user?.is_anonymous).toBe(true);
  });

  test('trackEvent updates algo_weights, increments reading count, and persists profile', async () => {
    useUserStore.setState({
      token: 'valid_token',
      user: { ...mockPermUser, reading_count: 5 },
      isAuthenticated: true,
      isGuest: false,
    });

    await useUserStore.getState().trackEvent('https://example.com/art', 'ai', 'full_roast', 12.0);

    const state = useUserStore.getState();
    expect(state.user?.algo_weights.ai).toBe(1.45);
    expect(state.user?.reading_count).toBe(6);
    expect(mockStorage['@zerodaily_user_profile']).toContain('"reading_count":6');
  });

  test('syncBookmarks in replace mode persists updated list to storage', async () => {
    useUserStore.setState({
      token: 'valid_token',
      user: { ...mockPermUser, bookmarked_articles: ['art1', 'art2'] },
      isAuthenticated: true,
      isGuest: false,
    });

    const res = await useUserStore.getState().syncBookmarks(['art2'], 'replace');
    expect(res).toEqual(['art2']);
    expect(useUserStore.getState().user?.bookmarked_articles).toEqual(['art2']);
    expect(mockStorage['@zerodaily_user_profile']).toContain('"bookmarked_articles":["art2"]');
  });

  test('updatePreferences updates topic preferences locally and remotely', async () => {
    useUserStore.setState({
      token: 'valid_token',
      user: mockPermUser,
      isAuthenticated: true,
      isGuest: false,
    });

    await useUserStore.getState().updatePreferences({ ai: true, cybersec: false });

    const state = useUserStore.getState();
    expect(state.user?.topic_preferences.cybersec).toBe(false);
  });

  test('deleteAccount schedules deletion, wipes user session & bookmarks, and provisions fresh guest session', async () => {
    useUserStore.setState({
      token: 'mock_login_token_789',
      user: mockPermUser,
      isAuthenticated: true,
      isGuest: false,
    });
    mockStorage['@zerodaily_auth_token'] = 'mock_login_token_789';
    mockStorage['@zerodaily_user_profile'] = JSON.stringify(mockPermUser);

    const res = await useUserStore.getState().deleteAccount();
    expect(res.success).toBe(true);
    expect(res.message).toContain('24 hours');

    const state = useUserStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isGuest).toBe(true);
    expect(state.token).toBe('mock_guest_token_abc');
    expect(state.user?.is_anonymous).toBe(true);
    expect(mockStorage['@zerodaily_auth_token']).toBe('mock_guest_token_abc');
  });

  test('deleteAccount fails gracefully when backend returns error', async () => {
    useUserStore.setState({
      token: 'error_token',
      user: mockPermUser,
      isAuthenticated: true,
      isGuest: false,
    });

    const res = await useUserStore.getState().deleteAccount();
    expect(res.success).toBe(false);
    expect(res.message).toBe('Failed to delete account');

    const state = useUserStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('error_token');
  });

  test('deleteAccount returns failure if user is not authenticated', async () => {
    useUserStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
    });

    const res = await useUserStore.getState().deleteAccount();
    expect(res.success).toBe(false);
    expect(res.message).toBe('Not authenticated');
  });
});
