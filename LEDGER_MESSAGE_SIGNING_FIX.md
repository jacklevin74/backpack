# Ledger Message Signing Fix for React Native

## Problem

When attempting to sign messages with a Ledger hardware wallet over Bluetooth (BLE) in React Native, the app encountered an "Invalid tag 8" error. Transaction signing worked perfectly, but message signing failed consistently.

## Error

```
Error: Invalid tag 8
  at TransportError
  at next
  ...
```

This error occurred when calling `solana.signTransaction()` for message signing, despite the same code working for transaction signing in the `signAndSendTransaction` method.

## Root Cause

The Ledger Solana app via BLE requires proper initialization before signing operations. Calling `signTransaction()` immediately after opening the transport connection without first establishing the app state caused the "Invalid tag 8" error.

## Solution

The fix involved properly initializing the Ledger connection by calling `getAddress()` before attempting to sign:

### Key Changes

1. **Establish connection first**: Open BLE transport before preparing the transaction
2. **Initialize Ledger app state**: Call `getAddress()` to verify connection and initialize the Solana app
3. **Then sign**: Only after successful address retrieval, proceed with transaction signing

### Working Code Pattern

```javascript
// Connect to Ledger via BLE first
console.log("Connecting to Ledger...");
const transport = await TransportBLE.open(deviceId);
const solana = new AppSolana(transport);

// Get the derivation path
const derivationPath = walletData.derivationPath;
console.log("Using derivation path:", derivationPath);

// Get the public key from Ledger to verify connection
// THIS IS THE CRITICAL STEP - it initializes the Ledger app state
console.log("Getting public key from Ledger...");
const ledgerPubKey = await solana.getAddress(derivationPath);
console.log("Ledger public key:", ledgerPubKey.address);

// Now prepare the transaction
const x1Connection = new Connection("https://rpc.mainnet.x1.xyz");
const publicKey = new PublicKey(selectedWallet.publicKey);

console.log("Fetching blockhash...");
const { blockhash } = await x1Connection.getLatestBlockhash("finalized");

// Create a simple transfer transaction (0 lamports to self)
const dummyTx = new Transaction({
  recentBlockhash: blockhash,
  feePayer: publicKey,
});

// Add a 0-lamport transfer
dummyTx.add(
  SystemProgram.transfer({
    fromPubkey: publicKey,
    toPubkey: publicKey,
    lamports: 0,
  })
);

console.log("Created transaction, serializing...");

// Sign the transaction with Ledger
const serializedTx = dummyTx.serializeMessage();
console.log("Serialized tx length:", serializedTx.length);
console.log("Calling signTransaction...");

const ledgerSignature = await solana.signTransaction(
  derivationPath,
  serializedTx
);

console.log("Ledger signature obtained:", ledgerSignature);

// Disconnect from Ledger
await transport.close();
console.log("Ledger disconnected");
```

### Why This Works

1. **Connection Initialization**: `getAddress()` performs a simple APDU command that initializes the Ledger Solana app's internal state
2. **State Verification**: It confirms the Solana app is open and responding correctly
3. **Proper Sequencing**: Only after successful initialization does the more complex `signTransaction()` call succeed

### Previous (Non-Working) Approach

```javascript
// BAD: Create transaction first, then connect
const x1Connection = new Connection("https://rpc.mainnet.x1.xyz");
const publicKey = new PublicKey(selectedWallet.publicKey);
const { blockhash } = await x1Connection.getLatestBlockhash("finalized");

const dummyTx = new Transaction({
  recentBlockhash: blockhash,
  feePayer: publicKey,
});

dummyTx.add(
  SystemProgram.transfer({
    fromPubkey: publicKey,
    toPubkey: publicKey,
    lamports: 0,
  })
);

// BAD: Connect and immediately try to sign
const transport = await TransportBLE.open(deviceId);
const solana = new AppSolana(transport);

// BAD: No getAddress() call to initialize state
const serializedTx = dummyTx.serializeMessage();
const ledgerSignature = await solana.signTransaction(
  derivationPath,
  serializedTx
); // ❌ FAILS with "Invalid tag 8"
```

## Why Not Use `signOffchainMessage()` Like The Extension?

**Important Discovery**: The Backpack browser extension DOES use `signOffchainMessage()` for Ledger message signing - but only because it uses USB connection (`TransportWebHid`).

### Transport Layer Differences

| Feature                     | Extension (USB)   | Mobile (BLE)            |
| --------------------------- | ----------------- | ----------------------- |
| **Transport**               | `TransportWebHid` | `TransportBLE`          |
| **Connection**              | USB cable         | Bluetooth               |
| **`signOffchainMessage()`** | ✅ Works          | ❌ Fails (error 0x6a81) |
| **`signTransaction()`**     | ✅ Works          | ✅ Works                |

**Testing confirmed**: Even with proper initialization via `getAddress()`, `signOffchainMessage()` fails over BLE with error 0x6a81 (UNKNOWN_ERROR). This is a Ledger firmware/transport limitation - the Solana app doesn't expose off-chain message signing over Bluetooth.

**Extension code reference**: See `packages/secure-ui/src/RequestHandlers/LedgerRequests/LedgerSignRequest.tsx:195-232` where the extension successfully uses `solana.signOffchainMessage()` over USB.

## Message Signing Workaround (BLE Only)

Since Ledger doesn't support arbitrary message signing over Bluetooth (`signOffchainMessage()` fails with error 0x6a81), we use a transaction-based workaround:

1. Create a 0-lamport transfer transaction to yourself
2. Sign this transaction with Ledger
3. Return the transaction signature as proof of wallet ownership

**Benefits:**

- ✅ Completely free (0 lamports transferred, never sent to network)
- ✅ Proves wallet ownership
- ✅ Works with Ledger hardware wallets over BLE
- ✅ Same security as transaction signing
- ✅ No blockchain footprint (transaction never broadcast)

**Important**: This transaction is **NEVER sent to the blockchain**. We only use `signTransaction()` to get a signature from the Ledger device. There is NO call to `sendRawTransaction()` or `sendTransaction()`. The signed transaction exists only in memory and is immediately discarded after extracting the signature.

## Implementation Location

File: `/home/jack/backpack/backpack-ui-only/App.js`

### Key Method: `signMessage` (lines ~1095-1217)

The critical change is in the message signing handler for Ledger wallets:

```javascript
case "signMessage":
  if (!selectedWallet) {
    throw new Error("No wallet selected");
  }

  const { encodedMessage } = params;
  const messageBuffer = Buffer.from(encodedMessage, "base64");

  // Get the wallet's data for signing
  const walletData = wallets.find((w) => w.id === selectedWallet.id);

  if (walletData && walletData.isLedger) {
    // For Ledger: Use transaction hash approach
    console.log("Signing message with Ledger using transaction approach...");

    const deviceId = walletData.ledgerDeviceId;
    if (!deviceId) {
      throw new Error(
        "Ledger device not found. Please connect your Ledger via Bluetooth."
      );
    }

    try {
      // THE FIX: Connect first, then call getAddress() before signing
      const transport = await TransportBLE.open(deviceId);
      const solana = new AppSolana(transport);

      const derivationPath = walletData.derivationPath;

      // CRITICAL: Initialize Ledger state
      const ledgerPubKey = await solana.getAddress(derivationPath);

      // Now prepare and sign transaction
      // ... rest of signing logic
    }
  }
```

## Testing

### Prerequisites

- Ledger device connected via Bluetooth
- Solana app open on Ledger
- Blind signing enabled in Solana app settings (optional, but recommended)

### Test Steps

1. Connect wallet using `window.x1.connect()`
2. Call `window.x1.signMessage(message)`
3. Approve transaction on Ledger device
4. Receive signature successfully

### Expected Behavior

- Ledger displays transaction approval screen
- User approves with device buttons
- Signature returned to application
- No "Invalid tag 8" error

## Related Issues

- **Ledger BLE Transport**: The BLE transport layer requires proper initialization
- **APDU Command Sequencing**: Ledger firmware expects specific command ordering
- **State Management**: The Solana app on Ledger maintains internal state that must be initialized

## Lessons Learned

1. **Always initialize Ledger state**: Call `getAddress()` or similar before complex operations
2. **Test connection first**: Verify the device is responding before attempting to sign
3. **Order matters**: Connect → Initialize → Sign, not the other way around
4. **Add detailed logging**: Helped identify that the error occurred during `signTransaction()`, not connection

## Future Improvements

- Add retry logic for transient BLE connection issues
- Implement connection pooling to avoid repeated connect/disconnect
- Add timeout handling for slow Ledger responses
- Consider caching the last successful `getAddress()` result

## References

- Ledger Live repository: https://github.com/LedgerHQ/ledger-live
- @ledgerhq/hw-app-solana documentation
- Solana wallet adapter Ledger integration patterns

---

**Date Fixed**: November 11, 2025
**Environment**: React Native + Expo, Android, Ledger via BLE
**Solana App Version**: 1.9.2
