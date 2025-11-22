# Local Server Development Guide

## Overview

This guide explains how to run the X1 JSON server locally for development with XNM token balance support.

## Features Added

- **XNM Token Balance**: Server now fetches XNM token balances directly from the blockchain
- **On-Chain Queries**: Uses `getParsedTokenAccountsByOwner` RPC method
- **Automatic Detection**: Only shows XNM token if balance > 0

## Setup

### 1. Start the Local Server

```bash
cd /home/jack/backpack
node x1-json-server.js
```

The server will start on port 4000 and display:

```
🚀 X1 JSON Server Started with SQLite Database
📡 Listening on: http://0.0.0.0:4000
```

### 2. Configure Port Forwarding (for Android device)

```bash
/home/jack/android-sdk/platform-tools/adb reverse tcp:4000 tcp:4000
/home/jack/android-sdk/platform-tools/adb reverse tcp:8081 tcp:8081
```

### 3. Update App Configuration

In `android/App.js`, the API_SERVER is set to:

```javascript
const API_SERVER = "http://localhost:4000"; // Local development server
```

### 4. Run the App

```bash
cd /home/jack/backpack/android
npx expo start --clear
```

## How It Works

### Server-Side (x1-json-server.js)

1. **Native Balance**: Fetches XNT balance via `getBalance` RPC call
2. **Token Accounts**: Queries all SPL token accounts via `getParsedTokenAccountsByOwner`
3. **XNM Detection**: Looks for mint address `AvNDf423kEmWNP6AZHFV7DkNG4YRgt6qbdyyryjaa4PQ`
4. **Response**: Returns array of tokens including XNM if found

Example response:

```json
{
  "balance": 8.99392902,
  "tokens": [
    {
      "mint": "XNT111111111111111111111111111111111111111",
      "decimals": 9,
      "balance": 8.99392902,
      "logo": "./x1.png",
      "name": "X1 Native Token",
      "symbol": "XNT",
      "price": 1,
      "valueUSD": 8.99392902
    },
    {
      "mint": "AvNDf423kEmWNP6AZHFV7DkNG4YRgt6qbdyyryjaa4PQ",
      "decimals": 9,
      "balance": 25.135530647,
      "logo": null,
      "logoUrl": null,
      "name": "XNM",
      "symbol": "XNM",
      "price": 0,
      "valueUSD": 0
    }
  ]
}
```

### Token Icons

- **XNT**: Uses X1 logo image (./x1.png)
- **XNM**: Uses text-based icon (displays "XNM" in a colored circle)

### Client-Side (android/App.js)

The app simply calls the REST API endpoint as before:

```javascript
const url = `${API_SERVER}/wallet/${address}?providerId=X1-testnet`;
```

The server handles all on-chain queries, keeping the app UI responsive.

## Testing

Test the server directly:

```bash
curl "http://localhost:4000/wallet/YOUR_ADDRESS?providerId=X1-testnet"
```

## Advantages

1. **No UI Blocking**: On-chain queries happen server-side
2. **Caching**: Server caches results for 2 seconds to reduce RPC calls
3. **Error Handling**: Graceful fallback if XNM fetch fails
4. **Scalability**: Easy to add more tokens in the future
5. **Performance**: App remains responsive during token queries

## Switching Back to Production

To use the production server:

```javascript
const API_SERVER = "https://mobile-api.x1.xyz";
```

## XNM Mint Address

- **X1 Testnet**: `AvNDf423kEmWNP6AZHFV7DkNG4YRgt6qbdyyryjaa4PQ`
- Token Program: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` (SPL Token Program)

## Troubleshooting

### Server not responding

```bash
# Check if server is running
ps aux | grep "node x1-json-server"

# Check server logs
tail -f nohup.out
```

### ADB port forwarding lost

```bash
# Re-establish port forwarding
/home/jack/android-sdk/platform-tools/adb reverse tcp:4000 tcp:4000
```

### Metro bundler connection

```bash
# Ensure Metro port is also forwarded
/home/jack/android-sdk/platform-tools/adb reverse tcp:8081 tcp:8081
```

## Server Logs

Watch server logs in real-time:

```bash
# If running in foreground, logs appear in terminal
# If running in background:
tail -f nohup.out
```

Look for these log messages:

- `✅ X1 wallet request for address: ...`
- `Fetching XNM token balance for ...`
- `Found token account - Mint: ...`
- `✅ Added XNM token: ...`

## Future Enhancements

- Add more SPL tokens by mint address
- Implement token metadata lookup
- Add token price feeds
- Cache token balances longer
- Support token filtering by value
