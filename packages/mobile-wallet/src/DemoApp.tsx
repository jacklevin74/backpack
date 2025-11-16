import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import { WalletCore } from './crypto/WalletCore';

const DemoApp = (): JSX.Element => {
  const [wallet] = useState(new WalletCore());
  const [mnemonic, setMnemonic] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [testResult, setTestResult] = useState('');

  const handleGenerateWallet = () => {
    try {
      const newMnemonic = wallet.generateWallet();
      setMnemonic(newMnemonic);
      const accts = wallet.getAccounts();
      setAccounts(accts);
      setTestResult('✓ Wallet generated successfully!');
    } catch (error: any) {
      setTestResult('✗ Error: ' + error.message);
    }
  };

  const handleAddSolanaAccount = () => {
    try {
      const account = wallet.addAccount('solana');
      setAccounts(wallet.getAccounts());
      setTestResult(`✓ Added Solana account: ${account.publicKey.substring(0, 20)}...`);
    } catch (error: any) {
      setTestResult('✗ Error: ' + error.message);
    }
  };

  const handleAddEthereumAccount = () => {
    try {
      const account = wallet.addAccount('ethereum');
      setAccounts(wallet.getAccounts());
      setTestResult(`✓ Added Ethereum account: ${account.publicKey}`);
    } catch (error: any) {
      setTestResult('✗ Error: ' + error.message);
    }
  };

  const handleGetPrivateKey = (publicKey: string) => {
    try {
      const privateKey = wallet.getPrivateKey(publicKey);
      Alert.alert(
        'Private Key',
        `${privateKey.substring(0, 40)}...`,
        [{ text: 'OK' }]
      );
      setTestResult('✓ Private key retrieved');
    } catch (error: any) {
      setTestResult('✗ Error: ' + error.message);
    }
  };

  const handleClearWallet = () => {
    wallet.clear();
    setMnemonic('');
    setAccounts([]);
    setTestResult('✓ Wallet cleared');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Backpack Crypto Demo</Text>
        <Text style={styles.subtitle}>Testing Core Wallet Features</Text>

        {/* Generate Wallet Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Generate Wallet</Text>
          <TouchableOpacity style={styles.button} onPress={handleGenerateWallet}>
            <Text style={styles.buttonText}>Generate New Wallet</Text>
          </TouchableOpacity>

          {mnemonic ? (
            <View style={styles.resultBox}>
              <Text style={styles.label}>Mnemonic (12 words):</Text>
              <Text style={styles.mnemonicText}>{mnemonic}</Text>
            </View>
          ) : null}
        </View>

        {/* Accounts Section */}
        {accounts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Accounts ({accounts.length})</Text>
            {accounts.map((account, index) => (
              <View key={index} style={styles.accountCard}>
                <Text style={styles.accountType}>
                  {account.blockchain.toUpperCase()}
                </Text>
                <Text style={styles.accountAddress} numberOfLines={1}>
                  {account.publicKey}
                </Text>
                <Text style={styles.accountPath}>{account.derivationPath}</Text>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => handleGetPrivateKey(account.publicKey)}>
                  <Text style={styles.smallButtonText}>Show Private Key</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Add Accounts Section */}
        {mnemonic && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Add More Accounts</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonHalf]}
                onPress={handleAddSolanaAccount}>
                <Text style={styles.buttonText}>+ Solana</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonHalf]}
                onPress={handleAddEthereumAccount}>
                <Text style={styles.buttonText}>+ Ethereum</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Test Result */}
        {testResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Result</Text>
            <View style={styles.resultBox}>
              <Text style={styles.resultText}>{testResult}</Text>
            </View>
          </View>
        )}

        {/* Clear Section */}
        {mnemonic && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.button, styles.dangerButton]}
              onPress={handleClearWallet}>
              <Text style={styles.buttonText}>Clear Wallet</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Features List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backpack Features Tested</Text>
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>✓ BIP39 Mnemonic Generation</Text>
            <Text style={styles.featureItem}>✓ BIP44 HD Derivation</Text>
            <Text style={styles.featureItem}>✓ Solana (ed25519) Support</Text>
            <Text style={styles.featureItem}>✓ Ethereum (secp256k1) Support</Text>
            <Text style={styles.featureItem}>✓ Multi-Account Management</Text>
            <Text style={styles.featureItem}>✓ Private Key Export</Text>
            <Text style={styles.featureItem}>✓ TweetNaCl Encryption</Text>
            <Text style={styles.featureItem}>✓ Secure Key Storage</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Powered by Backpack Crypto Core
          </Text>
          <Text style={styles.footerSubtext}>
            All operations happen locally on your device
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4ecca3',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1e3a5f',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonHalf: {
    flex: 1,
    marginHorizontal: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dangerButton: {
    backgroundColor: '#5f1e1e',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  smallButton: {
    backgroundColor: '#2a2a40',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  smallButtonText: {
    color: '#4ecca3',
    fontSize: 14,
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  resultBox: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a40',
  },
  mnemonicText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
  },
  accountCard: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a40',
  },
  accountType: {
    color: '#4ecca3',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  accountAddress: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  accountPath: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  resultText: {
    color: '#fff',
    fontSize: 14,
  },
  featuresList: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a40',
  },
  featureItem: {
    color: '#4ecca3',
    fontSize: 14,
    marginBottom: 8,
    paddingLeft: 8,
  },
  footer: {
    marginTop: 40,
    marginBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  footerSubtext: {
    color: '#666',
    fontSize: 12,
  },
});

export default DemoApp;
