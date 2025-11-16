import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ToastAndroid,
  Clipboard,
} from 'react-native';

export default function WalletManagerScreen({
  wallets,
  currentNetwork,
  selectWallet,
  handleAddWallet,
  walletSettingsSheetRef,
  onDismiss
}) {
  const [copiedWalletId, setCopiedWalletId] = useState(null);
  const scrollViewRef = useRef(null);
  const walletRefs = useRef({});

  // Auto-scroll to selected wallet when component mounts or wallets change
  useEffect(() => {
    const selectedIndex = wallets.findIndex(w => w.selected);
    if (selectedIndex !== -1 && scrollViewRef.current && walletRefs.current[selectedIndex]) {
      setTimeout(() => {
        walletRefs.current[selectedIndex]?.measureLayout(
          scrollViewRef.current,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 50, animated: true });
          },
          () => {}
        );
      }, 300);
    }
  }, [wallets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.headerBack}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Wallets</Text>
          <Text style={styles.headerBadge}>{currentNetwork.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleAddWallet} style={styles.headerButton}>
            <Text style={styles.headerAdd}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={styles.headerButton}>
            <Text style={styles.headerClose}>×</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {wallets.map((wallet, index) => (
          <TouchableOpacity
            key={wallet.id}
            ref={(ref) => (walletRefs.current[index] = ref)}
            style={[
              styles.walletItem,
              wallet.selected && styles.walletItemSelected,
            ]}
            onPress={() => {
              selectWallet(wallet);
              onDismiss();
            }}
          >
            <View style={styles.walletLeft}>
              <Image
                source={currentNetwork.logo}
                style={styles.walletLogo}
              />
              <View style={styles.walletInfo}>
                <Text style={styles.walletName}>{wallet.name}</Text>
                <Text style={styles.walletAddress}>
                  {copiedWalletId === wallet.id
                    ? 'Copied'
                    : `${wallet.publicKey.slice(0, 12)}...${wallet.publicKey.slice(-12)}`}
                </Text>
              </View>
            </View>
            <View style={styles.walletRight}>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  Clipboard.setString(wallet.publicKey);
                  setCopiedWalletId(wallet.id);
                  ToastAndroid.show('Address copied!', ToastAndroid.SHORT);
                  setTimeout(() => setCopiedWalletId(null), 3000);
                }}
              >
                <Text style={styles.copyIcon}>⧉</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={async (e) => {
                  e.stopPropagation();
                  await walletSettingsSheetRef.current?.present();
                }}
              >
                <Text style={styles.menuIcon}>⋮</Text>
              </TouchableOpacity>
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
  headerBack: {
    fontSize: 24,
    color: '#4A90E2',
    fontWeight: '600',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerBadge: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 12,
  },
  headerAdd: {
    fontSize: 28,
    color: '#4A90E2',
    fontWeight: '600',
  },
  headerClose: {
    fontSize: 32,
    color: '#888888',
    fontWeight: '300',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  walletItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  walletItemSelected: {
    borderColor: '#4A90E2',
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  walletLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 12,
    color: '#888888',
    fontFamily: 'monospace',
  },
  walletRight: {
    flexDirection: 'row',
    gap: 8,
  },
  copyBtn: {
    padding: 8,
  },
  copyIcon: {
    fontSize: 18,
    color: '#4A90E2',
  },
  menuBtn: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 20,
    color: '#4A90E2',
  },
});
