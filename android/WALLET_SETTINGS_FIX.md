# Wallet Settings Private Key & Seed Phrase Fix

## Issue

After converting sheets to TrueSheet, the "Show Private Key" and "Show Seed Phrase" buttons in wallet settings were not working. The respective sheets would not open when clicked.

## Root Cause

1. **PanResponder blocking touches**: The `SimpleActionSheet` component had a `PanResponder` attached to the entire sheet container with `onStartShouldSetPanResponder: () => true`, which was intercepting all touch events and preventing child `TouchableOpacity` components from receiving press events.

2. **Wrong component being modified**: There were two different wallet settings implementations:

   - `editWalletSheetRef` in App.js (old implementation, not being used)
   - `walletSettingsSheetRef` with `WalletSettingsScreen` component (actual implementation being used)

   Initial debugging was done on the wrong component.

3. **Missing state setup**: The `editingWallet` state was not being set before opening the Private Key sheet, causing the sheet to render empty.

## Solution

### 1. Fixed PanResponder Touch Blocking (`components/SimpleActionSheet.js`)

- Moved `PanResponder` handlers from the entire sheet container to just the grabber area
- Changed from:
  ```javascript
  <Animated.View {...panResponder.panHandlers} style={[...]}>
    {grabber && <View style={styles.grabberContainer}>...</View>}
    {children}
  </Animated.View>
  ```
- To:
  ```javascript
  <Animated.View style={[...]}>
    {grabber && <View {...panResponder.panHandlers} style={styles.grabberContainer}>...</View>}
    {children}
  </Animated.View>
  ```
- Also added `onStartShouldSetPanResponderCapture: () => false` for additional safety

### 2. Converted Seed Phrase Sheet to TrueSheet (`App.js`)

- Changed from `BottomSheet` to `TrueSheet` with appropriate props
- Changed `BottomSheetView` to `View`
- Updated `seedPhraseSheetRef.current?.expand()` to `.present()`
- Updated `seedPhraseSheetRef.current?.close()` to `.dismiss()`

### 3. Connected WalletSettingsScreen to Private Key & Seed Phrase Sheets (`App.js`)

- Added `onShowPrivateKey` and `onShowSeedPhrase` props to `WalletSettingsScreen`:
  ```javascript
  <WalletSettingsScreen
    onDismiss={() => walletSettingsSheetRef.current?.dismiss()}
    onShowPrivateKey={() => {
      setEditingWallet(selectedWallet);
      walletSettingsSheetRef.current?.dismiss();
      setTimeout(() => {
        privateKeySheetRef.current?.present();
      }, 300);
    }}
    onShowSeedPhrase={() => {
      setEditingWallet(selectedWallet);
      walletSettingsSheetRef.current?.dismiss();
      setTimeout(() => {
        openSeedPhraseSheet();
      }, 300);
    }}
  />
  ```

### 4. Updated WalletSettingsScreen Component (`screens/WalletSettingsScreen.js`)

- Added `onShowPrivateKey` and `onShowSeedPhrase` parameters to component props
- Updated both "Show Private Key" and "Show Seed Phrase" buttons to call their respective callbacks:
  ```javascript
  onPress={() => {
    if (onShowPrivateKey) {  // or onShowSeedPhrase
      onShowPrivateKey();   // or onShowSeedPhrase()
    } else {
      onDismiss();
    }
  }}
  ```

## Testing

After the fix:

**Private Key:**

1. Open wallet settings by tapping the ⋮ menu
2. Tap "Show Private Key"
3. ✅ Wallet Settings sheet closes
4. ✅ Private Key sheet opens with the correct private key displayed
5. ✅ Copy button works
6. ✅ Drag-to-dismiss still works from the grabber bar

**Seed Phrase:**

1. Open wallet settings by tapping the ⋮ menu
2. Tap "Show Seed Phrase"
3. ✅ Wallet Settings sheet closes
4. ✅ Seed Phrase sheet opens with the correct seed phrase displayed
5. ✅ Copy button works
6. ✅ Drag-to-dismiss still works from the grabber bar

## Files Modified

- `components/SimpleActionSheet.js` - Fixed PanResponder touch handling
- `App.js` - Converted Seed Phrase sheet to TrueSheet, connected WalletSettingsScreen to Private Key and Seed Phrase sheets
- `screens/WalletSettingsScreen.js` - Added onShowPrivateKey and onShowSeedPhrase callback support

## Date

2025-11-17
