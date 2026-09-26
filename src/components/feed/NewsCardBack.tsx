import * as Haptics from 'expo-haptics';
import { Bookmark, ExternalLink, Globe, RotateCcw, Share2 } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { CATEGORIES } from '../../constants/categories';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { useTheme } from '../../store/themeStore';
import { Article } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import { shareArticle } from '../../utils/share';
import { extractDomain } from '../../utils/url';
import { Badge } from '../common/Badge';
import { IconButton } from '../common/IconButton';

interface NewsCardBackProps {
  article: Article;
  cardHeight: number;
  isDark: boolean;
  onOpenSourceLink: (url: string) => void;
  onFlip?: () => void;
}

const NewsCardBackComponent: React.FC<NewsCardBackProps> = ({
  article,
  cardHeight,
  isDark,
  onOpenSourceLink,
  onFlip,
}) => {
  const { colors } = useTheme();
  const bookmarked = useBookmarkStore(
    useCallback((s) => s.bookmarks.some((b) => b.id === article.id), [article.id])
  );
  const toggleBookmark = useBookmarkStore((s) => s.toggleBookmark);

  const categoryMeta = CATEGORIES[article.category] || CATEGORIES.all;
  const categoryAccent =
    article.category === 'all'
      ? colors.primary
      : colors[article.category] || categoryMeta.accentColor;

  const domain = useMemo(() => extractDomain(article.link), [article.link]);
  const relativeTime = useMemo(
    () => formatRelativeTime(article.published_at),
    [article.published_at]
  );

  const paragraphs = useMemo(() => {
    const raw = article.fullSummary || article.shortSummary || '';
    return raw.split('\n\n').filter((p) => p.trim().length > 0);
  }, [article.fullSummary, article.shortSummary]);

  const handleToggleBookmark = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    await toggleBookmark(article);
  }, [toggleBookmark, article]);

  const handleShare = useCallback(() => {
    shareArticle(article);
  }, [article]);

  const handleFlipPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onFlip?.();
  }, [onFlip]);

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
        {/* Header: category, read mode, flip back */}
        <View
          style={[
            styles.headerBar,
            { borderBottomColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <View style={styles.headerLeft}>
            <Badge label={categoryMeta.name} color={categoryAccent} size="sm" />
            <View
              style={[
                styles.readModeChip,
                { backgroundColor: isDark ? '#161616' : '#F1F5F9', borderColor: colors.border },
              ]}
            >
              <Text style={[styles.readModeText, { color: colors.textMuted }]}>SUMMARY</Text>
            </View>
            <Text style={[styles.timeText, { color: colors.textMuted }]}>{relativeTime}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleFlipPress}
            style={[
              styles.flipBtn,
              { backgroundColor: isDark ? '#141414' : '#F1F5F9', borderColor: colors.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back to the story card"
          >
            <RotateCcw size={13} color={colors.primary} />
            <Text style={[styles.flipBtnText, { color: colors.primary }]}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Full untruncated headline and body — no image on the back face */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <Text
            style={[styles.heading, { color: colors.textPrimary }]}
            maxFontSizeMultiplier={1.22}
          >
            {article.heading}
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.paragraphsContainer}>
            {paragraphs.map((p, idx) => (
              <Text
                key={`${article.id}-p${idx}`}
                style={[styles.paragraph, { color: colors.textSecondary }]}
                maxFontSizeMultiplier={1.2}
              >
                {p}
              </Text>
            ))}
          </View>
        </ScrollView>

        {/* Footer actions */}
        <View
          style={[
            styles.footerContainer,
            {
              borderTopColor: colors.border,
              backgroundColor: isDark ? '#080808' : '#F8FAFC',
            },
          ]}
        >
          {domain ? (
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
          ) : (
            <View />
          )}

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
      </View>
    </View>
  );
};

export const NewsCardBack = React.memo(NewsCardBackComponent);

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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  readModeChip: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  readModeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  flipBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  heading: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 14,
    opacity: 0.6,
  },
  paragraphsContainer: {
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 15.5,
    lineHeight: 25,
    marginBottom: 12,
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
