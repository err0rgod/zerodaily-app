import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  imageUri,
  heading,
  category = 'all',
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  // Animated values for scale and pan offset
  const scale = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  // Track numerical values in refs for gesture math
  const currentScale = useRef<number>(1);
  const currentPanX = useRef<number>(0);
  const currentPanY = useRef<number>(0);

  // Pinch gesture tracking
  const initialPinchDist = useRef<number>(0);
  const initialScaleOnPinch = useRef<number>(1);

  // Double tap detection
  const lastTapTime = useRef<number>(0);

  // Listen to dimension changes
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => sub?.remove();
  }, []);

  // Sync animated values with state
  useEffect(() => {
    const idScale = scale.addListener(({ value }) => {
      currentScale.current = value;
    });
    const idPanX = panX.addListener(({ value }) => {
      currentPanX.current = value;
    });
    const idPanY = panY.addListener(({ value }) => {
      currentPanY.current = value;
    });

    return () => {
      scale.removeListener(idScale);
      panX.removeListener(idPanX);
      panY.removeListener(idPanY);
    };
  }, [scale, panX, panY]);

  // Reset transforms whenever modal opens or imageUri changes
  const resetTransform = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(panX, { toValue: 0, friction: 7, tension: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(panY, { toValue: 0, friction: 7, tension: 50, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [scale, panX, panY]);

  useEffect(() => {
    if (visible) {
      scale.setValue(1);
      panX.setValue(0);
      panY.setValue(0);
      currentScale.current = 1;
      currentPanX.current = 0;
      currentPanY.current = 0;
    }
  }, [visible, imageUri, scale, panX, panY]);

  // Double tap handler
  const handleDoubleTap = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (currentScale.current > 1.2) {
      resetTransform();
    } else {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: DOUBLE_TAP_SCALE,
          friction: 7,
          tension: 45,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(panX, { toValue: 0, friction: 7, tension: 45, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(panY, { toValue: 0, friction: 7, tension: 45, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
  }, [resetTransform, scale, panX, panY]);

  // Zoom button triggers for desktop web
  const handleZoomIn = () => {
    const next = Math.min(currentScale.current + 0.6, MAX_SCALE);
    Animated.spring(scale, { toValue: next, friction: 7, tension: 45, useNativeDriver: Platform.OS !== 'web' }).start();
  };

  const handleZoomOut = () => {
    const next = Math.max(currentScale.current - 0.6, MIN_SCALE);
    if (next <= 1.05) {
      resetTransform();
    } else {
      Animated.spring(scale, { toValue: next, friction: 7, tension: 45, useNativeDriver: Platform.OS !== 'web' }).start();
    }
  };

  // PanResponder for pinch-to-zoom and pan navigation
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const now = Date.now();
        // Check for double tap (within 320ms)
        if (now - lastTapTime.current < 320) {
          handleDoubleTap();
          lastTapTime.current = 0;
          return;
        }
        lastTapTime.current = now;

        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          // Pinch start: calculate initial distance between two touch points
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          initialPinchDist.current = Math.sqrt(dx * dx + dy * dy);
          initialScaleOnPinch.current = currentScale.current;
        }
      },

      onPanResponderMove: (evt, gesture) => {
        const touches = evt.nativeEvent.touches;

        if (touches && touches.length === 2 && initialPinchDist.current > 0) {
          // Two-finger pinch gesture
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          const factor = currentDist / initialPinchDist.current;
          const targetScale = Math.min(Math.max(initialScaleOnPinch.current * factor, 0.8), MAX_SCALE);
          scale.setValue(targetScale);
        } else if (currentScale.current > 1.05) {
          // Single-finger pan when zoomed in
          const maxPanX = ((currentScale.current - 1) * dimensions.width) / 2;
          const maxPanY = ((currentScale.current - 1) * dimensions.height) / 2;

          const nextX = Math.min(Math.max(currentPanX.current + gesture.dx * 0.4, -maxPanX), maxPanX);
          const nextY = Math.min(Math.max(currentPanY.current + gesture.dy * 0.4, -maxPanY), maxPanY);

          panX.setValue(nextX);
          panY.setValue(nextY);
        }
      },

      onPanResponderRelease: () => {
        initialPinchDist.current = 0;

        // Snap back if pinched below 1x
        if (currentScale.current < 1.05) {
          resetTransform();
        }
      },
    })
  ).current;

  if (!visible || !imageUri) return null;

  const categoryMeta = CATEGORIES[category] || CATEGORIES.all;
  const isZoomed = currentScale.current > 1.1;

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
        {/* TOP HEADER CONTROLS (Safe Area Insets) */}
        <View style={[styles.topHeader, { top: Math.max(insets.top, 16) }]}>
          {/* Category Chip */}
          <View style={[styles.catBadge, { borderColor: `${categoryMeta.accentColor}60` }]}>
            <Text style={[styles.catText, { color: categoryMeta.accentColor }]}>
              {categoryMeta.name.toUpperCase()}
            </Text>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.topActions}>
            {isZoomed && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={resetTransform}
                style={styles.actionPill}
              >
                <RotateCcw size={15} color="#FFFFFF" />
                <Text style={styles.actionPillText}>Reset</Text>
              </TouchableOpacity>
            )}

            {/* Desktop Web Zoom Buttons */}
            {Platform.OS === 'web' && (
              <View style={styles.webZoomRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleZoomOut}
                  style={styles.circleBtn}
                >
                  <ZoomOut size={17} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleZoomIn}
                  style={styles.circleBtn}
                >
                  <ZoomIn size={17} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Close Button (X) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close Image Viewer"
            >
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* FULLSCREEN IMAGE CANVAS WITH PINCH & PAN GESTURES */}
        <View style={styles.canvas} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.imageWrapper,
              {
                transform: [{ scale }, { translateX: panX }, { translateY: panY }],
              },
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.fullImage}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
            />
          </Animated.View>
        </View>

        {/* BOTTOM METADATA & HINT FOOTER */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          {heading ? (
            <Text style={styles.headingText} numberOfLines={2}>
              {heading}
            </Text>
          ) : null}
          <Text style={styles.hintText}>
            Double-tap or pinch to zoom • Drag to pan details
          </Text>
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
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    width: 38,
    height: 38,
    borderRadius: 19,
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
