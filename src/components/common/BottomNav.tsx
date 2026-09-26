import * as Haptics from 'expo-haptics';
import { Bookmark, Home, Settings } from 'lucide-react-native';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../store/themeStore';

export type BottomNavTab = 'home' | 'saved' | 'settings';

interface BottomNavProps {
  activeTab?: BottomNavTab;
  onTabPress: (tab: BottomNavTab) => void;
  bookmarkCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = React.memo(({
  activeTab = 'home',
  onTabPress,
  bookmarkCount = 0,
}) => {
  const { colors, isDark } = useTheme();

  const handlePress = (tab: BottomNavTab) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onTabPress(tab);
  };

  const tabs: { key: BottomNavTab; label: string; icon: React.ReactNode; badge?: React.ReactNode }[] = [
    {
      key: 'home',
      label: 'Home',
      icon: <Home size={22} color={activeTab === 'home' ? colors.primary : colors.textMuted} />,
    },
    {
      key: 'saved',
      label: 'Saved',
      icon: (
        <Bookmark
          size={20}
          color={activeTab === 'saved' ? colors.primary : colors.textMuted}
          fill={activeTab === 'saved' ? colors.primary : 'transparent'}
        />
      ),
      badge: bookmarkCount > 0 ? (
        <View style={[styles.counterBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.counterText} maxFontSizeMultiplier={1.0}>{bookmarkCount > 9 ? '9+' : bookmarkCount}</Text>
        </View>
      ) : null,
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: <Settings size={20} color={activeTab === 'settings' ? colors.primary : colors.textMuted} />,
    },
  ];


  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          shadowColor: isDark ? '#000000' : '#0F172A',
        },
      ]}
    >
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              onPress={() => handlePress(tab.key)}
              style={styles.tabButton}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.iconContainer}>
                {tab.icon}
                {tab.badge}
              </View>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.12}
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.primary : colors.textMuted,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 6,
    elevation: 8,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 50,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
  },
  tabLabel: {
    fontSize: 10.5,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  counterBadge: {
    position: 'absolute',
    top: -2,
    right: -8,
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
