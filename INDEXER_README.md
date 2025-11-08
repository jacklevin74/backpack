# X1 Transaction Indexer

A service that automatically fetches transactions from the X1 blockchain and stores them in the SQLite database.

## Features

- ✅ Polls X1 RPC for new transactions every 30 seconds
- ✅ Fetches and parses transaction details
- ✅ Stores transactions via `/transactions/store` API
- ✅ Supports multiple wallet addresses
- ✅ Handles testnet and mainnet
- ✅ Duplicate detection and handling
- ✅ Error handling and retry logic
- ✅ Configurable polling interval

## How It Works

```
┌─────────────────┐
│  X1 Blockchain  │
│  (RPC Endpoint) │
└────────┬────────┘
         │
         │ 1. Poll for signatures
         │    (getSignaturesForAddress)
         │
         │ 2. Fetch transaction details
         │    (getTransaction)
         ▼
┌─────────────────┐
│   Transaction   │
│     Indexer     │
│ (This Service)  │
└────────┬────────┘
         │
         │ 3. Parse & format
         │
         │ 4. POST /transactions/store
         ▼
┌─────────────────┐
│ x1-json-server  │
│   (SQLite DB)   │
└─────────────────┘
```

## Configuration

Edit the `CONFIG` object in `transaction-indexer.js`:

```javascript
const CONFIG = {
  // RPC endpoints
  X1_TESTNET_RPC: 'https://rpc.testnet.x1.xyz',
  X1_MAINNET_RPC: 'https://rpc.mainnet.x1.xyz',

  // API server
  API_SERVER: 'http://localhost:4000',

  // Poll every 30 seconds
  POLL_INTERVAL_MS: 30000,

  // Max signatures to fetch per poll
  MAX_SIGNATURES_PER_POLL: 50,

  // Wallets to index
  WALLETS: [
    {
      address: '5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5',
      network: 'testnet', // or 'mainnet'
      enabled: true
    },
    // Add more wallets here
    {
      address: 'AnotherWalletAddress...',
      network: 'mainnet',
      enabled: true
    }
  ]
};
```

## Adding Wallet Addresses

To index transactions for a wallet, add it to the `WALLETS` array:

```javascript
{
  address: 'YourWalletAddressHere',
  network: 'testnet',  // or 'mainnet'
  enabled: true        // set to false to temporarily disable
}
```

## Usage

### Prerequisites

1. **x1-json-server must be running:**
```bash
node x1-json-server.js
```

2. **Database must be initialized** (automatic on first server run)

### Starting the Indexer

```bash
node transaction-indexer.js
```

You should see:
```
================================================================================
🚀 X1 Transaction Indexer Started
================================================================================
📡 Testnet RPC: https://rpc.testnet.x1.xyz
📡 Mainnet RPC: https://rpc.mainnet.x1.xyz
🔗 API Server: http://localhost:4000
⏱️  Poll Interval: 30s
👛 Watching 1 wallet(s)
================================================================================

================================================================================
⏰ Polling cycle started: 2025-11-08T06:00:00.000Z
================================================================================

🔍 Indexing wallet: 5paZC1vV... (testnet)
   Found 5 signatures
   💾 Storing 5 transactions...
   ✅ Stored: 5 new, 0 duplicates, 0 errors

✓ Polling cycle complete. Next poll in 30s
```

### Running in Background

#### Option 1: PM2 (Recommended)
```bash
pm2 start transaction-indexer.js --name "x1-indexer"
pm2 save
pm2 logs x1-indexer
```

#### Option 2: nohup
```bash
nohup node transaction-indexer.js > indexer.log 2>&1 &
tail -f indexer.log
```

#### Option 3: systemd service
Create `/etc/systemd/system/x1-indexer.service`:
```ini
[Unit]
Description=X1 Transaction Indexer
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/backpack
ExecStart=/usr/bin/node transaction-indexer.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable x1-indexer
sudo systemctl start x1-indexer
sudo systemctl status x1-indexer
```

## Transaction Parsing

The indexer currently performs basic transaction parsing:

### Detected Transaction Types:
- **RECEIVE** - Balance increased
- **SEND** - Balance decreased
- **UNKNOWN** - Complex/unparsed transactions

### Parsed Fields:
- `hash` - Transaction signature
- `type` - Transaction type (SEND/RECEIVE/UNKNOWN)
- `timestamp` - Block time
- `amount` - XNT amount (calculated from balance change)
- `fee` - Transaction fee in XNT
- `feePayer` - First account key (approximate)
- `description` - Auto-generated description
- `error` - Error message if transaction failed

### Extending the Parser

To add more sophisticated parsing (swaps, stakes, NFTs, etc.), modify the `parseTransaction()` function:

```javascript
function parseTransaction(txData, signature) {
  const instructions = txData.transaction.message.instructions;

  // Check for DEX swap
  if (isDexSwap(instructions)) {
    return {
      hash: signature,
      type: 'SWAP',
      // ... parse swap details
    };
  }

  // Check for stake
  if (isStake(instructions)) {
    return {
      hash: signature,
      type: 'STAKE',
      // ... parse stake details
    };
  }

  // ... existing parsing logic
}
```

## Monitoring

### Check Indexer Status
```bash
# If using PM2
pm2 status x1-indexer
pm2 logs x1-indexer --lines 100

# If using systemd
sudo systemctl status x1-indexer
sudo journalctl -u x1-indexer -f

# If using nohup
tail -f indexer.log
```

### Check Database
```bash
sqlite3 transactions.db "SELECT COUNT(*) FROM transactions;"
sqlite3 transactions.db "SELECT wallet_prefix, COUNT(*) as count FROM transactions GROUP BY wallet_prefix;"
```

### API Stats
```bash
# Query transactions for a wallet
curl -X POST http://localhost:4000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "address":"5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    "providerId":"X1-testnet",
    "limit":10,
    "offset":0
  }'
```

## Troubleshooting

### No Transactions Being Indexed

**Check if wallet has transactions:**
```bash
# Test RPC directly
curl https://rpc.testnet.x1.xyz \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"getSignaturesForAddress",
    "params":["YourWalletAddress",{"limit":10}]
  }'
```

**Check indexer logs:**
```bash
pm2 logs x1-indexer
# or
tail -f indexer.log
```

**Verify API server is running:**
```bash
curl http://localhost:4000/transactions/store
# Should return: 400 Bad Request (expected without body)
```

### RPC Errors

If you see RPC errors:
- Check RPC endpoint is accessible
- Verify wallet address is correct
- Check if RPC is rate limiting

### Database Errors

If transactions aren't being stored:
- Check x1-json-server is running
- Verify SQLite database exists
- Check disk space

### High CPU/Memory Usage

Reduce polling frequency:
```javascript
POLL_INTERVAL_MS: 60000, // 1 minute instead of 30 seconds
MAX_SIGNATURES_PER_POLL: 20, // Fetch fewer signatures
```

## Performance

### Polling Frequency
- **30 seconds** (default) - Good for active wallets
- **60 seconds** - Good for moderate activity
- **5 minutes** - Good for low activity wallets

### Batch Size
- **50 signatures** (default) - Balances speed vs API load
- **100 signatures** - For high-volume wallets
- **10 signatures** - For low-volume or testing

### Memory Usage
- Minimal: ~50-100 MB
- Scales with number of wallets being indexed

## Deployment

### Local Development
```bash
# Terminal 1: Start server
node x1-json-server.js

# Terminal 2: Start indexer
node transaction-indexer.js
```

### Production (Remote Server)
```bash
# Copy files
scp transaction-indexer.js root@162.250.126.66:/root/
scp INDEXER_README.md root@162.250.126.66:/root/

# SSH to server
ssh root@162.250.126.66

# Install PM2 if needed
npm install -g pm2

# Start services
pm2 start x1-json-server.js --name "x1-server"
pm2 start transaction-indexer.js --name "x1-indexer"

# Save and enable auto-start
pm2 save
pm2 startup

# View logs
pm2 logs
```

## Advanced Configuration

### Multiple Networks
Index the same wallet on both testnet and mainnet:
```javascript
WALLETS: [
  {
    address: 'SameWallet123...',
    network: 'testnet',
    enabled: true
  },
  {
    address: 'SameWallet123...',
    network: 'mainnet',
    enabled: true
  }
]
```

### Historical Indexing
To index historical transactions, modify `indexWallet()` to not use `before`:
```javascript
// Fetch ALL signatures (not just new ones)
const signatures = await getSignaturesForAddress(
  rpcUrl,
  address,
  1000, // Larger limit
  null  // No 'before' filter
);
```

### Custom Transaction Filters
Filter by transaction type before storing:
```javascript
// Only store SEND/RECEIVE transactions
const filteredTransactions = transactions.filter(tx =>
  tx.type === 'SEND' || tx.type === 'RECEIVE'
);
```

## Next Steps

- [ ] Add more sophisticated transaction parsing (swaps, stakes, NFTs)
- [ ] Implement webhook support for real-time indexing
- [ ] Add transaction analytics and reporting
- [ ] Support for token transfers (SPL tokens)
- [ ] Add notification system for new transactions
- [ ] Implement database cleanup for old transactions
