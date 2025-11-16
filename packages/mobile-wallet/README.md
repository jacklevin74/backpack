# Simple Crypto Wallet

A minimal, standalone mobile wallet app for Android that wraps the Backpack crypto core functionality. This wallet supports both Solana and Ethereum blockchains.

## Features

- **Multi-Chain Support**: Solana and Ethereum
- **Secure Storage**: Encrypted mnemonic storage using TweetNaCl
- **HD Wallet**: BIP39/BIP44 compliant derivation paths
- **Account Management**: Create multiple accounts per blockchain
- **Private Key Export**: View and export private keys
- **Clean UI**: Simple, dark-themed interface

## Architecture

This wallet is built from scratch using the crypto core from Backpack:

### Core Components

1. **WalletCore.ts** - Crypto operations wrapper
   - Mnemonic generation and validation (BIP39)
   - Key derivation for Solana (ed25519) and Ethereum (secp256k1)
   - Transaction signing
   - Encryption/decryption using TweetNaCl

2. **SecureStorage.ts** - Encrypted storage layer
   - Password-based encryption (PBKDF2)
   - AsyncStorage for persistence

3. **App.tsx** - React Native UI
   - Wallet creation/import
   - Account management
   - Key display and export

### Technology Stack

- **React Native 0.72.7** - Mobile framework
- **TypeScript** - Type safety
- **Crypto Libraries**:
  - `tweetnacl` - Encryption and Solana signing
  - `ethers6` - Ethereum wallet and signing
  - `bip39` - Mnemonic generation
  - `ed25519-hd-key` - Solana key derivation
  - `crypto-browserify` - PBKDF2 for encryption
- **Storage**: AsyncStorage for encrypted data

## Building

### Prerequisites

- Node.js 16+
- Yarn
- Android SDK (API 33+)
- Java 11+

### Build APK

```bash
# Install dependencies
yarn install

# Build release APK
./build-apk.sh
```

The APK will be output to `simple-crypto-wallet.apk`

### Development

```bash
# Start Metro bundler
yarn start

# Run on Android device/emulator
yarn android
```

## Usage

### Creating a Wallet

1. Launch the app
2. Tap "Create New Wallet"
3. Save your 12-word recovery phrase (CRITICAL!)
4. Set a password (min 8 characters)
5. Confirm and save

### Importing a Wallet

1. Launch the app
2. Tap "Import Wallet"
3. Enter your recovery phrase
4. Set a password
5. Confirm and import

### Managing Accounts

- View all accounts in the "All Accounts" section
- Tap an account to make it active
- Tap "+ Add Account" to create new accounts
- Choose Solana or Ethereum when adding

### Exporting Private Keys

1. Select an account
2. Tap "Show Private Key"
3. Confirm the warning
4. View or copy the private key

## Security

- Mnemonic is encrypted using TweetNaCl secretbox
- Password is derived using PBKDF2 (100,000 iterations on mobile)
- Private keys never leave the device
- No network connections for wallet operations

## Supported Networks

- **Solana**: Mainnet, Devnet, Testnet
- **Ethereum**: Mainnet and compatible EVM chains

## Derivation Paths

- **Solana**: `m/44'/501'/[account]'/0'`
- **Ethereum**: `m/44'/60'/0'/0/[account]`

## Files

```
packages/mobile-wallet/
├── src/
│   ├── App.tsx                 # Main UI component
│   ├── crypto/
│   │   └── WalletCore.ts       # Crypto operations
│   └── storage/
│       └── SecureStorage.ts    # Encrypted storage
├── android/                    # Android native code
├── package.json
├── tsconfig.json
├── metro.config.js
├── babel.config.js
├── shim.js                     # Crypto polyfills
└── build-apk.sh               # Build script
```

## Differences from Main Backpack

This is a simplified, standalone version:

- No browser extension architecture
- No service worker or background scripts
- No NFT/xNFT support
- No swap/DeFi integrations
- No notifications
- No cloud backup
- Pure crypto core functionality only

## License

Same as parent Backpack project
