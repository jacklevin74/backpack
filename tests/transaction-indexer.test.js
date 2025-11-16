const test = require("node:test");
const assert = require("assert/strict");

const {
  parseTransaction,
  extractTokenBalanceChange,
  formatTokenAmount,
} = require("../transaction-indexer");

test("formatTokenAmount trims trailing zeros and decimal places", () => {
  assert.equal(formatTokenAmount(0n, 9), "0");
  assert.equal(formatTokenAmount(1000000000n, 9), "1");
  assert.equal(formatTokenAmount(1050000000n, 9), "1.05");
});

test("extractTokenBalanceChange detects SPL token movements for the wallet owner", () => {
  const wallet = "Wallet1111111111111111111111111111111111111";
  const mint = "TokenMint1111111111111111111111111111111111";
  const accountKeys = [{ pubkey: "FeePayer1111111111111111111111111111111" }];
  const meta = {
    preTokenBalances: [
      {
        mint,
        owner: wallet,
        uiTokenAmount: { amount: "1000", decimals: 2 },
      },
    ],
    postTokenBalances: [
      {
        mint,
        owner: wallet,
        uiTokenAmount: { amount: "500", decimals: 2 },
      },
    ],
  };

  const change = extractTokenBalanceChange(meta, wallet, accountKeys);
  assert(change);
  assert.equal(change.type, "SEND");
  assert.equal(change.amount, "5");
  assert.equal(change.mint, mint);
});

test("parseTransaction prioritizes token balance changes over native lamport deltas", () => {
  const wallet = "Wallet1111111111111111111111111111111111111";
  const mint = "TokenMint1111111111111111111111111111111111";
  const txData = {
    blockTime: 1700000000,
    transaction: {
      message: {
        accountKeys: [
          { pubkey: "FeePayer1111111111111111111111111111111" },
          { pubkey: wallet },
        ],
      },
    },
    meta: {
      preTokenBalances: [
        {
          mint,
          owner: wallet,
          uiTokenAmount: { amount: "2000", decimals: 2 },
        },
      ],
      postTokenBalances: [
        {
          mint,
          owner: wallet,
          uiTokenAmount: { amount: "500", decimals: 2 },
        },
      ],
      preBalances: [2_000_000_000, 1_000_000_000],
      postBalances: [1_999_990_000, 900_000_000],
      fee: 5000,
    },
  };

  const parsed = parseTransaction(txData, "sig123", wallet, "solana");
  assert.equal(parsed.type, "SEND");
  assert.equal(parsed.amount, "15");
  assert.equal(parsed.tokenSymbol.startsWith(mint.slice(0, 4)), true);
  assert(parsed.description.includes("Sent"));
});

test("parseTransaction falls back to native balance changes when no token delta is present", () => {
  const wallet = "Wallet2222222222222222222222222222222222222";
  const txData = {
    blockTime: 1700000001,
    transaction: {
      message: {
        accountKeys: [
          { pubkey: "FeePayer2222222222222222222222222222222" },
          { pubkey: wallet },
        ],
      },
    },
    meta: {
      preBalances: [2_000_000_000, 1_000_000_000],
      postBalances: [1_999_000_000, 900_000_000],
      fee: 5000,
    },
  };

  const parsed = parseTransaction(txData, "sig456", wallet, "solana");
  assert.equal(parsed.type, "SEND");
  assert.equal(parsed.amount, (0.1).toFixed(9));
  assert.equal(parsed.tokenSymbol, "SOL");
});
