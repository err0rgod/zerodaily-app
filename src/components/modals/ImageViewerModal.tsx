import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES } from '../../constants/categories';
import { CategoryKey } from '../../types';

interface ImageViewerModalProps {
  visible: boolean;
  imageUri: string | null;
  heading?: string;
  category?: CategoryKey;
  onClose: () => void;
}

const MIN_SCALE = 1.0;
const MAX_SCALE = 4.0;
const DOUBLE_TAP_SCALE = 2.4;
const ZOOMED_THRESHOLD = 1.05;
const SPRING = { damping: 18, stiffness: 180, mass: 0.9 } as const;

const fireHaptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  imageUri,
  heading,
  category = 'all',
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  // Live window size — read on every render, so rotation can never leave the
  // pan clamps working off a stale viewport.
  const { width: winW, height: winH } = useWindowDimensions();

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Drives the Reset pill. Previously this read `currentScale.current` during
  // render, which never triggered a re-render, so the pill never appeared.
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  useEffect(() => {
    if (!visible) return;
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedScale.value = 1;
    savedTx.value = 0;
    savedTy.value = 0;
    setIsZoomed(false);
  }, [visible, imageUri, scale, tx, ty, savedScale, savedTx, savedTy]);

  const animateTo = useCallback(
    (nextScale: number, nextTx: number, nextTy: number) => {
      scale.value = withSpring(nextScale, SPRING);
      tx.value = withSpring(nextTx, SPRING);
      ty.value = withSpring(nextTy, SPRING);
      savedScale.value = nextScale;
      savedTx.value = nextTx;
      savedTy.value = nextTy;
      setIsZoomed(nextScale > ZOOMED_THRESHOLD);
    },
    [scale, tx, ty, savedScale, savedTx, savedTy]
  );

  const resetTransform = useCallback(() => {
    animateTo(1, 0, 0);
  }, [animateTo]);

  // Desktop web zoom buttons
  const handleZoomIn = useCallback(() => {
    const next = Math.min(savedScale.value + 0.6, MAX_SCALE);
    animateTo(next, savedTx.value, savedTy.value);
  }, [animateTo, savedScale, savedTx, savedTy]);

  const handleZoomOut = useCallback(() => {
    const next = Math.max(savedScale.value - 0.6, MIN_SCALE);
    if (next <= ZOOMED_THRESHOLD) {
      resetTransform();
    } else {
      animateTo(next, savedTx.value, savedTy.value);
    }
  }, [animateTo, resetTransform, savedScale, savedTx, savedTy]);

  /* ---------------- gestures (UI thread) ---------------- */

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      'worklet';
      scale.value = Math.min(Math.max(savedScale.value * e.scale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      'worklet';
      // Settle at 1x if the user pinched back down, and report zoom state once
      // rather than on every frame.
      if (scale.value <= ZOOMED_THRESHOLD) {
        scale.value = withSpring(1, SPRING);
        tx.value = withSpring(0, SPRING);
        ty.value = withSpring(0, SPRING);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
        runOnJS(setIsZoomed)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(setIsZoomed)(true);
      }
    });

  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      'worklet';
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (scale.value <= ZOOMED_THRESHOLD) return;
      const maxX = ((scale.value - 1) * winW) / 2;
      const maxY = ((scale.value - 1) * winH) / 2;
      tx.value = Math.min(Math.max(savedTx.value + e.translationX, -maxX), maxX);
      ty.value = Math.min(Math.max(savedTy.value + e.translationY, -maxY), maxY);
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd((_e, success) => {
      'worklet';
      if (!success) return;
      const zoomed = scale.value > 1.2;
      runOnJS(fireHaptic)();
      if (zoomed) {
        scale.value = withSpring(1, SPRING);
        tx.value = withSpring(0, SPRING);
        ty.value = withSpring(0, SPRING);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
        runOnJS(setIsZoomed)(false);
      } else {
        scale.value = withSpring(DOUBLE_TAP_SCALE, SPRING);
        savedScale.value = DOUBLE_TAP_SCALE;
        runOnJS(setIsZoomed)(true);
      }
    });

  // The tap keeps priority; the pinch/pan pair runs simultaneously.
  const gesture = Gesture.Exclusive(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: tx.value }, { translateY: ty.value }],
  }));

  if (!visible || !imageUri) return null;

  const categoryMeta = CATEGORIES[category] || CATEGORIES.all;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {/* Top controls, inset past the status bar */}
        <View style={[styles.topHeader, { top: Math.max(insets.top, 16) }]}>
          <View style={[styles.catBadge, { borderColor: `${categoryMeta.accentColor}60` }]}>
            <Text style={[styles.catText, { color: categoryMeta.accentColor }]}>
              {categoryMeta.name.toUpperCase()}
            </Text>
          </View>

          <View style={styles.topActions}>
            {isZoomed && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={resetTransform}
                style={styles.actionPill}
                accessibilityRole="button"
                accessibilityLabel="Reset zoom"
              >
                <RotateCcw size={15} color="#FFFFFF" />
                <Text style={styles.actionPillText}>Reset</Text>
              </TouchableOpacity>
            )}

            {Platform.OS === 'web' && (
              <View style={styles.webZoomRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleZoomOut}
                  style={styles.circleBtn}
                  accessibilityLabel="Zoom out"
                >
                  <ZoomOut size={17} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleZoomIn}
                  style={styles.circleBtn}
                  accessibilityLabel="Zoom in"
                >
                  <ZoomIn size={17} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close image viewer"
            >
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Image canvas */}
        <GestureDetector gesture={gesture}>
          <View style={styles.canvas}>
            <Animated.View style={[styles.imageWrapper, imageStyle]}>
              <Image
                source={{ uri: imageUri }}
                style={styles.fullImage}
                contentFit="contain"
                transition={200}
                cachePolicy="memory-disk"
              />
            </Animated.View>
          </View>
        </GestureDetector>

        {/* Bottom metadata */}
        <View
          pointerEvents="none"
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}
        >
          {heading ? (
            <Text style={styles.headingText} numberOfLines={2}>
              {heading}
            </Text>
          ) : null}
          <Text style={styles.hintText}>Pinch or double-tap to zoom</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  topHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 6,
  },
  catText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webZoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    gap: 5,
  },
  actionPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  canvas: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
  },
  headingText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
