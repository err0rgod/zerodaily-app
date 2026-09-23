import { Image } from 'expo-image';
import { RotateCcw } from 'lucide-react-native';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CATEGORIES, getDynamicFallbackImage } from '../../constants/categories';
import { useFeedStore } from '../../store/feedStore';
import { useTheme } from '../../store/themeStore';
import { Article, CategoryKey } from '../../types';
import { NewsCard } from './NewsCard';

interface CardSwiperProps {
  onOpenFullRoast: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
  onOpenImageViewer?: (imageUri: string, heading: string, category: CategoryKey) => void;
}

export const CardSwiper: React.FC<CardSwiperProps> = ({
  onOpenFullRoast,
  onOpenSourceLink,
  onOpenImageViewer,
}) => {
  const {
    articles,
    category,
    currentIndex,
    setCurrentIndex,
    refreshFeed,
    isRefreshing,
    loadInitialFeed,
    isLoading,
  } = useFeedStore();

  const { colors, isDark } = useTheme();

  // Screen / Container dimensions
  const [windowDim, setWindowDim] = useState(() => Dimensions.get('window'));
  const [containerHeight, setContainerHeight] = useState<number>(0);

  // Live mutable refs to permanently prevent stale closure traps in gesture handlers
  const currentIndexRef = useRef<number>(currentIndex);
  currentIndexRef.current = currentIndex;

  const articlesRef = useRef<Article[]>(articles);
  articlesRef.current = articles;

  const containerHeightRef = useRef<number>(containerHeight);
  containerHeightRef.current = containerHeight;

  const isAnimatingRef = useRef<boolean>(false);
  const panY = useRef(new Animated.Value(0)).current;

  // Window dimension listener for screen rotations / resizes
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowDim(window);
    });
    return () => sub?.remove();
  }, []);

  // Safe height getter that never returns 0
  const getCardHeight = useCallback((): number => {
    if (containerHeightRef.current > 60) {
      return containerHeightRef.current;
    }
    // Fallback based on window height minus top bar and bottom nav estimates
    return Math.max(windowDim.height - 110, 400);
  }, [windowDim.height]);

  // Initial feed load
  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  // Warm-up disk & memory image cache for category fallback pools
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

  // Image prefetching for upcoming cards
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

  // Reset animation position synchronously before paint whenever index or category changes
  useLayoutEffect(() => {
    panY.stopAnimation();
    panY.setValue(0);
    isAnimatingRef.current = false;
  }, [category, currentIndex, panY]);

  // Capture container height dynamically
  const handleLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 60 && height !== containerHeight) {
      setContainerHeight(height);
      containerHeightRef.current = height;
    }
  };

  // Programmatic navigation to next card
  const goToNextCard = useCallback(() => {
    const curr = currentIndexRef.current;
    const total = articlesRef.current.length;
    const height = getCardHeight();

    if (isAnimatingRef.current || curr >= total - 1) return;
    isAnimatingRef.current = true;

    Animated.timing(panY, {
      toValue: -height,
      duration: 230,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setCurrentIndex(curr + 1);
    });
  }, [getCardHeight, panY, setCurrentIndex]);

  // Programmatic navigation to previous card
  const goToPrevCard = useCallback(() => {
    const curr = currentIndexRef.current;
    const height = getCardHeight();

    if (isAnimatingRef.current) return;

    if (curr === 0) {
      refreshFeed();
      return;
    }

    isAnimatingRef.current = true;
    Animated.timing(panY, {
      toValue: height,
      duration: 230,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setCurrentIndex(curr - 1);
    });
  }, [getCardHeight, panY, setCurrentIndex, refreshFeed]);

  // Web desktop mouse wheel and arrow key shortcuts
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    let lastWheelTime = 0;
    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelTime < 400) return;

      if (e.deltaY > 20) {
        goToNextCard();
        lastWheelTime = now;
      } else if (e.deltaY < -20) {
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

  // Robust PanResponder with zero closure stale-state and full Android touch lifecycle handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (_, gesture) => {
        if (isAnimatingRef.current) return false;
        // Only trigger vertical card swipe when intent is clear (> 12px vertical displacement)
        return Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.8;
      },
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: () => {
        panY.stopAnimation();
        isAnimatingRef.current = false;
      },

      onPanResponderMove: (_, gesture) => {
        if (isAnimatingRef.current) return;
        panY.setValue(gesture.dy);
      },

      onPanResponderRelease: (_, gesture) => {
        if (isAnimatingRef.current) return;

        const height = getCardHeight();
        const threshold = Math.min(height * 0.12, 80); // Distance threshold (80px max)
        const isUpSwipe = gesture.dy < -threshold || gesture.vy < -0.25;
        const isDownSwipe = gesture.dy > threshold || gesture.vy > 0.25;

        const curr = currentIndexRef.current;
        const total = articlesRef.current.length;

        if (isUpSwipe && curr < total - 1) {
          // Swipe up: Active card slides away, next card underneath scales up
          isAnimatingRef.current = true;
          Animated.timing(panY, {
            toValue: -height,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }).start(() => {
            setCurrentIndex(curr + 1);
          });
        } else if (isDownSwipe && curr > 0) {
          // Swipe down: Active card slides down, previous card underneath scales up
          isAnimatingRef.current = true;
          Animated.timing(panY, {
            toValue: height,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }).start(() => {
            setCurrentIndex(curr - 1);
          });
        } else if (isDownSwipe && curr === 0) {
          // Pull-down at top card: Refresh trigger
          if (gesture.dy > 55) {
            refreshFeed();
          }
          Animated.spring(panY, {
            toValue: 0,
            friction: 7,
            tension: 50,
            useNativeDriver: Platform.OS !== 'web',
          }).start(() => {
            isAnimatingRef.current = false;
          });
        } else {
          // Swipe didn't exceed threshold: Snap back to rest
          Animated.spring(panY, {
            toValue: 0,
            friction: 7,
            tension: 50,
            useNativeDriver: Platform.OS !== 'web',
          }).start(() => {
            isAnimatingRef.current = false;
          });
        }
      },

      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        isAnimatingRef.current = false;
        Animated.spring(panY, {
          toValue: 0,
          friction: 7,
          tension: 50,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      },
    })
  ).current;

  if (articles.length === 0) {
    if (isLoading) {
      return (
        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptySub, { color: colors.textSecondary, marginTop: 12 }]}>
            Loading latest stories...
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Stories Available</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Pull down to check for breaking tech feeds.
        </Text>
      </View>
    );
  }

  const height = getCardHeight();
  const cardRenderHeight = containerHeight > 60 ? containerHeight : height;

  const currentArticle = articles[currentIndex] || articles[0];
  const nextArticle = currentIndex < articles.length - 1 ? articles[currentIndex + 1] : null;
  const prevArticle = currentIndex > 0 ? articles[currentIndex - 1] : null;

  const activeSlot = currentIndex % 3;
  const nextSlot = (currentIndex + 1) % 3;
  const prevSlot = (currentIndex - 1 + 3) % 3;

  const getSlotArticle = (slotIndex: number): Article | null => {
    if (slotIndex === activeSlot) return currentArticle;
    if (slotIndex === nextSlot) return nextArticle;
    if (slotIndex === prevSlot) return prevArticle;
    return null;
  };

  const orderedSlots = [prevSlot, nextSlot, activeSlot];

  // Deck Layer Transformations:
  // 1. Next Card Underneath: scales from 0.94 up to 1.0, translates Y from 14px to 0px
  const nextCardScale = panY.interpolate({
    inputRange: [-height, 0],
    outputRange: [1.0, 0.94],
    extrapolate: 'clamp',
  });

  const nextCardTranslateY = panY.interpolate({
    inputRange: [-height, 0],
    outputRange: [0, 14],
    extrapolate: 'clamp',
  });

  const nextCardOpacity = panY.interpolate({
    inputRange: [-height, 0, 0.001],
    outputRange: [1.0, 0.92, 0],
    extrapolate: 'clamp',
  });

  const nextCardDimmer = panY.interpolate({
    inputRange: [-height, 0],
    outputRange: [0, 0.2],
    extrapolate: 'clamp',
  });

  // 2. Previous Card Underneath (when swiping down to go back): scales from 0.94 up to 1.0
  const prevCardScale = panY.interpolate({
    inputRange: [0, height],
    outputRange: [0.94, 1.0],
    extrapolate: 'clamp',
  });

  const prevCardTranslateY = panY.interpolate({
    inputRange: [0, height],
    outputRange: [14, 0],
    extrapolate: 'clamp',
  });

  const prevCardOpacity = panY.interpolate({
    inputRange: [-0.001, 0, height],
    outputRange: [0, 0.92, 1.0],
    extrapolate: 'clamp',
  });

  const prevCardDimmer = panY.interpolate({
    inputRange: [0, height],
    outputRange: [0.2, 0],
    extrapolate: 'clamp',
  });

  // 3. Active Card (ALWAYS ON TOP at zIndex: 10):
  // When swiping up: slides up to -height
  // When swiping down at card 0: rubber bands up to 90px
  // When swiping down at card > 0: slides down to +height
  const activeCardTranslateY = panY.interpolate({
    inputRange: [-height, 0, height],
    outputRange: [
      -height,
      0,
      currentIndex === 0 ? 90 : height,
    ],
    extrapolate: 'clamp',
  });

  // Pull-to-refresh badge interpolation
  const pullProgress = panY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
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

        {/* PERSISTENT 3-SLOT DECK: Pre-mounts incoming cards so images never blink across slides */}
        {orderedSlots.map((slotIndex) => {
          const article = getSlotArticle(slotIndex);
          if (!article) return null;

          const isCurrent = slotIndex === activeSlot;
          const isNext = slotIndex === nextSlot;
          const isPrev = slotIndex === prevSlot;

          const layerTransform = isCurrent
            ? [{ translateY: activeCardTranslateY }]
            : isNext
            ? [{ translateY: nextCardTranslateY }, { scale: nextCardScale }]
            : [{ translateY: prevCardTranslateY }, { scale: prevCardScale }];

          const layerOpacity = isCurrent
            ? 1
            : isNext
            ? nextCardOpacity
            : prevCardOpacity;

          const layerZIndex = isCurrent ? 10 : isNext ? 4 : 3;
          const dimmer = isNext ? nextCardDimmer : isPrev ? prevCardDimmer : null;

          return (
            <Animated.View
              key={`deck-slot-${slotIndex}`}
              style={[
                styles.cardLayer,
                {
                  height: cardRenderHeight,
                  zIndex: layerZIndex,
                  opacity: layerOpacity,
                  transform: layerTransform,
                },
              ]}
              pointerEvents={isCurrent ? 'auto' : 'none'}
            >
              <NewsCard
                key={article.id}
                article={article}
                cardHeight={cardRenderHeight}
                onOpenFullRoast={onOpenFullRoast}
                onOpenSourceLink={onOpenSourceLink}
                onOpenImageViewer={onOpenImageViewer}
              />
              {dimmer && (
                <Animated.View
                  style={[
                    styles.depthVeil,
                    {
                      opacity: dimmer,
                      backgroundColor: isDark ? '#000000' : '#475569',
                    },
                  ]}
                />
              )}
            </Animated.View>
          );
        })}
      </View>
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
});
