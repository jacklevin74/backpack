import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";

export default function ActivityScreen({
  transactions,
  checkTransactions,
  openExplorer,
  onDismiss,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.header} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => checkTransactions()}
          pointerEvents="auto"
        >
          <Text style={styles.headerRefresh}>↻</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity</Text>
        <TouchableOpacity onPress={onDismiss} pointerEvents="auto">
          <Text style={styles.headerClose}>×</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {transactions.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>No transactions yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Your transaction history will appear here
            </Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <TouchableOpacity
              key={tx.id}
              style={styles.activityCard}
              onPress={() => openExplorer(tx.signature)}
            >
              {/* Token logo */}
              <Image
                source={
                  tx.token === "XNT"
                    ? require("../assets/x1.png")
                    : require("../assets/solana.png")
                }
                style={styles.activityCardLogo}
              />

              <View style={styles.activityCardContent}>
                {/* Header with title and time */}
                <View style={styles.activityCardHeader}>
                  <Text style={styles.activityCardTitle}>
                    {tx.type === "received" ? "Received" : "Sent"} {tx.token}
                  </Text>
                  <Text style={styles.activityCardTime}>{tx.timestamp}</Text>
                </View>

                {/* Amount row */}
                <View style={styles.activityCardRow}>
                  <Text style={styles.activityCardLabel}>Amount</Text>
                  <Text
                    style={[
                      styles.activityCardValue,
                      {
                        color: tx.type === "received" ? "#00D084" : "#FF6B6B",
                      },
                    ]}
                  >
                    {tx.type === "received" ? "+" : "-"}
                    {tx.amount} {tx.token}
                  </Text>
                </View>

                {/* Fee row */}
                <View style={styles.activityCardRow}>
                  <Text style={styles.activityCardLabel}>Fee</Text>
                  <Text style={styles.activityCardValue}>
                    {tx.fee || "0.000001650"} {tx.token}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 8,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  headerRefresh: {
    fontSize: 24,
    color: "#4A90E2",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  headerClose: {
    fontSize: 32,
    color: "#888888",
    fontWeight: "300",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  activityCard: {
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activityCardLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  activityCardContent: {
    flex: 1,
  },
  activityCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  activityCardTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  activityCardTime: {
    color: "#999999",
    fontSize: 13,
  },
  activityCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  activityCardLabel: {
    color: "#999999",
    fontSize: 13,
  },
  activityCardValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: "#999999",
    fontSize: 14,
  },
});
