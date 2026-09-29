import * as Haptics from 'expo-haptics';
import {
  AlertCircle,
  LogIn,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
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
import { useSettingsStore } from '../../store/settingsStore';
import { ThemeMode, useTheme } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { preferences, toggleCategoryNotification } = useSettingsStore();
  const { colors, themeMode, setThemeMode, isDark } = useTheme();
  const { user, isAuthenticated, isLoading, signOut, deleteAccount, openAuthModal } = useUserStore();
  const [scrollKey, setScrollKey] = useState<number>(0);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setScrollKey((k) => k + 1);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible]);

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={() => {
        setScrollKey((k) => k + 1);
      }}
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

          <ScrollView
            key={scrollKey}
            style={styles.scrollArea}
            contentContainerStyle={[styles.contentContainer, { flexGrow: 1 }]}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                          Active
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.accountActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={handleSignOut}
                      disabled={isLoading}
                      style={[
                        styles.signOutBtn,
                        { borderColor: `${colors.textSecondary}40`, backgroundColor: `${colors.textSecondary}10` },
                        isLoading && { opacity: 0.6 },
                      ]}
                    >
                      <LogOut size={15} color={colors.textSecondary} />
                      <Text style={[styles.signOutBtnText, { color: colors.textSecondary }]}>Sign Out</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={handleDeleteAccount}
                      disabled={isLoading}
                      style={[
                        styles.deleteAccountBtn,
                        { borderColor: `${colors.danger}40`, backgroundColor: `${colors.danger}10` },
                        isLoading && { opacity: 0.6 },
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

            {/* Section: Push Notification Channels */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>NOTIFICATION CHANNELS</Text>

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
  prefTextCol: {
    flex: 1,
    marginRight: 10,
  },
  prefTitle: {
    fontSize: 15,
    fontWeight: '600',
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
});
