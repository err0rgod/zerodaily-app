import AsyncStorage from '@react-native-async-storage/async-storage';
import { AlertCircle, Bell, Moon, Settings, Smartphone, Sun, Trash2, X } from 'lucide-react-native';
import React from 'react';
import {
  Alert,
  Modal,
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

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { preferences, toggleCategoryNotification, toggleBreakingAll } = useSettingsStore();
  const { colors, themeMode, setThemeMode } = useTheme();

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
                <Text style={[styles.prefSub, { color: colors.textMuted }]}>Subscribes to topic_breaking_all</Text>
              </View>
              <Switch
                value={preferences.breaking_all}
                onValueChange={toggleBreakingAll}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.textPrimary}
              />
            </View>

            {/* Individual Categories */}
            {CATEGORY_LIST.filter((c) => c.key !== 'all').map((category) => {
              const isEnabled = preferences[category.key];
              const catColor = colors[category.key] || category.accentColor;
              return (
                <View
                  key={category.key}
                  style={[styles.preferenceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.prefTextCol}>
                    <View style={styles.catRow}>
                      <View style={[styles.colorDot, { backgroundColor: catColor }]} />
                      <Text style={[styles.prefTitle, { color: colors.textPrimary }]}>{category.name}</Text>
                    </View>
                    <Text style={[styles.prefSub, { color: colors.textMuted }]}>Topic: {category.fcmTopic}</Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleCategoryNotification(category.key)}
                    trackColor={{ false: colors.border, true: catColor }}
                    thumbColor={colors.textPrimary}
                  />
                </View>
              );
            })}

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
});
