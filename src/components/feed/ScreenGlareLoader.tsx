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
 * Employs a dual-layer effect:
 * 1. Synchronized pulse animation across skeleton placeholder blocks (breathing shimmer).
 * 2. An angled, high-contrast luminous glare beam sweeping continuously across the card.
 */
export const ScreenGlareLoader: React.FC<ScreenGlareLoaderProps> = ({ cardHeight }) => {
  const { colors, isDark } = useTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const height = cardHeight || Math.max(windowHeight - 110, 400);
  const cardWidth = Math.min(windowWidth - 32, 540);

  // 1. Sweeping glare beam animation (continuous loop)
  const glareAnim = useRef(new Animated.Value(0)).current;

  // 2. Skeleton breathing pulse animation
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Start glare beam loop
    const glareLoop = Animated.loop(
      Animated.timing(glareAnim, {
        toValue: 1,
        duration: 1300,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );

    // Start skeleton pulse loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    glareLoop.start();
    pulseLoop.start();

    return () => {
      glareLoop.stop();
      pulseLoop.stop();
    };
  }, [glareAnim, pulseAnim]);

  // Sweeping translation for glare beam from left to right
  const translateX = glareAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-cardWidth * 1.5, cardWidth * 2.0],
  });

  // Base colors for placeholders
  const skeletonBase = isDark ? '#18181B' : '#E2E8F0';
  const skeletonMuted = isDark ? '#27272A' : '#EDF2F7';

  // High-visibility luminous glare colors
  const glareColors = isDark
    ? ([
        'rgba(255, 255, 255, 0)',
        'rgba(255, 255, 255, 0.06)',
        'rgba(255, 255, 255, 0.28)',
        'rgba(255, 255, 255, 0.06)',
        'rgba(255, 255, 255, 0)',
      ] as const)
    : ([
        'rgba(255, 255, 255, 0)',
        'rgba(255, 255, 255, 0.40)',
        'rgba(255, 255, 255, 0.88)',
        'rgba(255, 255, 255, 0.40)',
        'rgba(255, 255, 255, 0)',
      ] as const);

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
        {/* 1. Animated Skeleton Content Body with Breathing Pulse */}
        <Animated.View style={[styles.skeletonContainer, { opacity: pulseAnim }]}>
          {/* Hero Image Placeholder */}
          <View style={[styles.imageSkeleton, { backgroundColor: skeletonBase }]} />

          {/* Content Details Placeholder */}
          <View style={styles.contentSkeleton}>
            {/* Metadata: Category Badge Pill + Domain */}
            <View style={styles.metaRow}>
              <View style={[styles.pillSkeleton, { backgroundColor: skeletonMuted }]} />
              <View style={[styles.domainSkeleton, { backgroundColor: skeletonMuted }]} />
            </View>

            {/* Staggered Headline Lines */}
            <View style={styles.headingGroup}>
              <View style={[styles.headingLine, { width: '92%', backgroundColor: skeletonBase }]} />
              <View style={[styles.headingLine, { width: '84%', backgroundColor: skeletonBase }]} />
              <View style={[styles.headingLine, { width: '60%', backgroundColor: skeletonBase }]} />
            </View>

            {/* 60-Word Summary Lines */}
            <View style={styles.summaryGroup}>
              <View style={[styles.summaryLine, { width: '100%', backgroundColor: skeletonMuted }]} />
              <View style={[styles.summaryLine, { width: '96%', backgroundColor: skeletonMuted }]} />
              <View style={[styles.summaryLine, { width: '90%', backgroundColor: skeletonMuted }]} />
              <View style={[styles.summaryLine, { width: '85%', backgroundColor: skeletonMuted }]} />
              <View style={[styles.summaryLine, { width: '50%', backgroundColor: skeletonMuted }]} />
            </View>

            {/* Bottom Actions */}
            <View style={styles.footerRow}>
              <View style={[styles.footerPill, { backgroundColor: skeletonMuted }]} />
              <View style={styles.footerIcons}>
                <View style={[styles.iconCircle, { backgroundColor: skeletonMuted }]} />
                <View style={[styles.iconCircle, { backgroundColor: skeletonMuted }]} />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* 2. High-Contrast Sweeping Glare Beam Overlay (Native-accelerated rotate & translate) */}
        <View style={styles.glareContainer} pointerEvents="none">
          <Animated.View
            style={[
              styles.glareBand,
              {
                width: cardWidth * 0.75,
                transform: [
                  { translateX },
                  { rotate: '25deg' },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={glareColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.5 }}
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
  skeletonContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
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
    zIndex: 100,
    elevation: 10,
  },
  glareBand: {
    position: 'absolute',
    top: -120,
    bottom: -120,
  },
});
