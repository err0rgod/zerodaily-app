import { Image } from 'expo-image';
import { Bell, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchArticleById, fetchNotificationHistory } from '../../api/client';
import { CATEGORIES } from '../../constants/categories';
import { THEME } from '../../constants/theme';
import { useFeedStore } from '../../store/feedStore';
import { NotificationItem } from '../../types';
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { setArticleDirectly } = useFeedStore();

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetchNotificationHistory(20)
        .then((res) => setNotifications(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const handleSelectNotification = async (item: NotificationItem) => {
    const article = await fetchArticleById(item.article_id);
    if (article) {
      setArticleDirectly(article);
      onClose();
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const categoryMeta = CATEGORIES[item.category] || CATEGORIES.all;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleSelectNotification(item)}
        style={styles.itemContainer}
      >
        <Image
          source={{ uri: item.image_url }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.itemContent}>
          <View style={styles.itemMeta}>
            <Badge
              label={categoryMeta.name}
              color={categoryMeta.accentColor}
              size="sm"
            />
            <Text style={styles.timeText}>{formatRelativeTime(item.published_at)}</Text>
          </View>
          <Text style={styles.heading} numberOfLines={2}>
            {item.heading}
          </Text>
          <Text style={styles.punchline} numberOfLines={1}>
            {item.push_punchline}
          </Text>
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Bell size={20} color={THEME.colors.primary} />
              <Text style={styles.modalTitle}>Breaking Alerts Inbox</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={THEME.colors.primary} />
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item, idx) => `${item.article_id}_${idx}`}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No recent breaking alerts.</Text>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: THEME.spacing.md,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.card,
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
  timeText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  heading: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    lineHeight: 18,
  },
  punchline: {
    fontSize: THEME.typography.sizes.xs,
    color: THEME.colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.sm,
  },
});
