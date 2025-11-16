import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Clipboard,
  Switch,
  Modal,
  AppState,
  AppStateStatus,
} from 'react-native';
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import { WalletCore, WalletAccount } from './crypto/WalletCore';
import { SecureStorage } from './storage/SecureStorage';
import { AuthManager, PinLockoutError } from './storage/AuthManager';

type Screen =
  | 'loading'
  | 'welcome'
  | 'create'
  | 'import'
  | 'securitySetup'
  | 'unlock'
  | 'wallet';

type SensitiveAction =
  | { type: 'privateKey'; account: WalletAccount }
  | { type: 'mnemonic' }
  | { type: 'security-update' };

const AUTO_LOCK_TIMEOUT_MS = 2 * 60 * 1000;

const App = (): JSX.Element => {
  const [screen, setScreen] = useState<Screen>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [wallet, setWallet] = useState<WalletCore | null>(null);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<WalletAccount | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [biometricOptIn, setBiometricOptIn] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [hasPinConfigured, setHasPinConfigured] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [authMode, setAuthMode] = useState<'pin' | 'password'>('pin');
  const [lockoutDeadline, setLockoutDeadline] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  const [reauthVisible, setReauthVisible] = useState(false);
  const [reauthMode, setReauthMode] = useState<'pin' | 'password'>('pin');
  const [reauthPin, setReauthPin] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [pendingSensitiveAction, setPendingSensitiveAction] = useState<SensitiveAction | null>(
    null
  );
  const [secretModal, setSecretModal] = useState<{ title: string; value: string } | null>(null);

  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoLockTimer = useCallback(() => {
    if (autoLockTimer.current) {
      clearTimeout(autoLockTimer.current);
      autoLockTimer.current = null;
    }
  }, []);

  const lockWallet = useCallback(() => {
    setWallet(current => {
      current?.clear();
      return null;
    });
    setAccounts([]);
    setSelectedAccount(null);
    setPendingPassword(null);
    setPinEntry('');
    setReauthVisible(false);
    setPendingSensitiveAction(null);
    setSecretModal(null);
    setReauthPin('');
    setReauthPassword('');
    setMnemonic('');
    setPassword('');
    setConfirmPassword('');
    setPin('');
    setConfirmPin('');
    setBiometricOptIn(false);
    clearAutoLockTimer();
    setScreen('unlock');
  }, [clearAutoLockTimer]);

  const recordActivity = useCallback(() => {
    if (screen !== 'wallet') {
      clearAutoLockTimer();
      return;
    }
    if (autoLockTimer.current) {
      clearTimeout(autoLockTimer.current);
    }
    autoLockTimer.current = setTimeout(() => {
      lockWallet();
    }, AUTO_LOCK_TIMEOUT_MS);
  }, [clearAutoLockTimer, lockWallet, screen]);

  useEffect(() => {
    return () => {
      clearAutoLockTimer();
    };
  }, [clearAutoLockTimer]);

  useEffect(() => {
    const initializeSecurity = async () => {
      const supported = await AuthManager.isBiometricSupported();
      setBiometricSupported(supported);
      await refreshAuthState();
    };
    initializeSecurity();
  }, []);

  useEffect(() => {
    setAuthMode(hasPinConfigured ? 'pin' : 'password');
  }, [hasPinConfigured]);

  useEffect(() => {
    if (screen === 'wallet') {
      recordActivity();
    }
  }, [screen, recordActivity]);

  useEffect(() => {
    if (!lockoutDeadline) {
      setLockoutSeconds(null);
      return;
    }

    const updateRemaining = () => {
      const remainingMs = lockoutDeadline - Date.now();
      if (remainingMs <= 0) {
        setLockoutDeadline(null);
        setLockoutSeconds(null);
      } else {
        setLockoutSeconds(Math.ceil(remainingMs / 1000));
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [lockoutDeadline]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        nextState !== 'active' &&
        (screen === 'wallet' || screen === 'create' || screen === 'import' || screen === 'securitySetup')
      ) {
        lockWallet();
      } else if (nextState === 'active') {
        recordActivity();
      }
    });
    return () => sub.remove();
  }, [lockWallet, recordActivity, screen]);

  const refreshAuthState = async (preserveScreen = false) => {
    const hasWallet = await SecureStorage.hasWallet();
    const pinConfigured = await AuthManager.hasPin();
    const biometricsConfigured = await AuthManager.isBiometricEnabled();

    setHasPinConfigured(pinConfigured);
    setBiometricsEnabled(biometricsConfigured);

    if (!preserveScreen) {
      if (hasWallet) {
        setScreen('unlock');
      } else {
        setScreen('welcome');
      }
    }
  };

  const handleCreateWallet = () => {
    const newWallet = new WalletCore();
    const newMnemonic = newWallet.generateWallet();
    setMnemonic(newMnemonic);
    setWallet(newWallet);
    setScreen('create');
  };

  const handleRevealRecoveryPhrase = () => {
    if (!wallet) return;

    Alert.alert(
      'Sensitive Information',
      'Your recovery phrase controls your assets. Unlock to reveal it.',
      [
        {
          text: 'Reveal Phrase',
          style: 'destructive',
          onPress: () => beginSensitiveAction({ type: 'mnemonic' }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleManageSecurity = () => {
    if (!wallet) return;
    beginSensitiveAction({ type: 'security-update' });
  };

  const validatePinInputs = (): boolean => {
    if (!/^\d{6}$/.test(pin)) {
      Alert.alert('Error', 'PIN must be a 6-digit number');
      return false;
    }
    if (pin !== confirmPin) {
      Alert.alert('Error', 'PINs do not match');
      return false;
    }
    return true;
  };

  const configureSecurity = async (activePassword: string) => {
    try {
      await AuthManager.setupPin(pin, activePassword);
      if (biometricSupported && biometricOptIn) {
        await AuthManager.enableBiometrics(activePassword);
        setBiometricsEnabled(true);
      } else {
        await AuthManager.disableBiometrics();
        setBiometricsEnabled(false);
      }
      setHasPinConfigured(true);
      setPin('');
      setConfirmPin('');
      setBiometricOptIn(false);
    } catch (error: any) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to configure security');
    }
  };

  const hydrateWalletFromMnemonic = (seedPhrase: string) => {
    const loadedWallet = new WalletCore();
    loadedWallet.importWallet(seedPhrase);
    setWallet(loadedWallet);
    setAccounts(loadedWallet.getAccounts());
    setSelectedAccount(loadedWallet.getAccounts()[0]);
  };

  const unlockWithSecret = async (secret: string) => {
    const loadedMnemonic = await SecureStorage.loadWallet(secret);
    hydrateWalletFromMnemonic(loadedMnemonic);
    setPinEntry('');
    if (!hasPinConfigured) {
      setPendingPassword(secret);
      setPin('');
      setConfirmPin('');
      setBiometricOptIn(biometricsEnabled);
      setScreen('securitySetup');
    } else {
      setPendingPassword(null);
      setScreen('wallet');
      recordActivity();
    }
  };

  const handleSaveWallet = async () => {
    if (!validatePinInputs()) {
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    try {
      await SecureStorage.saveWallet(mnemonic, password);
      await configureSecurity(password);
      setAccounts(wallet?.getAccounts() || []);
      setSelectedAccount(wallet?.getAccounts()[0] || null);
      setPassword('');
      setConfirmPassword('');
      setScreen('wallet');
      recordActivity();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save wallet');
    }
  };

  const handleImportWallet = async () => {
    if (!validatePinInputs()) {
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    try {
      const newWallet = new WalletCore();
      newWallet.importWallet(mnemonic.trim());
      await SecureStorage.saveWallet(mnemonic.trim(), password);
       await configureSecurity(password);
      setWallet(newWallet);
      setAccounts(newWallet.getAccounts());
      setSelectedAccount(newWallet.getAccounts()[0]);
      setPassword('');
      setConfirmPassword('');
      setMnemonic('');
      setScreen('wallet');
      recordActivity();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Invalid mnemonic phrase');
    }
  };

  const handlePasswordUnlock = async () => {
    if (!password) {
      Alert.alert('Error', 'Enter your master password');
      return;
    }
    try {
      const secret = password;
      await unlockWithSecret(secret);
      setPassword('');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Incorrect password');
    }
  };

  const handlePinUnlock = async () => {
    if (!/^\d{6}$/.test(pinEntry)) {
      Alert.alert('Error', 'Enter your 6-digit PIN');
      return;
    }
    try {
      const secret = await AuthManager.unlockWithPin(pinEntry);
      await unlockWithSecret(secret);
      setLockoutDeadline(null);
      setLockoutSeconds(null);
      setPinEntry('');
    } catch (error: any) {
      if (error instanceof PinLockoutError) {
        setLockoutDeadline(Date.now() + error.remainingMs);
        Alert.alert(
          'Too many attempts',
          `Wallet is locked. Try again in ${Math.ceil(error.remainingMs / 1000)} seconds.`
        );
        return;
      }
      Alert.alert('Error', error?.message || 'Invalid PIN');
    }
  };

  const handleBiometricUnlock = async () => {
    try {
      const secret = await AuthManager.unlockWithBiometrics();
      await unlockWithSecret(secret);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Biometric authentication failed');
    }
  };

  const handleSecuritySetupSubmit = async () => {
    if (!pendingPassword) {
      Alert.alert('Error', 'Missing master password context');
      return;
    }
    if (!validatePinInputs()) {
      return;
    }
    try {
      await configureSecurity(pendingPassword);
      setPendingPassword(null);
      await refreshAuthState(true);
      setScreen('wallet');
      recordActivity();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to enable security');
    }
  };

  const handleLogout = () => {
    lockWallet();
  };

  const handleAddAccount = () => {
    if (!wallet) return;

    Alert.alert('Add Account', 'Choose blockchain', [
      {
        text: 'Solana',
        onPress: () => {
          const account = wallet.addAccount('solana');
          setAccounts(wallet.getAccounts());
          recordActivity();
          Alert.alert('Success', `Created Solana account:\n${account.publicKey}`);
        },
      },
      {
        text: 'Ethereum',
        onPress: () => {
          const account = wallet.addAccount('ethereum');
          setAccounts(wallet.getAccounts());
          recordActivity();
          Alert.alert('Success', `Created Ethereum account:\n${account.publicKey}`);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const beginSensitiveAction = (action: SensitiveAction) => {
    setPendingSensitiveAction(action);
    setReauthMode(hasPinConfigured ? 'pin' : 'password');
    setReauthVisible(true);
    setReauthPin('');
    setReauthPassword('');
    recordActivity();
  };

  const closeReauthModal = (clearAction = true) => {
    setReauthVisible(false);
    if (clearAction) {
      setPendingSensitiveAction(null);
    }
    setReauthPin('');
    setReauthPassword('');
  };

  const completeSensitiveAction = (passwordContext?: string) => {
    if (!pendingSensitiveAction || !wallet) {
      closeReauthModal();
      return;
    }

    const action = pendingSensitiveAction;
    closeReauthModal(false);
    setPendingSensitiveAction(null);

    if (action.type === 'privateKey') {
      const privateKey = wallet.getPrivateKey(action.account.publicKey);
      setSecretModal({ title: 'Private Key', value: privateKey });
      recordActivity();
      return;
    }

    if (action.type === 'mnemonic') {
      const phrase = wallet.getMnemonic();
      setSecretModal({ title: 'Recovery Phrase', value: phrase });
      recordActivity();
      return;
    }

    if (action.type === 'security-update') {
      if (!passwordContext) {
        Alert.alert('Error', 'Authentication failed. Unable to update security.');
        closeReauthModal();
        return;
      }
      setPendingPassword(passwordContext);
      setPin('');
      setConfirmPin('');
      setBiometricOptIn(biometricsEnabled);
      setScreen('securitySetup');
      recordActivity();
    }
  };

  const handleSensitivePinConfirm = async () => {
    if (!/^\d{6}$/.test(reauthPin)) {
      Alert.alert('Error', 'Enter your 6-digit PIN');
      return;
    }
    try {
      const secret = await AuthManager.unlockWithPin(reauthPin);
      setLockoutDeadline(null);
      setLockoutSeconds(null);
      completeSensitiveAction(secret);
    } catch (error: any) {
      if (error instanceof PinLockoutError) {
        setLockoutDeadline(Date.now() + error.remainingMs);
        Alert.alert(
          'Too many attempts',
          `Wallet is locked. Try again in ${Math.ceil(error.remainingMs / 1000)} seconds.`
        );
        return;
      }
      Alert.alert('Error', error?.message || 'Invalid PIN');
    }
  };

  const handleSensitivePasswordConfirm = async () => {
    if (!reauthPassword) {
      Alert.alert('Error', 'Enter your master password');
      return;
    }
    try {
      await SecureStorage.loadWallet(reauthPassword);
      completeSensitiveAction(reauthPassword);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Incorrect password');
    }
  };

  const handleSensitiveBiometricConfirm = async () => {
    try {
      const secret = await AuthManager.unlockWithBiometrics();
      completeSensitiveAction(secret);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Biometric authentication failed');
    }
  };

  const getReauthDescription = () => {
    if (!pendingSensitiveAction) {
      return '';
    }
    switch (pendingSensitiveAction.type) {
      case 'privateKey':
        return 'Confirm your identity to reveal this private key.';
      case 'mnemonic':
        return 'Authentication is required to reveal your recovery phrase.';
      case 'security-update':
        return 'Authenticate to update your PIN and biometric preferences.';
      default:
        return '';
    }
  };

  const handleCopySecret = () => {
    if (!secretModal) {
      return;
    }
    Clipboard.setString(secretModal.value);
    Alert.alert('Copied', `${secretModal.title} copied to clipboard`);
    recordActivity();
  };

  const closeSecretModal = () => {
    setSecretModal(null);
    recordActivity();
  };

  const renderReauthModal = () => (
    <Modal
      visible={reauthVisible}
      transparent
      animationType="fade"
      onRequestClose={() => closeReauthModal()}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Confirm Identity</Text>
          <Text style={styles.modalSubtitle}>{getReauthDescription()}</Text>
          {reauthMode === 'pin' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="6-digit PIN"
                value={reauthPin}
                onChangeText={setReauthPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
              <TouchableOpacity style={styles.button} onPress={handleSensitivePinConfirm}>
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Master password"
                secureTextEntry
                value={reauthPassword}
                onChangeText={setReauthPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.button} onPress={handleSensitivePasswordConfirm}>
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
            </>
          )}
          {biometricsEnabled && (
            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={handleSensitiveBiometricConfirm}>
              <Text style={styles.buttonText}>Use Biometrics</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => setReauthMode(reauthMode === 'pin' ? 'password' : 'pin')}>
            <Text style={styles.linkText}>
              {reauthMode === 'pin' ? 'Use master password instead' : 'Use PIN instead'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={() => closeReauthModal()}>
            <Text style={styles.linkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderSecretModal = () => (
    <Modal
      visible={Boolean(secretModal)}
      transparent
      animationType="fade"
      onRequestClose={closeSecretModal}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{secretModal?.title}</Text>
          <Text style={styles.modalSubtitle}>
            Never share this information. Anyone with it can control your funds.
          </Text>
          <ScrollView style={styles.secretScrollView}>
            <Text style={styles.secretValue} selectable>
              {secretModal?.value}
            </Text>
          </ScrollView>
          <TouchableOpacity style={styles.button} onPress={handleCopySecret}>
            <Text style={styles.buttonText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buttonSecondary, { marginTop: 12 }]}
            onPress={closeSecretModal}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const handleShowPrivateKey = (account: WalletAccount) => {
    if (!wallet) return;

    Alert.alert(
      'Warning',
      'Never share your private key. Anyone with this key can access your funds.',
      [
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => beginSensitiveAction({ type: 'privateKey', account }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const copyToClipboard = (text: string) => {
    recordActivity();
    Clipboard.setString(text);
    Alert.alert('Copied', 'Address copied to clipboard');
  };

  // Welcome Screen
  if (screen === 'welcome') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Simple Crypto Wallet</Text>
          <Text style={styles.subtitle}>Get started with your wallet</Text>
          <TouchableOpacity style={styles.button} onPress={handleCreateWallet}>
            <Text style={styles.buttonText}>Create New Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => setScreen('import')}>
            <Text style={styles.buttonText}>Import Wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Create Wallet Screen
  if (screen === 'create') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <Text style={styles.title}>Your Recovery Phrase</Text>
          <Text style={styles.warning}>
            Write down these words in order and keep them safe. This is the ONLY way to
            recover your wallet.
          </Text>
          <View style={styles.mnemonicContainer}>
            <Text style={styles.mnemonic}>{mnemonic}</Text>
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => copyToClipboard(mnemonic)}>
            <Text style={styles.buttonText}>Copy to Clipboard</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Set Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password (min 8 characters)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Text style={styles.label}>App PIN (6 digits)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit PIN"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm PIN"
            value={confirmPin}
            onChangeText={setConfirmPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />
          {biometricSupported && (
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Enable biometrics</Text>
                <Text style={styles.toggleHint}>
                  Use Face ID or fingerprint to unlock quickly.
                </Text>
              </View>
              <Switch
                value={biometricOptIn}
                onValueChange={setBiometricOptIn}
                thumbColor={biometricOptIn ? '#4ecca3' : '#888'}
              />
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleSaveWallet}>
            <Text style={styles.buttonText}>Save Wallet</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Import Wallet Screen
  if (screen === 'import') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <Text style={styles.title}>Import Wallet</Text>
          <Text style={styles.label}>Recovery Phrase</Text>
          <TextInput
            style={[styles.input, styles.mnemonicInput]}
            placeholder="Enter your 12 or 24 word phrase"
            multiline
            numberOfLines={3}
            value={mnemonic}
            onChangeText={setMnemonic}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Set Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password (min 8 characters)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Text style={styles.label}>App PIN (6 digits)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit PIN"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm PIN"
            value={confirmPin}
            onChangeText={setConfirmPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />
          {biometricSupported && (
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Enable biometrics</Text>
                <Text style={styles.toggleHint}>
                  Use Face ID or fingerprint to unlock quickly.
                </Text>
              </View>
              <Switch
                value={biometricOptIn}
                onValueChange={setBiometricOptIn}
                thumbColor={biometricOptIn ? '#4ecca3' : '#888'}
              />
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleImportWallet}>
            <Text style={styles.buttonText}>Import Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => setScreen('welcome')}>
            <Text style={styles.buttonText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'securitySetup') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <Text style={styles.title}>Secure Your Wallet</Text>
          <Text style={styles.warning}>
            Set a PIN to unlock your wallet quickly. Biometrics are optional but recommended.
          </Text>

          <Text style={styles.label}>App PIN (6 digits)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit PIN"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm PIN"
            value={confirmPin}
            onChangeText={setConfirmPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />

          {biometricSupported && (
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Enable biometrics</Text>
                <Text style={styles.toggleHint}>
                  Use Face ID or fingerprint for faster unlocks.
                </Text>
              </View>
              <Switch
                value={biometricOptIn}
                onValueChange={setBiometricOptIn}
                thumbColor={biometricOptIn ? '#4ecca3' : '#888'}
              />
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleSecuritySetupSubmit}>
            <Text style={styles.buttonText}>Enable Protection</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Unlock Screen
  if (screen === 'unlock') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Welcome Back</Text>
          {authMode === 'pin' && hasPinConfigured ? (
            <>
              <Text style={styles.label}>
                {lockoutSeconds
                  ? `Too many attempts. Try again in ${lockoutSeconds}s`
                  : 'Enter PIN'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit PIN"
                value={pinEntry}
                onChangeText={setPinEntry}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                editable={!lockoutSeconds}
              />
              <TouchableOpacity
                style={[styles.button, lockoutSeconds && styles.disabledButton]}
                onPress={handlePinUnlock}
                disabled={Boolean(lockoutSeconds)}>
                <Text style={styles.buttonText}>Unlock</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Enter Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handlePasswordUnlock}
              />
              <TouchableOpacity style={styles.button} onPress={handlePasswordUnlock}>
                <Text style={styles.buttonText}>Unlock</Text>
              </TouchableOpacity>
            </>
          )}
          {biometricsEnabled && (
            <TouchableOpacity style={styles.buttonSecondary} onPress={handleBiometricUnlock}>
              <Text style={styles.buttonText}>Use Biometrics</Text>
            </TouchableOpacity>
          )}
          {hasPinConfigured && (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setAuthMode(authMode === 'pin' ? 'password' : 'pin')}>
              <Text style={styles.linkText}>
                {authMode === 'pin' ? 'Use master password instead' : 'Use PIN instead'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Wallet Screen
  if (screen === 'wallet' && selectedAccount) {
    return (
      <>
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <Text style={styles.title}>My Wallet</Text>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.accountSelector}>
            <Text style={styles.label}>Active Account</Text>
            <View style={styles.accountInfo}>
              <Text style={styles.blockchain}>
                {selectedAccount.blockchain.toUpperCase()}
              </Text>
              <TouchableOpacity
                onPress={() => copyToClipboard(selectedAccount.publicKey)}>
                <Text style={styles.address} numberOfLines={1}>
                  {selectedAccount.publicKey}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => handleShowPrivateKey(selectedAccount)}>
            <Text style={styles.buttonText}>Show Private Key</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleRevealRecoveryPhrase}>
            <Text style={styles.buttonText}>Show Recovery Phrase</Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Accounts</Text>
            {accounts.map((account, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.accountCard,
                  selectedAccount.publicKey === account.publicKey &&
                    styles.accountCardActive,
                ]}
                onPress={() => setSelectedAccount(account)}>
                <Text style={styles.accountBlockchain}>
                  {account.blockchain.toUpperCase()}
                </Text>
                <Text style={styles.accountAddress} numberOfLines={1}>
                  {account.publicKey}
                </Text>
                <Text style={styles.accountPath}>{account.derivationPath}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            <Text style={styles.label}>Manage your PIN and biometrics.</Text>
            <TouchableOpacity style={styles.button} onPress={handleManageSecurity}>
              <Text style={styles.buttonText}>Update PIN & Biometrics</Text>
            </TouchableOpacity>
          </View>

            <TouchableOpacity style={styles.button} onPress={handleAddAccount}>
              <Text style={styles.buttonText}>+ Add Account</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
        {renderReauthModal()}
        {renderSecretModal()}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <Text style={styles.title}>Loading...</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#16213e',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  mnemonicInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#0f3460',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonSecondary: {
    backgroundColor: '#16213e',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#c70039',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  copyButton: {
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  linkButton: {
    marginTop: 16,
  },
  linkText: {
    color: '#4ecca3',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#c70039',
    fontSize: 14,
    fontWeight: '600',
  },
  mnemonicContainer: {
    backgroundColor: '#16213e',
    padding: 20,
    borderRadius: 10,
    marginTop: 12,
  },
  mnemonic: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  warning: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  toggleContent: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleHint: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1f1f3a',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 16,
  },
  secretScrollView: {
    maxHeight: 200,
    marginBottom: 16,
  },
  secretValue: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  accountSelector: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  accountInfo: {
    marginTop: 8,
  },
  blockchain: {
    color: '#4ecca3',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  address: {
    color: '#fff',
    fontSize: 14,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  accountCard: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accountCardActive: {
    borderColor: '#0f3460',
  },
  accountBlockchain: {
    color: '#4ecca3',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountAddress: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  accountPath: {
    color: '#888',
    fontSize: 12,
  },
});

export default App;
