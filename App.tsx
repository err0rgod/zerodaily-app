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
import { FullRoastModal } from './src/components/modals/FullRoastModal';
import { ImageViewerModal } from './src/components/modals/ImageViewerModal';
import { NotificationModal } from './src/components/modals/NotificationModal';
import { SearchModal } from './src/components/modals/SearchModal';
import { SettingsModal } from './src/components/modals/SettingsModal';
import { openArticleSource } from './src/components/webview/ArticleReader';
import { useNotifications } from './src/hooks/useNotifications';
import { useBookmarkStore } from './src/store/bookmarkStore';
import { useFeedStore } from './src/store/feedStore';
import { useNotificationStore } from './src/store/notificationStore';
import { useTheme, useThemeStore } from './src/store/themeStore';
import { Article, CategoryKey } from './src/types';

export default function App() {
  // Push notification channel & topic initialization
  useNotifications();

  // Active theme
  const { colors, isDark } = useTheme();
  const initTheme = useThemeStore((s) => s.initTheme);

  // Store access
  const { category, setCategory, currentIndex, setCurrentIndex, refreshFeed } = useFeedStore();
  const { bookmarks, loadBookmarks } = useBookmarkStore();
  const { hasUnread } = useNotificationStore();

  // Modal & Navigation states
  const [activeTab, setActiveTab] = useState<BottomNavTab>('home');
  const [selectedRoastArticle, setSelectedRoastArticle] = useState<Article | null>(null);
  const [viewerImage, setViewerImage] = useState<{ uri: string; heading: string; category: CategoryKey } | null>(null);
  const [isRoastModalOpen, setIsRoastModalOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
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

  const handleTabPress = (tab: BottomNavTab) => {
    setActiveTab(tab);
    switch (tab) {
      case 'search':
        setIsSearchOpen(true);
        break;
      case 'notifications':
        setIsNotificationsOpen(true);
        break;
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
  };

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
                onOpenImageViewer={(uri, heading, cat) => setViewerImage({ uri, heading, category: cat })}
              />

              {/* 3. 5-Option Bottom Navigation Bar (Search, Notifications, Home, Settings, Saved) */}
              <BottomNav
                activeTab={activeTab}
                onTabPress={handleTabPress}
                bookmarkCount={bookmarks.length}
                hasUnreadNotifications={hasUnread}
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
            <SearchModal
              visible={isSearchOpen}
              onClose={() => {
                setIsSearchOpen(false);
                setActiveTab('home');
              }}
            />

            <FullRoastModal
              visible={isRoastModalOpen}
              article={selectedRoastArticle}
              onClose={() => setIsRoastModalOpen(false)}
            />

            <NotificationModal
              visible={isNotificationsOpen}
              onClose={() => {
                setIsNotificationsOpen(false);
                setActiveTab('home');
              }}
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
