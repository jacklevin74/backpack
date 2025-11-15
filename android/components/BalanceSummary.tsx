import React from "react";
import { View, Text, StyleSheet } from "react-native";

export type BalanceSummaryProps = {
  value: number;
  percentChange: number;
  valueChange: number;
};

/**
 * Formats a number as USD currency
 * @param value - The number to format
 * @returns Formatted currency string (e.g., "$1,234.56")
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
 * Formats a percentage change
 * @param percentChange - The percentage to format
 * @returns Formatted percentage string (e.g., "+5.23%", "-2.15%")
 */
function formatPercentChange(percentChange: number): string {
  const sign = percentChange >= 0 ? "+" : "";
  return `${sign}${percentChange.toFixed(2)}%`;
}

/**
 * BalanceSummary Component
 * Displays the total portfolio value and 24h change
 *
 * Features:
 * - Shows total USD value
 * - Displays 24h percentage change
 * - Displays 24h value change
 * - Color-coded indicators (green for positive, red for negative)
 */
export const BalanceSummary = ({
  value,
  percentChange,
  valueChange,
}: BalanceSummaryProps) => {
  const isPositive = percentChange >= 0;
  const changeColor = isPositive ? "#00C853" : "#FF3B30"; // Green or Red

  return (
    <View style={styles.container}>
      {/* Total Portfolio Value */}
      <Text style={styles.totalValue}>{formatUSD(value)}</Text>

      {/* 24h Change */}
      <View style={styles.changeContainer}>
        <Text style={[styles.changeText, { color: changeColor }]}>
          {formatPercentChange(percentChange)}
        </Text>
        <Text style={[styles.changeText, { color: changeColor }]}>
          {" "}
          ({formatUSD(Math.abs(valueChange))})
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 20,
    width: "100%",
  },
  totalValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
  },
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  changeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  label: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
  },
});
