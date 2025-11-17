import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * SimpleActionSheet - A simple bottom sheet using only React Native Modal
 * API compatible with TrueSheet for easy migration
 */
const SimpleActionSheet = forwardRef(
  (
    {
      children,
      sizes = ["auto"],
      cornerRadius = 24,
      backgroundColor = "#000000",
      grabber = true,
      onDismiss,
    },
    ref
  ) => {
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only capture downward drags
          return gestureState.dy > 5;
        },
        onPanResponderMove: (_, gestureState) => {
          // Only allow dragging down (positive dy)
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const threshold = 150;
          if (gestureState.dy > threshold) {
            // Dismiss if dragged beyond threshold
            ref.current?.dismiss();
          } else {
            // Snap back to original position
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start();
          }
        },
      })
    ).current;

    useImperativeHandle(ref, () => ({
      present: () => {
        console.log("[SimpleActionSheet] present() called");
        console.log("[SimpleActionSheet] Current visible state:", visible);
        setVisible(true);
        console.log("[SimpleActionSheet] setVisible(true) called");
        // Reset animation values and start animation after modal is visible
        setTimeout(() => {
          console.log(
            "[SimpleActionSheet] Animation timeout fired, starting animation"
          );
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            console.log("[SimpleActionSheet] Animation complete");
          });
        }, 50);
      },
      dismiss: () => {
        console.log("[SimpleActionSheet] dismiss() called");
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          console.log(
            "[SimpleActionSheet] Dismiss animation complete, setVisible(false)"
          );
          setVisible(false);
          onDismiss?.();
        });
      },
      resize: (index) => {
        // No-op for compatibility
      },
    }));

    const handleBackdropPress = () => {
      ref.current?.dismiss();
    };

    if (!visible) return null;

    return (
      <Modal
        transparent
        visible={visible}
        onRequestClose={() => ref.current?.dismiss()}
        statusBarTranslucent
        animationType="none"
      >
        <View style={styles.container}>
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={handleBackdropPress}>
            <Animated.View
              style={[styles.backdrop, { opacity }]}
              pointerEvents="auto"
            />
          </TouchableWithoutFeedback>

          {/* Sheet */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.sheet,
              {
                backgroundColor,
                borderTopLeftRadius: cornerRadius,
                borderTopRightRadius: cornerRadius,
                paddingBottom: 20 + insets.bottom,
                transform: [{ translateY }],
              },
            ]}
          >
            {grabber && (
              <View style={styles.grabberContainer}>
                <View style={styles.grabber} />
              </View>
            )}
            {children}
          </Animated.View>
        </View>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    height: SCREEN_HEIGHT * 0.9,
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  grabberContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4E5056",
  },
});

export default SimpleActionSheet;
