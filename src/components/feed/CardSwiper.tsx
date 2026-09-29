import * as Haptics from 'expo-haptics';
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
import { useUserStore } from '../../store/userStore';
import { Article, CategoryKey } from '../../types';
import { NewsCard } from './NewsCard';
import { ScreenGlareLoader } from './ScreenGlareLoader';

interface CardSwiperProps {
  onOpenFullRoast: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
  onOpenImageViewer?: (imageUri: string, heading: string, category: CategoryKey) => void;
}

/** Drag distance at the top card past which releasing triggers a refresh. */
const PULL_REFRESH_TRIGGER_PX = 55;

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

  /**
   * The pull-to-refresh badge is mounted only while a drag is genuinely in
   * progress. Its old visibility came purely from an animated value, and with
   * the native driver that value could survive the deck unmounting mid-refresh
   * and strand the badge on screen until the next touch.
   */
  const [isPulling, setIsPulling] = useState(false);
  const [canRelease, setCanRelease] = useState(false);
  const canReleaseRef = useRef<boolean>(false);

  /** Drag distance past which releasing triggers a refresh. */
  const setReleaseReady = (ready: boolean) => {
    if (ready === canReleaseRef.current) return;
    canReleaseRef.current = ready;
    setCanRelease(ready);
  };

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

  // Initial feed load if store is empty and not already loading
  useEffect(() => {
    if (articles.length === 0 && !isLoading) {
      loadInitialFeed();
    }
  }, [articles.length, isLoading, loadInitialFeed]);

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

  // Track reading/dwell duration and skip telemetry for the feed algorithm
  const cardStartTimeRef = useRef<number>(Date.now());
  const prevArticleRef = useRef<Article | null>(null);

  useEffect(() => {
    const currentArticle = articles[currentIndex];
    const prevArticle = prevArticleRef.current;

    if (prevArticle && prevArticle.id !== currentArticle?.id) {
      const elapsedSeconds = (Date.now() - cardStartTimeRef.current) / 1000;
      if (elapsedSeconds >= 2.0) {
        useUserStore.getState().trackEvent(
          prevArticle.id,
          prevArticle.category,
          'read',
          Math.min(elapsedSeconds, 120)
        );
      } else if (elapsedSeconds >= 0.4) {
        useUserStore.getState().trackEvent(
          prevArticle.id,
          prevArticle.category,
          'skip',
          elapsedSeconds
        );
      }
    }

    cardStartTimeRef.current = Date.now();
    prevArticleRef.current = currentArticle || null;
  }, [currentIndex, category, articles]);

  // Reset animation position synchronously before paint whenever index or category changes
  useLayoutEffect(() => {
    panY.stopAnimation();
    panY.setValue(0);
    isAnimatingRef.current = false;
    canReleaseRef.current = false;
    setIsPulling(false);
    setCanRelease(false);
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

  // Vertical-only card deck. The full story is reached through the arrow
  // button on the card, so no horizontal axis is claimed here.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (_, gesture) => {
        if (isAnimatingRef.current) return false;
        return (
          Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.75
        );
      },
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: () => {
        panY.stopAnimation();
        isAnimatingRef.current = false;
        setIsPulling(true);
      },

      onPanResponderMove: (_, gesture) => {
        if (isAnimatingRef.current) return;
        setReleaseReady(gesture.dy > PULL_REFRESH_TRIGGER_PX);
        panY.setValue(gesture.dy);
      },

      onPanResponderRelease: (_, gesture) => {
        setIsPulling(false);
        setReleaseReady(false);
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
        } else {
          // Pull-down at the top card triggers a refresh; anything else snaps back
          if (isDownSwipe && curr === 0 && gesture.dy > PULL_REFRESH_TRIGGER_PX) {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
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
        }
      },

      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        isAnimatingRef.current = false;
        setIsPulling(false);
        setReleaseReady(false);
        Animated.spring(panY, {
          toValue: 0,
          friction: 7,
          tension: 50,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      },
    })
  ).current;

  // The deck stays mounted while a refresh is in flight. Swapping it for the
  // skeleton used to unmount the very view the pan gesture was attached to and
  // blank the card the user was reading.
  if (articles.length === 0) {
    if (isLoading) {
      const renderHeight = containerHeight > 60 ? containerHeight : getCardHeight();
      return <ScreenGlareLoader cardHeight={renderHeight} />;
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
        {/* Pull affordance, mounted only during an active drag */}
        {isPulling && !isRefreshing && currentIndex === 0 && (
          <Animated.View
            style={[
              styles.pullRefreshBadge,
              {
                backgroundColor: colors.surface,
                borderColor: canRelease ? colors.primary : colors.border,
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
            <RotateCcw size={14} color={colors.primary} />
            <Text style={[styles.pullRefreshText, { color: colors.textPrimary }]}>
              {canRelease ? 'Release to refresh' : 'Pull down to refresh'}
            </Text>
          </Animated.View>
        )}

        {/* Refresh-in-flight pill. Driven by store state alone, so it cannot
            outlive the request the way an animated value could. */}
        {isRefreshing && (
          <View
            style={[
              styles.pullRefreshBadge,
              styles.refreshingBadge,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.pullRefreshText, { color: colors.textPrimary }]}>
              Refreshing stories...
            </Text>
          </View>
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
  refreshingBadge: {
    transform: [{ translateY: 12 }],
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
