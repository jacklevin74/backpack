# React Native Bottom Sheet Implementation Research
## Custom Solutions WITHOUT Reanimated

This document provides comprehensive research on implementing bottom sheets in React Native without using Reanimated or complex animation libraries, focusing on Android compatibility and performance.

---

## Table of Contents
1. [Custom Implementation with PanResponder](#1-custom-implementation-with-panresponder)
2. [Custom Implementation with Animated API](#2-custom-implementation-with-animated-api)
3. [Lightweight Library Alternatives](#3-lightweight-library-alternatives)
4. [Native Android BottomSheetDialog](#4-native-android-bottomsheetdialog)
5. [Performance & Compatibility Comparison](#5-performance--compatibility-comparison)
6. [Recommendations](#6-recommendations)

---

## 1. Custom Implementation with PanResponder

### Overview
Using React Native's built-in `Modal` component with `PanResponder` for gesture handling provides full control without external dependencies.

### Complete Implementation Example

Based on [this gist](https://gist.github.com/mizanxali/df7bc82a1dadf3723c15603cd385d53b), here's a production-ready implementation:

```typescript
import React, { useRef, useEffect } from 'react';
import {
  View,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnSwipeDown?: boolean;
  height?: number;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  closeOnSwipeDown = true,
  height = 300,
}) => {
  const screenHeight = Dimensions.get('window').height;
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => closeOnSwipeDown,
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward swipes
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldClose =
          gestureState.dy > height * 0.4 || gestureState.vy > 0.5;

        if (shouldClose) {
          closeSheet();
        } else {
          // Snap back to original position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const openSheet = () => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(translateY, {
      toValue: screenHeight,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  useEffect(() => {
    if (visible) {
      openSheet();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeSheet}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={closeSheet}
        />
        <Animated.View
          style={[
            styles.sheet,
            { height, transform: [{ translateY }] },
          ]}
          {...panResponder.panHandlers}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
});

export default BottomSheet;
```

### Key Implementation Details

**PanResponder Gesture Handling:**
- `onStartShouldSetPanResponder`: Activates when `closeOnSwipeDown` is enabled
- `onPanResponderMove`: Tracks downward gesture movement (dy > 0) and updates animated value
- `onPanResponderRelease`: Closes sheet if swiped past 40% of height OR velocity exceeds 0.5

**Animation Strategy:**
- Uses `Animated.timing()` for open/close transitions
- Uses `Animated.spring()` to snap back when gesture doesn't meet close threshold
- `useNativeDriver: true` enables native thread animations for 60fps performance

**Common Pitfalls to Avoid:**
1. **Don't intercept button presses**: Set `onMoveShouldSetPanResponder` to false to prevent gesture handler from blocking child component interactions
2. **Prevent stuttering**: Extract current translateY value in `onPanResponderGrant`, use as offset, and reset to 0
3. **Android back button**: Handle `onRequestClose` prop on Modal

### Tutorial Resources
- [Medium: BottomSheet with PanResponder](https://andriidrozdov.medium.com/bottomsheet-with-reactnative-receipt-of-duck-soup-e3ded07f2f49)
- [Medium: Bottom Sheet with React Native](https://arbaz5256.medium.com/bottom-sheet-with-react-native-c249130bed63)
- [GitHub Example](https://github.com/ruslanzharkov/react-native-bottom-sheet)

---

## 2. Custom Implementation with Animated API

### Overview
Using React Native's `Animated` API without PanResponder - simpler but less interactive.

### Complete Implementation

Based on [CodeDaily tutorial](https://www.codedaily.io/tutorials/Create-a-Custom-Animated-Bottom-Action-Sheet-without-Measuring-in-React-Native):

```javascript
import React, { useState } from 'react';
import {
  View,
  Modal,
  Animated,
  Dimensions,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';

const { height: screenHeight } = Dimensions.get('window');

const BottomActionSheet = ({ visible, onClose, children }) => {
  const [animation] = useState(new Animated.Value(0));

  const handleOpen = () => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleClose = () => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  React.useEffect(() => {
    if (visible) {
      handleOpen();
    }
  }, [visible]);

  // Backdrop opacity animation with "cliff" technique
  const backdropOpacity = animation.interpolate({
    inputRange: [0, 0.01, 1],
    outputRange: [0, 0, 0.5],
  });

  // Sheet translation animation
  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -screenHeight],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropOpacity },
            ]}
          />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[
            styles.popup,
            { transform: [{ translateY }] },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  popup: {
    position: 'absolute',
    top: screenHeight,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'flex-end',
  },
});

export default BottomActionSheet;
```

### Key Techniques

**No Measurement Required:**
- Uses absolute positioning: `top: screenHeight` to place sheet off-screen initially
- Uses `justifyContent: 'flex-end'` to render content at bottom regardless of size
- Translation of `-screenHeight` when animation value reaches 1

**Backdrop "Cliff" Interpolation:**
- Interpolation from 0 to 0.01 creates instant positioning
- Then fades opacity from 0.01 to 0.5
- Prevents visual glitches as overlay moves into place

**Advantages:**
- Simpler than PanResponder - no complex gesture logic
- "100% reversible" animations driven by single animated value
- Avoids measuring inner content dimensions

**Limitations:**
- No swipe-to-dismiss gesture
- Less interactive than PanResponder solution

---

## 3. Lightweight Library Alternatives

### 3.1 react-native-raw-bottom-sheet

**Best for:** Zero-dependency, simple bottom sheets

#### Installation
```bash
npm i react-native-raw-bottom-sheet --save
# or
yarn add react-native-raw-bottom-sheet
```

#### Implementation
```javascript
import React, { useRef } from 'react';
import { View, Button } from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';

export default function Example() {
  const refRBSheet = useRef();

  return (
    <View style={{ flex: 1 }}>
      <Button
        title="OPEN BOTTOM SHEET"
        onPress={() => refRBSheet.current.open()}
      />
      <RBSheet
        ref={refRBSheet}
        useNativeDriver={true}
        height={300}
        openDuration={300}
        closeDuration={200}
        closeOnPressMask={true}
        closeOnPressBack={false}
        draggable={true}
        dragOnContent={false}
        customStyles={{
          wrapper: { backgroundColor: 'transparent' },
          draggableIcon: { backgroundColor: '#000' },
        }}
        customModalProps={{
          animationType: 'slide',
          statusBarTranslucent: true,
        }}
      >
        <YourOwnComponent />
      </RBSheet>
    </View>
  );
}
```

#### Key Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `height` | number | 260 | Sheet height in pixels |
| `draggable` | boolean | false | Enable drag-down gesture |
| `dragOnContent` | boolean | false | Allow dragging on content area |
| `useNativeDriver` | boolean | false | Enable native animation driver |
| `closeOnPressMask` | boolean | true | Close when tapping outside |
| `customStyles` | object | {} | Custom styling |

#### Pros
- **Zero dependencies** - no external libraries required
- Lightweight (v3.0.0 rewritten with Functional Components)
- Smooth animations
- Supports all orientations
- Both Android and iOS support

#### Cons
- Less feature-rich than larger libraries
- Basic customization options

#### Stats
- **Weekly Downloads:** 24,912
- **GitHub Stars:** 1,178
- **Package Size:** Small/lightweight

---

### 3.2 react-native-actions-sheet

**Best for:** Advanced features with zero dependencies

#### Installation
```bash
npm install react-native-actions-sheet
```

#### Basic Implementation
```tsx
import React, { useRef } from 'react';
import ActionSheet, { ActionSheetRef } from 'react-native-actions-sheet';

function App() {
  const actionSheetRef = useRef<ActionSheetRef>(null);

  return (
    <>
      <Button
        title="Open"
        onPress={() => actionSheetRef.current?.show()}
      />
      <ActionSheet ref={actionSheetRef}>
        <Text>Hi, I am here.</Text>
      </ActionSheet>
    </>
  );
}
```

#### Advanced: SheetManager (Global Access)
```tsx
import { SheetManager } from 'react-native-actions-sheet';

// Register sheets
import { registerSheet } from 'react-native-actions-sheet';

registerSheet('example-sheet', ExampleSheet);

// Show from anywhere
SheetManager.show('example-sheet', {
  payload: { data: 'hello world' },
});

// Hide with return value
SheetManager.hide('example-sheet', {
  payload: { confirmed: true },
});
```

#### Routing Support
```tsx
const routes = [
  { name: 'route-a', component: RouteA },
  { name: 'route-b', component: RouteB },
];

<ActionSheet
  enableRouterBackNavigation={true}
  routes={routes}
  initialRoute="route-a"
/>
```

#### Key Features
- **Zero dependencies** - explicitly mentioned
- **Native performance**
- Advanced routing system
- Global sheet management with SheetManager
- TypeScript support with full type safety
- Multi-context sheet support
- FlashList integration
- Position tracking with `onChange` prop

#### Pros
- Most feature-rich without Reanimated
- Excellent TypeScript support
- Global access pattern (no prop drilling)
- Android, iOS & Web support

#### Cons
- More complex API than raw-bottom-sheet
- Larger learning curve

#### Stats
- **Weekly Downloads:** 51,290
- **GitHub Stars:** 1,853
- **Package Size:** 153 kB

---

### 3.3 react-native-modal

**Best for:** Enhanced Modal with animations

#### Installation
```bash
npm install react-native-modal
```

#### Implementation
```javascript
import React, { useState } from 'react';
import { Button, Text, View } from 'react-native';
import Modal from 'react-native-modal';

function ModalTester() {
  const [isModalVisible, setModalVisible] = useState(false);

  const toggleModal = () => {
    setModalVisible(!isModalVisible);
  };

  return (
    <View style={{ flex: 1 }}>
      <Button title="Show modal" onPress={toggleModal} />

      <Modal
        isVisible={isModalVisible}
        onBackdropPress={() => setModalVisible(false)}
        onSwipeComplete={() => setModalVisible(false)}
        swipeDirection="down"
        useNativeDriver={true}
        hideModalContentWhileAnimating={true}
        style={{ margin: 0 }} // Full screen
      >
        <View style={{ flex: 1, backgroundColor: 'white' }}>
          <Text>Hello!</Text>
          <Button title="Hide modal" onPress={toggleModal} />
        </View>
      </Modal>
    </View>
  );
}
```

#### Key Features
- Built on top of React Native's Modal component
- Swipe-to-dismiss support
- Animation customization
- `hideModalContentWhileAnimating` for better Android performance
- Native driver for backdrop animations

#### Pros
- Very popular (393,221 weekly downloads)
- Simple API
- Good documentation
- Swipe gestures built-in

#### Cons
- Not specifically designed for bottom sheets
- Fewer features than actions-sheet
- Less performant than libraries using Reanimated (for complex animations)

#### Stats
- **Weekly Downloads:** 393,221
- **GitHub Stars:** 5,630
- **Most popular** of the lightweight alternatives

---

### 3.4 react-native-modalize

**Best for:** Highly customizable modals with scrolling content

#### Installation
```bash
npm install react-native-modalize
```

#### Note
- Built on react-native-reanimated and react-native-gesture-handler
- **NOT suitable if avoiding Reanimated**
- Included for completeness but doesn't meet "no Reanimated" requirement

#### Stats
- **Weekly Downloads:** 41,647
- **GitHub Stars:** 2,892

---

## 4. Native Android BottomSheetDialog

### Overview
Using Android's native Material Design `BottomSheetDialog` via custom native module provides the most native experience with automatic accessibility support.

### Existing Library: react-native-android-bottomsheet

#### Installation
```bash
npm install react-native-android-bottomsheet
```

#### Implementation
```javascript
import BottomSheet from 'react-native-android-bottomsheet';

<BottomSheet
  peekHeight={400}
  visible={visible}
  onDismiss={() => setVisible(false)}
  maxHeight={windowHeight}
  backdropDimAmount={0.5}
  cancelable={true}
>
  <View style={{ flex: 1, backgroundColor: 'white' }}>
    <Text>Hello from bottomsheet</Text>
  </View>
</BottomSheet>
```

#### Key Props
- `visible`: boolean - Controls display state
- `onDismiss`: callback for dismissal events
- `peekHeight`: number - Collapsed height
- `maxHeight`: number - Expanded height (defaults to window height)
- `backdropDimAmount`: 0-1 range for overlay darkness
- `cancelable`: boolean - Enables swipe/back button dismissal

#### ScrollView Integration
Add `nestedScrollEnabled` to enable drag-to-expand gestures while maintaining scroll functionality.

```javascript
<ScrollView nestedScrollEnabled>
  {/* Content */}
</ScrollView>
```

#### Advantages
- **Native BottomSheetDialog** - true Android Material Design component
- **Accessibility without custom code** - screen reader support built-in
- Native gesture recognition
- Follows Android design guidelines

#### Disadvantages
- **Android only** - no iOS support
- Requires native module
- Less control over animations

---

### Custom Native Module Implementation

Based on [Shopify Engineering tutorial](https://shopify.engineering/creating-native-components-accept-react-native-subviews):

#### Step 1: Create Native Component (Kotlin)

**ReactNativeBottomSheet.kt:**
```kotlin
import android.view.View
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.google.android.material.bottomsheet.BottomSheetBehavior

class ReactNativeBottomSheet : ViewGroupManager<CoordinatorLayout>() {

  override fun getName() = "ReactNativeBottomSheet"

  override fun createViewInstance(context: ThemedReactContext): CoordinatorLayout {
    val coordinator = CoordinatorLayout(context)

    // Inflate layout from XML
    val view = LayoutInflater.from(context)
      .inflate(R.layout.bottom_sheet, coordinator, false)

    coordinator.addView(view)
    return coordinator
  }

  override fun addView(parent: CoordinatorLayout, child: View, index: Int) {
    // First child goes to main container
    // Subsequent children go to bottom sheet container
    val containerId = if (index == 0) {
      R.id.main_container
    } else {
      R.id.bottom_sheet_container
    }

    parent.findViewById<ViewGroup>(containerId).addView(child)
  }
}
```

#### Step 2: Create Layout (XML)

**res/layout/bottom_sheet.xml:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <FrameLayout
        android:id="@+id/main_container"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

    <FrameLayout
        android:id="@+id/bottom_sheet_container"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:background="@android:color/white"
        app:layout_behavior="com.google.android.material.bottomsheet.BottomSheetBehavior"
        app:behavior_peekHeight="300dp">
    </FrameLayout>

</androidx.coordinatorlayout.widget.CoordinatorLayout>
```

#### Step 3: Register Package

**NativeComponentsReactPackage.kt:**
```kotlin
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class NativeComponentsReactPackage : ReactPackage {

  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> = emptyList()

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = listOf(ReactNativeBottomSheet())
}
```

#### Step 4: TypeScript Wrapper

**BottomSheet.tsx:**
```typescript
import React from 'react';
import { requireNativeComponent, ViewProps } from 'react-native';

interface BottomSheetProps extends ViewProps {
  sheetState?: 'collapsed' | 'expanded';
  onStateChange?: (state: string) => void;
}

const NativeBottomSheet = requireNativeComponent<BottomSheetProps>(
  'ReactNativeBottomSheet'
);

export const BottomSheet: React.FC<BottomSheetProps> = (props) => {
  return <NativeBottomSheet {...props} />;
};
```

#### Advantages
- **Full native experience** on Android
- Material Design compliance
- Best accessibility support
- Native gesture handling

#### Disadvantages
- **Significant development effort**
- Android-only solution
- Requires native code maintenance
- Need separate iOS implementation

---

## 5. Performance & Compatibility Comparison

### Performance Metrics

| Solution | Animation Performance | Gesture Smoothness | Bundle Impact | Android Compatibility |
|----------|----------------------|-------------------|---------------|----------------------|
| Custom PanResponder | Excellent (native driver) | Excellent | Minimal | Excellent |
| Custom Animated API | Excellent (native driver) | Good (no gestures) | Minimal | Excellent |
| react-native-raw-bottom-sheet | Excellent | Excellent | Low | Excellent |
| react-native-actions-sheet | Excellent | Excellent | Medium (153 kB) | Excellent |
| react-native-modal | Good | Good | Medium | Good* |
| Native Android Module | Excellent (native) | Excellent (native) | Low | Excellent |

*react-native-modal may have backdrop flashing on Android - use `hideModalContentWhileAnimating`

### Dependency Analysis

| Solution | Dependencies | Reanimated Required | Native Code | Maintenance |
|----------|--------------|-------------------|-------------|-------------|
| Custom PanResponder | None | No | No | Self-maintained |
| Custom Animated API | None | No | No | Self-maintained |
| react-native-raw-bottom-sheet | **Zero** | No | No | Library maintained |
| react-native-actions-sheet | **Zero** | No | No | Library maintained |
| react-native-modal | react-native-animatable | No | No | Library maintained |
| react-native-modalize | reanimated, gesture-handler | **YES** | No | Library maintained |
| Native Android Module | Material Components | No | **YES** | Self-maintained |

### Known Compatibility Issues

#### react-native-modal
- Backdrop may flash on Android - **Fix:** Use `hideModalContentWhileAnimating={true}`
- Android back button needs `onRequestClose` handler
- Dimension issues on Android - **Fix:** Use `react-native-extra-dimensions-android`

```javascript
const deviceWidth = Dimensions.get('window').width;
const deviceHeight = Platform.OS === 'ios'
  ? Dimensions.get('window').height
  : require('react-native-extra-dimensions-android').get('REAL_WINDOW_HEIGHT');

<Modal deviceWidth={deviceWidth} deviceHeight={deviceHeight} />
```

#### Custom PanResponder Solutions
- **Stuttering on drag start** - Extract current translateY in `onPanResponderGrant`
- **Intercepting child touches** - Set `onMoveShouldSetPanResponder` to false
- **Keyboard issues** - Use `KeyboardAvoidingView` wrapper

#### All Modal-based Solutions
- StatusBar height handling on Android with notches
- Safe area handling requires additional logic
- Hardware back button needs explicit handling

---

## 6. Recommendations

### Best Overall Solution: react-native-actions-sheet

**Choose this if:**
- You need a production-ready, feature-rich solution
- You want zero dependencies (no Reanimated)
- TypeScript support is important
- You need global sheet management (no prop drilling)
- You want routing/navigation within sheets

**Implementation:**
```tsx
// 1. Install
npm install react-native-actions-sheet

// 2. Register sheets
registerSheet('wallet-sheet', WalletSheet);

// 3. Use anywhere
SheetManager.show('wallet-sheet', {
  payload: { walletId: '123' }
});
```

**Stats:**
- 51,290 weekly downloads
- Zero dependencies
- Native performance
- Excellent TypeScript support

---

### Simplest Solution: react-native-raw-bottom-sheet

**Choose this if:**
- You want the absolute simplest implementation
- You don't need advanced features
- Bundle size is critical
- You prefer minimal API surface

**Implementation:**
```javascript
const refRBSheet = useRef();

<RBSheet
  ref={refRBSheet}
  useNativeDriver={true}
  draggable={true}
  height={300}
>
  <YourComponent />
</RBSheet>
```

**Stats:**
- 24,912 weekly downloads
- Zero dependencies
- Smallest footprint

---

### Most Control: Custom PanResponder Implementation

**Choose this if:**
- You need complete customization
- You want to avoid ALL external dependencies
- You have specific gesture requirements
- You're willing to maintain the code

**Use the complete example from Section 1**

**Advantages:**
- No dependencies at all
- Full control over every aspect
- Can be optimized for your specific use case
- No library updates to worry about

**Disadvantages:**
- You maintain all the code
- Need to handle edge cases yourself
- More initial development time

---

### Android-Only Native Solution

**Choose this if:**
- You only need Android support
- You want true Material Design compliance
- Accessibility is paramount
- You're comfortable with native code

**Use react-native-android-bottomsheet or custom module from Section 4**

**Advantages:**
- Best Android experience
- Automatic accessibility
- Native gestures and animations

**Disadvantages:**
- Android only
- Requires native development
- More complex setup

---

## Decision Matrix

```
Need TypeScript + Advanced Features?
  YES → react-native-actions-sheet
  NO ↓

Want simplest possible?
  YES → react-native-raw-bottom-sheet
  NO ↓

Need complete control?
  YES → Custom PanResponder
  NO ↓

Android only + Best accessibility?
  YES → Native Android Module
  NO ↓

Just need basic modal?
  → react-native-modal
```

---

## Code Examples Repository

### Official React Native Modal + Animated API
From React Native core documentation:

```javascript
import React, { useState } from 'react';
import { Modal, Animated, View, Button } from 'react-native';

const AnimatedModal = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const showModal = () => {
    setModalVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <>
      <Button title="Show" onPress={showModal} />
      <Modal
        animationType="none"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={{ backgroundColor: 'white' }}>
            {/* Content */}
          </View>
        </Animated.View>
      </Modal>
    </>
  );
};
```

---

## Additional Resources

### Documentation Links
- [React Native Modal API](https://reactnative.dev/docs/modal)
- [React Native Animated API](https://reactnative.dev/docs/animated)
- [React Native PanResponder](https://reactnative.dev/docs/panresponder)
- [react-native-actions-sheet Docs](https://rnas.vercel.app/)
- [react-native-raw-bottom-sheet README](https://github.com/nysamnang/react-native-raw-bottom-sheet)
- [Material Design Bottom Sheets](https://m3.material.io/components/bottom-sheets/overview)

### GitHub Examples
- [Complete PanResponder Implementation](https://gist.github.com/mizanxali/df7bc82a1dadf3723c15603cd385d53b)
- [Simple Bottom Sheet](https://github.com/ruslanzharkov/react-native-bottom-sheet)
- [Shopify Native Component Tutorial](https://shopify.engineering/creating-native-components-accept-react-native-subviews)

### Tutorials
- [CodeDaily: Animated Bottom Sheet without Measuring](https://www.codedaily.io/tutorials/Create-a-Custom-Animated-Bottom-Action-Sheet-without-Measuring-in-React-Native)
- [Medium: BottomSheet with PanResponder](https://andriidrozdov.medium.com/bottomsheet-with-reactnative-receipt-of-duck-soup-e3ded07f2f49)
- [LogRocket: Creating Modal Bottom Sheet](https://blog.logrocket.com/creating-styling-modal-bottom-sheet-react-native/)

---

## Conclusion

For your Android backpack project, given you're looking to replace or avoid Reanimated:

### Primary Recommendation
**react-native-actions-sheet** - Best balance of features, performance, and zero dependencies

### Alternative Recommendations
1. **react-native-raw-bottom-sheet** - If simplicity is paramount
2. **Custom PanResponder** - If you want zero library dependencies
3. **react-native-android-bottomsheet** - If Android-only and accessibility is critical

All solutions work on Android without Reanimated and provide performant, stable bottom sheet implementations.
