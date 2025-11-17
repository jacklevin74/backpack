import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";

export default function SendScreen({
  balance,
  getNativeTokenInfo,
  handleSendSubmit,
  wallets,
  addressSelectorSheetRef,
  selectedAddressFromSelector,
  onDismiss,
}) {
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");

  // Update sendAddress when an address is selected from the selector
  useEffect(() => {
    if (selectedAddressFromSelector) {
      setSendAddress(selectedAddressFromSelector);
    }
  }, [selectedAddressFromSelector]);

  const onSend = () => {
    handleSendSubmit(sendAmount, sendAddress);
    onDismiss();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.headerBack}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Send {getNativeTokenInfo().symbol}
        </Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.headerClose}>×</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance Display */}
        <View style={styles.sendBalanceContainer}>
          <Text style={styles.sendBalanceLabel}>Available Balance</Text>
          <TouchableOpacity onPress={() => setSendAmount(balance)}>
            <Text style={styles.sendBalanceText}>
              {balance} {getNativeTokenInfo().symbol}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input */}
        <View style={styles.sendInputContainer}>
          <Text style={styles.sendInputLabel}>Amount</Text>
          <TextInput
            style={styles.sendInput}
            placeholder="0.00"
            placeholderTextColor="#666666"
            value={sendAmount}
            onChangeText={setSendAmount}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Address Input */}
        <View style={styles.sendInputContainer}>
          <View style={styles.sendAddressHeader}>
            <Text style={styles.sendInputLabel}>Recipient Address</Text>
            <TouchableOpacity
              onPress={async () => {
                await addressSelectorSheetRef.current?.present();
              }}
            >
              <Text style={styles.sendSelectAddressText}>Select Address</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.sendInput}
            placeholder="Enter address..."
            placeholderTextColor="#666666"
            value={sendAddress}
            onChangeText={setSendAddress}
            autoCapitalize="none"
          />
        </View>

        {/* Send Button */}
        <TouchableOpacity style={styles.sendSubmitButton} onPress={onSend}>
          <Text style={styles.sendSubmitButtonText}>Send</Text>
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
  headerBack: {
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
  sendBalanceContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
  },
  sendBalanceLabel: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 4,
  },
  sendBalanceText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#4A90E2",
  },
  sendInputContainer: {
    marginBottom: 20,
  },
  sendInputLabel: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 8,
  },
  sendInput: {
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#333333",
  },
  sendAddressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sendSelectAddressText: {
    fontSize: 12,
    color: "#4A90E2",
    fontWeight: "600",
  },
  sendSubmitButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#4A90E2",
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  sendSubmitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
