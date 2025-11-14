# Ledger BLE Connection Fix for React Native 0.81+ / Expo SDK 54+

## Problem Overview

This document describes the fixes applied to resolve Ledger Bluetooth Low Energy (BLE) connection crashes on Android when using React Native 0.81+ and Expo SDK 54+.

### Issues Encountered

1. **Second Connection Crash**: App crashes when attempting to connect to Ledger a second time
2. **BLE Disconnect Crashes**: NullPointerException when BLE devices disconnect unexpectedly
3. **RxJava Thread Cleanup**: Race conditions between Hermes garbage collection and BLE RxJava threads

## Root Causes

### 1. Component Unmount During Scan Initialization

**Location**: `App.js:781-804` (`scanForLedger` function)

**Problem**: The original code called `await cleanupLedgerBLE()` at the start of each scan, which included a 5-second delay to allow the BLE stack to fully cleanup. This long delay caused the component to remount/unmount, triggering cleanup handlers and crashing the app.

```javascript
// BEFORE (caused crashes):
const scanForLedger = async () => {
  await cleanupLedgerBLE(); // 5-second delay here!
  // ... rest of scan logic
};
```

**Solution**: Only unsubscribe from existing scan subscriptions (instant, no delay) instead of full cleanup.

```javascript
// AFTER (fixed):
const scanForLedger = async () => {
  if (ledgerScanSubscriptionRef.current) {
    ledgerScanSubscriptionRef.current.unsubscribe();
    ledgerScanSubscriptionRef.current = null;
  }
  // Reset flags for fresh cleanup when needed
  ledgerCleanedUpRef.current = false;
  ledgerCleaningRef.current = false;
  // ... rest of scan logic
};
```

### 2. React Native Promise Bridge Null Error Codes

**Location**: `node_modules/@ledgerhq/react-native-hw-transport-ble/node_modules/react-native-ble-plx/android/src/main/java/com/bleplx/BlePlxModule.java`

**Problem**: The react-native-ble-plx library (v3.4.0) calls `Promise.reject(null, ...)` when BLE errors occur. React Native 0.81+ requires the first parameter (error code) to be a non-null string, causing NullPointerExceptions.

```java
// BEFORE (caused crashes):
safePromise.reject(null, errorConverter.toJs(error));
```

**Solution**: Use the actual BLE error code name instead of null.

```java
// AFTER (fixed):
safePromise.reject(error.errorCode.name(), errorConverter.toJs(error));
```

This fix was applied to all 17 instances in `BlePlxModule.java`.

**Reference**: [react-native-ble-plx Issue #1303](https://github.com/dotintent/react-native-ble-plx/issues/1303)

### 3. Ledger Transport Version Compatibility

**Problem**: Versions ≥ 6.36.0 of `@ledgerhq/react-native-hw-transport-ble` reintroduced race conditions under Hermes that were fixed in earlier versions.

**Solution**: Downgraded to v6.35.0, which is in the safe version range (6.33.0 - 6.35.0).

## Implementation Details

### Automatic Patch Application

To ensure the native code fix persists after `npm install`, a postinstall script was added to `package.json`:

```json
{
  "scripts": {
    "postinstall": "sed -i 's/safePromise\\.reject(null, errorConverter\\.toJs(error))/safePromise.reject(error.errorCode.name(), errorConverter.toJs(error))/g' node_modules/@ledgerhq/react-native-hw-transport-ble/node_modules/react-native-ble-plx/android/src/main/java/com/bleplx/BlePlxModule.java 2>/dev/null || true"
  }
}
```

### Cleanup Strategy

The fix implements a proper cleanup lifecycle:

1. **During Scan**: Only unsubscribe from previous scan subscription (instant)
2. **After Connection**: Keep transport alive for account selection
3. **After Account Selection**: Clean up BLE connection in background
4. **On Component Unmount**: Final cleanup with proper error handling

### Error Codes Now Available

With the patch applied, JavaScript code can now properly catch and handle BLE errors:

- `BLUETOOTH_DISABLED`
- `DEVICE_DISCONNECTED`
- `SCAN_FAILED`
- `CONNECTION_FAILED`
- `CHARACTERISTIC_WRITE_FAILED`
- And more...

## Files Modified

### 1. `App.js`

- **Lines 781-804**: Modified `scanForLedger()` to remove cleanup delay
- **Lines 722-778**: Improved `cleanupLedgerBLE()` with proper guards
- **Lines 226-242**: Component unmount cleanup handler

### 2. `package.json`

- Added `postinstall` script for automatic patch application
- Downgraded `@ledgerhq/react-native-hw-transport-ble` to `6.35.0`
- Added `patch-package` as dev dependency

### 3. `package-lock.json`

- Updated dependency tree to reflect version changes

## Testing Recommendations

After applying these fixes, test the following scenarios:

1. **First Connection**: Connect Ledger → Select account → Verify account loads
2. **Second Connection**: Connect Ledger again → Should not crash
3. **Multiple Connections**: Connect/disconnect multiple times rapidly
4. **Device Disconnect**: Disconnect Ledger during scan → Should show error gracefully
5. **Bluetooth Toggle**: Turn Bluetooth off during connection → Should handle error

## Known Limitations

1. **Platform Specific**: Fix only applies to Android (iOS uses different BLE implementation)
2. **Transitive Dependency**: The patched library is nested inside `@ledgerhq/react-native-hw-transport-ble`, so patch-package cannot be used directly
3. **Rebuild Required**: Changes to native code require Android rebuild (`npx expo run:android`)

## Future Considerations

### Option 1: Wait for Official Fix

Monitor [react-native-ble-plx PR #1304](https://github.com/dotintent/react-native-ble-plx/pull/1304) for official fix to be merged and released.

### Option 2: Fork and Patch

Create a fork of react-native-ble-plx with the fix and use it directly:

```json
{
  "dependencies": {
    "react-native-ble-plx": "github:your-org/react-native-ble-plx#fixed-branch"
  }
}
```

### Option 3: Upgrade React Native

If upgrading to React Native 0.76+ is feasible, Hermes improvements may resolve the issue:

```json
{
  "dependencies": {
    "react-native": "0.76.0"
  }
}
```

## Troubleshooting

### If the patch doesn't apply automatically:

1. Manually run the postinstall script:

```bash
npm run postinstall
```

2. Verify the patch was applied:

```bash
grep -n "error.errorCode.name()" node_modules/@ledgerhq/react-native-hw-transport-ble/node_modules/react-native-ble-plx/android/src/main/java/com/bleplx/BlePlxModule.java
```

You should see 17 matches.

### If crashes still occur:

1. Clean Android build:

```bash
cd android
./gradlew clean
cd ..
```

2. Rebuild native modules:

```bash
npx expo run:android
```

3. Check logs for specific error:

```bash
adb logcat | grep -i "ble\|ledger\|promise"
```

## References

- [react-native-ble-plx Issue #1303](https://github.com/dotintent/react-native-ble-plx/issues/1303)
- [react-native-ble-plx PR #1304](https://github.com/dotintent/react-native-ble-plx/pull/1304)
- [React Native Promise Bridge Documentation](https://reactnative.dev/docs/native-modules-android#promises)
- [Ledger Transport BLE Safe Versions](https://github.com/LedgerHQ/ledger-live/issues)

## Version Compatibility

| Package                                 | Version  | Status            |
| --------------------------------------- | -------- | ----------------- |
| react-native                            | 0.81.5   | ✅ Tested         |
| expo                                    | ~54.0.23 | ✅ Tested         |
| @ledgerhq/react-native-hw-transport-ble | 6.35.0   | ✅ Safe           |
| react-native-ble-plx                    | 3.4.0    | ⚠️ Requires patch |

## Credits

- Fix discovered by community developers working on Backpack wallet clones
- Patch adapted from [dotintent/react-native-ble-plx#1303](https://github.com/dotintent/react-native-ble-plx/issues/1303)
- Implementation by Claude Code
