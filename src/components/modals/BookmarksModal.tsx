import { Image } from 'expo-image';
import { Bookmark, Trash2, X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CATEGORIES } from '../../constants/categories';
import { THEME } from '../../constants/theme';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useFeedStore } from '../../store/feedStore';
import { Article } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import { Badge } from '../common/Badge';

interface BookmarksModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BookmarksModal: React.FC<BookmarksModalProps> = ({ visible, onClose }) => {
  const { bookmarks, loadBookmarks, toggleBookmark, clearAllBookmarks } = useBookmarkStore();
  const { setArticleDirectly } = useFeedStore();

  useEffect(() => {
    if (visible) {
      loadBookmarks();
    }
  }, [visible, loadBookmarks]);

  const handleSelectArticle = (article: Article) => {
    setArticleDirectly(article);
    onClose();
  };

  const renderItem = ({ item }: { item: Article }) => {
    const categoryMeta = CATEGORIES[item.category] || CATEGORIES.all;

    return (
      <View style={styles.itemContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleSelectArticle(item)}
          style={styles.clickableRow}
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
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => toggleBookmark(item)}
          style={styles.removeBtn}
        >
          <Trash2 size={16} color={THEME.colors.textMuted} />
        </TouchableOpacity>
      </View>
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
              <Bookmark size={20} color={THEME.colors.primary} />
              <Text style={styles.modalTitle}>Saved Offline Stories</Text>
            </View>
            <View style={styles.actionsRow}>
              {bookmarks.length > 0 && (
                <TouchableOpacity onPress={clearAllBookmarks} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={bookmarks}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Bookmark size={40} color={THEME.colors.borderLight} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No Bookmarks Saved</Text>
                <Text style={styles.emptySub}>
                  Bookmark stories in the feed to read them offline at any time.
                </Text>
              </View>
            }
          />
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.sm,
    backgroundColor: `${THEME.colors.danger}20`,
  },
  clearBtnText: {
    color: THEME.colors.danger,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.surface,
  },
  listContent: {
    padding: THEME.spacing.md,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
  },
  clickableRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.card,
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
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
  removeBtn: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: THEME.spacing.lg,
  },
  emptyTitle: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
});
