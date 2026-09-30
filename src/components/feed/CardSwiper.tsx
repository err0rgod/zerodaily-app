import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react-native';
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
import { CATEGORIES, CATEGORY_LIST, getDynamicFallbackImage } from '../../constants/categories';
import { useFeedStore } from '../../store/feedStore';
import { useTheme } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';
import { Article, CategoryKey, CategoryMeta } from '../../types';
import { readingTracker } from '../../utils/readingTracker';
import { notificationSessionTracker } from '../../services/notificationService';
import { NewsCard } from './NewsCard';
import { ScreenGlareLoader } from './ScreenGlareLoader';

import { DomainIcon } from '../common/DomainIcon';

interface CardSwiperProps {
  onOpenFullRoast: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
  onOpenImageViewer?: (imageUri: string, heading: string, category: CategoryKey) => void;
  onSelectCategory?: (category: CategoryKey) => void;
}

/** Drag distance at the top card past which releasing triggers a refresh. */
const PULL_REFRESH_TRIGGER_PX = 55;

/** Category visual icon mapping for peek badges and announcement banner */
const DOMAIN_ICONS: Record<CategoryKey, string> = {
  all: '🔥',
  cybersec: '🛡️',
  ai: '🤖',
  programming: '💻',
  robotics: '🦾',
  defense_aerospace: '🚀',
  hardware: '⚡',
  finance: '📈',
};

export const CardSwiper: React.FC<CardSwiperProps> = ({
  onOpenFullRoast,
  onOpenSourceLink,
  onOpenImageViewer,
  onSelectCategory,
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
    setCategory,
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

  // Category ref for gesture handlers to avoid stale closures
  const categoryRef = useRef<CategoryKey>(category);
  categoryRef.current = category;

  // Window dimension ref for gesture handlers
  const windowDimRef = useRef(windowDim);
  windowDimRef.current = windowDim;

  const isAnimatingRef = useRef<boolean>(false);
  const panY = useRef(new Animated.Value(0)).current;
  const panX = useRef(new Animated.Value(0)).current;

  // Active gesture lock: prevents diagonal wobbling or accidental vertical scrolls
  const gestureAxisRef = useRef<'none' | 'vertical' | 'horizontal'>('none');
  const hasFiredThresholdHapticRef = useRef<boolean>(false);

  // Floating domain change announcement toast
  const [domainBanner, setDomainBanner] = useState<CategoryMeta | null>(null);
  const domainBannerOpacity = useRef(new Animated.Value(0)).current;
  const domainBannerTranslateY = useRef(new Animated.Value(-20)).current;
  const domainBannerScale = useRef(new Animated.Value(0.9)).current;
  const domainBannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * The pull-to-refresh badge is mounted only while a drag is genuinely in progress.
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

  // Safe height getter that never returns 0 - uses refs to avoid stale closures
  const getCardHeight = useCallback((): number => {
    if (containerHeightRef.current > 60) {
      return containerHeightRef.current;
    }
    return Math.max(windowDimRef.current.height - 110, 400);
  }, []);

  // Initial feed load if store is empty or has only a solitary notification card and not already loading
  useEffect(() => {
    if (articles.length <= 1 && !isLoading) {
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

  // Reset animation position synchronously before paint whenever index or category changes
  useLayoutEffect(() => {
    panY.stopAnimation();
    panY.setValue(0);
    panX.stopAnimation();
    panX.setValue(0);
    canReleaseRef.current = false;
    setIsPulling(false);
    setCanRelease(false);
  }, [category, currentIndex, panY, panX]);

  // Clean up banner timer on unmount
  useEffect(() => {
    return () => {
      if (domainBannerTimerRef.current) {
        clearTimeout(domainBannerTimerRef.current);
      }
    };
  }, []);

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
      isAnimatingRef.current = false;
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
      isAnimatingRef.current = false;
    });
  }, [getCardHeight, panY, setCurrentIndex, refreshFeed]);

  // Shows temporary floating announcement banner when a domain is switched
  const showDomainChangeBanner = useCallback(
    (cat: CategoryMeta) => {
      if (domainBannerTimerRef.current) {
        clearTimeout(domainBannerTimerRef.current);
      }
      setDomainBanner(cat);
      domainBannerOpacity.setValue(0);
      domainBannerTranslateY.setValue(-20);
      domainBannerScale.setValue(0.9);

      Animated.parallel([
        Animated.timing(domainBannerOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(domainBannerTranslateY, {
          toValue: 0,
          friction: 6,
          tension: 80,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(domainBannerScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      domainBannerTimerRef.current = setTimeout(() => {
        Animated.timing(domainBannerOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }).start(() => {
          setDomainBanner(null);
        });
      }, 1400);
    },
    [domainBannerOpacity, domainBannerTranslateY, domainBannerScale]
  );

  // Executes high-quality domain change animation (slide out + opposite slide-in)
  const performDomainSwitch = useCallback(
    (nextCat: CategoryMeta, direction: 'left' | 'right') => {
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;
      const width = windowDim.width;
      const exitX = direction === 'left' ? -width * 1.15 : width * 1.15;
      const enterFromX = direction === 'left' ? width * 0.35 : -width * 0.35;

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      // 1. Slide active card off screen in the swipe direction
      Animated.timing(panX, {
        toValue: exitX,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }).start(async () => {
        // 2. Announce new domain with floating badge
        showDomainChangeBanner(nextCat);

        // 3. Switch active category
        if (onSelectCategory) {
          onSelectCategory(nextCat.key);
        } else {
          await setCategory(nextCat.key);
        }

        // 4. Position incoming card on opposite side and spring in
        panX.setValue(enterFromX);
        panY.setValue(0);

        Animated.spring(panX, {
          toValue: 0,
          friction: 8,
          tension: 55,
          useNativeDriver: Platform.OS !== 'web',
        }).start(() => {
          isAnimatingRef.current = false;
        });
      });
    },
    [windowDim.width, panX, panY, onSelectCategory, setCategory, showDomainChangeBanner]
  );

  const goToNextDomain = useCallback(() => {
    if (isAnimatingRef.current) return;
    const catIndex = CATEGORY_LIST.findIndex((c) => c.key === category);
    if (catIndex < CATEGORY_LIST.length - 1) {
      performDomainSwitch(CATEGORY_LIST[catIndex + 1], 'left');
    }
  }, [category, performDomainSwitch]);

  const goToPrevDomain = useCallback(() => {
    if (isAnimatingRef.current) return;
    const catIndex = CATEGORY_LIST.findIndex((c) => c.key === category);
    if (catIndex > 0) {
      performDomainSwitch(CATEGORY_LIST[catIndex - 1], 'right');
    }
  }, [category, performDomainSwitch]);

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
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextDomain();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevDomain();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToNextCard, goToPrevCard, goToNextDomain, goToPrevDomain]);

  // Dual-Axis PanResponder: Vertical = Article Navigation, Horizontal = Domain Switch
  // Uses refs for dynamic values to avoid stale closures
  // CRITICAL: Don't claim on start - let TouchableOpacity handle taps. Capture on move for swipes.
  const panResponder = useRef(
    PanResponder.create({
      // Don't claim on start - allow TouchableOpacity to handle taps
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // Claim responder on move - this captures the gesture from TouchableOpacity
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (isAnimatingRef.current) return false;
        const dx = Math.abs(gesture.dx);
        const dy = Math.abs(gesture.dy);
        // Higher thresholds to prevent accidental triggers from taps
        if (dx < 12 && dy < 12) return false;
        const isVertical = dy > dx * 0.75 && dy > 14;
        const isHorizontal = dx > dy * 0.75 && dx > 14;
        return isVertical || isHorizontal;
      },
      // CRITICAL: Use capture phase to steal responder from TouchableOpacity when swiping
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (isAnimatingRef.current) return false;
        const dx = Math.abs(gesture.dx);
        const dy = Math.abs(gesture.dy);
        if (dx < 12 && dy < 12) return false;
        const isVertical = dy > dx * 0.75 && dy > 14;
        const isHorizontal = dx > dy * 0.75 && dx > 14;
        return isVertical || isHorizontal;
      },

      onPanResponderGrant: () => {
        panY.stopAnimation();
        panX.stopAnimation();
        isAnimatingRef.current = false;
        gestureAxisRef.current = 'none';
        hasFiredThresholdHapticRef.current = false;
        setIsPulling(false);
      },

      onPanResponderMove: (_, gesture) => {
        if (isAnimatingRef.current) return;

        // Lock in gesture axis once direction is unambiguous
        if (gestureAxisRef.current === 'none') {
          const dx = Math.abs(gesture.dx);
          const dy = Math.abs(gesture.dy);
          // Higher thresholds to distinguish from taps
          if (dx > dy && dx > 10) {
            gestureAxisRef.current = 'horizontal';
          } else if (dy > dx && dy > 10) {
            gestureAxisRef.current = 'vertical';
            setIsPulling(true);
          }
        }

        if (gestureAxisRef.current === 'vertical') {
          setReleaseReady(gesture.dy > PULL_REFRESH_TRIGGER_PX);
          panY.setValue(gesture.dy);
        } else if (gestureAxisRef.current === 'horizontal') {
          // Use refs to get current values, not stale closures
          const currentCategory = categoryRef.current;
          const catIndex = CATEGORY_LIST.findIndex((c) => c.key === currentCategory);
          const atFirst = catIndex === 0;
          const atLast = catIndex === CATEGORY_LIST.length - 1;

          // Boundary rubber-band resistance at list edges
          let moveX = gesture.dx;
          if ((atFirst && moveX > 0) || (atLast && moveX < 0)) {
            moveX = moveX * 0.22;
          }
          panX.setValue(moveX);

          // Threshold tactile pulse when crossing the commitment line
          const width = windowDimRef.current.width;
          const threshold = Math.min(width * 0.22, 90);
          const reached =
            Math.abs(moveX) >= threshold && !((atFirst && moveX > 0) || (atLast && moveX < 0));

          if (reached && !hasFiredThresholdHapticRef.current) {
            hasFiredThresholdHapticRef.current = true;
            if (Platform.OS !== 'web') {
              Haptics.selectionAsync().catch(() => {});
            }
          } else if (!reached && hasFiredThresholdHapticRef.current) {
            hasFiredThresholdHapticRef.current = false;
          }
        }
      },

      onPanResponderRelease: (_, gesture) => {
        const axis = gestureAxisRef.current;
        gestureAxisRef.current = 'none';
        hasFiredThresholdHapticRef.current = false;
        setIsPulling(false);
        setReleaseReady(false);

        if (isAnimatingRef.current) return;

        if (axis === 'horizontal') {
          // Use refs to get current values, not stale closures
          const width = windowDimRef.current.width;
          const threshold = Math.min(width * 0.22, 90);
          const currentCategory = categoryRef.current;
          const catIndex = CATEGORY_LIST.findIndex((c) => c.key === currentCategory);

          const isLeftSwipe = gesture.dx < -threshold || gesture.vx < -0.3;
          const isRightSwipe = gesture.dx > threshold || gesture.vx > 0.3;

          const canGoNext = isLeftSwipe && catIndex < CATEGORY_LIST.length - 1;
          const canGoPrev = isRightSwipe && catIndex > 0;

          if (canGoNext) {
            performDomainSwitch(CATEGORY_LIST[catIndex + 1], 'left');
          } else if (canGoPrev) {
            performDomainSwitch(CATEGORY_LIST[catIndex - 1], 'right');
          } else {
            isAnimatingRef.current = true;
            Animated.spring(panX, {
              toValue: 0,
              friction: 7,
              tension: 50,
              useNativeDriver: Platform.OS !== 'web',
            }).start(() => {
              isAnimatingRef.current = false;
            });
          }
        } else if (axis === 'vertical') {
          const height = getCardHeight();
          const threshold = Math.min(height * 0.12, 80);
          const isUpSwipe = gesture.dy < -threshold || gesture.vy < -0.25;
          const isDownSwipe = gesture.dy > threshold || gesture.vy > 0.25;

          const curr = currentIndexRef.current;
          const total = articlesRef.current.length;

          if (isUpSwipe && curr < total - 1) {
            isAnimatingRef.current = true;
            Animated.timing(panY, {
              toValue: -height,
              duration: 220,
              easing: Easing.out(Easing.quad),
              useNativeDriver: Platform.OS !== 'web',
            }).start(() => {
              setCurrentIndex(curr + 1);
              isAnimatingRef.current = false;
            });
          } else if (isDownSwipe && curr > 0) {
            isAnimatingRef.current = true;
            Animated.timing(panY, {
              toValue: height,
              duration: 220,
              easing: Easing.out(Easing.quad),
              useNativeDriver: Platform.OS !== 'web',
            }).start(() => {
              setCurrentIndex(curr - 1);
              isAnimatingRef.current = false;
            });
          } else {
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
        } else {
          Animated.parallel([
            Animated.spring(panY, {
              toValue: 0,
              friction: 7,
              tension: 50,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.spring(panX, {
              toValue: 0,
              friction: 7,
              tension: 50,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]).start();
        }
      },

      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        isAnimatingRef.current = false;
        gestureAxisRef.current = 'none';
        hasFiredThresholdHapticRef.current = false;
        setIsPulling(false);
        setReleaseReady(false);
        Animated.parallel([
          Animated.spring(panY, {
            toValue: 0,
            friction: 7,
            tension: 50,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.spring(panX, {
            toValue: 0,
            friction: 7,
            tension: 50,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
      },
    })
  ).current;

  // The deck stays mounted while a refresh is in flight.
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

  // Deck Layer Vertical Transformations:
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

  // 3. Active Card Vertical Translation
  const activeCardTranslateY = panY.interpolate({
    inputRange: [-height, 0, height],
    outputRange: [-height, 0, currentIndex === 0 ? 90 : height],
    extrapolate: 'clamp',
  });

  // 4. Active Card Horizontal Translation, Tilt & Scale for Domain Change
  const cardRotation = panX.interpolate({
    inputRange: [-windowDim.width, 0, windowDim.width],
    outputRange: ['-6deg', '0deg', '6deg'],
    extrapolate: 'clamp',
  });

  const cardScale = panX.interpolate({
    inputRange: [-windowDim.width, 0, windowDim.width],
    outputRange: [0.93, 1, 0.93],
    extrapolate: 'clamp',
  });

  const activeCardOpacity = panX.interpolate({
    inputRange: [
      -windowDim.width,
      -windowDim.width * 0.45,
      0,
      windowDim.width * 0.45,
      windowDim.width,
    ],
    outputRange: [0.35, 0.88, 1, 0.88, 0.35],
    extrapolate: 'clamp',
  });

  // Domain peek resolution
  const catIndex = CATEGORY_LIST.findIndex((c) => c.key === category);
  const nextCat = catIndex < CATEGORY_LIST.length - 1 ? CATEGORY_LIST[catIndex + 1] : null;
  const prevCat = catIndex > 0 ? CATEGORY_LIST[catIndex - 1] : null;

  // Next category peek badge (when dragging left, panX < 0)
  const nextPeekOpacity = panX.interpolate({
    inputRange: [-85, -20, 0],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });
  const nextPeekTranslateX = panX.interpolate({
    inputRange: [-100, 0],
    outputRange: [0, 24],
    extrapolate: 'clamp',
  });
  const nextPeekScale = panX.interpolate({
    inputRange: [-100, -25, 0],
    outputRange: [1, 0.85, 0.7],
    extrapolate: 'clamp',
  });

  // Previous category peek badge (when dragging right, panX > 0)
  const prevPeekOpacity = panX.interpolate({
    inputRange: [0, 20, 85],
    outputRange: [0, 0.3, 1],
    extrapolate: 'clamp',
  });
  const prevPeekTranslateX = panX.interpolate({
    inputRange: [0, 100],
    outputRange: [-24, 0],
    extrapolate: 'clamp',
  });
  const prevPeekScale = panX.interpolate({
    inputRange: [0, 25, 100],
    outputRange: [0.7, 0.85, 1],
    extrapolate: 'clamp',
  });

  // Edge boundary resistance peek
  const edgeAtStartOpacity = panX.interpolate({
    inputRange: [0, 15, 60],
    outputRange: [0, 0.25, 0.85],
    extrapolate: 'clamp',
  });
  const edgeAtEndOpacity = panX.interpolate({
    inputRange: [-60, -15, 0],
    outputRange: [0.85, 0.25, 0],
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
        {isAllCaughtUp && !isRefreshing && !isPulling && (
          <View
            style={[
              styles.caughtUpBadge,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Check size={12} color={colors.primary} />
            <Text style={[styles.caughtUpText, { color: colors.textSecondary }]}>
              You're all caught up! Showing recent stories
            </Text>
          </View>
        )}

        {/* Floating Domain Switch Announcement Toast */}
        {domainBanner && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.floatingDomainBanner,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
                borderColor: domainBanner.accentColor,
                opacity: domainBannerOpacity,
                transform: [
                  { translateY: domainBannerTranslateY },
                  { scale: domainBannerScale },
                ],
              },
            ]}
          >
            <DomainIcon category={domainBanner.key} size={16} color={domainBanner.accentColor} />
            <Text style={[styles.bannerDomainTitle, { color: colors.textPrimary }]}>
              {domainBanner.name}
            </Text>
          </Animated.View>
        )}

        {/* Next Domain Peek Indicator (appears on right edge when sliding left) */}
        {nextCat && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.domainPeekBadge,
              styles.domainPeekRight,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: nextCat.accentColor,
                opacity: nextPeekOpacity,
                transform: [
                  { translateX: nextPeekTranslateX },
                  { scale: nextPeekScale },
                ],
              },
            ]}
          >
            <DomainIcon category={nextCat.key} size={15} color={nextCat.accentColor} />
            <Text style={[styles.peekCategoryName, { color: colors.textPrimary }]}>
              {nextCat.name}
            </Text>
            <ChevronRight size={15} color={nextCat.accentColor} strokeWidth={2.5} />
          </Animated.View>
        )}

        {/* Previous Domain Peek Indicator (appears on left edge when sliding right) */}
        {prevCat && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.domainPeekBadge,
              styles.domainPeekLeft,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: prevCat.accentColor,
                opacity: prevPeekOpacity,
                transform: [
                  { translateX: prevPeekTranslateX },
                  { scale: prevPeekScale },
                ],
              },
            ]}
          >
            <ChevronLeft size={15} color={prevCat.accentColor} strokeWidth={2.5} />
            <DomainIcon category={prevCat.key} size={15} color={prevCat.accentColor} />
            <Text style={[styles.peekCategoryName, { color: colors.textPrimary }]}>
              {prevCat.name}
            </Text>
          </Animated.View>
        )}

        {/* At Start Edge Indicator */}
        {catIndex === 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.domainPeekBadge,
              styles.domainPeekLeft,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.92)',
                borderColor: colors.border,
                opacity: edgeAtStartOpacity,
              },
            ]}
          >
            <DomainIcon category="all" size={14} color={colors.textMuted} />
            <Text style={[styles.peekCategoryName, { color: colors.textMuted }]}>
              First Topic
            </Text>
          </Animated.View>
        )}

        {/* At End Edge Indicator */}
        {catIndex === CATEGORY_LIST.length - 1 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.domainPeekBadge,
              styles.domainPeekRight,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.92)',
                borderColor: colors.border,
                opacity: edgeAtEndOpacity,
              },
            ]}
          >
            <Text style={[styles.peekCategoryName, { color: colors.textMuted }]}>
              Last Topic
            </Text>
            <DomainIcon category="finance" size={14} color={colors.textMuted} />
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
            ? [
                { translateY: activeCardTranslateY },
                { translateX: panX },
                { rotate: cardRotation },
                { scale: cardScale },
              ]
            : isNext
            ? [{ translateY: nextCardTranslateY }, { scale: nextCardScale }]
            : [{ translateY: prevCardTranslateY }, { scale: prevCardScale }];

          const layerOpacity = isCurrent
            ? activeCardOpacity
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
  domainPeekBadge: {
    position: 'absolute',
    top: '46%',
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    borderWidth: 1.5,
    gap: 7,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
    elevation: 5,
  },
  domainPeekRight: {
    right: 14,
  },
  domainPeekLeft: {
    left: 14,
  },
  peekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  peekCategoryName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  peekEmoji: {
    fontSize: 15,
  },
  floatingDomainBanner: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    gap: 8,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 7,
  },
  bannerEmoji: {
    fontSize: 16,
  },
  bannerDomainTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
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
