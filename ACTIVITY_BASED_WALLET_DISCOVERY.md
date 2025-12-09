# Activity-Based Wallet Discovery

## Overview

This feature implements BIP-44 compliant activity-based wallet discovery using the **gap limit algorithm**. Instead of checking only the first N wallets (e.g., first 20), the system now discovers ALL wallets that have been used by checking for actual blockchain activity.

## Problem Solved

Previously, when importing a seed phrase, X1 Wallet would only check the first 20 derivation paths. This caused issues when:
- Users had wallets beyond index 20
- Users deleted early wallets but kept later ones
- Users migrated from other wallets with different indexing

## Solution: Gap Limit Algorithm

The gap limit algorithm (BIP-44 standard) works as follows:

1. **Start at index 0** - Begin checking addresses sequentially
2. **Check for activity** - For each address, check if it has:
   - Non-zero balance, OR
   - Transaction history
3. **Track consecutive empty** - Count how many consecutive addresses have no activity
4. **Stop at gap limit** - Stop when finding 20 consecutive empty addresses

This ensures:
- ✅ ALL used wallets are discovered
- ✅ Efficient (doesn't check thousands unnecessarily)
- ✅ BIP-44 compliant
- ✅ Works across wallet providers

## Implementation

### New Files

1. **`packages/common/src/constants.ts`**
   - Added `GAP_LIMIT = 20` constant
   - Added `MAX_DISCOVERY_ADDRESSES = 1000` safety limit

2. **`packages/secure-background/src/store/KeyringStore/activityDetection.ts`**
   - Core discovery algorithm implementation
   - Batched parallel checking for performance
   - Progress callback support

3. **`packages/secure-background/src/services/svm/activityChecker.ts`**
   - Solana-specific activity checking
   - Checks SOL balance and transaction history
   - Cached implementation for efficiency

4. **`packages/secure-background/src/services/evm/activityChecker.ts`**
   - Ethereum-specific activity checking
   - Checks ETH balance and nonce (transaction count)
   - Cached implementation for efficiency

### Updated Files

1. **`packages/secure-background/src/store/KeyringStore/migrations/derivationPaths.ts`**
   - Exported `ethereumIndexed()` function
   - Added `getStandardDerivationPath()` helper

## Usage Example

```typescript
import { discoverActiveWalletsBatched } from "./activityDetection";
import { SolanaActivityChecker } from "../../services/svm/activityChecker";
import { getStandardDerivationPath } from "./migrations/derivationPaths";

// Create activity checker
const activityChecker = new SolanaActivityChecker(connection);

// Discover wallets
const result = await discoverActiveWalletsBatched(
  hdKeyring,
  activityChecker,
  (index) => getStandardDerivationPath(501, index), // Solana BIP-44 coin type
  10, // Batch size
  (checked, found) => {
    console.log(`Checked ${checked} addresses, found ${found} with activity`);
  }
);

console.log(`Found ${result.activeWallets.length} wallets with activity`);
console.log(`Checked ${result.totalChecked} total addresses`);
```

## Performance Considerations

### Batched Checking
The implementation supports batched parallel checking to minimize RPC latency:
- Default batch size: 10 concurrent requests
- Configurable per blockchain/RPC provider capabilities

### Caching
Both activity checkers include built-in caching:
- Prevents redundant RPC calls
- Useful when re-checking the same addresses
- Can be cleared with `clearCache()`

### Progress Callbacks
Optional progress callbacks allow UIs to show:
- "Discovering wallets... checked 47 addresses"
- Progress bar
- Real-time feedback to users

## Configuration

### Gap Limit
Modify `GAP_LIMIT` in `constants.ts` to change how many consecutive empty addresses trigger stop:
- Default: 20 (BIP-44 standard)
- Higher value: More thorough but slower
- Lower value: Faster but might miss wallets

### Max Addresses
Modify `MAX_DISCOVERY_ADDRESSES` to set maximum safety limit:
- Default: 1000
- Prevents infinite loops
- Protects against RPC abuse

### Batch Size
Adjust batch size based on RPC provider:
- Public RPC: 5-10 (avoid rate limiting)
- Private RPC: 20-50 (faster discovery)
- Local node: 50-100 (maximum speed)

## Integration Points

### Wallet Import Flow
Update the wallet import process in `KeyringStore` to:
1. Show "Discovering wallets..." message
2. Call activity-based discovery
3. Present only wallets with activity
4. Allow manual addition of extra wallets if needed

### Suggested UI Flow
```
User enters seed phrase
↓
"Discovering wallets with activity..."
[Progress: 23/∞ addresses checked, 3 found]
↓
Show discovered wallets:
☑ Wallet 1 (m/44'/501'/0'/0') - 5.2 SOL
☑ Wallet 2 (m/44'/501'/0'/0'/3') - 0.1 SOL
☑ Wallet 3 (m/44'/501'/0'/0'/15') - 12.5 SOL
[ ] Add more wallets manually
```

## Testing

### Manual Testing
1. Create wallets at indices: 0, 5, 25
2. Fund them with small amounts
3. Import seed phrase
4. Verify all 3 wallets are discovered
5. Verify discovery stops after ~20 empty addresses after wallet #25

### Edge Cases to Test
- ✅ Wallet at index 0 only
- ✅ Wallets at non-sequential indices (0, 10, 50)
- ✅ No wallets with activity (should find none)
- ✅ RPC errors (should handle gracefully)
- ✅ Rate limiting (should respect batch size)

## Future Enhancements

### Multi-Chain Discovery
Run discovery for multiple chains in parallel:
```typescript
const [solanaWallets, ethereumWallets] = await Promise.all([
  discoverSolanaWallets(mnemonic),
  discoverEthereumWallets(mnemonic),
]);
```

### Smart Batch Sizing
Auto-adjust batch size based on:
- RPC latency
- Success rate
- Network conditions

### Token Activity
Extend activity checking to include:
- SPL tokens (Solana)
- ERC-20 tokens (Ethereum)
- NFT ownership

## References

- [BIP-44 Specification](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [Gap Limit Discussion](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#address-gap-limit)
- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Ethers.js v6 Docs](https://docs.ethers.org/v6/)

## Authors

- Implementation: Claude Code
- Specification: Based on BIP-44 standard
- Testing: [Your testing team]

## License

Same as X1 Wallet project license
