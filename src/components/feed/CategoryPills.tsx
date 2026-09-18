import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORY_LIST } from '../../constants/categories';
import { THEME } from '../../constants/theme';
import { CategoryKey } from '../../types';

interface CategoryPillsProps {
  activeCategory: CategoryKey;
  onSelectCategory: (category: CategoryKey) => void;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {CATEGORY_LIST.map((item) => {
          const isActive = activeCategory === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.7}
              onPress={() => onSelectCategory(item.key)}
              style={[
                styles.pill,
                isActive && {
                  backgroundColor: `${item.accentColor}20`,
                  borderColor: item.accentColor,
                },
              ]}
            >
              <View
                style={[
                  styles.indicator,
                  { backgroundColor: isActive ? item.accentColor : THEME.colors.textMuted },
                ]}
              />
              <Text
                style={[
                  styles.pillText,
                  isActive
                    ? { color: item.accentColor, fontWeight: '700' }
                    : { color: THEME.colors.textSecondary },
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
    backgroundColor: THEME.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingVertical: 8,
  },
  container: {
    paddingHorizontal: THEME.spacing.md,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  pillText: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '500',
  },
});
