#!/usr/bin/env node

/**
 * X1 Transaction Indexer
 *
 * This service polls the X1 blockchain RPC for new transactions and stores them
 * in the SQLite database via the x1-json-server API.
 *
 * Features:
 * - Polls X1 RPC for transaction signatures
 * - Fetches and parses transaction details
 * - Stores transactions in SQLite via /transactions/store endpoint
 * - Supports multiple wallet addresses
 * - Configurable polling interval
 * - Automatic retry on errors
 */

const https = require('https');

// Configuration
const CONFIG = {
  // X1 RPC endpoints
  X1_TESTNET_RPC: 'https://rpc.testnet.x1.xyz',
  X1_MAINNET_RPC: 'https://rpc.mainnet.x1.xyz',

  // API server endpoint
  API_SERVER: 'http://localhost:4000',

  // Polling configuration
  POLL_INTERVAL_MS: 30000, // 30 seconds
  MAX_SIGNATURES_PER_POLL: 50,

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,

  // Wallets to index (add your wallet addresses here)
  WALLETS: [
    {
      address: '5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5',
      network: 'testnet', // 'testnet' or 'mainnet'
      enabled: true
    }
    // Add more wallets here
  ]
};

// Track last processed signature for each wallet
const lastProcessedSignatures = new Map();

/**
 * Make RPC call to X1 blockchain
 */
function rpcCall(endpoint, method, params) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(endpoint, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error.message || 'RPC error'));
          } else {
            resolve(response.result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Fetch transaction signatures for an address
 */
async function getSignaturesForAddress(rpcUrl, address, limit = 50, before = null) {
  const params = [address, { limit }];
  if (before) {
    params[1].before = before;
  }

  return await rpcCall(rpcUrl, 'getSignaturesForAddress', params);
}

/**
 * Fetch transaction details
 */
async function getTransaction(rpcUrl, signature) {
  return await rpcCall(rpcUrl, 'getTransaction', [
    signature,
    {
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0
    }
  ]);
}

/**
 * Parse and format transaction for storage
 */
function parseTransaction(txData, signature) {
  try {
    const tx = txData.transaction;
    const meta = txData.meta;

    // Determine transaction type based on instructions
    let type = 'UNKNOWN';
    let amount = null;
    let description = null;

    // Simple heuristic - can be expanded
    if (meta && meta.postBalances && meta.preBalances) {
      const balanceChange = meta.postBalances[0] - meta.preBalances[0];
      if (balanceChange > 0) {
        type = 'RECEIVE';
        amount = (balanceChange / 1e9).toFixed(9);
        description = 'Received XNT';
      } else if (balanceChange < 0) {
        type = 'SEND';
        amount = (Math.abs(balanceChange) / 1e9).toFixed(9);
        description = 'Sent XNT';
      }
    }

    // Get timestamp
    const timestamp = txData.blockTime
      ? new Date(txData.blockTime * 1000).toISOString()
      : new Date().toISOString();

    // Get fee
    const fee = meta && meta.fee
      ? (meta.fee / 1e9).toFixed(9)
      : '0';

    return {
      hash: signature,
      type,
      timestamp,
      amount,
      tokenName: 'X1 Token',
      tokenSymbol: 'XNT',
      fee,
      feePayer: tx.message?.accountKeys?.[0]?.pubkey || null,
      description: description || `${type} transaction`,
      error: meta && meta.err ? JSON.stringify(meta.err) : null,
      source: 'wallet',
      nfts: []
    };
  } catch (error) {
    console.error(`Error parsing transaction ${signature}:`, error);

    // Return minimal transaction data
    return {
      hash: signature,
      type: 'UNKNOWN',
      timestamp: new Date().toISOString(),
      amount: null,
      tokenName: 'X1 Token',
      tokenSymbol: 'XNT',
      fee: '0',
      feePayer: null,
      description: 'Parse error',
      error: error.message,
      source: 'wallet',
      nfts: []
    };
  }
}

/**
 * Store transactions via API
 */
async function storeTransactions(address, providerId, transactions) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      address,
      providerId,
      transactions
    });

    const url = new URL(`${CONFIG.API_SERVER}/transactions/store`);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = require('http').request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Index transactions for a wallet
 */
async function indexWallet(wallet) {
  const { address, network, enabled } = wallet;

  if (!enabled) {
    console.log(`⏭️  Skipping disabled wallet: ${address.substring(0, 8)}...`);
    return;
  }

  const rpcUrl = network === 'mainnet'
    ? CONFIG.X1_MAINNET_RPC
    : CONFIG.X1_TESTNET_RPC;

  const providerId = network === 'mainnet' ? 'X1-mainnet' : 'X1-testnet';

  console.log(`\n🔍 Indexing wallet: ${address.substring(0, 8)}... (${network})`);

  try {
    // Fetch signatures
    const lastSig = lastProcessedSignatures.get(address);
    const signatures = await getSignaturesForAddress(
      rpcUrl,
      address,
      CONFIG.MAX_SIGNATURES_PER_POLL,
      lastSig
    );

    if (!signatures || signatures.length === 0) {
      console.log(`   No new transactions found`);
      return;
    }

    console.log(`   Found ${signatures.length} signatures`);

    // Fetch and parse transactions
    const transactions = [];
    for (const sigInfo of signatures) {
      try {
        const txData = await getTransaction(rpcUrl, sigInfo.signature);
        const parsed = parseTransaction(txData, sigInfo.signature);
        transactions.push(parsed);
      } catch (error) {
        console.error(`   ❌ Error fetching tx ${sigInfo.signature}:`, error.message);
      }
    }

    if (transactions.length === 0) {
      console.log(`   No transactions to store`);
      return;
    }

    // Store transactions
    console.log(`   💾 Storing ${transactions.length} transactions...`);
    const result = await storeTransactions(address, providerId, transactions);

    console.log(`   ✅ Stored: ${result.inserted} new, ${result.duplicates} duplicates, ${result.errors} errors`);

    // Update last processed signature
    if (signatures.length > 0) {
      lastProcessedSignatures.set(address, signatures[0].signature);
    }

  } catch (error) {
    console.error(`   ❌ Error indexing wallet:`, error.message);
  }
}

/**
 * Main polling loop
 */
async function pollAll() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`⏰ Polling cycle started: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(80)}`);

  for (const wallet of CONFIG.WALLETS) {
    try {
      await indexWallet(wallet);
    } catch (error) {
      console.error(`Error processing wallet ${wallet.address}:`, error);
    }
  }

  console.log(`\n✓ Polling cycle complete. Next poll in ${CONFIG.POLL_INTERVAL_MS / 1000}s\n`);
}

/**
 * Start the indexer
 */
async function start() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 X1 Transaction Indexer Started');
  console.log('='.repeat(80));
  console.log(`📡 Testnet RPC: ${CONFIG.X1_TESTNET_RPC}`);
  console.log(`📡 Mainnet RPC: ${CONFIG.X1_MAINNET_RPC}`);
  console.log(`🔗 API Server: ${CONFIG.API_SERVER}`);
  console.log(`⏱️  Poll Interval: ${CONFIG.POLL_INTERVAL_MS / 1000}s`);
  console.log(`👛 Watching ${CONFIG.WALLETS.filter(w => w.enabled).length} wallet(s)`);
  console.log('='.repeat(80) + '\n');

  // Run first poll immediately
  await pollAll();

  // Schedule recurring polls
  setInterval(pollAll, CONFIG.POLL_INTERVAL_MS);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down indexer...');
  console.log('✅ Indexer stopped');
  process.exit(0);
});

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});

// Start the indexer
start().catch((error) => {
  console.error('❌ Failed to start indexer:', error);
  process.exit(1);
});
