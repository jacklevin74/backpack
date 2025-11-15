// GraphQL Types for Backpack API
// Based on official Backpack GraphQL schema

/**
 * Provider ID for blockchain networks
 * For Solana, use "SOLANA" (without network suffix)
 * Backpack GraphQL API: https://backpack-api.xnfts.dev/v2/graphql
 */
export type ProviderId =
  | "SOLANA"           // Solana (all networks: mainnet/devnet/testnet)
  | "SOLANA-mainnet"   // Type-only for compatibility, use "SOLANA" for API calls
  | "SOLANA-devnet"    // Type-only for compatibility, use "SOLANA" for API calls
  | "SOLANA-testnet";  // Type-only for compatibility, use "SOLANA" for API calls

/**
 * Query variables for GetTokenBalances query
 */
export type GetTokenBalancesQueryVariables = {
  address: string;
  providerId: ProviderId;
};

/**
 * Token metadata from the token list
 * Contains display information like logo, name, symbol
 */
export type TokenListEntry = {
  __typename?: "TokenListEntry";
  id: string;
  address: string;
  decimals: number;
  logo?: string | null;
  name: string;
  symbol: string;
};

/**
 * Market data for a token
 * Contains price, value, and 24h change information
 */
export type MarketData = {
  __typename?: "MarketData";
  id: string;
  percentChange?: number | null;  // 24h percentage change
  price?: number | null;           // Current price in USD
  value?: number | null;           // Total value in USD (amount * price)
  valueChange?: number | null;     // 24h value change in USD
};

/**
 * Token balance information
 * Represents a single token in the wallet
 */
export type TokenBalance = {
  __typename?: "TokenBalance";
  id: string;
  address: string;              // Token mint address
  amount: string;               // Raw amount (with decimals)
  decimals: number;             // Number of decimal places
  displayAmount: string;        // Formatted amount for display
  marketData?: MarketData | null;
  token: string;                // Token account address
  tokenListEntry?: TokenListEntry | null;
};

/**
 * Edge wrapper for token balance in connection
 */
export type TokenBalanceEdge = {
  __typename?: "TokenBalanceEdge";
  node: TokenBalance;
};

/**
 * Connection type for paginated token balances
 */
export type TokenBalanceConnection = {
  __typename?: "TokenBalanceConnection";
  edges: TokenBalanceEdge[];
};

/**
 * Aggregate balance information
 * Total portfolio value and 24h change
 */
export type BalanceAggregate = {
  __typename?: "BalanceAggregate";
  id: string;
  percentChange?: number | null;  // 24h percentage change for entire portfolio
  value: number;                  // Total portfolio value in USD
  valueChange?: number | null;    // 24h value change in USD for entire portfolio
};

/**
 * Wallet balances container
 * Contains both aggregate and individual token balances
 */
export type Balances = {
  __typename?: "Balances";
  id: string;
  aggregate?: BalanceAggregate | null;
  tokens?: TokenBalanceConnection | null;
};

/**
 * Wallet type
 * Top-level container for wallet data
 */
export type Wallet = {
  __typename?: "Wallet";
  id: string;
  balances?: Balances | null;
};

/**
 * GetTokenBalances query response
 * Main query response for fetching token balances
 */
export type GetTokenBalancesQuery = {
  __typename?: "Query";
  wallet?: Wallet | null;
};

/**
 * Response type for balance summary (aggregate data)
 * Used for displaying total portfolio value
 */
export type ResponseBalanceSummary = BalanceAggregate;

/**
 * Response type for individual token balance
 * Used for displaying token list rows
 */
export type ResponseTokenBalance = TokenBalance;
