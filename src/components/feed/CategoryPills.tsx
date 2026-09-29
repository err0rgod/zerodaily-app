import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORY_LIST } from '../../constants/categories';
import { useTheme } from '../../store/themeStore';
import { CategoryKey } from '../../types';

interface CategoryPillsProps {
  activeCategory: CategoryKey;
  onSelectCategory: (category: CategoryKey) => void;
}

export const CategoryPills: React.FC<CategoryPillsProps> = React.memo(({
  activeCategory,
  onSelectCategory,
}) => {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const pillLayouts = useRef<Record<string, { x: number; width: number }>>({});

  useEffect(() => {
    const layout = pillLayouts.current[activeCategory];
    if (layout && scrollRef.current) {
      scrollRef.current.scrollTo({
        x: Math.max(0, layout.x - 30),
        animated: true,
      });
    }
  }, [activeCategory]);

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <ScrollView
        ref={scrollRef}
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
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                pillLayouts.current[item.key] = { x, width };
                if (item.key === activeCategory && scrollRef.current) {
                  scrollRef.current.scrollTo({
                    x: Math.max(0, x - 30),
                    animated: false,
                  });
                }
              }}
              onPress={() => onSelectCategory(item.key)}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? `${accent}18` : colors.surface,
                  borderColor: isActive ? accent : colors.border,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.15}
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
});

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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12.5,
    letterSpacing: 0.1,
  },
});
