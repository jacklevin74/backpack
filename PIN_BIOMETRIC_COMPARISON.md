# PIN/Biometric Authentication Implementation Comparison

## 1. Overview

### Current Implementation (Feature Branch: android/)

Located in `/home/jack/backpack/android/src/auth/`, this is a React Native implementation using Expo libraries. It features a custom-built PIN pad UI with specialized components and uses `expo-secure-store` for secure storage.

**Key files:**

- `AuthManager.js` - Core authentication logic
- `PinUnlock.js` - PIN unlock screen component
- `PinSetup.js`, `ChangePin.js` - PIN management UIs
- `BiometricSettings.js` - Biometric management UI
- `PinPad.js`, `PinDots.js`, `Toast.js` - Custom UI components

**Technology Stack:**

- `expo-secure-store` for secure storage
- `expo-local-authentication` for biometrics
- `@noble/hashes` for cryptographic operations
- Custom React Native UI components

### PR-4 Implementation (packages/mobile-wallet/)

Located in the PR commit `b0f72e56`, this is a TypeScript-based implementation integrated into a monolithic `App.tsx` file using React Native Keychain for secure storage.

**Key files:**

- `AuthManager.ts` - Core authentication logic (TypeScript)
- `App.tsx` - Integrated UI with unlock screen included

**Technology Stack:**

- `react-native-keychain` for secure storage
- `crypto-browserify` for cryptographic operations
- Standard React Native TextInput for PIN entry
- TypeScript for type safety

---

## 2. Key Differences

### Architectural Approach

**Current Implementation:**

- Modular component-based architecture
- Separation of concerns with dedicated UI components (`PinUnlock.js`, `PinSetup.js`, etc.)
- Reusable authentication manager as a standalone module
- Custom UI components for enhanced UX (`PinPad`, `PinDots`, `Toast`)

**PR-4 Implementation:**

- Monolithic approach with authentication UI embedded in main `App.tsx`
- Single AuthManager class handling all security operations
- Standard React Native components (TextInput) for PIN entry
- Type-safe implementation with TypeScript

### Language & Type Safety

| Aspect      | Current              | PR-4                                       |
| ----------- | -------------------- | ------------------------------------------ |
| Language    | JavaScript           | TypeScript                                 |
| Type Safety | Runtime validation   | Compile-time type checking                 |
| Interfaces  | Implicit             | Explicit (`PinConfig`, `LockState`)        |
| Error Types | Custom error classes | Custom error classes with typed properties |

---

## 3. Storage & Security

### Secure Storage Libraries

**Current Implementation: expo-secure-store**

```javascript
// Storing PIN configuration
await SecureStore.setItemAsync(PIN_CONFIG_KEY, JSON.stringify(config));

// Storing password with biometric protection
await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password, {
  requireAuthentication: true,
});
```

**Benefits:**

- Simple key-value API
- Built-in biometric authentication via options
- Expo ecosystem integration
- Automatic encryption on both iOS and Android

**PR-4 Implementation: react-native-keychain**

```typescript
// Storing PIN configuration with service identifier
await Keychain.setGenericPassword("pin", JSON.stringify(config), {
  service: PIN_CONFIG_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

// Storing password with biometric protection
await Keychain.setGenericPassword("wallet", password, {
  service: BIOMETRIC_KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
});
```

**Benefits:**

- Fine-grained access control options
- Service-based isolation (multiple keychain entries)
- Platform-native keychain integration
- Explicit accessibility levels

### Storage Keys/Services

**Current Implementation:**

```javascript
const PIN_CONFIG_KEY = "pin_config";
const MASTER_PASSWORD_KEY = "master_password";
const BIOMETRIC_PASSWORD_KEY = "biometric_password";
const BIOMETRIC_PREFERENCE_KEY = "@wallet:biometricPreference";
const LOCK_STATE_KEY = "@wallet:pinLockState";
```

**PR-4 Implementation:**

```typescript
const PIN_CONFIG_SERVICE = "com.coralxyz.backpack.mobilewallet.pinconfig";
const MASTER_PASSWORD_SERVICE =
  "com.coralxyz.backpack.mobilewallet.masterpassword";
const BIOMETRIC_KEYCHAIN_SERVICE =
  "com.coralxyz.backpack.mobilewallet.masterpassword.biometric";
const BIOMETRIC_PREFERENCE_KEY = "@wallet:biometricPreference";
const LOCK_STATE_KEY = "@wallet:pinLockState";
```

PR-4 uses reverse domain notation for keychain services, providing better namespace isolation.

---

## 4. Biometric Integration

### Biometric Support Detection

**Current Implementation:**

```javascript
static async isBiometricSupported() {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  } catch (error) {
    console.error("isBiometricSupported error:", error);
    return false;
  }
}
```

**PR-4 Implementation:**

```typescript
static async isBiometricSupported(): Promise<boolean> {
  const type = await Keychain.getSupportedBiometryType();
  return Boolean(type);
}
```

**Difference:** Current implementation explicitly checks both hardware availability and enrollment status, while PR-4 relies on Keychain's single type check.

### Biometric Authentication Flow

**Current Implementation:**

```javascript
static async unlockWithBiometrics() {
  const biometricEnabled = await AuthManager.isBiometricEnabled();
  if (!biometricEnabled) {
    throw new Error("Biometrics not enabled");
  }

  // SecureStore will automatically trigger biometric authentication
  // because the password was stored with requireAuthentication: true
  const password = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY, {
    requireAuthentication: true,
    authenticationPrompt: "Authenticate to unlock X1 Wallet",
  });

  if (!password) {
    throw new Error("Biometric password not found");
  }

  await AuthManager.clearLockState();
  return password;
}
```

**PR-4 Implementation:**

```typescript
static async unlockWithBiometrics(): Promise<string> {
  const biometricEnabled = await AuthManager.isBiometricEnabled();
  if (!biometricEnabled) {
    throw new Error('Biometrics not enabled');
  }

  const credentials = await Keychain.getGenericPassword({
    service: BIOMETRIC_KEYCHAIN_SERVICE,
    authenticationPrompt: {
      title: 'Authenticate to unlock backpack',
      description: 'Use biometrics to restore wallet access',
    },
  });

  if (!credentials) {
    throw new Error('Biometric authentication was cancelled');
  }

  await AuthManager.clearLockState();
  return credentials.password;
}
```

**Key Differences:**

- PR-4 provides a structured authentication prompt with title and description
- PR-4 returns a credentials object (username/password pair)
- Current implementation uses simpler string-based prompt

---

## 5. PIN Handling

### KDF Iterations - CRITICAL DIFFERENCE

**Current Implementation:**

```javascript
const PIN_KDF_ITERATIONS = 10_000; // Reduced for mobile performance
```

**PR-4 Implementation:**

```typescript
const PIN_KDF_ITERATIONS = 250_000;
```

**Security Analysis:**

- PR-4 uses **25x more iterations** (250,000 vs 10,000)
- Higher iterations = more resistance to brute-force attacks
- Trade-off: PR-4 will have slower PIN setup/verification
- Current implementation prioritizes performance over security

### PBKDF2 Implementation

**Current Implementation:**

```javascript
static async derivePinHash(pin, salt, iterations) {
  // Use @noble/hashes for PBKDF2 (React Native compatible)
  const saltBytes = salt instanceof Uint8Array ? salt : Buffer.from(salt);
  const hash = pbkdf2(sha256, pin, saltBytes, { c: iterations, dkLen: 32 });
  return Buffer.from(hash);
}
```

**PR-4 Implementation:**

```typescript
private static async derivePinHash(
  pin: string,
  salt: Uint8Array,
  iterations: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    Crypto.pbkdf2(pin, Buffer.from(salt), iterations, 32, 'sha256', (err: Error, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}
```

**Differences:**

- Current: Synchronous operation using `@noble/hashes`
- PR-4: Async callback-based using `crypto-browserify`
- Current: More modern, promise-based approach
- PR-4: Traditional Node.js crypto API

### PIN Verification - Timing Safety

**Current Implementation:**

```javascript
static async verifyPin(pin, config) {
  const salt = Buffer.from(config.salt, "base64");
  const expectedHash = Buffer.from(config.hash, "base64");
  const derived = await AuthManager.derivePinHash(pin, salt, config.iterations);

  // Timing-safe comparison
  if (expectedHash.length !== derived.length) {
    throw new Error("Invalid PIN");
  }

  let mismatch = 0;
  for (let i = 0; i < expectedHash.length; i++) {
    mismatch |= expectedHash[i] ^ derived[i];
  }

  if (mismatch !== 0) {
    throw new Error("Invalid PIN");
  }
}
```

**PR-4 Implementation:**

```typescript
private static async verifyPin(pin: string, config: PinConfig): Promise<void> {
  const salt = Buffer.from(config.salt, 'base64');
  const expectedHash = Buffer.from(config.hash, 'base64');
  const derived = await AuthManager.derivePinHash(pin, salt, config.iterations);
  if (
    expectedHash.length !== derived.length ||
    !Crypto.timingSafeEqual(expectedHash, derived)
  ) {
    throw new Error('Invalid PIN');
  }
}
```

**Analysis:**

- Current: Manual constant-time comparison implementation
- PR-4: Uses built-in `Crypto.timingSafeEqual()`
- Both are timing-safe, but PR-4's approach is more concise and leverages native implementation
- Current implementation is more portable (doesn't require crypto module)

---

## 6. UI/UX Differences

### PIN Input Interface

**Current Implementation: Custom PIN Pad**

Located in `/home/jack/backpack/android/src/auth/PinUnlock.js`:

```javascript
<View style={styles.container}>
  <View style={styles.header}>
    <Text style={styles.title}>Enter PIN</Text>
    <Text style={styles.subtitle}>
      {lockoutMs > 0
        ? `Locked for ${formatLockoutTime(lockoutMs)}`
        : "Enter your 6-digit PIN to unlock"}
    </Text>
  </View>

  <PinDots length={6} filled={pin.length} />

  {biometricAvailable && lockoutMs === 0 && (
    <TouchableOpacity
      style={styles.biometricButton}
      onPress={handleBiometric}
      activeOpacity={0.6}
    >
      <Image
        source={require("../../assets/fingerprint.png")}
        style={styles.fingerprintImage}
      />
    </TouchableOpacity>
  )}

  <PinPad onNumberPress={handleNumberPress} onBackspace={handleBackspace} />
</View>
```

**Features:**

- Custom numeric keypad component (`PinPad`)
- Visual feedback with animated dots (`PinDots`)
- Integrated fingerprint button with icon
- Auto-submission when 6 digits entered
- Toast notifications for feedback
- Formatted lockout timer display

**PR-4 Implementation: TextInput-based**

Located in `App.tsx`:

```typescript
<View style={styles.centered}>
  <Text style={styles.title}>Welcome Back</Text>
  <Text style={styles.label}>
    {lockoutSeconds
      ? `Too many attempts. Try again in ${lockoutSeconds}s`
      : 'Enter PIN'}
  </Text>
  <TextInput
    style={styles.input}
    placeholder="6-digit PIN"
    value={pinEntry}
    onChangeText={setPinEntry}
    keyboardType="number-pad"
    secureTextEntry
    maxLength={6}
    editable={!lockoutSeconds}
  />
  <TouchableOpacity
    style={[styles.button, lockoutSeconds && styles.disabledButton]}
    onPress={handlePinUnlock}
    disabled={Boolean(lockoutSeconds)}>
    <Text style={styles.buttonText}>Unlock</Text>
  </TouchableOpacity>
  {biometricsEnabled && (
    <TouchableOpacity style={styles.buttonSecondary} onPress={handleBiometricUnlock}>
      <Text style={styles.buttonText}>Use Biometrics</Text>
    </TouchableOpacity>
  )}
</View>
```

**Features:**

- Standard TextInput with number-pad keyboard
- Manual submission via button press
- Separate biometric button below
- Simple lockout timer in seconds
- Uses native Alert dialogs

### UX Comparison Table

| Feature               | Current Implementation            | PR-4 Implementation          |
| --------------------- | --------------------------------- | ---------------------------- |
| PIN Entry             | Custom PIN pad with large buttons | Native keyboard (number-pad) |
| Visual Feedback       | Animated dots showing progress    | Hidden text in TextInput     |
| Biometric Access      | Inline fingerprint button         | Separate button below        |
| Auto-Submit           | Yes, at 6 digits                  | No, requires unlock button   |
| Error Display         | Toast notifications               | Alert dialogs                |
| Lockout Display       | Formatted timer (MM:SS)           | Simple seconds counter       |
| User Guidance         | Subtitle with instructions        | Label text                   |
| Double-tap Prevention | Reference-based guard             | Standard state management    |

---

## 7. Error Handling

### Failed Attempt Tracking

**Both implementations are identical:**

```javascript
// Current
static async registerFailedAttempt() {
  const state = await AuthManager.getLockState();
  const failedAttempts = state.failedAttempts + 1;
  let lockUntil = null;

  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    const tier = Math.min(
      LOCK_WINDOWS_MS.length - 1,
      Math.floor((failedAttempts - MAX_FAILED_ATTEMPTS) / MAX_FAILED_ATTEMPTS)
    );
    lockUntil = Date.now() + LOCK_WINDOWS_MS[tier];
  }

  await AuthManager.saveLockState({ failedAttempts, lockUntil });
}
```

**Lockout Windows:** `[30_000, 120_000, 600_000]` (30s, 2min, 10min)

**Max Attempts Before Lockout:** 5

### Biometric Error Handling

**Current Implementation:**

```javascript
handleBiometric = async () => {
  // Prevent double-activation using ref (synchronous check)
  if (isAuthenticatingRef.current) {
    console.log("Biometric authentication already in progress, ignoring tap");
    return;
  }

  try {
    isAuthenticatingRef.current = true;
    setError("");
    // Add delay to ensure activity is fully ready and UI is stable
    await new Promise((resolve) => setTimeout(resolve, 500));
    const password = await AuthManager.unlockWithBiometrics();
    onUnlock(password);
  } catch (err) {
    if (err.message && err.message.includes("activity no longer available")) {
      setError("Please try again");
      setToast({
        visible: true,
        message: "Authentication unavailable, please try again",
        type: "error",
      });
    } else if (err.message && err.message.includes("cancelled")) {
      // User cancelled, don't show error
      setError("");
    } else {
      setError(err.message || "Biometric authentication failed");
      setToast({
        visible: true,
        message: "Authentication failed",
        type: "error",
      });
    }
  } finally {
    isAuthenticatingRef.current = false;
  }
};
```

**Advanced Features:**

- Double-tap prevention mechanism
- 500ms delay for activity stabilization
- Specific handling for "activity no longer available" error
- Silent handling of user cancellation
- Toast notifications for visual feedback

**PR-4 Implementation:**

```typescript
const handleBiometricUnlock = async () => {
  try {
    const password = await AuthManager.unlockWithBiometrics();
    await unlockWithSecret(password);
  } catch (error: any) {
    Alert.alert("Error", error.message || "Biometric authentication failed");
  }
};
```

**Simpler approach:**

- Basic try-catch with Alert
- No double-tap prevention
- No specific error case handling
- Uses native Alert dialogs

---

## 8. Pros and Cons

### Current Implementation (android/)

**Pros:**

1. **Superior UX**: Custom PIN pad provides banking-app-like experience
2. **Visual Feedback**: Animated dots and toast notifications enhance usability
3. **Modern Crypto**: Uses `@noble/hashes`, a modern, well-audited library
4. **Modular Architecture**: Easy to maintain, test, and reuse components
5. **Expo Integration**: Simpler dependency management within Expo ecosystem
6. **Better Error Handling**: Granular biometric error handling with user-friendly messages
7. **Performance Optimized**: Lower KDF iterations (10,000) for faster mobile experience
8. **Auto-Submit**: Streamlined flow with automatic submission at 6 digits

**Cons:**

1. **Lower Security**: 10,000 KDF iterations is less secure than industry standards
2. **JavaScript**: No compile-time type safety
3. **More Code**: More files and components to maintain
4. **Expo Dependency**: Locked into Expo ecosystem
5. **Custom Components**: More code to maintain and potential for bugs

### PR-4 Implementation (packages/mobile-wallet/)

**Pros:**

1. **Higher Security**: 250,000 KDF iterations provides strong brute-force protection
2. **Type Safety**: TypeScript provides compile-time error checking
3. **Native Keychain**: Uses platform-native security features with fine-grained control
4. **Simpler Codebase**: Fewer files, more straightforward to understand
5. **Service Isolation**: Reverse domain notation provides better namespace management
6. **Built-in Timing Safety**: Uses crypto module's native `timingSafeEqual()`
7. **Explicit Access Control**: Keychain accessibility levels are clearly defined

**Cons:**

1. **Poor UX**: Standard TextInput is less intuitive than custom PIN pad
2. **Manual Submit**: Requires pressing unlock button (extra tap)
3. **Monolithic**: Authentication UI mixed with main app logic
4. **Basic Error Handling**: Simple Alert dialogs, no sophisticated error recovery
5. **Performance Impact**: 250,000 iterations may cause noticeable delay on older devices
6. **No Visual Feedback**: Hidden TextInput provides no visual indication of progress
7. **Additional Dependency**: Requires `react-native-keychain` native module

---

## 9. Technical Implementation Details

### Dependency Comparison

**Current Implementation:**

```json
{
  "@react-native-async-storage/async-storage": "^1.x",
  "expo-secure-store": "^12.x",
  "expo-local-authentication": "^13.x",
  "@noble/hashes": "^1.x",
  "tweetnacl": "^1.x"
}
```

**PR-4 Implementation:**

```json
{
  "@react-native-async-storage/async-storage": "^1.x",
  "react-native-keychain": "^8.x",
  "crypto-browserify": "^3.x",
  "tweetnacl": "^1.x"
}
```

### Storage Structure Comparison

**Current Implementation:**

SecureStore entries:

- `pin_config` → `{ salt, hash, iterations }`
- `master_password` → `<password_string>`
- `biometric_password` → `<password_string>` (with requireAuthentication)

AsyncStorage entries:

- `@wallet:biometricPreference` → `"true"` | `"false"`
- `@wallet:pinLockState` → `{ failedAttempts, lockUntil }`

**PR-4 Implementation:**

Keychain services:

- `com.coralxyz.backpack.mobilewallet.pinconfig` → `{ username: "pin", password: "<config_json>" }`
- `com.coralxyz.backpack.mobilewallet.masterpassword` → `{ username: "wallet", password: "<password>" }`
- `com.coralxyz.backpack.mobilewallet.masterpassword.biometric` → `{ username: "wallet", password: "<password>" }` (with BIOMETRY_CURRENT_SET)

AsyncStorage entries:

- `@wallet:biometricPreference` → `"true"` | `"false"`
- `@wallet:pinLockState` → `{ failedAttempts, lockUntil }`

### Platform-Specific Considerations

**Current Implementation (Expo):**

- iOS: Uses Keychain Services
- Android: Uses EncryptedSharedPreferences (API 23+) or Keystore
- Abstraction handled by Expo

**PR-4 Implementation (react-native-keychain):**

- iOS: Direct Keychain Services access with accessibility levels
- Android: Uses Android Keystore system
- More control but requires native module linking

### Code Complexity Metrics

| Metric             | Current       | PR-4               |
| ------------------ | ------------- | ------------------ |
| Total Lines (Auth) | ~850 lines    | ~350 lines         |
| Number of Files    | 8+ files      | 2 files            |
| TypeScript         | No            | Yes                |
| Component Count    | 6+ components | Integrated in main |
| API Surface        | Larger        | Smaller            |

---

## 10. Recommendations

### Security Priority

If **maximum security** is the priority:

- **Choose PR-4**: 250,000 KDF iterations provides significantly better protection
- However, consider testing performance on low-end devices

### User Experience Priority

If **best UX** is the priority:

- **Choose Current**: Custom PIN pad, auto-submit, and visual feedback provide superior experience
- But increase KDF iterations to at least 100,000

### Hybrid Approach (Recommended)

Combine the best of both:

1. **Keep Current's UI/UX**:

   - Custom PIN pad and dots
   - Auto-submit functionality
   - Toast notifications
   - Advanced biometric error handling

2. **Adopt PR-4's Security**:

   - Increase KDF iterations to 250,000 (or at least 100,000)
   - Consider TypeScript migration for type safety
   - Use crypto module's `timingSafeEqual()` if available

3. **Consider Storage Strategy**:
   - Expo SecureStore is sufficient for most use cases
   - react-native-keychain offers more control but adds complexity
   - Choice depends on whether you need Keychain's advanced features

### KDF Iterations Guidance

Industry standards (OWASP 2023):

- **Minimum**: 100,000 iterations
- **Recommended**: 310,000+ iterations
- **Current**: 10,000 (too low)
- **PR-4**: 250,000 (good)

**Recommendation**: Increase to at least 100,000, ideally 250,000. Test on target devices to ensure acceptable performance (<500ms delay is generally acceptable for security operations).

### Implementation Path

For the current feature branch:

```javascript
// Increase security while maintaining UX
const PIN_KDF_ITERATIONS = 150_000; // Balanced approach

// Or make it configurable based on device performance
const PIN_KDF_ITERATIONS = Platform.select({
  ios: 250_000, // iOS devices generally faster
  android: 150_000, // Android more varied performance
});
```

---

## Summary

Both implementations provide functional PIN/biometric authentication, but with different trade-offs:

- **Current Implementation**: Prioritizes user experience with custom UI components and modular architecture, but uses fewer KDF iterations (security concern)
- **PR-4 Implementation**: Prioritizes security and code simplicity with higher KDF iterations and TypeScript, but has basic UI/UX

The ideal solution would combine Current's superior UX with PR-4's security parameters, potentially migrating to TypeScript for better type safety while maintaining the modular component architecture.
