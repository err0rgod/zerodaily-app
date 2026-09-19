import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { Header } from './src/components/common/Header';
import { CardSwiper } from './src/components/feed/CardSwiper';
import { CategoryPills } from './src/components/feed/CategoryPills';
import { BookmarksModal } from './src/components/modals/BookmarksModal';
import { FullRoastModal } from './src/components/modals/FullRoastModal';
import { NotificationModal } from './src/components/modals/NotificationModal';
import { SettingsModal } from './src/components/modals/SettingsModal';
import { openArticleSource } from './src/components/webview/ArticleReader';
import { useNotifications } from './src/hooks/useNotifications';
import { useBookmarkStore } from './src/store/bookmarkStore';
import { useFeedStore } from './src/store/feedStore';
import { useTheme, useThemeStore } from './src/store/themeStore';
import { Article, CategoryKey } from './src/types';

export default function App() {
  // Push notification channel & topic initialization
  useNotifications();

  // Active theme
  const { colors, isDark } = useTheme();
  const initTheme = useThemeStore((s) => s.initTheme);

  // Store access
  const { category, setCategory } = useFeedStore();
  const { bookmarks, loadBookmarks } = useBookmarkStore();

  // Modal visibility states
  const [selectedRoastArticle, setSelectedRoastArticle] = useState<Article | null>(null);
  const [isRoastModalOpen, setIsRoastModalOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState<boolean>(false);

  useEffect(() => {
    initTheme();
    loadBookmarks();
  }, [initTheme, loadBookmarks]);

  const handleOpenFullRoast = (article: Article) => {
    setSelectedRoastArticle(article);
    setIsRoastModalOpen(true);
  };

  const handleOpenSource = async (url: string) => {
    await openArticleSource(url);
  };

  const handleCategorySelect = async (newCategory: CategoryKey) => {
    await setCategory(newCategory);
  };

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
        <SafeAreaProvider>
          <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />

            <View style={[styles.appContainer, { backgroundColor: colors.background }]}>
              {/* 1. Header with brand, theme toggle, bell, bookmarks, settings */}
              <Header
                onOpenNotifications={() => setIsNotificationsOpen(true)}
                onOpenBookmarks={() => setIsBookmarksOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                bookmarkCount={bookmarks.length}
              />

              {/* 2. Category selection pill bar */}
              <CategoryPills
                activeCategory={category}
                onSelectCategory={handleCategorySelect}
              />

              {/* 3. Core Inshorts vertical swiper feed */}
              <CardSwiper
                onOpenFullRoast={handleOpenFullRoast}
                onOpenSourceLink={handleOpenSource}
              />
            </View>

            {/* Modals & Bottom Sheets */}
            <FullRoastModal
              visible={isRoastModalOpen}
              article={selectedRoastArticle}
              onClose={() => setIsRoastModalOpen(false)}
            />

            <NotificationModal
              visible={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
            />

            <SettingsModal
              visible={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
            />

            <BookmarksModal
              visible={isBookmarksOpen}
              onClose={() => setIsBookmarksOpen(false)}
            />
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
  },
});
