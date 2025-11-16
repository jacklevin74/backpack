# Backpack Crypto Wallet Demo

## Overview

This package contains a complete, standalone cryptocurrency wallet demonstrating Backpack's core crypto functionality wrapped in a simple mobile interface.

## What's Included

### 1. Complete Crypto Wallet (`src/App.tsx`)
A full-featured mobile wallet application with:
- **Create Wallet**: Generate new 12-word BIP39 mnemonic
- **Import Wallet**: Restore from existing mnemonic
- **Multi-Chain**: Solana and Ethereum support
- **HD Wallets**: BIP44 compliant derivation
- **Account Management**: Add multiple accounts per chain
- **Secure Storage**: Password-encrypted persistence
- **Private Key Export**: View and copy private keys

### 2. Interactive Demo (`src/DemoApp.tsx`)
A simplified demo page showcasing:
- One-tap wallet generation
- Live account creation (Solana + Ethereum)
- Private key reveal functionality
- Feature checklist showing what's tested

## Backpack Features Demonstrated

### Core Cryptography
✓ **BIP39 Mnemonic Generation** - 12-word recovery phrases
✓ **BIP44 HD Derivation** - Standard derivation paths
✓ **TweetNaCl Encryption** - PBKDF2 + secretbox encryption
✓ **Secure Key Storage** - Password-protected local storage

### Solana Support
✓ **ed25519 Keypairs** - Solana-compatible keys
✓ **Derivation Path**: `m/44'/501'/[account]'/0'`
✓ **Transaction Signing** - Using nacl.sign.detached
✓ **Message Signing** - Off-chain message support

### Ethereum Support
✓ **secp256k1 Keypairs** - Ethereum-compatible keys
✓ **Derivation Path**: `m/44'/60'/0'/0/[account]`
✓ **Transaction Signing** - Using ethers6
✓ **Message Signing** - EIP-191 message support

### Wallet Management
✓ **Multi-Account** - Unlimited accounts per chain
✓ **Account Switching** - Easy account selection
✓ **Private Key Export** - Secure key reveal with warnings
✓ **Wallet Clear** - Logout functionality

## Architecture

```
Backpack Crypto Wallet
├── WalletCore.ts (329 lines)
│   ├── Encryption (TweetNaCl + PBKDF2)
│   ├── Solana Functions
│   │   ├── deriveSolanaKeypair()
│   │   ├── signSolanaTransaction()
│   │   └── signSolanaMessage()
│   ├── Ethereum Functions
│   │   ├── deriveEthereumWallet()
│   │   ├── signEthereumTransaction()
│   │   └── signEthereumMessage()
│   └── WalletCore Class
│       ├── generateWallet()
│       ├── importWallet()
│       ├── addAccount()
│       └── getPrivateKey()
├── SecureStorage.ts (38 lines)
│   ├── saveWallet()
│   ├── loadWallet()
│   └── clearWallet()
├── App.tsx (523 lines)
│   ├── Welcome Screen
│   ├── Create Wallet Flow
│   ├── Import Wallet Flow
│   ├── Unlock Screen
│   └── Wallet Dashboard
└── DemoApp.tsx (350 lines)
    ├── Generate Wallet Button
    ├── Add Account Buttons
    ├── Account Display
    └── Feature Checklist
```

## Running the Demo

### Option 1: Expo (Recommended for quick testing)
```bash
cd /home/jack/backpack/packages/backpack-demo
yarn install
npx expo start --android
```

### Option 2: React Native
```bash
cd /home/jack/backpack/packages/mobile-wallet
yarn install
yarn android
```

### Option 3: Build APK
```bash
cd /home/jack/backpack/packages/mobile-wallet/android
./gradlew assembleDebug
# APK output: app/build/outputs/apk/debug/app-debug.apk
```

## Using the Demo App

### Demo Flow (DemoApp.tsx)

1. **Tap "Generate New Wallet"**
   - Creates 12-word mnemonic
   - Derives first Solana & Ethereum accounts
   - Displays mnemonic and accounts

2. **Tap "+ Solana" or "+ Ethereum"**
   - Adds new account of selected type
   - Shows public key and derivation path
   - Updates account list

3. **Tap "Show Private Key"**
   - Displays warning
   - Shows private key for selected account
   - Allows copying

4. **Tap "Clear Wallet"**
   - Clears all wallet data
   - Resets to initial state

### Full Wallet Flow (App.tsx)

1. **Create New Wallet**
   - Generate mnemonic
   - Copy/save recovery phrase
   - Set password
   - Auto-creates first accounts

2. **Import Wallet**
   - Enter recovery phrase
   - Set password
   - Restores accounts

3. **Unlock**
   - Enter password
   - Access wallet

4. **Manage Accounts**
   - View all accounts
   - Switch active account
   - Add new accounts
   - Export private keys

## Security Features

- **Encrypted Storage**: All mnemonics encrypted with TweetNaCl
- **Password Protection**: PBKDF2 (100k iterations on mobile)
- **No Network Calls**: All operations happen locally
- **Private Key Warnings**: Clear warnings before key export
- **Secure Derivation**: Industry-standard BIP39/BIP44

## Dependencies

### Core Crypto
- `tweetnacl` - Encryption & Solana signing
- `bip39` - Mnemonic generation
- `ed25519-hd-key` - Solana HD derivation
- `ethers6` - Ethereum wallet & signing
- `bs58` - Base58 encoding
- `@solana/web3.js` - Solana types

### React Native
- `react-native-get-random-values` - Secure randomness
- `@react-native-async-storage/async-storage` - Persistence
- `buffer` & `crypto-browserify` - Node polyfills
- `stream-browserify` - Stream polyfill

## Code Highlights

### Generating a Wallet
```typescript
const wallet = new WalletCore();
const mnemonic = wallet.generateWallet(); // Returns 12 words
const accounts = wallet.getAccounts();    // [Solana, Ethereum]
```

### Adding Accounts
```typescript
const solanaAccount = wallet.addAccount('solana');
// Returns: { publicKey, blockchain: 'solana', derivationPath }

const ethAccount = wallet.addAccount('ethereum');
// Returns: { publicKey, blockchain: 'ethereum', derivationPath }
```

### Exporting Private Keys
```typescript
const privateKey = wallet.getPrivateKey(publicKey);
// For Solana: Returns base58-encoded secretKey
// For Ethereum: Returns 0x-prefixed hex privateKey
```

### Encryption
```typescript
const encrypted = await encrypt(mnemonic, password);
// Returns: { ciphertext, nonce, salt, kdf, iterations, digest }

const decrypted = await decrypt(encrypted, password);
// Returns: Original mnemonic
```

## Testing Checklist

Use the demo app to verify:

- [ ] Generate new mnemonic
- [ ] Mnemonic is 12 words
- [ ] Solana account created
- [ ] Ethereum account created
- [ ] Add additional Solana account
- [ ] Add additional Ethereum account
- [ ] View private keys
- [ ] Public keys are valid addresses
- [ ] Clear wallet works
- [ ] Import wallet from mnemonic
- [ ] Password encryption works
- [ ] Unlock with password works

## Network Support

### Solana
- **Mainnet**: Yes (keys compatible)
- **Devnet**: Yes (same keys)
- **Testnet**: Yes (same keys)

### Ethereum
- **Mainnet**: Yes (keys compatible)
- **Testnets**: Yes (Goerli, Sepolia, etc.)
- **L2s**: Yes (Polygon, Arbitrum, Optimism, etc.)

All EVM-compatible chains work with the same Ethereum keys.

## Derivation Paths

### Solana
```
m/44'/501'/0'/0'  - First account
m/44'/501'/1'/0'  - Second account
m/44'/501'/2'/0'  - Third account
```

### Ethereum
```
m/44'/60'/0'/0/0  - First account
m/44'/60'/0'/0/1  - Second account
m/44'/60'/0'/0/2  - Third account
```

## File Structure

```
/home/jack/backpack/packages/mobile-wallet/
├── src/
│   ├── App.tsx                 # Full wallet UI
│   ├── DemoApp.tsx             # Simple demo UI
│   ├── crypto/
│   │   └── WalletCore.ts       # All crypto operations
│   └── storage/
│       └── SecureStorage.ts    # Encrypted storage
├── android/                    # Android project
├── package.json               # Dependencies
├── index.js                   # Entry point
└── shim.js                    # Crypto polyfills
```

## Troubleshooting

### Build Issues
If you encounter build issues:
1. Try using the Demo app (simpler setup)
2. Use Expo instead of React Native
3. Check Android SDK is installed
4. Verify Java/Gradle versions

### Port Conflicts
If Metro bundler port is in use:
```bash
pkill -f "react-native start"
lsof -ti:8081 | xargs kill -9
```

### Emulator Issues
```bash
export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/emulator:$PATH
emulator -avd backpack_test
```

## Production Considerations

This is a demo/reference implementation. For production:

1. **Add Network Calls**: Integrate RPC providers
2. **Add Transaction Building**: Construct and broadcast txs
3. **Add Balance Display**: Fetch and show balances
4. **Add Transaction History**: Display past transactions
5. **Add Biometric Auth**: Fingerprint/Face unlock
6. **Add Backup**: Cloud backup options
7. **Add Security Audit**: Professional security review
8. **Add Error Handling**: More robust error handling
9. **Add Testing**: Unit and integration tests
10. **Add Analytics**: Usage tracking

## License

Same as parent Backpack project

## Credits

Built using Backpack's crypto core:
- `@coral-xyz/secure-background`
- `@coral-xyz/common`

Demonstrates the same crypto operations used in the full Backpack wallet.
