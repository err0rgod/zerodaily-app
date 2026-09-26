import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../../store/themeStore';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
  /** Announced by screen readers. Falls back to the button role when omitted. */
  accessibilityLabel?: string;
  disabled?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  size = 40,
  style,
  active = false,
  accessibilityLabel,
  disabled = false,
}) => {
  const { colors } = useTheme();

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      // Small glyphs still need a comfortable target; 6dp of bleed gets a
      // 36dp button to the 48dp minimum without changing the visual size.
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: active ? colors.surfaceHover : colors.surface,
          borderColor: active ? colors.primary : colors.border,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
