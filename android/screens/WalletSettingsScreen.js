import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";

export default function WalletSettingsScreen({
  onDismiss,
  onShowPrivateKey,
  isLedger,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 32 }} />
        <Text style={styles.headerTitle}>Edit Wallet</Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.headerClose}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            // Navigate to change name screen or show modal
            onDismiss();
          }}
        >
          <Text style={styles.menuItemText}>Change Account Name</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        {!isLedger && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log(
                "[WalletSettingsScreen] Show Private Key button pressed"
              );
              if (onShowPrivateKey) {
                onShowPrivateKey();
              } else {
                onDismiss();
              }
            }}
          >
            <Text style={styles.menuItemText}>Show Private Key</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemDanger]}
          onPress={() => {
            // Show delete confirmation
            onDismiss();
          }}
        >
          <Text style={[styles.menuItemText, styles.menuItemDangerText]}>
            Remove Wallet
          </Text>
          <Text style={[styles.menuItemArrow, styles.menuItemDangerText]}>
            ›
          </Text>
        </TouchableOpacity>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  headerClose: {
    fontSize: 24,
    color: "#4A90E2",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  menuItemArrow: {
    fontSize: 20,
    color: "#888888",
  },
  menuItemDanger: {
    marginTop: 20,
  },
  menuItemDangerText: {
    color: "#FF6B6B",
  },
});
