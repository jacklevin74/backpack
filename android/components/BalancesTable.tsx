import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ResponseTokenBalance } from "../apollo/types";
import { BalancesTableRow } from "./BalancesTableRow";

export type BalancesTableProps = {
  balances: ResponseTokenBalance[];
  enableColorfulIcons?: boolean;
  onItemClick?: (args: {
    id: string;
    displayAmount: string;
    symbol: string;
    token: string;
    tokenAccount: string;
  }) => void | Promise<void>;
};

/**
 * BalancesTable Component
 * Displays a scrollable list of token balances
 *
 * Features:
 * - FlatList for efficient rendering
 * - Shows each token with logo, name, balance, and market data
 * - Supports item click handlers
 * - Empty state when no tokens
 */
export const BalancesTable = ({
  balances,
  enableColorfulIcons = false,
  onItemClick,
}: BalancesTableProps) => {
  // Handle empty state
  if (!balances || balances.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No tokens found</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {balances.map((item) => (
        <BalancesTableRow
          key={item.id}
          balance={item}
          enableColorfulIcons={enableColorfulIcons}
          onPress={
            onItemClick
              ? () =>
                  onItemClick({
                    id: item.id,
                    displayAmount: item.displayAmount,
                    symbol: item.tokenListEntry?.symbol ?? "Unknown",
                    token: item.address,
                    tokenAccount: item.token,
                  })
              : undefined
          }
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    width: "100%",
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
  },
});
