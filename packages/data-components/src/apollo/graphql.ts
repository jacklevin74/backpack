// GraphQL Types for Backpack API
export type ProviderId =
  | "SOLANA-mainnet"
  | "SOLANA-devnet"
  | "SOLANA-testnet"
  | "ETHEREUM-mainnet"
  | "ETHEREUM-goerli"
  | "ETHEREUM-sepolia"
  | "X1-mainnet"
  | "X1-testnet"
  | "SOLANA"  // Legacy format for backward compatibility
  | "ETHEREUM"  // Legacy format for backward compatibility
  | "X1";  // Legacy format for backward compatibility

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
