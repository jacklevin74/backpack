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

const PORT = 4000;
const X1_MAINNET_RPC_URL = "https://rpc.mainnet.x1.xyz";
const X1_TESTNET_RPC_URL = "https://rpc.testnet.x1.xyz";
const XNT_PRICE = 1.0; // $1 per XNT

// Balance cache to avoid hitting RPC too frequently
// Cache expires after 2 seconds for real-time updates
const balanceCache = new Map();
const CACHE_TTL_MS = 2000; // 2 seconds

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

// Fetch real balance from X1 RPC
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

    const req = https.request(rpcUrl, options, (res) => {
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
async function getWalletData(address, network = "mainnet") {
  const rpcUrl =
    network === "testnet" ? X1_TESTNET_RPC_URL : X1_MAINNET_RPC_URL;
  console.log(`  Using ${network} RPC: ${rpcUrl}`);

  try {
    // Check cache first
    let balance = getCachedBalance(address, network);

    if (balance === null) {
      // Not in cache or expired, fetch from RPC
      balance = await getX1Balance(address, rpcUrl);
      setCachedBalance(address, network, balance);
      console.log(`  Balance from X1 RPC: ${balance} XNT`);
    }

    return {
      balance: balance,
      tokens: [
        {
          mint: "XNT111111111111111111111111111111111111111",
          decimals: 9,
          balance: balance,
          logo: "https://x1.xyz/_next/image?url=%2Fx1-logo.png&w=96&q=75&dpl=dpl_CgqrxgM4ijNMynKBvmQG3HnYr6yY",
          name: "X1 Native Token",
          symbol: "XNT",
          price: XNT_PRICE,
          valueUSD: balance * XNT_PRICE,
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
          logo: "https://x1.xyz/_next/image?url=%2Fx1-logo.png&w=96&q=75&dpl=dpl_CgqrxgM4ijNMynKBvmQG3HnYr6yY",
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

    req.on("end", () => {
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
        console.log(`   Address: ${address}`);
        console.log(`   Provider: ${providerId}`);
        console.log(`   Limit: ${limit}, Offset: ${offset}`);
        if (tokenMint) console.log(`   Token Mint: ${tokenMint}`);

        // Generate mock transactions
        const totalTransactions = 25; // Total mock transactions available
        const transactions = [];
        const actualLimit = Math.min(limit, 50);

        for (
          let i = 0;
          i < actualLimit && offset + i < totalTransactions;
          i++
        ) {
          transactions.push(createMockTransaction(i, offset));
        }

        const hasMore = offset + transactions.length < totalTransactions;

        const response = {
          transactions,
          hasMore,
          totalCount: totalTransactions,
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
          `✅ Returning ${transactions.length} transactions (hasMore: ${hasMore})\n`
        );

        res.writeHead(200);
        res.end(JSON.stringify(response, null, 2));
      } catch (error) {
        console.error(`❌ Transaction request error: ${error.message}`);
        res.writeHead(400);
        res.end(
          JSON.stringify({
            error: "Bad Request",
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

  // Check if this is an X1 request (either "X1", "X1-testnet", or "X1-mainnet")
  const providerId = query.providerId || "";
  const isX1Request =
    providerId === "X1" ||
    providerId === "X1-testnet" ||
    providerId === "X1-mainnet";

  if (walletMatch && isX1Request) {
    const address = walletMatch[1];
    // Determine network from providerId suffix or network query param
    let network = "mainnet";
    if (providerId === "X1-testnet") {
      network = "testnet";
    } else if (providerId === "X1-mainnet") {
      network = "mainnet";
    } else if (query.network) {
      network = query.network;
    }
    console.log(
      `✅ X1 wallet request for address: ${address} on ${network} (providerId: ${providerId})`
    );

    // Async call to get wallet data
    getWalletData(address, network)
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
    console.log(`❌ Invalid request: ${pathname}`);
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("=".repeat(80));
  console.log("🚀 X1 JSON Server Started");
  console.log("=".repeat(80));
  console.log(
    `📡 Listening on: http://0.0.0.0:${PORT} (accessible from 162.250.126.66:${PORT})`
  );
  console.log("");
  console.log("📋 Endpoints:");
  console.log(
    `   GET  /wallet/:address?providerId=X1     - Wallet balance & tokens`
  );
  console.log(
    `   POST /transactions                      - Transaction activity`
  );
  console.log(`   POST /v2/graphql                        - GraphQL queries`);
  console.log(`   GET  /test                              - Test page`);
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

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down X1 JSON Server...");
  server.close(() => {
    console.log("✅ Server stopped");
    process.exit(0);
  });
});
