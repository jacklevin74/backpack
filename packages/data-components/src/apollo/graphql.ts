// GraphQL Types for Backpack API
export type ProviderId =
  // Backpack GraphQL API (https://backpack-api.xnfts.dev/v2/graphql) accepts:
  | "SOLANA"       // ✅ For all Solana networks (mainnet/devnet/testnet)
  | "ETHEREUM"     // ✅ For all Ethereum networks
  // X1 REST API (http://162.250.126.66:4000) accepts:
  | "X1"           // ✅ X1 blockchain (legacy format)
  | "X1-mainnet"   // ✅ X1 mainnet (with network suffix)
  | "X1-testnet"   // ✅ X1 testnet (with network suffix)
  // TypeScript compatibility (NOT accepted by Backpack GraphQL API):
  | "SOLANA-mainnet"   // ⚠️ Type-only, use "SOLANA" for actual API calls
  | "SOLANA-devnet"    // ⚠️ Type-only, use "SOLANA" for actual API calls
  | "SOLANA-testnet"   // ⚠️ Type-only, use "SOLANA" for actual API calls
  | "ETHEREUM-mainnet" // ⚠️ Type-only, use "ETHEREUM" for actual API calls
  | "ETHEREUM-goerli"  // ⚠️ Type-only, use "ETHEREUM" for actual API calls
  | "ETHEREUM-sepolia";// ⚠️ Type-only, use "ETHEREUM" for actual API calls

export type GetTokenBalancesQueryVariables = {
  address: string;
  providerId: ProviderId;
};

export type TokenListEntry = {
  __typename?: "TokenListEntry";
  id: string;
  address: string;
  decimals: number;
  logo?: string | null;
  name: string;
  symbol: string;
};

export type MarketData = {
  __typename?: "MarketData";
  id: string;
  percentChange?: number | null;
  price?: number | null;
  value?: number | null;
  valueChange?: number | null;
};

export type TokenBalance = {
  __typename?: "TokenBalance";
  id: string;
  address: string;
  amount: string;
  decimals: number;
  displayAmount: string;
  marketData?: MarketData | null;
  token: string;
  tokenListEntry?: TokenListEntry | null;
};

export type TokenBalanceEdge = {
  __typename?: "TokenBalanceEdge";
  node: TokenBalance;
};

export type TokenBalanceConnection = {
  __typename?: "TokenBalanceConnection";
  edges: TokenBalanceEdge[];
};

export type BalanceAggregate = {
  __typename?: "BalanceAggregate";
  id: string;
  percentChange?: number | null;
  value: number;
  valueChange?: number | null;
};

export type Balances = {
  __typename?: "Balances";
  id: string;
  aggregate?: BalanceAggregate | null;
  tokens?: TokenBalanceConnection | null;
};

export type Wallet = {
  __typename?: "Wallet";
  id: string;
  balances?: Balances | null;
};

export type GetTokenBalancesQuery = {
  __typename?: "Query";
  wallet?: Wallet | null;
};

// Additional query types for other components
export type GetTransactionsQuery = any;
export type GetTokensForWalletDetailsQuery = any;
export type GetNftSpotlightAggregateQuery = any;
export type GetCollectiblesQuery = any;
