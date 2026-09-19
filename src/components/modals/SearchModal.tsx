import { Image } from 'expo-image';
import { Search, Trash2, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CATEGORIES, CATEGORY_LIST, getDynamicFallbackImage } from '../../constants/categories';
import { useFeedStore } from '../../store/feedStore';
import { useTheme } from '../../store/themeStore';
import { Article, CategoryKey } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import { searchArticles } from '../../utils/search';
import { Badge } from '../common/Badge';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ visible, onClose }) => {
  const { colors, isDark } = useTheme();
  const { articles, setArticleDirectly } = useFeedStore();

  const [query, setQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');

  const filteredArticles = useMemo(() => {
    return searchArticles(articles, query, selectedCategory);
  }, [articles, query, selectedCategory]);

  const handleSelectArticle = (article: Article) => {
    setArticleDirectly(article);
    onClose();
  };

  const handleClear = () => {
    setQuery('');
    setSelectedCategory('all');
  };

  const renderItem = ({ item }: { item: Article }) => {
    const categoryMeta = CATEGORIES[item.category] || CATEGORIES.all;
    const fallback = getDynamicFallbackImage(item.id, item.category);
    const imageUri = (item.image_url && item.image_url.trim().length > 0) ? item.image_url : fallback;
    const catColor = colors[item.category] || categoryMeta.accentColor;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleSelectArticle(item)}
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
            <Text style={[styles.timeText, { color: colors.textMuted }]}>
              {formatRelativeTime(item.published_at)}
            </Text>
          </View>
          <Text style={[styles.heading, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.heading}
          </Text>
          <Text style={[styles.snippet, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.shortSummary}
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
          {/* Header & Search Bar */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Search size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search roasted tech stories, topics..."
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.textPrimary }]}
                autoFocus={visible}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} style={styles.clearIconBtn}>
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
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
                        backgroundColor: isSelected ? `${catAccent}18` : colors.surface,
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

          {/* Results Summary */}
          <View style={styles.resultsHeader}>
            <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
              {filteredArticles.length} {filteredArticles.length === 1 ? 'story' : 'stories'} found
            </Text>
            {(query.length > 0 || selectedCategory !== 'all') && (
              <TouchableOpacity onPress={handleClear} style={styles.resetBtn}>
                <Text style={[styles.resetBtnText, { color: colors.primary }]}>Reset filters</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Results List */}
          <FlatList
            data={filteredArticles}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Search size={40} color={colors.border} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Matches Found</Text>
                <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                  Try a different search keyword or category filter.
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearIconBtn: {
    padding: 4,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 9999,
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
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  resultsCount: {
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resetBtn: {
    paddingVertical: 2,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 14,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
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
  timeText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  snippet: {
    fontSize: 11.5,
    marginTop: 2,
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
