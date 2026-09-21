import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, ExternalLink, Globe, Share2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { CATEGORIES, DEFAULT_FALLBACK_IMAGE, getDynamicFallbackImage } from '../../constants/categories';
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
  onOpenFullRoast?: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
  onOpenImageViewer?: (imageUri: string, heading: string, category: CategoryKey) => void;
}

export const NewsCard: React.FC<NewsCardProps> = React.memo(({
  article,
  cardHeight,
  onOpenFullRoast,
  onOpenSourceLink,
  onOpenImageViewer,
}) => {
  const { colors, isDark } = useTheme();
  const bookmarked = useBookmarkStore(React.useCallback((s) => s.bookmarks.some((b) => b.id === article.id), [article.id]));
  const toggleBookmark = useBookmarkStore((s) => s.toggleBookmark);

  const { fontScale } = useWindowDimensions();
  const isLargeFont = fontScale > 1.15;
  const isCompactScreen = cardHeight < 620;

  // Dynamically balance typography limits so large fonts never crowd out footer
  const headingLines = isLargeFont || isCompactScreen ? 2 : 3;
  const summaryLines = isLargeFont ? 5 : (isCompactScreen ? 6 : 7);

  const categoryMeta = CATEGORIES[article.category] || CATEGORIES.all;
  const dynamicFallback = getDynamicFallbackImage(article.id, article.category);
  const categoryAccent = article.category === 'all'
    ? colors.primary
    : (colors[article.category] || categoryMeta.accentColor);

  const isValidUrl = Boolean(article.image_url && article.image_url.trim().length > 0);
  const [hasLoadError, setHasLoadError] = useState<boolean>(false);
  const imageUri = (isValidUrl && !hasLoadError) ? article.image_url : dynamicFallback;

  useEffect(() => {
    setHasLoadError(false);
  }, [article.id, article.image_url]);

  const handleToggleBookmark = async () => {
    await toggleBookmark(article);
  };

  const handleShare = () => {
    shareArticle(article);
  };

  const domain = extractDomain(article.link);
  const relativeTime = formatRelativeTime(article.published_at);

  const scrimColors = isDark
    ? (['transparent', 'rgba(17, 20, 31, 0.40)', colors.card] as const)
    : (['transparent', 'rgba(255, 255, 255, 0.45)', colors.card] as const);

  return (
    <View style={[styles.pageWrapper, { height: cardHeight, backgroundColor: colors.background }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            shadowColor: isDark ? '#000000' : '#0F172A',
            shadowOpacity: isDark ? 0.35 : 0.08,
            elevation: isDark ? 2 : 4,
          },
        ]}
      >
        {/* 1. Hero Image with Theme-Adaptive Filling, Full Image Display (contain), 1.5s Long-Press Zoom */}
        <TouchableOpacity
          activeOpacity={0.94}
          delayLongPress={1500}
          onLongPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            }
            onOpenImageViewer?.(imageUri, article.heading, article.category);
          }}
          style={[
            styles.imageContainer,
            {
              backgroundColor: isDark ? '#080B12' : '#F1F5F9',
              height: isLargeFont ? '42%' : '47%',
            },
          ]}
        >
          {/* Uncropped Full Foreground Image with Memory-Disk Cache Policy */}
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            onError={() => {
              if (!hasLoadError) {
                setHasLoadError(true);
              }
            }}
          />

          <LinearGradient
            colors={scrimColors}
            locations={[0.55, 0.85, 1]}
            style={styles.gradientOverlay}
          />

          {/* Floating Metadata Pill Row: ZERODAILY brand only + Reading metrics */}
          <View style={styles.overlayRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandTitle} maxFontSizeMultiplier={1.15}>ZERODAILY</Text>
            </View>

            <View style={styles.metaChip}>
              <Text style={styles.metaChipText} maxFontSizeMultiplier={1.15}>{relativeTime}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 2. Editorial Headline & Fully Extended Summary Body */}
        <View style={styles.bodyContainer}>
          <View style={styles.headlineAndSummary}>
            <Text
              style={[styles.heading, { color: colors.textPrimary }]}
              numberOfLines={headingLines}
              maxFontSizeMultiplier={1.22}
            >
              {article.heading}
            </Text>

            <Text
              style={[styles.summary, { color: colors.textSecondary }]}
              numberOfLines={summaryLines}
              ellipsizeMode="tail"
              maxFontSizeMultiplier={1.22}
            >
              {article.shortSummary}
            </Text>
          </View>
        </View>

        {/* 3. Refined Footer Actions Bar */}
        <View
          style={[
            styles.footerContainer,
            {
              borderTopColor: colors.border,
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#F8FAFC',
            },
          ]}
        >
          {/* Authentic Publisher Domain Tag */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onOpenSourceLink(article.link)}
            style={[
              styles.sourceButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
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

          {/* Bookmark & Share Actions */}
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
              style={styles.actionBtn}
            />
            <IconButton
              icon={<Share2 size={17} color={colors.textPrimary} />}
              onPress={handleShare}
              size={36}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </View>
    </View>
  );
});

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
  actionBtn: {},
});
