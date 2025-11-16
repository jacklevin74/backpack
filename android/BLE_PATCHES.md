# BLE Library Patches

This document explains the patches applied to the `react-native-ble-plx` library to fix crashes related to Ledger hardware wallet BLE connections.

## Overview

The app uses the `@ledgerhq/react-native-hw-transport-ble` package which depends on `react-native-ble-plx` for Bluetooth Low Energy communication with Ledger hardware wallets. Two critical patches are applied via the `postinstall` script in `package.json` to prevent crashes.

## Patch 1: BlePlxModule.java - Fix Null Error Code

**File**: `node_modules/@ledgerhq/react-native-hw-transport-ble/node_modules/react-native-ble-plx/android/src/main/java/com/bleplx/BlePlxModule.java`

### Problem

The Ledger transport library was calling `safePromise.reject(null, errorConverter.toJs(error))`, passing `null` as the error code. This causes crashes in SafePromise when it attempts to pass the null code to React Native's Promise implementation.

### Solution

```bash
sed -i 's/safePromise\.reject(null, errorConverter\.toJs(error))/safePromise.reject(error.errorCode.name(), errorConverter.toJs(error))/g'
```

This patch replaces the null error code with the actual error code name from the error object:

- **Before**: `safePromise.reject(null, errorConverter.toJs(error))`
- **After**: `safePromise.reject(error.errorCode.name(), errorConverter.toJs(error))`

## Patch 2: SafePromise.java - Add Null Safety Checks

**File**: `node_modules/@ledgerhq/react-native-hw-transport-ble/node_modules/react-native-ble-plx/android/src/main/java/com/bleplx/utils/SafePromise.java`

### Problem

React Native's `PromiseImpl.reject()` requires a non-null error code parameter. When null is passed, it throws:

```
java.lang.NullPointerException: Parameter specified as non-null is null: method com.facebook.react.bridge.PromiseImpl.reject, parameter code
```

This crash occurred even with Patch 1 in place, because other code paths in the BLE library may also pass null error codes.

### Solution

Three separate sed commands add null safety checks to all three `reject()` method overloads:

#### 2a. reject(String code, String message)

```bash
sed -i 's/promise\.reject(code, message)/promise.reject(code == null ? "UNKNOWN_ERROR" : code, message)/g'
```

- **Before**: `promise.reject(code, message);`
- **After**: `promise.reject(code == null ? "UNKNOWN_ERROR" : code, message);`

#### 2b. reject(String code, Throwable e)

```bash
sed -i 's/promise\.reject(code, e)/promise.reject(code == null ? "UNKNOWN_ERROR" : code, e)/g'
```

- **Before**: `promise.reject(code, e);`
- **After**: `promise.reject(code == null ? "UNKNOWN_ERROR" : code, e);`

#### 2c. reject(String code, String message, Throwable e)

```bash
sed -i 's/promise\.reject(code, message, e)/promise.reject(code == null ? "UNKNOWN_ERROR" : code, message, e)/g'
```

- **Before**: `promise.reject(code, message, e);`
- **After**: `promise.reject(code == null ? "UNKNOWN_ERROR" : code, message, e);`

## How Patches Are Applied

The patches are automatically applied via the `postinstall` script in `package.json` which runs after `npm install`:

```json
"postinstall": "sed -i 's/safePromise\\.reject(null, errorConverter\\.toJs(error))/safePromise.reject(error.errorCode.name(), errorConverter.toJs(error))/g' node_modules/@ledgerhq/react-native-hw-transport-ble/node_modules/react-native-ble-plx/android/src/main/java/com/bleplx/BlePlxModule.java 2>/dev/null || true; sed -i 's/promise\\.reject(code, message)/promise.reject(code == null ? \"UNKNOWN_ERROR\" : code, message)/g' node_modules/@ledgerhq/react-native-hw-transport-ble/node_modules/react-native-ble-plx/android/src/main/java/com/bleplx/utils/SafePromise.java 2>/dev/null || true; sed -i 's/promise\\.reject(code, e)/promise.reject(code == null ? \"UNKNOWN_ERROR\" : code, e)/g' node_modules/@ledgerhq/react-native-hw-transport-ble/node_modules/react-native-ble-plx/android/src/main/java/com/bleplx/utils/SafePromise.java 2>/dev/null || true; sed -i 's/promise\\.reject(code, message, e)/promise.reject(code == null ? \"UNKNOWN_ERROR\" : code, message, e)/g' node_modules/@ledgerhq/react-native-hw-transport-ble/node_modules/react-native-ble-plx/android/src/main/java/com/bleplx/utils/SafePromise.java 2>/dev/null || true"
```

The `2>/dev/null || true` ensures the script continues even if a file is not found (e.g., during initial install before node_modules exists).

## Impact

These patches prevent the app from crashing when:

- Ledger device disconnects unexpectedly
- BLE connection errors occur
- Any other BLE operation fails with a null error code

Instead of crashing, errors are now properly handled with the error code "UNKNOWN_ERROR" when the original error code is null.

## Testing

After applying these patches:

1. Run `npm install` to apply the patches
2. Rebuild the Android app with `./gradlew assembleRelease` or `./gradlew assembleDebug`
3. Test Ledger connectivity including:
   - Normal connection/disconnection
   - Unexpected disconnections (turning off device, moving out of range)
   - Transaction signing flows

## Alternative Approaches Considered

1. **Using patch-package**: Would create cleaner patch files, but requires additional dependency
2. **Forking the library**: Would require maintaining a fork and keeping it updated
3. **Submitting upstream PRs**: Long-term solution, but doesn't help immediately

The current sed-based approach in postinstall is simple, doesn't require additional dependencies, and automatically applies on every `npm install`.
