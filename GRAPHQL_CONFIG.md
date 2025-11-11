# GraphQL API Configuration

This document explains how to configure the data source used by the Backpack extension for fetching Solana token balances and pricing.

## Overview

The extension supports two modes for Solana token data:

1. **Official Backpack GraphQL API** (default - NEW in PR #2)

   - URL: `https://backpack-api.xnfts.dev/v2/graphql`
   - Provides official Backpack token data with real-time pricing
   - **Solana**: Gets pricing from Backpack API
   - **X1**: Still uses X1 JSON Server

2. **X1 JSON Server** (old behavior - PRE PR #2)
   - URL: `http://162.250.126.66:4000`
   - Uses your local/custom server for ALL data
   - **Solana**: Gets pricing from X1 JSON Server
   - **X1**: Gets pricing from X1 JSON Server

## Important: PR #2 Changed Solana Behavior

**Before PR #2:**

- Solana queries → X1 JSON Server (your server)
- X1 queries → X1 JSON Server (your server)

**After PR #2 (current default):**

- Solana queries → Backpack GraphQL API (official API)
- X1 queries → X1 JSON Server (your server)

**This toggle restores the old behavior if needed.**

## Configuration

### Location

Configuration is in: `packages/common/src/constants.ts`

### Toggle Between Old and New Behavior

To switch between X1 JSON Server and Backpack GraphQL API for Solana:

1. Open `packages/common/src/constants.ts`

2. Find the `USE_X1_JSON_SERVER_FOR_SOLANA` constant (around line 451):

```typescript
// Toggle: Set to true to use X1 JSON Server for Solana queries (old behavior, pre-PR #2)
//         Set to false to use official Backpack GraphQL API for Solana queries (new behavior, PR #2)
export const USE_X1_JSON_SERVER_FOR_SOLANA = false;
```

3. Change the value:
   - `false` = Use Backpack GraphQL API for Solana (NEW behavior, PR #2)
   - `true` = Use X1 JSON Server for Solana (OLD behavior, pre-PR #2)

## How It Works

### Network Detection and Routing

The extension automatically routes queries based on network and configuration:

**X1 Networks (X1, X1-testnet, X1-mainnet):**

- **ALWAYS** → X1 JSON Server (`http://162.250.126.66:4000`)
- This behavior **never changes** regardless of toggle

**Solana Networks (SOLANA):**

- `USE_X1_JSON_SERVER_FOR_SOLANA = false` → Backpack GraphQL API (NEW behavior)
- `USE_X1_JSON_SERVER_FOR_SOLANA = true` → X1 JSON Server (OLD behavior)

### API Flow

```
Token Balance Request
        ↓
  Check providerId
        ↓
    ┌───────────────┴──────────────┐
    │                              │
X1 Network                   Solana Network
    │                              │
    ↓                              ↓
X1 JSON Server          Check USE_X1_JSON_SERVER_FOR_SOLANA
(ALWAYS)                           │
                          ┌────────┴────────┐
                          │                 │
                       false              true
                      (NEW)              (OLD)
                          │                 │
                          ↓                 ↓
                  Backpack GraphQL    X1 JSON Server
                      API
```

## Examples

### Example 1: Use Official Backpack API (Default - NEW Behavior)

```typescript
// In constants.ts
export const USE_X1_JSON_SERVER_FOR_SOLANA = false;
```

Result:

- Solana queries → `https://backpack-api.xnfts.dev/v2/graphql`
- X1 queries → `http://162.250.126.66:4000`

### Example 2: Use X1 JSON Server for Everything (OLD Behavior)

```typescript
// In constants.ts
export const USE_X1_JSON_SERVER_FOR_SOLANA = true;
```

Result:

- Solana queries → `http://162.250.126.66:4000`
- X1 queries → `http://162.250.126.66:4000`

This restores the pre-PR #2 behavior where everything went to your server.

### Example 3: Testing New Backpack API

To test the new Backpack GraphQL API with real Solana pricing:

```typescript
export const USE_X1_JSON_SERVER_FOR_SOLANA = false;
```

Then rebuild the extension:

```bash
source ~/.nvm/nvm.sh && nvm use 20.10.0
./build-clean.sh
```

## Testing

After changing the configuration:

1. **Rebuild the extension**:

   ```bash
   ./build-clean.sh
   ```

2. **Reload the extension** in Chrome:

   - Open `chrome://extensions/`
   - Click the reload icon for Backpack

3. **Check the console** for GraphQL URL:
   - Open extension popup
   - Right-click → Inspect
   - Console will show: `🌐 GraphQL URL: <url>`

## X1 JSON Server Requirements

If using X1 JSON Server for Solana queries (old behavior), your server must support the wallet balance endpoint:

**Endpoint Format:**

```
GET http://162.250.126.66:4000/wallet/{address}?providerId={SOLANA|X1|X1-testnet|X1-mainnet}
```

**Expected JSON Response:**

```json
{
  "balance": 1.5,
  "tokens": [
    {
      "mint": "So11111111111111111111111111111111111111112",
      "balance": 1.5,
      "decimals": 9,
      "name": "Wrapped SOL",
      "symbol": "SOL",
      "logo": "https://...",
      "price": 150.5,
      "valueUSD": 225.75
    }
  ]
}
```

The interceptor will transform this JSON response into GraphQL format automatically.

## Troubleshooting

### Issue: Extension not using custom URL

**Solution**: Make sure to rebuild the extension after changing configuration:

```bash
./build-clean.sh
```

### Issue: GraphQL query errors

**Check**:

1. Custom GraphQL server is running
2. Server implements the correct schema
3. Server accepts CORS requests from extension
4. Check browser console for detailed error messages

### Issue: Still seeing old URL in console

**Solution**:

1. Remove the extension completely from Chrome
2. Rebuild: `./build-clean.sh`
3. Reload unpacked extension

## Files Modified

- `packages/common/src/constants.ts` - Configuration constants
- `packages/common/src/apollo/index.ts` - Apollo Client setup
- `packages/data-components/src/components/Balances/index.tsx` - Token balance queries

## Related Documentation

- [BUILD_INSTRUCTIONS.md](./BUILD_INSTRUCTIONS.md) - How to build the extension
- [PR #2](https://github.com/jacklevin74/backpack/pull/2) - Solana GraphQL integration

---

**Last Updated**: November 10, 2025
