#!/usr/bin/env node

/**
 * X1 JSON Server for Backpack Wallet
 *
 * This server provides token balance and price data for X1 blockchain wallets.
 * It responds to requests from the Apollo GraphQL interceptor in packages/common/src/apollo/index.ts
 *
 * Endpoint: GET /wallet/:address?providerId=X1
 *
 * Response format:
 * {
 *   balance: number,
 *   tokens: [{
 *     mint: string,
 *     decimals: number,
 *     balance: number,
 *     logo: string,
 *     name: string,
 *     symbol: string,
 *     price: number,
 *     valueUSD: number
 *   }]
 * }
 */

const http = require("http");
const https = require("https");
const url = require("url");

const PORT = 4000;
const X1_RPC_URL = "https://rpc.mainnet.x1.xyz";
const XNT_PRICE = 1.0; // $1 per XNT

// Fetch real balance from X1 RPC
async function getX1Balance(address) {
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

    const req = https.request(X1_RPC_URL, options, (res) => {
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
async function getWalletData(address) {
  try {
    const balance = await getX1Balance(address);
    console.log(`  Balance from X1 RPC: ${balance} XNT`);

    return {
      balance: balance,
      tokens: [
        {
          mint: "XNT111111111111111111111111111111111111111",
          decimals: 9,
          balance: balance,
          logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
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
          logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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

  // Match /wallet/:address pattern
  const walletMatch = pathname.match(/^\/wallet\/([a-zA-Z0-9]+)$/);

  if (walletMatch && query.providerId === "X1") {
    const address = walletMatch[1];
    console.log(`✅ X1 wallet request for address: ${address}`);

    // Async call to get wallet data
    getWalletData(address)
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

server.listen(PORT, () => {
  console.log("");
  console.log("=".repeat(80));
  console.log("🚀 X1 JSON Server Started");
  console.log("=".repeat(80));
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`📋 Endpoint: GET /wallet/:address?providerId=X1`);
  console.log("");
  console.log("Example:");
  console.log(
    `  curl "http://localhost:${PORT}/wallet/5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5?providerId=X1"`
  );
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
