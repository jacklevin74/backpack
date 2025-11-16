#!/usr/bin/env node

/**
 * X1 JSON Server for Backpack Wallet
 *
 * This server provides token balance, price data, and transaction activity for X1 blockchain wallets.
 * It responds to requests from the Backpack wallet extension.
 *
 * Endpoints:
 *
 * 1. GET /wallet/:address?providerId=X1
 *    Returns wallet balance and token data
 *    Response: { balance: number, tokens: [...] }
 *
 * 2. POST /transactions
 *    Returns transaction activity for a wallet
 *    Request: { address: string, providerId: string, limit: number, offset: number }
 *    Response: { transactions: [...], hasMore: boolean, totalCount: number }
 *
 * 3. POST /v2/graphql
 *    Handles GraphQL queries (priority fees, etc.)
 *
 * 4. GET /test
 *    Test page for wallet integration
 */

const http = require("http");
const https = require("https");
const url = require("url");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const PORT = 4000;
const X1_MAINNET_RPC_URL = "https://rpc.mainnet.x1.xyz";
const X1_TESTNET_RPC_URL = "https://rpc.testnet.x1.xyz";
const X1_LOCALNET_RPC_URL = "http://127.0.0.1:8901";
const SOLANA_MAINNET_RPC_URL =
  "https://capable-autumn-thunder.solana-mainnet.quiknode.pro/3d4ed46b454fa0ca3df983502fdf15fe87145d9e/";
const SOLANA_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const SOLANA_TESTNET_RPC_URL = "https://api.testnet.solana.com";
const SOLANA_LOCALNET_RPC_URL = "http://127.0.0.1:8899";
const XNT_PRICE = 1.0; // $1 per XNT
const DB_PATH = path.join(__dirname, "transactions.db");

// Balance cache to avoid hitting RPC too frequently
// Cache expires after 2 seconds for real-time updates
const balanceCache = new Map();
const CACHE_TTL_MS = 2000; // 2 seconds

// ============================================================================
// SQLite Database Setup
// ============================================================================

let db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("❌ Error opening database:", err);
        reject(err);
        return;
      }

      console.log("📁 Database connected:", DB_PATH);

      // Create transactions table
      db.run(
        `CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet_prefix TEXT NOT NULL,
          wallet_address TEXT NOT NULL,
          hash TEXT NOT NULL,
          type TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          amount TEXT,
          token_name TEXT,
          token_symbol TEXT,
          fee TEXT,
          fee_payer TEXT,
          description TEXT,
          error TEXT,
          source TEXT,
          nfts TEXT,
          provider_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hash, wallet_address)
        )`,
        (err) => {
          if (err) {
            console.error("❌ Error creating table:", err);
            reject(err);
            return;
          }

          // Create indexes
          db.run(
            `CREATE INDEX IF NOT EXISTS idx_wallet_prefix ON transactions(wallet_prefix)`,
            (err) => {
              if (err)
                console.error(
                  "Warning: Error creating wallet_prefix index:",
                  err
                );
            }
          );

          db.run(
            `CREATE INDEX IF NOT EXISTS idx_timestamp ON transactions(timestamp DESC)`,
            (err) => {
              if (err)
                console.error("Warning: Error creating timestamp index:", err);
            }
          );

          db.run(
            `CREATE INDEX IF NOT EXISTS idx_hash ON transactions(hash)`,
            (err) => {
              if (err)
                console.error("Warning: Error creating hash index:", err);
            }
          );

          // Create wallets table for tracking which wallets to index
          db.run(
            `CREATE TABLE IF NOT EXISTS wallets (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              address TEXT NOT NULL,
              network TEXT NOT NULL DEFAULT 'testnet',
              enabled INTEGER NOT NULL DEFAULT 1,
              last_indexed TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(address, network)
            )`,
            (err) => {
              if (err) {
                console.error("❌ Error creating wallets table:", err);
                reject(err);
                return;
              }

              db.run(
                `CREATE INDEX IF NOT EXISTS idx_wallet_address ON wallets(address)`,
                (err) => {
                  if (err)
                    console.error(
                      "Warning: Error creating wallet_address index:",
                      err
                    );
                }
              );

              db.run(
                `CREATE INDEX IF NOT EXISTS idx_wallet_network ON wallets(address, network)`,
                (err) => {
                  if (err)
                    console.error(
                      "Warning: Error creating wallet_network index:",
                      err
                    );
                }
              );

              console.log("✅ Database initialized");
              resolve();
            }
          );
        }
      );
    });
  });
}

// Get first 8 characters of wallet address as prefix
function getWalletPrefix(address) {
  return address.substring(0, 8).toLowerCase();
}

// Insert transaction into database
function insertTransaction(walletAddress, transaction, providerId) {
  return new Promise((resolve, reject) => {
    const prefix = getWalletPrefix(walletAddress);
    const nftsJson = transaction.nfts ? JSON.stringify(transaction.nfts) : null;

    const sql = `INSERT OR REPLACE INTO transactions
      (wallet_prefix, wallet_address, hash, type, timestamp, amount, token_name,
       token_symbol, fee, fee_payer, description, error, source, nfts, provider_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      prefix,
      walletAddress,
      transaction.hash,
      transaction.type,
      transaction.timestamp,
      transaction.amount,
      transaction.tokenName,
      transaction.tokenSymbol,
      transaction.fee,
      transaction.feePayer,
      transaction.description,
      transaction.error,
      transaction.source,
      nftsJson,
      providerId,
    ];

    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

// Get transactions for a wallet address
function getTransactions(walletAddress, providerId, limit = 50, offset = 0) {
  return new Promise((resolve, reject) => {
    const prefix = getWalletPrefix(walletAddress);

    const sql = `SELECT * FROM transactions
      WHERE wallet_prefix = ? AND provider_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?`;

    db.all(sql, [prefix, providerId, limit, offset], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      // Transform database rows to transaction objects
      const transactions = rows.map((row) => ({
        hash: row.hash,
        type: row.type,
        timestamp: row.timestamp,
        amount: row.amount,
        tokenName: row.token_name,
        tokenSymbol: row.token_symbol,
        fee: row.fee,
        feePayer: row.fee_payer,
        description: row.description,
        error: row.error,
        source: row.source,
        nfts: row.nfts ? JSON.parse(row.nfts) : [],
      }));

      resolve(transactions);
    });
  });
}

// Get total count of transactions for a wallet
function getTransactionCount(walletAddress, providerId) {
  return new Promise((resolve, reject) => {
    const prefix = getWalletPrefix(walletAddress);

    const sql = `SELECT COUNT(*) as count FROM transactions
      WHERE wallet_prefix = ? AND provider_id = ?`;

    db.get(sql, [prefix, providerId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.count);
      }
    });
  });
}

// ============================================================================
// Wallet Registry Functions
// ============================================================================

// Register a wallet for indexing
function registerWallet(address, network = "testnet", enabled = true) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT OR REPLACE INTO wallets (address, network, enabled)
      VALUES (?, ?, ?)`;

    db.run(sql, [address, network, enabled ? 1 : 0], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

// Get all wallets for indexing
function getRegisteredWallets() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT address, network, enabled, last_indexed
      FROM wallets
      ORDER BY created_at DESC`;

    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(
          rows.map((row) => ({
            address: row.address,
            network: row.network,
            enabled: row.enabled === 1,
            lastIndexed: row.last_indexed,
          }))
        );
      }
    });
  });
}

// Update last indexed timestamp
function updateLastIndexed(address, network) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE wallets SET last_indexed = ? WHERE address = ? AND network = ?`;
    const timestamp = new Date().toISOString();

    db.run(sql, [timestamp, address, network], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Auto-register wallet when it queries transactions (if not already registered)
function autoRegisterWallet(address, providerId) {
  return new Promise((resolve, reject) => {
    // Use the full providerId as network (e.g., "X1-mainnet", "SOLANA-mainnet")
    // This ensures wallets are indexed separately for each blockchain
    const network = providerId;

    const sql = `INSERT OR IGNORE INTO wallets (address, network, enabled)
      VALUES (?, ?, 1)`;

    db.run(sql, [address, network], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// ============================================================================
// Transaction Mock Data Functions
// ============================================================================

function createMockTransaction(index, offset = 0) {
  const types = [
    "SEND",
    "RECEIVE",
    "SWAP",
    "STAKE",
    "UNSTAKE",
    "NFT_MINT",
    "NFT_SALE",
  ];
  const now = new Date();
  const hoursAgo = (index + offset) * 3;
  const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

  const type = types[index % types.length];
  const isSend = type === "SEND";
  const isNFT = type.startsWith("NFT_");

  return {
    hash: `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
    type: type,
    timestamp: timestamp.toISOString(),
    amount: isNFT ? "1" : (Math.random() * 100).toFixed(2),
    tokenName: isNFT ? "Cool NFT Collection" : "X1 Token",
    tokenSymbol: isNFT ? "CNFT" : "XNT",
    fee: (Math.random() * 0.001).toFixed(6),
    feePayer: "mock" + Math.random().toString(36).substring(2, 15),
    description: getTransactionDescription(type, index),
    error: null,
    source: getTransactionSource(type),
    nfts: isNFT
      ? [
          {
            mint: "NFTmint" + Math.random().toString(36).substring(2, 15),
            name: `Cool NFT #${1000 + index}`,
            image: `https://example.com/nft/${1000 + index}.png`,
          },
        ]
      : [],
  };
}

function getTransactionDescription(type, index) {
  const descriptions = {
    SEND: ["Transfer to wallet", "Payment sent", "Sent to friend"],
    RECEIVE: ["Received payment", "Incoming transfer", "Payment received"],
    SWAP: ["Swapped XNT for USDC", "Token swap", "Exchanged tokens"],
    STAKE: ["Staked to validator", "Staking rewards", "Validator stake"],
    UNSTAKE: ["Unstaked tokens", "Withdrew stake", "Unstake from validator"],
    NFT_MINT: ["Minted NFT", "NFT created", "New NFT minted"],
    NFT_SALE: ["Sold NFT", "NFT sale", "NFT transferred"],
  };

  const options = descriptions[type] || ["Transaction"];
  return options[index % options.length];
}

function getTransactionSource(type) {
  if (type.startsWith("NFT_")) return "marketplace";
  if (type === "SWAP") return "dex";
  if (type === "STAKE" || type === "UNSTAKE") return "staking";
  return "wallet";
}

function getCachedBalance(address, network) {
  const cacheKey = `${address}-${network}`;
  const cached = balanceCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`  ⚡ Using cached balance for ${address}`);
    return cached.balance;
  }

  return null;
}

function setCachedBalance(address, network, balance) {
  const cacheKey = `${address}-${network}`;
  balanceCache.set(cacheKey, {
    balance,
    timestamp: Date.now(),
  });
}

// Oracle endpoint for real-time prices
const ORACLE_ENDPOINT = "http://oracle.mainnet.x1.xyz:3000/api/state";

// Get SOL price from Oracle (with caching)
let solPriceCache = { price: 158, timestamp: 0 }; // Default $158, cache for 5 minutes
async function getSolPrice() {
  const now = Date.now();
  if (now - solPriceCache.timestamp < 300000) {
    // 5 minutes
    return solPriceCache.price;
  }

  try {
    const response = await fetch(ORACLE_ENDPOINT);
    const data = await response.json();
    const solPrice = parseFloat(data.agg.SOL.avg);

    if (solPrice && solPrice > 0) {
      solPriceCache = { price: solPrice, timestamp: now };
      return solPrice;
    }

    // Fallback to cached price if invalid response
    return solPriceCache.price;
  } catch (error) {
    console.error("Error fetching SOL price from oracle:", error);
    return solPriceCache.price; // Return cached price on error
  }
}

// Fetch real balance from X1 or Solana RPC
async function getX1Balance(address, rpcUrl) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address],
    });

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    // Choose http or https based on URL protocol
    const protocol = rpcUrl.startsWith("https://") ? https : http;
    const req = protocol.request(rpcUrl, options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          if (response.result && response.result.value !== undefined) {
            // Convert lamports to XNT (9 decimals)
            const lamports = response.result.value;
            const xnt = lamports / 1e9;
            resolve(xnt);
          } else {
            reject(new Error("Invalid RPC response"));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Get wallet data with real balance from X1 RPC
async function getWalletData(address, network = "mainnet", blockchain = "x1") {
  // Determine RPC URL based on blockchain and network
  let rpcUrl;
  let tokenSymbol;
  let tokenName;

  if (blockchain === "solana") {
    // Solana blockchain
    if (network === "localnet") {
      rpcUrl = SOLANA_LOCALNET_RPC_URL;
    } else if (network === "devnet") {
      rpcUrl = SOLANA_DEVNET_RPC_URL;
    } else if (network === "testnet") {
      rpcUrl = SOLANA_TESTNET_RPC_URL;
    } else {
      rpcUrl = SOLANA_MAINNET_RPC_URL;
    }
    tokenSymbol = "SOL";
    tokenName = "Solana";
  } else {
    // X1 blockchain
    if (network === "localnet") {
      rpcUrl = X1_LOCALNET_RPC_URL;
    } else if (network === "testnet") {
      rpcUrl = X1_TESTNET_RPC_URL;
    } else {
      rpcUrl = X1_MAINNET_RPC_URL;
    }
    tokenSymbol = "XNT";
    tokenName = "X1 Native Token";
  }

  console.log(`  Using ${blockchain} ${network} RPC: ${rpcUrl}`);

  try {
    // Check cache first (cache key includes blockchain)
    let balance = getCachedBalance(address, `${blockchain}-${network}`);

    if (balance === null) {
      // Not in cache or expired, fetch from RPC
      balance = await getX1Balance(address, rpcUrl);
      setCachedBalance(address, `${blockchain}-${network}`, balance);
      console.log(
        `  Balance from ${blockchain.toUpperCase()} RPC: ${balance} ${tokenSymbol}`
      );
    }

    // Determine logo based on blockchain
    const logo = blockchain === "solana" ? "./solana.png" : "./x1.png";
    // Get real SOL price or use fixed XNT price
    const price = blockchain === "solana" ? await getSolPrice() : XNT_PRICE;
    // Use correct native token mint address based on blockchain
    const nativeMint =
      blockchain === "solana"
        ? "So11111111111111111111111111111111111111112" // SOL native mint
        : "XNT111111111111111111111111111111111111111"; // XNT native mint

    return {
      balance: balance,
      tokens: [
        {
          mint: nativeMint,
          decimals: 9,
          balance: balance,
          logo: logo,
          name: tokenName,
          symbol: tokenSymbol,
          price: price,
          valueUSD: balance * price,
        },
      ],
    };
  } catch (error) {
    console.error(`  ❌ Error fetching balance: ${error.message}`);
    // Return default data on error
    return {
      balance: 0,
      tokens: [
        {
          mint: "XNT111111111111111111111111111111111111111",
          decimals: 9,
          balance: 0,
          logo: "./x1.png",
          name: "X1 Native Token",
          symbol: "XNT",
          price: XNT_PRICE,
          valueUSD: 0,
        },
      ],
    };
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  // Handle OPTIONS request for CORS
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Handle feature gates endpoint
  if (pathname === "/feature-gates/gates" && req.method === "GET") {
    const response = {
      gates: {
        // Default feature gates - all features enabled
        // This mimics the official Backpack feature gates response
      },
    };
    res.writeHead(200);
    res.end(JSON.stringify(response));
    return;
  }

  // Handle GraphQL endpoint for priority fees
  if (pathname === "/v2/graphql" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const graphqlRequest = JSON.parse(body);
        console.log(`📊 GraphQL Query: ${graphqlRequest.operationName}`);

        // Handle GetSolanaPriorityFee query
        if (graphqlRequest.operationName === "GetSolanaPriorityFee") {
          const response = {
            data: {
              solanaPriorityFeeEstimate: "1000", // 1000 microlamports
            },
          };
          res.writeHead(200);
          res.end(JSON.stringify(response));
        } else {
          // Return empty data for other queries
          res.writeHead(200);
          res.end(JSON.stringify({ data: {} }));
        }
      } catch (error) {
        console.error(`GraphQL error: ${error.message}`);
        res.writeHead(400);
        res.end(
          JSON.stringify({ errors: [{ message: "Invalid GraphQL request" }] })
        );
      }
    });
    return;
  }

  // Handle /transactions endpoint for activity page
  if (pathname === "/transactions" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const requestData = JSON.parse(body);
        const {
          address,
          providerId,
          limit = 50,
          offset = 0,
          tokenMint,
        } = requestData;

        console.log(`\n📥 Transaction Activity Request:`);
        console.log(
          `   Address: ${address} (prefix: ${getWalletPrefix(address)})`
        );
        console.log(`   Provider: ${providerId}`);
        console.log(`   Limit: ${limit}, Offset: ${offset}`);
        if (tokenMint) console.log(`   Token Mint: ${tokenMint}`);

        const actualLimit = Math.min(limit, 50);

        // Auto-register wallet for indexing
        await autoRegisterWallet(address, providerId);

        // Fetch from database
        const transactions = await getTransactions(
          address,
          providerId,
          actualLimit,
          offset
        );
        const totalCount = await getTransactionCount(address, providerId);
        const hasMore = offset + transactions.length < totalCount;

        const response = {
          transactions,
          hasMore,
          totalCount,
          requestParams: {
            address,
            providerId,
            limit: actualLimit,
            offset,
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: "1.0.0",
          },
        };

        console.log(
          `✅ Returning ${transactions.length} transactions from DB (total: ${totalCount}, hasMore: ${hasMore})\n`
        );

        res.writeHead(200);
        res.end(JSON.stringify(response, null, 2));
      } catch (error) {
        console.error(`❌ Transaction request error: ${error.message}`);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: error.message,
          })
        );
      }
    });
    return;
  }

  // Handle GET /transactions/:address for activity page (alternative to POST)
  if (pathname.startsWith("/transactions/") && req.method === "GET") {
    (async () => {
      try {
        // Extract address from URL path
        const pathParts = pathname.split("/");
        const address = pathParts[2];

        // Parse query parameters
        const queryParams = new URLSearchParams(parsedUrl.search || "");
        const providerId = queryParams.get("providerId") || "X1-mainnet";
        const limit = Math.min(parseInt(queryParams.get("limit") || "50"), 50);
        const offset = parseInt(queryParams.get("offset") || "0");
        const tokenMint = queryParams.get("tokenMint");

        console.log(`\n📥 Transaction Activity Request (GET):`);
        console.log(
          `   Address: ${address} (prefix: ${getWalletPrefix(address)})`
        );
        console.log(`   Provider: ${providerId}`);
        console.log(`   Limit: ${limit}, Offset: ${offset}`);
        if (tokenMint) console.log(`   Token Mint: ${tokenMint}`);

        // Auto-register wallet for indexing
        await autoRegisterWallet(address, providerId);

        // Fetch from database
        const transactions = await getTransactions(
          address,
          providerId,
          limit,
          offset
        );
        const totalCount = await getTransactionCount(address, providerId);
        const hasMore = offset + transactions.length < totalCount;

        const response = {
          transactions,
          hasMore,
          totalCount,
          requestParams: {
            address,
            providerId,
            limit,
            offset,
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: "1.0.0",
          },
        };

        console.log(
          `✅ Returning ${transactions.length} transactions from DB (total: ${totalCount}, hasMore: ${hasMore})\n`
        );

        res.writeHead(200);
        res.end(JSON.stringify(response, null, 2));
      } catch (error) {
        console.error(`❌ GET Transaction request error: ${error.message}`);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: error.message,
          })
        );
      }
    })();
    return;
  }

  // Handle /transactions/store endpoint to add transactions to database
  if (pathname === "/transactions/store" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const requestData = JSON.parse(body);
        const { address, providerId, transactions } = requestData;

        if (
          !address ||
          !providerId ||
          !transactions ||
          !Array.isArray(transactions)
        ) {
          res.writeHead(400);
          res.end(
            JSON.stringify({
              error: "Bad Request",
              message:
                "Required fields: address, providerId, transactions (array)",
            })
          );
          return;
        }

        console.log(
          `\n💾 Storing ${transactions.length} transactions for ${getWalletPrefix(address)}`
        );

        const results = [];
        for (const tx of transactions) {
          try {
            const id = await insertTransaction(address, tx, providerId);
            results.push({ hash: tx.hash, id, status: "inserted" });
          } catch (err) {
            if (err.message.includes("UNIQUE constraint")) {
              results.push({ hash: tx.hash, status: "duplicate" });
            } else {
              results.push({
                hash: tx.hash,
                status: "error",
                error: err.message,
              });
            }
          }
        }

        const inserted = results.filter((r) => r.status === "inserted").length;
        const duplicates = results.filter(
          (r) => r.status === "duplicate"
        ).length;
        const errors = results.filter((r) => r.status === "error").length;

        console.log(
          `✅ Stored: ${inserted} inserted, ${duplicates} duplicates, ${errors} errors\n`
        );

        res.writeHead(200);
        res.end(
          JSON.stringify({
            success: true,
            inserted,
            duplicates,
            errors,
            results,
          })
        );
      } catch (error) {
        console.error(`❌ Store transaction error: ${error.message}`);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: error.message,
          })
        );
      }
    });
    return;
  }

  // Handle /wallets endpoint to list registered wallets
  if (pathname === "/wallets" && req.method === "GET") {
    (async () => {
      try {
        const wallets = await getRegisteredWallets();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify(
            {
              success: true,
              wallets,
              count: wallets.length,
            },
            null,
            2
          )
        );
      } catch (error) {
        console.error(`❌ Get wallets error: ${error.message}`);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: error.message,
          })
        );
      }
    })();
    return;
  }

  // Handle /wallets/register endpoint to manually register a wallet
  if (pathname === "/wallets/register" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const requestData = JSON.parse(body);
        const { address, network = "testnet", enabled = true } = requestData;

        if (!address) {
          res.writeHead(400);
          res.end(
            JSON.stringify({
              error: "Bad Request",
              message: "Required field: address",
            })
          );
          return;
        }

        await registerWallet(address, network, enabled);

        console.log(`✅ Registered wallet: ${address} (${network})`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify(
            {
              success: true,
              wallet: { address, network, enabled },
            },
            null,
            2
          )
        );
      } catch (error) {
        console.error(`❌ Register wallet error: ${error.message}`);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: error.message,
          })
        );
      }
    });
    return;
  }

  // Handle /wallets/update-indexed endpoint to update last indexed timestamp
  if (pathname === "/wallets/update-indexed" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const requestData = JSON.parse(body);
        const { address, network } = requestData;

        if (!address || !network) {
          res.writeHead(400);
          res.end(
            JSON.stringify({
              error: "Bad Request",
              message: "Required fields: address, network",
            })
          );
          return;
        }

        await updateLastIndexed(address, network);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
          })
        );
      } catch (error) {
        console.error(`❌ Update last indexed error: ${error.message}`);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: error.message,
          })
        );
      }
    });
    return;
  }

  // Handle Solana transaction scan endpoint
  if (
    pathname.startsWith("/solana/v0/") &&
    pathname.includes("/scan/transactions")
  ) {
    console.log(`🔍 Transaction scan request`);
    const response = {
      transactions: [],
    };
    res.writeHead(200);
    res.end(JSON.stringify(response));
    return;
  }

  // Handle Ethereum RPC proxy endpoint
  if (pathname === "/ethereum-rpc-proxy" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const rpcRequest = JSON.parse(body);
        console.log(`⚡ Ethereum RPC: ${rpcRequest.method}`);

        // Proxy to public Ethereum RPC
        const ETHEREUM_RPC = "https://eth.llamarpc.com";
        const postData = JSON.stringify(rpcRequest);

        const options = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        };

        const proxyReq = https.request(ETHEREUM_RPC, options, (proxyRes) => {
          let data = "";

          proxyRes.on("data", (chunk) => {
            data += chunk;
          });

          proxyRes.on("end", () => {
            res.writeHead(proxyRes.statusCode);
            res.end(data);
          });
        });

        proxyReq.on("error", (error) => {
          console.error(`Ethereum RPC error: ${error.message}`);
          res.writeHead(500);
          res.end(JSON.stringify({ error: "RPC proxy error" }));
        });

        proxyReq.write(postData);
        proxyReq.end();
      } catch (error) {
        console.error(`Ethereum RPC parse error: ${error.message}`);
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid RPC request" }));
      }
    });
    return;
  }

  // Handle feature gates endpoint
  if (pathname === "/feature-gates/gates" && req.method === "GET") {
    console.log(`🚩 Feature gates request`);
    // Return empty feature gates for localnet
    const response = {
      gates: [],
    };
    res.writeHead(200);
    res.end(JSON.stringify(response));
    return;
  }

  // Serve test page at /test
  if (pathname === "/test" || pathname === "/test/") {
    console.log(`🧪 Serving X1 test page`);
    const fs = require("fs");
    const path = require("path");
    const testPagePath = path.join(__dirname, "x1-test-signing.html");

    fs.readFile(testPagePath, "utf8", (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading test page");
        return;
      }

      res.setHeader("Content-Type", "text/html");
      res.writeHead(200);
      res.end(content);
    });
    return;
  }

  // Match /wallet/:address pattern
  const walletMatch = pathname.match(/^\/wallet\/([a-zA-Z0-9]+)$/);

  // Check if this is a supported request (X1 or Solana)
  const providerId = query.providerId || "";
  const isX1Request =
    providerId === "X1" ||
    providerId === "X1-localnet" ||
    providerId === "X1-testnet" ||
    providerId === "X1-mainnet";

  const isSolanaRequest =
    providerId === "SOLANA" ||
    providerId === "SOLANA-localnet" ||
    providerId === "SOLANA-mainnet" ||
    providerId === "SOLANA-devnet" ||
    providerId === "SOLANA-testnet";

  if (walletMatch && (isX1Request || isSolanaRequest)) {
    const address = walletMatch[1];
    // Determine network from providerId suffix or network query param
    let network = "mainnet";

    let blockchain = "x1"; // Default to X1

    if (isX1Request) {
      blockchain = "x1";
      if (providerId === "X1-localnet") {
        network = "localnet";
      } else if (providerId === "X1-testnet") {
        network = "testnet";
      } else if (providerId === "X1-mainnet") {
        network = "mainnet";
      } else if (query.network) {
        network = query.network;
      }
      console.log(
        `✅ X1 wallet request for address: ${address} on ${network} (providerId: ${providerId})`
      );
    } else {
      // Solana request - map to corresponding network
      blockchain = "solana";
      if (providerId === "SOLANA-localnet") {
        network = "localnet";
      } else if (providerId === "SOLANA-devnet") {
        network = "devnet";
      } else if (providerId === "SOLANA-testnet") {
        network = "testnet";
      } else {
        network = "mainnet";
      }
      console.log(
        `✅ Solana wallet request for address: ${address} on ${network} (providerId: ${providerId})`
      );
    }

    // Async call to get wallet data
    getWalletData(address, network, blockchain)
      .then((data) => {
        res.writeHead(200);
        res.end(JSON.stringify(data, null, 2));
      })
      .catch((error) => {
        console.error(`Error processing request: ${error.message}`);
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      });
  } else {
    console.log(`❌ Invalid request: ${pathname} (providerId: ${providerId})`);
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

// Initialize database then start server
initializeDatabase()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log("");
      console.log("=".repeat(80));
      console.log("🚀 X1 JSON Server Started with SQLite Database");
      console.log("=".repeat(80));
      console.log(
        `📡 Listening on: http://0.0.0.0:${PORT} (accessible from 162.250.126.66:${PORT})`
      );
      console.log(`💾 Database: ${DB_PATH}`);
      console.log("");
      console.log("📋 Endpoints:");
      console.log(
        `   GET  /wallet/:address?providerId=X1       - Wallet balance & tokens`
      );
      console.log(
        `   POST /transactions                        - Get transactions (from DB)`
      );
      console.log(
        `   POST /transactions/store                  - Store transactions to DB`
      );
      console.log(
        `   GET  /wallets                             - List registered wallets`
      );
      console.log(
        `   POST /wallets/register                    - Register wallet for indexing`
      );
      console.log(
        `   POST /v2/graphql                          - GraphQL queries`
      );
      console.log(`   GET  /test                                - Test page`);
      console.log("");
      console.log("Examples:");
      console.log(
        `  curl "http://localhost:${PORT}/wallet/5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5?providerId=X1"`
      );
      console.log("");
      console.log(`  curl -X POST http://localhost:${PORT}/transactions \\`);
      console.log(`    -H "Content-Type: application/json" \\`);
      console.log(
        `    -d '{"address":"5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5","providerId":"X1-testnet","limit":10,"offset":0}'`
      );
      console.log("");
      console.log(`🧪 Test Page: http://162.250.126.66:${PORT}/test`);
      console.log("");
      console.log("Press Ctrl+C to stop");
      console.log("=".repeat(80));
      console.log("");
    });
  })
  .catch((err) => {
    console.error("❌ Failed to initialize database:", err);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down X1 JSON Server...");
  server.close(() => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error("❌ Error closing database:", err);
        } else {
          console.log("💾 Database closed");
        }
        console.log("✅ Server stopped");
        process.exit(0);
      });
    } else {
      console.log("✅ Server stopped");
      process.exit(0);
    }
  });
});
