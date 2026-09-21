import { Bookmark, Moon, Settings, Sun } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../store/themeStore';
import { IconButton } from './IconButton';

interface HeaderProps {
  onOpenNotifications?: () => void;
  onOpenBookmarks: () => void;
  onOpenSettings: () => void;
  bookmarkCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBookmarks,
  onOpenSettings,
  bookmarkCount = 0,
}) => {
  const { colors, isDark, toggleTheme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <View style={styles.brandRow}>
        <View style={[styles.liveIndicator, { backgroundColor: colors.primary, shadowColor: colors.primary }]} />
        <Text style={[styles.logoText, { color: colors.textPrimary }]}>ZERODAILY</Text>
      </View>

      <View style={styles.actionsRow}>
        {/* Quick 1-Tap Theme Switcher (Dark <-> Light) */}
        <IconButton
          icon={isDark ? <Sun size={17} color={colors.textPrimary} /> : <Moon size={17} color={colors.textPrimary} />}
          onPress={toggleTheme}
          size={36}
          style={styles.actionBtn}
        />

        {/* Bookmarks */}
        <View>
          <IconButton
            icon={
              <Bookmark
                size={17}
                color={bookmarkCount > 0 ? colors.primary : colors.textPrimary}
                fill={bookmarkCount > 0 ? colors.primary : 'transparent'}
              />
            }
            onPress={onOpenBookmarks}
            size={36}
            style={styles.actionBtn}
          />
          {bookmarkCount > 0 && (
            <View style={[styles.counterBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.counterText}>{bookmarkCount > 9 ? '9+' : bookmarkCount}</Text>
            </View>
          )}
        </View>

        {/* Settings */}
        <IconButton
          icon={<Settings size={17} color={colors.textPrimary} />}
          onPress={onOpenSettings}
          size={36}
          style={styles.actionBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 2,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    marginLeft: 6,
  },
  counterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
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
