import * as Haptics from 'expo-haptics';
import { Bookmark, ExternalLink, Globe, RotateCcw, Share2 } from 'lucide-react-native';
import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
  onOpenSourceLink: (url: string) => void;
  onFlip?: () => void;
}

export const NewsCardBack: React.FC<NewsCardBackProps> = React.memo(({
  article,
  cardHeight,
  onOpenSourceLink,
  onFlip,
}) => {
  const { colors, isDark } = useTheme();
  const bookmarked = useBookmarkStore(
    React.useCallback((s) => s.bookmarks.some((b) => b.id === article.id), [article.id])
  );
  const toggleBookmark = useBookmarkStore((s) => s.toggleBookmark);

  const categoryMeta = CATEGORIES[article.category] || CATEGORIES.all;
  const categoryAccent = article.category === 'all'
    ? colors.primary
    : (colors[article.category] || categoryMeta.accentColor);

  const domain = extractDomain(article.link);
  const relativeTime = formatRelativeTime(article.published_at);

  const rawSummary = article.fullSummary || article.shortSummary || '';
  const paragraphs = rawSummary.split('\n\n').filter((p) => p.trim().length > 0);

  const handleToggleBookmark = async () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    await toggleBookmark(article);
  };

  const handleShare = () => {
    shareArticle(article);
  };

  const handleFlipPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onFlip?.();
  };

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
        {/* 1. Header Bar: Category Badge, Read Mode Tag & Flip Back Button */}
        <View style={[styles.headerBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.headerLeft}>
            <Badge label={categoryMeta.name} color={categoryAccent} size="sm" />
            <View style={[styles.readModeChip, { backgroundColor: isDark ? '#161616' : '#F1F5F9', borderColor: colors.border }]}>
              <Text style={[styles.readModeText, { color: colors.textMuted }]}>SUMMARY</Text>
            </View>
            <Text style={[styles.timeText, { color: colors.textMuted }]}>{relativeTime}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleFlipPress}
            style={[styles.flipBtn, { backgroundColor: isDark ? '#141414' : '#F1F5F9', borderColor: colors.border }]}
          >
            <RotateCcw size={13} color={colors.primary} />
            <Text style={[styles.flipBtnText, { color: colors.primary }]}>Flip</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Editorial Headline & Full Story Content (NO IMAGE) */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Full Untruncated Headline */}
          <Text style={[styles.heading, { color: colors.textPrimary }]} maxFontSizeMultiplier={1.22}>
            {article.heading}
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Formatted Story Paragraphs */}
          <View style={styles.paragraphsContainer}>
            {paragraphs.map((p, idx) => (
              <Text
                key={idx}
                style={[styles.paragraph, { color: colors.textSecondary }]}
                maxFontSizeMultiplier={1.2}
              >
                {p}
              </Text>
            ))}
          </View>

          {/* Flip Hint */}
          <View style={styles.flipCueRow}>
            <RotateCcw size={12} color={colors.textMuted} />
            <Text style={[styles.flipCueText, { color: colors.textMuted }]}>
              Slide left or right to flip card back
            </Text>
          </View>
        </ScrollView>

        {/* 3. Footer Actions Bar */}
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
          ) : <View />}

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
            />
            <IconButton
              icon={<Share2 size={17} color={colors.textPrimary} />}
              onPress={handleShare}
              size={36}
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
    paddingVertical: 4.5,
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
    paddingBottom: 20,
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
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 15.5,
    lineHeight: 25,
    marginBottom: 12,
    letterSpacing: 0.1,
  },
  flipCueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    opacity: 0.8,
  },
  flipCueText: {
    fontSize: 11.5,
    fontWeight: '500',
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
