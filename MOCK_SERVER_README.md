# Mock REST Server for Transaction Testing

This directory contains mock server files for testing the custom transaction activity implementation.

## Files

1. **mock-transaction-response.json** - Example response format with 5 sample transactions
2. **mock-rest-server.js** - Full mock REST server that generates dynamic transaction data

## Quick Start

### Option 1: Use the Mock Server Script (Recommended)

Start the mock server on port 4000:

```bash
node mock-rest-server.js
```

The server will:

- Listen on `http://localhost:4000`
- Accept POST requests to `/transactions`
- Return dynamic mock transactions for any wallet address
- Support pagination with `limit` and `offset` parameters
- Generate 25 total mock transactions with different types

### Option 2: View Example Response

Check the example response format:

```bash
cat mock-transaction-response.json
```

## Testing with the Wallet Extension

### 1. Update Backend URL (if testing locally)

If you want to test with localhost instead of the production server, update the `BACKEND_API_URL` in:

`packages/common/src/constants.ts`:

```typescript
export const BACKEND_API_URL = "http://localhost:4000";
```

Then rebuild:

```bash
./build-clean.sh
```

### 2. Start the Mock Server

```bash
node mock-rest-server.js
```

You should see:

```
🚀 Mock REST Server Started
================================
📍 Listening on: http://localhost:4000
📡 Endpoint: POST /transactions
```

### 3. Load Extension in Chrome

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select: `/home/jack/backpack/packages/app-extension/build`

### 4. Test Transaction Activity

1. Open the Backpack wallet extension
2. Navigate to the Activity/Transactions tab
3. You should see 5 transactions initially
4. Click "Load More" to fetch additional transactions
5. Check the browser console for logs:
   - 🌐 Fetching requests
   - ✅ Successful responses
   - ❌ Any errors

## Request/Response Format

### Request (POST /transactions)

```json
{
  "address": "8xQ2vM9p7R3nK5wT6YzU4jL2sN1fP9cV7bH4gD3eA2mX",
  "providerId": "X1-testnet",
  "limit": 50,
  "offset": 0
}
```

### Response

```json
{
  "transactions": [
    {
      "hash": "transaction_signature_here",
      "type": "SEND",
      "timestamp": "2025-11-07T14:23:45.000Z",
      "amount": "2.5",
      "tokenName": "X1 Token",
      "tokenSymbol": "XNT",
      "fee": "0.00005",
      "feePayer": "fee_payer_address",
      "description": "Transfer to wallet",
      "error": null,
      "source": "wallet",
      "nfts": []
    }
  ],
  "hasMore": true,
  "totalCount": 25,
  "requestParams": {
    "address": "...",
    "providerId": "X1-testnet",
    "limit": 50,
    "offset": 0
  },
  "meta": {
    "timestamp": "2025-11-07T15:30:00.000Z",
    "version": "1.0.0"
  }
}
```

## Transaction Types

The mock server generates various transaction types:

- **SEND** - Outgoing transfers
- **RECEIVE** - Incoming transfers
- **SWAP** - Token swaps
- **STAKE** - Staking operations
- **UNSTAKE** - Unstaking operations
- **NFT_MINT** - NFT minting
- **NFT_SALE** - NFT sales

## Debugging

### Check Server Logs

The mock server logs all incoming requests:

```
📥 [2025-11-07T15:30:00.000Z] Request received:
   Address: 8xQ2vM9p7R3nK5wT6YzU4jL2sN1fP9cV7bH4gD3eA2mX
   Provider: X1-testnet
   Limit: 50, Offset: 0
✅ Returning 25 transactions (hasMore: false)
```

### Check Browser Console

Open Chrome DevTools (F12) and look for:

```
🌐 [CustomTransactionHook] Fetching from: http://localhost:4000/transactions
✅ [CustomTransactionHook] Response: { count: 25, hasMore: false }
```

### Common Issues

1. **CORS Errors**: The mock server includes CORS headers, but ensure no browser extensions are blocking requests

2. **Port Already in Use**:

   ```bash
   # Find process using port 4000
   lsof -i :4000
   # Kill it if needed
   kill -9 <PID>
   ```

3. **Connection Refused**: Make sure the mock server is running before testing

## Production Server

When ready to use your production server at `http://162.250.126.66:4000`, ensure:

1. The server implements the same request/response format
2. It handles the `/transactions` POST endpoint
3. CORS is properly configured
4. The server validates and maps `providerId` correctly

## Next Steps

1. Test with the mock server to verify UI behavior
2. Implement the same API contract on your production server
3. Update `BACKEND_API_URL` back to production when ready
4. Deploy and test with real blockchain data
