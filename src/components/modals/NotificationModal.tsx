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
import { CATEGORIES, DEFAULT_FALLBACK_IMAGE } from '../../constants/categories';
import { useFeedStore } from '../../store/feedStore';
import { useTheme } from '../../store/themeStore';
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
  const { colors } = useTheme();
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
    const fallback = categoryMeta.fallbackImage || DEFAULT_FALLBACK_IMAGE;
    const imageUri = (item.image_url && item.image_url.trim().length > 0) ? item.image_url : fallback;
    const catColor = colors[item.category] || categoryMeta.accentColor;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleSelectNotification(item)}
        style={[styles.itemContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Image
          source={{ uri: imageUri }}
          style={[styles.thumbnail, { backgroundColor: colors.cardBorder }]}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.itemContent}>
          <View style={styles.itemMeta}>
            <Badge
              label={categoryMeta.name}
              color={catColor}
              size="sm"
            />
            <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatRelativeTime(item.published_at)}</Text>
          </View>
          <Text style={[styles.heading, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.heading}
          </Text>
          <Text style={[styles.punchline, { color: colors.primary }]} numberOfLines={1}>
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
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.titleRow}>
              <Bell size={20} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Breaking Alerts Inbox</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
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
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent breaking alerts.</Text>
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
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 9999,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
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
    fontWeight: '500',
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  punchline: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
  },
});
