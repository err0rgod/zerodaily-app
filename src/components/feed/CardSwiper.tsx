import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { CATEGORIES } from '../../constants/categories';
import { THEME } from '../../constants/theme';
import { useFeedStore } from '../../store/feedStore';
import { Article } from '../../types';
import { NewsCard } from './NewsCard';

interface CardSwiperProps {
  onOpenFullRoast: (article: Article) => void;
  onOpenSourceLink: (url: string) => void;
}

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

  const [containerHeight, setContainerHeight] = useState<number>(0);
  const flatListRef = useRef<FlatList<Article>>(null);

  // Initial feed load on mount
  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  // Warm-up disk & memory image cache for all category fallback images on mount
  useEffect(() => {
    Object.values(CATEGORIES).forEach((cat) => {
      if (cat.fallbackImage) {
        Image.prefetch(cat.fallbackImage).catch(() => {});
      }
    });
  }, []);

  // Image prefetching for upcoming 3 cards (with category fallback support)
  useEffect(() => {
    if (articles.length > 0) {
      const nextBatch = articles.slice(currentIndex + 1, currentIndex + 4);
      nextBatch.forEach((article) => {
        const url =
          (article.image_url && article.image_url.trim().length > 0)
            ? article.image_url
            : CATEGORIES[article.category]?.fallbackImage;
        if (url) {
          Image.prefetch(url).catch(() => {});
        }
      });
    }
  }, [currentIndex, articles]);

  // Reset scroll to top whenever category changes
  useEffect(() => {
    if (flatListRef.current && articles.length > 0) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [category]);

  // Capture container height dynamically for perfect 1-card-per-screen layout
  const handleLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0 && height !== containerHeight) {
      setContainerHeight(height);
    }
  };

  // Track active visible card and trigger prefetching via Zustand
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const index = viewableItems[0].index;
        setCurrentIndex(index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const renderItem = useCallback(
    ({ item }: { item: Article }) => (
      <NewsCard
        article={item}
        cardHeight={containerHeight}
        onOpenFullRoast={onOpenFullRoast}
        onOpenSourceLink={onOpenSourceLink}
      />
    ),
    [containerHeight, onOpenFullRoast, onOpenSourceLink]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: containerHeight,
      offset: containerHeight * index,
      index,
    }),
    [containerHeight]
  );

  const keyExtractor = useCallback((item: Article) => item.id, []);

  if (articles.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Stories Available</Text>
        <Text style={styles.emptySub}>Pull down to check for breaking tech feeds.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {containerHeight > 0 && (
        <FlatList
          ref={flatListRef}
          data={articles}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          pagingEnabled={Platform.OS === 'ios'}
          snapToInterval={containerHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum={true}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refreshFeed}
              tintColor={THEME.colors.primary}
              colors={[THEME.colors.primary]}
            />
          }
          windowSize={5}
          maxToRenderPerBatch={3}
          initialNumToRender={2}
          removeClippedSubviews
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.background,
    padding: THEME.spacing.lg,
  },
  emptyTitle: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
});
