import { Bell, Bookmark, Settings } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../../constants/theme';
import { IconButton } from './IconButton';

interface HeaderProps {
  onOpenNotifications: () => void;
  onOpenBookmarks: () => void;
  onOpenSettings: () => void;
  bookmarkCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  onOpenBookmarks,
  onOpenSettings,
  bookmarkCount = 0,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View style={styles.liveIndicator} />
        <Text style={styles.logoText}>ZERODAILY</Text>
      </View>

      <View style={styles.actionsRow}>
        <IconButton
          icon={<Bell size={18} color={THEME.colors.textPrimary} />}
          onPress={onOpenNotifications}
          size={36}
          style={styles.actionBtn}
        />

        <View>
          <IconButton
            icon={<Bookmark size={18} color={bookmarkCount > 0 ? THEME.colors.primary : THEME.colors.textPrimary} />}
            onPress={onOpenBookmarks}
            size={36}
            style={styles.actionBtn}
          />
          {bookmarkCount > 0 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>{bookmarkCount > 9 ? '9+' : bookmarkCount}</Text>
            </View>
          )}
        </View>

        <IconButton
          icon={<Settings size={18} color={THEME.colors.textPrimary} />}
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
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    backgroundColor: THEME.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
    marginRight: 8,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  logoText: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    marginLeft: 8,
  },
  counterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: THEME.colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  counterText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
  },
});
