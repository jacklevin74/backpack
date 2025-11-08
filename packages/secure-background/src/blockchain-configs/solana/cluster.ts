export const DEFAULT_SOLANA_CLUSTER = "https://api.mainnet-beta.solana.com";
export const SolanaCluster = {
  MAINNET: DEFAULT_SOLANA_CLUSTER,
  DEVNET: "https://api.devnet.solana.com",
  TESTNET: "https://api.testnet.solana.com",
  DEFAULT: process.env.DEFAULT_SOLANA_CONNECTION_URL || DEFAULT_SOLANA_CLUSTER,
};
