import { Blockchain } from "@coral-xyz/common";
import {
  hiddenTokenAddresses,
  useBlockchainConnectionUrl,
} from "@coral-xyz/recoil";
import { backendApiUrl } from "@coral-xyz/recoil/src/atoms/preferences";
import { YStack } from "@coral-xyz/tamagui";
import {
  type ReactElement,
  type ReactNode,
  Suspense,
  useMemo,
  useState,
  useEffect,
} from "react";
import { useRecoilValue } from "recoil";

import {
  BalanceSummary,
  BalanceSummaryLoader,
  type BalanceSummaryProps,
} from "./BalanceSummary";
import { BalancesTable } from "./BalancesTable";
import type { ResponseBalanceSummary, ResponseTokenBalance } from "./utils";
import { gql } from "../../apollo";
import type { ProviderId } from "../../apollo/graphql";
import { usePolledSuspenseQuery } from "../../hooks";
import type { DataComponentScreenProps } from "../common";

export {
  BalanceDetails,
  type BalanceDetailsProps,
  TokenMarketInfoTable,
} from "./BalanceDetails";
export { BalancesTable } from "./BalancesTable";
export type { ResponseBalanceSummary, ResponseTokenBalance };

const DEFAULT_POLLING_INTERVAL_SECONDS = 60;

// GraphQL query for Solana token balances from Backpack API
export const GET_TOKEN_BALANCES_QUERY = gql(`
  query GetTokenBalances($address: String!, $providerId: ProviderID!) {
    wallet(address: $address, providerId: $providerId) {
      id
      balances {
        id
        aggregate {
          id
          percentChange
          value
          valueChange
        }
        tokens {
          edges {
            node {
              id
              address
              amount
              decimals
              displayAmount
              marketData {
                id
                percentChange
                price
                value
                valueChange
              }
              token
              tokenListEntry {
                id
                address
                decimals
                logo
                name
                symbol
              }
            }
          }
        }
      }
    }
  }
`);

export type TokenBalancesProps = DataComponentScreenProps & {
  address: string;
  onItemClick?: (args: {
    id: string;
    displayAmount: string;
    symbol: string;
    token: string;
    tokenAccount: string;
  }) => void | Promise<void>;
  providerId: ProviderId;
  summaryStyle?: BalanceSummaryProps["style"];
  tableFooterComponent?: ReactElement;
  tableLoaderComponent: ReactNode;
  widgets?: ReactNode;
};

export const TokenBalances = ({
  tableLoaderComponent,
  ...rest
}: TokenBalancesProps) => (
  <Suspense
    fallback={
      <YStack
        alignItems="center"
        gap={30}
        marginHorizontal={16}
        marginVertical={20}
      >
        <BalanceSummaryLoader />
        {tableLoaderComponent}
      </YStack>
    }
  >
    <_TokenBalances {...rest} />
  </Suspense>
);

function _TokenBalances({
  address,
  fetchPolicy,
  onItemClick,
  pollingIntervalSeconds,
  providerId,
  summaryStyle,
  tableFooterComponent,
  widgets,
}: Omit<TokenBalancesProps, "tableLoaderComponent">) {
  const hidden = useRecoilValue(
    hiddenTokenAddresses(providerId.toLowerCase() as Blockchain)
  );

  // Determine blockchain from providerId
  const blockchain = providerId.includes("SOLANA")
    ? Blockchain.SOLANA
    : providerId.includes("ETHEREUM")
      ? Blockchain.ETHEREUM
      : Blockchain.X1;

  // Get connection URL for the correct blockchain
  const connectionUrl = useBlockchainConnectionUrl(blockchain);
  const apiUrl = useRecoilValue(backendApiUrl);

  // Detect if this is a Solana network or X1 network
  const isSolanaNetwork = blockchain === Blockchain.SOLANA;
  const isX1Network = blockchain === Blockchain.X1;

  // Detect if we're on localnet (for either Solana or X1)
  const isSolanaLocalnet =
    connectionUrl &&
    (connectionUrl.includes("127.0.0.1:8899") ||
      connectionUrl.includes("localhost:8899"));
  const isX1Localnet =
    connectionUrl &&
    (connectionUrl.includes("127.0.0.1:8901") ||
      connectionUrl.includes("localhost:8901"));

  // Determine the correct providerId based on blockchain
  let finalProviderId = providerId;

  // For Solana: Check if localnet first
  if (blockchain === Blockchain.SOLANA) {
    if (isSolanaLocalnet) {
      // Use REST API for Solana localnet (via x1-json-server)
      finalProviderId = "SOLANA-localnet" as ProviderId;
    } else {
      // Use GraphQL API for mainnet/devnet/testnet
      finalProviderId = "SOLANA" as ProviderId;
    }
  }
  // For X1: Detect network from connection URL (X1 REST API supports network suffixes)
  else if (connectionUrl) {
    if (isX1Localnet) {
      finalProviderId = "X1-localnet" as ProviderId;
    } else if (connectionUrl.includes("x1.xyz")) {
      if (connectionUrl.includes("testnet")) {
        finalProviderId = "X1-testnet" as ProviderId;
      } else if (connectionUrl.includes("mainnet")) {
        finalProviderId = "X1-mainnet" as ProviderId;
      }
    }
  }

  // For Solana non-localnet networks: Use GraphQL
  // For X1 and Solana localnet: Use REST API (x1-json-server)
  return isSolanaNetwork && !isSolanaLocalnet ? (
    <SolanaTokenBalances
      address={address}
      fetchPolicy={fetchPolicy}
      onItemClick={onItemClick}
      pollingIntervalSeconds={pollingIntervalSeconds}
      providerId={finalProviderId}
      summaryStyle={summaryStyle}
      tableFooterComponent={tableFooterComponent}
      widgets={widgets}
      hidden={hidden}
    />
  ) : (
    <X1TokenBalances
      address={address}
      pollingIntervalSeconds={pollingIntervalSeconds}
      onItemClick={onItemClick}
      providerId={finalProviderId}
      summaryStyle={summaryStyle}
      tableFooterComponent={tableFooterComponent}
      widgets={widgets}
      hidden={hidden}
      connectionUrl={connectionUrl}
      apiUrl={apiUrl}
    />
  );
}

// Solana token balances using GraphQL (official Backpack API)
function SolanaTokenBalances({
  address,
  fetchPolicy,
  onItemClick,
  pollingIntervalSeconds,
  providerId,
  summaryStyle,
  tableFooterComponent,
  widgets,
  hidden,
}: Omit<TokenBalancesProps, "tableLoaderComponent"> & {
  hidden: string[] | null;
}) {
  const { data, error } = usePolledSuspenseQuery<
    import("../../apollo/graphql").GetTokenBalancesQuery,
    import("../../apollo/graphql").GetTokenBalancesQueryVariables,
    any
  >(
    pollingIntervalSeconds ?? DEFAULT_POLLING_INTERVAL_SECONDS,
    GET_TOKEN_BALANCES_QUERY,
    {
      fetchPolicy,
      errorPolicy: "all",
      variables: {
        address,
        providerId,
      },
    }
  );

  // Log GraphQL errors for debugging
  useEffect(() => {
    if (error) {
      console.error("❌ [SolanaTokenBalances] GraphQL Error:", error);
    }
  }, [error]);

  const { balances, omissions } = useMemo<{
    balances: ResponseTokenBalance[];
    omissions: { value: number; valueChange: number };
  }>(() => {
    let balances =
      data?.wallet?.balances?.tokens?.edges.map((e) => e.node) ?? [];

    const omissions = { value: 0, valueChange: 0 };
    if (hidden && hidden.length > 0) {
      balances = balances.filter((b) => {
        if (hidden.includes(b.token)) {
          omissions.value += b.marketData?.value ?? 0;
          omissions.valueChange += b.marketData?.valueChange ?? 0;
          return false;
        }
        return true;
      });
    }

    return { balances, omissions };
  }, [data, hidden]);

  const aggregate: ResponseBalanceSummary = useMemo(() => {
    const baseAggregate = data?.wallet?.balances?.aggregate;
    const aggregate: ResponseBalanceSummary = {
      id: baseAggregate?.id ?? "",
      percentChange: baseAggregate?.percentChange ?? 0,
      value: (baseAggregate?.value ?? 0) - omissions.value,
      valueChange: (baseAggregate?.valueChange ?? 0) - omissions.valueChange,
    };
    return aggregate;
  }, [data, omissions]);

  return (
    <YStack alignItems="center" gap={20} marginVertical={16}>
      <BalanceSummary style={summaryStyle} {...aggregate} />
      {widgets}
      <BalancesTable
        balances={balances}
        footerComponent={tableFooterComponent}
        onItemClick={onItemClick}
      />
    </YStack>
  );
}

// X1 token balances using REST API (x1-json-server)
function X1TokenBalances({
  address,
  pollingIntervalSeconds,
  onItemClick,
  providerId,
  summaryStyle,
  tableFooterComponent,
  widgets,
  hidden,
  connectionUrl,
  apiUrl,
}: Omit<TokenBalancesProps, "tableLoaderComponent" | "fetchPolicy"> & {
  hidden: string[] | null;
  connectionUrl: string | null;
  apiUrl: string;
}) {
  const [rawBalances, setRawBalances] = useState<ResponseTokenBalance[]>([]);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const url = `${apiUrl}/wallet/${address}?providerId=${providerId}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const nativeMintAddress = "11111111111111111111111111111111";

        // Transform JSON server response to token format
        const transformedTokens = data.tokens.map((token: any) => ({
          id: token.mint,
          address: token.mint,
          amount: Math.floor(
            token.balance * Math.pow(10, token.decimals)
          ).toString(),
          decimals: token.decimals,
          displayAmount: token.balance.toString(),
          token: token.mint,
          tokenListEntry: {
            id: token.symbol.toLowerCase(),
            address: token.mint,
            decimals: token.decimals,
            logo: token.logo,
            name: token.name,
            symbol: token.symbol,
          },
          marketData: {
            id: `${token.symbol.toLowerCase()}-market`,
            price: token.price,
            value: token.valueUSD,
            percentChange: 0,
            valueChange: 0,
          },
        }));

        setRawBalances(transformedTokens);
      } catch (error) {
        console.error("❌ [X1TokenBalances] Fetch error:", error);
        setRawBalances([]);
      }
    };

    fetchBalances();

    // Poll for updates
    const pollInterval =
      pollingIntervalSeconds ?? DEFAULT_POLLING_INTERVAL_SECONDS;
    if (typeof pollInterval === "number") {
      const interval = setInterval(fetchBalances, pollInterval * 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [address, providerId, pollingIntervalSeconds, apiUrl]);

  const { balances, omissions } = useMemo<{
    balances: ResponseTokenBalance[];
    omissions: { value: number; valueChange: number };
  }>(() => {
    let balances = rawBalances;

    // Override native token price to $1.00 for X1 blockchain (XNT)
    const nativeMintAddress = "11111111111111111111111111111111";
    balances = balances.map((balance) => {
      if (
        balance.token === nativeMintAddress &&
        balance.tokenListEntry?.symbol === "XNT"
      ) {
        const amount = parseFloat(balance.displayAmount || "0");
        const fixedPrice = 1.0;
        const fixedValue = amount * fixedPrice;

        return {
          ...balance,
          marketData: balance.marketData
            ? {
                ...balance.marketData,
                price: fixedPrice,
                value: fixedValue,
                percentChange: 0,
                valueChange: 0,
              }
            : null,
        };
      }
      return balance;
    });

    const omissions = { value: 0, valueChange: 0 };
    if (hidden && hidden.length > 0) {
      balances = balances.filter((b) => {
        if (hidden.includes(b.token)) {
          omissions.value += b.marketData?.value ?? 0;
          omissions.valueChange += b.marketData?.valueChange ?? 0;
          return false;
        }
        return true;
      });
    }

    return { balances, omissions };
  }, [rawBalances, hidden]);

  const aggregate: ResponseBalanceSummary = useMemo(() => {
    const totalValue = balances.reduce(
      (sum, b) => sum + (b.marketData?.value ?? 0),
      0
    );
    const totalValueChange = balances.reduce(
      (sum, b) => sum + (b.marketData?.valueChange ?? 0),
      0
    );

    const aggregate: ResponseBalanceSummary = {
      id: "",
      percentChange: totalValue > 0 ? (totalValueChange / totalValue) * 100 : 0,
      value: totalValue,
      valueChange: totalValueChange,
    };
    return aggregate;
  }, [balances]);

  return (
    <YStack alignItems="center" gap={20} marginVertical={16}>
      <BalanceSummary style={summaryStyle} {...aggregate} />
      {widgets}
      <BalancesTable
        balances={balances}
        footerComponent={tableFooterComponent}
        onItemClick={onItemClick}
      />
    </YStack>
  );
}
