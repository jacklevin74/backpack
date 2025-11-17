# React Native Bottom Sheet Libraries - Comprehensive Research Report

**Date:** November 16, 2025
**Project:** Backpack Android
**Current Stack:** React Native 0.81.5, using both `@gorhom/bottom-sheet` v5.2.6 and `@lodev09/react-native-true-sheet` v2.0.6

---

## Executive Summary

Based on extensive research of the React Native ecosystem, here are the key findings:

1. **@gorhom/bottom-sheet** is the market leader with 779,260 weekly downloads (65% market share)
2. **@lodev09/react-native-true-sheet** has significant issues with New Architecture compatibility and Android gesture handling
3. Multiple viable alternatives exist, each with specific trade-offs
4. Custom implementation using Modal + Reanimated is feasible for full control

---

## 1. Popular React Native Bottom Sheet Libraries

### 1.1 @gorhom/bottom-sheet (RECOMMENDED)

**Status:** Active, v5.2.6 (Latest: Sep 2025)
**Downloads:** 779,260/week
**GitHub Stars:** 8,515
**Documentation:** https://gorhom.dev/react-native-bottom-sheet/

#### Pros:
- Market leader with largest community and adoption
- Built with Reanimated v3 & Gesture Handler v2 (latest technologies)
- Excellent performance using native driver animations
- Comprehensive feature set:
  - Smooth gesture interactions & snapping animations
  - Seamless keyboard handling for iOS & Android
  - Pull-to-refresh support for scrollables
  - FlatList, SectionList, ScrollView support
  - React Navigation integration
  - Accessibility support built-in
  - Full TypeScript support
  - Modal and non-modal variants
  - React Native Web support
  - FlashList integration

#### Cons:
- Requires additional setup (GestureHandlerRootView wrapper)
- Larger bundle size due to feature richness
- Steeper learning curve for advanced features
- Requires peer dependencies (Reanimated v3, Gesture Handler v2)

#### Installation:
```bash
yarn add @gorhom/bottom-sheet@^5
yarn add react-native-reanimated react-native-gesture-handler
```

#### Code Example:
```tsx
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Wrap app
<GestureHandlerRootView style={{ flex: 1 }}>
  <BottomSheetModalProvider>
    {/* App content */}
  </BottomSheetModalProvider>
</GestureHandlerRootView>

// Usage
const bottomSheetRef = useRef<BottomSheetModal>(null);
const snapPoints = useMemo(() => ['25%', '50%', '75%'], []);

<BottomSheetModal
  ref={bottomSheetRef}
  index={0}
  snapPoints={snapPoints}
  enableDynamicSizing
>
  <YourContent />
</BottomSheetModal>
```

#### Your Current Status:
You already have v5.2.6 installed in `/Users/wei/projects/backpack-android/android/package.json`

---

### 1.2 @lodev09/react-native-true-sheet (CURRENT - PROBLEMATIC)

**Status:** Active but buggy, v2.0.6 (Latest: 2025)
**Downloads:** Not widely tracked
**GitHub Stars:** 1,200
**Repository:** https://github.com/lodev09/react-native-true-sheet

#### Pros:
- True native BottomSheet implementation (iOS UISheetPresentationController, Android BottomSheetDialog)
- Lightweight
- Simple API
- Good for basic use cases

#### Cons (CRITICAL ISSUES):
- **Android Scrolling Problems** (Most Recent):
  - Issue #210: Unable to scroll up in FlatList/FlashList with RefreshControl (Nov 14, 2025)
  - Issue #207: Can't scroll up inside ScrollView with scrollTo on sheet open (Sep 15, 2025)

- **New Architecture Compatibility**:
  - Issue #163: Android New Architecture no press event (Unresolved since March 2025)
  - Issue #197: "View config not found for component 'TrueSheetView'" on RN 0.77.2 with newArch
  - Issue #12396: Layout issues with react-navigation when New Arch enabled

- **Performance & Rendering Issues**:
  - Issue #182: List components clip when multiple components render together
  - Issue #186: Footer remounts unnecessarily, degrading performance
  - Issue #181: TextInput focus reliability problems on Android (Expo SDK 52, RN 0.76)
  - Issue #135: Pressable items not responding inside TrueSheet on Android

- **Build Problems**:
  - Issue #164: Android build fails with Kotlin compilation errors

- **Platform Issues**:
  - iOS: Crashes on hot reload (issue #205)
  - Android: Gesture handling conflicts, bitmap processing crashes

#### Severity Assessment:
- 34+ open issues with "bug" labels
- Android platform issues dominate (7+ active Android-specific tickets)
- Library needs significant stabilization work, especially for Android

#### Recommendation:
**AVOID for production use on Android** until Android scrolling and New Architecture issues are resolved.

---

### 1.3 react-native-modal

**Status:** Mature, 11 years old
**Downloads:** 427,603/week
**GitHub Stars:** 5,636
**npm:** https://www.npmjs.com/package/react-native-modal

#### Pros:
- Very stable and battle-tested
- Simple API
- Broad use case support (not just bottom sheets)
- Wide community adoption
- No complex dependencies

#### Cons:
- Not specifically designed for bottom sheets
- Requires custom implementation for bottom sheet behavior
- Less performant than libraries using Reanimated
- Limited gesture handling out of the box

#### Use Case:
Good for simple modal implementations where you need basic slide-up behavior without complex gestures.

---

### 1.4 react-native-modalize

**Status:** Less active maintenance
**Downloads:** 37,562/week
**GitHub Stars:** 2,891
**npm:** https://www.npmjs.com/package/react-native-modalize

#### Pros:
- Highly customizable
- Good documentation
- Supports snapping points, handles, and custom animations
- Works well with FlatList and ScrollView

#### Cons:
- Declining popularity (replaced by @gorhom/bottom-sheet in most cases)
- Fewer weekly downloads than competitors
- Less active community support
- May have compatibility issues with newer React Native versions

---

### 1.5 react-native-raw-bottom-sheet

**Status:** Active, v3.0.0+ (Rewritten with Functional Components)
**Downloads:** 25,710/week
**GitHub Stars:** 1,189
**Repository:** https://github.com/nysamnang/react-native-raw-bottom-sheet

#### Pros:
- Lightweight (zero dependencies)
- Simple, straightforward API
- Drag-down gesture support
- Cross-platform (iOS/Android)
- Recently rewritten for better performance (v3.0.0)
- Easy to integrate

#### Cons:
- Limited feature set compared to @gorhom/bottom-sheet
- Smaller community
- Basic animations only
- No advanced gesture handling
- Limited customization options

#### Code Example:
```tsx
import RBSheet from 'react-native-raw-bottom-sheet';

const refRBSheet = useRef();

<RBSheet
  ref={refRBSheet}
  height={300}
  useNativeDriver={true}
  draggable={true}
  customStyles={{
    wrapper: { backgroundColor: 'transparent' },
    draggableIcon: { backgroundColor: '#000' }
  }}
  onOpen={() => console.log('opened')}
  onClose={() => console.log('closed')}
>
  <YourContent />
</RBSheet>
```

#### Use Case:
Good for simple bottom sheets where you don't need complex gestures or animations.

---

### 1.6 reanimated-bottom-sheet (DEPRECATED)

**Status:** No longer maintained (last update 5 years ago)
**Downloads:** 4,981/week
**GitHub Stars:** 3,346

**Recommendation:** DO NOT USE. Use @gorhom/bottom-sheet instead (it's the spiritual successor).

---

## 2. Native Android BottomSheetDialog Implementation

### 2.1 react-native-android-bottomsheet

**Repository:** https://github.com/intergalacticspacehighway/react-native-android-bottomsheet
**Platform:** Android only (uses native BottomSheetDialog)

#### Pros:
- True native Android implementation
- Excellent accessibility (works seamlessly with TalkBack)
- No custom accessibility code needed
- Native performance
- Customizable styling

#### Cons:
- Android-only (requires separate iOS implementation)
- Requires native module bridging knowledge
- Less community support
- Limited cross-platform code reuse

#### Features:
- Collapsible/expandable with configurable peek and max heights
- Drag-to-close and drag-to-expand gestures
- Customizable backdrop dimming
- Nested scroll views and pull-to-refresh support
- Back button dismissal

#### Props:
```tsx
<BottomSheet
  visible={isVisible}
  onDismiss={() => setVisible(false)}
  peekHeight={300}
  maxHeight={windowHeight * 0.8}
  backdimAmount={0.5}
  cancelable={true}
  aria-label="Options menu"
>
  <View style={{ backgroundColor: '#fff' }}>
    <ScrollView nestedScrollEnabled>
      <YourContent />
    </ScrollView>
  </View>
</BottomSheet>
```

#### Use Case:
Only consider if you need true native Android BottomSheetDialog behavior and can maintain separate iOS implementation.

---

### 2.2 react-native-bottom-sheet-behavior (OUTDATED)

**Repository:** https://github.com/cesardeazevedo/react-native-bottom-sheet-behavior

**Status:** Outdated, requires manual `MainApplication.java` setup
**Recommendation:** Avoid - better alternatives exist

---

## 3. Custom Implementation with React Native Modal + Reanimated

### 3.1 Official React Native Reanimated Example

**Documentation:** https://docs.swmansion.com/react-native-reanimated/examples/bottomsheet/
**Last Updated:** 4 days ago (November 2025)

#### Implementation Overview:

```tsx
import { Modal, View, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const BottomSheet = ({ isOpen, toggleSheet, duration = 500, children }) => {
  const height = useSharedValue(0);
  const progress = useDerivedValue(() =>
    withTiming(isOpen.value ? 0 : 1, { duration })
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * 2 * height.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    zIndex: isOpen.value ? 1 : -1,
  }));

  return (
    <Modal transparent statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={toggleSheet}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      <Animated.View
        onLayout={(e) => {
          height.value = e.nativeEvent.layout.height;
        }}
        style={[styles.sheet, sheetStyle]}
      >
        {children}
      </Animated.View>
    </Modal>
  );
};
```

#### Key Features:
- Uses `useSharedValue` for performance (runs on UI thread)
- `useDerivedValue` for interpolation logic
- `withTiming` for smooth animations
- Backdrop opacity animation
- Dynamic height measurement via `onLayout`

---

### 3.2 Custom Implementation with Gesture Handler

**Source:** Medium articles, LogRocket tutorials (November 2025)

#### Advanced Features:
```tsx
import { PanGestureHandler } from 'react-native-gesture-handler';

const BottomSheetWithGestures = () => {
  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      translateY.value = event.translationY + context.value.y;
      translateY.value = Math.max(translateY.value, 0);
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        // Close sheet
        translateY.value = withSpring(SCREEN_HEIGHT);
      } else {
        // Snap to position
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.sheet, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};
```

#### Snap Points Implementation:
```tsx
const SNAP_POINTS = [SCREEN_HEIGHT * 0.1, SCREEN_HEIGHT * 0.5, SCREEN_HEIGHT * 0.9];

.onEnd((event) => {
  const destination = snapPoint(
    translateY.value,
    event.velocityY,
    SNAP_POINTS
  );
  translateY.value = withSpring(destination, { velocity: event.velocityY });
});
```

---

### 3.3 Tutorial: Building from Scratch (LogRocket)

**Source:** https://blog.logrocket.com/creating-styling-modal-bottom-sheet-react-native/

#### Step-by-step Implementation:

1. **Project Setup:**
```bash
npx create-expo-app custom-bottom-sheet
npm install react-native-gesture-handler react-native-reanimated
```

2. **Add Reanimated Plugin to babel.config.js:**
```javascript
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'],
};
```

3. **Create BottomSheet Component:**
- Use `Modal` with `transparent={true}` for overlay
- Implement gesture handling with Pan Responder or Gesture Handler
- Add backdrop with opacity animation
- Handle keyboard avoiding view for inputs

4. **Styling Best Practices:**
```tsx
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 10,
  },
});
```

---

## 4. Performance Considerations & Best Practices

### 4.1 General Performance Guidelines

1. **Use Native Driver:**
```tsx
useNativeDriver: true  // Always enable for better performance
```

2. **Optimize Re-renders:**
```tsx
// Memoize snap points
const snapPoints = useMemo(() => ['25%', '50%', '75%'], []);

// Use shouldComponentUpdate for class components
// Or React.memo for functional components
const MemoizedContent = React.memo(BottomSheetContent);
```

3. **Handle Layout Changes Properly:**
```tsx
const onLayout = useCallback((event) => {
  const { height } = event.nativeEvent.layout;
  sheetHeight.value = height;
}, []);
```

4. **Minimize Shared Value Usage:**
- Only animate CSS properties that can use GPU acceleration
- Prefer `transform` and `opacity` over `width`, `height`, `backgroundColor`

5. **Proper Cleanup:**
```tsx
useEffect(() => {
  return () => {
    // Clean up animations
    cancelAnimation(translateY);
  };
}, []);
```

---

### 4.2 Common Performance Issues

#### Issue: Stuttering animations
**Solution:** Extract current value at gesture start as offset
```tsx
.onStart(() => {
  context.value = { y: translateY.value };
})
.onUpdate((event) => {
  translateY.value = event.translationY + context.value.y;
});
```

#### Issue: Keyboard pushing content
**Solution:** Use KeyboardAvoidingView with proper behavior
```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={100}
>
  {children}
</KeyboardAvoidingView>
```

#### Issue: List performance in bottom sheet
**Solution:** Use FlashList instead of FlatList
```tsx
import { FlashList } from '@shopify/flash-list';

// @gorhom/bottom-sheet supports FlashList integration
<BottomSheetFlashList
  data={items}
  renderItem={renderItem}
  estimatedItemSize={50}
/>
```

---

### 4.3 Android-Specific Performance Issues

1. **Gesture Conflicts:**
   - Use `waitFor` and `simultaneousHandlers` to coordinate gestures
   - Set proper `activeOffsetY` thresholds

2. **Overdraw:**
   - Minimize transparent overlays
   - Use `removeClippedSubviews` for long lists

3. **Memory Management:**
   - Clean up refs properly
   - Avoid memory leaks with proper unmounting

---

## 5. Known Issues with @lodev09/react-native-true-sheet

### Critical Issues (DO NOT USE until resolved):

1. **Scrolling Broken on Android** (Nov 2025):
   - Cannot scroll FlatList/FlashList with RefreshControl
   - ScrollView scroll-to functionality breaks
   - **Impact:** Major usability issue

2. **New Architecture Incompatibility** (March 2025 - Unresolved):
   - Pressable/TouchableOpacity not working on Android
   - View config errors on RN 0.77.2+
   - Navigation integration broken
   - **Impact:** Cannot upgrade to React Native's New Architecture

3. **Performance Issues**:
   - Unnecessary footer remounts
   - List component clipping
   - TextInput focus problems
   - **Impact:** Poor UX, wasted renders

4. **Build Problems**:
   - Kotlin compilation errors on Android
   - **Impact:** May block builds in CI/CD

5. **Platform Instability**:
   - iOS hot reload crashes
   - Android bitmap processing crashes
   - Safe area issues in complex layouts
   - **Impact:** Development friction, production crashes

### Assessment:
The library shows **34+ open bugs** with **7+ Android-specific issues**. It needs significant stabilization before production use, especially on Android.

---

## 6. Comparison Matrix

| Library | Weekly DL | Stars | Android | iOS | Gestures | Performance | Maintenance | New Arch | Complexity |
|---------|-----------|-------|---------|-----|----------|-------------|-------------|----------|-----------|
| @gorhom/bottom-sheet | 779k | 8.5k | Excellent | Excellent | Advanced | Excellent | Active | Yes | Medium |
| react-native-modal | 428k | 5.6k | Good | Good | Basic | Good | Active | Yes | Low |
| react-native-modalize | 38k | 2.9k | Good | Good | Good | Good | Declining | Partial | Medium |
| react-native-raw-bottom-sheet | 26k | 1.2k | Good | Good | Basic | Good | Active | Yes | Low |
| @lodev09/react-native-true-sheet | Low | 1.2k | **BROKEN** | Fair | Native | Fair | Active | **NO** | Medium |
| Custom Modal + Reanimated | N/A | N/A | Excellent | Excellent | Custom | Excellent | Self | Yes | High |
| react-native-android-bottomsheet | Low | Low | Native | N/A | Native | Excellent | Fair | Unknown | High |

---

## 7. Recommendations

### For Your Backpack Android Project:

Given your current setup (RN 0.81.5, both @gorhom/bottom-sheet v5.2.6 and @lodev09/react-native-true-sheet v2.0.6):

#### Immediate Action (CRITICAL):
1. **Remove @lodev09/react-native-true-sheet** due to critical Android bugs
2. **Consolidate on @gorhom/bottom-sheet v5.2.6** - you already have it installed
3. Replace all TrueSheet usages with @gorhom/bottom-sheet

#### Migration Path:

**From TrueSheet:**
```tsx
// OLD (TrueSheet)
import { TrueSheet } from '@lodev09/react-native-true-sheet';

<TrueSheet ref={sheetRef}>
  <Content />
</TrueSheet>

// NEW (@gorhom/bottom-sheet)
import { BottomSheetModal } from '@gorhom/bottom-sheet';

<BottomSheetModal
  ref={sheetRef}
  snapPoints={['50%', '90%']}
  enableDynamicSizing
>
  <Content />
</BottomSheetModal>
```

---

### General Recommendations by Use Case:

#### Best Overall Choice:
**@gorhom/bottom-sheet** - Industry standard, best performance, most features

#### For Simple Use Cases:
**react-native-raw-bottom-sheet** - Lightweight, zero dependencies, easy to use

#### For Full Control:
**Custom Implementation with Modal + Reanimated** - Maximum flexibility, no dependencies

#### Android-Only Native:
**react-native-android-bottomsheet** - True native implementation, excellent accessibility

#### AVOID:
- **@lodev09/react-native-true-sheet** - Critical Android bugs, New Arch incompatible
- **reanimated-bottom-sheet** - Deprecated, use @gorhom instead
- **react-native-modalize** - Declining, replaced by better alternatives

---

## 8. Implementation Examples

### Example 1: Migration from TrueSheet to @gorhom

```tsx
// 1. Update imports
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';

// 2. Wrap app with provider
function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <YourApp />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

// 3. Update component usage
function WalletModal() {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const handleOpen = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      )}
    >
      <BottomSheetView style={styles.contentContainer}>
        <YourContent />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
```

---

### Example 2: Custom Implementation (Minimal Dependencies)

```tsx
import React, { useCallback } from 'react';
import { Modal, View, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function CustomBottomSheet({ visible, onClose, children }) {
  const translateY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        translateY.value = withSpring(SCREEN_HEIGHT, {}, () => {
          runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </Pressable>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.sheet, animatedStyle]}>
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 200,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 10,
  },
});
```

---

## 9. Additional Resources

### Official Documentation:
- @gorhom/bottom-sheet: https://gorhom.dev/react-native-bottom-sheet/
- React Native Reanimated: https://docs.swmansion.com/react-native-reanimated/
- React Native Gesture Handler: https://docs.swmansion.com/react-native-gesture-handler/

### Tutorials:
- LogRocket Custom Implementation: https://blog.logrocket.com/creating-styling-modal-bottom-sheet-react-native/
- React Native Reanimated Bottom Sheet Example: https://docs.swmansion.com/react-native-reanimated/examples/bottomsheet/

### GitHub Issues to Monitor:
- TrueSheet Android Issues: https://github.com/lodev09/react-native-true-sheet/issues
- @gorhom/bottom-sheet Discussions: https://github.com/gorhom/react-native-bottom-sheet/discussions

---

## 10. Conclusion

**For your Backpack Android project:**

1. **Immediately remove** `@lodev09/react-native-true-sheet` due to critical Android scrolling bugs and New Architecture incompatibility

2. **Use @gorhom/bottom-sheet v5.2.6** (already installed) as your primary solution:
   - Industry standard with 779k weekly downloads
   - Excellent Android support
   - Active maintenance and New Architecture ready
   - Best performance and feature set

3. **Consider custom implementation** only if you need:
   - Very specific behavior not supported by @gorhom
   - Minimal bundle size (though the savings are marginal)
   - Full control over every aspect

4. **Migration priority:** HIGH - The Android scrolling issues in TrueSheet are critical and affect core functionality

The React Native ecosystem has clearly converged on @gorhom/bottom-sheet as the best solution for bottom sheets in 2025. Your project is already set up with the right dependency - you just need to migrate away from the problematic TrueSheet implementation.

---

**Report Generated:** November 16, 2025
**Next Steps:**
1. Review this report
2. Plan TrueSheet to @gorhom migration
3. Test thoroughly on Android with your specific use cases (especially scrolling with FlatList/RefreshControl)
4. Remove @lodev09/react-native-true-sheet from package.json after migration complete
