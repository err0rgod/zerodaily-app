import AsyncStorage from '@react-native-async-storage/async-storage';
import { AlertCircle, Bell, Settings, Trash2, X } from 'lucide-react-native';
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
import { THEME } from '../../constants/theme';
import { useSettingsStore } from '../../store/settingsStore';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { preferences, toggleCategoryNotification, toggleBreakingAll } = useSettingsStore();

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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Settings size={20} color={THEME.colors.textPrimary} />
              <Text style={styles.modalTitle}>Settings & Preferences</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.contentContainer}>
            {/* Notification Philosophy Banner */}
            <View style={styles.infoBanner}>
              <Bell size={18} color={THEME.colors.primary} />
              <Text style={styles.infoText}>
                ZeroDaily utilizes client-managed FCM topics. Your device subscribes directly to alert channels with zero server token tracking.
              </Text>
            </View>

            {/* Section: Breaking Alerts */}
            <Text style={styles.sectionHeader}>PUSH NOTIFICATION TOPICS</Text>

            {/* All Breaking Catch-All */}
            <View style={styles.preferenceRow}>
              <View style={styles.prefTextCol}>
                <Text style={styles.prefTitle}>All Breaking News (Global)</Text>
                <Text style={styles.prefSub}>Subscribes to topic_breaking_all</Text>
              </View>
              <Switch
                value={preferences.breaking_all}
                onValueChange={toggleBreakingAll}
                trackColor={{ false: THEME.colors.surface, true: THEME.colors.primary }}
                thumbColor={THEME.colors.textPrimary}
              />
            </View>

            {/* Individual Categories */}
            {CATEGORY_LIST.filter((c) => c.key !== 'all').map((category) => {
              const isEnabled = preferences[category.key];
              return (
                <View key={category.key} style={styles.preferenceRow}>
                  <View style={styles.prefTextCol}>
                    <View style={styles.catRow}>
                      <View style={[styles.colorDot, { backgroundColor: category.accentColor }]} />
                      <Text style={styles.prefTitle}>{category.name}</Text>
                    </View>
                    <Text style={styles.prefSub}>Topic: {category.fcmTopic}</Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleCategoryNotification(category.key)}
                    trackColor={{ false: THEME.colors.surface, true: category.accentColor }}
                    thumbColor={THEME.colors.textPrimary}
                  />
                </View>
              );
            })}

            {/* Section: Storage & Maintenance */}
            <Text style={[styles.sectionHeader, { marginTop: 24 }]}>STORAGE & CACHE</Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleClearCache}
              style={styles.actionItem}
            >
              <Trash2 size={18} color={THEME.colors.danger} />
              <View style={styles.prefTextCol}>
                <Text style={[styles.prefTitle, { color: THEME.colors.danger }]}>Clear Offline Story Cache</Text>
                <Text style={styles.prefSub}>Purges cached feed cards to reclaim local device space</Text>
              </View>
            </TouchableOpacity>

            {/* About Info */}
            <View style={styles.aboutFooter}>
              <AlertCircle size={14} color={THEME.colors.textMuted} />
              <Text style={styles.aboutText}>ZeroDaily Mobile • v1.0.0 • api.zerodaily.in</Text>
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
    backgroundColor: THEME.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.surface,
  },
  scrollArea: {
    flex: 1,
  },
  contentContainer: {
    padding: THEME.spacing.md,
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: `${THEME.colors.primary}15`,
    borderWidth: 1,
    borderColor: `${THEME.colors.primary}40`,
    borderRadius: THEME.radii.md,
    padding: 12,
    marginBottom: 20,
    gap: 10,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: THEME.typography.sizes.xs,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: THEME.radii.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: THEME.radii.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
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
    fontSize: THEME.typography.sizes.base,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  prefSub: {
    fontSize: THEME.typography.sizes.xs,
    color: THEME.colors.textMuted,
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
    fontSize: THEME.typography.sizes.xs,
    color: THEME.colors.textMuted,
  },
});
