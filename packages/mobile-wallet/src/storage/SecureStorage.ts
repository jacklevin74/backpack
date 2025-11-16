import AsyncStorage from '@react-native-async-storage/async-storage';
import { encrypt, decrypt, SecretPayload } from '../crypto/WalletCore';
import { AuthManager } from './AuthManager';

const WALLET_KEY = '@wallet:encrypted';
const WALLET_EXISTS_KEY = '@wallet:exists';

export class SecureStorage {
  // Check if wallet exists
  static async hasWallet(): Promise<boolean> {
    const exists = await AsyncStorage.getItem(WALLET_EXISTS_KEY);
    return exists === 'true';
  }

  // Save encrypted wallet
  static async saveWallet(mnemonic: string, password: string): Promise<void> {
    const encrypted = await encrypt(mnemonic, password);
    await AsyncStorage.setItem(WALLET_KEY, JSON.stringify(encrypted));
    await AsyncStorage.setItem(WALLET_EXISTS_KEY, 'true');
  }

  // Load and decrypt wallet
  static async loadWallet(password: string): Promise<string> {
    const encryptedData = await AsyncStorage.getItem(WALLET_KEY);
    if (!encryptedData) {
      throw new Error('No wallet found');
    }

    const encrypted: SecretPayload = JSON.parse(encryptedData);
    return await decrypt(encrypted, password);
  }

  // Clear wallet
  static async clearWallet(): Promise<void> {
    await AsyncStorage.removeItem(WALLET_KEY);
    await AsyncStorage.removeItem(WALLET_EXISTS_KEY);
    await AuthManager.clearSecurityState();
  }
}
