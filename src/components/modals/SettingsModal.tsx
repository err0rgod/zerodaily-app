import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  AlertCircle,
  Bell,
  Check,
  Copy,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CATEGORY_LIST } from '../../constants/categories';
import {
  registerForPushNotificationsAsync,
  scheduleTestBreakingAlert,
} from '../../services/notificationService';
import { useSettingsStore } from '../../store/settingsStore';
import { ThemeMode, useTheme } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

let cachedFcmToken: string | null = null;

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { preferences, toggleCategoryNotification, toggleBreakingAll } = useSettingsStore();
  const { colors, themeMode, setThemeMode, isDark } = useTheme();
  const { user, isAuthenticated, isGuest, signOut, deleteAccount, openAuthModal } = useUserStore();
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [fcmToken, setFcmToken] = useState<string | null>(cachedFcmToken);
  const [isCheckingFcm, setIsCheckingFcm] = useState<boolean>(false);
  const [hasCopiedToken, setHasCopiedToken] = useState<boolean>(false);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your saved roasts and bookmarks will remain safely stored in your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
            await signOut();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? You will have a 24-hour grace period to log back in to cancel deletion and reactivate your account. After 24 hours, your account and saved roasts will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            }
            const res = await deleteAccount();
            if (res.success) {
              Alert.alert(
                'Account Deletion Scheduled',
                res.message || 'Your account is scheduled for deletion. You have 24 hours to log back in to cancel deletion and restore your account.'
              );
            } else {
              Alert.alert('Error', res.message || 'Could not schedule account deletion.');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (visible && !fcmToken) {
      registerForPushNotificationsAsync().then((t) => {
        if (t) {
          cachedFcmToken = t;
          setFcmToken(t);
        }
      }).catch(() => {});
    }
  }, [visible, fcmToken]);

  const handleCopyFcmToken = async () => {
    if (!fcmToken) {
      await handleCheckFcmDiagnostics();
      return;
    }

    await Clipboard.setStringAsync(fcmToken);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setHasCopiedToken(true);
    setTimeout(() => setHasCopiedToken(false), 2500);
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Local Cache',
      'This will remove all locally stored stories and reset offline caches.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys();
              const feedKeys = keys.filter((k) => k.startsWith('@zerodaily_feed_cache_'));
              await AsyncStorage.multiRemove(feedKeys);
              Alert.alert('Cache Cleared', 'Offline feeds will refresh on next visit.');
            } catch (err) {
              console.warn('Failed to clear cache:', err);
            }
          },
        },
      ]
    );
  };

  const handleSendTestAlert = async () => {
    if (isSendingTest) return;
    setIsSendingTest(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      await scheduleTestBreakingAlert('cybersec', 2);
      Alert.alert(
        'Test Alert Scheduled',
        'A breaking alert notification will arrive in 2 seconds. Minimize or lock your phone to observe the banner!'
      );
    } catch {
      Alert.alert('Error', 'Unable to trigger test notification. Check app permissions.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleCheckFcmDiagnostics = async () => {
    if (isCheckingFcm) return;
    setIsCheckingFcm(true);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }

    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        cachedFcmToken = token;
        setFcmToken(token);
        const synced = await useSettingsStore.getState().syncSubscriptions(token);
        Alert.alert(
          'FCM Device Registration',
          `Your device push token was retrieved!\n\nTopic Subscriptions: ${synced ? 'Active (Connected to backend)' : 'Pending server response'}\n\nToken:\n${token}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'FCM Registration Check',
          'Could not retrieve an FCM token. Please verify that Notification permissions are allowed in your Android phone settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      Alert.alert(
        'FCM Registration Error',
        `Error communicating with Firebase Cloud Messaging:\n${err?.message || String(err)}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsCheckingFcm(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.titleRow}>
              <Settings size={20} color={colors.textPrimary} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Settings & Preferences</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.contentContainer}>
            {/* Section: User Account & Profile */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>ACCOUNT & PROFILE</Text>
            <View style={[styles.accountCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {isAuthenticated && user ? (
                <View style={styles.accountContent}>
                  <View style={styles.accountTopRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: colors.primarySoft }]}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {(user.display_name || user.email || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.accountDetails}>
                      <Text style={[styles.accountName, { color: colors.textPrimary }]}>
                        {user.display_name || 'ZeroDaily Reader'}
                      </Text>
                      <Text style={[styles.accountEmail, { color: colors.textMuted }]}>
                        {user.email}
                      </Text>
                      <View style={styles.badgeRow}>
                        <ShieldCheck size={12} color={colors.primary} />
                        <Text style={[styles.badgeText, { color: colors.primary }]}>
                          Active • {user.reading_count} roasts read
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.accountActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={handleSignOut}
                      style={[
                        styles.signOutBtn,
                        { borderColor: `${colors.textSecondary}40`, backgroundColor: `${colors.textSecondary}10` },
                      ]}
                    >
                      <LogOut size={15} color={colors.textSecondary} />
                      <Text style={[styles.signOutBtnText, { color: colors.textSecondary }]}>Sign Out</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={handleDeleteAccount}
                      style={[
                        styles.deleteAccountBtn,
                        { borderColor: `${colors.danger}40`, backgroundColor: `${colors.danger}10` },
                      ]}
                    >
                      <Trash2 size={15} color={colors.danger} />
                      <Text style={[styles.deleteAccountBtnText, { color: colors.danger }]}>Delete Account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.accountContent}>
                  <View style={styles.accountTopRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: `${colors.textMuted}20` }]}>
                      <User size={22} color={colors.textMuted} />
                    </View>
                    <View style={styles.accountDetails}>
                      <Text style={[styles.accountName, { color: colors.textPrimary }]}>
                        Guest Reader
                      </Text>
                      <Text style={[styles.accountEmail, { color: colors.textMuted }]}>
                        Sign in to sync saved roasts, train your feed roast algorithm, and read seamlessly across devices.
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        openAuthModal('signup');
                      }, 300);
                    }}
                    style={[styles.signInBtn, { backgroundColor: colors.primary }]}
                  >
                    <LogIn size={15} color="#FFFFFF" />
                    <Text style={styles.signInBtnText}>Create Account / Sign In</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Section: Appearance & Color Mode */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>APPEARANCE & THEME</Text>
            <View style={[styles.themeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => {
                const isActive = themeMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    activeOpacity={0.75}
                    onPress={() => setThemeMode(mode)}
                    style={[
                      styles.themeBtn,
                      isActive && {
                        backgroundColor: colors.primarySoft,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    {mode === 'dark' && (
                      <Moon size={16} color={isActive ? colors.primary : colors.textSecondary} />
                    )}
                    {mode === 'light' && (
                      <Sun size={16} color={isActive ? colors.primary : colors.textSecondary} />
                    )}
                    {mode === 'system' && (
                      <Smartphone size={16} color={isActive ? colors.primary : colors.textSecondary} />
                    )}
                    <Text
                      style={[
                        styles.themeBtnText,
                        {
                          color: isActive ? colors.primary : colors.textSecondary,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notification Philosophy Banner */}
            <View
              style={[
                styles.infoBanner,
                {
                  backgroundColor: colors.primarySoft,
                  borderColor: `${colors.primary}35`,
                },
              ]}
            >
              <Bell size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                ZeroDaily utilizes client-managed FCM topics. Your device subscribes directly to alert channels with zero server token tracking.
              </Text>
            </View>

            {/* Section: Push Notification Channels */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>PUSH NOTIFICATION TOPICS</Text>

            {/* All Breaking Catch-All */}
            <View style={[styles.preferenceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.prefTextCol}>
                <Text style={[styles.prefTitle, { color: colors.textPrimary }]}>All Breaking News (Global)</Text>
                <Text style={[styles.prefSub, { color: colors.textMuted }]}>Alerts across all tech domains</Text>
              </View>
              <Switch
                value={preferences.breaking_all}
                onValueChange={toggleBreakingAll}
                trackColor={{ false: isDark ? '#27272A' : '#E4E4E7', true: isDark ? '#3F3F46' : '#71717A' }}
                thumbColor={preferences.breaking_all ? (isDark ? '#FFFFFF' : '#0F172A') : (isDark ? '#71717A' : '#94A3B8')}
              />
            </View>

            {/* Individual Categories */}
            {CATEGORY_LIST.filter((c) => c.key !== 'all').map((category) => {
              const isEnabled = preferences[category.key];
              return (
                <View
                  key={category.key}
                  style={[styles.preferenceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.prefTextCol}>
                    <Text style={[styles.prefTitle, { color: colors.textPrimary }]}>{category.name}</Text>
                    <Text style={[styles.prefSub, { color: colors.textMuted }]}>Topic: {category.fcmTopic}</Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleCategoryNotification(category.key)}
                    trackColor={{ false: isDark ? '#27272A' : '#E4E4E7', true: isDark ? '#3F3F46' : '#71717A' }}
                    thumbColor={isEnabled ? (isDark ? '#FFFFFF' : '#0F172A') : (isDark ? '#71717A' : '#94A3B8')}
                  />
                </View>
              );
            })}

            {/* Test Notification Action */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleSendTestAlert}
              disabled={isSendingTest}
              style={[
                styles.actionItem,
                {
                  backgroundColor: `${colors.primary}12`,
                  borderColor: colors.primary,
                  marginTop: 4,
                },
              ]}
            >
              {isSendingTest ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Zap size={18} color={colors.primary} />
              )}
              <View style={styles.prefTextCol}>
                <Text style={[styles.prefTitle, { color: colors.primary }]}>Send Test Breaking Alert</Text>
                <Text style={[styles.prefSub, { color: colors.textMuted }]}>
                  Triggers an instant 2-second alert banner with sound & vibration
                </Text>
              </View>
            </TouchableOpacity>

            {/* FCM Token Diagnostics & Device Token Display Card */}
            <View style={[styles.tokenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.tokenCardHeader}>
                <View style={styles.tokenStatusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: fcmToken ? colors.primary : isCheckingFcm ? colors.warning : colors.textMuted },
                    ]}
                  />
                  <Text style={[styles.tokenStatusText, { color: colors.textPrimary }]}>
                    {fcmToken ? 'Connected to Firebase' : isCheckingFcm ? 'Querying Token...' : 'Registration Pending'}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleCheckFcmDiagnostics}
                  disabled={isCheckingFcm}
                  style={[styles.refreshPill, { borderColor: colors.border, backgroundColor: colors.background }]}
                >
                  {isCheckingFcm ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <RefreshCw size={12} color={colors.textSecondary} />
                      <Text style={[styles.refreshPillText, { color: colors.textSecondary }]}>Refresh</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Monospace Token Box */}
              <View style={[styles.tokenBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text
                  selectable={true}
                  style={[styles.tokenValueText, { color: fcmToken ? colors.textPrimary : colors.textMuted }]}
                  numberOfLines={3}
                >
                  {fcmToken || 'Tap "Refresh" to query native FCM push token from Google Play Services.'}
                </Text>
              </View>

              {/* Action Buttons: Copy Token */}
              <View style={styles.tokenActionRow}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleCopyFcmToken}
                  disabled={isCheckingFcm}
                  style={[
                    styles.copyTokenBtn,
                    {
                      backgroundColor: hasCopiedToken ? colors.primary : `${colors.primary}18`,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  {hasCopiedToken ? (
                    <Check size={15} color="#FFFFFF" />
                  ) : (
                    <Copy size={15} color={colors.primary} />
                  )}
                  <Text
                    style={[
                      styles.copyTokenBtnText,
                      { color: hasCopiedToken ? '#FFFFFF' : colors.primary },
                    ]}
                  >
                    {hasCopiedToken ? 'Copied Token to Clipboard!' : 'Copy Device Push Token'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.tokenHelperText, { color: colors.textMuted }]}>
                Paste this token into Firebase Console &gt; Cloud Messaging &gt; &quot;Send test message&quot; to test instant 2-second push delivery to this device.
              </Text>
            </View>

            {/* Section: Storage & Maintenance */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted, marginTop: 24 }]}>
              STORAGE & CACHE
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleClearCache}
              style={[styles.actionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Trash2 size={18} color={colors.danger} />
              <View style={styles.prefTextCol}>
                <Text style={[styles.prefTitle, { color: colors.danger }]}>Clear Offline Story Cache</Text>
                <Text style={[styles.prefSub, { color: colors.textMuted }]}>
                  Purges cached feed cards to reclaim local device space
                </Text>
              </View>
            </TouchableOpacity>

            {/* About Info */}
            <View style={styles.aboutFooter}>
              <AlertCircle size={14} color={colors.textMuted} />
              <Text style={[styles.aboutText, { color: colors.textMuted }]}>
                ZeroDaily Mobile • v1.0.0 • api.zerodaily.in
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 9999,
  },
  scrollArea: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  accountCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  accountContent: {
    gap: 14,
  },
  accountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  accountDetails: {
    flex: 1,
    gap: 3,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
  },
  accountEmail: {
    fontSize: 13,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  accountActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  signOutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteAccountBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  deleteAccountBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  themeRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 6,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  themeBtnText: {
    fontSize: 13,
  },
  infoBanner: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 10,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  prefTextCol: {
    flex: 1,
    marginRight: 10,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  prefTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  prefSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  aboutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 30,
  },
  aboutText: {
    fontSize: 11.5,
  },
  tokenCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
    gap: 12,
  },
  tokenCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tokenStatusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  refreshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  refreshPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tokenBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  tokenValueText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  tokenActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyTokenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
  },
  copyTokenBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  tokenHelperText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
