import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';

export default function LedgerConnectionScreen({
  ledgerScanning,
  ledgerConnecting,
  ledgerDeviceName,
  ledgerAccounts,
  currentNetwork,
  handleSelectLedgerAccount,
  onDismiss,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 32 }} />
        <Text style={styles.headerTitle}>Connect Ledger</Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.headerClose}>✕</Text>
        </TouchableOpacity>
      </View>

      {ledgerScanning ? (
        <View style={styles.ledgerStatus}>
          <Text style={styles.ledgerStatusText}>Scanning...</Text>
          <Text style={styles.ledgerStatusSubtext}>
            Make sure Bluetooth is on and Solana app is open
          </Text>
        </View>
      ) : ledgerConnecting ? (
        <View style={styles.ledgerStatus}>
          <Text style={styles.ledgerStatusText}>
            {ledgerDeviceName
              ? `Connecting to ${ledgerDeviceName}...`
              : "Connecting..."}
          </Text>
        </View>
      ) : Array.isArray(ledgerAccounts) && ledgerAccounts.length > 0 ? (
        <>
          <Text style={styles.ledgerAccountsTitle}>
            Select an account:
          </Text>
          <ScrollView style={styles.ledgerAccountsList}>
            {ledgerAccounts.map((account) => (
              <TouchableOpacity
                key={`ledger-${account.index}`}
                style={styles.ledgerAccount}
                onPress={() => handleSelectLedgerAccount(account)}
              >
                <View style={styles.ledgerAccountLeft}>
                  <Image
                    source={currentNetwork.logo}
                    style={styles.x1LogoLarge}
                  />
                  <View style={styles.ledgerAccountInfo}>
                    <Text style={styles.ledgerAccountIndex}>
                      Account {account.index + 1}
                    </Text>
                    <Text
                      style={styles.ledgerAccountAddress}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {account.address || "Unknown address"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : (
        <View style={styles.ledgerStatus}>
          <Text style={styles.ledgerStatusText}>Scanning...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerClose: {
    fontSize: 24,
    color: '#4A90E2',
    fontWeight: '600',
  },
  ledgerStatus: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  ledgerStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  ledgerStatusSubtext: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  ledgerAccountsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  ledgerAccountsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  ledgerAccount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  ledgerAccountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  x1LogoLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  ledgerAccountInfo: {
    flex: 1,
  },
  ledgerAccountIndex: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  ledgerAccountAddress: {
    fontSize: 12,
    color: '#888888',
    fontFamily: 'monospace',
  },
});
