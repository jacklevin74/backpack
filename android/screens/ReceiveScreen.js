import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ToastAndroid,
  Clipboard,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function ReceiveScreen({
  selectedWallet,
  getNativeTokenInfo,
  onDismiss
}) {
  const [addressCopied, setAddressCopied] = useState(false);

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    ToastAndroid.show('Address copied!', ToastAndroid.SHORT);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.headerBack}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive {getNativeTokenInfo().symbol}</Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.headerClose}>×</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* QR Code */}
        <View style={styles.receiveQRContainer}>
          <View style={styles.receiveQRWrapper}>
            <QRCode
              value={selectedWallet?.publicKey || 'No wallet'}
              size={200}
              backgroundColor="white"
              color="black"
            />
          </View>
        </View>

        {/* Address */}
        <View style={styles.receiveAddressContainer}>
          <Text style={styles.receiveAddressLabel}>Your Address</Text>
          <Text style={styles.receiveAddressText} numberOfLines={1}>
            {addressCopied
              ? 'Copied!'
              : selectedWallet?.publicKey || 'No wallet selected'}
          </Text>
        </View>

        {/* Copy Button */}
        <TouchableOpacity
          style={styles.receiveCopyButton}
          onPress={() => {
            copyToClipboard(selectedWallet.publicKey);
            setAddressCopied(true);
            setTimeout(() => {
              setAddressCopied(false);
            }, 4000);
          }}
        >
          <Text style={styles.receiveCopyButtonText}>Copy Address</Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerClose: {
    fontSize: 32,
    color: '#888888',
    fontWeight: '300',
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  receiveQRContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  receiveQRWrapper: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  receiveAddressContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  receiveAddressLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 8,
    textAlign: 'center',
  },
  receiveAddressText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  receiveCopyButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    alignItems: 'center',
  },
  receiveCopyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
