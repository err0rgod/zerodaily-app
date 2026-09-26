import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { RotateCcw } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  InteractionManager,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { CATEGORIES, getDynamicFallbackImage } from '../../constants/categories';
import { useFeedStore } from '../../store/feedStore';
import { useTheme } from '../../store/themeStore';
import { Article, CategoryKey } from '../../types';
import { NewsCard } from './NewsCard';
import { NewsCardBack } from './NewsCardBack';
import { ScreenGlareLoader } from './ScreenGlareLoader';

/* ------------------------------------------------------------------ *
 * Gesture tuning
 *
 * Deck (vertical): a card change commits past 12% of the card height
 * (capped at 80px) or on a decisive vertical fling.
 *
 * Flip (horizontal): the card must be dragged more than 30% of the
 * screen width to commit — a 10% nudge always snaps back. A fast flick
 * still needs 15% of travel first, so the motion is never fully
 * automated by velocity alone.
 * ------------------------------------------------------------------ */
const AXIS_ACTIVATION_PX = 12;
const AXIS_FAIL_PX = 18;

const SWIPE_COMMIT_RATIO = 0.12;
const SWIPE_MAX_THRESHOLD_PX = 80;
const SWIPE_FLING_VELOCITY = 0.6;

const FLIP_COMMIT_RATIO = 0.3;
const FLIP_FLING_MIN_RATIO = 0.15;
const FLIP_FLING_VELOCITY = 1.0;
/** Drag distance that maps to a full 180° rotation. At the 30% commit
 *  threshold the card is already ~50% flipped, so the settle reads as a
 *  continuation of the gesture rather than a jump. */
const FLIP_FULL_DRAG_RATIO = 0.6;
const FLIP_SPRING = { damping: 20, stiffness: 200, mass: 0.9 } as const;

const DECK_ANIM_MS = 220;
const PULL_REFRESH_TRIGGER_PX = 55;

// Module-scope so they can be invoked from the UI thread via runOnJS.
const hapticLight = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
const hapticMedium = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

/**
 * Animates the deck one card in `direction` and commits the index change when
 * it lands. Module scope with an explicit 'worklet' directive so the gesture
 * callbacks can call it without hopping back to the JS thread mid-gesture.
 */
function slideDeck(
  panY: SharedValue<number>,
  flip: SharedValue<number>,
  isFlippedSV: SharedValue<number>,
  animatingSV: SharedValue<number>,
  indexSV: SharedValue<number>,
  commit: (next: number) => void,
  height: number,
  direction: 1 | -1
) {
  'worklet';
  animatingSV.value = 1;
  flip.value = 0;
  isFlippedSV.value = 0;
  panY.value = withTiming(
    direction > 0 ? -height : height,
    { duration: DECK_ANIM_MS },
    (finished) => {
      if (finished) {
        runOnJS(commit)(indexSV.value + direction);
      } else {
        animatingSV.value = 0;
      }
    }
  );
}

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
  // Granular selectors: the deck must not re-render when the store writes
  // cursor/hasMore/isPrefetching during a background prefetch.
  const articles = useFeedStore((s) => s.articles);
  const category = useFeedStore((s) => s.category);
  const currentIndex = useFeedStore((s) => s.currentIndex);
  const setCurrentIndex = useFeedStore((s) => s.setCurrentIndex);
  const refreshFeed = useFeedStore((s) => s.refreshFeed);
  const isRefreshing = useFeedStore((s) => s.isRefreshing);
  const isLoading = useFeedStore((s) => s.isLoading);

  const { colors, isDark } = useTheme();

  const [windowDim, setWindowDim] = useState(() => Dimensions.get('window'));
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  /* ---------------- shared values (UI thread) ---------------- */
  const panY = useSharedValue(0);
  const flip = useSharedValue(0);
  const spin = useSharedValue(0);
  // Mirrors of React state that gesture worklets must read. Kept in sync
  // synchronously on commit and via effects otherwise.
  const indexSV = useSharedValue(currentIndex);
  const countSV = useSharedValue(articles.length);
  const heightSV = useSharedValue(0);
  const widthSV = useSharedValue(windowDim.width);
  const isFlippedSV = useSharedValue(0);
  const animatingSV = useSharedValue(0);
  /** 1 once onEnd has settled the flip, 0 while a drag is still live. Lets
   *  onFinalize distinguish "gesture finished normally" from "gesture was
   *  cancelled mid-drag" without double-starting a spring. */
  const flipSettledSV = useSharedValue(1);

  /* ---------------- dimensions ---------------- */

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowDim(window);
      // Keep the gesture worklets on the live width so rotation / fold /
      // window resize never leaves stale math behind.
      widthSV.value = window.width;
    });
    return () => sub?.remove();
  }, [widthSV]);

  useEffect(() => {
    widthSV.value = windowDim.width;
  }, [windowDim.width, widthSV]);

  useEffect(() => {
    indexSV.value = currentIndex;
  }, [currentIndex, indexSV]);

  useEffect(() => {
    countSV.value = articles.length;
  }, [articles.length, countSV]);

  const getCardHeight = useCallback((): number => {
    if (containerHeight > 60) return containerHeight;
    return Math.max(windowDim.height - 110, 400);
  }, [containerHeight, windowDim.height]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { height } = e.nativeEvent.layout;
      if (height > 60) {
        setContainerHeight(height);
        heightSV.value = height;
      }
    },
    [heightSV]
  );

  /* ---------------- feed loading ---------------- */

  // Boot loading is owned by App.tsx, which has to coordinate with a tapped
  // notification before deciding whether to load. Loading here too would issue
  // a duplicate request on every cold start.

  // Warm the active category's fallback pool only, deferred until after the
  // first paint and the initial feed request so it never competes with the
  // cold-boot critical path. Prefetching every category up front meant 32
  // requests on launch for images most sessions never reach.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      const active = CATEGORIES[category];
      if (!active) return;
      const pool = active.fallbackImages || [active.fallbackImage];
      pool.forEach((img) => {
        if (img) Image.prefetch(img).catch(() => {});
      });
    });
    return () => task.cancel();
  }, [category]);

  // Prefetch the next few hero images. Also warms the *previous* card so a
  // swipe-back does not have to hit the network.
  useEffect(() => {
    if (articles.length === 0) return;
    const from = Math.max(0, currentIndex - 1);
    const to = Math.min(articles.length, currentIndex + 4);
    for (let i = from; i < to; i++) {
      const article = articles[i];
      if (!article) continue;
      const url =
        article.image_url && article.image_url.trim().length > 0
          ? article.image_url
          : getDynamicFallbackImage(article.id, article.category);
      if (url) Image.prefetch(url).catch(() => {});
    }
  }, [currentIndex, articles]);

  /* ---------------- refresh spinner ---------------- */

  useEffect(() => {
    if (isRefreshing) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(1, { duration: 900 }), -1, false);
    } else {
      spin.value = withTiming(0, { duration: 120 });
    }
  }, [isRefreshing, spin]);

  /* ---------------- commit / reset ---------------- */

  // Called from the UI thread once a deck animation settles. Writes the
  // mirror shared values synchronously so the next gesture starts from a
  // consistent state, then hands the index change to React.
  const commitIndex = useCallback(
    (next: number) => {
      indexSV.value = next;
      panY.value = 0;
      flip.value = 0;
      isFlippedSV.value = 0;
      animatingSV.value = 0;
      setIsFlipped(false);
      setCurrentIndex(next);
    },
    [animatingSV, flip, indexSV, isFlippedSV, panY, setCurrentIndex]
  );

  // Backstop: guarantees the deck is at rest for the newly painted card
  // even if a commit path above was interrupted.
  const isFirstRunRef = useRef(true);
  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    panY.value = 0;
    flip.value = 0;
    isFlippedSV.value = 0;
    animatingSV.value = 0;
  }, [category, currentIndex, panY, flip, isFlippedSV, animatingSV]);

  /* ---------------- flip ---------------- */

  const setFlippedState = useCallback((next: boolean) => {
    setIsFlipped(next);
  }, []);

  const toggleFlip = useCallback(() => {
    if (animatingSV.value === 1) return;
    const from = isFlippedSV.value === 1 ? 1 : 0;
    const target = from === 1 ? 0 : 1;
    animatingSV.value = 1;
    runOnJS(hapticLight)();
    isFlippedSV.value = target;
    flip.value = withSpring(target, FLIP_SPRING, (finished) => {
      if (finished) {
        animatingSV.value = 0;
        runOnJS(setFlippedState)(target === 1);
      }
    });
  }, [animatingSV, flip, isFlippedSV, setFlippedState]);

  /* ---------------- gestures ---------------- */

  const reloadFromTop = useCallback(() => {
    runOnJS(refreshFeed)();
  }, [refreshFeed]);

  // Horizontal: 3D flip. Only claims clearly-horizontal drags so the
  // back-face ScrollView keeps owning vertical scrolling.
  const flipGesture = Gesture.Pan()
    .activeOffsetX([-AXIS_ACTIVATION_PX, AXIS_ACTIVATION_PX])
    .failOffsetY([-AXIS_FAIL_PX, AXIS_FAIL_PX])
    .onBegin(() => {
      'worklet';
      flipSettledSV.value = 0;
    })
    .onUpdate((e) => {
      'worklet';
      if (animatingSV.value === 1) return;
      const w = widthSV.value || 1;
      const progress = Math.min(Math.abs(e.translationX) / (w * FLIP_FULL_DRAG_RATIO), 1);
      const base = isFlippedSV.value === 1 ? 1 : 0;
      flip.value = base === 1 ? Math.max(1 - progress, 0) : progress;
    })
    .onEnd((e) => {
      'worklet';
      flipSettledSV.value = 1;

      if (animatingSV.value === 1) {
        flip.value = withSpring(isFlippedSV.value, FLIP_SPRING);
        return;
      }

      const w = widthSV.value || 1;
      const travelled = Math.abs(e.translationX) / w;
      const committed =
        travelled >= FLIP_COMMIT_RATIO ||
        (travelled >= FLIP_FLING_MIN_RATIO && Math.abs(e.velocityX) >= FLIP_FLING_VELOCITY);

      const from = isFlippedSV.value === 1 ? 1 : 0;
      const target = committed ? (from === 1 ? 0 : 1) : from;

      if (target !== from) runOnJS(hapticMedium)();
      isFlippedSV.value = target;
      animatingSV.value = 1;
      flip.value = withSpring(target, FLIP_SPRING, (finished) => {
        if (finished) {
          animatingSV.value = 0;
          if (target !== from) runOnJS(setFlippedState)(target === 1);
        }
      });
    })
    .onFinalize(() => {
      'worklet';
      // Cancelled mid-drag (lost the race, or the touch was stolen): settle on
      // whichever face the flip state already points at.
      if (flipSettledSV.value === 0) {
        flip.value = withSpring(isFlippedSV.value, FLIP_SPRING);
      }
    });

  // Vertical: deck navigation. Disabled while flipped so the summary
  // ScrollView owns vertical panning without a responder tug-of-war.
  const deckGesture = Gesture.Pan()
    .enabled(!isFlipped)
    .activeOffsetY([-AXIS_ACTIVATION_PX, AXIS_ACTIVATION_PX])
    .failOffsetX([-AXIS_FAIL_PX, AXIS_FAIL_PX])
    .onUpdate((e) => {
      'worklet';
      if (animatingSV.value === 1) return;
      const dy = e.translationY;
      const canUp = indexSV.value < countSV.value - 1;
      const canDown = indexSV.value > 0;

      if (dy < 0 && !canUp) {
        // Last card: damped overscroll instead of a dead stop.
        panY.value = dy * 0.28;
      } else if (dy > 0 && !canDown) {
        // First card: rubber-band into the refresh affordance.
        panY.value = Math.min(dy * 0.55, 110);
      } else {
        panY.value = dy;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (animatingSV.value === 1) return;
      const h = heightSV.value || 1;
      const dy = e.translationY;
      const canUp = indexSV.value < countSV.value - 1;
      const canDown = indexSV.value > 0;

      const threshold = Math.min(h * SWIPE_COMMIT_RATIO, SWIPE_MAX_THRESHOLD_PX);
      const wantsUp = dy < -threshold || e.velocityY < -SWIPE_FLING_VELOCITY;
      const wantsDown = dy > threshold || e.velocityY > SWIPE_FLING_VELOCITY;

      if (wantsUp && canUp) {
        slideDeck(panY, flip, isFlippedSV, animatingSV, indexSV, commitIndex, h, 1);
      } else if (wantsDown && canDown) {
        slideDeck(panY, flip, isFlippedSV, animatingSV, indexSV, commitIndex, h, -1);
      } else if (wantsDown && !canDown) {
        if (dy > PULL_REFRESH_TRIGGER_PX) runOnJS(reloadFromTop)();
        panY.value = withSpring(0, { damping: 18, stiffness: 180 });
      } else {
        panY.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    })
    .onFinalize(() => {
      'worklet';
      if (animatingSV.value === 0 && panY.value !== 0) {
        panY.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    });

  // The two axes race: whichever activates first wins and the other fails,
  // so a diagonal drag can never be half-flip / half-swipe.
  const gesture = Gesture.Race(flipGesture, deckGesture);

  /* ---------------- derived styles ---------------- */

  const pullBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(panY.value, [0, 60], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(panY.value, [0, 100], [-35, 12], Extrapolation.CLAMP) },
    ],
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  /* ---------------- render ---------------- */

  const height = getCardHeight();
  const cardRenderHeight = containerHeight > 60 ? containerHeight : height;

  // Only blank the deck when there is genuinely nothing to show. A
  // pull-to-refresh keeps the current card mounted underneath the spinner.
  if (articles.length === 0) {
    if (isLoading) {
      return <ScreenGlareLoader cardHeight={cardRenderHeight} />;
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

  const currentArticle = articles[currentIndex] || articles[0];
  const nextArticle = currentIndex < articles.length - 1 ? articles[currentIndex + 1] : null;
  const prevArticle = currentIndex > 0 ? articles[currentIndex - 1] : null;
  const isFirstCard = currentIndex === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} onLayout={handleLayout}>
      <GestureDetector gesture={gesture}>
        <View style={styles.deckWrapper}>
          {/* Pull-to-refresh affordance */}
          {isFirstCard && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pullRefreshBadge,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                pullBadgeStyle,
              ]}
            >
              <Animated.View style={spinnerStyle}>
                <RotateCcw size={14} color={colors.primary} />
              </Animated.View>
              <Text style={[styles.pullRefreshText, { color: colors.textPrimary }]}>
                {isRefreshing ? 'Refreshing stories...' : 'Pull down to refresh'}
              </Text>
            </Animated.View>
          )}

          {/* Previous card — revealed by pulling down */}
          {prevArticle && (
            <DeckLayer
              key="deck-prev"
              variant="prev"
              panY={panY}
              heightSV={heightSV}
              isFirstCard={isFirstCard}
              cardHeight={cardRenderHeight}
            >
              <NewsCard
                article={prevArticle}
                cardHeight={cardRenderHeight}
                variant="compact"
                onOpenFullRoast={onOpenFullRoast}
                onOpenSourceLink={onOpenSourceLink}
                onOpenImageViewer={onOpenImageViewer}
              />
            </DeckLayer>
          )}

          {/* Next card — visible underneath so the deck reads as a stack */}
          {nextArticle && (
            <DeckLayer
              key="deck-next"
              variant="next"
              panY={panY}
              heightSV={heightSV}
              isFirstCard={isFirstCard}
              cardHeight={cardRenderHeight}
            >
              <NewsCard
                article={nextArticle}
                cardHeight={cardRenderHeight}
                variant="compact"
                onOpenFullRoast={onOpenFullRoast}
                onOpenSourceLink={onOpenSourceLink}
                onOpenImageViewer={onOpenImageViewer}
              />
            </DeckLayer>
          )}

          {/* Active card — front and back faces of the same story */}
          <DeckLayer
            key="deck-current"
            variant="current"
            panY={panY}
            heightSV={heightSV}
            isFirstCard={isFirstCard}
            cardHeight={cardRenderHeight}
            zIndex={10}
          >
            <FlipFaces
              flip={flip}
              article={currentArticle}
              cardHeight={cardRenderHeight}
              isFlipped={isFlipped}
              isDark={isDark}
              onOpenFullRoast={onOpenFullRoast}
              onOpenSourceLink={onOpenSourceLink}
              onOpenImageViewer={onOpenImageViewer}
              onFlip={toggleFlip}
            />
          </DeckLayer>
        </View>
      </GestureDetector>
    </View>
  );
};

/* ------------------------------------------------------------------ *
 * Deck layer: positions one card in the stack from the shared panY.
 * `variant` fixes the role, which is what makes the stack (rather than a
 * rotating 3-slot window) stable — a layer never changes its render
 * branch, so React keeps the subtree mounted across a swipe.
 * ------------------------------------------------------------------ */

interface DeckLayerProps {
  variant: 'prev' | 'next' | 'current';
  panY: SharedValue<number>;
  heightSV: SharedValue<number>;
  isFirstCard: boolean;
  cardHeight: number;
  zIndex?: number;
  children: React.ReactNode;
}

const DeckLayer: React.FC<DeckLayerProps> = ({
  variant,
  panY,
  heightSV,
  isFirstCard,
  cardHeight,
  zIndex,
  children,
}) => {
  const layerStyle = useAnimatedStyle(() => {
    const h = heightSV.value || 1;

    if (variant === 'current') {
      const dropLimit = isFirstCard ? 90 : h;
      return {
        transform: [
          { translateY: interpolate(panY.value, [-h, 0, h], [-h, 0, dropLimit], Extrapolation.CLAMP) },
        ],
      };
    }

    if (variant === 'next') {
      return {
        transform: [
          { translateY: interpolate(panY.value, [-h, 0], [0, 8], Extrapolation.CLAMP) },
          { scale: interpolate(panY.value, [-h, 0], [1, 0.96], Extrapolation.CLAMP) },
        ],
        opacity: interpolate(panY.value, [-h, 0, h], [1, 0.98, 0], Extrapolation.CLAMP),
      };
    }

    // prev
    return {
      transform: [
        { translateY: interpolate(panY.value, [0, h], [8, 0], Extrapolation.CLAMP) },
        { scale: interpolate(panY.value, [0, h], [0.96, 1], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(panY.value, [-1, 0, h], [0, 0.98, 1], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View
      style={[
        styles.cardLayer,
        { height: cardHeight, zIndex: zIndex ?? (variant === 'prev' ? 5 : 4) },
        layerStyle,
      ]}
      pointerEvents={variant === 'current' ? 'auto' : 'none'}
    >
      {children}
    </Animated.View>
  );
};

/* ------------------------------------------------------------------ *
 * Flip faces
 * ------------------------------------------------------------------ */

interface FlipFacesProps {
  flip: SharedValue<number>;
  article: Article;
  cardHeight: number;
  isFlipped: boolean;
  isDark: boolean;
  onOpenFullRoast: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
  onOpenImageViewer?: (imageUri: string, heading: string, category: CategoryKey) => void;
  onFlip: () => void;
}

const FlipFaces: React.FC<FlipFacesProps> = ({
  flip,
  article,
  cardHeight,
  isFlipped,
  isDark,
  onOpenFullRoast,
  onOpenSourceLink,
  onOpenImageViewer,
  onFlip,
}) => {
  const frontStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.49, 0.5, 1], [1, 1, 0, 0]),
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.5, 0.51, 1], [0, 0, 1, 1]),
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  return (
    <View style={styles.faceStack}>
      <Animated.View
        style={[styles.face, frontStyle]}
        pointerEvents={isFlipped ? 'none' : 'auto'}
      >
        <NewsCard
          article={article}
          cardHeight={cardHeight}
          onOpenFullRoast={onOpenFullRoast}
          onOpenSourceLink={onOpenSourceLink}
          onOpenImageViewer={onOpenImageViewer}
          onFlip={onFlip}
        />
      </Animated.View>

      <Animated.View
        style={[styles.face, backStyle]}
        pointerEvents={isFlipped ? 'auto' : 'none'}
      >
        <NewsCardBack
          article={article}
          cardHeight={cardHeight}
          isDark={isDark}
          onOpenSourceLink={onOpenSourceLink}
          onFlip={onFlip}
        />
      </Animated.View>
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
  faceStack: {
    flex: 1,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
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
