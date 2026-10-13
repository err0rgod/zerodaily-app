import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Check, RotateCcw } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  SharedValue,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { CATEGORIES, getDynamicFallbackImage } from '../../constants/categories';
import { useFeedStore } from '../../store/feedStore';
import { useTheme } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';
import { Article, CategoryKey } from '../../types';
import { readingTracker } from '../../utils/readingTracker';
import { notificationSessionTracker } from '../../services/notificationService';
import { NewsCard } from './NewsCard';
import { ScreenGlareLoader } from './ScreenGlareLoader';

interface CardSwiperProps {
  onOpenFullRoast: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
  onOpenImageViewer?: (imageUri: string, heading: string, category: CategoryKey) => void;
  /** Kept for API compatibility; topics are switched from the category pills. */
  onSelectCategory?: (category: CategoryKey) => void;
}

/** Drag distance at the top card past which releasing triggers a refresh. */
const PULL_REFRESH_TRIGGER_PX = 55;
/** How far the first card can be pulled down. */
const MAX_PULL_PX = 90;
/** Fling speeds (px/s) that complete a swipe even below the distance threshold. */
const VERTICAL_FLING_VELOCITY = 300;
/** Cards kept mounted around the current one (previous card + two upcoming). */
const CARDS_BEHIND = 1;
const CARDS_AHEAD = 2;

const SWIPE_TIMING = { duration: 220, easing: Easing.out(Easing.quad) };
const SETTLE_SPRING = { damping: 18, stiffness: 180 };

/**
 * Vertical card deck driven entirely on the UI thread (Reanimated + Gesture Handler).
 * Topics are switched with the category pills (horizontal swiping is disabled).
 *
 * `position` is a continuous card index: swiping up animates it from n to n+1. Each mounted card
 * derives its transform from `index - position`, so committing the new index to the store after
 * the animation moves nothing on screen. That removes the frame where a recycled card used to
 * render at its old offset (the flicker), and gestures never wait on the JS thread (the lag).
 */
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
    isAllCaughtUp,
  } = useFeedStore();

  const { colors, isDark } = useTheme();

  const [windowDim, setWindowDim] = useState(() => Dimensions.get('window'));
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const cardHeight = containerHeight > 60 ? containerHeight : Math.max(windowDim.height - 110, 400);

  // ---- UI-thread state ---------------------------------------------------------------------
  const position = useSharedValue(currentIndex); // continuous card index
  const indexSV = useSharedValue(currentIndex); // committed index, as seen by the gesture
  const totalSV = useSharedValue(articles.length);
  const heightSV = useSharedValue(cardHeight);
  const pull = useSharedValue(0); // pull-to-refresh offset of the first card
  const animating = useSharedValue(false);

  useEffect(() => {
    totalSV.value = articles.length;
  }, [articles.length, totalSV]);
  useEffect(() => {
    heightSV.value = cardHeight;
  }, [cardHeight, heightSV]);

  // Index changes we committed from a swipe are already on screen; anything else (category
  // switch, refresh, Home tab, notification) jumps the deck to the new index.
  const committedIndexRef = useRef<number>(currentIndex);
  useEffect(() => {
    if (currentIndex === committedIndexRef.current) return;
    committedIndexRef.current = currentIndex;
    cancelAnimation(position);
    position.value = currentIndex;
    indexSV.value = currentIndex;
    animating.value = false;
  }, [currentIndex, position, indexSV, animating]);

  const commitIndex = useCallback(
    (index: number) => {
      committedIndexRef.current = index;
      setCurrentIndex(index);
    },
    [setCurrentIndex]
  );

  // Window dimension listener for screen rotations / resizes
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowDim(window);
    });
    return () => sub?.remove();
  }, []);

  // Initial feed load if store is empty or has only a solitary notification card and not already loading
  // (once per category, so an offline failure doesn't retry in a tight loop)
  const autoLoadedCategoryRef = useRef<CategoryKey | null>(null);
  useEffect(() => {
    if (articles.length <= 1 && !isLoading && autoLoadedCategoryRef.current !== category) {
      autoLoadedCategoryRef.current = category;
      loadInitialFeed();
    }
  }, [articles.length, isLoading, category, loadInitialFeed]);

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

    // Only process dwell/skip transition when actually switching cards
    if (prevArticle && prevArticle.id !== currentArticle?.id) {
      notificationSessionTracker.recordSwipe();
      const elapsedSeconds = (Date.now() - cardStartTimeRef.current) / 1000;

      const isAlreadyRead = readingTracker.isArticleRead(prevArticle.id);

      if (elapsedSeconds >= 2.0) {
        readingTracker.markArticleAsRead(
          prevArticle.id,
          prevArticle.category,
          Math.min(elapsedSeconds, 120)
        );
        useUserStore.getState().trackEvent(
          prevArticle.id,
          prevArticle.category,
          'read',
          Math.min(elapsedSeconds, 120)
        );
      } else if (elapsedSeconds >= 0.5 && !isAlreadyRead) {
        readingTracker.markArticleAsSkipped(
          prevArticle.id,
          prevArticle.category,
          elapsedSeconds
        );
        useUserStore.getState().trackEvent(
          prevArticle.id,
          prevArticle.category,
          'skip',
          elapsedSeconds
        );
      }

      cardStartTimeRef.current = Date.now();
      prevArticleRef.current = currentArticle || null;
    } else if (!prevArticle && currentArticle) {
      cardStartTimeRef.current = Date.now();
      prevArticleRef.current = currentArticle;
    }
  }, [currentIndex, category, articles]);

  // Flush reading/skip telemetry for the last active card on unmount
  useEffect(() => {
    return () => {
      const active = prevArticleRef.current;
      if (active) {
        const elapsed = (Date.now() - cardStartTimeRef.current) / 1000;
        const isAlreadyRead = readingTracker.isArticleRead(active.id);
        if (elapsed >= 2.0) {
          readingTracker.markArticleAsRead(active.id, active.category, Math.min(elapsed, 120));
          useUserStore.getState().trackEvent(active.id, active.category, 'read', Math.min(elapsed, 120));
        } else if (elapsed >= 0.5 && !isAlreadyRead) {
          readingTracker.markArticleAsSkipped(active.id, active.category, elapsed);
          useUserStore.getState().trackEvent(active.id, active.category, 'skip', elapsed);
        }
      }
    };
  }, []);

  // Capture container height dynamically
  const handleLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 60 && height !== containerHeight) {
      setContainerHeight(height);
    }
  };

  // ---- JS-side helpers called from the gesture worklets -----------------------------------
  const pullRefresh = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    refreshFeed();
  }, [refreshFeed]);

  // ---- Gesture -----------------------------------------------------------------------------
  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Vertical only: let taps through to the card's buttons and ignore sideways drags.
        .activeOffsetY([-12, 12])
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          'worklet';
          if (animating.value) return;

          const base = indexSV.value;
          if (base === 0 && e.translationY > 0) {
            // Pull-to-refresh on the first card.
            position.value = 0;
            pull.value = Math.min(e.translationY * 0.6, MAX_PULL_PX);
            return;
          }
          pull.value = 0;
          const last = Math.max(totalSV.value - 1, 0);
          let p = base - e.translationY / heightSV.value;
          p = Math.min(Math.max(p, base - 1), base + 1);
          if (p > last) p = last + (p - last) * 0.2; // rubber-band past the last card
          position.value = Math.max(p, 0);
        })
        .onEnd((e) => {
          'worklet';
          if (animating.value) return;

          const base = indexSV.value;
          const last = totalSV.value - 1;
          const threshold = Math.min(heightSV.value * 0.12, 80);
          const isUp = e.translationY < -threshold || e.velocityY < -VERTICAL_FLING_VELOCITY;
          const isDown = e.translationY > threshold || e.velocityY > VERTICAL_FLING_VELOCITY;

          if (isUp && base < last) {
            animating.value = true;
            position.value = withTiming(base + 1, SWIPE_TIMING, (finished) => {
              if (finished) {
                indexSV.value = base + 1;
                scheduleOnRN(commitIndex, base + 1);
              }
              animating.value = false;
            });
          } else if (isDown && base > 0) {
            animating.value = true;
            position.value = withTiming(base - 1, SWIPE_TIMING, (finished) => {
              if (finished) {
                indexSV.value = base - 1;
                scheduleOnRN(commitIndex, base - 1);
              }
              animating.value = false;
            });
          } else {
            if (base === 0 && pull.value >= PULL_REFRESH_TRIGGER_PX) {
              scheduleOnRN(pullRefresh);
            }
            position.value = withSpring(base, SETTLE_SPRING);
            pull.value = withSpring(0, SETTLE_SPRING);
          }
        })
        .onFinalize(() => {
          'worklet';
          // A cancelled touch (e.g. a modal opened) must not leave the deck half-dragged.
          if (!animating.value) {
            if (position.value !== indexSV.value) position.value = withSpring(indexSV.value, SETTLE_SPRING);
            if (pull.value !== 0) pull.value = withSpring(0, SETTLE_SPRING);
          }
        }),
    [animating, indexSV, position, pull, totalSV, heightSV, commitIndex, pullRefresh]
  );

  // ---- Web desktop mouse wheel and arrow key shortcuts --------------------------------------
  const animateToCard = useCallback(
    (target: number) => {
      if (animating.value) return;
      animating.value = true;
      position.value = withTiming(target, SWIPE_TIMING, (finished) => {
        if (finished) {
          indexSV.value = target;
          scheduleOnRN(commitIndex, target);
        }
        animating.value = false;
      });
    },
    [animating, position, indexSV, commitIndex]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const goNext = () => {
      if (indexSV.value < totalSV.value - 1) animateToCard(indexSV.value + 1);
    };
    const goPrev = () => {
      if (indexSV.value === 0) refreshFeed();
      else animateToCard(indexSV.value - 1);
    };

    let lastWheelTime = 0;
    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelTime < 400) return;
      if (e.deltaY > 20) {
        goNext();
        lastWheelTime = now;
      } else if (e.deltaY < -20) {
        goPrev();
        lastWheelTime = now;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [animateToCard, refreshFeed, indexSV, totalSV]);

  // ---- Overlay animations --------------------------------------------------------------------
  const pullBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [0, 60], [0, 1], Extrapolation.CLAMP),
    borderColor: interpolateColor(
      pull.value,
      [PULL_REFRESH_TRIGGER_PX - 1, PULL_REFRESH_TRIGGER_PX],
      [colors.border, colors.primary]
    ),
    transform: [{ translateY: interpolate(pull.value, [0, 100], [-35, 12], Extrapolation.CLAMP) }],
  }));
  const pullHintStyle = useAnimatedStyle(() => ({
    opacity: pull.value >= PULL_REFRESH_TRIGGER_PX ? 0 : 1,
  }));
  const releaseHintStyle = useAnimatedStyle(() => ({
    opacity: pull.value >= PULL_REFRESH_TRIGGER_PX ? 1 : 0,
  }));
  const caughtUpStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [0, 20], [1, 0], Extrapolation.CLAMP),
  }));

  // The deck stays mounted while a refresh is in flight.
  if (articles.length === 0) {
    if (isLoading) {
      return <ScreenGlareLoader cardHeight={cardHeight} />;
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

  const firstMounted = Math.max(0, currentIndex - CARDS_BEHIND);
  const lastMounted = Math.min(articles.length - 1, currentIndex + CARDS_AHEAD);
  const mountedCards: { article: Article; index: number }[] = [];
  for (let i = firstMounted; i <= lastMounted; i++) {
    mountedCards.push({ article: articles[i], index: i });
  }

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        onLayout={handleLayout}
        collapsable={false}
      >
        <View style={styles.deckWrapper}>
          {/* Pull affordance on the first card */}
          {currentIndex === 0 && !isRefreshing && (
            <Animated.View
              pointerEvents="none"
              style={[styles.pullRefreshBadge, { backgroundColor: colors.surface }, pullBadgeStyle]}
            >
              <RotateCcw size={14} color={colors.primary} />
              <View>
                <Animated.Text style={[styles.pullRefreshText, { color: colors.textPrimary }, pullHintStyle]}>
                  Pull down to refresh
                </Animated.Text>
                <Animated.Text
                  style={[styles.pullRefreshText, styles.pullHintOverlay, { color: colors.textPrimary }, releaseHintStyle]}
                >
                  Release to refresh
                </Animated.Text>
              </View>
            </Animated.View>
          )}

          {/* Refresh-in-flight pill */}
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

          {/* All caught up banner */}
          {isAllCaughtUp && !isRefreshing && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.caughtUpBadge,
                { backgroundColor: colors.surface, borderColor: colors.border },
                caughtUpStyle,
              ]}
            >
              <Check size={12} color={colors.primary} />
              <Text style={[styles.caughtUpText, { color: colors.textSecondary }]}>
                You're all caught up! Showing recent stories
              </Text>
            </Animated.View>
          )}

          {/* Card deck: each card keeps its React instance (keyed by article) while it is within
              the mounted window, so images never reload or blink between swipes. */}
          {mountedCards.map(({ article, index }) => (
            <DeckCard
              key={article.id}
              article={article}
              index={index}
              isCurrent={index === currentIndex}
              cardHeight={cardHeight}
              veilColor={isDark ? '#000000' : '#475569'}
              position={position}
              pull={pull}
              heightSV={heightSV}
              onOpenFullRoast={onOpenFullRoast}
              onOpenSourceLink={onOpenSourceLink}
              onOpenImageViewer={onOpenImageViewer}
            />
          ))}
        </View>
      </View>
    </GestureDetector>
  );
};

interface DeckCardProps {
  article: Article;
  index: number;
  isCurrent: boolean;
  cardHeight: number;
  veilColor: string;
  position: SharedValue<number>;
  pull: SharedValue<number>;
  heightSV: SharedValue<number>;
  onOpenFullRoast: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
  onOpenImageViewer?: (imageUri: string, heading: string, category: CategoryKey) => void;
}

/**
 * One card of the deck. Its look depends only on `index - position`:
 *   <= 0  on top, sliding up off-screen as the next card is revealed (and back down on return)
 *   0..1  underneath, scaled down slightly and dimmed, growing in as the top card leaves
 *   1..2  further down, fading in so it is ready before it becomes the next card
 */
const DeckCard: React.FC<DeckCardProps> = React.memo(
  ({
    article,
    index,
    isCurrent,
    cardHeight,
    veilColor,
    position,
    pull,
    heightSV,
    onOpenFullRoast,
    onOpenSourceLink,
    onOpenImageViewer,
  }) => {
    const cardStyle = useAnimatedStyle(() => {
      const d = index - position.value;
      const height = heightSV.value;

      let translateY: number;
      let scale = 1;
      let opacity = 1;
      if (d <= 0) {
        translateY = d * height;
        opacity = d <= -1 ? 0 : 1;
      } else {
        const t = Math.min(d, 1);
        translateY = 14 * t;
        scale = 1 - 0.06 * t;
        opacity = interpolate(d, [1, 2], [1, 0], Extrapolation.CLAMP);
      }
      if (index === 0) translateY += pull.value;

      return {
        opacity,
        transform: [{ translateY }, { scale }],
      };
    });

    const veilStyle = useAnimatedStyle(() => {
      const d = index - position.value;
      return { opacity: d > 0 ? 0.2 * Math.min(d, 1) : 0 };
    });

    return (
      <Animated.View
        style={[styles.cardLayer, { height: cardHeight, zIndex: 1000 - index }, cardStyle]}
        pointerEvents={isCurrent ? 'auto' : 'none'}
      >
        <NewsCard
          article={article}
          cardHeight={cardHeight}
          onOpenFullRoast={onOpenFullRoast}
          onOpenSourceLink={onOpenSourceLink}
          onOpenImageViewer={onOpenImageViewer}
        />
        <Animated.View pointerEvents="none" style={[styles.depthVeil, { backgroundColor: veilColor }, veilStyle]} />
      </Animated.View>
    );
  }
);

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
  pullHintOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  refreshingBadge: {
    transform: [{ translateY: 12 }],
  },
  caughtUpBadge: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    zIndex: 90,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 6,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  caughtUpText: {
    fontSize: 11,
    fontWeight: '600',
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
