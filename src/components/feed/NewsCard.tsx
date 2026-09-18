import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, ChevronRight, ExternalLink, Flame, Globe, Share2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORIES, DEFAULT_FALLBACK_IMAGE } from '../../constants/categories';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useTheme } from '../../store/themeStore';
import { Article } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import { shareArticle } from '../../utils/share';
import { extractDomain, getReadingEstimate } from '../../utils/url';
import { Badge } from '../common/Badge';
import { IconButton } from '../common/IconButton';

interface NewsCardProps {
  article: Article;
  cardHeight: number;
  onOpenFullRoast: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  cardHeight,
  onOpenFullRoast,
  onOpenSourceLink,
}) => {
  const { colors, isDark } = useTheme();
  const { isBookmarked, toggleBookmark } = useBookmarkStore();
  const bookmarked = isBookmarked(article.id);

  const categoryMeta = CATEGORIES[article.category] || CATEGORIES.all;
  const fallbackImage = categoryMeta.fallbackImage || DEFAULT_FALLBACK_IMAGE;
  const categoryAccent = article.category === 'all'
    ? colors.primary
    : (colors[article.category] || categoryMeta.accentColor);

  // Track active image with graceful fallback on 404 / load error
  const isValidUrl = Boolean(article.image_url && article.image_url.trim().length > 0);
  const [imageUri, setImageUri] = useState<string>(isValidUrl ? article.image_url : fallbackImage);

  useEffect(() => {
    const valid = Boolean(article.image_url && article.image_url.trim().length > 0);
    setImageUri(valid ? article.image_url : fallbackImage);
  }, [article.image_url, fallbackImage]);

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
    ? (['transparent', 'rgba(17, 20, 31, 0.45)', colors.card] as const)
    : (['transparent', 'rgba(255, 255, 255, 0.5)', colors.card] as const);

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
        {/* 1. Hero Image with WebP Cache, Error Fallback & Adaptive Gradient Scrim */}
        <View style={[styles.imageContainer, { backgroundColor: isDark ? '#161B28' : '#E2E8F0' }]}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
            onError={() => {
              if (imageUri !== fallbackImage) {
                setImageUri(fallbackImage);
              }
            }}
          />
          <LinearGradient
            colors={scrimColors}
            locations={[0.4, 0.82, 1]}
            style={styles.gradientOverlay}
          />

          {/* Floating Metadata Pill Row (Category chip + Reading Time + Relative Time) */}
          <View style={styles.overlayRow}>
            <Badge
              label={categoryMeta.name}
              color={categoryAccent}
              size="sm"
            />
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{readingEstimate}</Text>
              <Text style={styles.metaChipDot}>•</Text>
              <Text style={styles.metaChipText}>{relativeTime}</Text>
            </View>
          </View>
        </View>

        {/* 2. Editorial Headline & 60-Word Summary Body */}
        <View style={styles.bodyContainer}>
          <Text
            style={[styles.heading, { color: colors.textPrimary }]}
            numberOfLines={3}
          >
            {article.heading}
          </Text>

          <Text
            style={[styles.summary, { color: colors.textSecondary }]}
            numberOfLines={6}
          >
            {article.shortSummary}
          </Text>

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
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
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
    height: '42%',
    position: 'relative',
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
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9, 11, 17, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  metaChipText: {
    color: '#CBD5E1',
    fontSize: 10.5,
    fontWeight: '600',
  },
  metaChipDot: {
    color: '#64748B',
    fontSize: 10,
    marginHorizontal: 4,
  },
  bodyContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    justifyContent: 'flex-start',
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  summary: {
    fontSize: 14.5,
    lineHeight: 22,
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
    marginTop: 12,
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
