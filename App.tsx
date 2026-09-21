import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomNav, BottomNavTab } from './src/components/common/BottomNav';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { CardSwiper } from './src/components/feed/CardSwiper';
import { CategoryPills } from './src/components/feed/CategoryPills';
import { BookmarksModal } from './src/components/modals/BookmarksModal';
import { CategoryOnboardingModal } from './src/components/modals/CategoryOnboardingModal';
import { FullRoastModal } from './src/components/modals/FullRoastModal';
import { ImageViewerModal } from './src/components/modals/ImageViewerModal';
import { SettingsModal } from './src/components/modals/SettingsModal';
import { openArticleSource } from './src/components/webview/ArticleReader';
import { useNotifications } from './src/hooks/useNotifications';
import { useBookmarkStore } from './src/store/bookmarkStore';
import { useFeedStore } from './src/store/feedStore';
import { useTheme, useThemeStore } from './src/store/themeStore';
import { Article, CategoryKey } from './src/types';

export default function App() {
  // Active theme
  const { colors, isDark } = useTheme();
  const initTheme = useThemeStore((s) => s.initTheme);

  // Store access with granular selectors (eliminates root re-renders on swipe or article fetch)
  const category = useFeedStore((s) => s.category);
  const setCategory = useFeedStore((s) => s.setCategory);
  const setCurrentIndex = useFeedStore((s) => s.setCurrentIndex);
  const setArticleDirectly = useFeedStore((s) => s.setArticleDirectly);

  const bookmarkCount = useBookmarkStore((s) => s.bookmarks.length);
  const loadBookmarks = useBookmarkStore((s) => s.loadBookmarks);

  // Modal & Navigation states
  const [activeTab, setActiveTab] = useState<BottomNavTab>('home');
  const [selectedRoastArticle, setSelectedRoastArticle] = useState<Article | null>(null);
  const [viewerImage, setViewerImage] = useState<{ uri: string; heading: string; category: CategoryKey } | null>(null);
  const [isRoastModalOpen, setIsRoastModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState<boolean>(false);

  const handleArticleSelectedFromNotification = React.useCallback(() => {
    setIsSettingsOpen(false);
    setIsBookmarksOpen(false);
    setIsRoastModalOpen(false);
    setViewerImage(null);
    setActiveTab('home');
  }, []);

  // Push notification channel, background listener & deep-link routing
  useNotifications({
    onArticleSelected: handleArticleSelectedFromNotification,
  });

  useEffect(() => {
    initTheme();
    loadBookmarks();
  }, [initTheme, loadBookmarks]);

  const handleOpenFullRoast = React.useCallback((article: Article) => {
    setSelectedRoastArticle(article);
    setIsRoastModalOpen(true);
  }, []);

  const handleOpenSource = React.useCallback(async (url: string) => {
    await openArticleSource(url);
  }, []);

  const handleCategorySelect = React.useCallback(async (newCategory: CategoryKey) => {
    await setCategory(newCategory);
  }, [setCategory]);

  const handleOpenImageViewer = React.useCallback((uri: string, heading: string, cat: CategoryKey) => {
    setViewerImage({ uri, heading, category: cat });
  }, []);

  const handleTabPress = React.useCallback((tab: BottomNavTab) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home':
        setCurrentIndex(0);
        break;
      case 'settings':
        setIsSettingsOpen(true);
        break;
      case 'saved':
        setIsBookmarksOpen(true);
        break;
    }
  }, [setCurrentIndex]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
        <SafeAreaProvider>
          <SafeAreaView
            style={[styles.safeArea, { backgroundColor: colors.background }]}
            edges={['top', 'left', 'right', 'bottom']}
          >
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />

            <View style={[styles.appContainer, { backgroundColor: colors.background }]}>
              {/* 1. Category selection pill bar directly below top safe area */}
              <CategoryPills
                activeCategory={category}
                onSelectCategory={handleCategorySelect}
              />

              {/* 2. Core Card Deck Swiper (Next card underneath with scale & reveal) */}
              <CardSwiper
                onOpenFullRoast={handleOpenFullRoast}
                onOpenSourceLink={handleOpenSource}
                onOpenImageViewer={handleOpenImageViewer}
              />

              {/* 3. 3-Option Bottom Navigation Bar (Home, Saved, Settings) */}
              <BottomNav
                activeTab={activeTab}
                onTabPress={handleTabPress}
                bookmarkCount={bookmarkCount}
              />
            </View>

            {/* Modals & Overlays */}
            <ImageViewerModal
              visible={viewerImage !== null}
              imageUri={viewerImage?.uri ?? null}
              heading={viewerImage?.heading}
              category={viewerImage?.category}
              onClose={() => setViewerImage(null)}
            />

            <FullRoastModal
              visible={isRoastModalOpen}
              article={selectedRoastArticle}
              onClose={() => setIsRoastModalOpen(false)}
            />

            <SettingsModal
              visible={isSettingsOpen}
              onClose={() => {
                setIsSettingsOpen(false);
                setActiveTab('home');
              }}
            />

            <BookmarksModal
              visible={isBookmarksOpen}
              onClose={() => {
                setIsBookmarksOpen(false);
                setActiveTab('home');
              }}
            />

            {/* First-launch Category Subscription Onboarding (Prompted once after install) */}
            <CategoryOnboardingModal />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  appContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
});
