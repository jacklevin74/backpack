import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

export default function AddressSelectorScreen({
  wallets = [],
  onSelect = () => {},
  onDismiss
}) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Address</Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.headerClose}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {wallets.map((wallet, index) => (
          <TouchableOpacity
            key={wallet.id}
            style={styles.addressItem}
            onPress={() => {
              onSelect(wallet.publicKey);
              onDismiss();
            }}
          >
            <View style={styles.addressContent}>
              <Text style={styles.addressName}>{wallet.name}</Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {wallet.address}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  content: {
    flex: 1,
    padding: 16,
  },
  addressItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    marginBottom: 8,
  },
  addressContent: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  addressText: {
    fontSize: 12,
    color: '#888888',
    fontFamily: 'monospace',
  },
});
