import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { RotateCcw } from 'lucide-react-native';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
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
import { NewsCardBack } from './NewsCardBack';
import { ScreenGlareLoader } from './ScreenGlareLoader';

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
  const gestureDirectionRef = useRef<'none' | 'vertical' | 'horizontal'>('none');
  const panY = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const isFlippedRef = useRef<boolean>(false);
  isFlippedRef.current = isFlipped;
  const refreshSpinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRefreshing) {
      const loop = Animated.loop(
        Animated.timing(refreshSpinAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      refreshSpinAnim.setValue(0);
    }
  }, [isRefreshing, refreshSpinAnim]);

  const refreshSpin = refreshSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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

  // Reset animation position synchronously before paint whenever index or category changes
  useLayoutEffect(() => {
    panY.stopAnimation();
    flipAnim.stopAnimation();
    panY.setValue(0);
    flipAnim.setValue(0);
    setIsFlipped(false);
    isFlippedRef.current = false;
    isAnimatingRef.current = false;
    gestureDirectionRef.current = 'none';
  }, [category, currentIndex, panY, flipAnim]);

  // Capture container height dynamically
  const handleLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 60 && height !== containerHeight) {
      setContainerHeight(height);
      containerHeightRef.current = height;
    }
  };

  // Programmatic 3D Card Flip toggle
  const toggleFlip = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    const target = isFlippedRef.current ? 0 : 1;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.spring(flipAnim, {
      toValue: target,
      friction: 8,
      tension: 45,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      const next = target === 1;
      setIsFlipped(next);
      isFlippedRef.current = next;
      isAnimatingRef.current = false;
    });
  }, [flipAnim]);

  // Programmatic navigation to next card
  const goToNextCard = useCallback(() => {
    const curr = currentIndexRef.current;
    const total = articlesRef.current.length;
    const height = getCardHeight();

    if (isAnimatingRef.current || curr >= total - 1) return;
    isAnimatingRef.current = true;
    flipAnim.setValue(0);
    setIsFlipped(false);
    isFlippedRef.current = false;

    Animated.timing(panY, {
      toValue: -height,
      duration: 230,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setCurrentIndex(curr + 1);
    });
  }, [getCardHeight, panY, setCurrentIndex, flipAnim]);

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
    flipAnim.setValue(0);
    setIsFlipped(false);
    isFlippedRef.current = false;

    Animated.timing(panY, {
      toValue: height,
      duration: 230,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setCurrentIndex(curr - 1);
    });
  }, [getCardHeight, panY, setCurrentIndex, refreshFeed, flipAnim]);

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

  // Robust PanResponder supporting vertical deck switching & interactive 3D horizontal card flipping (>30% threshold)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (_, gesture) => {
        if (isAnimatingRef.current) return false;
        // Vertical card swipe when displacement > 12px
        const isVertical = Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.75;
        // Horizontal left or right swipe to flip card when displacement > 12px
        const isHorizontal = Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.75;
        return isVertical || isHorizontal;
      },
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: () => {
        panY.stopAnimation();
        flipAnim.stopAnimation();
        isAnimatingRef.current = false;
        gestureDirectionRef.current = 'none';
      },

      onPanResponderMove: (_, gesture) => {
        if (isAnimatingRef.current) return;

        if (gestureDirectionRef.current === 'none') {
          if (Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
            gestureDirectionRef.current = 'vertical';
          } else if (Math.abs(gesture.dx) > 0) {
            gestureDirectionRef.current = 'horizontal';
          }
        }

        if (gestureDirectionRef.current === 'vertical') {
          panY.setValue(gesture.dy);
        } else if (gestureDirectionRef.current === 'horizontal') {
          // Interactive 3D flip tracking as user drags finger left or right
          const screenWidth = windowDim.width;
          const dragDist = Math.abs(gesture.dx);
          const dragProgress = Math.min(dragDist / (screenWidth * 0.7), 1);

          if (isFlippedRef.current) {
            // Currently at Back face: dragging moves back towards Front (0)
            flipAnim.setValue(Math.max(1 - dragProgress, 0));
          } else {
            // Currently at Front face: dragging moves towards Back (1)
            flipAnim.setValue(dragProgress);
          }
        }
      },

      onPanResponderRelease: (_, gesture) => {
        if (isAnimatingRef.current) return;

        if (gestureDirectionRef.current === 'horizontal') {
          const screenWidth = windowDim.width;
          const dragFraction = Math.abs(gesture.dx) / screenWidth;
          // Requirement: "sliding should not be fully automated so that the user only flips 10% and the card flips it should be more than 30%"
          const thresholdPassed = dragFraction >= 0.30 || Math.abs(gesture.vx) > 0.65;

          isAnimatingRef.current = true;
          if (isFlippedRef.current) {
            // Was at back: flip to front if threshold passed (>30%), else stay at back (1)
            const target = thresholdPassed ? 0 : 1;
            if (thresholdPassed && Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
            Animated.spring(flipAnim, {
              toValue: target,
              friction: 8,
              tension: 45,
              useNativeDriver: Platform.OS !== 'web',
            }).start(() => {
              const nextFlipped = target === 1;
              setIsFlipped(nextFlipped);
              isFlippedRef.current = nextFlipped;
              isAnimatingRef.current = false;
              gestureDirectionRef.current = 'none';
            });
          } else {
            // Was at front: flip to back if threshold passed (>30%), else snap back to front (0)
            const target = thresholdPassed ? 1 : 0;
            if (thresholdPassed && Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
            Animated.spring(flipAnim, {
              toValue: target,
              friction: 8,
              tension: 45,
              useNativeDriver: Platform.OS !== 'web',
            }).start(() => {
              const nextFlipped = target === 1;
              setIsFlipped(nextFlipped);
              isFlippedRef.current = nextFlipped;
              isAnimatingRef.current = false;
              gestureDirectionRef.current = 'none';
            });
          }
          return;
        }

        const height = getCardHeight();
        const threshold = Math.min(height * 0.12, 80); // Distance threshold (80px max)
        const isUpSwipe = gesture.dy < -threshold || gesture.vy < -0.25;
        const isDownSwipe = gesture.dy > threshold || gesture.vy > 0.25;

        const curr = currentIndexRef.current;
        const total = articlesRef.current.length;

        if (isUpSwipe && curr < total - 1) {
          // Swipe up: Active card slides away, next card underneath scales up
          isAnimatingRef.current = true;
          flipAnim.setValue(0);
          setIsFlipped(false);
          isFlippedRef.current = false;
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
          flipAnim.setValue(0);
          setIsFlipped(false);
          isFlippedRef.current = false;
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
        gestureDirectionRef.current = 'none';
        Animated.spring(panY, {
          toValue: 0,
          friction: 7,
          tension: 50,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
        Animated.spring(flipAnim, {
          toValue: isFlippedRef.current ? 1 : 0,
          friction: 8,
          tension: 45,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      },
    })
  ).current;

  // Show ScreenGlareLoader on initial load AND on pull-to-refresh
  if (articles.length === 0 || isRefreshing) {
    if (isLoading || isRefreshing) {
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
  // 1. Next Card Underneath: scales from 0.96 up to 1.0, translates Y from 8px to 0px
  const nextCardScale = panY.interpolate({
    inputRange: [-height, 0],
    outputRange: [1.0, 0.96],
    extrapolate: 'clamp',
  });

  const nextCardTranslateY = panY.interpolate({
    inputRange: [-height, 0],
    outputRange: [0, 8],
    extrapolate: 'clamp',
  });

  // Next card is VISIBLE underneath so that flipping reveals the card below!
  const nextCardOpacity = panY.interpolate({
    inputRange: [-height, 0],
    outputRange: [1.0, 0.98],
    extrapolate: 'clamp',
  });

  const nextCardDimmer = panY.interpolate({
    inputRange: [-height, 0],
    outputRange: [0, 0.15],
    extrapolate: 'clamp',
  });

  // 2. Previous Card Underneath (when swiping down to go back): scales from 0.96 up to 1.0
  const prevCardScale = panY.interpolate({
    inputRange: [0, height],
    outputRange: [0.96, 1.0],
    extrapolate: 'clamp',
  });

  const prevCardTranslateY = panY.interpolate({
    inputRange: [0, height],
    outputRange: [8, 0],
    extrapolate: 'clamp',
  });

  const prevCardOpacity = panY.interpolate({
    inputRange: [-0.001, 0, height],
    outputRange: [0, 0.98, 1.0],
    extrapolate: 'clamp',
  });

  const prevCardDimmer = panY.interpolate({
    inputRange: [0, height],
    outputRange: [0.15, 0],
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

  // 4. 3D Flip Card Rotations (Perspective 1200 with backfaceVisibility)
  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.51, 1],
    outputRange: [0, 0, 1, 1],
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
            <Animated.View style={{ transform: [{ rotate: isRefreshing ? refreshSpin : '0deg' }] }}>
              <RotateCcw size={14} color={colors.primary} />
            </Animated.View>
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
              {isCurrent ? (
                <View style={StyleSheet.absoluteFill}>
                  {/* FRONT FACE (Main Card with Image) */}
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        opacity: frontOpacity,
                        transform: [
                          { perspective: 1200 },
                          { rotateY: frontRotateY },
                        ],
                        backfaceVisibility: 'hidden',
                      },
                    ]}
                    pointerEvents={isFlipped ? 'none' : 'auto'}
                  >
                    <NewsCard
                      key={`front-${article.id}`}
                      article={article}
                      cardHeight={cardRenderHeight}
                      onOpenFullRoast={onOpenFullRoast}
                      onOpenSourceLink={onOpenSourceLink}
                      onOpenImageViewer={onOpenImageViewer}
                      onFlip={toggleFlip}
                    />
                  </Animated.View>

                  {/* BACK FACE (Summary & Heading, NO IMAGE) */}
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        opacity: backOpacity,
                        transform: [
                          { perspective: 1200 },
                          { rotateY: backRotateY },
                        ],
                        backfaceVisibility: 'hidden',
                      },
                    ]}
                    pointerEvents={isFlipped ? 'auto' : 'none'}
                  >
                    <NewsCardBack
                      key={`back-${article.id}`}
                      article={article}
                      cardHeight={cardRenderHeight}
                      onOpenSourceLink={onOpenSourceLink}
                      onFlip={toggleFlip}
                    />
                  </Animated.View>
                </View>
              ) : (
                <NewsCard
                  key={article.id}
                  article={article}
                  cardHeight={cardRenderHeight}
                  onOpenFullRoast={onOpenFullRoast}
                  onOpenSourceLink={onOpenSourceLink}
                  onOpenImageViewer={onOpenImageViewer}
                />
              )}
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
