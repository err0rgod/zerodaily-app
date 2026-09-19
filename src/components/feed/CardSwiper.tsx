import { Image } from 'expo-image';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CATEGORIES, getDynamicFallbackImage } from '../../constants/categories';
import { useFeedStore } from '../../store/feedStore';
import { useTheme } from '../../store/themeStore';
import { Article } from '../../types';
import { NewsCard } from './NewsCard';

interface CardSwiperProps {
  onOpenFullRoast: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
}

const SWIPE_THRESHOLD_RATIO = 0.12; // Swipe distance threshold relative to container height
const SWIPE_VELOCITY_THRESHOLD = 0.3; // Flick velocity threshold

export const CardSwiper: React.FC<CardSwiperProps> = ({
  onOpenFullRoast,
  onOpenSourceLink,
}) => {
  const {
    articles,
    category,
    currentIndex,
    setCurrentIndex,
    refreshFeed,
    isRefreshing,
    loadInitialFeed,
  } = useFeedStore();

  const { colors, isDark } = useTheme();

  const [containerHeight, setContainerHeight] = useState<number>(0);
  const isAnimating = useRef<boolean>(false);
  const panY = useRef(new Animated.Value(0)).current;

  // Initial feed load on mount
  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  // Warm-up disk & memory image cache for category fallback pools on mount
  useEffect(() => {
    Object.values(CATEGORIES).forEach((cat) => {
      const pool = cat.fallbackImages || [cat.fallbackImage];
      pool.forEach((img) => {
        if (img) {
          Image.prefetch(img).catch(() => {});
        }
      });
    });
  }, []);

  // Image prefetching for upcoming 3 cards
  useEffect(() => {
    if (articles.length > 0) {
      const nextBatch = articles.slice(currentIndex + 1, currentIndex + 4);
      nextBatch.forEach((article) => {
        const url =
          article.image_url && article.image_url.trim().length > 0
            ? article.image_url
            : getDynamicFallbackImage(article.id, article.category);
        if (url) {
          Image.prefetch(url).catch(() => {});
        }
      });
    }
  }, [currentIndex, articles]);

  // Reset animation and active index to 0 when category changes
  useEffect(() => {
    panY.setValue(0);
    isAnimating.current = false;
  }, [category, panY]);

  // Capture container height dynamically for pixel-perfect card sizing
  const handleLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0 && height !== containerHeight) {
      setContainerHeight(height);
    }
  };

  // Programmatic navigation to next card with underneath-deck reveal animation
  const goToNextCard = useCallback(() => {
    if (isAnimating.current || currentIndex >= articles.length - 1 || containerHeight <= 0) return;
    isAnimating.current = true;

    Animated.timing(panY, {
      toValue: -containerHeight,
      duration: 270,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      panY.setValue(0);
      setCurrentIndex(currentIndex + 1);
      isAnimating.current = false;
    });
  }, [currentIndex, articles.length, containerHeight, panY, setCurrentIndex]);

  // Programmatic navigation to previous card
  const goToPrevCard = useCallback(() => {
    if (isAnimating.current || containerHeight <= 0) return;

    if (currentIndex === 0) {
      refreshFeed();
      return;
    }

    isAnimating.current = true;
    Animated.timing(panY, {
      toValue: containerHeight,
      duration: 270,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      panY.setValue(0);
      setCurrentIndex(currentIndex - 1);
      isAnimating.current = false;
    });
  }, [currentIndex, containerHeight, panY, setCurrentIndex, refreshFeed]);

  // Web mouse wheel and keyboard shortcuts for seamless testing in desktop browser
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    let lastWheelTime = 0;
    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelTime < 420) return;

      if (e.deltaY > 25) {
        goToNextCard();
        lastWheelTime = now;
      } else if (e.deltaY < -25) {
        goToPrevCard();
        lastWheelTime = now;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToNextCard();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevCard();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToNextCard, goToPrevCard]);

  // PanResponder for mobile touch drag & web mouse drag
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (isAnimating.current) return false;
        return Math.abs(gesture.dy) > 9 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.4;
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (isAnimating.current) return false;
        return Math.abs(gesture.dy) > 9 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.4;
      },
      onPanResponderGrant: () => {
        panY.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        if (isAnimating.current) return;
        panY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (isAnimating.current || containerHeight <= 0) return;
        const threshold = containerHeight * SWIPE_THRESHOLD_RATIO;
        const isUpSwipe = gesture.dy < -threshold || gesture.vy < -SWIPE_VELOCITY_THRESHOLD;
        const isDownSwipe = gesture.dy > threshold || gesture.vy > SWIPE_VELOCITY_THRESHOLD;

        if (isUpSwipe) {
          if (currentIndex < articles.length - 1) {
            // Swipe up: Active card slides up & reveals card underneath
            isAnimating.current = true;
            Animated.timing(panY, {
              toValue: -containerHeight,
              duration: 250,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: Platform.OS !== 'web',
            }).start(() => {
              panY.setValue(0);
              setCurrentIndex(currentIndex + 1);
              isAnimating.current = false;
            });
          } else {
            // Reached last card: spring back to 0
            Animated.spring(panY, {
              toValue: 0,
              friction: 7,
              tension: 45,
              useNativeDriver: Platform.OS !== 'web',
            }).start();
          }
        } else if (isDownSwipe) {
          if (currentIndex > 0) {
            // Swipe down: Previous card slides down from top
            isAnimating.current = true;
            Animated.timing(panY, {
              toValue: containerHeight,
              duration: 250,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: Platform.OS !== 'web',
            }).start(() => {
              panY.setValue(0);
              setCurrentIndex(currentIndex - 1);
              isAnimating.current = false;
            });
          } else {
            // At first card: Pull-to-refresh
            if (gesture.dy > 60) {
              refreshFeed();
            }
            Animated.spring(panY, {
              toValue: 0,
              friction: 8,
              tension: 50,
              useNativeDriver: Platform.OS !== 'web',
            }).start();
          }
        } else {
          // Incomplete drag: spring back to rest
          Animated.spring(panY, {
            toValue: 0,
            friction: 7,
            tension: 45,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
      },
    })
  ).current;

  if (articles.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Stories Available</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Pull down to check for breaking tech feeds.
        </Text>
      </View>
    );
  }

  const currentArticle = articles[currentIndex] || articles[0];
  const nextArticle = currentIndex < articles.length - 1 ? articles[currentIndex + 1] : null;
  const prevArticle = currentIndex > 0 ? articles[currentIndex - 1] : null;

  // Deck Layer Transformations:
  // 1. Next Card Underneath: scales from 0.94 up to 1.0, translates Y from 16px to 0px
  const nextCardScale = panY.interpolate({
    inputRange: [-containerHeight || -600, 0],
    outputRange: [1.0, 0.94],
    extrapolate: 'clamp',
  });

  const nextCardTranslateY = panY.interpolate({
    inputRange: [-containerHeight || -600, 0],
    outputRange: [0, 16],
    extrapolate: 'clamp',
  });

  const nextCardOpacity = panY.interpolate({
    inputRange: [-containerHeight || -600, 0],
    outputRange: [1.0, 0.9],
    extrapolate: 'clamp',
  });

  const nextCardDimmer = panY.interpolate({
    inputRange: [-containerHeight || -600, 0],
    outputRange: [0, 0.22],
    extrapolate: 'clamp',
  });

  // 2. Active Card: slides upward when swiping up; scales down slightly when swiping down to reveal prev
  const activeCardTranslateY = panY.interpolate({
    inputRange: [-containerHeight || -600, 0, containerHeight || 600],
    outputRange: [
      -containerHeight || -600,
      0,
      currentIndex === 0 ? 110 : 18, // Rubber band on card 0, slight depth movement if going to prev
    ],
    extrapolate: 'clamp',
  });

  const activeCardScale = panY.interpolate({
    inputRange: [0, containerHeight || 600],
    outputRange: [1.0, currentIndex > 0 ? 0.94 : 1.0],
    extrapolate: 'clamp',
  });

  const activeCardOpacity = panY.interpolate({
    inputRange: [0, containerHeight || 600],
    outputRange: [1.0, currentIndex > 0 ? 0.8 : 1.0],
    extrapolate: 'clamp',
  });

  // 3. Previous Card: sits above active card when user drags down
  const prevCardTranslateY = panY.interpolate({
    inputRange: [0, containerHeight || 600],
    outputRange: [-containerHeight || -600, 0],
    extrapolate: 'clamp',
  });

  // Pull-to-refresh badge interpolation
  const pullProgress = panY.interpolate({
    inputRange: [0, 70],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {containerHeight > 0 && (
        <View style={styles.deckWrapper}>
          {/* Pull to refresh visual badge (when pulling down at card 0) */}
          {currentIndex === 0 && (
            <Animated.View
              style={[
                styles.pullRefreshBadge,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pullProgress,
                  transform: [
                    {
                      translateY: panY.interpolate({
                        inputRange: [0, 100],
                        outputRange: [-35, 12],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <RotateCcw size={14} color={colors.primary} />
              )}
              <Text style={[styles.pullRefreshText, { color: colors.textPrimary }]}>
                {isRefreshing ? 'Refreshing stories...' : 'Pull down to refresh'}
              </Text>
            </Animated.View>
          )}

          {/* LAYER 1: NEXT CARD (Positioned Underneath Active Card) */}
          {nextArticle && (
            <Animated.View
              style={[
                styles.cardLayer,
                {
                  height: containerHeight,
                  zIndex: 1,
                  opacity: nextCardOpacity,
                  transform: [{ translateY: nextCardTranslateY }, { scale: nextCardScale }],
                },
              ]}
              pointerEvents="none"
            >
              <NewsCard
                article={nextArticle}
                cardHeight={containerHeight}
                onOpenFullRoast={onOpenFullRoast}
                onOpenSourceLink={onOpenSourceLink}
              />
              {/* Subtle dynamic depth shadow veil over underneath card */}
              <Animated.View
                style={[
                  styles.depthVeil,
                  {
                    opacity: nextCardDimmer,
                    backgroundColor: isDark ? '#000000' : '#475569',
                  },
                ]}
              />
            </Animated.View>
          )}

          {/* LAYER 2: CURRENT ACTIVE CARD */}
          <Animated.View
            style={[
              styles.cardLayer,
              {
                height: containerHeight,
                zIndex: 2,
                opacity: activeCardOpacity,
                transform: [{ translateY: activeCardTranslateY }, { scale: activeCardScale }],
              },
            ]}
          >
            <NewsCard
              article={currentArticle}
              cardHeight={containerHeight}
              onOpenFullRoast={onOpenFullRoast}
              onOpenSourceLink={onOpenSourceLink}
            />
          </Animated.View>

          {/* LAYER 3: PREVIOUS CARD (Slides Down Over Current When Swiping Down) */}
          {prevArticle && (
            <Animated.View
              style={[
                styles.cardLayer,
                {
                  height: containerHeight,
                  zIndex: 3,
                  transform: [{ translateY: prevCardTranslateY }],
                },
              ]}
              pointerEvents="none"
            >
              <NewsCard
                article={prevArticle}
                cardHeight={containerHeight}
                onOpenFullRoast={onOpenFullRoast}
                onOpenSourceLink={onOpenSourceLink}
              />
            </Animated.View>
          )}

          {/* Floating Web Navigation Controls for Desktop Testing */}
          {Platform.OS === 'web' && articles.length > 1 && (
            <View style={styles.webControls}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={goToPrevCard}
                disabled={currentIndex === 0}
                style={[
                  styles.webNavBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: currentIndex === 0 ? 0.4 : 0.92,
                  },
                ]}
              >
                <ArrowUp size={15} color={colors.textPrimary} />
              </TouchableOpacity>

              <View
                style={[
                  styles.webCounterBadge,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.webCounterText, { color: colors.textSecondary }]}>
                  {currentIndex + 1}/{articles.length}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={goToNextCard}
                disabled={currentIndex >= articles.length - 1}
                style={[
                  styles.webNavBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: currentIndex >= articles.length - 1 ? 0.4 : 0.92,
                  },
                ]}
              >
                <ArrowDown size={15} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  deckWrapper: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  cardLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    width: '100%',
  },
  depthVeil: {
    position: 'absolute',
    top: 4,
    left: 10,
    right: 10,
    bottom: 6,
    borderRadius: 18,
  },
  pullRefreshBadge: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  pullRefreshText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
  webControls: {
    position: 'absolute',
    right: 22,
    bottom: 24,
    zIndex: 99,
    alignItems: 'center',
    gap: 6,
  },
  webNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  webCounterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webCounterText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
