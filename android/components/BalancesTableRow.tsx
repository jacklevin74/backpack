import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import type { ResponseTokenBalance } from "../apollo/types";

export type BalancesTableRowProps = {
  balance: ResponseTokenBalance;
  onPress?: () => void;
};

/**
 * Formats a number as USD currency
 */
function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a display amount with proper decimals
 */
function formatDisplayAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0";

  // For small amounts, show more decimals
  if (num < 0.01 && num > 0) {
    return num.toFixed(Math.min(8, decimals));
  }

  // For normal amounts, show 2-4 decimals
  return num.toFixed(Math.min(4, decimals));
}

/**
 * BalancesTableRow Component
 * Displays a single token balance row
 *
 * Features:
 * - Token logo (with fallback)
 * - Token symbol and name
 * - Display amount with decimals
 * - USD value
 * - 24h percentage change (color-coded)
 * - Touchable for navigation
 */
export const BalancesTableRow = ({
  balance,
  onPress,
}: BalancesTableRowProps) => {
  const {
    tokenListEntry,
    displayAmount,
    decimals,
    marketData,
  } = balance;

  const symbol = tokenListEntry?.symbol ?? "Unknown";
  const name = tokenListEntry?.name ?? "Unknown Token";
  const logo = tokenListEntry?.logo;
  const price = marketData?.price ?? 0;
  const value = marketData?.value ?? 0;
  const percentChange = marketData?.percentChange ?? 0;

  const isPositive = percentChange >= 0;
  const changeColor = isPositive ? "#00C853" : "#FF3B30"; // Green or Red

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Token Logo */}
      <View style={styles.logoContainer}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>
              {symbol.charAt(0)}
            </Text>
          </View>
        )}
      </View>

      {/* Token Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.symbol}>{symbol}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>

      {/* Balance and Value */}
      <View style={styles.valueContainer}>
        <Text style={styles.balance}>
          {formatDisplayAmount(displayAmount, decimals)}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.usdValue}>{formatUSD(value)}</Text>
          {percentChange !== 0 && (
            <Text style={[styles.percentChange, { color: changeColor }]}>
              {" "}
              {isPositive ? "↗" : "↘"} {isPositive ? "+" : ""}
              {percentChange.toFixed(2)}%
            </Text>
          )}
        </View>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  logoContainer: {
    marginRight: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholderText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  infoContainer: {
    flex: 1,
    marginRight: 12,
  },
  symbol: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  name: {
    fontSize: 13,
    color: "#8E8E93",
  },
  valueContainer: {
    alignItems: "flex-end",
  },
  balance: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  usdValue: {
    fontSize: 13,
    color: "#8E8E93",
  },
  percentChange: {
    fontSize: 13,
    fontWeight: "600",
  },
});
