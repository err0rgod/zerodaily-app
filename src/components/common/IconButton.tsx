import * as Haptics from 'expo-haptics';
import React, { useCallback } from 'react';
import { Platform, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../../store/themeStore';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  size?: number;
  style?: ViewStyle;
  active?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
}

const IconButtonComponent: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  size = 40,
  style,
  active = false,
  accessibilityLabel,
  disabled = false,
}) => {
  const { colors } = useTheme();

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      disabled={disabled}
      // Keeps the tap target at the 48dp accessibility minimum even though
      // the visual button is 36dp.
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled }}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: active ? colors.surfaceHover : colors.surface,
          borderColor: active ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
};

export const IconButton = React.memo(IconButtonComponent);

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
