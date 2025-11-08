# X1 JSON Server Deployment Guide

This guide covers deploying the updated `x1-json-server.js` with transaction activity support to your remote server.

## What's New

The server now includes a `/transactions` endpoint that provides mock transaction activity data for the Backpack wallet Activity page.

### New Features

- ✅ POST `/transactions` endpoint for activity data
- ✅ Mock transaction generation with multiple types (SEND, RECEIVE, SWAP, STAKE, etc.)
- ✅ Pagination support (limit/offset)
- ✅ Compatible with existing wallet balance endpoint

## Pre-Deployment Checklist

1. ✅ Build the wallet extension successfully
2. ✅ Test server locally (optional)
3. ✅ Have SSH access to `162.250.126.66`
4. ✅ Node.js installed on remote server

## Deployment Steps

### 1. Copy Server File to Remote

```bash
# From your local machine
scp x1-json-server.js root@162.250.126.66:/root/
```

### 2. SSH into Remote Server

```bash
ssh root@162.250.126.66
```

### 3. Stop Existing Server

```bash
# Find the process
ps aux | grep x1-json-server

# Kill it (replace <PID> with actual process ID)
kill <PID>

# Or use pkill
pkill -f x1-json-server
```

### 4. Start New Server

#### Option A: Run in foreground (for testing)

```bash
cd /root
node x1-json-server.js
```

You should see:

```
================================================================================
🚀 X1 JSON Server Started
================================================================================
📡 Listening on: http://0.0.0.0:4000 (accessible from 162.250.126.66:4000)

📋 Endpoints:
   GET  /wallet/:address?providerId=X1     - Wallet balance & tokens
   POST /transactions                      - Transaction activity
   POST /v2/graphql                        - GraphQL queries
   GET  /test                              - Test page
```

#### Option B: Run in background with PM2 (recommended)

```bash
# Install PM2 if not already installed
npm install -g pm2

# Start server with PM2
pm2 start x1-json-server.js --name "x1-server"

# Save PM2 configuration
pm2 save

# Enable startup on boot
pm2 startup

# Check status
pm2 status
```

#### Option C: Run in background with nohup

```bash
nohup node x1-json-server.js > server.log 2>&1 &

# Check if running
ps aux | grep x1-json-server

# View logs
tail -f server.log
```

### 5. Verify Server is Running

From your local machine or the server:

```bash
# Test wallet endpoint (existing functionality)
curl "http://162.250.126.66:4000/wallet/5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5?providerId=X1"

# Test new transactions endpoint
curl -X POST http://162.250.126.66:4000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "address": "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    "providerId": "X1-testnet",
    "limit": 10,
    "offset": 0
  }'
```

You should receive a JSON response with mock transactions.

## Testing with Wallet Extension

### 1. Ensure Extension is Built

The extension is already configured to use `http://162.250.126.66:4000` as defined in:

- `packages/common/src/constants.ts` (line 440)

### 2. Load Extension in Chrome

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Remove old Backpack extension if present
4. Click "Load unpacked"
5. Select: `/home/jack/backpack/packages/app-extension/build`
6. Verify version: `0.10.61`

### 3. Test Activity Page

1. Open Backpack wallet extension
2. Navigate to the Activity/Transactions tab
3. You should see mock transactions appear
4. Click "Load More" to test pagination
5. Check browser console (F12) for logs:
   - `🌐 [CustomTransactionHook] Fetching from...`
   - `✅ [CustomTransactionHook] Response: { count: X, hasMore: true/false }`

## Monitoring & Logs

### With PM2

```bash
# View logs
pm2 logs x1-server

# Monitor in real-time
pm2 monit

# Restart server
pm2 restart x1-server

# Stop server
pm2 stop x1-server
```

### With nohup

```bash
# View all logs
cat server.log

# Follow logs in real-time
tail -f server.log

# View last 50 lines
tail -n 50 server.log
```

### Server Logs Format

When a transaction request comes in, you'll see:

```
📥 Transaction Activity Request:
   Address: 5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5
   Provider: X1-testnet
   Limit: 50, Offset: 0
✅ Returning 25 transactions (hasMore: false)
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 4000
lsof -i :4000

# Kill the process
kill -9 <PID>
```

### Server Not Responding

```bash
# Check if server is running
ps aux | grep x1-json-server

# Check server logs
tail -n 100 server.log  # if using nohup
pm2 logs x1-server      # if using PM2

# Restart server
pm2 restart x1-server   # if using PM2
```

### No Transactions Showing in Wallet

1. Check browser console for errors (F12)
2. Verify server is accessible: `curl http://162.250.126.66:4000/transactions`
3. Check CORS headers are present in response
4. Verify `BACKEND_API_URL` in extension matches server address

### Firewall Issues

```bash
# Ensure port 4000 is open
sudo ufw allow 4000

# Or if using iptables
sudo iptables -A INPUT -p tcp --dport 4000 -j ACCEPT
```

## API Documentation

### POST /transactions

**Request:**

```json
{
  "address": "wallet_address",
  "providerId": "X1-testnet", // or "X1-mainnet", "SOLANA", etc.
  "limit": 50, // max: 50
  "offset": 0, // pagination offset
  "tokenMint": "optional_token_mint"
}
```

**Response:**

```json
{
  "transactions": [
    {
      "hash": "transaction_signature",
      "type": "SEND|RECEIVE|SWAP|STAKE|UNSTAKE|NFT_MINT|NFT_SALE",
      "timestamp": "2025-11-07T14:23:45.000Z",
      "amount": "2.5",
      "tokenName": "X1 Token",
      "tokenSymbol": "XNT",
      "fee": "0.00005",
      "feePayer": "fee_payer_address",
      "description": "Transfer to wallet",
      "error": null,
      "source": "wallet|dex|staking|marketplace",
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

## Next Steps: Real Transaction Data

Currently, the `/transactions` endpoint returns **mock data**. To implement real transaction data:

1. **Integrate with X1 Blockchain RPC**

   - Use similar approach to `getX1Balance()` function
   - Query transaction history from X1 RPC
   - Parse and format transactions

2. **Add Database/Cache Layer**

   - Store transaction history
   - Enable faster queries
   - Reduce RPC load

3. **Implement Transaction Parsing**
   - Decode transaction instructions
   - Identify transaction types
   - Extract relevant data

Example RPC call for transactions:

```javascript
// Get recent transactions for address
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getSignaturesForAddress",
  "params": [
    "address_here",
    {"limit": 50}
  ]
}
```

## Rollback Plan

If you need to revert to the old server:

1. Keep a backup of the old `x1-json-server.js`
2. If issues occur, copy the old file back
3. Restart the server

```bash
# Backup current version first
cp x1-json-server.js x1-json-server.js.backup

# If needed to rollback
cp x1-json-server.js.old x1-json-server.js
pm2 restart x1-server
```

## Support

If you encounter issues:

1. Check server logs first
2. Verify network connectivity
3. Test endpoints with curl
4. Check browser console for errors
5. Review this guide's troubleshooting section
