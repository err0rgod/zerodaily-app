import { Image } from 'expo-image';
import { Bookmark, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CATEGORIES, getDynamicFallbackImage } from '../../constants/categories';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useFeedStore } from '../../store/feedStore';
import { useTheme } from '../../store/themeStore';
import { Article } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import { Badge } from '../common/Badge';

interface BookmarksModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BookmarksModal: React.FC<BookmarksModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();

  // Granular selectors instead of subscribing to the whole store.
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const isLoaded = useBookmarkStore((s) => s.isLoaded);
  const loadBookmarks = useBookmarkStore((s) => s.loadBookmarks);
  const toggleBookmark = useBookmarkStore((s) => s.toggleBookmark);
  const clearAllBookmarks = useBookmarkStore((s) => s.clearAllBookmarks);
  const setArticleDirectly = useFeedStore((s) => s.setArticleDirectly);

  // Only hit disk once; the store already tracks whether it has loaded.
  useEffect(() => {
    if (visible && !isLoaded) loadBookmarks();
  }, [visible, isLoaded, loadBookmarks]);

  const handleSelectArticle = useCallback(
    (article: Article) => {
      setArticleDirectly(article);
      onClose();
    },
    [onClose, setArticleDirectly]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear All Bookmarks', 'This removes every saved story from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => clearAllBookmarks() },
    ]);
  }, [clearAllBookmarks]);

  const renderItem = useCallback(
    ({ item }: { item: Article }) => {
      const categoryMeta = CATEGORIES[item.category] || CATEGORIES.all;
      const fallback = getDynamicFallbackImage(item.id, item.category);
      const imageUri =
        item.image_url && item.image_url.trim().length > 0 ? item.image_url : fallback;
      const catColor = colors[item.category] || categoryMeta.accentColor;

      return (
        <View
          style={[styles.itemContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleSelectArticle(item)}
            style={styles.clickableRow}
          >
            <Image
              source={{ uri: imageUri }}
              style={[styles.thumbnail, { backgroundColor: colors.cardBorder }]}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
            <View style={styles.itemContent}>
              <View style={styles.itemMeta}>
                <Badge label={categoryMeta.name} color={catColor} size="sm" />
                <Text style={[styles.timeText, { color: colors.textMuted }]}>
                  {formatRelativeTime(item.published_at)}
                </Text>
              </View>
              <Text style={[styles.heading, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.heading}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => toggleBookmark(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Remove bookmark"
            style={styles.removeBtn}
          >
            <Trash2 size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      );
    },
    [colors, handleSelectArticle, toggleBookmark]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.titleRow}>
              <Bookmark size={20} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Saved Offline Stories
              </Text>
            </View>
            <View style={styles.actionsRow}>
              {bookmarks.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearAll}
                  style={[styles.clearBtn, { backgroundColor: `${colors.danger}18` }]}
                >
                  <Text style={[styles.clearBtnText, { color: colors.danger }]}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Close bookmarks"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={bookmarks}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Bookmark size={40} color={colors.border} style={styles.emptyIcon} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No Bookmarks Saved
                </Text>
                <Text style={[styles.emptySub, { color: colors.textMuted }]}>
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 9999,
  },
  listContent: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  clickableRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
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
    fontWeight: '500',
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  removeBtn: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
});
