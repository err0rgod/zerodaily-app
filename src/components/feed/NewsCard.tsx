import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, ExternalLink, Flame, Share2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORIES, DEFAULT_FALLBACK_IMAGE } from '../../constants/categories';
import { THEME } from '../../constants/theme';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { Article } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import { shareArticle } from '../../utils/share';
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
  const { isBookmarked, toggleBookmark } = useBookmarkStore();
  const bookmarked = isBookmarked(article.id);
  const categoryMeta = CATEGORIES[article.category] || CATEGORIES.all;
  const fallbackImage = categoryMeta.fallbackImage || DEFAULT_FALLBACK_IMAGE;

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

  return (
    <View style={[styles.pageWrapper, { height: cardHeight }]}>
      <View style={styles.card}>
        {/* 1. Hero Image with WebP Cache, Automatic Fallback & Gradient Overlay */}
        <View style={styles.imageContainer}>
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
            colors={['transparent', 'rgba(15, 23, 42, 0.65)', '#0F172A']}
            locations={[0.45, 0.85, 1]}
            style={styles.gradientOverlay}
          />

          {/* Category Badge & Timestamp Badge Overlay */}
          <View style={styles.overlayRow}>
            <Badge
              label={categoryMeta.name}
              color={categoryMeta.accentColor}
              size="sm"
            />
            <Text style={styles.timestampText}>{formatRelativeTime(article.published_at)}</Text>
          </View>
        </View>

        {/* 2. Headline & 60-Word Summary Body */}
        <View style={styles.bodyContainer}>
          <Text style={styles.heading} numberOfLines={3}>
            {article.heading}
          </Text>

          <Text style={styles.summary} numberOfLines={6}>
            {article.shortSummary}
          </Text>

          {/* Read Full Roast Pill Trigger */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onOpenFullRoast(article)}
            style={styles.fullRoastTrigger}
          >
            <Flame size={15} color={THEME.colors.warning} />
            <Text style={styles.fullRoastText}>Read Full Satirical Roast</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Footer Actions (Source link, Bookmark, Share) */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onOpenSourceLink(article.link)}
            style={styles.sourceButton}
          >
            <Text style={styles.sourceButtonText} numberOfLines={1}>
              Source / Original
            </Text>
            <ExternalLink size={14} color={THEME.colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.actionButtonsRow}>
            <IconButton
              icon={
                <Bookmark
                  size={18}
                  color={bookmarked ? THEME.colors.primary : THEME.colors.textPrimary}
                  fill={bookmarked ? THEME.colors.primary : 'transparent'}
                />
              }
              onPress={handleToggleBookmark}
              size={38}
              active={bookmarked}
              style={styles.actionBtn}
            />
            <IconButton
              icon={<Share2 size={18} color={THEME.colors.textPrimary} />}
              onPress={handleShare}
              size={38}
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
    backgroundColor: THEME.colors.background,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 8,
  },
  card: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    overflow: 'hidden',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  imageContainer: {
    width: '100%',
    height: '42%',
    position: 'relative',
    backgroundColor: '#1E293B',
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
    bottom: 12,
    left: THEME.spacing.md,
    right: THEME.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestampText: {
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
    backgroundColor: 'rgba(9, 13, 22, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bodyContainer: {
    flex: 1,
    paddingHorizontal: THEME.spacing.md,
    paddingTop: 10,
    justifyContent: 'flex-start',
  },
  heading: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    lineHeight: 28,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  summary: {
    fontSize: THEME.typography.sizes.base,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  fullRoastTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.sm,
    marginTop: 12,
    gap: 6,
  },
  fullRoastText: {
    color: THEME.colors.warning,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.card,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 6,
    maxWidth: '60%',
  },
  sourceButtonText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    backgroundColor: THEME.colors.surface,
  },
});
