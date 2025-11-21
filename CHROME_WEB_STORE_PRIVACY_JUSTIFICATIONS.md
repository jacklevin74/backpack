# Chrome Web Store Privacy Practices & Permission Justifications

## 📧 Account Setup (Complete First!)

1. Go to Account tab in Developer Dashboard
2. Enter your contact email
3. Verify your email (check inbox for verification link)

---

## Single Purpose Description

**Single Purpose Statement:**

```
X1 Wallet is a cryptocurrency wallet extension that enables users to securely manage Solana and X1 blockchain assets, including tokens and NFTs, directly from their browser.
```

---

## Permission Justifications

### 1. **alarms** Permission

**Justification:**

```
The alarms permission is used to periodically check and update token prices, wallet balances, and transaction statuses in the background. This ensures users always see up-to-date information when they open their wallet without requiring manual refresh.
```

**Use Case:**

- Update token prices every 5 minutes
- Refresh wallet balances automatically
- Check pending transaction status

---

### 2. **background** Permission

**Justification:**

```
The background permission is essential for maintaining persistent connection to blockchain networks and handling transaction signing requests from decentralized applications (dApps). The service worker runs in the background to respond to dApp requests, manage wallet state, and process blockchain interactions without requiring the popup to be open.
```

**Use Case:**

- Handle dApp connection requests
- Process transaction signing requests
- Maintain wallet state and blockchain connections
- Respond to web3 provider calls from websites

---

### 3. **storage** Permission

**Justification:**

```
The storage permission is used to securely store encrypted wallet data, user preferences, and cached blockchain data locally on the user's device. All private keys and sensitive information are encrypted before storage. No data is transmitted to external servers - everything remains on the user's device.
```

**What is Stored:**

- Encrypted private keys and seed phrases (locally only)
- User wallet addresses
- User preferences (language, currency, display settings)
- Cached token metadata and transaction history
- Network configuration settings

**Data Privacy:**

- All sensitive data is encrypted using industry-standard encryption
- Private keys NEVER leave the user's device
- No personal information is collected or transmitted

---

### 4. **Host Permissions** (`<all_urls>`)

**Justification:**

```
Host permissions for all URLs are required to inject the web3 provider into web pages, enabling the extension to connect with decentralized applications (dApps) across the internet. This is the core functionality of a crypto wallet - allowing users to interact with blockchain-based websites and applications. The extension only injects non-intrusive JavaScript that provides wallet connection capabilities and does not modify page content or collect user data.
```

**Use Case:**

- Inject web3 provider API into dApp websites
- Enable wallet connection to decentralized applications
- Facilitate blockchain transaction signing on any dApp
- Support multi-chain dApp interactions

**What We DO:**

- Inject wallet provider for dApp connectivity
- Listen for connection requests from websites
- Handle transaction signing requests

**What We DON'T DO:**

- Collect browsing history
- Modify website content
- Track user activity
- Send data to external servers

---

### 5. **Remote Code**

**Justification:**

```
X1 Wallet does NOT use remote code. All code is bundled within the extension package at build time. We do not fetch, load, or execute any code from remote servers. All JavaScript is statically included in the extension bundle and reviewed during the Chrome Web Store review process.
```

**Certification:**

- ✅ No eval() usage
- ✅ No remote script loading
- ✅ No dynamic code execution
- ✅ All code is part of the extension package

---

## Data Usage Certification

### Data Handling Practices

**Personal Data Collection:**

```
X1 Wallet does NOT collect any personal data. The extension operates entirely locally on the user's device.
```

**Financial Data:**

```
X1 Wallet handles financial transaction data (wallet addresses, transaction amounts) but:
- All data remains on the user's device
- Private keys are encrypted and stored locally
- Transaction data is only sent to blockchain RPC nodes (necessary for blockchain interaction)
- No financial data is sent to X1 Wallet servers or third parties
```

**Authentication Information:**

```
PIN codes and biometric authentication data are stored locally using browser secure storage APIs. No authentication information leaves the device.
```

**Website Content:**

```
X1 Wallet does not collect, read, or transmit any website content. The extension only interacts with websites when the user explicitly connects their wallet to a dApp.
```

**User Activity:**

```
X1 Wallet does not track, collect, or analyze user browsing activity or website visits.
```

---

## Privacy Practices Questionnaire Answers

### Does your extension collect or transmit user data?

**Answer:** YES (but only blockchain transaction data to blockchain networks)

### What user data does your extension handle?

**Select:**

- ✅ Financial and payment information (wallet addresses, transaction data)
- ✅ Authentication information (PIN codes - stored locally only)

**DO NOT SELECT:**

- ❌ Personally identifiable information
- ❌ Health information
- ❌ Website content
- ❌ Location data
- ❌ Web browsing activity
- ❌ User communications

### How is user data being used?

**Answer:**

```
User data is used exclusively for:
1. Blockchain transaction processing - wallet addresses and transaction data are sent to blockchain RPC nodes to execute user-requested transactions
2. Local wallet management - encrypted private keys stored locally for wallet access
3. Price and balance updates - wallet addresses sent to blockchain APIs to fetch current balances and token prices

NO data is used for:
- Analytics
- Personalization
- Advertising
- Marketing
- User profiling
```

### Is user data being transmitted off the user's device?

**Answer:** YES - Only blockchain transaction data (wallet addresses, transaction data) is transmitted to:

- Blockchain RPC nodes (Solana, X1 networks) - necessary for blockchain interaction
- Blockchain APIs for token prices and metadata

**NOT transmitted:**

- Private keys (always remain on device)
- PIN codes (always remain on device)
- Personal information (not collected)
- Browsing history (not collected)

### Is data being sold?

**Answer:** NO - X1 Wallet does not sell any user data.

### Is data being used for purposes unrelated to the item's core functionality?

**Answer:** NO - All data usage is directly related to cryptocurrency wallet functionality.

### Is data being transferred to third parties?

**Answer:** YES - Transaction data is sent to blockchain networks (this is necessary for a crypto wallet to function)

**Third parties:**

- Solana blockchain RPC nodes
- X1 blockchain RPC nodes
- Token metadata APIs

**Purpose:** Execute blockchain transactions and fetch blockchain data as requested by the user.

---

## Compliance Certification

### Developer Program Policies Compliance

**I certify that:**

- ✅ X1 Wallet does not collect personal information beyond what is necessary for functionality
- ✅ All data handling is disclosed in our privacy policy
- ✅ User data is not sold or used for unrelated purposes
- ✅ The extension's primary purpose is clearly stated
- ✅ All permissions are justified and necessary for core functionality
- ✅ No deceptive practices are used
- ✅ The extension respects user privacy

---

## Quick Checklist

Before submitting, ensure you have:

- [ ] Verified your contact email in Account tab
- [ ] Entered single purpose description
- [ ] Provided justification for **alarms** permission
- [ ] Provided justification for **background** permission
- [ ] Provided justification for **storage** permission
- [ ] Provided justification for **host permissions**
- [ ] Certified remote code usage (we don't use it)
- [ ] Completed data usage questionnaire
- [ ] Certified compliance with Developer Program Policies
- [ ] Published privacy policy at public URL

---

## Privacy Policy URL

Make sure you have published your privacy policy and enter the URL in the Chrome Web Store listing.

**Recommended URL:** `https://x1.xyz/privacy`

See `CHROME_WEB_STORE_SUBMISSION.md` for privacy policy template.

---

## Notes

- Be honest and accurate in all responses
- Chrome may request additional information during review
- Save as draft frequently while filling out forms
- Review all answers before final submission

Good luck with your submission! 🚀
