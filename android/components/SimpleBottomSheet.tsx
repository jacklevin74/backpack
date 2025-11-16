import React, { useState, useImperativeHandle, forwardRef } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface SimpleBottomSheetProps {
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  enablePanDownToClose?: boolean;
  index?: number;
  onChange?: (index: number) => void;
  backdropComponent?: any;
}

export interface SimpleBottomSheetRef {
  close: () => void;
  expand: () => void;
  snapToIndex: (index: number) => void;
}

const SimpleBottomSheet = forwardRef<SimpleBottomSheetRef, SimpleBottomSheetProps>(
  ({ children, snapPoints = ['50%'], index = -1, onChange }, ref) => {
    const [visible, setVisible] = useState(index >= 0);

    useImperativeHandle(ref, () => ({
      close: () => {
        setVisible(false);
        onChange?.(-1);
      },
      expand: () => {
        setVisible(true);
        onChange?.(0);
      },
      snapToIndex: (idx: number) => {
        setVisible(idx >= 0);
        onChange?.(idx);
      },
    }));

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setVisible(false);
          onChange?.(-1);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setVisible(false);
            onChange?.(-1);
          }}
        >
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.bottomSheet}>{children}</View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }
);

export const SimpleBottomSheetView: React.FC<{ children: React.ReactNode; style?: any }> = ({
  children,
  style,
}) => <View style={[styles.content, style]}>{children}</View>;

export const SimpleBottomSheetScrollView: React.FC<{
  children: React.ReactNode;
  contentContainerStyle?: any;
}> = ({ children, contentContainerStyle }) => (
  <ScrollView style={styles.scrollView} contentContainerStyle={contentContainerStyle}>
    {children}
  </ScrollView>
);

export const SimpleBottomSheetBackdrop: React.FC<any> = () => null;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingBottom: 20,
  },
  content: {
    padding: 16,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
});

export default SimpleBottomSheet;
