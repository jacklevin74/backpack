import React, { Suspense, useMemo, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import type { SuspenseQueryHookOptions } from "@apollo/client";
import { GET_TOKEN_BALANCES_QUERY } from "../apollo/queries";
import type {
  ProviderId,
  ResponseBalanceSummary,
  ResponseTokenBalance,
  GetTokenBalancesQuery,
  GetTokenBalancesQueryVariables,
} from "../apollo/types";
import { usePolledSuspenseQuery } from "../hooks/usePolledSuspenseQuery";
import { BalancesTable } from "./BalancesTable";

// Default polling interval: 60 seconds
const DEFAULT_POLLING_INTERVAL_SECONDS = 60;

export type TokenBalancesProps = {
  address: string;
  providerId: ProviderId;
  pollingIntervalSeconds?: number;
  onBalanceUpdate?: (balanceUSD: string, gainLossData?: { percentChange: number; valueChange: number }) => void;
  onItemClick?: (args: {
    id: string;
    displayAmount: string;
    symbol: string;
    token: string;
    tokenAccount: string;
  }) => void | Promise<void>;
};

/**
 * TokenBalances component with Suspense wrapper
 * Displays loading state while data is being fetched
 */
export const TokenBalances = ({
  address,
  providerId,
  pollingIntervalSeconds,
  onBalanceUpdate,
  onItemClick,
}: TokenBalancesProps) => {
  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      }
    >
      <_TokenBalances
        address={address}
        providerId={providerId}
        pollingIntervalSeconds={pollingIntervalSeconds}
        onBalanceUpdate={onBalanceUpdate}
        onItemClick={onItemClick}
      />
    </Suspense>
  );
};

/**
 * Internal TokenBalances component
 * Fetches and displays token balances with market data
 */
function _TokenBalances({
  address,
  providerId,
  pollingIntervalSeconds,
  onBalanceUpdate,
  onItemClick,
}: TokenBalancesProps) {
  // Normalize providerId to remove network suffix for Backpack API
  // Backpack GraphQL API only accepts "SOLANA" (not "SOLANA-mainnet" etc.)
  const normalizedProviderId = providerId.startsWith("SOLANA")
    ? "SOLANA"
    : providerId;

  // Fetch token balances with polling
  const { data, error } = usePolledSuspenseQuery<
    GetTokenBalancesQuery,
    GetTokenBalancesQueryVariables,
    Omit<SuspenseQueryHookOptions<GetTokenBalancesQuery, GetTokenBalancesQueryVariables>, "variables">
  >(
    pollingIntervalSeconds ?? DEFAULT_POLLING_INTERVAL_SECONDS,
    GET_TOKEN_BALANCES_QUERY,
    {
      errorPolicy: "all",
      variables: {
        address,
        providerId: normalizedProviderId as ProviderId,
      },
    }
  );

  // Extract token balances from GraphQL response
  const balances: ResponseTokenBalance[] = useMemo(() => {
    return data?.wallet?.balances?.tokens?.edges.map((e) => e.node) ?? [];
  }, [data]);

  // Extract aggregate balance summary from GraphQL response
  const aggregate: ResponseBalanceSummary = useMemo(() => {
    return (
      data?.wallet?.balances?.aggregate ?? {
        id: "",
        percentChange: 0,
        value: 0,
        valueChange: 0,
      }
    );
  }, [data]);

  // Call callback when aggregate balance changes
  useEffect(() => {
    if (onBalanceUpdate && aggregate.value !== undefined) {
      const formattedBalance = `$${aggregate.value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
      const gainLossData = {
        percentChange: aggregate.percentChange || 0,
        valueChange: aggregate.valueChange || 0,
      };
      onBalanceUpdate(formattedBalance, gainLossData);
    }
  }, [aggregate.value, aggregate.percentChange, aggregate.valueChange, onBalanceUpdate]);

  // Log error if present (for debugging)
  if (error) {
    console.error("Error fetching token balances:", error);
  }

  return (
    <View style={{ flex: 1, alignItems: "center", padding: 16 }}>
      <BalancesTable balances={balances} onItemClick={onItemClick} />
    </View>
  );
}
