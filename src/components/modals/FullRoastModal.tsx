import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Bookmark, ChevronLeft, ExternalLink, Globe, Share2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CATEGORIES, getDynamicFallbackImage } from '../../constants/categories';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useTheme } from '../../store/themeStore';
import { Article } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import { shareArticle } from '../../utils/share';
import { extractDomain } from '../../utils/url';
import { Badge } from '../common/Badge';
import { IconButton } from '../common/IconButton';

interface FullRoastModalProps {
  article: Article | null;
  visible: boolean;
  onClose: () => void;
  onOpenSourceLink?: (url: string) => void;
}

export const FullRoastModal: React.FC<FullRoastModalProps> = ({
  article,
  visible,
  onClose,
  onOpenSourceLink,
}) => {
  const { colors, isDark } = useTheme();
  const articleId = article?.id;
  const bookmarked = useBookmarkStore(
    useCallback((s) => (articleId ? s.bookmarks.some((b) => b.id === articleId) : false), [
      articleId,
    ])
  );
  const toggleBookmark = useBookmarkStore((s) => s.toggleBookmark);

  const [hasLoadError, setHasLoadError] = useState<boolean>(false);

  useEffect(() => {
    setHasLoadError(false);
  }, [articleId, article?.image_url]);

  // Derived values are memoised so the summary is not re-split (and the whole
  // body re-rendered) on every unrelated parent render.
  const derived = useMemo(() => {
    if (!article) return null;
    const categoryMeta = CATEGORIES[article.category] || CATEGORIES.all;
    const isValidUrl = Boolean(article.image_url && article.image_url.trim().length > 0);
    return {
      categoryMeta,
      categoryAccent: colors[article.category] || categoryMeta.accentColor,
      imageUri:
        isValidUrl && !hasLoadError
          ? article.image_url
          : getDynamicFallbackImage(article.id, article.category),
      domain: extractDomain(article.link),
      relativeTime: formatRelativeTime(article.published_at),
      paragraphs: (article.fullSummary || article.shortSummary || '')
        .split('\n\n')
        .filter((p) => p.trim().length > 0),
    };
  }, [article, colors, hasLoadError]);

  const handleToggleBookmark = useCallback(async () => {
    if (!article) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    await toggleBookmark(article);
  }, [toggleBookmark, article]);

  const handleShare = useCallback(() => {
    if (article) shareArticle(article);
  }, [article]);

  const handleClose = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onClose();
  }, [onClose]);

  if (!article || !derived) return null;

  const { categoryMeta, categoryAccent, imageUri, domain, relativeTime, paragraphs } = derived;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header navigation bar */}
          <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleClose}
              style={[styles.navBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Back to feed"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={20} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerBrand, { color: colors.textPrimary }]}>ZERODAILY</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>Full Story</Text>
            </View>

            <View style={styles.headerActions}>
              <IconButton
                icon={
                  <Bookmark
                    size={18}
                    color={bookmarked ? colors.primary : colors.textPrimary}
                    fill={bookmarked ? colors.primary : 'transparent'}
                  />
                }
                onPress={handleToggleBookmark}
                size={36}
                active={bookmarked}
                style={styles.headerIconBtn}
                accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark story'}
              />
              <IconButton
                icon={<Share2 size={18} color={colors.textPrimary} />}
                onPress={handleShare}
                size={36}
                style={styles.headerIconBtn}
                accessibilityLabel="Share story"
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleClose}
                style={[styles.closeBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="Close full story"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Image */}
            <View
              style={[
                styles.imageCard,
                {
                  backgroundColor: isDark ? '#050505' : '#F1F5F9',
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
                onError={() => {
                  if (!hasLoadError) setHasLoadError(true);
                }}
              />
            </View>

            {/* Meta tags & Source Tag */}
            <View style={styles.metaRow}>
              <Badge label={categoryMeta.name} color={categoryAccent} size="md" />
              <Text style={[styles.timeText, { color: colors.textMuted }]}>{relativeTime}</Text>

              {domain ? (
                <View style={[styles.domainChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Globe size={11} color={colors.textMuted} />
                  <Text style={[styles.domainText, { color: colors.textSecondary }]}>{domain}</Text>
                </View>
              ) : null}
            </View>

            {/* Full Untruncated Headline */}
            <Text style={[styles.headline, { color: colors.textPrimary }]}>
              {article.heading}
            </Text>

            {/* Full Story Paragraphs */}
            <View style={styles.paragraphsContainer}>
              {paragraphs.map((p, idx) => (
                <Text key={idx} style={[styles.paragraph, { color: colors.textSecondary }]}>
                  {p}
                </Text>
              ))}
            </View>

            {/* Read Source Link Button */}
            {article.link ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onOpenSourceLink?.(article.link)}
                style={[
                  styles.sourceLinkBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.sourceBtnLeft}>
                  <Globe size={16} color={colors.primary} />
                  <View>
                    <Text style={[styles.sourceBtnTitle, { color: colors.textPrimary }]}>
                      Read Original Coverage
                    </Text>
                    <Text style={[styles.sourceBtnSub, { color: colors.textMuted }]}>
                      {domain || article.link}
                    </Text>
                  </View>
                </View>
                <ExternalLink size={16} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
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
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerBrand: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {},
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  scrollArea: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
  },
  imageCard: {
    width: '100%',
    height: 230,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  domainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  domainText: {
    fontSize: 11,
    fontWeight: '600',
  },
  headline: {
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 31,
    marginBottom: 18,
    letterSpacing: -0.3,
  },
  paragraphsContainer: {
    marginBottom: 24,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 27,
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  sourceLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  sourceBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sourceBtnTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sourceBtnSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
