import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, ExternalLink, Globe, Heart, Share2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { getDynamicFallbackImage } from '../../constants/categories';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useLikeStore } from '../../store/likeStore';
import { useTheme } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';
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

  const isLiked = useLikeStore(React.useCallback((s) => s.likedIds.includes(article.id), [article.id]));
  const toggleLike = useLikeStore((s) => s.toggleLike);

  const lastTapRef = React.useRef<number>(0);

  const { fontScale } = useWindowDimensions();
  const isLargeFont = fontScale > 1.15;
  const isCompactScreen = cardHeight < 620;

  // Dynamically balance typography limits so large fonts never crowd out footer
  const summaryLines = isLargeFont ? 5 : (isCompactScreen ? 6 : 7);

  const dynamicFallback = getDynamicFallbackImage(article.id, article.category);

  const isValidUrl = Boolean(article.image_url && article.image_url.trim().length > 0);
  const [hasLoadError, setHasLoadError] = useState<boolean>(false);
  const imageUri = (isValidUrl && !hasLoadError) ? article.image_url : dynamicFallback;

  useEffect(() => {
    setHasLoadError(false);
  }, [article.id, article.image_url]);

  const handleToggleBookmark = async () => {
    const isNowBookmarked = await toggleBookmark(article);
    if (isNowBookmarked) {
      useUserStore.getState().trackEvent(article.id, article.category, 'bookmark');
    }
    const currentBookmarks = useBookmarkStore.getState().bookmarks.map((b) => b.id);
    const syncMode = isNowBookmarked ? 'merge' : 'replace';
    useUserStore.getState().syncBookmarks(currentBookmarks, syncMode).catch(() => {});
  };

  const handleToggleLike = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await toggleLike(article);
  };

  const handleDoubleTap = async () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      lastTapRef.current = 0;
      await handleToggleLike();
    } else {
      lastTapRef.current = now;
    }
  };

  const handleShare = () => {
    shareArticle(article);
    useUserStore.getState().trackEvent(article.id, article.category, 'share');
  };

  const handleOpenFullStory = () => {
    useUserStore.getState().trackEvent(article.id, article.category, 'full_roast', 8.0);
    onOpenFullRoast?.(article);
  };

  const domain = extractDomain(article.link);
  const relativeTime = formatRelativeTime(article.published_at);

  const topScrimColors = isDark
    ? ([colors.card, 'rgba(10, 10, 10, 0.45)', 'transparent'] as const)
    : ([colors.card, 'rgba(255, 255, 255, 0.45)', 'transparent'] as const);

  const bottomScrimColors = isDark
    ? (['transparent', 'rgba(10, 10, 10, 0.45)', colors.card] as const)
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
          onPress={handleOpenFullStory}
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
              backgroundColor: isDark ? '#050505' : '#F1F5F9',
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

          {/* Top Fusing Scrim Gradient */}
          <LinearGradient
            colors={topScrimColors}
            locations={[0, 0.45, 1]}
            style={styles.gradientTopOverlay}
          />

          {/* Bottom Fusing Scrim Gradient */}
          <LinearGradient
            colors={bottomScrimColors}
            locations={[0.5, 0.85, 1]}
            style={styles.gradientBottomOverlay}
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

        {/* 2. Editorial Headline & Fully Extended Summary Body (Double-tap to like) */}
        <View style={styles.bodyContainer}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={handleOpenFullStory}
          >
            <Text
              style={[styles.heading, { color: colors.textPrimary }]}
              maxFontSizeMultiplier={1.22}
            >
              {article.heading}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={1}
            onPress={handleDoubleTap}
            style={styles.headlineAndSummary}
          >
            <Text
              style={[styles.summary, { color: colors.textSecondary }]}
              numberOfLines={summaryLines}
              ellipsizeMode="tail"
              maxFontSizeMultiplier={1.22}
            >
              {article.shortSummary}
            </Text>
          </TouchableOpacity>
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

          {/* Action Buttons: Like -> Share -> Bookmark */}
          <View style={styles.actionButtonsRow}>
            {/* 1. Like Action */}
            <IconButton
              icon={
                <Heart
                  size={18}
                  color={isLiked ? '#EF4444' : colors.textPrimary}
                  fill={isLiked ? '#EF4444' : 'transparent'}
                />
              }
              onPress={handleToggleLike}
              size={36}
              active={isLiked}
              accessibilityLabel={isLiked ? 'Unlike this story' : 'Like this story'}
              style={styles.actionBtn}
            />

            {/* 2. Share Action */}
            <IconButton
              icon={<Share2 size={17} color={colors.textPrimary} />}
              onPress={handleShare}
              size={36}
              accessibilityLabel="Share this story"
              style={styles.actionBtn}
            />

            {/* 3. Bookmark Action */}
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
              accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark this story'}
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
    paddingHorizontal: 12,
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
  gradientTopOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 48,
    zIndex: 2,
  },
  gradientBottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    zIndex: 2,
  },
  overlayRow: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
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
  readMoreBtn: {
    borderWidth: 1.5,
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
