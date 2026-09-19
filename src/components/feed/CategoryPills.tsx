import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORY_LIST } from '../../constants/categories';
import { useTheme } from '../../store/themeStore';
import { CategoryKey } from '../../types';

interface CategoryPillsProps {
  activeCategory: CategoryKey;
  onSelectCategory: (category: CategoryKey) => void;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {CATEGORY_LIST.map((item) => {
          const isActive = activeCategory === item.key;
          const accent = item.key === 'all' ? colors.primary : (colors[item.key] || item.accentColor);

          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.7}
              onPress={() => onSelectCategory(item.key)}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? `${accent}18` : colors.surface,
                  borderColor: isActive ? accent : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.indicator,
                  { backgroundColor: isActive ? accent : colors.textMuted },
                ]}
              />
              <Text
                style={[
                  styles.pillText,
                  isActive
                    ? { color: accent, fontWeight: '700' }
                    : { color: colors.textSecondary, fontWeight: '500' },
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  container: {
    paddingHorizontal: 14,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  pillText: {
    fontSize: 12.5,
    letterSpacing: 0.1,
  },
});
