import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import {
  Bell,
  CheckCheck,
  Flame,
  RefreshCw,
  Trash2,
  X,
  Zap,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchArticleById } from '../../api/client';
import { MOCK_ARTICLES } from '../../api/mockData';
import { CATEGORIES, CATEGORY_LIST, getDynamicFallbackImage } from '../../constants/categories';
import { scheduleTestBreakingAlert } from '../../services/notificationService';
import { useFeedStore } from '../../store/feedStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useTheme } from '../../store/themeStore';
import { CategoryKey, NotificationItem } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import { Badge } from '../common/Badge';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const { setArticleDirectly } = useFeedStore();
  const {
    notifications,
    readIds,
    unreadCount,
    isLoading,
    isRefreshing,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
    selectedCategory,
    setSelectedCategory,
  } = useNotificationStore();

  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleSelectNotification = async (item: NotificationItem) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    await markAsRead(item.article_id);

    // 1. Immediate in-memory / local feed / mock search
    const { articles } = useFeedStore.getState();
    let article =
      articles.find((a) => a.id === item.article_id) ||
      MOCK_ARTICLES.find((a) => a.id === item.article_id);

    // 2. Immediate resilient fallback directly from the notification item
    if (!article) {
      article = {
        id: item.article_id,
        category: item.category,
        heading: item.heading,
        shortSummary: item.push_punchline || item.heading,
        fullSummary: item.push_punchline || item.heading,
        published_at: item.published_at || new Date().toISOString(),
        link: item.article_id.startsWith('http') ? item.article_id : 'https://zerodaily.in',
        image_url: item.image_url || '',
        is_breaking: true,
      };
    }

    // 3. Immediately focus article on feed and dismiss the modal (instant 0ms response)
    setArticleDirectly(article);
    onClose();

    // 4. Background network fetch for extended content (if available) without blocking UI
    fetchArticleById(item.article_id)
      .then((fresh) => {
        if (fresh) {
          setArticleDirectly(fresh);
        }
      })
      .catch(() => {});
  };

  const handleDismiss = async (articleId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await dismissNotification(articleId);
  };

  const handleMarkAllRead = async () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await markAllAsRead();
    showToast('All breaking alerts marked as read.');
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Alerts',
      'Are you sure you want to clear your breaking alerts inbox?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllNotifications();
            showToast('Alerts inbox cleared.');
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
      const activeCat = selectedCategory === 'all' ? 'cybersec' : selectedCategory;
      await scheduleTestBreakingAlert(activeCat, 2);
      showToast('Breaking alert firing in 2s! Lock or minimize phone to view banner.');
    } catch (err) {
      console.warn('[ZeroDaily Notifications] Test alert error:', err);
      showToast('Could not schedule alert. Check app notification permissions.');
    } finally {
      setIsSendingTest(false);
    }
  };

  // Category filtering
  const filteredNotifications = selectedCategory === 'all'
    ? notifications
    : notifications.filter((item) => item.category === selectedCategory);

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isUnread = !readIds.has(item.article_id);
    const categoryMeta = CATEGORIES[item.category] || CATEGORIES.all;
    const fallback = getDynamicFallbackImage(item.article_id, item.category);
    const imageUri = (item.image_url && item.image_url.trim().length > 0) ? item.image_url : fallback;
    const catColor = colors[item.category] || categoryMeta.accentColor;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleSelectNotification(item)}
        style={[
          styles.itemContainer,
          {
            backgroundColor: colors.surface,
            borderColor: isUnread ? `${catColor}60` : colors.border,
            borderLeftWidth: isUnread ? 4 : 1,
            borderLeftColor: isUnread ? catColor : colors.border,
          },
        ]}
      >
        <Image
          source={{ uri: imageUri }}
          style={[styles.thumbnail, { backgroundColor: colors.cardBorder }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={styles.itemContent}>
          <View style={styles.itemMeta}>
            <View style={styles.badgeRow}>
              <Badge
                label={categoryMeta.name}
                color={catColor}
                size="sm"
              />
              {isUnread && (
                <View style={[styles.unreadBadge, { backgroundColor: catColor }]}>
                  <Text style={styles.unreadText}>NEW</Text>
                </View>
              )}
            </View>
            <View style={styles.topRightRow}>
              <Text style={[styles.timeText, { color: colors.textMuted }]}>
                {formatRelativeTime(item.published_at)}
              </Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleDismiss(item.article_id)}
                style={styles.dismissBtn}
              >
                <X size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <Text
            style={[
              styles.heading,
              { color: colors.textPrimary, fontWeight: isUnread ? '800' : '600' },
            ]}
            numberOfLines={2}
          >
            {item.heading}
          </Text>

          <View style={styles.punchlineRow}>
            <Flame size={12} color={colors.warning} />
            <Text style={[styles.punchline, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.push_punchline}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
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
              <Bell size={20} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Breaking Alerts
              </Text>
              {unreadCount > 0 && (
                <View style={[styles.countBadge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.countText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Toast Banner */}
          {toastMessage && (
            <View style={[styles.toastBanner, { backgroundColor: colors.primary }]}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          {/* Quick Action Toolbar */}
          <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleSendTestAlert}
              disabled={isSendingTest}
              style={[styles.toolBtn, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }]}
            >
              {isSendingTest ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Zap size={14} color={colors.primary} />
              )}
              <Text style={[styles.toolBtnText, { color: colors.primary }]}>Send Test Alert</Text>
            </TouchableOpacity>

            <View style={styles.toolbarRight}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleMarkAllRead}
                  style={[styles.actionIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <CheckCheck size={14} color={colors.textSecondary} />
                  <Text style={[styles.actionBtnLabel, { color: colors.textSecondary }]}>Read all</Text>
                </TouchableOpacity>
              )}

              {notifications.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleClearAll}
                  style={[styles.actionIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Trash2 size={13} color={colors.danger} />
                  <Text style={[styles.actionBtnLabel, { color: colors.danger }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Category Filter Chips */}
          <View style={styles.filterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
            >
              {CATEGORY_LIST.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                const catAccent = cat.key === 'all' ? colors.primary : (colors[cat.key] || cat.accentColor);

                return (
                  <TouchableOpacity
                    key={cat.key}
                    activeOpacity={0.7}
                    onPress={() => setSelectedCategory(cat.key)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSelected ? `${catAccent}22` : colors.surface,
                        borderColor: isSelected ? catAccent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: isSelected ? catAccent : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {isLoading && notifications.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredNotifications}
              keyExtractor={(item, idx) => `${item.article_id}_${idx}`}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={refreshNotifications}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Bell size={38} color={colors.border} />
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                    No Alerts in {selectedCategory === 'all' ? 'Inbox' : CATEGORIES[selectedCategory]?.name}
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    You'll receive instant push notifications when breaking tech scoops drop.
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={handleSendTestAlert}
                    style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
                  >
                    <Zap size={14} color="#FFFFFF" />
                    <Text style={styles.emptyActionText}>Send Test Breaking Alert</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
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
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 9999,
  },
  toastBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  filterSection: {
    paddingVertical: 8,
  },
  filterList: {
    paddingHorizontal: 14,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 14,
    paddingBottom: 30,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  thumbnail: {
    width: 68,
    height: 68,
    borderRadius: 10,
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  dismissBtn: {
    padding: 2,
  },
  heading: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  punchlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  punchline: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    marginTop: 8,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
