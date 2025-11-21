# Chrome Web Store Submission Guide for X1 Wallet

## Prerequisites

- Google Developer Account ($5 one-time fee)
- Extension build ready in `packages/app-extension/build/`

## Required Assets

### 1. Extension Icons ✅

Already created and configured in manifest:

- ✅ 16x16px - `icon-16.png`
- ✅ 48x48px - `icon-48.png`
- ✅ 128x128px - `icon-128.png`

### 2. Web Store Listing Icons (Need to Create)

#### Small Tile Icon (Required)

- **Size**: 128x128px
- **Format**: PNG
- **Use**: `packages/app-extension/src/icon-128.png` (already created)

#### Large Promotional Tile (Optional but Recommended)

- **Size**: 440x280px
- **Format**: PNG or JPEG
- **Content**: Create a promotional banner with X1 Wallet logo and tagline

#### Marquee Promotional Tile (Optional)

- **Size**: 1400x560px
- **Format**: PNG or JPEG
- **Content**: Large promotional banner

### 3. Screenshots (Required - at least 1, max 5)

- **Size**: 1280x800px or 640x400px (recommended 1280x800)
- **Format**: PNG or JPEG
- **Content**:
  1. Main wallet interface
  2. Token management screen
  3. Send/receive interface
  4. Settings screen
  5. Security features

## Extension Information

### Basic Info

- **Name**: X1 Wallet
- **Summary** (132 char max): "X1 Wallet - Designed for the Chains That Win. Secure Solana wallet for managing tokens, NFTs, and DeFi."
- **Description**:

```
X1 Wallet is a secure, user-friendly cryptocurrency wallet designed for the Solana blockchain and X1 network.

KEY FEATURES:
• Secure wallet management with PIN/biometric protection
• Support for Solana (SOL) and X1 tokens
• Send, receive, and swap tokens
• NFT management and viewing
• Hardware wallet support (Ledger)
• DeFi integration
• Built-in browser for dApps
• Multi-wallet support
• Import/export seed phrases and private keys

SECURITY:
• Non-custodial - you control your keys
• Encrypted local storage
• PIN and biometric authentication
• Secure seed phrase backup

PRIVACY:
X1 Wallet does not collect personal information. Your keys and data remain on your device.

Open source and community-driven.

Website: https://x1.xyz
Support: https://x1.xyz
Twitter: https://x.com/mrjacklevin
GitHub: https://github.com/jacklevin74
```

### Category

- **Primary**: Productivity
- **Secondary**: Developer Tools

### Language

- English (primary)
- Additional: Hindi (hi), Chinese (zh) translations available

### Privacy Policy (Required)

You need a publicly accessible URL with your privacy policy. Example content:

```markdown
# X1 Wallet Privacy Policy

## Data Collection

X1 Wallet does not collect, store, or transmit any personal information to external servers.

## Local Storage

All wallet data, including private keys and transaction history, is stored locally on your device using encrypted storage.

## Third-Party Services

The extension connects to:

- Solana RPC nodes for blockchain data
- X1 API (https://mobile-api.x1.xyz) for token metadata and pricing

## Security

Your private keys never leave your device and are encrypted using industry-standard encryption.

## Contact

For privacy concerns: https://x1.xyz
```

Host this at: `https://x1.xyz/privacy` or similar

## Pre-Submission Checklist

### Code Review

- [ ] All "Backpack" references replaced with "X1 Wallet" ✅
- [ ] All API URLs use HTTPS ✅
- [ ] No console.log or debug code in production
- [ ] Manifest version is correct (currently 0.10.63)

### Testing

- [ ] Test extension in Chrome browser
- [ ] Test all core features:
  - [ ] Create new wallet
  - [ ] Import wallet
  - [ ] Send tokens
  - [ ] Receive tokens
  - [ ] Connect to dApp
  - [ ] Sign transactions
  - [ ] Settings and security

### Assets

- [ ] Icons created ✅
- [ ] Screenshots captured (5 recommended)
- [ ] Promotional images created (optional)
- [ ] Privacy policy published

### Legal

- [ ] Privacy policy URL ready
- [ ] Terms of service (optional but recommended)

## Submission Steps

### 1. Register Developer Account

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay one-time $5 developer registration fee
3. Complete account setup

### 2. Upload Extension

1. In Developer Dashboard, click "New Item"
2. Upload ZIP file: `/home/jack/Downloads/x1-wallet-extension-[timestamp].zip`
3. Accept Developer Agreement

### 3. Fill Store Listing

1. **Product details**:
   - Language: English
   - Name: X1 Wallet
   - Summary: (see above)
   - Description: (see above)
   - Category: Productivity
2. **Graphic assets**:

   - Small tile icon (128x128): Upload `icon-128.png`
   - Screenshots: Upload 3-5 screenshots
   - Promotional tiles: Upload if created

3. **Additional fields**:
   - Privacy policy: Your hosted URL
   - Official URL: https://x1.xyz
   - Support URL: https://x1.xyz

### 4. Privacy Practices

- [ ] Declare any permissions usage
- [ ] Complete privacy questionnaire
- [ ] Confirm data handling practices

### 5. Distribution

- **Visibility**: Public
- **Regions**: Worldwide (or specific countries)
- **Pricing**: Free

### 6. Submit for Review

- Review all information
- Click "Submit for review"
- Typical review time: 1-3 business days

## Post-Submission

### Monitor Review Status

- Check dashboard for review updates
- Respond promptly to any feedback
- Address any policy violations

### After Approval

- Extension will be live on Chrome Web Store
- You'll receive a store URL like: `https://chrome.google.com/webstore/detail/[extension-id]`
- Share the link with users
- Monitor reviews and ratings

## Updating the Extension

### Version Updates

1. Update version in `packages/app-extension/src/manifest.json`
2. Rebuild: `yarn build:ext`
3. Create new ZIP
4. Upload to existing listing in dashboard
5. Submit for review

### Best Practices

- Increment version properly (0.10.63 → 0.10.64 for minor, 0.11.0 for features, 1.0.0 for major)
- Include changelog in update description
- Test thoroughly before submitting updates

## Common Rejection Reasons

1. **Permissions**: Requesting unnecessary permissions
2. **Privacy Policy**: Missing or inadequate privacy policy
3. **Functionality**: Extension doesn't work as described
4. **Content**: Misleading descriptions or screenshots
5. **Code**: Using eval() or remote code
6. **Branding**: Trademark issues or impersonation

## Support & Resources

- [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)

---

## Quick Commands

```bash
# Rebuild extension
cd /home/jack/backpack
yarn build:ext

# Create submission ZIP
zip -r /home/jack/Downloads/x1-wallet-extension-v0.10.63.zip packages/app-extension/build/

# Check icon sizes
file packages/app-extension/src/icon-*.png
```

## Current Status

- [x] Extension built and ready
- [x] Icons created (16, 48, 128px)
- [x] Manifest updated with proper icons
- [ ] Screenshots captured
- [ ] Privacy policy published
- [ ] Developer account registered
- [ ] Store listing created
- [ ] Submitted for review
