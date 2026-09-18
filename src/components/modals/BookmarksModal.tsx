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
import { CATEGORIES, DEFAULT_FALLBACK_IMAGE } from '../../constants/categories';
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
    const fallback = categoryMeta.fallbackImage || DEFAULT_FALLBACK_IMAGE;
    const imageUri = (item.image_url && item.image_url.trim().length > 0) ? item.image_url : fallback;
    const catColor = colors[item.category] || categoryMeta.accentColor;

    return (
      <View style={[styles.itemContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => toggleBookmark(item)}
          style={styles.removeBtn}
        >
          <Trash2 size={16} color={colors.textMuted} />
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
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.titleRow}>
              <Bookmark size={20} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Saved Offline Stories</Text>
            </View>
            <View style={styles.actionsRow}>
              {bookmarks.length > 0 && (
                <TouchableOpacity
                  onPress={clearAllBookmarks}
                  style={[styles.clearBtn, { backgroundColor: `${colors.danger}18` }]}
                >
                  <Text style={[styles.clearBtnText, { color: colors.danger }]}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Bookmark size={40} color={colors.border} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Bookmarks Saved</Text>
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
