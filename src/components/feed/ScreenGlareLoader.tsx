import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../../store/themeStore';

interface ScreenGlareLoaderProps {
  cardHeight?: number;
}

/**
 * YouTube-style screen glare / shimmer skeleton card loader.
 * Replaces old circular spinners and loading bars with a fluid, continuous
 * metallic sheen sweeping across content placeholders.
 */
export const ScreenGlareLoader: React.FC<ScreenGlareLoaderProps> = ({ cardHeight }) => {
  const { colors, isDark } = useTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const height = cardHeight || Math.max(windowHeight - 110, 400);
  const cardWidth = Math.min(windowWidth - 32, 540);

  // Animated driver for sweeping glare band
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [animatedValue]);

  // Translate glare from left (-100%) to right (+150%) across the card
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-cardWidth * 1.2, cardWidth * 1.4],
  });

  // Theme-adaptive skeleton base colors and glare gradient
  const skeletonBaseColor = isDark ? '#161926' : '#E2E8F0';
  const skeletonMutedColor = isDark ? '#1C2030' : '#EDF2F7';

  const glareColors = isDark
    ? (['transparent', 'rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.03)', 'transparent'] as const)
    : (['transparent', 'rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.70)', 'rgba(255, 255, 255, 0.25)', 'transparent'] as const);

  return (
    <View style={[styles.pageWrapper, { height, backgroundColor: colors.background }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            shadowColor: isDark ? '#000000' : '#0F172A',
          },
        ]}
      >
        {/* 1. Hero Image Skeleton Placeholder */}
        <View style={[styles.imageSkeleton, { backgroundColor: skeletonBaseColor }]} />

        {/* 2. Content Skeleton Body */}
        <View style={styles.contentSkeleton}>
          {/* Metadata Row Placeholder: Category Pill + Source Domain */}
          <View style={styles.metaRow}>
            <View style={[styles.pillSkeleton, { backgroundColor: skeletonMutedColor }]} />
            <View style={[styles.domainSkeleton, { backgroundColor: skeletonMutedColor }]} />
          </View>

          {/* Heading Line Placeholders (YouTube-style staggered title lines) */}
          <View style={styles.headingGroup}>
            <View style={[styles.headingLine, { width: '92%', backgroundColor: skeletonBaseColor }]} />
            <View style={[styles.headingLine, { width: '84%', backgroundColor: skeletonBaseColor }]} />
            <View style={[styles.headingLine, { width: '62%', backgroundColor: skeletonBaseColor }]} />
          </View>

          {/* 60-Word Short Summary Placeholders */}
          <View style={styles.summaryGroup}>
            <View style={[styles.summaryLine, { width: '100%', backgroundColor: skeletonMutedColor }]} />
            <View style={[styles.summaryLine, { width: '96%', backgroundColor: skeletonMutedColor }]} />
            <View style={[styles.summaryLine, { width: '92%', backgroundColor: skeletonMutedColor }]} />
            <View style={[styles.summaryLine, { width: '88%', backgroundColor: skeletonMutedColor }]} />
            <View style={[styles.summaryLine, { width: '54%', backgroundColor: skeletonMutedColor }]} />
          </View>

          {/* Bottom Footer Actions Placeholder */}
          <View style={styles.footerRow}>
            <View style={[styles.footerPill, { backgroundColor: skeletonMutedColor }]} />
            <View style={styles.footerIcons}>
              <View style={[styles.iconCircle, { backgroundColor: skeletonMutedColor }]} />
              <View style={[styles.iconCircle, { backgroundColor: skeletonMutedColor }]} />
            </View>
          </View>
        </View>

        {/* 3. Screen Glare / Shimmer Sheen Layer (Sweeps continuously across the card) */}
        <View style={styles.glareContainer} pointerEvents="none">
          <Animated.View
            style={[
              styles.glareBand,
              {
                width: cardWidth * 0.9,
                transform: [{ translateX }, { skewX: '-20deg' }],
              },
            ]}
          >
            <LinearGradient
              colors={glareColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pageWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  card: {
    width: '100%',
    maxWidth: 540,
    height: '100%',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    elevation: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  imageSkeleton: {
    width: '100%',
    height: '46%',
  },
  contentSkeleton: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  pillSkeleton: {
    width: 82,
    height: 22,
    borderRadius: 11,
  },
  domainSkeleton: {
    width: 90,
    height: 12,
    borderRadius: 6,
  },
  headingGroup: {
    gap: 8,
    marginVertical: 4,
  },
  headingLine: {
    height: 18,
    borderRadius: 9,
  },
  summaryGroup: {
    gap: 7,
    marginVertical: 4,
  },
  summaryLine: {
    height: 11,
    borderRadius: 5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  footerPill: {
    width: 110,
    height: 30,
    borderRadius: 15,
  },
  footerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  glareContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glareBand: {
    height: '100%',
  },
});
