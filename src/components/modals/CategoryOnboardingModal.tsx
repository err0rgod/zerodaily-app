import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CATEGORY_LIST } from '../../constants/categories';
import { registerForPushNotificationsAsync } from '../../services/notificationService';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../store/themeStore';
import { CategoryKey } from '../../types';

export const ONBOARDING_COMPLETED_KEY = '@zerodaily_onboarding_completed';

// 7 individual categories available for selection (excluding 'all' feed)
const NOTIFICATION_CATEGORIES = CATEGORY_LIST.filter((c) => c.key !== 'all');

interface CategoryOnboardingModalProps {
  visible?: boolean;
  onComplete?: () => void;
}

export const CategoryOnboardingModal: React.FC<CategoryOnboardingModalProps> = ({
  visible: propVisible,
  onComplete,
}) => {
  const { colors, isDark } = useTheme();
  const setInitialCategories = useSettingsStore((s) => s.setInitialCategories);

  const [internalVisible, setInternalVisible] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(propVisible === undefined);
  const [selectedCategories, setSelectedCategories] = useState<CategoryKey[]>([
    'cybersec',
    'ai',
    'programming',
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (propVisible !== undefined) {
      setIsCheckingStatus(false);
      return;
    }
    async function checkFirstLaunch() {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
        if (completed !== 'true') {
          // First launch: present modal to user
          setInternalVisible(true);
        }
      } catch (err) {
        console.warn('[CategoryOnboardingModal] Failed to read onboarding status:', err);
      } finally {
        setIsCheckingStatus(false);
      }
    }

    checkFirstLaunch();
  }, [propVisible]);

  const isModalVisible = propVisible !== undefined ? propVisible : internalVisible;

  const handleToggleCategory = (categoryKey: CategoryKey) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }

    setSelectedCategories((prev) => {
      if (prev.includes(categoryKey)) {
        return prev.filter((k) => k !== categoryKey);
      } else {
        return [...prev, categoryKey];
      }
    });
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      // 1. Request notification permissions & register device token
      await registerForPushNotificationsAsync().catch((err) => {
        console.warn('[CategoryOnboardingModal] Push registration warning:', err);
      });

      // 2. Persist preferences & subscribe token to backend topics
      await setInitialCategories(selectedCategories);

      // 3. Mark onboarding completed permanently
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');

      // 4. Dismiss modal
      setInternalVisible(false);
      onComplete?.();
    } catch (err) {
      console.error('[CategoryOnboardingModal] Error completing onboarding:', err);
      // Even if network fails, don't trap the user forever
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true').catch(() => {});
      setInternalVisible(false);
      onComplete?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingStatus || !isModalVisible) {
    return null;
  }

  return (
    <Modal
      visible={isModalVisible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => {
        // Prevent accidental hardware back dismissal on Android without choosing
      }}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          {/* Minimal Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Select your interests
            </Text>
          </View>

          {/* Category Grid Boxes */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.gridContainer}>
              {NOTIFICATION_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat.key);
                const catColor = colors[cat.key] || cat.accentColor;

                return (
                  <TouchableOpacity
                    key={cat.key}
                    activeOpacity={0.78}
                    onPress={() => handleToggleCategory(cat.key)}
                    style={[
                      styles.channelBox,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? '#161616'
                            : '#F1F5F9'
                          : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: isSelected ? 1.5 : 1,
                      },
                    ]}
                  >
                    <View style={styles.boxHeaderRow}>
                      <View style={[styles.boxDot, { backgroundColor: catColor }]} />
                      <View
                        style={[
                          styles.boxCheckCircle,
                          {
                            backgroundColor: isSelected ? colors.primary : 'transparent',
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.boxTitle,
                        {
                          color: colors.textPrimary,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>

                    <Text
                      style={[styles.boxDescription, { color: colors.textMuted }]}
                      numberOfLines={2}
                    >
                      {cat.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleConfirm}
              disabled={isSubmitting}
              style={[
                styles.continueBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.continueBtnText}>
                  {selectedCategories.length > 0 ? 'Start Reading' : 'Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  channelBox: {
    width: '48.5%',
    padding: 13,
    borderRadius: 15,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  boxHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  boxDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  boxCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxTitle: {
    fontSize: 14.5,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  boxDescription: {
    fontSize: 11.5,
    lineHeight: 15.5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 16 : 20,
    borderTopWidth: 1,
  },
  continueBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
