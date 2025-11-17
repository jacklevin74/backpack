import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Modal, View, StyleSheet, TouchableWithoutFeedback, Animated, Dimensions, PanResponder } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * SimpleActionSheet - A simple bottom sheet using only React Native Modal
 * API compatible with TrueSheet for easy migration
 */
const SimpleActionSheet = forwardRef(({
  children,
  sizes = ['auto'],
  cornerRadius = 24,
  backgroundColor = '#000000',
  grabber = true,
  onDismiss,
}, ref) => {
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    present: () => {
      setVisible(true);
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
      ]).start();
    },
    dismiss: () => {
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
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <Animated.View style={[styles.backdrop, { opacity }]} />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor,
              borderTopLeftRadius: cornerRadius,
              borderTopRightRadius: cornerRadius,
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
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingBottom: 20,
  },
  grabberContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4E5056',
  },
});

export default SimpleActionSheet;
