import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, ExternalLink, Globe, RotateCcw, Share2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { getDynamicFallbackImage } from '../../constants/categories';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useTheme } from '../../store/themeStore';
import { Article, CategoryKey } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import { shareArticle } from '../../utils/share';
import { extractDomain } from '../../utils/url';
import { IconButton } from '../common/IconButton';

interface NewsCardProps {
  article: Article;
  cardHeight: number;
  /**
   * 'full' renders the interactive front face.
   * 'compact' renders a trimmed, non-interactive face for the cards stacked
   * behind the active one — just enough to read as a deck without paying for
   * a second gradient, footer and action row on every render.
   */
  variant?: 'full' | 'compact';
  onOpenFullRoast?: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
  onOpenImageViewer?: (imageUri: string, heading: string, category: CategoryKey) => void;
  onFlip?: () => void;
}

const NewsCardComponent: React.FC<NewsCardProps> = ({
  article,
  cardHeight,
  variant = 'full',
  onOpenFullRoast,
  onOpenSourceLink,
  onOpenImageViewer,
  onFlip,
}) => {
  const { colors, isDark } = useTheme();
  const isFull = variant === 'full';

  // Selector returns a boolean, so the default Object.is equality keeps this
  // card from re-rendering when unrelated bookmarks change.
  const bookmarked = useBookmarkStore(
    useCallback((s) => s.bookmarks.some((b) => b.id === article.id), [article.id])
  );
  const toggleBookmark = useBookmarkStore((s) => s.toggleBookmark);

  const { fontScale } = useWindowDimensions();
  const isLargeFont = fontScale > 1.15;
  const isCompactScreen = cardHeight < 620;

  // Dynamically balance typography limits so large fonts never crowd out footer
  const headingLines = isLargeFont || isCompactScreen ? 2 : 3;
  const summaryLines = isLargeFont ? 5 : isCompactScreen ? 6 : 7;

  const dynamicFallback = getDynamicFallbackImage(article.id, article.category);

  const isValidUrl = Boolean(article.image_url && article.image_url.trim().length > 0);
  const [hasLoadError, setHasLoadError] = useState<boolean>(false);
  const imageUri = isValidUrl && !hasLoadError ? article.image_url : dynamicFallback;

  useEffect(() => {
    setHasLoadError(false);
  }, [article.id, article.image_url]);

  const handleToggleBookmark = useCallback(async () => {
    await toggleBookmark(article);
  }, [toggleBookmark, article]);

  const handleShare = useCallback(() => {
    shareArticle(article);
  }, [article]);

  const handleFlip = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onFlip?.();
  }, [onFlip]);

  const handleLongPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    onOpenImageViewer?.(imageUri, article.heading, article.category);
  }, [article.category, article.heading, imageUri, onOpenImageViewer]);

  const domain = useMemo(() => extractDomain(article.link), [article.link]);
  const relativeTime = useMemo(
    () => formatRelativeTime(article.published_at),
    [article.published_at]
  );

  const scrimColors = useMemo(
    () =>
      isDark
        ? (['transparent', 'rgba(10, 10, 10, 0.45)', colors.card] as const)
        : (['transparent', 'rgba(255, 255, 255, 0.45)', colors.card] as const),
    [isDark, colors.card]
  );

  const cardSurface = {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    shadowColor: isDark ? '#000000' : '#0F172A',
    shadowOpacity: isDark ? 0.35 : 0.08,
    elevation: isDark ? 2 : 4,
  };

  return (
    <View style={[styles.pageWrapper, { height: cardHeight, backgroundColor: colors.background }]}>
      <View style={[styles.card, cardSurface]}>
        {/* Hero image — 1.5s long-press opens the full-screen viewer */}
        <TouchableOpacity
          activeOpacity={0.94}
          delayLongPress={1500}
          onLongPress={handleLongPress}
          disabled={!isFull}
          style={[
            styles.imageContainer,
            {
              backgroundColor: isDark ? '#050505' : '#F1F5F9',
              height: isLargeFont ? '42%' : '47%',
            },
          ]}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={180}
            onError={() => {
              if (!hasLoadError) setHasLoadError(true);
            }}
          />

          <LinearGradient
            colors={scrimColors}
            locations={[0.55, 0.85, 1]}
            style={styles.gradientOverlay}
          />

          {isFull && (
            <View style={styles.overlayRow}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandTitle} maxFontSizeMultiplier={1.15}>
                  ZERODAILY
                </Text>
              </View>

              <View style={styles.overlayRight}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText} maxFontSizeMultiplier={1.15}>
                    {relativeTime}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleFlip}
                  style={styles.flipChip}
                  accessibilityRole="button"
                  accessibilityLabel="Read the full summary"
                >
                  <RotateCcw size={10} color="#FFFFFF" />
                  <Text style={styles.flipChipText}>Summary</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Editorial headline & summary */}
        <View style={styles.bodyContainer}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => onOpenFullRoast?.(article)}
            disabled={!isFull}
            style={styles.headlineAndSummary}
          >
            <Text
              style={[styles.heading, { color: colors.textPrimary }]}
              numberOfLines={isFull ? undefined : headingLines}
              ellipsizeMode={isFull ? undefined : 'tail'}
              maxFontSizeMultiplier={1.22}
            >
              {article.heading}
            </Text>

            <Text
              style={[styles.summary, { color: colors.textSecondary }]}
              numberOfLines={isFull ? summaryLines : 3}
              ellipsizeMode="tail"
              maxFontSizeMultiplier={1.22}
            >
              {article.shortSummary}
            </Text>
          </TouchableOpacity>
        </View>

        {isFull && (
          <View
            style={[
              styles.footerContainer,
              {
                borderTopColor: colors.border,
                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#F8FAFC',
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onOpenSourceLink(article.link)}
              style={[
                styles.sourceButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityRole="link"
              accessibilityLabel={`Open source at ${domain}`}
            >
              <Globe size={13} color={colors.textMuted} />
              <Text
                style={[styles.sourceButtonText, { color: colors.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
                maxFontSizeMultiplier={1.15}
              >
                {domain}
              </Text>
              <ExternalLink size={12} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.actionButtonsRow}>
              <IconButton
                icon={
                  <Bookmark
                    size={17}
                    color={bookmarked ? colors.primary : colors.textPrimary}
                    fill={bookmarked ? colors.primary : 'transparent'}
                  />
                }
                onPress={handleToggleBookmark}
                size={36}
                active={bookmarked}
                accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark story'}
              />
              <IconButton
                icon={<Share2 size={17} color={colors.textPrimary} />}
                onPress={handleShare}
                size={36}
                accessibilityLabel="Share story"
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export const NewsCard = React.memo(NewsCardComponent);

const styles = StyleSheet.create({
  pageWrapper: {
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 6,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },
  imageContainer: {
    width: '100%',
    height: '47%',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },
  overlayRow: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBadge: {
    backgroundColor: 'rgba(9, 11, 17, 0.82)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9, 11, 17, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  metaChipText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },
  overlayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 9999,
  },
  flipChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  bodyContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  headlineAndSummary: {
    flex: 1,
    overflow: 'hidden',
  },
  heading: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27.5,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22.5,
    letterSpacing: 0.1,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    flexShrink: 0,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 5,
    flexShrink: 1,
    maxWidth: '68%',
  },
  sourceButtonText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
