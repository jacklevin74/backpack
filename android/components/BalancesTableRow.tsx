import React, { useState, useEffect } from "react";
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
  const apiPrice = marketData?.price ?? 0;

  // State for real-time price (for SOL and other tokens with incorrect API price)
  const [realPrice, setRealPrice] = useState<number>(apiPrice);

  // Fetch real SOL price from REST API if GraphQL price is $1 or less
  useEffect(() => {
    const fetchRealPrice = async () => {
      // Check if this is SOL and API price is suspiciously low
      if (symbol === "SOL" && apiPrice <= 1) {
        try {
          // Use a sample Solana address to fetch current SOL price from REST API
          const response = await fetch(
            "http://162.250.126.66:4000/wallet/So11111111111111111111111111111111111111112?providerId=SOLANA-mainnet"
          );
          const data = await response.json();
          // Extract SOL price from first token in response
          const solPrice = data?.tokens?.[0]?.price;
          if (solPrice && solPrice > 0) {
            setRealPrice(solPrice);
          }
        } catch (error) {
          console.error("Failed to fetch SOL price from REST API:", error);
          // Keep using API price as fallback
        }
      }
    };

    fetchRealPrice();
  }, [symbol, apiPrice]);

  // Use real price (fetched or API)
  const price = realPrice;

  // Calculate USD value: displayAmount * price
  // Use API value if available, otherwise calculate it
  const apiValue = marketData?.value ?? 0;
  const calculatedValue = parseFloat(displayAmount) * price;
  const value = apiValue > 0 && apiPrice > 1 ? apiValue : calculatedValue;

  const percentChange = marketData?.percentChange ?? 0;

  const isPositive = percentChange >= 0;
  const changeColor = isPositive ? "#00C853" : "#FF3B30"; // Green or Red
  const changeBackgroundColor = isPositive ? "rgba(0, 200, 83, 0.1)" : "rgba(255, 59, 48, 0.1)";

  const Container = onPress ? TouchableOpacity : View;

  // Calculate dollar change amount
  const dollarChange = value * (percentChange / 100);

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
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.balance} numberOfLines={1}>
          {formatDisplayAmount(displayAmount, decimals)} {symbol}
        </Text>
      </View>

      {/* USD Value and Change */}
      <View style={styles.valueContainer}>
        <Text style={styles.usdValue}>{formatUSD(value)}</Text>
        {percentChange !== 0 && (
          <View style={[styles.changeContainer, { backgroundColor: changeBackgroundColor }]}>
            <Text style={[styles.changeArrow, { color: changeColor }]}>
              {isPositive ? "▲" : "▼"}
            </Text>
            <Text style={[styles.percentChange, { color: changeColor }]}>
              ${Math.abs(dollarChange).toFixed(2)} ({isPositive ? "+" : ""}{percentChange.toFixed(2)}%)
            </Text>
          </View>
        )}
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
    borderRadius: 12,
    marginBottom: 4,
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
    gap: 4,
  },
  symbol: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  valueContainer: {
    alignItems: "flex-end",
    gap: 4,
  },
  balance: {
    fontSize: 12,
    color: "#888888",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  usdValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingLeft: 6,
    borderRadius: 6,
    gap: 3,
  },
  changeArrow: {
    fontSize: 10,
    fontWeight: "bold",
  },
  percentChange: {
    fontSize: 13,
    fontWeight: "600",
  },
});
