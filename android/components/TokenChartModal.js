import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LineGraph } from "react-native-graph";
import {
  fetchPriceHistoryForPeriod,
  calculateStats,
  getPeriodConfig,
} from "../utils/priceHistory";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRAPH_WIDTH = SCREEN_WIDTH - 48; // 24px padding on each side
const GRAPH_HEIGHT = 200;

const TIME_PERIODS = ["1D", "1W", "1M", "1Y", "YTD"];

export const TokenChartModal = ({
  visible,
  onClose,
  tokenSymbol,
  tokenName,
}) => {
  const [priceData, setPriceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("1D");
  const debounceTimer = useRef(null);

  // Map token symbol to CoinGecko ID
  const getTokenId = (symbol) => {
    const tokenMap = {
      SOL: "solana",
      BTC: "bitcoin",
      ETH: "ethereum",
      // Add more mappings as needed
    };
    return tokenMap[symbol] || "solana";
  };

  useEffect(() => {
    if (visible && tokenSymbol) {
      // Clear any existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Debounce the API call to prevent rapid requests
      debounceTimer.current = setTimeout(() => {
        loadPriceData();
      }, 300); // 300ms debounce
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [visible, tokenSymbol, selectedPeriod]);

  const loadPriceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const tokenId = getTokenId(tokenSymbol);
      const periodConfig = getPeriodConfig(selectedPeriod);
      console.log(`Fetching ${selectedPeriod} price data for ${tokenId}...`);

      const data = await fetchPriceHistoryForPeriod(tokenId, selectedPeriod);
      console.log(`Received ${data.length} price points for ${selectedPeriod}`);

      // Transform data for react-native-graph (requires specific format)
      const graphData = data.map((point) => ({
        date: new Date(point.timestamp * 1000),
        value: point.value,
      }));

      setPriceData(graphData);

      // Calculate statistics
      const statistics = calculateStats(data);
      setStats(statistics);

      setLoading(false);
    } catch (err) {
      console.error("Error loading price data:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatPercent = (percent) => {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(2)}%`;
  };

  const formatXAxisLabel = (date) => {
    const d = new Date(date);
    switch (selectedPeriod) {
      case "1D":
        // Show time for 1 day view
        return d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      case "1W":
        // Show month and day for 1 week
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      case "1M":
        // Show month and day for 1 month
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      case "1Y":
        // Show month and year for 1 year
        return d.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      case "YTD":
        // Show month and day for YTD
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      default:
        return d.toLocaleDateString("en-US");
    }
  };

  const getPeriodLabel = () => {
    const periodConfig = getPeriodConfig(selectedPeriod);
    return periodConfig.label.toUpperCase();
  };

  const isPositive = stats && stats.percentChange >= 0;
  const changeColor = isPositive ? "#00C853" : "#FF3B30";

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.tokenName}>{tokenName || tokenSymbol}</Text>
                <Text style={styles.tokenSymbol}>{tokenSymbol}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Price and Period Change */}
            {stats && !loading && (
              <View style={styles.priceSection}>
                <Text style={styles.currentPrice}>
                  {formatPrice(stats.lastPrice)}
                </Text>
                <View style={styles.changeContainer}>
                  <Text style={[styles.changeText, { color: changeColor }]}>
                    {formatPrice(Math.abs(stats.priceChange))} (
                    {formatPercent(stats.percentChange)})
                  </Text>
                  <Text style={styles.timePeriod}>{getPeriodLabel()}</Text>
                </View>
              </View>
            )}

            {/* Chart */}
            <View style={styles.chartContainer}>
              {priceData.length > 0 && !error && (
                <LineGraph
                  points={priceData}
                  animated={true}
                  color={isPositive ? "#00C853" : "#FF3B30"}
                  style={styles.graph}
                  enablePanGesture={true}
                  enableFadeInMask={true}
                />
              )}
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#4A90E2" />
                </View>
              )}
              {error && !loading && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>
                    {error.includes("Rate limit")
                      ? "⏱️ Rate Limited"
                      : "Failed to load chart"}
                  </Text>
                  <Text style={styles.errorSubtext}>
                    {error.includes("Rate limit")
                      ? "Too many requests. Data will auto-refresh soon."
                      : error}
                  </Text>
                  {!error.includes("Rate limit") && (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={loadPriceData}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Time Period Selector */}
            <View style={styles.periodSelector}>
              {TIME_PERIODS.map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    selectedPeriod === period && styles.periodButtonActive,
                  ]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      selectedPeriod === period &&
                        styles.periodButtonTextActive,
                    ]}
                  >
                    {period}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stats */}
            {stats && !loading && !error && (
              <View style={styles.statsContainer}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>{getPeriodLabel()} High</Text>
                  <Text style={styles.statValue}>
                    {formatPrice(stats.high)}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>{getPeriodLabel()} Low</Text>
                  <Text style={styles.statValue}>{formatPrice(stats.low)}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>{getPeriodLabel()} Avg</Text>
                  <Text style={styles.statValue}>
                    {formatPrice(stats.average)}
                  </Text>
                </View>
              </View>
            )}

            {/* Time Period Label */}
            <Text style={styles.timePeriodLabel}>
              {selectedPeriod} Chart ({getPeriodConfig(selectedPeriod).interval}{" "}
              min intervals)
            </Text>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
    minHeight: "70%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  tokenName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  tokenSymbol: {
    fontSize: 16,
    color: "#888888",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  periodSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  periodButtonActive: {
    backgroundColor: "#4A90E2",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888888",
  },
  periodButtonTextActive: {
    color: "#FFFFFF",
  },
  priceSection: {
    marginBottom: 24,
  },
  currentPrice: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  changeText: {
    fontSize: 18,
    fontWeight: "600",
  },
  timePeriod: {
    fontSize: 14,
    color: "#888888",
  },
  chartContainer: {
    height: GRAPH_HEIGHT,
    marginBottom: 24,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  graph: {
    width: GRAPH_WIDTH,
    height: GRAPH_HEIGHT,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(26, 26, 26, 0.8)",
    borderRadius: 12,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    height: GRAPH_HEIGHT,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#888888",
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    height: GRAPH_HEIGHT,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF3B30",
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: "#888888",
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#4A90E2",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  statsContainer: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: "#888888",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  timePeriodLabel: {
    fontSize: 12,
    color: "#666666",
    textAlign: "center",
  },
});
