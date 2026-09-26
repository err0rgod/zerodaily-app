import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import {
  AlertCircle,
  Bell,
  Check,
  Copy,
  Moon,
  RefreshCw,
  Settings,
  Smartphone,
  Sun,
  Trash2,
  X,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Hoisted: filtering on every render rebuilt this list needlessly. */
const NOTIFICATION_CATEGORIES = CATEGORY_LIST.filter((c) => c.key !== 'all');

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  // Granular selectors — a `useSettingsStore()` call with no selector would
  // re-render this whole modal on every unrelated store write.
  const preferences = useSettingsStore((s) => s.preferences);
  const toggleCategoryNotification = useSettingsStore((s) => s.toggleCategoryNotification);
  const toggleBreakingAll = useSettingsStore((s) => s.toggleBreakingAll);

  const { colors, themeMode, setThemeMode, isDark } = useTheme();

  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isCheckingFcm, setIsCheckingFcm] = useState<boolean>(false);
  const [hasCopiedToken, setHasCopiedToken] = useState<boolean>(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    },
    []
  );

  // The push token is only surfaced in development builds.
  useEffect(() => {
    if (!__DEV__ || !visible || fcmToken) return;
    registerForPushNotificationsAsync()
      .then((t) => {
        if (t) setFcmToken(t);
      })
      .catch(() => {});
  }, [visible, fcmToken]);

  const handleCopyFcmToken = useCallback(async () => {
    if (!fcmToken) return;
    await Clipboard.setStringAsync(fcmToken);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setHasCopiedToken(true);
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setHasCopiedToken(false), 2500);
  }, [fcmToken]);

  const handleClearCache = useCallback(() => {
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
  }, []);

  const handleSendTestAlert = useCallback(async () => {
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
  }, [isSendingTest]);

  const handleCheckFcmDiagnostics = useCallback(async () => {
    if (isCheckingFcm) return;
    setIsCheckingFcm(true);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }

    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setFcmToken(token);
        const synced = await useSettingsStore.getState().syncSubscriptions(token);
        Alert.alert(
          'FCM Device Registration',
          `Your device push token was retrieved!\n\nTopic Subscriptions: ${
            synced ? 'Active (Connected to backend)' : 'Pending server response'
          }\n\nToken:\n${token}`,
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
  }, [isCheckingFcm]);

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
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Settings & Preferences
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.contentContainer}>
            {/* Appearance */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
              APPEARANCE & THEME
            </Text>
            <View
              style={[styles.themeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => {
                const isActive = themeMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    activeOpacity={0.75}
                    onPress={() => setThemeMode(mode)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
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

            {/* Notification channels */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
              PUSH NOTIFICATION TOPICS
            </Text>

            <View
              style={[styles.infoBanner, { backgroundColor: colors.primarySoft, borderColor: `${colors.primary}35` }]}
            >
              <Bell size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Your device subscribes directly to alert channels. Turn off anything you don&apos;t want
                to be interrupted by.
              </Text>
            </View>

            {/* All breaking catch-all */}
            <View
              style={[styles.preferenceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.prefTextCol}>
                <Text style={[styles.prefTitle, { color: colors.textPrimary }]}>
                  All Breaking News (Global)
                </Text>
                <Text style={[styles.prefSub, { color: colors.textMuted }]}>
                  Alerts across all tech domains
                </Text>
              </View>
              <Switch
                value={preferences.breaking_all}
                onValueChange={toggleBreakingAll}
                trackColor={{ false: isDark ? '#27272A' : '#E4E4E7', true: isDark ? '#3F3F46' : '#71717A' }}
                thumbColor={
                  preferences.breaking_all
                    ? isDark
                      ? '#FFFFFF'
                      : '#0F172A'
                    : isDark
                    ? '#71717A'
                    : '#94A3B8'
                }
              />
            </View>

            {/* Per-category channels */}
            {NOTIFICATION_CATEGORIES.map((category) => {
              const isEnabled = preferences[category.key];
              return (
                <View
                  key={category.key}
                  style={[styles.preferenceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.prefTextCol}>
                    <Text style={[styles.prefTitle, { color: colors.textPrimary }]}>
                      {category.name}
                    </Text>
                    <Text style={[styles.prefSub, { color: colors.textMuted }]} numberOfLines={2}>
                      {category.description}
                    </Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleCategoryNotification(category.key)}
                    trackColor={{ false: isDark ? '#27272A' : '#E4E4E7', true: isDark ? '#3F3F46' : '#71717A' }}
                    thumbColor={
                      isEnabled ? (isDark ? '#FFFFFF' : '#0F172A') : isDark ? '#71717A' : '#94A3B8'
                    }
                  />
                </View>
              );
            })}

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
                <Text style={[styles.prefTitle, { color: colors.primary }]}>
                  Send Test Breaking Alert
                </Text>
                <Text style={[styles.prefSub, { color: colors.textMuted }]}>
                  Triggers an instant 2-second alert banner with sound &amp; vibration
                </Text>
              </View>
            </TouchableOpacity>

            {/* Developer-only FCM diagnostics — never rendered in a release build */}
            {__DEV__ && (
              <View
                style={[styles.tokenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.sectionHeader, { color: colors.textMuted, marginBottom: 0 }]}>
                  DEV: FCM TOKEN
                </Text>

                <View style={styles.tokenCardHeader}>
                  <View style={styles.tokenStatusRow}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: fcmToken
                            ? colors.primary
                            : isCheckingFcm
                            ? colors.warning
                            : colors.textMuted,
                        },
                      ]}
                    />
                    <Text style={[styles.tokenStatusText, { color: colors.textPrimary }]}>
                      {fcmToken
                        ? 'Connected to Firebase'
                        : isCheckingFcm
                        ? 'Querying Token...'
                        : 'Registration Pending'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleCheckFcmDiagnostics}
                    disabled={isCheckingFcm}
                    style={[
                      styles.refreshPill,
                      { borderColor: colors.border, backgroundColor: colors.background },
                    ]}
                  >
                    {isCheckingFcm ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <RefreshCw size={12} color={colors.textSecondary} />
                        <Text style={[styles.refreshPillText, { color: colors.textSecondary }]}>
                          Refresh
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <View
                  style={[styles.tokenBox, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text
                    selectable
                    style={[
                      styles.tokenValueText,
                      { color: fcmToken ? colors.textPrimary : colors.textMuted },
                    ]}
                    numberOfLines={3}
                  >
                    {fcmToken || 'Tap "Refresh" to query the native FCM push token.'}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleCopyFcmToken}
                  disabled={isCheckingFcm || !fcmToken}
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
                    {hasCopiedToken ? 'Copied to Clipboard!' : 'Copy Device Push Token'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Storage */}
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
                <Text style={[styles.prefTitle, { color: colors.danger }]}>
                  Clear Offline Story Cache
                </Text>
                <Text style={[styles.prefSub, { color: colors.textMuted }]}>
                  Purges cached feed cards to reclaim local device space
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.aboutFooter}>
              <AlertCircle size={14} color={colors.textMuted} />
              <Text style={[styles.aboutText, { color: colors.textMuted }]}>
                ZeroDaily • v{APP_VERSION}
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
    marginBottom: 16,
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
  prefTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  prefSub: {
    fontSize: 11.5,
    lineHeight: 16,
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
    marginTop: 14,
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
});
