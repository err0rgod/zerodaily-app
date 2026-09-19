import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, ChevronRight, ExternalLink, Flame, Globe, Share2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORIES, DEFAULT_FALLBACK_IMAGE, getDynamicFallbackImage } from '../../constants/categories';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useTheme } from '../../store/themeStore';
import { Article, CategoryKey } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import { shareArticle } from '../../utils/share';
import { extractDomain, getReadingEstimate } from '../../utils/url';
import { IconButton } from '../common/IconButton';

interface NewsCardProps {
  article: Article;
  cardHeight: number;
  onOpenFullRoast: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
  onOpenImageViewer?: (imageUri: string, heading: string, category: CategoryKey) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  cardHeight,
  onOpenFullRoast,
  onOpenSourceLink,
  onOpenImageViewer,
}) => {
  const { colors, isDark } = useTheme();
  const { isBookmarked, toggleBookmark } = useBookmarkStore();
  const bookmarked = isBookmarked(article.id);

  const categoryMeta = CATEGORIES[article.category] || CATEGORIES.all;
  const dynamicFallback = getDynamicFallbackImage(article.id, article.category);
  const categoryAccent = article.category === 'all'
    ? colors.primary
    : (colors[article.category] || categoryMeta.accentColor);

  // Track active image with graceful dynamic category fallback on 404 / load error
  const isValidUrl = Boolean(article.image_url && article.image_url.trim().length > 0);
  const [imageUri, setImageUri] = useState<string>(isValidUrl ? article.image_url : dynamicFallback);

  useEffect(() => {
    const valid = Boolean(article.image_url && article.image_url.trim().length > 0);
    setImageUri(valid ? article.image_url : dynamicFallback);
  }, [article.image_url, dynamicFallback]);

  const handleToggleBookmark = async () => {
    await toggleBookmark(article);
  };

  const handleShare = () => {
    shareArticle(article);
  };

  const domain = extractDomain(article.link);
  const readingEstimate = getReadingEstimate(article.shortSummary);
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
            { backgroundColor: isDark ? '#0B0E17' : '#F1F5F9' },
          ]}
        >
          {/* Theme-Adaptive Ambient Blur Background for Width/Height Filling */}
          <Image
            source={{ uri: imageUri }}
            style={styles.ambientBlurImage}
            contentFit="cover"
            blurRadius={Platform.OS === 'android' ? 16 : 26}
            cachePolicy="memory-disk"
          />
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: isDark ? 'rgba(11, 14, 23, 0.52)' : 'rgba(241, 245, 249, 0.55)',
              },
            ]}
          />

          {/* Uncropped Full Foreground Image */}
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            onError={() => {
              if (imageUri !== dynamicFallback) {
                setImageUri(dynamicFallback);
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
              <Text style={styles.brandTitle}>ZERODAILY</Text>
            </View>

            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{readingEstimate}</Text>
              <Text style={styles.metaChipDot}>•</Text>
              <Text style={styles.metaChipText}>{relativeTime}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 2. Editorial Headline & Fully Extended Summary Body */}
        <View style={styles.bodyContainer}>
          <View style={styles.headlineAndSummary}>
            <Text
              style={[styles.heading, { color: colors.textPrimary }]}
              numberOfLines={3}
            >
              {article.heading}
            </Text>

            <Text
              style={[styles.summary, { color: colors.textSecondary }]}
              numberOfLines={9}
              ellipsizeMode="tail"
            >
              {article.shortSummary}
            </Text>
          </View>

          {/* Bespoke "Read Full Roast" Editorial Callout */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => onOpenFullRoast(article)}
            style={[
              styles.fullRoastTrigger,
              {
                backgroundColor: colors.warningSoft,
                borderColor: isDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(217, 119, 6, 0.25)',
              },
            ]}
          >
            <View style={styles.roastLeft}>
              <Flame size={15} color={colors.warning} />
              <Text style={[styles.fullRoastText, { color: colors.warning }]}>
                Full Satirical Roast
              </Text>
            </View>
            <ChevronRight size={14} color={colors.warning} />
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
};

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
  ambientBlurImage: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.15 }],
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
  metaChipDot: {
    color: '#64748B',
    fontSize: 9,
    marginHorizontal: 3,
  },
  bodyContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  headlineAndSummary: {
    flex: 1,
  },
  heading: {
    fontSize: 19.5,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 8,
    letterSpacing: -0.35,
  },
  summary: {
    fontSize: 14,
    lineHeight: 21.5,
    letterSpacing: 0.1,
  },
  fullRoastTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 8,
  },
  roastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  fullRoastText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 5,
    maxWidth: '65%',
  },
  sourceButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {},
});
