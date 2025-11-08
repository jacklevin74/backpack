# Quick Start Guide - X1 Transaction System

Complete setup for the X1 transaction storage and indexing system.

## Components

1. **x1-json-server.js** - API server with SQLite database
2. **transaction-indexer.js** - Automatic transaction indexer
3. **Backpack Wallet Extension** - Frontend UI

## Setup

### 1. Install Dependencies

```bash
cd /home/jack/backpack
yarn add sqlite3
```

### 2. Configure Wallets

Edit `transaction-indexer.js` to add your wallet addresses:

```javascript
WALLETS: [
  {
    address: 'YOUR_WALLET_ADDRESS_HERE',
    network: 'testnet',  // or 'mainnet'
    enabled: true
  }
]
```

### 3. Start the Server

```bash
node x1-json-server.js
```

You should see:
```
🚀 X1 JSON Server Started with SQLite Database
📡 Listening on: http://0.0.0.0:4000
💾 Database: /home/jack/backpack/transactions.db
```

### 4. Start the Indexer

In a new terminal:
```bash
node transaction-indexer.js
```

You should see:
```
🚀 X1 Transaction Indexer Started
👛 Watching X wallet(s)
⏰ Polling cycle started...
```

### 5. Load Wallet Extension

1. Build extension: `./build-clean.sh`
2. Open Chrome: `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked"
5. Select: `/home/jack/backpack/packages/app-extension/build`

### 6. View Transactions

Open the wallet extension and navigate to the Activity page. You should see transactions indexed from the blockchain!

## Production Deployment

### Copy Files to Server

```bash
scp x1-json-server.js root@162.250.126.66:/root/
scp transaction-indexer.js root@162.250.126.66:/root/
```

### Install Dependencies on Server

```bash
ssh root@162.250.126.66
cd /root
npm install sqlite3
npm install -g pm2
```

### Start Services with PM2

```bash
# Start server
pm2 start x1-json-server.js --name "x1-server"

# Start indexer
pm2 start transaction-indexer.js --name "x1-indexer"

# Save configuration
pm2 save

# Enable auto-start on reboot
pm2 startup

# View logs
pm2 logs
```

### Verify Everything Works

```bash
# Check services are running
pm2 status

# Check server
curl http://localhost:4000/transactions \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_WALLET","providerId":"X1-testnet","limit":10,"offset":0}'

# Check database
sqlite3 /root/transactions.db "SELECT COUNT(*) FROM transactions;"
```

## Monitoring

### PM2 Commands

```bash
pm2 status              # View all services
pm2 logs x1-server      # View server logs
pm2 logs x1-indexer     # View indexer logs
pm2 restart x1-server   # Restart server
pm2 stop x1-indexer     # Stop indexer
pm2 delete x1-indexer   # Remove from PM2
```

### Database Commands

```bash
# Open database
sqlite3 transactions.db

# Count transactions
SELECT COUNT(*) FROM transactions;

# Transactions by wallet
SELECT wallet_prefix, COUNT(*) as count
FROM transactions
GROUP BY wallet_prefix;

# Recent transactions
SELECT hash, type, timestamp, amount
FROM transactions
ORDER BY timestamp DESC
LIMIT 10;
```

## Troubleshooting

### Server Won't Start

- Check if port 4000 is in use: `lsof -i :4000`
- Check database permissions
- View logs: `pm2 logs x1-server`

### Indexer Not Finding Transactions

- Verify wallet address is correct
- Check RPC endpoint is accessible
- Ensure wallet has transactions on that network
- View logs: `pm2 logs x1-indexer`

### Extension Shows No Transactions

- Check server is running: `curl http://localhost:4000`
- Verify database has data: `sqlite3 transactions.db "SELECT COUNT(*) FROM transactions;"`
- Check browser console for errors (F12)
- Ensure `BACKEND_API_URL` in extension matches server address

## Architecture

```
┌──────────────────┐
│  X1 Blockchain   │
└────────┬─────────┘
         │
         │ RPC Polling (30s)
         ▼
┌──────────────────┐
│    Indexer       │
│ (Background)     │
└────────┬─────────┘
         │
         │ POST /transactions/store
         ▼
┌──────────────────┐
│  x1-json-server  │
│  (API + SQLite)  │
└────────┬─────────┘
         │
         │ POST /transactions
         ▼
┌──────────────────┐
│ Wallet Extension │
│  (Activity Page) │
└──────────────────┘
```

## File Structure

```
backpack/
├── x1-json-server.js           # Main API server
├── transaction-indexer.js      # Background indexer
├── transactions.db             # SQLite database (auto-created)
├── SQLITE_TRANSACTIONS_README.md
├── INDEXER_README.md
├── QUICK_START.md             # This file
└── packages/
    └── app-extension/
        └── build/              # Wallet extension
```

## Next Steps

- [ ] Add more wallet addresses to index
- [ ] Customize transaction parsing in indexer
- [ ] Set up database backups
- [ ] Configure monitoring/alerting
- [ ] Optimize polling intervals based on wallet activity

## Support

- Server docs: `SQLITE_TRANSACTIONS_README.md`
- Indexer docs: `INDEXER_README.md`
- Deployment: `DEPLOYMENT_GUIDE.md`
