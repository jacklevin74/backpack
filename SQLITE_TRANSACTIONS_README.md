# SQLite Transaction Storage Implementation

## Overview

The X1 JSON Server now uses SQLite to store and retrieve transaction history. Transactions are indexed by the first 8 characters of wallet addresses for efficient lookup.

## Features

- ✅ SQLite database for persistent transaction storage
- ✅ Wallet prefix indexing (first 8 chars) for fast queries
- ✅ Duplicate transaction prevention (unique hash constraint)
- ✅ Pagination support
- ✅ Automatic database initialization
- ✅ Graceful shutdown with database cleanup

## Database Schema

### Table: `transactions`

```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_prefix TEXT NOT NULL,      -- First 8 chars of wallet address
  wallet_address TEXT NOT NULL,      -- Full wallet address
  hash TEXT NOT NULL UNIQUE,         -- Transaction signature (unique)
  type TEXT NOT NULL,                -- SEND, RECEIVE, SWAP, STAKE, etc.
  timestamp TEXT NOT NULL,           -- ISO 8601 timestamp
  amount TEXT,                       -- Transaction amount
  token_name TEXT,                   -- Token name
  token_symbol TEXT,                 -- Token symbol (e.g., XNT)
  fee TEXT,                          -- Transaction fee
  fee_payer TEXT,                    -- Fee payer address
  description TEXT,                  -- Human-readable description
  error TEXT,                        -- Error message if failed
  source TEXT,                       -- Source: wallet, dex, staking, marketplace
  nfts TEXT,                         -- JSON array of NFT data
  provider_id TEXT,                  -- Provider ID (e.g., X1-testnet)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

- `idx_wallet_prefix` - Fast lookup by wallet prefix
- `idx_timestamp` - Ordered by timestamp DESC for recent transactions
- `idx_hash` - Unique transaction hash lookup

## API Endpoints

### 1. GET Transactions

**Endpoint:** `POST /transactions`

Retrieves transactions from the database for a specific wallet.

**Request:**
```json
{
  "address": "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
  "providerId": "X1-testnet",
  "limit": 50,
  "offset": 0
}
```

**Response:**
```json
{
  "transactions": [...],
  "hasMore": false,
  "totalCount": 2,
  "requestParams": {...},
  "meta": {
    "timestamp": "2025-11-08T05:55:28.424Z",
    "version": "1.0.0"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:4000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "address":"5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    "providerId":"X1-testnet",
    "limit":10,
    "offset":0
  }'
```

### 2. Store Transactions

**Endpoint:** `POST /transactions/store`

Stores transactions in the database. Handles duplicates gracefully.

**Request:**
```json
{
  "address": "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
  "providerId": "X1-testnet",
  "transactions": [
    {
      "hash": "unique_tx_hash_123",
      "type": "SEND",
      "timestamp": "2025-11-07T14:23:45.000Z",
      "amount": "10.5",
      "tokenName": "X1 Token",
      "tokenSymbol": "XNT",
      "fee": "0.00005",
      "feePayer": "fee_payer_address",
      "description": "Transfer to wallet",
      "error": null,
      "source": "wallet",
      "nfts": []
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "inserted": 1,
  "duplicates": 0,
  "errors": 0,
  "results": [
    {
      "hash": "unique_tx_hash_123",
      "id": 1,
      "status": "inserted"
    }
  ]
}
```

**Example:**
```bash
curl -X POST http://localhost:4000/transactions/store \
  -H "Content-Type: application/json" \
  -d @test-store-tx.json
```

## Wallet Prefix Indexing

The system uses the first 8 characters of wallet addresses for indexing:

- **Address:** `5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5`
- **Prefix:** `5pazc1vv` (lowercase)

This allows:
- Fast queries without full address comparison
- Efficient indexing with minimal storage
- Isolation between different wallets

## Installation

### Dependencies

The server requires `sqlite3`:

```bash
# Install with yarn
yarn add sqlite3

# Or with npm
npm install sqlite3
```

### Database File

The database is automatically created at:
```
/home/jack/backpack/transactions.db
```

The server will initialize the database and create tables/indexes on first run.

## Usage

### Starting the Server

```bash
node x1-json-server.js
```

You should see:
```
📁 Database connected: /home/jack/backpack/transactions.db
✅ Database initialized

================================================================================
🚀 X1 JSON Server Started with SQLite Database
================================================================================
📡 Listening on: http://0.0.0.0:4000
💾 Database: /home/jack/backpack/transactions.db

📋 Endpoints:
   GET  /wallet/:address?providerId=X1       - Wallet balance & tokens
   POST /transactions                        - Get transactions (from DB)
   POST /transactions/store                  - Store transactions to DB
   ...
```

### Testing

1. **Store transactions:**
```bash
curl -X POST http://localhost:4000/transactions/store \
  -H "Content-Type: application/json" \
  -d '{
    "address": "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    "providerId": "X1-testnet",
    "transactions": [{
      "hash": "test123",
      "type": "SEND",
      "timestamp": "2025-11-07T14:23:45.000Z",
      "amount": "10.5",
      "tokenName": "X1 Token",
      "tokenSymbol": "XNT",
      "fee": "0.00005",
      "feePayer": "test_payer",
      "description": "Test",
      "error": null,
      "source": "wallet",
      "nfts": []
    }]
  }'
```

2. **Retrieve transactions:**
```bash
curl -X POST http://localhost:4000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "address":"5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    "providerId":"X1-testnet",
    "limit":10,
    "offset":0
  }'
```

## Deployment

### On Remote Server

1. **Copy server file:**
```bash
scp x1-json-server.js root@162.250.126.66:/root/
```

2. **Install dependencies:**
```bash
ssh root@162.250.126.66
cd /root
npm install sqlite3
```

3. **Start server:**
```bash
# With PM2 (recommended)
pm2 start x1-json-server.js --name "x1-server"
pm2 save

# Or with nohup
nohup node x1-json-server.js > server.log 2>&1 &
```

### Database Backup

To backup the database:
```bash
# On server
cp transactions.db transactions.db.backup

# Or download to local
scp root@162.250.126.66:/root/transactions.db ./transactions.db.backup
```

## Migration from Mock Data

The server no longer generates mock data. To populate the database:

1. **Fetch real transactions from X1 RPC**
2. **Format them according to the schema**
3. **POST to `/transactions/store`**

Example workflow:
```javascript
// Fetch from X1 RPC
const signatures = await getSignaturesForAddress(walletAddress);

// For each signature, get transaction details
for (const sig of signatures) {
  const tx = await getTransaction(sig);
  const formatted = formatTransaction(tx); // Format to match schema

  // Store in database
  await fetch('http://localhost:4000/transactions/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: walletAddress,
      providerId: 'X1-testnet',
      transactions: [formatted]
    })
  });
}
```

## Performance

### Indexing Benefits

- **Wallet prefix index:** O(log n) lookup by wallet
- **Timestamp index:** Ordered retrieval of recent transactions
- **Hash index:** Fast duplicate detection

### Recommended Limits

- **Query limit:** 50 transactions per request (enforced)
- **Store batch:** Up to 100 transactions per batch
- **Database size:** SQLite handles millions of rows efficiently

## Troubleshooting

### Database Locked Error

If you see "database is locked":
```bash
# Stop all server instances
pkill -f x1-json-server

# Wait a moment
sleep 2

# Restart
node x1-json-server.js
```

### Corrupted Database

If database is corrupted:
```bash
# Backup if possible
cp transactions.db transactions.db.corrupted

# Remove and restart (will recreate)
rm transactions.db
node x1-json-server.js
```

### Query Too Slow

If queries are slow:
```bash
# Check database size
ls -lh transactions.db

# Rebuild indexes
sqlite3 transactions.db "REINDEX;"

# Vacuum database
sqlite3 transactions.db "VACUUM;"
```

## Advanced Usage

### Direct Database Access

You can query the database directly:
```bash
sqlite3 transactions.db

# Count transactions by wallet prefix
SELECT wallet_prefix, COUNT(*) as count
FROM transactions
GROUP BY wallet_prefix;

# Recent transactions
SELECT hash, type, timestamp, amount
FROM transactions
ORDER BY timestamp DESC
LIMIT 10;

# Delete old transactions
DELETE FROM transactions
WHERE created_at < datetime('now', '-30 days');
```

### Custom Queries

Add custom endpoints in `x1-json-server.js`:
```javascript
// Example: Get transaction count by type
if (pathname === "/transactions/stats" && req.method === "GET") {
  db.all(
    `SELECT type, COUNT(*) as count
     FROM transactions
     GROUP BY type`,
    (err, rows) => {
      res.writeHead(200);
      res.end(JSON.stringify({ stats: rows }));
    }
  );
  return;
}
```

## Next Steps

- [ ] Implement automatic RPC polling to fetch new transactions
- [ ] Add transaction parsing for different instruction types
- [ ] Implement caching layer for frequently accessed data
- [ ] Add database compression for old transactions
- [ ] Implement multi-blockchain support
