# Onboarding and Account Creation Fixes

## Overview

This document summarizes the comprehensive fixes applied to resolve onboarding and account creation issues in the Backpack wallet extension. The fixes address duplicate account creation, wallet selection flows, error handling, and incomplete onboarding state cleanup.

## Issues Fixed

### 1. Duplicate User Account Creation

**Problem:** When creating a new account with a new seed phrase, multiple duplicate user accounts (e.g., test2, test3, test3) were being created.

**Root Cause:** The `useAsyncEffect` hook in `Finish.tsx` was executing multiple times, causing `createStore()` to be called repeatedly.

**Solution:** Added a `useRef` flag to ensure store creation only happens once:

```typescript
// packages/app-extension/src/components/Onboarding/pages/Finish.tsx
const hasCreatedStore = useRef(false);

useAsyncEffect(async () => {
  if (hasCreatedStore.current) {
    return;
  }
  hasCreatedStore.current = true;

  try {
    const res = await createStore({ ...onboardingData, isAddingAccount });
    if (!res.ok) {
      hasCreatedStore.current = false; // Allow retry on error
    }
  } catch (err: any) {
    hasCreatedStore.current = false; // Allow retry on error
  }
}, [isAddingAccount, onboardingData, createStore, setLoading]);
```

**Files Modified:**

- `packages/app-extension/src/components/Onboarding/pages/Finish.tsx`

### 2. Create vs Import Flow Inconsistency

**Problem:** Creating a new account with a new seed phrase didn't work properly, but importing an account with a typed seed phrase worked fine.

**Root Cause:** The "create" action was not showing the `ImportWallets` component, which handles wallet selection and signing.

**Solution:** Added `action === "create"` to the condition that determines when to show `ImportWallets`:

```typescript
// packages/app-extension/src/components/Onboarding/pages/OnboardAccount.tsx
...(keyringType === "ledger" || action === "import" || action === "create"
  ? [
    <ImportWallets
      allowMultiple
      autoSelect
      newAccount
      key="ImportWallets"
      blockchain={blockchain || Blockchain.X1}
      mnemonic={mnemonic!}
      onNext={(walletDescriptors: Array<WalletDescriptor>) => {
        // Only add the first wallet to avoid creating duplicate accounts
        setOnboardingData({
          signedWalletDescriptors: walletDescriptors.length > 0 ? [walletDescriptors[0]] : [],
        });
        nextStep();
      }}
    />,
  ]
  : []),
```

**Files Modified:**

- `packages/app-extension/src/components/Onboarding/pages/OnboardAccount.tsx`
- `packages/recoil/src/context/OnboardingProvider.tsx`

### 3. Auto-Selection of First Wallet

**Problem:** When creating or importing an account, the user had to manually select the first wallet from the list.

**Solution:** Added `autoSelect` prop to `ImportWallets` component with automatic selection logic:

```typescript
// packages/app-extension/src/components/common/Account/ImportWallets.tsx
useEffect(() => {
  if (
    autoSelect &&
    walletDescriptors &&
    walletDescriptors.length > 0 &&
    checkedWalletDescriptors.length === 0
  ) {
    const firstNonDisabledWallet = walletDescriptors.find(
      (descriptor) => !isDisabledPublicKey(descriptor.publicKey)
    );
    if (firstNonDisabledWallet) {
      setCheckedWalletDescriptors([
        {
          blockchain,
          derivationPath: firstNonDisabledWallet.derivationPath,
          publicKey: firstNonDisabledWallet.publicKey,
        },
      ]);
    }
  }
}, [
  autoSelect,
  walletDescriptors,
  checkedWalletDescriptors.length,
  isDisabledPublicKey,
  blockchain,
]);
```

**Files Modified:**

- `packages/app-extension/src/components/common/Account/ImportWallets.tsx`

### 4. Active Wallet Validation Bug

**Problem:** "Active wallet not found" error when switching wallets.

**Root Cause:** Validation was checking `!publicKey` instead of `!publicKeyInfo` in `SecureStore.ts`.

**Solution:** Fixed validation at line 354:

```typescript
// packages/secure-background/src/store/SecureStore.ts
if (!publicKeyInfo) {
  // Previously: if (!publicKey)
  throw new Error("Unknown PublicKey");
}
```

**Files Modified:**

- `packages/secure-background/src/store/SecureStore.ts`

### 5. Wallet Data Initialization Error

**Problem:** "wallet data for user [uuid] is undefined" error during onboarding.

**Root Cause:** `getWalletDataForUser` was throwing an error when wallet data hadn't been initialized yet.

**Solution:** Return default preferences instead of throwing:

```typescript
// packages/secure-background/src/store/SecureStore.ts
async getWalletDataForUser(uuid: string): Promise<Preferences> {
  const data = await this.persistentDB.get<Preferences>(this.walletDataKey(uuid));
  if (!data) {
    return defaultPreferences();
  }
  return data;
}
```

**Files Modified:**

- `packages/secure-background/src/store/SecureStore.ts`

### 6. User Data Not Found Error

**Problem:** "user data not found" error during preview wallet generation.

**Root Cause:** `activeUserKeyring()` was being called before any user data existed.

**Solution:** Wrapped the call in try-catch block:

```typescript
// packages/secure-background/src/services/user/server.ts
let userKeyring: UserKeyring | null = null;
if (keyringStoreState !== KeyringStoreState.NeedsOnboarding) {
  try {
    userKeyring = await this.keyringStore.activeUserKeyring();
  } catch (e) {
    // During initial onboarding, user data might not exist yet
    userKeyring = null;
  }
}
```

**Files Modified:**

- `packages/secure-background/src/services/user/server.ts`

### 7. Automatic Wallet Recovery

**Problem:** App would crash when the active wallet was invalid or missing.

**Solution:** Added automatic fallback to the first valid wallet:

```typescript
// packages/secure-background/src/services/user/server.ts
if (publicKeys) {
  for (const [blockchain, platformData] of Object.entries(
    publicKeys.platforms
  )) {
    if (platformData && platformData.publicKeys) {
      const activePublicKey = platformData.activePublicKey;
      const publicKeysList = Object.keys(platformData.publicKeys);

      // If active wallet doesn't exist or no active wallet is set, use the first one
      if (
        publicKeysList.length > 0 &&
        (!activePublicKey || !platformData.publicKeys[activePublicKey])
      ) {
        const firstPublicKey = publicKeysList[0];
        await this.secureStore.setUserActivePublicKey(
          user.uuid,
          blockchain as any,
          firstPublicKey
        );
        platformData.activePublicKey = firstPublicKey;
      }
    }
  }
}
```

**Files Modified:**

- `packages/secure-background/src/services/user/server.ts`

### 8. App Crash When No Accounts Exist

**Problem:** Clicking the extension icon with no accounts (incomplete onboarding) caused immediate crash/close.

**Solution:** Added redirect to onboarding in full tab:

```typescript
// packages/app-extension/src/app/Router.tsx
useEffect(() => {
  if (allUsers !== null && allUsers.length === 0 && !hasRedirected) {
    console.log("No users found, redirecting to onboarding");
    setHasRedirected(true);
    const url = globalThis.chrome?.runtime?.getURL(
      `options.html?${QUERY_ONBOARDING}`
    );
    if (url) {
      globalThis.chrome?.tabs?.create({ url });
      window.close();
    }
  }
}, [allUsers, hasRedirected]);
```

**Files Modified:**

- `packages/app-extension/src/app/Router.tsx`

### 9. Incomplete Onboarding State Cleanup

**Problem:** Partial onboarding state could persist, causing issues on subsequent attempts.

**Solution:** Added cleanup method to detect and remove incomplete onboarding state:

```typescript
// packages/secure-background/src/store/SecureStore.ts
async cleanupIncompleteOnboarding(): Promise<boolean> {
  try {
    const userData = await this.persistentDB.get<UserData>(
      PersistentStorageKeys.STORE_KEY_USER_DATA
    );

    if (!userData || !userData.activeUser) {
      return false;
    }

    const hasCiphertext = await this.doesCiphertextExist();
    const publicKeys = await this.getUserPublicKeys(userData.activeUser.uuid);
    const hasPublicKeys =
      publicKeys && Object.keys(publicKeys.platforms || {}).length > 0;

    if (!hasCiphertext || !hasPublicKeys) {
      console.log("Detected incomplete onboarding state, cleaning up...");
      await this.reset();
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error detecting incomplete onboarding:", error);
    return false;
  }
}
```

```typescript
// packages/secure-background/src/store/KeyringStore/KeyringStore.ts
public async state(): Promise<KeyringStoreState> {
  if (await this.isUnlocked()) {
    return KeyringStoreState.Unlocked;
  }
  if (await this.isLocked()) {
    return KeyringStoreState.Locked;
  }

  // Before returning NeedsOnboarding, check for and cleanup incomplete onboarding state
  await this.store.cleanupIncompleteOnboarding();

  return KeyringStoreState.NeedsOnboarding;
}
```

**Files Modified:**

- `packages/secure-background/src/store/SecureStore.ts`
- `packages/secure-background/src/store/KeyringStore/KeyringStore.ts`

### 10. Improved Onboarding UX

**Problem:** When onboarding was needed, a black screen or popup would show instead of the full onboarding flow.

**Solution:** Open onboarding in full tab with loading spinner:

```typescript
// packages/secure-ui/src/RequireUserUnlocked/RequireUserUnlocked.tsx
useEffect(() => {
  if (!disabled && keyringState === KeyringStoreState.NeedsOnboarding) {
    const isOnOnboardingPage =
      window.location.search.includes(QUERY_ONBOARDING);
    if (!isOnOnboardingPage) {
      // Open onboarding in full tab instead of popup
      const url = globalThis.chrome?.runtime?.getURL(
        `options.html?${QUERY_ONBOARDING}`
      );
      if (url) {
        globalThis.chrome?.tabs?.create({ url });
        window.close();
      }
    }
  }
}, [disabled, keyringState]);

if (keyringState === KeyringStoreState.NeedsOnboarding) {
  // Show loading spinner instead of black screen
  return <Loading />;
}
```

**Files Modified:**

- `packages/secure-ui/src/RequireUserUnlocked/RequireUserUnlocked.tsx`

## Additional Enhancements

### Localnet Development Support (PR #11)

Added support for local validator development for both X1 and Solana networks:

**X1 Localnet:**

- RPC URL: `http://127.0.0.1:8901`
- JSON Server: `http://localhost:4000`
- Network banner: "X1 LOCALNET" (or "X1 LOCALNET • DEVELOPER MODE")

**Solana Localnet:**

- RPC URL: `http://127.0.0.1:8899`
- Network banner: "SOLANA LOCALNET" (or "SOLANA LOCALNET • DEVELOPER MODE")

**Files Modified:**

- `packages/secure-background/src/blockchain-configs/x1/cluster.ts`
- `packages/secure-background/src/blockchain-configs/x1/preferences.ts`
- `packages/secure-background/src/blockchain-configs/solana/cluster.ts`
- `packages/secure-background/src/blockchain-configs/solana/preferences.ts`
- `packages/common/src/apollo/index.ts`
- `packages/app-extension/src/app/Router.tsx`

### Unfunded Wallet Display

Modified wallet import to show the first 5 unfunded wallets by default, allowing developers to work with fresh wallets without needing to fund them first.

**Files Modified:**

- `packages/app-extension/src/components/common/Account/ImportWallets.tsx`

## Files Changed Summary

### Core Onboarding Flow

- `packages/app-extension/src/components/Onboarding/pages/Finish.tsx`
- `packages/app-extension/src/components/Onboarding/pages/OnboardAccount.tsx`
- `packages/app-extension/src/components/common/Account/ImportWallets.tsx`
- `packages/recoil/src/context/OnboardingProvider.tsx`

### Storage and State Management

- `packages/secure-background/src/store/SecureStore.ts`
- `packages/secure-background/src/store/KeyringStore/KeyringStore.ts`
- `packages/secure-background/src/services/user/server.ts`

### UI and Routing

- `packages/app-extension/src/app/Router.tsx`
- `packages/secure-ui/src/RequireUserUnlocked/RequireUserUnlocked.tsx`

### Localnet Configuration

- `packages/secure-background/src/blockchain-configs/x1/cluster.ts`
- `packages/secure-background/src/blockchain-configs/x1/preferences.ts`
- `packages/secure-background/src/blockchain-configs/solana/cluster.ts`
- `packages/secure-background/src/blockchain-configs/solana/preferences.ts`
- `packages/common/src/apollo/index.ts`

## Testing Instructions

### Manual Testing - New Account Creation

1. **Install fresh extension:**

   ```bash
   cd packages/app-extension
   yarn build
   # Load unpacked extension from packages/app-extension/build
   ```

2. **Test new account with generated seed:**

   - Click extension icon
   - Should redirect to full onboarding page
   - Click "Create new wallet"
   - Set password
   - First wallet should be auto-selected
   - Complete onboarding
   - Verify only ONE account created

3. **Test adding second account:**

   - Settings → Add Account
   - Create new with seed phrase
   - First wallet should be auto-selected
   - Complete flow
   - Verify only ONE new account added (no duplicates)

4. **Test import with existing seed:**
   - Settings → Add Account
   - Import with recovery phrase
   - Type/paste mnemonic
   - First wallet should be auto-selected
   - Complete flow
   - Verify only ONE account added

### Manual Testing - Localnet Development

1. **Start X1 localnet validator:**

   ```bash
   # Start X1 localnet on port 8901
   solana-test-validator -r --rpc-port 8901
   ```

2. **Start X1 JSON server:**

   ```bash
   # Start mock JSON server on port 4000
   cd backpack
   node x1-json-server.js
   ```

3. **Configure X1 localnet in wallet:**

   - Settings → Developer Mode → Enable
   - Settings → Solana → Custom RPC
   - Enter: `http://127.0.0.1:8901`
   - Verify banner shows "X1 LOCALNET • DEVELOPER MODE"

4. **Test Solana localnet:**
   ```bash
   # Start Solana localnet on port 8899
   solana-test-validator
   ```
   - Settings → Solana → Custom RPC
   - Enter: `http://127.0.0.1:8899`
   - Verify banner shows "SOLANA LOCALNET • DEVELOPER MODE"

### Error Recovery Testing

1. **Test incomplete onboarding cleanup:**

   - Start onboarding
   - Close extension before completing
   - Click extension icon again
   - Should redirect to onboarding (not crash)

2. **Test automatic wallet recovery:**
   - Manually corrupt active wallet in storage
   - Open extension
   - Should automatically fallback to first valid wallet

## Integration History

### PR #10: Onboarding State Cleanup

**Integrated:** Cherry-picked via commit `895e8de4`

Changes integrated:

- `cleanupIncompleteOnboarding()` method
- Cleanup call before NeedsOnboarding state
- Full-tab onboarding flow
- Loading spinner during onboarding redirect

### PR #11: Localnet Support

**Integrated:** Fast-forward merge via commit `46d4080f`

Changes integrated:

- X1 localnet cluster configuration
- Solana localnet cluster configuration
- Apollo client routing for localnet
- Network banner detection for localnet

## Known Issues

### Development Console Warnings

During development with hot module replacement, you may see "duplicate atom key" warnings:

```
Duplicate atom key "lastActiveTs". This is a FATAL ERROR in production.
```

These warnings are **safe to ignore** in development mode. They occur because hot module replacement reinitializes Recoil atoms multiple times. In production builds, atoms are only initialized once and these warnings will not appear.

## Future Improvements

1. **Add unit tests** for onboarding flow edge cases
2. **Add E2E tests** using Playwright or Maestro for complete onboarding flows
3. **Improve error messages** shown to users during onboarding failures
4. **Add telemetry** to track onboarding completion rates and failure points
5. **Consider background service worker** for better error recovery across sessions

## Conclusion

These fixes provide a robust foundation for onboarding and account creation in the Backpack wallet extension. The multi-layered error recovery, automatic cleanup, and consistent create/import flows significantly improve the user experience and prevent common failure scenarios.

All changes have been tested manually and are ready for production deployment.
