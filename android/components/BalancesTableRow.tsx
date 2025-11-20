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
import TokenIcon from "../src/components/TokenIcon";

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
    // Only fetch if this is SOL and API price is suspiciously low
    if (symbol !== "SOL" || apiPrice > 1) {
      return;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 3000); // 3s timeout

    const fetchRealPrice = async () => {
      try {
        const response = await fetch(
          "https://mobile-api.x1.xyz/wallet/So11111111111111111111111111111111111111112?providerId=SOLANA-mainnet",
          { signal: abortController.signal }
        );
        const data = await response.json();
        const solPrice = data?.tokens?.[0]?.price;
        if (solPrice && solPrice > 0) {
          setRealPrice(solPrice);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Failed to fetch SOL price:", error);
        }
        // Keep using API price as fallback
      } finally {
        clearTimeout(timeoutId);
      }
    };

    fetchRealPrice();

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
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

  const Container = onPress ? TouchableOpacity : View;

  // Calculate dollar change amount
  const dollarChange = value * (percentChange / 100);

  return (
    <Container
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Token Logo - Using TokenIcon for performance logging */}
      <View style={styles.logoContainer}>
        <TokenIcon
          symbol={symbol}
          logo={undefined}
          logoUrl={logo}
          size={40}
        />
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
          <View style={styles.changeContainer}>
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
