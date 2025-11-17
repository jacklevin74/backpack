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
  enableColorfulIcons?: boolean;
  hideZeroBalanceTokens?: boolean;
  onBalanceUpdate?: (balanceUSD: string, gainLossData?: { percentChange: number; valueChange: number }, nativeBalance?: string) => void;
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
  enableColorfulIcons,
  hideZeroBalanceTokens,
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
        enableColorfulIcons={enableColorfulIcons}
        hideZeroBalanceTokens={hideZeroBalanceTokens}
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
  enableColorfulIcons,
  hideZeroBalanceTokens,
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
    const allBalances = data?.wallet?.balances?.tokens?.edges.map((e) => e.node) ?? [];

    // Filter out zero balance tokens if the setting is enabled
    if (hideZeroBalanceTokens) {
      return allBalances.filter((token) => {
        const amount = parseFloat(token.displayAmount || "0");
        const value = token.marketData?.value ?? 0;
        const price = token.marketData?.price ?? 0;

        // Calculate the displayed value (same logic as BalancesTableRow)
        const calculatedValue = amount * price;
        const displayValue = value > 0 ? value : calculatedValue;

        // Hide tokens that would display as $0.00 (less than $0.005 rounds to $0.00)
        // Also hide if token amount is effectively zero
        return displayValue >= 0.005 && amount > 0;
      });
    }

    return allBalances;
  }, [data, hideZeroBalanceTokens]);

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

      // Find native token balance (first token with native=true or displayAmount)
      const nativeToken = balances.find((token) => token.token === "So11111111111111111111111111111111111111112") || balances[0];
      const nativeBalance = nativeToken?.displayAmount || "0";

      onBalanceUpdate(formattedBalance, gainLossData, nativeBalance);
    }
  }, [aggregate.value, aggregate.percentChange, aggregate.valueChange, balances, onBalanceUpdate]);

  // Log error if present (for debugging)
  if (error) {
    console.error("Error fetching token balances:", error);
  }

  return (
    <View style={{ flex: 1, alignItems: "center", padding: 16 }}>
      <BalancesTable balances={balances} enableColorfulIcons={enableColorfulIcons} onItemClick={onItemClick} />
    </View>
  );
}
