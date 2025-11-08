# Deployment Checklist

## ✅ Pre-Deployment Verification (Complete)

- [x] Frontend code refactored and consolidated
- [x] Backend transaction endpoint integrated
- [x] TypeScript compilation successful
- [x] Build completed without errors (v0.10.61)
- [x] Local server testing passed
- [x] Mock transactions endpoint tested
- [x] Pagination tested
- [x] Existing wallet endpoint verified working
- [x] Documentation created

## 📦 Ready to Deploy

### File to Deploy:

- **x1-json-server.js** (Updated with /transactions endpoint)

### Location:

- `/home/jack/backpack/x1-json-server.js`

## 🚀 Deployment Steps

### Step 1: Copy Server File

```bash
scp x1-json-server.js root@162.250.126.66:/root/
```

### Step 2: SSH to Server

```bash
ssh root@162.250.126.66
```

### Step 3: Stop Existing Server

```bash
# Find the process
ps aux | grep x1-json-server

# Kill it
pkill -f x1-json-server

# Verify it's stopped
ps aux | grep x1-json-server
```

### Step 4: Start New Server

**Option A: Quick Start (nohup)**

```bash
cd /root
nohup node x1-json-server.js > server.log 2>&1 &

# Get PID
echo $!

# Verify running
ps aux | grep x1-json-server
```

**Option B: Production Start (PM2 - Recommended)**

```bash
# Install PM2 if needed
npm install -g pm2

# Start server
pm2 start x1-json-server.js --name "x1-server"

# Save config
pm2 save

# Enable auto-start on reboot
pm2 startup

# Check status
pm2 status
```

### Step 5: Verify Server is Running

```bash
# Check process
ps aux | grep x1-json-server

# Test transactions endpoint
curl -X POST http://162.250.126.66:4000/transactions \
  -H "Content-Type: application/json" \
  -d '{"address":"test","providerId":"X1-testnet","limit":5,"offset":0}'

# Should return JSON with 5 transactions
```

## 🧪 Post-Deployment Testing

### On Server:

```bash
# 1. Check server logs
tail -f server.log          # if using nohup
pm2 logs x1-server          # if using PM2

# 2. Test wallet endpoint (existing functionality)
curl "http://162.250.126.66:4000/wallet/5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5?providerId=X1-testnet"

# 3. Test transactions endpoint (new functionality)
curl -X POST http://162.250.126.66:4000/transactions \
  -H "Content-Type: application/json" \
  -d '{"address":"5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5","providerId":"X1-testnet","limit":10,"offset":0}'

# 4. Test pagination
curl -X POST http://162.250.126.66:4000/transactions \
  -H "Content-Type: application/json" \
  -d '{"address":"test","providerId":"X1-testnet","limit":5,"offset":10}'
```

### From Local Machine:

#### 1. Load Extension in Chrome

```bash
# Extension is already built at:
/home/jack/backpack/packages/app-extension/build

# In Chrome:
1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Remove old Backpack if present
4. Click "Load unpacked"
5. Select: /home/jack/backpack/packages/app-extension/build
6. Verify version: 0.10.61
```

#### 2. Test in Wallet

- [ ] Open Backpack extension
- [ ] Create/import a wallet
- [ ] Navigate to Activity/Transactions tab
- [ ] Verify mock transactions appear
- [ ] Click "Load More" button
- [ ] Verify pagination works
- [ ] Check browser console (F12) for:
  - `🌐 [CustomTransactionHook] Fetching from: http://162.250.126.66:4000/transactions`
  - `✅ [CustomTransactionHook] Response: { count: X, hasMore: true/false }`
- [ ] Verify no errors in console

## 📊 Expected Results

### Server Logs (When Activity Page Loads):

```
[2025-11-08T05:36:06.066Z] POST /transactions

📥 Transaction Activity Request:
   Address: <wallet_address>
   Provider: X1-testnet
   Limit: 50, Offset: 0
✅ Returning 25 transactions (hasMore: false)
```

### Browser Console:

```
🌐 [CustomTransactionHook] Fetching from: http://162.250.126.66:4000/transactions
✅ [CustomTransactionHook] Response: { count: 25, hasMore: false }
```

### Activity Page UI:

- Shows list of transactions
- Each transaction displays:
  - Type/Description (e.g., "Transfer to wallet")
  - Timestamp (e.g., "2:45 PM" or "Nov 7, 2025")
  - Amount with symbol (e.g., "+10.0 XNT")
  - Fee (e.g., "0.00005 XNT")
- "Load More" button at bottom (if hasMore: true)
- Clicking transaction opens X1 explorer

## 🔍 Monitoring

### View Logs Continuously

```bash
# If using nohup
tail -f /root/server.log

# If using PM2
pm2 logs x1-server
```

### Check Server Status

```bash
# If using nohup
ps aux | grep x1-json-server

# If using PM2
pm2 status
pm2 monit
```

## 🐛 Troubleshooting

### Server Not Starting

```bash
# Check if port 4000 is already in use
lsof -i :4000

# Kill the process using port 4000
kill -9 <PID>

# Try starting again
node x1-json-server.js
```

### Transactions Not Showing in Wallet

1. Check browser console for errors (F12)
2. Verify server is running: `ps aux | grep x1-json`
3. Test endpoint manually: `curl http://162.250.126.66:4000/transactions`
4. Check server logs for incoming requests
5. Verify extension version is 0.10.61

### Server Running But No Response

1. Check firewall: `sudo ufw status`
2. Open port if needed: `sudo ufw allow 4000`
3. Verify server is listening on 0.0.0.0, not 127.0.0.1
4. Test from server: `curl localhost:4000/transactions`

## 📋 Rollback Plan

If issues occur:

```bash
# 1. Backup new version
cp /root/x1-json-server.js /root/x1-json-server.js.backup

# 2. Restore old version (if you have it)
cp /root/x1-json-server.js.old /root/x1-json-server.js

# 3. Restart server
pkill -f x1-json-server
nohup node x1-json-server.js > server.log 2>&1 &
```

## ✅ Success Criteria

Deployment is successful when:

- [ ] Server starts without errors
- [ ] All 4 endpoints respond correctly:
  - [ ] GET /wallet/:address?providerId=X1
  - [ ] POST /transactions
  - [ ] POST /v2/graphql
  - [ ] GET /test
- [ ] Wallet extension loads (v0.10.61)
- [ ] Activity page shows mock transactions
- [ ] "Load More" pagination works
- [ ] No errors in browser console
- [ ] Server logs show incoming requests

## 📞 Support Files

- **DEPLOYMENT_GUIDE.md** - Comprehensive deployment documentation
- **INTEGRATION_SUMMARY.md** - Complete implementation summary
- **MOCK_SERVER_README.md** - Mock server documentation
- **test-transactions-endpoint.sh** - Automated test script

## 🎯 Current Status

**Ready for Deployment** ✅

All code is tested and working locally. The updated `x1-json-server.js` is ready to deploy to your remote server at `162.250.126.66`.

## Next Action

Deploy the server and test with the wallet extension!

```bash
scp x1-json-server.js root@162.250.126.66:/root/
```
