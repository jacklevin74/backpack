import "react-native-get-random-values";
import { Buffer } from "buffer";
global.Buffer = Buffer;

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { ApolloProvider } from "@apollo/client";
import { createApolloClient } from "./apollo/client";
import { TokenBalances } from "./components/TokenBalances";
import { TokenChartModal } from "./components/TokenChartModal";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  StatusBar,
  Modal,
  Pressable,
  Linking,
  Clipboard,
  TextInput,
  PermissionsAndroid,
  Platform,
  NativeModules,
  RefreshControl,
  ToastAndroid,
  Keyboard,
  Vibration,
  Animated,
  Switch,
  BackHandler,
  ActivityIndicator,
  Alert,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  Keypair,
  Connection,
  clusterApiUrl,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as bip39 from "bip39";
import slip10 from "micro-key-producer/slip10.js";
import { randomBytes, secretbox } from "tweetnacl";
import bs58 from "bs58";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  SafeAreaView as SafeAreaViewContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
// Replaced @gorhom/bottom-sheet with SimpleActionSheet
import SimpleActionSheet from "./components/SimpleActionSheet";
import TokenIcon, { clearImageCache } from "./src/components/TokenIcon";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import TransportBLE from "@ledgerhq/react-native-hw-transport-ble";
import { BleManager } from "react-native-ble-plx";
import AppSolana from "@ledgerhq/hw-app-solana";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { WebView } from "react-native-webview";

// Import authentication components
import { AuthManager } from "./src/auth/AuthManager";
import { PinSetup } from "./src/auth/PinSetup";
import { PinUnlock } from "./src/auth/PinUnlock";
import { ChangePin } from "./src/auth/ChangePin";
import { BiometricSettings } from "./src/auth/BiometricSettings";

// Import Toast notifications
import Toast from "react-native-toast-message";

// Import native USB Ledger module (only on native platforms)
const { LedgerUsb } = Platform.OS !== "web" ? NativeModules : {};

// Network configurations
const API_SERVER = "https://mobile-api.x1.xyz";
const DEMO_WALLET_ADDRESS = "29dSqUTTH5okWAr3oLkQWrV968FQxgVqPCSqMqRLj8K2";

// Mock wallets data
const MOCK_WALLETS = [
  {
    id: 1,
    name: "Ledger 1",
    address: "29dS...j8K2",
    publicKey: DEMO_WALLET_ADDRESS,
    selected: true,
  },
  {
    id: 2,
    name: "Ledger 2",
    address: "FSnt...DHyF",
    publicKey: "FSnt1234DHyF567890abcdefghijklmnopqrstuv",
    selected: false,
  },
  {
    id: 3,
    name: "Wallet 1",
    address: "5FMQ...kCRg",
    publicKey: "5FMQ5678kCRg012345zyxwvutsrqponmlkjihgfedcb",
    selected: false,
  },
  {
    id: 4,
    name: "Wallet 2",
    address: "H5kT...uY9L",
    publicKey: "H5kT9012uY9L345678mnopqrstuvwxyzABCDEF123456",
    selected: false,
  },
];

const MASTER_SEED_STORAGE_KEY = "masterSeedPhrase";
const DERIVATION_INDEX_STORAGE_KEY = "derivationIndex";
const WALLET_MNEMONIC_KEY_PREFIX = "walletMnemonic_";

const getWalletMnemonicKey = (walletId) =>
  `${WALLET_MNEMONIC_KEY_PREFIX}${walletId}`;

const saveSecureItem = async (key, value) => {
  try {
    const secureAvailable = await SecureStore.isAvailableAsync();
    if (secureAvailable) {
      if (value === null || value === undefined) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
      await AsyncStorage.removeItem(key);
    } else if (value === null || value === undefined) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch (error) {
    console.error(`Error saving secure item (${key}):`, error);
  }
};

// Legacy key mapping for migration from AsyncStorage
const LEGACY_KEY_MAP = {
  masterSeedPhrase: "@masterSeedPhrase",
  derivationIndex: "@derivationIndex",
};

const getSecureItem = async (key) => {
  try {
    const secureAvailable = await SecureStore.isAvailableAsync();
    if (secureAvailable) {
      const stored = await SecureStore.getItemAsync(key);
      if (stored) {
        // Clean up old AsyncStorage keys (both new and legacy)
        await AsyncStorage.removeItem(key);
        const legacyKey = LEGACY_KEY_MAP[key];
        if (legacyKey) await AsyncStorage.removeItem(legacyKey);
        return stored;
      }

      // Try to migrate from AsyncStorage (check legacy key first)
      const legacyKey = LEGACY_KEY_MAP[key];
      const legacy = legacyKey
        ? await AsyncStorage.getItem(legacyKey)
        : await AsyncStorage.getItem(key);

      if (legacy) {
        console.log(
          `Migrating ${key} from AsyncStorage${legacyKey ? ` (legacy key: ${legacyKey})` : ""} to SecureStore`
        );
        await SecureStore.setItemAsync(key, legacy);
        if (legacyKey) await AsyncStorage.removeItem(legacyKey);
        await AsyncStorage.removeItem(key);
        console.log(`Successfully migrated ${key} to SecureStore`);
        return legacy;
      }
      return null;
    }
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error(`Error loading secure item (${key}):`, error);
    return null;
  }
};

const deleteSecureItem = async (key) => {
  await saveSecureItem(key, null);
};

const saveWalletMnemonicSecurely = async (walletId, mnemonic) => {
  if (!walletId) return;
  await saveSecureItem(getWalletMnemonicKey(walletId), mnemonic);
};

const loadWalletMnemonicSecurely = async (walletId) => {
  if (!walletId) return null;
  return getSecureItem(getWalletMnemonicKey(walletId));
};

const deleteWalletMnemonicSecurely = async (walletId) => {
  if (!walletId) return;
  await deleteSecureItem(getWalletMnemonicKey(walletId));
};

// Mock account data
const MOCK_ACCOUNTS = [
  {
    id: 1,
    badge: "A1",
    name: "Account 1",
    badgeColor: "#4A90E2",
    selected: true,
  },
  {
    id: 2,
    badge: "A2",
    name: "Account 2",
    badgeColor: "#50C878",
    selected: false,
  },
  {
    id: 3,
    badge: "A3",
    name: "Account 3",
    badgeColor: "#FFB6C1",
    selected: false,
  },
  {
    id: 4,
    badge: "A4",
    name: "Account 4",
    badgeColor: "#DDA0DD",
    selected: false,
  },
];

// Available networks
const NETWORKS = [
  {
    id: "X1",
    name: "X1 Mainnet",
    providerId: "X1-mainnet",
    rpcUrl: "https://rpc.mainnet.x1.xyz",
    explorerUrl: "https://explorer.x1.xyz",
    logo: require("./assets/x1.png"),
    nativeToken: {
      name: "X1 Native Token",
      symbol: "XNT",
      logo: require("./assets/x1.png"),
    },
  },
  {
    id: "X1_TESTNET",
    name: "X1 Testnet",
    providerId: "X1-testnet",
    rpcUrl: "https://rpc.testnet.x1.xyz",
    explorerUrl: "https://explorer.testnet.x1.xyz",
    logo: require("./assets/x1.png"),
    nativeToken: {
      name: "X1 Native Token",
      symbol: "XNT",
      logo: require("./assets/x1.png"),
    },
  },
  {
    id: "SOLANA",
    name: "Solana",
    providerId: "SOLANA-mainnet",
    rpcUrl:
      "https://capable-autumn-thunder.solana-mainnet.quiknode.pro/3d4ed46b454fa0ca3df983502fdf15fe87145d9e/",
    explorerUrl: "https://explorer.solana.com",
    logo: require("./assets/solana.png"),
    nativeToken: {
      name: "Solana",
      symbol: "SOL",
      logo: require("./assets/solana.png"),
    },
  },
];

// Create Apollo Client instance
const apolloClient = createApolloClient("backpack-android", "1.0.0");

function AppContent() {
  // Get safe area insets for proper spacing on devices with notches/gesture bars
  const insets = useSafeAreaInsets();

  // Authentication states
  const [authState, setAuthState] = useState("loading"); // 'loading', 'setup', 'locked', 'unlocked'
  const [password, setPassword] = useState(null);
  const [securityAuthRequired, setSecurityAuthRequired] = useState(false); // Require auth for security settings
  const [securityAuthenticated, setSecurityAuthenticated] = useState(false); // Track if authenticated for security
  const [pendingAuthScreen, setPendingAuthScreen] = useState(null); // Track which screen to navigate to after auth
  const [pendingResetWallet, setPendingResetWallet] = useState(false); // Track if we should show reset confirmation after auth

  const [wallets, setWallets] = useState([]);
  const [walletsLoaded, setWalletsLoaded] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);

  // Efficient O(1) lookup index for wallet addresses - auto-updates with wallets array
  const walletAddressIndex = useMemo(() => {
    const index = new Set();
    wallets.forEach((wallet) => {
      if (wallet.publicKey) index.add(wallet.publicKey);
      if (wallet.address) index.add(wallet.address);
    });
    return index;
  }, [wallets]);

  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [selectedAccount, setSelectedAccount] = useState(MOCK_ACCOUNTS[0]);
  const [balance, setBalance] = useState("0");
  const [balanceUSD, setBalanceUSD] = useState("$0.00");
  const [portfolioGainLoss, setPortfolioGainLoss] = useState({
    percentChange: 0,
    valueChange: 0,
  });
  const [tokenPrice, setTokenPrice] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingMessage, setIndexingMessage] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true);
  const [oldestSignature, setOldestSignature] = useState(null);
  const [activityTapTimes, setActivityTapTimes] = useState([]); // Track Activity tab taps for triple-tap auto-load
  const [balanceCache, setBalanceCache] = useState({});
  const [gainLossCache, setGainLossCache] = useState({});
  const [currentNetwork, setCurrentNetwork] = useState(NETWORKS[0]);
  const [isOnline, setIsOnline] = useState(true);

  // Master seed phrase for hierarchical deterministic wallet derivation
  const [masterSeedPhrase, setMasterSeedPhrase] = useState(null);
  const [walletDerivationIndex, setWalletDerivationIndex] = useState(0);

  // Network selector states
  const [showDebugDrawer, setShowDebugDrawer] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showBluetoothDrawer, setShowBluetoothDrawer] = useState(false);
  const [pairedDevices, setPairedDevices] = useState([]);
  const [lastX1TapTime, setLastX1TapTime] = useState(0);
  const [lastNetworkError, setLastNetworkError] = useState(0);

  // Wallet management states
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showImportWalletModal, setShowImportWalletModal] = useState(false);
  const [newMnemonic, setNewMnemonic] = useState("");
  const [importMnemonic, setImportMnemonic] = useState("");
  const [importPrivateKey, setImportPrivateKey] = useState("");
  const [importType, setImportType] = useState("privateKey"); // Only "privateKey" - seed phrase import removed
  const [importDerivationIndex, setImportDerivationIndex] = useState("0");
  const [use24Words, setUse24Words] = useState(false);
  const [phraseWords, setPhraseWords] = useState(Array(12).fill(""));
  const [phraseDisclaimerAccepted, setPhraseDisclaimerAccepted] =
    useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  const [editWalletName, setEditWalletName] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showChangeNameModal, setShowChangeNameModal] = useState(false);
  const [showViewPrivateKeyModal, setShowViewPrivateKeyModal] = useState(false);
  const [showViewSeedPhraseModal, setShowViewSeedPhraseModal] = useState(false);
  const [showExportSeedPhraseModal, setShowExportSeedPhraseModal] =
    useState(false);
  const [showChangeSeedPhraseModal, setShowChangeSeedPhraseModal] =
    useState(false);
  const [newSeedPhraseInput, setNewSeedPhraseInput] = useState("");
  const [changeSeedPhraseMode, setChangeSeedPhraseMode] = useState("enter"); // "enter" or "generate"
  const [generatedNewSeed, setGeneratedNewSeed] = useState("");
  const [isInitialSetup, setIsInitialSetup] = useState(false); // Track if we're setting up master seed phrase for the first time
  const [settingsNavigationStack, setSettingsNavigationStack] = useState([]); // Stack for settings navigation: ['manageSecurity', 'exportSeed', etc.]
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [currentBottomTab, setCurrentBottomTab] = useState("portfolio"); // "portfolio", "swap", "browser"
  const [walletSeedPhraseForDisplay, setWalletSeedPhraseForDisplay] =
    useState(null);
  const [walletSeedPhraseLoading, setWalletSeedPhraseLoading] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [copiedWalletId, setCopiedWalletId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCheckedNetwork, setHasCheckedNetwork] = useState(false);

  // Ledger states
  const [ledgerScanning, setLedgerScanning] = useState(false);
  const [ledgerAccounts, setLedgerAccounts] = useState([]);
  const [discoveredDevices, setDiscoveredDevices] = useState([]); // List of found Bluetooth devices
  const [ledgerConnecting, setLedgerConnecting] = useState(false);
  const [ledgerWalletProgress, setLedgerWalletProgress] = useState(0); // Track wallet discovery progress (0-5)
  const [ledgerDeviceName, setLedgerDeviceName] = useState(null);
  const [ledgerDeviceId, setLedgerDeviceId] = useState(null); // Store device ID to skip scanning
  const [ledgerError, setLedgerError] = useState(""); // Error message displayed in Ledger modal
  const ledgerErrorSlideAnim = useRef(new Animated.Value(100)).current; // Animation for toast slide-up
  const [ledgerDeviceInfo, setLedgerDeviceInfo] = useState(null); // Store device info (name, id)
  const [ledgerConnectionType, setLedgerConnectionType] = useState("usb"); // 'usb' or 'bluetooth'
  const ledgerTransportRef = useRef(null); // Store transport reference for cleanup
  const ledgerScanSubscriptionRef = useRef(null); // Store scan subscription for cleanup
  const ledgerCleaningRef = useRef(false); // Prevent concurrent cleanup
  const ledgerOperationInProgressRef = useRef(false); // Mutex to prevent concurrent BLE operations
  const ledgerCleanedUpRef = useRef(false); // Track if cleanup has already been completed
  const bleManagerRef = useRef(null); // BLE Manager instance for Bluetooth control
  const sendAddressInputRef = useRef(null); // Ref for send address TextInput
  const ledgerScanAbortRef = useRef(false); // Flag to abort ongoing scan
  const ledgerScanPausedRef = useRef(false); // Ref for real-time pause checking in loop
  const [ledgerScanPaused, setLedgerScanPaused] = useState(false); // State for UI updates
  const ledgerSkippedDuplicatesRef = useRef(0); // Count of skipped duplicate accounts
  const [ledgerSelectedAccounts, setLedgerSelectedAccounts] = useState(
    new Set()
  ); // Multi-select: track selected account addresses
  const [ledgerAddingAccounts, setLedgerAddingAccounts] = useState(false); // Progress: adding accounts in progress
  const [ledgerAddProgress, setLedgerAddProgress] = useState({
    current: 0,
    total: 0,
  }); // Progress: current/total accounts being added
  const [ledgerDerivationPatterns, setLedgerDerivationPatterns] = useState([
    "standard",
  ]); // Selected derivation path patterns (array for multi-select)
  const [ledgerDeepScan, setLedgerDeepScan] = useState(false); // Deep scan mode (scan up to 50 accounts per path)

  // Send and Receive states
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");
  const [addressSelection, setAddressSelection] = useState({
    start: 0,
    end: 0,
  });
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendConfirming, setSendConfirming] = useState(false);
  const [sendSignature, setSendSignature] = useState("");
  const [sendError, setSendError] = useState("");
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showAuthForPrivateKey, setShowAuthForPrivateKey] = useState(false);

  // Swap states
  const [showSwapScreen, setShowSwapScreen] = useState(false);
  const [swapTokenIn, setSwapTokenIn] = useState(
    "So11111111111111111111111111111111111111112"
  ); // XNT (Native SOL)
  const [swapTokenOut, setSwapTokenOut] = useState(
    "AvNDf423kEmWNP6AZHFV7DkNG4YRgt6qbdyyryjaa4PQ"
  ); // XNM
  const [swapAmount, setSwapAmount] = useState("");
  const [swapEstimate, setSwapEstimate] = useState(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState("");
  const [swapConfirming, setSwapConfirming] = useState(false);
  const [swapSignature, setSwapSignature] = useState("");

  // Browser/WebView states
  const [browserUrl, setBrowserUrl] = useState("https://vero.x1.xyz");
  const [browserInputUrl, setBrowserInputUrl] = useState("https://vero.x1.xyz");
  const [showTestBrowser, setShowTestBrowser] = useState(false);
  const webViewRef = useRef(null);

  // Haptic feedback mode toggle (secret easter egg)
  const [hapticMode, setHapticMode] = useState(false);
  const [easterEggMode, setEasterEggMode] = useState(false); // Easter egg: gray background + colorful icons
  const [tapCount, setTapCount] = useState(0);
  const tapTimerRef = useRef(null);

  // Token Chart Modal states
  const [showChartModal, setShowChartModal] = useState(false);
  const [selectedChartToken, setSelectedChartToken] = useState(null);

  // Bottom sheet refs
  const bottomSheetRef = useRef(null);
  const sendSheetRef = useRef(null);
  const receiveSheetRef = useRef(null);
  const activitySheetRef = useRef(null);
  const settingsSheetRef = useRef(null);
  const networkSheetRef = useRef(null);
  const accountSheetRef = useRef(null);
  const addressSheetRef = useRef(null);
  const ledgerSheetRef = useRef(null);
  const editWalletSheetRef = useRef(null);
  const browserSheetRef = useRef(null);
  const privateKeySheetRef = useRef(null);
  const seedPhraseSheetRef = useRef(null);
  const confirmTransactionSheetRef = useRef(null);

  const snapPoints = useMemo(() => ["50%", "90%"], []);

  // Animation scales for action buttons
  const receiveScale = useRef(new Animated.Value(1)).current;
  const sendScale = useRef(new Animated.Value(1)).current;
  const swapScale = useRef(new Animated.Value(1)).current;
  const stakeScale = useRef(new Animated.Value(1)).current;

  // Haptic feedback helper
  const triggerHaptic = useCallback(() => {
    if (Platform.OS === "android" && hapticMode) {
      Vibration.vibrate(10); // Short 10ms vibration
    }
  }, [hapticMode]);

  // Handle rapid taps on balance to toggle easter egg mode
  const handleBalanceTap = useCallback(() => {
    const newCount = tapCount + 1;
    setTapCount(newCount);

    // Clear existing timer
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }

    // If 5 taps within time window, toggle easter egg mode
    if (newCount >= 5) {
      const newEasterEggMode = !easterEggMode;
      setEasterEggMode(newEasterEggMode);
      setHapticMode(newEasterEggMode); // Also enable haptic mode with easter egg
      setTapCount(0);
      // Give strong haptic feedback for toggle
      if (Platform.OS === "android") {
        Vibration.vibrate([0, 50, 50, 50]); // Pattern: wait, vibrate, wait, vibrate
      }
      if (Platform.OS === "android") {
        ToastAndroid.show(
          newEasterEggMode ? "🎨 Easter Egg Mode ON" : "Easter Egg Mode OFF",
          ToastAndroid.SHORT
        );
      } else {
        console.log(
          newEasterEggMode ? "🎨 Easter Egg Mode ON" : "Easter Egg Mode OFF"
        );
      }
    } else {
      // Reset tap count after 1 second of no taps
      tapTimerRef.current = setTimeout(() => {
        setTapCount(0);
      }, 1000);
    }
  }, [tapCount, easterEggMode]);

  // Button press animation
  const animateButtonPress = useCallback((scale) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Debug logging function - only logs when debug drawer is active
  const addDebugLog = useCallback(
    (message) => {
      if (!showDebugDrawer) return; // Only log when debug drawer is open
      const timestamp = new Date().toLocaleTimeString();
      setDebugLogs((prev) =>
        [...prev, `[${timestamp}] ${message}`].slice(-100)
      ); // Keep last 100 logs
    },
    [showDebugDrawer]
  );

  // Wallet storage functions
  const saveWalletsToStorage = async (walletsToSave) => {
    try {
      // Remove keypair objects before saving (they can't be JSON serialized)
      // We only save secretKey and reconstruct keypair when loading
      const walletsForStorage = walletsToSave.map((wallet) => {
        const { keypair, mnemonic, ...walletWithoutSecrets } = wallet;
        return walletWithoutSecrets;
      });

      await AsyncStorage.setItem("@wallets", JSON.stringify(walletsForStorage));
      console.log("Wallets saved to storage:", walletsForStorage.length);
    } catch (error) {
      console.error("Error saving wallets:", error);
    }
  };

  const loadWalletsFromStorage = async () => {
    try {
      const storedWallets = await AsyncStorage.getItem("@wallets");
      if (storedWallets) {
        const parsed = JSON.parse(storedWallets);
        console.log("Loaded wallets from storage:", parsed.length);

        // Reconstruct keypairs from stored secret keys
        const walletsWithKeypairs = parsed.map((wallet) => {
          const { mnemonic, ...walletWithoutMnemonic } = wallet;
          // Add default value for hideZeroBalanceTokens if not present (backward compatibility)
          if (walletWithoutMnemonic.hideZeroBalanceTokens === undefined) {
            walletWithoutMnemonic.hideZeroBalanceTokens = false;
          }
          if (wallet.secretKey && !wallet.isLedger) {
            try {
              const secretKeyArray = new Uint8Array(wallet.secretKey);
              const keypair = Keypair.fromSecretKey(secretKeyArray);
              return { ...walletWithoutMnemonic, keypair };
            } catch (err) {
              console.error(
                "Error reconstructing keypair for wallet:",
                wallet.id,
                err
              );
              return walletWithoutMnemonic;
            }
          }
          return walletWithoutMnemonic;
        });

        setWallets(walletsWithKeypairs);

        // Load the last selected wallet from storage
        try {
          const storedSelectedWalletId =
            await AsyncStorage.getItem("@selectedWalletId");
          if (storedSelectedWalletId) {
            const selectedWalletFromStorage = walletsWithKeypairs.find(
              (w) => String(w.id) === storedSelectedWalletId
            );
            if (selectedWalletFromStorage) {
              setSelectedWallet(selectedWalletFromStorage);
              console.log(
                "Restored selected wallet:",
                selectedWalletFromStorage.name
              );
            } else if (walletsWithKeypairs.length > 0) {
              setSelectedWallet(walletsWithKeypairs[0]);
            }
          } else if (walletsWithKeypairs.length > 0) {
            setSelectedWallet(walletsWithKeypairs[0]);
          }
        } catch (err) {
          console.error("Error loading selected wallet:", err);
          if (walletsWithKeypairs.length > 0) {
            setSelectedWallet(walletsWithKeypairs[0]);
          }
        }
      }
    } catch (error) {
      console.error("Error loading wallets:", error);
    } finally {
      setWalletsLoaded(true);
    }
  };

  // Save and load master seed phrase
  const saveMasterSeedPhrase = async (seedPhrase) => {
    try {
      await saveSecureItem(MASTER_SEED_STORAGE_KEY, seedPhrase);
      console.log("Master seed phrase saved securely");
    } catch (error) {
      console.error("Error saving master seed phrase:", error);
    }
  };

  const loadMasterSeedPhrase = async () => {
    try {
      const stored = await getSecureItem(MASTER_SEED_STORAGE_KEY);
      if (stored) {
        setMasterSeedPhrase(stored);
        console.log("Master seed phrase loaded");
      }
    } catch (error) {
      console.error("Error loading master seed phrase:", error);
    }
  };

  const saveDerivationIndex = async (index) => {
    try {
      await saveSecureItem(DERIVATION_INDEX_STORAGE_KEY, String(index));
      console.log("Derivation index saved:", index);
    } catch (error) {
      console.error("Error saving derivation index:", error);
    }
  };

  const loadDerivationIndex = async () => {
    try {
      const stored = await getSecureItem(DERIVATION_INDEX_STORAGE_KEY);
      if (stored !== null && stored !== undefined) {
        const parsedIndex = parseInt(stored, 10);
        if (!Number.isNaN(parsedIndex)) {
          setWalletDerivationIndex(parsedIndex);
          console.log("Derivation index loaded:", parsedIndex);
        }
      }
    } catch (error) {
      console.error("Error loading derivation index:", error);
    }
  };

  // Check authentication state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const hasPin = await AuthManager.hasPin();
        if (!hasPin) {
          // Generate a random password for new users
          const randomPassword = Array.from(randomBytes(32))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
          setPassword(randomPassword);
          setAuthState("setup");
        } else {
          setAuthState("locked");
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        setAuthState("setup");
      }
    };
    checkAuth();
  }, []);

  // Clean up any stale BLE connections on app startup
  useEffect(() => {
    const cleanupStartupBLE = async () => {
      console.log("🔵 App startup: Cleaning up any stale BLE connections...");

      try {
        // Unsubscribe from any existing scans
        if (ledgerScanSubscriptionRef.current) {
          try {
            ledgerScanSubscriptionRef.current.unsubscribe();
            ledgerScanSubscriptionRef.current = null;
            console.log("  ✓ Cleared scan subscription");
          } catch (e) {
            console.log("  ⚠ Error clearing scan subscription:", e.message);
          }
        }

        // Close any existing transport connection
        if (ledgerTransportRef.current) {
          try {
            await ledgerTransportRef.current.close();
            console.log("  ✓ Closed existing transport");
          } catch (e) {
            console.log("  ⚠ Error closing transport:", e.message);
          }
          ledgerTransportRef.current = null;
        }

        // Reset cleanup flags
        ledgerCleaningRef.current = false;
        ledgerCleanedUpRef.current = false;

        console.log("🔵 Startup BLE cleanup complete (no delay on startup)");
      } catch (error) {
        console.error("Error during startup BLE cleanup:", error);
      }
    };

    cleanupStartupBLE();
  }, []);

  // Check biometric availability
  useEffect(() => {
    const checkBiometric = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
    };
    checkBiometric();
  }, []);

  // Load wallets and master seed phrase on mount
  // Clear image cache on login to refresh token icons
  useEffect(() => {
    if (authState === "unlocked") {
      // Clear image cache on login to refresh token icons
      clearImageCache();
      loadWalletsFromStorage();
      loadMasterSeedPhrase();
      loadDerivationIndex();
    }
  }, [authState]);

  // Save selected wallet ID to storage whenever it changes
  useEffect(() => {
    if (selectedWallet) {
      AsyncStorage.setItem("@selectedWalletId", String(selectedWallet.id))
        .then(() => {
          console.log("Saved selected wallet ID:", selectedWallet.id);
        })
        .catch((err) => {
          console.error("Error saving selected wallet ID:", err);
        });
    }
  }, [selectedWallet]);

  // Ensure first wallet is always selected when wallets exist but no wallet is selected
  useEffect(() => {
    if (!selectedWallet && wallets.length > 0) {
      setSelectedWallet(wallets[0]);
      console.log("Auto-selected first wallet:", wallets[0].name);
    }
  }, [wallets, selectedWallet]);

  // Initialize phraseWords when import modal opens
  useEffect(() => {
    if (showImportWalletModal && importType === "mnemonic") {
      if (
        phraseWords.length === 0 ||
        (phraseWords.length !== 12 && phraseWords.length !== 24)
      ) {
        setPhraseWords(Array(use24Words ? 24 : 12).fill(""));
      }
    }
  }, [showImportWalletModal, importType, use24Words]);

  // Sync phraseWords array when word count changes
  useEffect(() => {
    if (importType === "mnemonic" && showImportWalletModal) {
      const targetLength = use24Words ? 24 : 12;
      if (phraseWords.length !== targetLength) {
        if (phraseWords.length < targetLength) {
          setPhraseWords([
            ...phraseWords,
            ...Array(targetLength - phraseWords.length).fill(""),
          ]);
        } else {
          setPhraseWords(phraseWords.slice(0, targetLength));
        }
      }
    }
  }, [use24Words, importType, showImportWalletModal]);

  // Auto-dismiss ledger error toast after 3 seconds with slide animation
  useEffect(() => {
    if (ledgerError) {
      // Slide up animation
      Animated.spring(ledgerErrorSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        // Slide down animation
        Animated.timing(ledgerErrorSlideAnim, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setLedgerError("");
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [ledgerError]);

  // Check network connectivity after 5 seconds
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (hasCheckedNetwork) return;

      try {
        const netInfoState = await NetInfo.fetch();

        if (!netInfoState.isConnected || !netInfoState.isInternetReachable) {
          Toast.show({
            type: "error",
            text1: "No Network Connection",
            text2: "Please connect to WiFi to use this app.",
            position: "bottom",
          });
        }
        setHasCheckedNetwork(true);
      } catch (error) {
        console.log("Network check error:", error);
        setHasCheckedNetwork(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [hasCheckedNetwork]);

  // Monitor network status continuously
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });

    return () => unsubscribe();
  }, []);

  // Override console.log to capture logs
  useEffect(() => {
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog(...args);
      addDebugLog(args.join(" "));
    };
    return () => {
      console.log = originalLog;
    };
  }, [addDebugLog]);

  // Cleanup Ledger BLE on component unmount
  useEffect(() => {
    return () => {
      console.log("Component unmounting, cleaning up Ledger BLE...");
      try {
        ledgerScanSubscriptionRef.current?.unsubscribe();
        console.log("Unsubscribed from BLE scan");
      } catch (e) {
        console.log("Error unsubscribing:", e.message);
      }
      try {
        ledgerTransportRef.current?.close();
        console.log("Disconnected transport");
      } catch (e) {
        console.log("Error disconnecting transport:", e.message);
      }
    };
  }, []);

  // Get native token info based on current network
  const getNativeTokenInfo = useCallback(() => {
    return currentNetwork.nativeToken;
  }, [currentNetwork]);

  // Check balance function with caching
  const checkBalance = async (network = null, useCache = true) => {
    if (!selectedWallet) return;
    try {
      // Use provided network or current network
      const activeNetwork = network || currentNetwork;

      // Guard: ensure activeNetwork exists
      if (!activeNetwork) {
        console.log("No active network available");
        return;
      }

      const cacheKey = `${selectedWallet.publicKey}-${activeNetwork.providerId}`;

      // For Solana networks, only fetch the SOL price for header display
      // (TokenBalances component handles full balance via GraphQL)
      if (activeNetwork.providerId.startsWith("SOLANA")) {
        try {
          const solPriceResponse = await fetch(
            `${API_SERVER}/wallet/So11111111111111111111111111111111111111112?providerId=${activeNetwork.providerId}`
          );
          const solPriceData = await solPriceResponse.json();
          const solPrice = solPriceData?.tokens?.[0]?.price;
          if (solPrice && solPrice > 0) {
            setTokenPrice(solPrice);
          }
        } catch (error) {
          console.error("Failed to fetch SOL price for header:", error);
        }
        return; // Skip full balance fetch - GraphQL handles that
      }

      // Load from cache first if requested
      if (useCache && balanceCache[cacheKey]) {
        const cached = balanceCache[cacheKey];
        setBalance(cached.balance);
        setBalanceUSD(cached.balanceUSD);
        setTokens(cached.tokens);
        setTokenPrice(cached.tokenPrice);
        console.log("Loaded balance from cache for", activeNetwork.name);
      }

      // Fetch fresh data in background
      const url = `${API_SERVER}/wallet/${selectedWallet.publicKey}?providerId=${activeNetwork.providerId}`;
      console.log("Fetching balance from:", url);

      const response = await fetch(url);
      console.log(
        `Balance API Response: ${response.status} ${response.statusText}`
      );

      // Handle 404 - wallet not found, set balance to 0
      if (response.status === 404) {
        console.log("Wallet not found (404), setting balance to 0");
        setBalance("0.00");
        setBalanceUSD("$0.00");
        setTokens([]);
        // Update cache with zero balance
        setBalanceCache((prev) => ({
          ...prev,
          [cacheKey]: {
            balance: "0.00",
            balanceUSD: "$0.00",
            tokens: [],
            tokenPrice: 0,
            timestamp: Date.now(),
          },
        }));
        return;
      }

      // Handle other non-200 responses
      if (!response.ok) {
        console.error(
          `Balance API error: ${response.status} ${response.statusText}`
        );
        // Don't update balance on error, keep existing values
        return;
      }

      const data = await response.json();

      if (data.balance !== undefined) {
        // Format balance with up to 6 decimals for display
        const balanceStr = data.balance.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        });
        const usdStr = data.tokens[0]?.valueUSD
          ? `$${data.tokens[0].valueUSD.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "$0.00";

        // Extract the price from the native token (first token)
        let price = data.tokens[0]?.price || 0;

        // Fetch real SOL price from REST API if price is $1 or less (incorrect API data)
        if (activeNetwork.providerId.startsWith("SOLANA") && price <= 1) {
          try {
            const solPriceResponse = await fetch(
              `${API_SERVER}/wallet/So11111111111111111111111111111111111111112?providerId=${activeNetwork.providerId}`
            );
            const solPriceData = await solPriceResponse.json();
            const realSolPrice = solPriceData?.tokens?.[0]?.price;
            if (realSolPrice && realSolPrice > 0) {
              price = realSolPrice;
              console.log("Fetched real SOL price from REST API:", price);
            }
          } catch (error) {
            console.error("Failed to fetch real SOL price:", error);
            // Keep using the original price as fallback
          }
        }

        const formattedTokens = data.tokens.map((token, idx) => {
          // Map logo string to actual asset
          let logoAsset = null;
          if (token.logo === "./x1.png") {
            logoAsset = require("./assets/x1.png");
          } else if (token.logo === "./xnm.png") {
            logoAsset = require("./assets/xnm.png");
          } else if (token.logo === "./solana.png") {
            logoAsset = require("./assets/solana.png");
          }

          return {
            id: String(idx + 1),
            symbol: token.symbol,
            name: token.name || token.symbol,
            balance: token.balance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 5,
            }),
            usdValue: token.valueUSD.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            price: token.price || 0,
            logo: logoAsset,
            logoUrl: token.logoUrl || null,
            icon:
              token.symbol === "XNT"
                ? "💎"
                : token.symbol === "SOL"
                  ? "◎"
                  : "🪙",
          };
        });

        setBalance(balanceStr);
        setBalanceUSD(usdStr);
        setTokenPrice(price);
        setTokens(formattedTokens);

        // Save to cache
        setBalanceCache((prev) => ({
          ...prev,
          [cacheKey]: {
            balance: balanceStr,
            balanceUSD: usdStr,
            tokenPrice: price,
            tokens: formattedTokens,
          },
        }));

        console.log(
          "Balance updated:",
          balanceStr,
          getNativeTokenInfo().symbol
        );
      }
    } catch (error) {
      // Only log network errors once every 30 seconds to reduce console spam
      const now = Date.now();
      if (
        error.message === "Network request failed" ||
        error.message.includes("fetch")
      ) {
        if (now - lastNetworkError > 30000) {
          console.error("Network error - API unavailable or device offline");
          setLastNetworkError(now);
        }
        // Keep existing balance displayed, don't clear it
      } else {
        // Log non-network errors normally
        console.error("Error checking balance:", error);
      }
    }
  };

  // Fetch token metadata from REST API
  const fetchTokenMetadata = async (identifier, useMint = false) => {
    try {
      // Build URL based on whether we're searching by mint or symbol
      const param = useMint
        ? `mint=${encodeURIComponent(identifier)}`
        : `symbol=${encodeURIComponent(identifier)}`;
      const url = `${API_SERVER}/tokens?${param}&verified=true`;

      console.log(
        `[Token API] 🔍 Fetching metadata by ${useMint ? "mint" : "symbol"}: "${identifier}"`
      );
      console.log(`[Token API] 📡 Full URL: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        console.log(
          `[Token API] ❌ HTTP ${response.status} - Failed to fetch token metadata`
        );
        return null;
      }

      const data = await response.json();
      console.log(
        `[Token API] 📦 Response data:`,
        JSON.stringify(data, null, 2)
      );

      if (data && data.tokens && data.tokens.length > 0) {
        const token = data.tokens[0]; // Use first (highest market cap) result
        console.log(
          `[Token API] ✅ Found token: ${token.name} (${token.symbol}) - $${token.price}`
        );
        console.log(`[Token API] 🏷️  Mint: ${token.mint}`);
        console.log(`[Token API] 🖼️  Icon: ${token.icon}`);
        return {
          name: token.name,
          symbol: token.symbol,
          icon: token.icon,
          price: token.price,
          mint: token.mint,
        };
      }

      console.log(
        `[Token API] ⚠️  No token found for ${useMint ? "mint" : "symbol"}: "${identifier}"`
      );
      console.log(
        `[Token API] 📊 Response contained ${data?.tokens?.length || 0} tokens`
      );
      return null;
    } catch (error) {
      console.error(`[Token API] 💥 Error fetching token metadata:`, error);
      return null;
    }
  };

  // Fetch transactions with on-demand indexing and polling
  const checkTransactions = async (network = null) => {
    if (!selectedWallet) return;

    const activeNetwork = network || currentNetwork;
    if (!activeNetwork) {
      console.log("No active network available");
      return;
    }

    try {
      setIsIndexing(true);
      setIndexingMessage("Checking for new transactions...");

      // Step 1: Check database first (database-first approach)
      console.log("📂 Checking database for existing transactions...");
      const checkUrl = `${API_SERVER}/transactions/${selectedWallet.publicKey}?providerId=${activeNetwork.providerId}`;
      const checkResponse = await fetch(checkUrl);
      const checkData = await checkResponse.json();

      let needsIndexing =
        !checkData ||
        !checkData.transactions ||
        checkData.transactions.length === 0;
      let dataToProcess = null;

      // If we already have data from database, use it immediately
      if (!needsIndexing) {
        console.log(
          `✓ Found ${checkData.transactions.length} existing transactions in database (no blockchain fetch needed)`
        );
        setIndexingMessage("Loading from database...");
        dataToProcess = checkData;
      } else {
        // Step 2: Database empty - trigger on-demand indexing
        console.log("⚠️  Database empty - triggering blockchain indexing...");
        setIndexingMessage("Fetching from blockchain...");

        const indexUrl = `${API_SERVER}/wallets/index-now`;
        const indexResponse = await fetch(indexUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address: selectedWallet.publicKey,
            network: activeNetwork.providerId,
          }),
        });

        if (!indexResponse.ok) {
          const errorText = await indexResponse.text();
          console.error(
            `❌ Indexing failed: ${indexResponse.status} ${indexResponse.statusText}`
          );
          console.error(`Response: ${errorText.substring(0, 200)}`);
          throw new Error(`Indexing API error: ${indexResponse.status}`);
        }

        const indexResult = await indexResponse.json();
        console.log("✅ Indexing result:", indexResult);

        if (indexResult.indexed > 0) {
          setIndexingMessage(`Found ${indexResult.indexed} new transactions`);
        } else {
          setIndexingMessage("No transactions found");
        }
      }

      // Step 3: Fetch/Poll for transactions (only if we need to wait for indexing)
      const POLL_INTERVAL = 5000; // 5 seconds
      const MAX_POLLS = 6; // 30 seconds total
      let pollCount = 0;
      let transactionsFound = false;

      const pollTransactions = async () => {
        // If we already have data from database, use it immediately
        let data;
        if (dataToProcess) {
          console.log(
            `📊 Using ${dataToProcess.transactions.length} transactions from initial database check`
          );
          data = dataToProcess;
          dataToProcess = null; // Clear it so we don't use it again
        } else {
          // Poll for newly indexed transactions
          pollCount++;
          console.log(`📊 Polling attempt ${pollCount}/${MAX_POLLS}...`);

          setIndexingMessage(
            `Loading transactions (${pollCount}/${MAX_POLLS})...`
          );

          const url = `${API_SERVER}/transactions/${selectedWallet.publicKey}?providerId=${activeNetwork.providerId}`;
          const response = await fetch(url);
          data = await response.json();

          console.log(
            `Received ${data?.transactions?.length || 0} transactions`
          );
        }

        if (data && data.transactions && data.transactions.length > 0) {
          // Transactions found!
          transactionsFound = true;

          const formattedTransactions = await Promise.all(
            data.transactions.map(async (tx) => {
              let date;
              if (typeof tx.timestamp === "string") {
                date = new Date(tx.timestamp);
              } else if (typeof tx.timestamp === "number") {
                date = new Date(tx.timestamp * 1000);
              } else {
                date = new Date();
              }
              const isValidDate = !isNaN(date.getTime());

              const amountNum =
                typeof tx.amount === "string"
                  ? parseFloat(tx.amount)
                  : tx.amount || 0;

              let displayType = "received";
              if (tx.type === "SEND") {
                displayType = "sent";
              } else if (tx.type === "RECEIVE") {
                displayType = "received";
              } else if (tx.type === "SWAP") {
                displayType = "swap";
              } else if (tx.type === "UNKNOWN") {
                displayType = "unknown";
              }

              // Get token symbol and mint address
              const tokenSymbol =
                tx.tokenSymbol || tx.symbol || getNativeTokenInfo().symbol;
              const tokenMint = tx.tokenMint || tx.mint; // Full mint address for lookup

              // Fetch token metadata from REST API (only for non-native tokens on Solana)
              let tokenMetadata = null;
              const isSolanaNetwork =
                activeNetwork.id === "SOLANA" ||
                activeNetwork.id === "SOLANA_DEVNET";
              const isNativeToken =
                tokenSymbol === "SOL" || tokenSymbol === "XNT";

              if (isSolanaNetwork && !isNativeToken && tokenMint) {
                tokenMetadata = await fetchTokenMetadata(tokenMint, true); // true = use mint address
              }

              // Calculate USD value if we have token price
              const valueUSD = tokenMetadata?.price
                ? (amountNum * tokenMetadata.price).toFixed(2)
                : null;

              // Hide tokens not in database (likely scam/spam tokens)
              // Only filter Solana non-native tokens that have a mint but no metadata
              if (
                isSolanaNetwork &&
                !isNativeToken &&
                tokenMint &&
                !tokenMetadata
              ) {
                return null; // This transaction will be filtered out
              }

              return {
                id: tx.hash || tx.signature,
                type: displayType,
                amount: amountNum.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 9,
                }),
                amountRaw: amountNum, // Keep raw amount for calculations
                token: tokenMetadata?.symbol || tokenSymbol, // Use symbol from metadata if available
                tokenName: null, // Don't show full token name to keep UI compact
                tokenIcon: tokenMetadata?.icon || null,
                tokenPrice: tokenMetadata?.price || null,
                valueUSD: valueUSD,
                timestamp: isValidDate
                  ? date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Unknown",
                timestampDate: isValidDate ? date : null, // Keep date object for grouping
                fee: tx.fee || "0.000001650",
                signature: tx.hash || tx.signature,
              };
            })
          );

          // Filter out null values (hidden scam tokens)
          const validTransactions = formattedTransactions.filter(
            (tx) => tx !== null
          );
          const hiddenCount =
            formattedTransactions.length - validTransactions.length;

          if (hiddenCount > 0) {
            console.log(
              `🚫 Filtered out ${hiddenCount} unverified/scam token transactions`
            );
          }

          // Filter out micro transactions (likely spam)
          const MICRO_TRANSACTION_THRESHOLD = 0.001;
          const nonMicroTransactions = validTransactions.filter((tx) => {
            const amount = Math.abs(tx.amountRaw || 0);
            return amount >= MICRO_TRANSACTION_THRESHOLD;
          });
          const microCount =
            validTransactions.length - nonMicroTransactions.length;

          if (microCount > 0) {
            console.log(
              `🚫 Filtered out ${microCount} micro transactions (dust/spam)`
            );
          }

          // Group transactions by date
          const groupedByDate = {};
          nonMicroTransactions.forEach((tx) => {
            const dateKey = tx.timestamp;
            if (!groupedByDate[dateKey]) {
              groupedByDate[dateKey] = [];
            }
            groupedByDate[dateKey].push(tx);
          });

          // Convert to array of {date, transactions} objects
          const groupedTransactions = Object.keys(groupedByDate).map(
            (date) => ({
              date,
              transactions: groupedByDate[date],
            })
          );

          // Sort by date (most recent first)
          groupedTransactions.sort((a, b) => {
            const dateA = a.transactions[0].timestampDate;
            const dateB = b.transactions[0].timestampDate;
            return dateB - dateA;
          });

          // Log date range of loaded transactions
          if (groupedTransactions.length > 0) {
            const newestDate = groupedTransactions[0].date;
            const oldestDate =
              groupedTransactions[groupedTransactions.length - 1].date;
            console.log(
              `✅ Loaded ${nonMicroTransactions.length} transactions | Date range: ${oldestDate} to ${newestDate}`
            );
          } else {
            console.log(
              `✅ Loaded ${nonMicroTransactions.length} transactions`
            );
          }
          setTransactions(groupedTransactions);

          // Track oldest signature for pagination
          if (data.transactions && data.transactions.length > 0) {
            const lastTx = data.transactions[data.transactions.length - 1];
            setOldestSignature(lastTx.hash);
            setHasMoreTransactions(data.transactions.length >= 50);
          }

          setIndexingMessage(
            `Loaded ${nonMicroTransactions.length} transactions`
          );
          setIsIndexing(false);
          return true; // Stop polling
        } else {
          // No transactions yet
          if (pollCount >= MAX_POLLS) {
            // Timeout - stop polling
            console.log("⏱️  Polling timeout - no transactions found");
            setIndexingMessage("No activity to display");
            setIsIndexing(false);
            setTransactions([]);
            return true; // Stop polling
          } else {
            // Continue polling
            return false;
          }
        }
      };

      // Start polling loop
      while (!transactionsFound && pollCount < MAX_POLLS) {
        const shouldStop = await pollTransactions();
        if (shouldStop) break;

        // Wait 5 seconds before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }
    } catch (error) {
      console.error("Error checking transactions:", error);
      setIndexingMessage("Error loading transactions");
      setIsIndexing(false);
    }
  };

  // Load more transactions when scrolling to bottom
  const loadMoreTransactions = async () => {
    if (!selectedWallet || isLoadingMore || !hasMoreTransactions) {
      return;
    }

    const activeNetwork = currentNetwork;
    if (!activeNetwork) {
      console.log("No active network available");
      return;
    }

    if (!oldestSignature) {
      console.log("No oldest signature available for pagination");
      return;
    }

    try {
      setIsLoadingMore(true);
      console.log(
        `📜 Loading more transactions before: ${oldestSignature.substring(0, 8)}...`
      );

      // Step 1: Check database first (database-first approach)
      console.log("📂 Checking database for more transactions...");
      let url = `${API_SERVER}/transactions/${selectedWallet.publicKey}?providerId=${activeNetwork.providerId}&before=${oldestSignature}`;
      let response = await fetch(url);
      let data = await response.json();

      // Step 2: If database is empty, trigger blockchain indexing
      if (!data || !data.transactions || data.transactions.length === 0) {
        console.log("⚠️  Database exhausted - fetching from blockchain...");

        const indexResponse = await fetch(`${API_SERVER}/wallets/index-now`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: selectedWallet.publicKey,
            network: activeNetwork.providerId,
            beforeSignature: oldestSignature, // Fetch transactions BEFORE this one
          }),
        });

        if (!indexResponse.ok) {
          const errorText = await indexResponse.text();
          console.error(`❌ Indexing failed: ${indexResponse.status}`);
          throw new Error(`Indexing failed: ${indexResponse.status}`);
        }

        const indexResult = await indexResponse.json();
        console.log(`   ✅ Indexed ${indexResult.indexed} older transactions`);

        // If no new transactions were indexed, we've reached the end
        if (indexResult.indexed === 0) {
          console.log(
            "   ✅ No more transactions available (end of blockchain history)"
          );
          setHasMoreTransactions(false);
          setIsLoadingMore(false);
          return;
        }

        // Step 3: Fetch the newly indexed transactions from database
        response = await fetch(url);
        data = await response.json();
      } else {
        console.log(
          `✓ Found ${data.transactions.length} more transactions in database (no blockchain fetch needed)`
        );
      }

      if (data && data.transactions && data.transactions.length > 0) {
        // Log date range of newly loaded transactions
        const firstNewTx = data.transactions[0];
        const lastNewTx = data.transactions[data.transactions.length - 1];
        const firstDate = new Date(
          firstNewTx.timestamp * 1000
        ).toLocaleDateString();
        const lastDate = new Date(
          lastNewTx.timestamp * 1000
        ).toLocaleDateString();
        console.log(
          `   📦 Loaded ${data.transactions.length} more transactions | Date range: ${lastDate} to ${firstDate}`
        );

        // Process new transactions (same logic as checkTransactions)
        const formattedTransactions = await Promise.all(
          data.transactions.map(async (tx) => {
            let date;
            if (typeof tx.timestamp === "string") {
              date = new Date(tx.timestamp);
            } else if (typeof tx.timestamp === "number") {
              date = new Date(tx.timestamp * 1000);
            } else {
              date = new Date();
            }
            const isValidDate = !isNaN(date.getTime());

            const amountNum =
              typeof tx.amount === "string"
                ? parseFloat(tx.amount)
                : tx.amount || 0;

            let displayType = "received";
            if (tx.type === "SEND") {
              displayType = "sent";
            } else if (tx.type === "RECEIVE") {
              displayType = "received";
            } else if (tx.type === "SWAP") {
              displayType = "swap";
            } else if (tx.type === "UNKNOWN") {
              displayType = "unknown";
            }

            // Get token symbol and mint address
            const tokenSymbol =
              tx.tokenSymbol || tx.symbol || getNativeTokenInfo().symbol;
            const tokenMint = tx.tokenMint || tx.mint;

            // Fetch token metadata from REST API (only for non-native tokens on Solana)
            let tokenMetadata = null;
            const isSolanaNetwork =
              activeNetwork.id === "SOLANA" ||
              activeNetwork.id === "SOLANA_DEVNET";
            const isNativeToken =
              tokenSymbol === "SOL" || tokenSymbol === "XNT";

            if (isSolanaNetwork && !isNativeToken && tokenMint) {
              tokenMetadata = await fetchTokenMetadata(tokenMint, true);
            }

            // Calculate USD value if we have token price
            const valueUSD = tokenMetadata?.price
              ? (amountNum * tokenMetadata.price).toFixed(2)
              : null;

            // Hide tokens not in database (likely scam/spam tokens)
            if (
              isSolanaNetwork &&
              !isNativeToken &&
              tokenMint &&
              !tokenMetadata
            ) {
              return null; // This transaction will be filtered out
            }

            return {
              id: tx.hash,
              type: displayType,
              amount: amountNum.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 9,
              }),
              amountRaw: amountNum,
              token: tokenMetadata?.symbol || tokenSymbol,
              tokenName: null,
              tokenIcon: tokenMetadata?.icon || null,
              tokenPrice: tokenMetadata?.price || null,
              valueUSD: valueUSD,
              signature: tx.hash,
              timestamp: isValidDate
                ? date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Unknown date",
              timestampDate: date,
            };
          })
        );

        // Filter out null values (hidden scam tokens)
        const validTransactions = formattedTransactions.filter(
          (tx) => tx !== null
        );
        const hiddenCount =
          formattedTransactions.length - validTransactions.length;

        if (hiddenCount > 0) {
          console.log(
            `🚫 Filtered out ${hiddenCount} unverified/scam token transactions`
          );
        }

        // Filter out micro transactions (likely spam)
        const MICRO_TRANSACTION_THRESHOLD = 0.001;
        const nonMicroTransactions = validTransactions.filter((tx) => {
          const amount = Math.abs(tx.amountRaw || 0);
          return amount >= MICRO_TRANSACTION_THRESHOLD;
        });
        const microCount =
          validTransactions.length - nonMicroTransactions.length;

        if (microCount > 0) {
          console.log(
            `🚫 Filtered out ${microCount} micro transactions (dust/spam)`
          );
        }

        // Merge with existing transactions and remove duplicates
        const allTransactions = [...transactions];

        nonMicroTransactions.forEach((newTx) => {
          const existing = allTransactions.find((group) =>
            group.transactions.some((t) => t.id === newTx.id)
          );
          if (!existing) {
            // Find or create date group
            let dateGroup = allTransactions.find(
              (g) => g.date === newTx.timestamp
            );
            if (!dateGroup) {
              dateGroup = { date: newTx.timestamp, transactions: [] };
              allTransactions.push(dateGroup);
            }
            dateGroup.transactions.push(newTx);
          }
        });

        // Sort groups by date
        allTransactions.sort((a, b) => {
          const dateA = a.transactions[0].timestampDate;
          const dateB = b.transactions[0].timestampDate;
          return dateB - dateA;
        });

        setTransactions(allTransactions);

        // Update oldest signature for next pagination
        const lastTx = data.transactions[data.transactions.length - 1];
        setOldestSignature(lastTx.hash);

        // Check if there are more transactions
        if (data.transactions.length < 50) {
          setHasMoreTransactions(false);
          console.log("   ✅ No more transactions available");
        }
      } else {
        console.log("   ✅ No more transactions found");
        setHasMoreTransactions(false);
      }
    } catch (error) {
      console.error("Error loading more transactions:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Fetch both balance and transactions without using cache
      await Promise.all([
        checkBalance(null, false), // false = don't use cache
        checkTransactions(),
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle balance updates from TokenBalances component
  const handleBalanceUpdate = useCallback(
    (balanceUSD, gainLossData, nativeBalance) => {
      setBalanceUSD(balanceUSD);
      if (gainLossData && selectedWallet && currentNetwork) {
        // Cache gain/loss data per wallet + network
        const cacheKey = `${selectedWallet.publicKey}-${currentNetwork.id}`;
        setGainLossCache((prev) => ({
          ...prev,
          [cacheKey]: gainLossData,
        }));
        setPortfolioGainLoss(gainLossData);
      }
      // Update native token balance for SendScreen (important for Solana networks)
      if (nativeBalance !== undefined) {
        setBalance(nativeBalance);
      }
    },
    [selectedWallet, currentNetwork]
  );

  // Restore network-specific gain/loss when switching networks or wallets
  useEffect(() => {
    if (selectedWallet && currentNetwork) {
      const cacheKey = `${selectedWallet.publicKey}-${currentNetwork.id}`;
      const cachedGainLoss = gainLossCache[cacheKey];
      if (cachedGainLoss) {
        setPortfolioGainLoss(cachedGainLoss);
      } else {
        // Reset to zero if no cached data for this wallet + network
        setPortfolioGainLoss({ percentChange: 0, valueChange: 0 });
      }
    }
  }, [selectedWallet, currentNetwork, gainLossCache]);

  // Load initial balance
  useEffect(() => {
    if (!selectedWallet) return;
    checkBalance();
  }, [selectedWallet?.publicKey, currentNetwork]);

  // Auto-refresh balance every 3 seconds
  useEffect(() => {
    if (!selectedWallet) return;

    const interval = setInterval(() => {
      checkBalance(null, false); // Don't use cache for auto-refresh
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedWallet?.publicKey, currentNetwork]);

  const switchNetwork = (network) => {
    setCurrentNetwork(network);
    // Use cache for instant switch, then fetch fresh data in background
    checkBalance(network, true);
    networkSheetRef.current?.dismiss();
  };

  // Handle double tap on X1 button to toggle between mainnet and testnet
  const handleX1NetworkPress = () => {
    const currentTime = Date.now();
    const timeSinceLastTap = currentTime - lastX1TapTime;

    // Double tap detected (within 300ms)
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      triggerHaptic();

      // Toggle between X1 Mainnet and X1 Testnet
      if (currentNetwork.id === "X1") {
        // Switch to X1 Testnet
        const testnet = NETWORKS.find((n) => n.id === "X1_TESTNET");
        if (testnet) {
          switchNetwork(testnet);
          Toast.show({
            type: "info",
            text1: "Switched to X1 Testnet",
            position: "bottom",
            visibilityTime: 2000,
          });
        }
      } else if (currentNetwork.id === "X1_TESTNET") {
        // Switch to X1 Mainnet
        const mainnet = NETWORKS.find((n) => n.id === "X1");
        if (mainnet) {
          switchNetwork(mainnet);
          Toast.show({
            type: "info",
            text1: "Switched to X1 Mainnet",
            position: "bottom",
            visibilityTime: 2000,
          });
        }
      }

      // Reset the tap time
      setLastX1TapTime(0);
    } else {
      // Single tap - switch to X1 Mainnet (default behavior)
      triggerHaptic();
      switchNetwork(NETWORKS.find((n) => n.id === "X1"));
      setLastX1TapTime(currentTime);
    }
  };

  const selectWallet = (wallet) => {
    setWallets(wallets.map((w) => ({ ...w, selected: w.id === wallet.id })));
    setSelectedWallet(wallet);
    bottomSheetRef.current?.dismiss();
  };

  // Settings navigation helpers
  const navigateToSettingsScreen = (screen) => {
    setSettingsNavigationStack([...settingsNavigationStack, screen]);
  };

  // Reset wallet confirmation handler
  const handleResetWalletConfirmation = () => {
    Alert.alert(
      "Reset Wallet",
      "This will permanently delete all wallets, seed phrases, and app data. You will need to set up a new PIN and create new wallets. This action cannot be undone.\n\nAre you sure you want to continue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              Toast.show({
                type: "info",
                text1: "Resetting Wallet",
                text2: "Clearing all data...",
                position: "bottom",
              });
              setShowSettingsModal(false);

              // Clear AsyncStorage
              await AsyncStorage.clear();

              // Clear SecureStore - use AuthManager to clear all security data
              await AuthManager.clearSecurityState();

              // Reset all state variables
              setMasterSeedPhrase(null);
              setWallets([]);
              setSelectedWallet(null);
              setEditingWallet(null);
              setEditWalletName("");
              setShowAddWalletModal(false);
              setShowChangeNameModal(false);
              setShowViewPrivateKeyModal(false);
              setShowViewSeedPhraseModal(false);
              setShowExportSeedPhraseModal(false);
              setShowChangeSeedPhraseModal(false);
              setSecurityAuthenticated(false);
              setSecurityAuthRequired(false);
              setWalletDerivationIndex(0);

              // Generate a random password for PIN setup (same as initial app load)
              const randomPassword = Array.from(randomBytes(32))
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join("");
              setPassword(randomPassword);

              // Go directly to PIN setup screen
              setAuthState("setup");
            } catch (error) {
              console.error("Error resetting wallet:", error);
              Toast.show({
                type: "error",
                text1: "Error",
                text2: "Failed to reset wallet. Please try again.",
                position: "bottom",
              });
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const navigateBackInSettings = () => {
    if (settingsNavigationStack.length > 0) {
      const newStack = [...settingsNavigationStack];
      const currentScreen = newStack.pop();
      setSettingsNavigationStack(newStack);

      // Reset state when leaving certain screens
      if (currentScreen === "changeSeed") {
        setNewSeedPhraseInput("");
        setGeneratedNewSeed("");
        setChangeSeedPhraseMode("enter");
      }
    } else {
      // If stack is empty, close the settings modal
      setShowSettingsModal(false);
    }
  };

  const closeAllSettings = () => {
    setSettingsNavigationStack([]);
    setShowSettingsModal(false);
    // Reset state
    setNewSeedPhraseInput("");
    setGeneratedNewSeed("");
    setChangeSeedPhraseMode("enter");
  };

  // Handle hardware back button (Android only)
  useEffect(() => {
    if (Platform.OS !== "android") return () => {};
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // If settings modal is open
        if (showSettingsModal) {
          if (settingsNavigationStack.length > 0) {
            navigateBackInSettings();
          } else {
            closeAllSettings();
          }
          return true; // Prevent default back behavior
        }

        // If wallet edit modal is open
        if (editingWallet) {
          editWalletSheetRef.current?.dismiss();
          setEditingWallet(null);
          return true;
        }

        // If token chart modal is open
        if (selectedChartToken) {
          setSelectedChartToken(null);
          return true;
        }

        // Let the app handle default back behavior (exit)
        return false;
      }
    );

    return () => backHandler.remove();
  }, [
    showSettingsModal,
    settingsNavigationStack,
    editingWallet,
    selectedChartToken,
  ]);

  const handleChangeSeedPhrase = (seedPhrase) => {
    // If seedPhrase is provided (from generated), use it; otherwise it will be read from input
    if (seedPhrase) {
      // Generate mode - set the generated seed and call confirm
      setGeneratedNewSeed(seedPhrase);
      // Wait a moment for state to update, then call confirm
      setTimeout(() => handleConfirmChangeSeedPhrase(), 100);
    } else {
      // Enter mode - call confirm directly
      handleConfirmChangeSeedPhrase();
    }
  };

  const handleDeleteWallet = (wallet) => {
    console.log("=== DELETING WALLET ===");
    console.log("Wallet ID:", wallet.id);
    console.log("Wallet name:", wallet.name);
    console.log("Wallet address:", wallet.address);
    console.log("Wallet publicKey:", wallet.publicKey);
    console.log("Is Ledger?:", wallet.isLedger);
    console.log("Derivation path:", wallet.derivationPath);
    console.log("Ledger device ID:", wallet.ledgerDeviceId);
    console.log("Device ID type:", typeof wallet.ledgerDeviceId);
    console.log("Full wallet object:", JSON.stringify(wallet, null, 2));
    console.log("=== END WALLET INFO ===");

    // Delete wallet directly
    (async () => {
      console.log("Deleting wallet:", wallet.name);
      // Remove the wallet from the list
      const updatedWallets = wallets.filter((w) => w.id !== wallet.id);
      console.log("Wallets after deletion:", updatedWallets.length);
      setWallets(updatedWallets);
      await deleteWalletMnemonicSecurely(wallet.id);

      // If we deleted the selected wallet, select the first remaining wallet or reset
      if (wallet.selected && updatedWallets.length > 0) {
        const newSelectedWallet = {
          ...updatedWallets[0],
          selected: true,
        };
        setWallets(
          updatedWallets.map((w) => ({
            ...w,
            selected: w.id === newSelectedWallet.id,
          }))
        );
        setSelectedWallet(newSelectedWallet);
      } else if (updatedWallets.length === 0) {
        // No wallets left, reset to initial state
        setSelectedWallet({
          id: 1,
          name: "Wallet 1",
          address: "Abc1...xyz2",
          publicKey: "",
          selected: true,
        });
      }

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Wallet deleted successfully",
        position: "bottom",
      });
    })();
  };

  const openSeedPhraseSheet = useCallback(async () => {
    if (!editingWallet) {
      return;
    }

    try {
      setWalletSeedPhraseLoading(true);
      let phrase = null;

      if (!editingWallet.derivationPath) {
        phrase = await loadWalletMnemonicSecurely(editingWallet.id);
      }

      setWalletSeedPhraseForDisplay(phrase);
    } catch (error) {
      console.error("Error loading wallet seed phrase:", error);
      setWalletSeedPhraseForDisplay(null);
    } finally {
      setWalletSeedPhraseLoading(false);
      seedPhraseSheetRef.current?.present();
    }
  }, [editingWallet]);

  // Register wallet with the transaction indexer API
  const registerWalletWithIndexer = async (address, network) => {
    try {
      console.log(
        `📝 Registering wallet with indexer: ${address} on ${network}`
      );

      const response = await fetch(`${API_SERVER}/wallets/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          network, // Use full provider ID like "X1-mainnet" or "SOLANA-mainnet"
          enabled: true,
        }),
      });

      // Check response status before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `❌ Failed to register wallet: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
        );
        // Don't throw - wallet registration failure shouldn't break wallet creation
        return;
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Wallet registered successfully: ${address}`);
      } else {
        console.error(
          `❌ Failed to register wallet: ${data.error || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error registering wallet with indexer: ${error.message}`
      );
      // Don't throw - wallet registration failure shouldn't break wallet creation
    }
  };

  const selectAccount = (account) => {
    setAccounts(accounts.map((a) => ({ ...a, selected: a.id === account.id })));
    setSelectedAccount(account);
    accountSheetRef.current?.dismiss();
  };

  const showWalletSelector = () => {
    bottomSheetRef.current?.present();
  };

  const showNetworkSelector = () => {
    networkSheetRef.current?.present();
  };

  const showAccountSelector = () => {
    accountSheetRef.current?.present();
  };

  const handleReceive = () => {
    receiveSheetRef.current?.present();
  };

  // Singleton BLE transport getter - reuses existing connection
  const getLedgerTransport = async (deviceId) => {
    // If we have a stored transport, check if it's still valid
    if (ledgerTransportRef.current) {
      try {
        // Test if transport is still connected by sending a ping (get app info)
        if (ledgerTransportRef.current.device) {
          // Try to actually communicate with the device to verify connection
          const Solana = (await import("@ledgerhq/hw-app-solana")).default;
          const solana = new Solana(ledgerTransportRef.current);
          await solana.getAppConfiguration(); // This will throw if disconnected
          console.log(
            "Reusing existing BLE transport (singleton) - verified connected"
          );
          return ledgerTransportRef.current;
        }
      } catch (err) {
        console.log("Stored transport is no longer valid:", err.message);
        // Close the stale transport
        try {
          await ledgerTransportRef.current.close();
        } catch (closeErr) {
          console.log("Error closing stale transport:", closeErr.message);
        }
        ledgerTransportRef.current = null;
      }
    }

    // No valid transport exists, create a new one
    console.log("Creating new BLE transport connection...");
    const transport = await TransportBLE.open(deviceId);
    ledgerTransportRef.current = transport;
    console.log("New BLE transport created and stored (singleton)");
    return transport;
  };

  const handleSend = () => {
    sendSheetRef.current?.present();
  };

  // Handle token click to show chart
  const handleTokenClick = (tokenInfo) => {
    console.log("Token clicked:", tokenInfo);
    setSelectedChartToken({
      symbol: tokenInfo.symbol,
      name: tokenInfo.symbol, // We can enhance this later with full token names
    });
    setShowChartModal(true);
  };

  const copyToClipboard = (text) => {
    console.log("📋 Copying to clipboard:", text);
    console.log("📋 Text length:", text?.length);
    console.log("📋 selectedWallet.address:", selectedWallet?.address);
    console.log("📋 selectedWallet.publicKey:", selectedWallet?.publicKey);
    Clipboard.setString(text);
    Toast.show({
      type: "success",
      text1: "Copied",
      text2: "Address copied to clipboard",
      position: "bottom",
    });
  };

  // QR Scanner functions
  const handleOpenQRScanner = async () => {
    if (!cameraPermission) {
      return;
    }

    if (!cameraPermission.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "Please enable camera permission in settings",
          position: "bottom",
        });
        return;
      }
    }
    setShowQRScanner(true);
  };

  const handleQRCodeScanned = (result) => {
    if (result && result.data) {
      setShowQRScanner(false);
      setSendAddress(result.data);

      // Delay setting selection to ensure text is rendered first
      setTimeout(() => {
        setAddressSelection({ start: 0, end: 0 });
      }, 100);

      Toast.show({
        type: "success",
        text1: "QR Code Scanned",
        text2: "Address populated",
        position: "bottom",
      });
    }
  };

  const handleSendSubmit = async (amount, address) => {
    // Dismiss keyboard when Send button is pressed
    Keyboard.dismiss();

    if (!selectedWallet) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "No wallet selected",
        position: "bottom",
      });
      return;
    }
    if (!address || !amount) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Please enter both address and amount",
        position: "bottom",
      });
      return;
    }

    // Trim the address to remove any whitespace
    // Store values in state for confirmation screen
    setSendAmount(amount);
    setSendAddress(address);

    // Trim the address to remove any whitespace
    const trimmedAddress = address.trim();

    // Validate address format
    try {
      new PublicKey(trimmedAddress);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Invalid recipient address",
        position: "bottom",
      });
      return;
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Invalid amount",
        position: "bottom",
      });
      return;
    }

    // Store pending transaction and show biometric confirmation
    setPendingTransaction({ amount: amountNum, address: trimmedAddress });
    sendSheetRef.current?.dismiss();
    confirmTransactionSheetRef.current?.present();
  };

  // Execute the pending transaction after biometric confirmation
  const executePendingTransaction = async () => {
    if (!pendingTransaction) return;

    setShowSendConfirm(true);
    setSendConfirming(true);
    setSendError("");
    confirmTransactionSheetRef.current?.dismiss();

    const { amount: amountNum, address: trimmedAddress } = pendingTransaction;

    try {
      console.log("Creating transaction...");
      console.log("From:", selectedWallet.publicKey);
      console.log("To:", trimmedAddress);
      console.log("Amount:", amountNum);
      console.log("Network:", currentNetwork.rpcUrl);

      // Create connection to current network
      const connection = new Connection(currentNetwork.rpcUrl, "confirmed");

      // Fetch actual balance from blockchain
      const fromPubkey = new PublicKey(selectedWallet.publicKey);
      console.log("Fetching current balance from blockchain...");
      const actualBalance = await connection.getBalance(fromPubkey);
      const actualBalanceSOL = actualBalance / 1000000000; // Convert lamports to SOL
      console.log("Actual balance:", actualBalanceSOL, "SOL");

      // Check if we have enough balance (including network fee estimate)
      const estimatedFee = 0.000005; // Typical Solana fee
      const totalNeeded = amountNum + estimatedFee;

      if (totalNeeded > actualBalanceSOL) {
        setSendConfirming(false);
        setSendError(
          `Insufficient balance. You have ${actualBalanceSOL.toFixed(6)} SOL but need ${totalNeeded.toFixed(6)} SOL (including ~${estimatedFee} SOL fee)`
        );
        return;
      }

      // ============================================================================
      // LEDGER COMPATIBILITY NOTE:
      // This transaction uses Legacy format (Transaction, not VersionedTransaction)
      // to ensure compatibility with all Ledger Solana app versions.
      //
      // Ledger app requirements:
      // - Version >= 1.22.0: Supports Memo v3, AddressLookupTables, and v0 messages
      // - Version < 1.22.0: Requires Legacy transaction format (used here)
      //
      // Using Legacy format avoids "Invalid tag" errors with older Ledger firmware.
      // ============================================================================

      // Create transaction (fromPubkey already declared above for balance check)
      const toPubkey = new PublicKey(trimmedAddress);
      const lamports = Math.floor(amountNum * LAMPORTS_PER_SOL);

      // IMPORTANT: Use Legacy Transaction format for Ledger compatibility
      // Ledger Solana app versions < 1.22.0 don't support VersionedTransaction
      // Legacy format avoids "Invalid tag" errors with older Ledger firmware
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );

      // Get recent blockhash using legacy method for Ledger compatibility
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Get the wallet's data
      const selectedWalletData = wallets.find(
        (w) => w.id === selectedWallet.id
      );

      // Check if this is a Ledger wallet
      if (selectedWalletData && selectedWalletData.isLedger) {
        // Sign with Ledger
        console.log("Signing transaction with Ledger...");
        console.log("Connecting to Ledger device...");

        // Get the device ID from the wallet
        const deviceId = selectedWalletData.ledgerDeviceId;
        if (!deviceId) {
          throw new Error(
            "Ledger device ID not found. Please reconnect your Ledger."
          );
        }

        // Get or reuse BLE transport (singleton pattern)
        const transport = await getLedgerTransport(deviceId);
        const solana = new AppSolana(transport);

        // Get the derivation path for this wallet
        const derivationPath = selectedWalletData.derivationPath;
        console.log("Using derivation path:", derivationPath);

        // Sign the transaction with Ledger using legacy serialization
        // NOTE: serializeMessage() creates legacy format compatible with all Ledger app versions
        // This avoids "Invalid tag" errors with Ledger Solana app < 1.22.0
        const serializedTx = transaction.serializeMessage();
        const signature = await solana.signTransaction(
          derivationPath,
          serializedTx
        );

        console.log("Ledger signature obtained");

        // Add the signature to the transaction (legacy format)
        transaction.addSignature(fromPubkey, Buffer.from(signature.signature));

        // Keep transport alive for future transactions (singleton pattern)
        // Transport will be closed only during explicit cleanup
        console.log("Ledger transaction signed (keeping connection alive)");
      } else {
        // Sign with keypair for regular wallets
        if (!selectedWalletData || !selectedWalletData.keypair) {
          throw new Error(
            "Wallet keypair not found. Please make sure you created or imported this wallet."
          );
        }

        const keypair = selectedWalletData.keypair;

        // Sign transaction
        console.log("Signing transaction with keypair...");
        transaction.sign(keypair);
      }

      // Send transaction
      console.log("Sending transaction...");
      const signature = await connection.sendRawTransaction(
        transaction.serialize()
      );

      console.log("Transaction sent! Signature:", signature);
      setSendSignature(signature);

      // Wait for confirmation
      console.log("Waiting for confirmation...");
      await connection.confirmTransaction(signature, "confirmed");

      console.log("Transaction confirmed!");
      setSendConfirming(false);

      // Show success toast after transaction confirmation
      Toast.show({
        type: "success",
        text1: "Transaction Successful",
        text2: "Your transaction has been confirmed",
        position: "bottom",
      });

      // Refresh balance after a short delay
      setTimeout(() => {
        checkBalance(currentNetwork, false); // Force refresh without cache
      }, 2000);
    } catch (error) {
      console.error("Send transaction error:", error);
      setSendConfirming(false);
      setSendError(error.message || "Transaction failed");
    } finally {
      setPendingTransaction(null);
    }
  };

  // Confirm transaction with biometric or approve button
  const confirmTransactionWithBiometric = async () => {
    if (biometricAvailable) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirm transaction",
          fallbackLabel: "Use passcode",
          disableDeviceFallback: false,
        });

        if (result.success) {
          await executePendingTransaction();
        } else {
          // User cancelled biometric
          confirmTransactionSheetRef.current?.dismiss();
          setPendingTransaction(null);
        }
      } catch (error) {
        console.error("Biometric authentication error:", error);
        confirmTransactionSheetRef.current?.dismiss();
        setPendingTransaction(null);
      }
    } else {
      // No biometric available, just execute
      await executePendingTransaction();
    }
  };

  const handleSwap = () => {
    setShowSwapScreen(true);
    setSwapAmount("");
    setSwapEstimate(null);
    setSwapError("");
    setSwapSignature("");
  };

  // Helper to get token symbol from mint address
  const getTokenSymbol = (mintAddress) => {
    if (mintAddress === "AvNDf423kEmWNP6AZHFV7DkNG4YRgt6qbdyyryjaa4PQ") {
      return "XNM";
    } else if (
      mintAddress === "So11111111111111111111111111111111111111112" ||
      mintAddress === "XNT111111111111111111111111111111111111111"
    ) {
      return "XNT";
    }
    return "TOKEN";
  };

  // Helper to get token balance from mint address
  const getTokenBalance = (mintAddress) => {
    if (mintAddress === "AvNDf423kEmWNP6AZHFV7DkNG4YRgt6qbdyyryjaa4PQ") {
      // XNM token - find it in the tokens array
      const xnmToken = tokens.find(
        (t) => t.symbol === "XNM" || t.name === "XNM"
      );
      return xnmToken ? xnmToken.balance : "0.00";
    } else if (
      mintAddress === "So11111111111111111111111111111111111111112" ||
      mintAddress === "XNT111111111111111111111111111111111111111"
    ) {
      // XNT native token
      return balance;
    }
    return "0.00";
  };

  // Reverse swap tokens (swap input and output)
  const reverseSwapTokens = () => {
    // Swap the tokens
    const tempTokenIn = swapTokenIn;
    setSwapTokenIn(swapTokenOut);
    setSwapTokenOut(tempTokenIn);

    // Clear amount and estimate
    setSwapAmount("");
    setSwapEstimate(null);
    setSwapError("");
  };

  // Get swap estimate
  const getSwapEstimate = async (amount) => {
    if (!amount || parseFloat(amount) <= 0) {
      setSwapEstimate(null);
      return;
    }

    setSwapLoading(true);
    setSwapError("");

    try {
      // Determine network name for API
      let networkName;
      if (currentNetwork.providerId === "X1-testnet") {
        networkName = "X1 Testnet";
      } else if (currentNetwork.providerId === "X1-mainnet") {
        networkName = "X1 Mainnet";
      } else if (currentNetwork.providerId === "SOLANA-devnet") {
        networkName = "Solana Devnet";
      } else if (currentNetwork.providerId === "SOLANA-mainnet") {
        networkName = "Solana Mainnet";
      } else {
        networkName = currentNetwork.name || "X1 Testnet";
      }

      // Build query parameters for GET request
      const params = new URLSearchParams({
        network: networkName,
        token_in: swapTokenIn,
        token_out: swapTokenOut,
        token_in_amount: parseFloat(amount).toString(),
        is_exact_amount_in: "true",
      });

      console.log("Getting swap quote:", params.toString());

      const response = await fetch(
        `https://api.xdex.xyz/api/xendex/swap/quote?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get swap quote");
      }

      console.log("Swap quote:", data);
      setSwapEstimate(data);
    } catch (error) {
      console.error("Swap quote error:", error);
      setSwapError(error.message || "Failed to get swap quote");
    } finally {
      setSwapLoading(false);
    }
  };

  // Execute swap
  const executeSwap = async () => {
    if (!swapEstimate) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "No swap estimate available",
        position: "bottom",
      });
      return;
    }

    setSwapConfirming(true);
    setSwapError("");

    try {
      // Get the selected wallet's keypair
      const selectedWalletData = wallets.find(
        (w) => w.publicKey === selectedWallet.publicKey
      );

      if (!selectedWalletData || !selectedWalletData.keypair) {
        throw new Error("Wallet keypair not found");
      }

      const keypair = selectedWalletData.keypair;

      // Create connection
      const connection = new Connection(currentNetwork.rpcUrl, "confirmed");

      // Determine network name for API
      let networkName;
      if (currentNetwork.providerId === "X1-testnet") {
        networkName = "X1 Testnet";
      } else if (currentNetwork.providerId === "X1-mainnet") {
        networkName = "X1 Mainnet";
      } else if (currentNetwork.providerId === "SOLANA-devnet") {
        networkName = "Solana Devnet";
      } else if (currentNetwork.providerId === "SOLANA-mainnet") {
        networkName = "Solana Mainnet";
      } else {
        networkName = currentNetwork.name || "X1 Testnet";
      }

      // Fetch transaction from /prepare endpoint
      const preparePayload = {
        network: networkName,
        wallet: selectedWallet.publicKey,
        token_in: swapTokenIn,
        token_out: swapTokenOut,
        token_in_amount: parseFloat(swapAmount),
        is_exact_amount_in: true,
      };

      console.log("Fetching swap transaction:", preparePayload);

      const prepareResponse = await fetch(
        "https://api.xdex.xyz/api/xendex/swap/prepare",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(preparePayload),
        }
      );

      const prepareData = await prepareResponse.json();

      if (!prepareResponse.ok) {
        throw new Error(
          prepareData.error || "Failed to prepare swap transaction"
        );
      }

      // Get transaction from response
      const transactionData =
        prepareData.data?.transaction || prepareData.transaction;
      if (!transactionData) {
        throw new Error("No transaction data in prepare response");
      }

      // Deserialize the transaction (handle both versioned and legacy)
      const transactionBuffer = Buffer.from(transactionData, "base64");

      let transaction;
      try {
        // Try versioned transaction first (v0 transactions)
        transaction = VersionedTransaction.deserialize(transactionBuffer);
        console.log("Deserialized as VersionedTransaction");

        // Sign the versioned transaction
        transaction.sign([keypair]);
      } catch (versionedError) {
        console.log("Not a versioned transaction, trying legacy format...");
        // Fall back to legacy transaction
        transaction = Transaction.from(transactionBuffer);
        console.log("Deserialized as legacy Transaction");

        // Get recent blockhash for legacy transaction
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = keypair.publicKey;

        // Sign legacy transaction
        transaction.sign(keypair);
      }

      // Send transaction
      const signature = await connection.sendRawTransaction(
        transaction.serialize()
      );

      console.log("Swap transaction sent! Signature:", signature);
      setSwapSignature(signature);

      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      console.log("Swap transaction confirmed!");
      setSwapConfirming(false);

      // Close swap screen and refresh balance after showing success message
      setTimeout(() => {
        setShowSwapScreen(false);
        checkBalance(currentNetwork, false);
      }, 1500);
    } catch (error) {
      console.error("Swap execution error:", error);
      setSwapConfirming(false);
      setSwapError(error.message || "Swap failed");
    }
  };

  const handleStake = () => {
    Toast.show({
      type: "info",
      text1: "Stake",
      text2: "Stake functionality would open here",
      position: "bottom",
    });
  };

  const handleBridge = () => {
    Toast.show({
      type: "info",
      text1: "Bridge",
      text2: "Bridge functionality would open here",
      position: "bottom",
    });
  };

  const copyAddress = () => {
    Clipboard.setString(selectedWallet.publicKey);
  };

  // Browser WebView message handler
  const handleWebViewMessage = async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      // Handle console messages from WebView
      if (message.type === "console") {
        const prefix =
          message.level === "error"
            ? "❌"
            : message.level === "warn"
              ? "⚠️"
              : "📝";
        console.log(`${prefix} [WebView ${message.level}] ${message.message}`);
        return;
      }

      console.log("WebView message received:", message);

      const { id, method, params } = message;

      let result;
      let error;

      try {
        switch (method) {
          case "connect":
            // Return the wallet's public key
            if (!selectedWallet) {
              throw new Error("No wallet selected");
            }

            // Debug: Check wallet capabilities
            const walletInfo = wallets.find((w) => w.id === selectedWallet.id);
            console.log("Selected wallet info:", {
              id: walletInfo?.id,
              name: walletInfo?.name,
              publicKey: walletInfo?.publicKey,
              isLedger: walletInfo?.isLedger,
              hasKeypair: !!walletInfo?.keypair,
            });

            result = {
              publicKey: selectedWallet.publicKey,
            };
            break;

          case "signAndSendTransaction":
            if (!selectedWallet) {
              throw new Error("No wallet selected");
            }

            // Get transaction from params
            const { transaction: txData, options } = params;

            // Create connection to X1 network
            const x1Connection = new Connection("https://rpc.mainnet.x1.xyz");

            // Deserialize the transaction
            const txBuffer = Buffer.from(txData, "base64");
            const transaction = Transaction.from(txBuffer);

            // Get the wallet's data
            const selectedWalletData = wallets.find(
              (w) => w.id === selectedWallet.id
            );

            // Get the from public key
            const fromPubkey = new PublicKey(selectedWallet.publicKey);

            // Sign the transaction
            if (selectedWalletData && selectedWalletData.isLedger) {
              // Sign with Ledger
              console.log("Signing transaction with Ledger...");

              const deviceId = selectedWalletData.ledgerDeviceId;
              if (!deviceId) {
                throw new Error(
                  "Ledger device ID not found. Please reconnect your Ledger."
                );
              }

              try {
                // Get or reuse BLE transport (singleton pattern)
                const transport = await getLedgerTransport(deviceId);
                const solana = new AppSolana(transport);

                // Get the derivation path for this wallet
                const derivationPath = selectedWalletData.derivationPath;
                console.log("Using derivation path:", derivationPath);

                // Sign the transaction with Ledger
                const serializedTx = transaction.serializeMessage();
                const signature = await solana.signTransaction(
                  derivationPath,
                  serializedTx
                );

                console.log("Ledger signature obtained");

                // Add the signature to the transaction
                transaction.addSignature(
                  fromPubkey,
                  Buffer.from(signature.signature)
                );

                // Keep transport alive for future transactions (singleton pattern)
                // Transport will be closed only during explicit cleanup
                console.log(
                  "Ledger swap transaction signed (keeping connection alive)"
                );
              } catch (ledgerError) {
                console.error("Ledger transaction signing error:", ledgerError);

                // Provide specific error messages for common Ledger errors
                let errorMessage = "Ledger transaction signing failed: ";

                // Check for specific error codes
                if (
                  ledgerError.message &&
                  ledgerError.message.includes("0x6a81")
                ) {
                  errorMessage +=
                    "Please make sure:\n1. Your Ledger is unlocked\n2. The Solana app is open (not any other app)\n3. 'Blind signing' is enabled in Solana app settings";
                } else if (
                  ledgerError.message &&
                  ledgerError.message.includes("0x6a80")
                ) {
                  errorMessage += "Invalid transaction data. Please try again.";
                } else if (
                  ledgerError.message &&
                  (ledgerError.message.includes("0x6b0c") ||
                    ledgerError.message.includes("0x5515"))
                ) {
                  errorMessage +=
                    "Ledger is locked or Solana app is not ready. Please unlock your device and open the Solana app.";
                } else if (
                  ledgerError.message &&
                  (ledgerError.message.includes("Invalid tag") ||
                    ledgerError.message.includes("TransportError"))
                ) {
                  errorMessage +=
                    "Communication error (Invalid Tag). Please update your Ledger firmware and Solana app, or try a different cable/connection.";
                } else if (ledgerError.message) {
                  errorMessage += ledgerError.message;
                } else {
                  throw new Error(errorMessage);
                }
              }
            } else {
              // Sign with keypair for regular wallets
              if (!selectedWalletData || !selectedWalletData.keypair) {
                throw new Error(
                  "Wallet keypair not found. Please make sure you created or imported this wallet."
                );
              }

              const keypair = selectedWalletData.keypair;
              console.log("Signing transaction with keypair...");
              transaction.sign(keypair);
            }

            // Send transaction
            console.log("Sending transaction to X1 network...");
            const txSignature = await x1Connection.sendRawTransaction(
              transaction.serialize()
            );

            console.log("Transaction sent! Signature:", txSignature);

            // Return the signature
            result = {
              signature: txSignature,
            };
            break;

          case "signMessage":
            if (!selectedWallet) {
              throw new Error("No wallet selected");
            }

            const { encodedMessage } = params;
            const messageBuffer = Buffer.from(encodedMessage, "base64");

            // Get the wallet's data for signing
            const walletData = wallets.find((w) => w.id === selectedWallet.id);

            if (walletData && walletData.isLedger) {
              // For Ledger: Use transaction hash approach
              // We create a dummy transaction with the message hash and sign it
              console.log(
                "Signing message with Ledger using transaction approach..."
              );

              const deviceId = walletData.ledgerDeviceId;
              if (!deviceId) {
                throw new Error(
                  "Ledger device not found. Please connect your Ledger via Bluetooth."
                );
              }

              try {
                // Connect to Ledger via BLE first
                console.log("Connecting to Ledger...");
                const transport = await TransportBLE.open(deviceId);
                const solana = new AppSolana(transport);

                // Get the derivation path
                const derivationPath = walletData.derivationPath;
                console.log("Using derivation path:", derivationPath);

                // Get the public key from Ledger to verify connection
                // CRITICAL: This initializes the Ledger app state
                console.log("Getting public key from Ledger...");
                const ledgerPubKey = await solana.getAddress(derivationPath);
                console.log("Ledger public key:", ledgerPubKey.address);

                // NOTE: signOffchainMessage() is not supported over BLE
                // The extension uses it over USB (TransportWebHid), but
                // BLE (TransportBLE) doesn't support this API.
                // We use a transaction-based approach instead.

                // Create a connection to X1 network
                const x1Connection = new Connection(
                  "https://rpc.mainnet.x1.xyz"
                );

                // Get the public key
                const publicKey = new PublicKey(selectedWallet.publicKey);

                // Get recent blockhash
                console.log("Fetching blockhash...");
                const { blockhash } =
                  await x1Connection.getLatestBlockhash("finalized");

                // Create a simple transfer transaction (0 lamports to self)
                // This is completely free and never sent to the blockchain
                const dummyTx = new Transaction({
                  recentBlockhash: blockhash,
                  feePayer: publicKey,
                });

                // Add a 0-lamport transfer
                dummyTx.add(
                  SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: publicKey,
                    lamports: 0,
                  })
                );

                console.log("Created transaction, serializing...");

                // Sign the transaction with Ledger
                const serializedTx = dummyTx.serializeMessage();
                console.log("Serialized tx length:", serializedTx.length);
                console.log("Calling signTransaction...");

                const ledgerSignature = await solana.signTransaction(
                  derivationPath,
                  serializedTx
                );

                console.log("Ledger signature obtained:", ledgerSignature);

                // Disconnect from Ledger
                await transport.close();
                console.log("Ledger disconnected");

                // Return the signature (transaction is NEVER sent to network)
                result = {
                  signature: Buffer.from(ledgerSignature.signature).toString(
                    "base64"
                  ),
                };
              } catch (ledgerError) {
                console.error("Ledger signing error:", ledgerError);

                // Provide specific error messages for common Ledger errors
                let errorMessage = "Ledger message signing failed: ";

                // Check for specific error codes
                if (
                  ledgerError.message &&
                  ledgerError.message.includes("0x6a81")
                ) {
                  errorMessage +=
                    "Please make sure:\n1. Your Ledger is unlocked\n2. The Solana app is open\n3. 'Blind signing' is enabled in Solana app settings";
                } else if (
                  ledgerError.message &&
                  ledgerError.message.includes("0x6a80")
                ) {
                  errorMessage +=
                    "Invalid data sent to Ledger. Please try again.";
                } else if (
                  ledgerError.message &&
                  ledgerError.message.includes("0x6985")
                ) {
                  errorMessage +=
                    "Message signing rejected by user on Ledger device.";
                } else if (
                  ledgerError.message &&
                  ledgerError.message.includes("0x6b0c")
                ) {
                  errorMessage +=
                    "Ledger is locked. Please unlock your device and try again.";
                } else if (
                  ledgerError.message &&
                  ledgerError.message.includes("BleError")
                ) {
                  errorMessage +=
                    "Bluetooth connection failed. Please ensure Ledger is connected via Bluetooth.";
                } else {
                  errorMessage +=
                    ledgerError.message ||
                    "Device not connected or operation cancelled.";
                }

                throw new Error(errorMessage);
              }
            } else {
              // Sign with keypair for regular wallets
              if (!walletData || !walletData.keypair) {
                throw new Error(
                  "Wallet keypair not found. Please make sure you created or imported this wallet."
                );
              }

              const keypair = walletData.keypair;

              // Use nacl to sign the message with the secret key
              // Solana Keypair.sign() is for transactions, not arbitrary messages
              const nacl = require("tweetnacl");
              const signature = nacl.sign.detached(
                messageBuffer,
                keypair.secretKey
              );

              result = {
                signature: Buffer.from(signature).toString("base64"),
              };
            }
            break;

          case "signTransaction":
            // Sign a transaction without sending (for multi-sig flows like session wallet)
            if (!selectedWallet) {
              throw new Error("No wallet selected");
            }

            const { transaction: signTxData } = params;

            // Deserialize the transaction
            const signTxBuffer = Buffer.from(signTxData, "base64");
            const transactionToSign = Transaction.from(signTxBuffer);

            // Get the wallet's data
            const signWalletData = wallets.find(
              (w) => w.id === selectedWallet.id
            );

            // Get the from public key
            const signFromPubkey = new PublicKey(selectedWallet.publicKey);

            // Sign the transaction
            if (signWalletData && signWalletData.isLedger) {
              // Sign with Ledger
              console.log("Signing transaction with Ledger (no send)...");

              // Prevent concurrent BLE operations
              if (ledgerOperationInProgressRef.current) {
                console.log(
                  "Ledger operation already in progress, skipping duplicate request"
                );
                throw new Error(
                  "Ledger operation in progress. Please wait and try again."
                );
              }

              const signDeviceId = signWalletData.ledgerDeviceId;
              if (!signDeviceId) {
                throw new Error(
                  "Ledger device ID not found. Please reconnect your Ledger."
                );
              }

              try {
                // Set mutex to prevent concurrent operations
                ledgerOperationInProgressRef.current = true;

                // Get or reuse BLE transport (singleton pattern)
                const signTransport = await getLedgerTransport(signDeviceId);
                const signSolana = new AppSolana(signTransport);

                // Get the derivation path for this wallet
                const signDerivationPath = signWalletData.derivationPath;
                console.log("Using derivation path:", signDerivationPath);

                // Sign the transaction with Ledger
                const signSerializedTx = transactionToSign.serializeMessage();
                const signLedgerSig = await signSolana.signTransaction(
                  signDerivationPath,
                  signSerializedTx
                );

                console.log("Ledger signature obtained (signTransaction)");

                // Add the signature to the transaction
                transactionToSign.addSignature(
                  signFromPubkey,
                  Buffer.from(signLedgerSig.signature)
                );

                console.log(
                  "Transaction signed with Ledger (keeping connection alive)"
                );
              } catch (ledgerError) {
                console.error("Ledger signTransaction error:", ledgerError);
                // Clear the stale transport reference so next attempt will reconnect
                if (
                  ledgerError.name === "DisconnectedDevice" ||
                  ledgerError.message?.includes("DisconnectedDevice")
                ) {
                  ledgerTransportRef.current = null;
                  throw new Error(
                    "Ledger disconnected. Please unlock your Ledger, open the Solana app, and try again."
                  );
                }
                throw new Error(
                  "Ledger transaction signing failed: " +
                    (ledgerError.message || "Unknown error")
                );
              } finally {
                // Always release the mutex
                ledgerOperationInProgressRef.current = false;
              }
            } else {
              // Sign with keypair for regular wallets
              if (!signWalletData || !signWalletData.keypair) {
                throw new Error(
                  "Wallet keypair not found. Please make sure you created or imported this wallet."
                );
              }

              const signKeypair = signWalletData.keypair;
              console.log("Signing transaction with keypair (no send)...");
              // Use partialSign to preserve any existing signatures (e.g., from session wallet)
              transactionToSign.partialSign(signKeypair);
            }

            // Return the signed transaction as base64
            // Use requireAllSignatures: false in case this is a multi-sig flow
            result = {
              signedTransaction: transactionToSign
                .serialize({
                  requireAllSignatures: false,
                  verifySignatures: false,
                })
                .toString("base64"),
            };
            break;

          case "testSignMemo":
            // Test function: Sign using memo transaction approach (free, doesn't send to network)
            if (!selectedWallet) {
              throw new Error("No wallet selected");
            }

            const { encodedMessage: testMessage } = params;
            const testMessageBuffer = Buffer.from(testMessage, "base64");

            console.log(
              "[testSignMemo] Starting test, message length:",
              testMessageBuffer.length
            );

            // Get the wallet's data
            const testWalletData = wallets.find(
              (w) => w.id === selectedWallet.id
            );

            if (testWalletData && testWalletData.isLedger) {
              console.log("[testSignMemo] Using Ledger wallet");

              // Create a connection to X1 network
              const x1Conn = new Connection("https://rpc.mainnet.x1.xyz");

              // Get the public key
              const pubKey = new PublicKey(selectedWallet.publicKey);

              // Get recent blockhash
              console.log("[testSignMemo] Fetching blockhash...");
              const { blockhash: memoBlockhash } =
                await x1Conn.getLatestBlockhash("finalized");

              // Create a transaction with memo instruction containing the message
              // Note: We add a 0-lamport transfer to make Ledger accept it as a valid transaction
              const testMemoTx = new Transaction({
                recentBlockhash: memoBlockhash,
                feePayer: pubKey,
              });

              // Add a 0-lamport transfer to yourself (makes Ledger happy)
              testMemoTx.add(
                SystemProgram.transfer({
                  fromPubkey: pubKey,
                  toPubkey: pubKey,
                  lamports: 0,
                })
              );

              // Add memo instruction with the message
              const MEMO_PROG_ID = new PublicKey(
                "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
              );

              const testMemoInstruction = new TransactionInstruction({
                keys: [],
                programId: MEMO_PROG_ID,
                data: testMessageBuffer,
              });

              testMemoTx.add(testMemoInstruction);

              console.log(
                "[testSignMemo] Created memo transaction, connecting to Ledger..."
              );

              // Connect to Ledger via BLE
              const testTransport = await TransportBLE.open(
                testWalletData.ledgerDeviceId
              );
              const testSolana = new AppSolana(testTransport);

              // Get the derivation path
              const testDerivPath = testWalletData.derivationPath;
              console.log(
                "[testSignMemo] Using derivation path:",
                testDerivPath
              );

              // Sign the transaction with Ledger
              const testSerializedTx = testMemoTx.serializeMessage();
              console.log("[testSignMemo] Signing with Ledger...");
              const testLedgerSig = await testSolana.signTransaction(
                testDerivPath,
                testSerializedTx
              );

              console.log("[testSignMemo] Signature obtained!");

              // Disconnect from Ledger
              await testTransport.close();

              // Return detailed result for testing
              result = {
                success: true,
                signature: Buffer.from(testLedgerSig.signature).toString(
                  "base64"
                ),
                method: "memo_transaction",
                messageLength: testMessageBuffer.length,
                transactionSize: testSerializedTx.length,
                note: "This signature was created by signing a memo transaction (NOT sent to network, completely free)",
              };
            } else {
              // For non-Ledger wallets, use regular signing
              console.log("[testSignMemo] Using regular wallet");

              if (!testWalletData || !testWalletData.keypair) {
                throw new Error("Wallet keypair not found");
              }

              const nacl = require("tweetnacl");
              const testSig = nacl.sign.detached(
                testMessageBuffer,
                testWalletData.keypair.secretKey
              );

              result = {
                success: true,
                signature: Buffer.from(testSig).toString("base64"),
                method: "nacl_sign",
                messageLength: testMessageBuffer.length,
                note: "Regular wallet signature using nacl",
              };
            }
            break;

          default:
            throw new Error(`Unknown method: ${method}`);
        }
      } catch (err) {
        console.error("Error processing WebView message:", err);
        error = err.message || "Unknown error";
      }

      // Send response back to WebView
      const responseObj = { id, result, error };
      console.log("Sending response to WebView:", responseObj);
      const response = JSON.stringify(responseObj);
      const jsCode = `
        window.postMessage(${response}, '*');
        true;
      `;
      console.log("Injecting JavaScript:", jsCode);
      webViewRef.current?.injectJavaScript(jsCode);
    } catch (err) {
      console.error("Error parsing WebView message:", err);
    }
  };

  // Wallet management functions
  const handleAddWallet = () => {
    setShowAddWalletModal(true);
  };

  const handleCreateNewWallet = async () => {
    setShowAddWalletModal(false);

    // Check if master seed phrase exists
    if (!masterSeedPhrase) {
      // No master seed phrase - generate one and show it to user
      console.log(
        "No master seed phrase found, generating new one for initial setup"
      );
      const newSeed = bip39.generateMnemonic();
      setNewMnemonic(newSeed);
      setIsInitialSetup(true);
      setShowCreateWalletModal(true);
      return;
    }

    // Master seed phrase exists - directly create wallet without showing seed phrase modal
    console.log("Creating new wallet from master seed phrase");

    try {
      const seed = await bip39.mnemonicToSeed(masterSeedPhrase);

      // Derive wallet using BIP44 path: m/44'/501'/<index>'/0'
      const path = `m/44'/501'/${walletDerivationIndex}'/0'`;
      console.log(`Deriving wallet at path: ${path}`);

      const hdkey = slip10.fromMasterSeed(seed);
      const derivedKey = hdkey.derive(path);
      const keypair = Keypair.fromSeed(derivedKey.privateKey);

      // Check for duplicate wallet
      const publicKeyStr = keypair.publicKey.toString();
      const isDuplicate = wallets.some((w) => w.publicKey === publicKeyStr);

      if (isDuplicate) {
        Toast.show({
          type: "error",
          text1: "Duplicate Wallet",
          text2: "This wallet has already been added.",
          position: "bottom",
        });
        return;
      }

      const newWallet = {
        id: String(wallets.length + 1),
        name: `Wallet ${wallets.length + 1}`,
        address: publicKeyStr,
        publicKey: publicKeyStr,
        selected: false,
        secretKey: Array.from(keypair.secretKey), // Store as array for JSON serialization
        keypair: keypair, // Keep in memory for immediate use
        derivationPath: path,
        hideZeroBalanceTokens: false,
      };

      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);
      await saveWalletsToStorage(updatedWallets);

      // Increment derivation index for next wallet
      const nextIndex = walletDerivationIndex + 1;
      setWalletDerivationIndex(nextIndex);
      await saveDerivationIndex(nextIndex);

      Toast.show({
        type: "success",
        text1: "Wallet Created",
        text2: `${newWallet.name} has been added`,
        position: "bottom",
      });

      // Register the wallet with the transaction indexer
      await registerWalletWithIndexer(publicKeyStr, currentNetwork.providerId);
    } catch (error) {
      console.error("Error creating wallet:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to create wallet: " + error.message,
        position: "bottom",
      });
    }
  };

  const handleShowImportWallet = () => {
    setShowAddWalletModal(false);
    setImportType("privateKey");
    setImportMnemonic("");
    setImportPrivateKey("");
    setImportDerivationIndex("0");
    setPhraseWords(Array(12).fill(""));
    setPhraseDisclaimerAccepted(false);
    setUse24Words(false);
    setShowImportWalletModal(true);
  };

  const copySeedPhrase = () => {
    Clipboard.setString(newMnemonic);
    if (Platform.OS === "android") {
      ToastAndroid.show("Copied to clipboard", ToastAndroid.SHORT);
    } else {
      console.log("Copied to clipboard");
    }
  };

  const copyGeneratedSeedPhrase = () => {
    Clipboard.setString(generatedNewSeed);
    if (Platform.OS === "android") {
      ToastAndroid.show("Copied to clipboard", ToastAndroid.SHORT);
    } else {
      console.log("Copied to clipboard");
    }
  };

  const handleImportWallet = async () => {
    try {
      // Only support private key import (seed phrase import removed)
      if (!importPrivateKey || !importPrivateKey.trim()) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Please enter a private key",
          position: "bottom",
        });
        return;
      }

      let keypair;
      const trimmedKey = importPrivateKey.trim();

      try {
        // Try bs58 format first
        const decoded = bs58.decode(trimmedKey);
        keypair = Keypair.fromSecretKey(decoded);
      } catch {
        // If bs58 fails, try JSON array format
        try {
          const privateKeyArray = JSON.parse(trimmedKey);
          keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
        } catch {
          Toast.show({
            type: "error",
            text1: "Error",
            text2: "Invalid private key format. Use bs58 or JSON array format.",
            position: "bottom",
          });
          return;
        }
      }

      // Check for duplicate wallet
      const publicKeyStr = keypair.publicKey.toString();
      const isDuplicate = wallets.some((w) => w.publicKey === publicKeyStr);

      if (isDuplicate) {
        Toast.show({
          type: "error",
          text1: "Duplicate Wallet",
          text2: "This wallet has already been added.",
          position: "bottom",
        });
        return;
      }

      const newWallet = {
        id: String(wallets.length + 1),
        name: `Wallet ${wallets.length + 1}`,
        address: publicKeyStr,
        publicKey: publicKeyStr,
        selected: false,
        secretKey: Array.from(keypair.secretKey), // Store as array for JSON serialization
        keypair: keypair, // Keep in memory for immediate use
        derivationPath: null, // No derivation path for imported private keys
        hideZeroBalanceTokens: false, // User preference for hiding zero balance tokens
      };

      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);
      await saveWalletsToStorage(updatedWallets);

      // Clear import form
      setImportPrivateKey("");
      setShowImportWalletModal(false);

      // Register the wallet with the transaction indexer
      await registerWalletWithIndexer(publicKeyStr, currentNetwork.providerId);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to import wallet: " + error.message,
        position: "bottom",
      });
    }
  };

  const handleConfirmCreateWallet = async () => {
    try {
      let seedPhraseToUse = masterSeedPhrase;

      // If this is initial setup, save the master seed phrase first
      if (isInitialSetup) {
        if (!newMnemonic || !newMnemonic.trim()) {
          Toast.show({
            type: "error",
            text1: "Error",
            text2: "Seed phrase not generated",
            position: "bottom",
          });
          return;
        }

        // Validate the seed phrase
        if (!bip39.validateMnemonic(newMnemonic)) {
          Toast.show({
            type: "error",
            text1: "Error",
            text2: "Invalid seed phrase",
            position: "bottom",
          });
          return;
        }

        // Save the master seed phrase
        seedPhraseToUse = newMnemonic;
        setMasterSeedPhrase(seedPhraseToUse);
        await saveMasterSeedPhrase(seedPhraseToUse);

        // Reset derivation index to 0 for new seed phrase
        setWalletDerivationIndex(0);
        await saveDerivationIndex(0);

        console.log("Master seed phrase saved successfully");
        setIsInitialSetup(false);
      }

      // Ensure we have a seed phrase to use
      if (!seedPhraseToUse) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Master seed phrase not found",
          position: "bottom",
        });
        return;
      }

      const seed = await bip39.mnemonicToSeed(seedPhraseToUse);

      // Derive wallet using BIP44 path: m/44'/501'/<index>'/0'
      const path = `m/44'/501'/${walletDerivationIndex}'/0'`;
      console.log(`Deriving wallet at path: ${path}`);

      const hdkey = slip10.fromMasterSeed(seed);
      const derivedKey = hdkey.derive(path);
      const keypair = Keypair.fromSeed(derivedKey.privateKey);

      // Check for duplicate wallet
      const publicKeyStr = keypair.publicKey.toString();
      const isDuplicate = wallets.some((w) => w.publicKey === publicKeyStr);

      if (isDuplicate) {
        Toast.show({
          type: "error",
          text1: "Duplicate Wallet",
          text2: "This wallet has already been added.",
          position: "bottom",
        });
        return;
      }

      const newWallet = {
        id: String(wallets.length + 1),
        name: `Wallet ${wallets.length + 1}`,
        address: publicKeyStr,
        publicKey: publicKeyStr,
        selected: false,
        secretKey: Array.from(keypair.secretKey), // Store as array for JSON serialization
        keypair: keypair, // Keep in memory for immediate use
        derivationPath: path, // Store the derivation path used
        hideZeroBalanceTokens: false, // User preference for hiding zero balance tokens
      };

      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);
      await saveWalletsToStorage(updatedWallets);

      // Increment and save derivation index for next wallet
      const nextIndex = walletDerivationIndex + 1;
      setWalletDerivationIndex(nextIndex);
      await saveDerivationIndex(nextIndex);
      console.log(`Wallet created at ${path}, next index: ${nextIndex}`);

      const wasInitialSetup = isInitialSetup;
      setNewMnemonic("");
      setIsInitialSetup(false);
      setShowCreateWalletModal(false);

      Toast.show({
        type: "success",
        text1: wasInitialSetup ? "Setup Complete" : "Wallet Created",
        text2: wasInitialSetup
          ? "Master seed phrase saved and wallet created"
          : `${newWallet.name} has been added`,
        position: "bottom",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to create wallet: " + error.message,
        position: "bottom",
      });
      console.error("Wallet creation error:", error);
    }
  };

  const handleCopyMasterSeedPhrase = () => {
    if (masterSeedPhrase) {
      Clipboard.setString(masterSeedPhrase);
      ToastAndroid.show(
        "Master seed phrase copied to clipboard",
        ToastAndroid.SHORT
      );
    }
  };

  const handleGenerateNewSeedPhrase = () => {
    const newSeed = bip39.generateMnemonic();
    setGeneratedNewSeed(newSeed);
    setChangeSeedPhraseMode("generate");
    if (Platform.OS === "android") {
      ToastAndroid.show("New seed phrase generated", ToastAndroid.SHORT);
    } else {
      console.log("New seed phrase generated");
    }
  };

  const handleConfirmChangeSeedPhrase = async () => {
    let seedToUse = "";

    // Determine which seed phrase to use based on mode
    if (changeSeedPhraseMode === "enter") {
      // Validate entered seed phrase
      if (!newSeedPhraseInput.trim()) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Please enter a seed phrase",
          position: "bottom",
        });
        return;
      }

      if (!bip39.validateMnemonic(newSeedPhraseInput.trim())) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Invalid seed phrase. Please check and try again.",
          position: "bottom",
        });
        return;
      }
      seedToUse = newSeedPhraseInput.trim();
    } else {
      // Use generated seed phrase
      if (!generatedNewSeed) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Please generate a seed phrase first",
          position: "bottom",
        });
        return;
      }
      seedToUse = generatedNewSeed;
    }

    // Change seed phrase (affects newly created wallets only)
    try {
      setMasterSeedPhrase(seedToUse);
      await saveMasterSeedPhrase(seedToUse);

      // Reset derivation index to 0 for new seed phrase
      setWalletDerivationIndex(0);
      await saveDerivationIndex(0);

      console.log("Master seed phrase changed successfully");
      Toast.show({
        type: "success",
        text1: "Seed Phrase Changed",
        text2: "New wallets will use the updated seed phrase",
        position: "bottom",
      });

      // Reset modal state
      setNewSeedPhraseInput("");
      setGeneratedNewSeed("");
      setChangeSeedPhraseMode("enter");
      closeAllSettings();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to change seed phrase: " + error.message,
        position: "bottom",
      });
      console.error("Change seed phrase error:", error);
    }
  };

  const requestBluetoothPermissions = async () => {
    if (Platform.OS === "android" && Platform.Version >= 31) {
      try {
        console.log("Requesting Bluetooth permissions for Android 12+...");
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);

        console.log("Permission results:", granted);
        const allGranted =
          granted["android.permission.BLUETOOTH_SCAN"] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted["android.permission.BLUETOOTH_CONNECT"] ===
            PermissionsAndroid.RESULTS.GRANTED;

        console.log("All permissions granted:", allGranted);
        return allGranted;
      } catch (err) {
        console.error("Error requesting permissions:", err);
        return false;
      }
    }
    return true;
  };

  const handleShowLedger = async () => {
    console.log("==============================================");
    console.log("🔵 CONNECT LEDGER FLOW STARTED");
    console.log("==============================================");

    setShowAddWalletModal(false);
    console.log("✓ Add wallet modal closed");

    // Request Bluetooth permissions
    console.log("");
    console.log("📋 Step 1: Requesting Bluetooth permissions...");
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      console.log("❌ Bluetooth permissions denied");
      Toast.show({
        type: "error",
        text1: "Permissions Required",
        text2: "Bluetooth permissions are required to connect to Ledger.",
        position: "bottom",
      });
      setShowAddWalletModal(true);
      return;
    }
    console.log("✅ Bluetooth permissions granted");
    console.log("");

    // Always show sheet and scan to allow selection
    console.log("🔵 Step 2: Opening Ledger connection sheet...");
    ledgerSheetRef.current?.present();
    console.log("✓ Ledger sheet opened");

    console.log("");
    console.log("🔍 Step 3: Starting BLE scan for Ledger devices...");
    scanForLedger();
    console.log("==============================================");
  };

  // Check BLE Status - Comprehensive diagnostic report
  const checkBLEStatus = async () => {
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 BLUETOOTH STATUS REPORT");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    try {
      // Initialize BLE Manager if not already done
      if (!bleManagerRef.current) {
        bleManagerRef.current = new BleManager();
        console.log("  ℹ️  BLE Manager initialized for status check");
      }

      const manager = bleManagerRef.current;

      // 1. Bluetooth Adapter State
      console.log("1️⃣  BLUETOOTH ADAPTER STATE:");
      const state = await manager.state();
      console.log(`   State: ${state}`);
      console.log(
        `   ${state === "PoweredOn" ? "✅" : "❌"} Adapter is ${state === "PoweredOn" ? "POWERED ON" : "NOT powered on"}`
      );
      console.log("");

      // 2. App Bluetooth Permissions
      console.log("2️⃣  BLUETOOTH PERMISSIONS:");
      try {
        const scanGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
        const connectGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        console.log(
          `   BLUETOOTH_SCAN: ${scanGranted ? "✅ GRANTED" : "❌ DENIED"}`
        );
        console.log(
          `   BLUETOOTH_CONNECT: ${connectGranted ? "✅ GRANTED" : "❌ DENIED"}`
        );
      } catch (permErr) {
        console.log(`   ⚠️  Could not check permissions: ${permErr.message}`);
      }
      console.log("");

      // 3. Connected Devices
      console.log("3️⃣  CONNECTED DEVICES:");
      try {
        const connectedDevices = await manager.connectedDevices([]);
        if (connectedDevices.length > 0) {
          console.log(
            `   Found ${connectedDevices.length} connected device(s):`
          );
          connectedDevices.forEach((device, index) => {
            console.log(`   ${index + 1}. ${device.name || "Unknown"}`);
            console.log(`      ID: ${device.id}`);
            console.log(`      RSSI: ${device.rssi || "N/A"}`);
          });
        } else {
          console.log("   ℹ️  No devices currently connected");
        }
      } catch (devErr) {
        console.log(
          `   ⚠️  Could not get connected devices: ${devErr.message}`
        );
      }
      console.log("");

      // 4. App BLE State
      console.log("4️⃣  APP BLE STATE:");
      console.log(
        `   Transport Ref: ${ledgerTransportRef.current ? "✅ EXISTS" : "❌ NULL"}`
      );
      if (ledgerTransportRef.current) {
        try {
          console.log(
            `   Transport Device: ${ledgerTransportRef.current.device?.name || "Unknown"}`
          );
          console.log(
            `   Transport ID: ${ledgerTransportRef.current.device?.id || "Unknown"}`
          );
        } catch (e) {
          console.log("   Transport exists but error reading details");
        }
      }
      console.log(
        `   Scan Subscription: ${ledgerScanSubscriptionRef.current ? "✅ ACTIVE" : "❌ INACTIVE"}`
      );
      console.log(
        `   Scanning Flag: ${ledgerScanning ? "✅ TRUE" : "❌ FALSE"}`
      );
      console.log(
        `   Connecting Flag: ${ledgerConnecting ? "✅ TRUE" : "❌ FALSE"}`
      );
      console.log(
        `   Cleanup In Progress: ${ledgerCleaningRef.current ? "✅ TRUE" : "❌ FALSE"}`
      );
      console.log(
        `   Cleanup Completed: ${ledgerCleanedUpRef.current ? "✅ TRUE" : "❌ FALSE"}`
      );
      console.log("");

      // 5. Stored Ledger Info
      console.log("5️⃣  STORED LEDGER INFO:");
      if (ledgerDeviceInfo) {
        console.log(`   Device Name: ${ledgerDeviceInfo.name || "N/A"}`);
        console.log(`   Device ID: ${ledgerDeviceInfo.id || "N/A"}`);
      } else {
        console.log("   ℹ️  No stored device info");
      }
      if (ledgerDeviceId) {
        console.log(`   Stored Device ID: ${ledgerDeviceId}`);
      } else {
        console.log("   ℹ️  No stored device ID");
      }
      console.log(`   Connection Type: ${ledgerConnectionType || "N/A"}`);
      console.log(`   Discovered Accounts: ${ledgerAccounts.length}`);
      console.log("");

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ STATUS REPORT COMPLETE");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");

      Toast.show({
        type: "success",
        text1: "BLE Status Report",
        text2: `Adapter: ${state} | Devices: ${(await manager.connectedDevices([])).length}`,
        position: "bottom",
      });
    } catch (error) {
      console.error("❌ Error generating BLE status report:", error);
      console.error("  Error message:", error.message);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      Toast.show({
        type: "error",
        text1: "Status Check Failed",
        text2: error.message || "Could not generate BLE status report",
        position: "bottom",
      });
    }
  };

  // Proper BLE cleanup function following best practices
  const cleanupLedgerBLE = async () => {
    // Prevent double cleanup - check if already cleaned up OR currently cleaning
    if (ledgerCleanedUpRef.current) {
      console.log("⚠ Cleanup already completed, skipping to prevent crash...");
      return;
    }

    if (ledgerCleaningRef.current) {
      console.log("⚠ Cleanup already in progress, skipping...");
      return;
    }

    ledgerCleaningRef.current = true;
    console.log("Starting Ledger BLE cleanup...");

    try {
      // 1. Unsubscribe from scan first
      if (ledgerScanSubscriptionRef.current) {
        console.log("Unsubscribing from BLE scan...");
        try {
          ledgerScanSubscriptionRef.current.unsubscribe();
          ledgerScanSubscriptionRef.current = null;
          console.log("Scan subscription cleaned up");
        } catch (e) {
          console.log("Error unsubscribing from scan:", e.message);
        }
      }

      // 2. Disconnect transport properly (don't just close)
      if (ledgerTransportRef.current) {
        console.log("Disconnecting Ledger transport...");
        try {
          // Properly disconnect - this triggers internal BLE disconnect callback
          await ledgerTransportRef.current.close();
          console.log("Transport disconnected successfully");
        } catch (closeError) {
          console.log("Error disconnecting transport:", closeError.message);
        }

        // 3. Clear the reference
        ledgerTransportRef.current = null;

        // 4. Wait for BLE stack to fully cleanup (important!)
        // Increased to 5 seconds to allow RxJava threads to fully clean up
        console.log("Waiting 5 seconds for BLE stack to fully cleanup...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        console.log("BLE cleanup delay completed");
      }

      console.log("Ledger BLE cleanup complete");
      // Mark cleanup as completed to prevent it from running again
      ledgerCleanedUpRef.current = true;
    } finally {
      // Reset the cleaning flag
      ledgerCleaningRef.current = false;
    }
  };

  // Fetch paired Bluetooth devices
  const fetchPairedBluetoothDevices = async () => {
    try {
      console.log("Fetching paired Bluetooth devices...");

      const deviceList = [];

      // Add the stored ledger device if available
      if (ledgerDeviceInfo) {
        console.log("Found stored ledger device info:", ledgerDeviceInfo);
        deviceList.push({
          id: ledgerDeviceInfo.id,
          name: ledgerDeviceInfo.name || "Ledger Device",
          address: ledgerDeviceInfo.id,
          isConnected: false,
        });
      } else if (ledgerDeviceId) {
        // Fallback to deviceId if no info stored
        console.log("Found stored ledger device ID (no name):", ledgerDeviceId);
        deviceList.push({
          id: ledgerDeviceId,
          name: "Ledger Device",
          address: ledgerDeviceId,
          isConnected: false,
        });
      }

      setPairedDevices(deviceList);
      console.log("Device list updated:", deviceList);
    } catch (error) {
      console.error("Error fetching paired devices:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: `Failed to fetch paired devices: ${error.message}`,
        position: "bottom",
      });
    }
  };

  // Forget/unpair a Bluetooth device
  const forgetBluetoothDevice = async (deviceId) => {
    try {
      console.log("Forgetting device:", deviceId);

      // Clear stored device ID and info if it matches
      if (ledgerDeviceId === deviceId) {
        setLedgerDeviceId(null);
        setLedgerDeviceInfo(null);
        console.log("Cleared stored ledger device ID and info");
      }

      // Refresh the list
      fetchPairedBluetoothDevices();

      Toast.show({
        type: "success",
        text1: "Device Forgotten",
        text2: "You will need to reconnect it to use it again.",
        position: "bottom",
      });
    } catch (error) {
      console.error("Error in forgetBluetoothDevice:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: `Failed to forget device: ${error.message}`,
        position: "bottom",
      });
    }
  };

  // Ledger Bluetooth scanning using official TransportBLE API
  const scanForLedger = async () => {
    try {
      // Clean up any existing scan subscription ONLY (no 5-second delay)
      if (ledgerScanSubscriptionRef.current) {
        console.log("Cleaning up previous scan subscription...");
        try {
          ledgerScanSubscriptionRef.current.unsubscribe();
          ledgerScanSubscriptionRef.current = null;
        } catch (e) {
          console.log("Error unsubscribing from previous scan:", e.message);
        }
      }

      // Reset cleanup flags to allow fresh cleanup when needed
      ledgerCleanedUpRef.current = false;
      ledgerCleaningRef.current = false;

      // Clear device ID to force fresh scan
      setLedgerDeviceId(null);

      setLedgerScanning(true);
      setLedgerAccounts([]);
      setLedgerSelectedAccounts(new Set()); // Clear multi-select
      setDiscoveredDevices([]); // Clear previous results
      ledgerSkippedDuplicatesRef.current = 0; // Reset skipped duplicates counter
      console.log("Starting Ledger Bluetooth scan...");

      const subscription = TransportBLE.listen({
        complete: () => {
          console.log("Ledger scan complete");
          setLedgerScanning(false);
        },
        next: (e) => {
          if (e.type === "add") {
            const device = e.descriptor;

            setDiscoveredDevices((prev) => {
              // Avoid duplicates
              if (prev.some((d) => d.id === device.id)) return prev;
              // Only log when a NEW device is found
              console.log(
                "Found new Ledger device:",
                device.name || device.localName,
                device.id
              );
              return [...prev, device];
            });
          }
        },
        error: async (error) => {
          console.error("Ledger scan error:", error);
          console.error("Error name:", error.name);
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);

          setLedgerScanning(false);
          ledgerScanSubscriptionRef.current = null;

          // Check if this is the "Operation was cancelled" error
          if (
            error.message &&
            error.message.includes("Operation was cancelled")
          ) {
            console.log(
              "⚠️ BLE scan cancelled - performing complete BLE cleanup..."
            );

            // Perform complete BLE cleanup
            try {
              // Close any existing transport
              if (ledgerTransportRef.current) {
                await ledgerTransportRef.current.close();
                ledgerTransportRef.current = null;
                console.log("✓ Transport closed during scan error cleanup");
              }

              // Clear all BLE-related refs
              ledgerScanSubscriptionRef.current = null;
              ledgerCleaningRef.current = false;
              ledgerCleanedUpRef.current = false;

              console.log("✓ Complete BLE cleanup finished");

              Toast.show({
                type: "info",
                text1: "Scan Cancelled",
                text2: "BLE scan was cancelled. Please try again.",
                position: "bottom",
              });
            } catch (cleanupError) {
              console.error("Error during BLE cleanup:", cleanupError);
            }
          } else {
            // Other errors - show generic error message
            Toast.show({
              type: "error",
              text1: "Scan Error",
              text2:
                error.message ||
                "Failed to scan for Ledger devices. Check Bluetooth and Solana app.",
              position: "bottom",
            });
          }
        },
      });

      // Store subscription for cleanup
      ledgerScanSubscriptionRef.current = subscription;
      console.log("Scan subscription created and stored");

      // Stop scanning after 10 seconds
      setTimeout(() => {
        if (ledgerScanSubscriptionRef.current) {
          ledgerScanSubscriptionRef.current.unsubscribe();
          ledgerScanSubscriptionRef.current = null;
          setLedgerScanning(false);
          console.log("Ledger scan stopped after 10 seconds");
        }
      }, 10000);
    } catch (error) {
      setLedgerScanning(false);
      console.error("Error starting Ledger scan:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Failed to start Ledger scan",
        position: "bottom",
      });
    }
  };

  const connectToLedger = async (device, retryCount = 0) => {
    const MAX_RETRIES = 3;
    let transport = null;

    console.log("connectToLedger called with:", typeof device, device);

    try {
      setLedgerConnecting(true);
      setLedgerWalletProgress(0); // Reset progress

      // Clean up any existing transport first
      if (ledgerTransportRef.current) {
        console.log("Cleaning up existing transport before new connection...");
        try {
          await ledgerTransportRef.current.close();
          ledgerTransportRef.current = null;
          console.log("Previous transport cleaned up");
        } catch (cleanupError) {
          console.log(
            "Error cleaning up previous transport (ignoring):",
            cleanupError.message
          );
          ledgerTransportRef.current = null;
        }
        // Wait for BLE stack to fully settle after cleanup
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // If device is just a string, it's a device ID
      // Otherwise, it's the full device descriptor from the scan
      const isDeviceDescriptor = typeof device === "object" && device !== null;
      const deviceId = isDeviceDescriptor ? device.id : device;
      const deviceName = isDeviceDescriptor
        ? device.name || device.localName
        : "Ledger (stored)";

      if (!deviceId) {
        console.error("Invalid device ID from input:", device);
        throw new Error("Invalid device ID. Please try scanning again.");
      }

      console.log("Connecting to Ledger device:", deviceName);
      console.log("Device ID:", deviceId);
      console.log("Using full device descriptor:", isDeviceDescriptor);
      if (retryCount > 0) {
        console.log(`Retry attempt ${retryCount} of ${MAX_RETRIES}`);
      }

      // Use the full device descriptor if available, otherwise just the ID
      const connectionTarget = isDeviceDescriptor ? device : deviceId;
      console.log(
        "Connecting with:",
        isDeviceDescriptor ? "device descriptor" : "device ID"
      );

      // Perform comprehensive BLE cleanup before attempting new connection
      try {
        console.log(
          "⚠️ Performing comprehensive BLE cleanup before connection..."
        );

        // 1. Close any existing transport
        if (ledgerTransportRef.current) {
          try {
            await ledgerTransportRef.current.close();
            console.log("  ✓ Closed existing transport");
          } catch (e) {
            console.log("  ⚠ Error closing transport:", e.message);
          }
          ledgerTransportRef.current = null;
        }

        // 2. Unsubscribe from any existing scans
        if (ledgerScanSubscriptionRef.current) {
          try {
            ledgerScanSubscriptionRef.current.unsubscribe();
            console.log("  ✓ Cleared scan subscription");
          } catch (e) {
            console.log("  ⚠ Error clearing scan subscription:", e.message);
          }
          ledgerScanSubscriptionRef.current = null;
        }

        // 3. Reset cleanup flags
        ledgerCleaningRef.current = false;
        ledgerCleanedUpRef.current = false;

        // 4. Power cycle Bluetooth on second retry to clear stale connections
        //    (Skip on first attempt to avoid unnecessary delay)
        if (retryCount === 1) {
          console.log("  🔄 Second retry attempt - power cycling Bluetooth...");
          const cycled = await powerCycleBluetooth();
          if (cycled) {
            console.log("  ✓ Bluetooth power cycle succeeded");
          } else {
            console.log(
              "  ⚠ Bluetooth power cycle not available (Android 13+)"
            );
          }
        }

        // 5. Attempt to disconnect using device ID if supported
        if (TransportBLE.disconnectDevice) {
          await TransportBLE.disconnectDevice(deviceId);
          console.log("  ✓ TransportBLE.disconnectDevice succeeded");
        } else if (TransportBLE.disconnect) {
          await TransportBLE.disconnect(deviceId);
          console.log("  ✓ TransportBLE.disconnect succeeded");
        } else {
          console.log("  ⚠ TransportBLE disconnect methods not supported");
        }

        // Wait for BLE stack to settle after comprehensive cleanup
        console.log("  ⏳ Waiting for BLE stack to settle...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        console.log("✅ BLE cleanup complete, proceeding with connection");
      } catch (cleanupError) {
        console.log(
          "⚠️ Error during BLE cleanup (continuing anyway):",
          cleanupError.message
        );
        // Brief wait even if cleanup failed
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log("Opening BLE transport with timeout...");

      // Open transport with timeout (20 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timeout after 20 seconds")),
          20000
        )
      );

      transport = await Promise.race([
        TransportBLE.open(connectionTarget),
        timeoutPromise,
      ]);

      // Store the transport for future cleanup
      ledgerTransportRef.current = transport;

      // Store the device ID for transaction signing
      setLedgerDeviceId(deviceId);
      console.log("Stored device ID for signing:", deviceId);

      // Store the device info (name + ID) for Bluetooth manager
      setLedgerDeviceInfo({ id: deviceId, name: deviceName });
      console.log("Stored device info:", { id: deviceId, name: deviceName });

      console.log("BLE transport opened successfully");
      console.log("Creating Solana app instance...");
      const solana = new AppSolana(transport);

      // Helper function to check balance on both chains
      const checkAccountBalance = async (address) => {
        try {
          // Check Solana mainnet balance
          const solanaConnection = new Connection(
            "https://api.mainnet-beta.solana.com",
            "confirmed"
          );
          const solanaPubkey = new PublicKey(address);
          const solanaBalance = await solanaConnection.getBalance(solanaPubkey);
          const solanaBalanceSOL = solanaBalance / 1000000000;

          // Check X1 mainnet balance
          const x1Connection = new Connection(
            "https://rpc.mainnet.x1.xyz",
            "confirmed"
          );
          const x1Pubkey = new PublicKey(address);
          const x1Balance = await x1Connection.getBalance(x1Pubkey);
          const x1BalanceSOL = x1Balance / 1000000000;

          console.log(`[Ledger Scan] Account ${address}:`);
          console.log(
            `  SOL: ${solanaBalanceSOL.toFixed(6)} | XNT: ${x1BalanceSOL.toFixed(6)}`
          );

          return {
            solana: solanaBalanceSOL,
            x1: x1BalanceSOL,
            hasBalance: solanaBalanceSOL > 0 || x1BalanceSOL > 0,
          };
        } catch (error) {
          console.error(
            `Error checking balance for ${address}:`,
            error.message
          );
          return { solana: 0, x1: 0, hasBalance: false };
        }
      };

      // Derivation path patterns
      const DERIVATION_PATTERNS = {
        standard: (i) => `44'/501'/${i}'/0'`, // Standard Solana (default)
        ledgerLive: (i) => `44'/501'/${i}'`, // Ledger Live
        alternate: (i) => `44'/501'/0'/${i}'`, // Alternate (account last)
      };

      // Scan all accounts across all selected derivation patterns
      // Deep scan mode: scan up to 50 accounts per path
      // Normal mode: scan up to 30 accounts per path with early stop at 5 consecutive empty
      const MAX_ACCOUNTS = ledgerDeepScan ? 50 : 30;
      const allAccounts = [];
      const accountsWithBalance = [];
      const seenAddresses = new Set(); // Track unique addresses to avoid duplicates

      // Reset abort flag and pause state at the start of scan
      ledgerScanAbortRef.current = false;
      ledgerScanPausedRef.current = false;
      setLedgerScanPaused(false);
      ledgerSkippedDuplicatesRef.current = 0;

      console.log(
        `[Ledger Scan] Starting ${ledgerDeepScan ? "DEEP SCAN" : "scan"} with ${ledgerDerivationPatterns.length} derivation pattern(s): ${ledgerDerivationPatterns.join(", ")}`
      );
      console.log(`[Ledger Scan] Max accounts per pattern: ${MAX_ACCOUNTS}`);

      let totalScanned = 0;
      const totalToScan = MAX_ACCOUNTS * ledgerDerivationPatterns.length;

      // Scan each selected pattern
      for (const patternKey of ledgerDerivationPatterns) {
        // Check if scan was aborted
        if (ledgerScanAbortRef.current) {
          console.log("[Ledger Scan] Scan aborted - stopping pattern scan");
          break;
        }

        const pathGenerator = DERIVATION_PATTERNS[patternKey];
        console.log(`\n[Ledger Scan] === Scanning ${patternKey} pattern ===`);

        let consecutiveEmptyAccounts = 0;
        const EARLY_STOP_THRESHOLD = 5;

        for (let i = 0; i < MAX_ACCOUNTS; i++) {
          // Check if scan was aborted
          if (ledgerScanAbortRef.current) {
            console.log("[Ledger Scan] Scan aborted - stopping account scan");
            break;
          }

          totalScanned++;
          const derivationPath = pathGenerator(i);
          console.log(
            `\n[Ledger Scan] [${totalScanned}/${totalToScan}] Checking ${patternKey} account ${i + 1}/${MAX_ACCOUNTS}...`
          );
          console.log(`  Derivation path: ${derivationPath}`);

          const result = await solana.getAddress(derivationPath);
          const addressBuffer = result.address || result;

          // Convert Buffer/Uint8Array to Base58 string
          let addressString;
          if (typeof addressBuffer === "string") {
            addressString = addressBuffer;
          } else if (
            addressBuffer instanceof Buffer ||
            addressBuffer instanceof Uint8Array
          ) {
            addressString = bs58.encode(addressBuffer);
          } else {
            addressString = bs58.encode(Buffer.from(addressBuffer));
          }

          console.log(`  Address: ${addressString}`);

          // Skip if we've already seen this address from another pattern
          if (seenAddresses.has(addressString)) {
            console.log(
              `  ⊘ Address already scanned from different pattern - skipping`
            );
            setLedgerWalletProgress(totalScanned);
            continue;
          }
          seenAddresses.add(addressString);

          // Check balance on both chains
          const balanceInfo = await checkAccountBalance(addressString);

          const newAccount = {
            index: i,
            address: addressString,
            derivationPath,
            pattern: patternKey,
            solanaBalance: balanceInfo.solana,
            x1Balance: balanceInfo.x1,
          };

          // Check if this account is already imported (O(1) lookup using Set)
          const isAlreadyImported = walletAddressIndex.has(addressString);

          if (isAlreadyImported) {
            console.log(`  ⊙ Account already imported - skipping entirely`);
            ledgerSkippedDuplicatesRef.current++;
            // Don't add to any list, don't count as empty for early stop
            continue;
          }

          // Wait while paused (use ref for real-time checking)
          while (ledgerScanPausedRef.current) {
            console.log("[Ledger Scan] Paused - waiting...");
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          // Only add non-imported accounts
          allAccounts.push(newAccount);

          if (balanceInfo.hasBalance) {
            // Assign sequential display index for accounts with balance
            newAccount.displayIndex = accountsWithBalance.length;
            accountsWithBalance.push(newAccount);
            console.log(
              `  ✓ Account HAS balance - added to list as Account ${accountsWithBalance.length}`
            );
            consecutiveEmptyAccounts = 0; // Reset counter when we find an account with balance
          } else {
            console.log(`  ✗ Account has no balance`);
            consecutiveEmptyAccounts++;
            console.log(
              `  Consecutive empty accounts: ${consecutiveEmptyAccounts}/${EARLY_STOP_THRESHOLD}`
            );
          }

          // Update state with all accounts that have balances
          setLedgerAccounts([...accountsWithBalance]);
          setLedgerWalletProgress(totalScanned);

          // Early stop if we've seen 5 consecutive accounts with zero balance
          // (only in normal mode, not deep scan)
          if (
            !ledgerDeepScan &&
            consecutiveEmptyAccounts >= EARLY_STOP_THRESHOLD
          ) {
            console.log(
              `\n[Ledger Scan] Stopping ${patternKey} pattern after ${EARLY_STOP_THRESHOLD} consecutive empty accounts`
            );
            break;
          }
        }
      }

      console.log(`\n[Ledger Scan] Scan complete!`);
      console.log(`  Total unique accounts scanned: ${allAccounts.length}`);
      console.log(`  Accounts with balance: ${accountsWithBalance.length}`);
      console.log(`  Patterns scanned: ${ledgerDerivationPatterns.join(", ")}`);

      // Print summary table
      console.log(`\n[Ledger Scan] ========== BALANCE SUMMARY ==========`);
      console.log(
        `[Ledger Scan] Pattern    | Path# | Display# | Path             | SOL Balance | XNT Balance | PublicKey`
      );
      console.log(
        `[Ledger Scan] ------------+-------+----------+------------------+-------------+-------------+--------------------------------------------`
      );

      for (const account of allAccounts) {
        const pattern = (account.pattern || "standard").padEnd(11, " ");
        const pathIdx = String(account.index + 1).padStart(5, " ");
        const displayIdx =
          account.displayIndex !== undefined
            ? String(account.displayIndex + 1).padStart(8, " ")
            : "        ";
        const path = account.derivationPath.padEnd(16, " ");
        const solBal = (account.solanaBalance || 0)
          .toFixed(6)
          .padStart(11, " ");
        const xntBal = (account.x1Balance || 0).toFixed(6).padStart(11, " ");
        const hasBalance =
          account.solanaBalance > 0 || account.x1Balance > 0 ? "✓" : " ";

        console.log(
          `[Ledger Scan] ${pattern} | ${pathIdx} | ${displayIdx} | ${path} | ${solBal} | ${xntBal} | ${account.address} ${hasBalance}`
        );
      }

      console.log(
        `[Ledger Scan] ==============================================================================`
      );
      console.log(
        `[Ledger Scan] ✓ = Account has balance and will be shown to user`
      );
      console.log(
        `[Ledger Scan] Path# = Index in derivation path | Display# = Sequential number shown in UI (1, 2, 3...)`
      );
      console.log(
        `[Ledger Scan] Using RPC: SOL=https://api.mainnet-beta.solana.com | X1=https://rpc.mainnet.x1.xyz`
      );

      if (accountsWithBalance.length === 0) {
        // Check if all scanned accounts were already imported
        if (
          ledgerSkippedDuplicatesRef.current > 0 &&
          allAccounts.length === 0
        ) {
          console.log(
            `\n[Ledger Scan] ⚠️ All ${ledgerSkippedDuplicatesRef.current} accounts are already imported`
          );
          // Set empty array but we'll show a special message in UI
          setLedgerAccounts([]);
        } else {
          console.log(
            `\n[Ledger Scan] ⚠️ No accounts with balance found, showing first 5 accounts`
          );
          // If no accounts with balance, show first 5 anyway with display indices
          const first5 = allAccounts.slice(0, 5).map((acc, i) => ({
            ...acc,
            displayIndex: i,
          }));
          setLedgerAccounts(first5);
        }
      }

      // Reset progress to stop the scanning indicator
      setLedgerWalletProgress(0);

      // DON'T close transport immediately! Keep it alive.
      // This prevents the BLE crash from happening during the RxJava cleanup phase.
      // The transport will be cleaned up when:
      // - User selects an account (handleSelectLedgerAccount)
      // - Modal is dismissed
      // - Next scan is initiated
      console.log("Keeping transport alive for account selection...");
      console.log("Successfully retrieved Ledger accounts!");

      // Finish connecting state
      setLedgerConnecting(false);
      console.log(`Found ${accounts.length} accounts from Ledger`);
    } catch (error) {
      console.error("Error connecting to Ledger:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      // Check if this is a "cancelled" error and we should retry
      const isCancelledError =
        (error.message &&
          (error.message.includes("cancelled") ||
            error.message.includes("canceled"))) ||
        error.errorCode === 2;

      if (isCancelledError && retryCount < MAX_RETRIES) {
        // Calculate exponential backoff delay: 1s, 2s, 4s
        const delayMs = 1000 * Math.pow(2, retryCount);
        console.log(
          `⚠️ Connection cancelled, performing complete cleanup before retry in ${delayMs}ms...`
        );

        // Perform comprehensive BLE cleanup before retry
        try {
          // 1. Close transport if it exists
          if (transport) {
            try {
              await transport.close();
              console.log("  ✓ Closed transport");
            } catch (e) {
              console.log("  ⚠ Error closing transport:", e.message);
            }
          }
          ledgerTransportRef.current = null;

          // 2. Clear scan subscription
          if (ledgerScanSubscriptionRef.current) {
            try {
              ledgerScanSubscriptionRef.current.unsubscribe();
              console.log("  ✓ Cleared scan subscription");
            } catch (e) {
              console.log("  ⚠ Error clearing subscription:", e.message);
            }
            ledgerScanSubscriptionRef.current = null;
          }

          // 3. Reset cleanup flags
          ledgerCleaningRef.current = false;
          ledgerCleanedUpRef.current = false;

          console.log("✅ Complete cleanup done before retry");
        } catch (cleanupError) {
          console.log("⚠️ Error during cleanup:", cleanupError.message);
          ledgerTransportRef.current = null;
        }

        // Wait for exponential backoff delay
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // Retry connection
        return connectToLedger(device, retryCount + 1);
      }

      // If we've exhausted retries or it's a different error, handle it
      setLedgerConnecting(false);

      // Perform comprehensive BLE cleanup after exhausting retries
      console.log("⚠️ Performing comprehensive BLE cleanup after error...");
      try {
        // 1. Close transport if it exists
        if (transport) {
          try {
            await transport.close();
            console.log("  ✓ Transport closed");
          } catch (e) {
            console.log("  ⚠ Error closing transport:", e.message);
          }
        }
        ledgerTransportRef.current = null;

        // 2. Clear scan subscription
        if (ledgerScanSubscriptionRef.current) {
          try {
            ledgerScanSubscriptionRef.current.unsubscribe();
            console.log("  ✓ Scan subscription cleared");
          } catch (e) {
            console.log("  ⚠ Error clearing subscription:", e.message);
          }
          ledgerScanSubscriptionRef.current = null;
        }

        // 3. Reset cleanup flags
        ledgerCleaningRef.current = false;
        ledgerCleanedUpRef.current = false;

        console.log("✅ Comprehensive cleanup complete after error");
      } catch (finalCleanupError) {
        console.log(
          "⚠️ Error during final cleanup:",
          finalCleanupError.message
        );
        ledgerTransportRef.current = null;
      }

      let errorMessage = "Failed to connect to Ledger device. ";
      if (error.message && error.message.includes("timeout")) {
        errorMessage +=
          "Connection timed out. Make sure the Solana app is open on your Ledger and Bluetooth pairing is accepted.";
      } else if (isCancelledError) {
        errorMessage += `Connection was cancelled after ${MAX_RETRIES} attempts.\n\nTroubleshooting:\n• Go to Phone Settings > Bluetooth\n• Forget/Unpair your Ledger device\n• Try connecting again\n• Accept the pairing request on your PHONE\n• Unlock and open Solana app on Ledger`;
      } else if (
        error.message &&
        (error.message.includes("pairing") ||
          error.message.includes("PairingFailed") ||
          error.message.includes("notify change failed"))
      ) {
        errorMessage +=
          "Pairing failed or was not accepted in time.\n\nPlease ensure you:\n• Accept the pairing request on your PHONE when it appears\n• Approve the connection on your LEDGER device\n• Have the Solana app open on the Ledger";
      } else if (
        error.message &&
        (error.message.includes("Invalid tag") ||
          error.message.includes("TransportError"))
      ) {
        errorMessage +=
          "Communication error (Invalid Tag). Please update your Ledger firmware and Solana app, or try a different cable/connection.";
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage +=
          "Please ensure:\n• Ledger is unlocked\n• Solana app is open on Ledger\n• Accept the pairing request when it appears";
      }

      Toast.show({
        type: "error",
        text1: "Connection Error",
        text2:
          errorMessage.length > 100
            ? errorMessage.substring(0, 100) + "..."
            : errorMessage,
        position: "bottom",
      });
    }
  };

  // USB Ledger connection function
  const connectToLedgerUsb = async () => {
    try {
      setLedgerConnecting(true);
      console.log("Starting USB Ledger connection...");

      // Check if USB module is available
      if (!LedgerUsb) {
        throw new Error("LedgerUsb native module not available");
      }

      // List USB devices
      console.log("Listing USB devices...");
      const devices = await LedgerUsb.listDevices();
      console.log("Found USB devices:", devices);

      if (devices.length === 0) {
        throw new Error("No Ledger device found via USB");
      }

      // Request permission
      console.log("Requesting USB permission...");
      const hasPermission = await LedgerUsb.requestPermission();
      console.log("USB permission granted:", hasPermission);

      if (!hasPermission) {
        throw new Error(
          "USB permission not granted. Please accept the USB permission dialog."
        );
      }

      // Connect to device
      console.log("Connecting to USB device...");
      const connected = await LedgerUsb.connect();
      console.log("USB connected:", connected);

      if (!connected) {
        throw new Error("Failed to connect to USB device");
      }

      // Get first 5 Solana accounts
      console.log("Getting Solana addresses...");
      const accounts = [];

      for (let i = 0; i < 5; i++) {
        const derivationPath = `44'/501'/${i}'/0'`;
        console.log(`Getting address for path: ${derivationPath}`);

        // Solana getAddress APDU command
        // CLA INS P1 P2 LC [data]
        // E0  05  00 01 LC [path_data]
        const pathElements = [
          44 + 0x80000000,
          501 + 0x80000000,
          i + 0x80000000,
          0,
        ];
        const pathData = [];
        pathData.push(pathElements.length); // Number of path elements

        // Convert each path element to 4 bytes (big endian)
        for (const element of pathElements) {
          pathData.push((element >> 24) & 0xff);
          pathData.push((element >> 16) & 0xff);
          pathData.push((element >> 8) & 0xff);
          pathData.push(element & 0xff);
        }

        const apdu = [
          0xe0, // CLA
          0x05, // INS (GET_PUBKEY)
          0x00, // P1 (non-confirm)
          0x01, // P2 (return address)
          pathData.length, // LC
          ...pathData,
        ];

        console.log("Sending APDU:", apdu);
        const response = await LedgerUsb.sendApdu(apdu);
        console.log("APDU response:", response);

        // Parse response: [pubkey(32 bytes)][address_length(1 byte)][address][SW1 SW2]
        if (response.length < 34) {
          throw new Error(`Invalid response length: ${response.length}`);
        }

        // Extract address
        const addressLength = response[32];
        const addressBytes = response.slice(33, 33 + addressLength);
        const addressString = String.fromCharCode(...addressBytes);

        console.log(`Address ${i}: ${addressString}`);

        accounts.push({
          index: i,
          address: addressString,
          derivationPath,
        });
      }

      // Disconnect
      console.log("Disconnecting from USB device...");
      await LedgerUsb.disconnect();
      console.log("USB disconnected");

      // Set accounts and update state
      setLedgerAccounts(accounts);
      setLedgerConnecting(false);
      console.log("Successfully retrieved Ledger accounts via USB!");
    } catch (error) {
      setLedgerConnecting(false);
      console.error("Error connecting to USB Ledger:", error);

      Toast.show({
        type: "error",
        text1: "USB Connection Error",
        text2: error.message || "Failed to connect to Ledger via USB",
        position: "bottom",
      });
    }
  };

  const handleSelectLedgerAccount = async (account) => {
    console.log("=== ADDING LEDGER WALLET ===");
    console.log("Account index:", account.index);
    console.log("Account address:", account.address);
    console.log("Derivation path:", account.derivationPath);
    console.log("Device ID from state:", ledgerDeviceId);
    console.log("Device ID type:", typeof ledgerDeviceId);
    console.log("Device ID is null?", ledgerDeviceId === null);
    console.log("Device ID is undefined?", ledgerDeviceId === undefined);

    // Check for duplicate wallet
    const isDuplicate = wallets.some((w) => w.publicKey === account.address);

    if (isDuplicate) {
      setLedgerError("This wallet has already been added.");
      return;
    }

    const newWallet = {
      id: Date.now(),
      name: `Ledger ${account.displayIndex + 1}`,
      address: account.address,
      publicKey: account.address,
      selected: true, // Set new wallet as selected
      isLedger: true,
      derivationPath: account.derivationPath,
      ledgerDeviceId: ledgerDeviceId, // Store device ID for later signing
      hideZeroBalanceTokens: false, // User preference for hiding zero balance tokens
    };

    console.log("New wallet object:", JSON.stringify(newWallet, null, 2));
    console.log("Wallet ledgerDeviceId field:", newWallet.ledgerDeviceId);
    console.log("=== END ADDING LEDGER WALLET ===");

    // Deselect all existing wallets and add new wallet as selected
    const updatedWallets = [
      ...wallets.map((w) => ({ ...w, selected: false })),
      newWallet,
    ];
    setWallets(updatedWallets);
    await saveWalletsToStorage(updatedWallets);

    // Set the new wallet as the selected wallet
    setSelectedWallet(newWallet);

    ledgerSheetRef.current?.dismiss();
    setLedgerAccounts([]);

    // Register the wallet with the transaction indexer
    await registerWalletWithIndexer(account.address, currentNetwork.providerId);

    // Clean up BLE connection after account is selected
    // Run in background to not block UI
    cleanupLedgerBLE().catch((e) =>
      console.log("Cleanup error (ignoring):", e.message)
    );
  };

  const handleAddAllLedgerAccounts = async () => {
    console.log("=== ADDING ALL LEDGER WALLETS ===");
    console.log("Number of accounts to add:", ledgerAccounts.length);

    // Show progress popup
    setLedgerAddingAccounts(true);
    setLedgerAddProgress({ current: 0, total: ledgerAccounts.length });

    const newWallets = [];
    const skippedAccounts = [];
    let processedCount = 0;

    for (const account of ledgerAccounts) {
      // Check for duplicate wallet
      const isDuplicate = wallets.some((w) => w.publicKey === account.address);

      if (isDuplicate) {
        console.log(`Skipping duplicate account: ${account.address}`);
        skippedAccounts.push(account);
        processedCount++;
        setLedgerAddProgress({
          current: processedCount,
          total: ledgerAccounts.length,
        });
        continue;
      }

      const newWallet = {
        id: Date.now() + account.displayIndex, // Unique ID for each wallet
        name: `Ledger ${account.displayIndex + 1}`,
        address: account.address,
        publicKey: account.address,
        selected: false, // Will select the first one after loop
        isLedger: true,
        derivationPath: account.derivationPath,
        ledgerDeviceId: ledgerDeviceId,
        hideZeroBalanceTokens: false,
      };

      newWallets.push(newWallet);
      console.log(
        `Added account ${account.displayIndex + 1}: ${account.address}`
      );

      // Register each wallet with the transaction indexer
      await registerWalletWithIndexer(
        account.address,
        currentNetwork.providerId
      );

      // Update progress
      processedCount++;
      setLedgerAddProgress({
        current: processedCount,
        total: ledgerAccounts.length,
      });
    }

    if (newWallets.length === 0) {
      setLedgerAddingAccounts(false);
      setLedgerError("All accounts have already been added.");
      return;
    }

    // Set the first new wallet as selected
    if (newWallets.length > 0) {
      newWallets[0].selected = true;
    }

    // Deselect all existing wallets and add all new wallets
    const updatedWallets = [
      ...wallets.map((w) => ({ ...w, selected: false })),
      ...newWallets,
    ];

    setWallets(updatedWallets);
    await saveWalletsToStorage(updatedWallets);

    // Set the first new wallet as the selected wallet
    setSelectedWallet(newWallets[0]);

    console.log(`Successfully added ${newWallets.length} wallet(s)`);
    if (skippedAccounts.length > 0) {
      console.log(`Skipped ${skippedAccounts.length} duplicate(s)`);
    }
    console.log("=== END ADDING ALL LEDGER WALLETS ===");

    // Hide progress popup
    setLedgerAddingAccounts(false);

    ledgerSheetRef.current?.dismiss();
    setLedgerAccounts([]);

    // Clean up BLE connection after accounts are added
    cleanupLedgerBLE().catch((e) =>
      console.log("Cleanup error (ignoring):", e.message)
    );
  };

  // Toggle selection of a Ledger account for multi-select
  const handleToggleLedgerAccountSelection = (account) => {
    setLedgerSelectedAccounts((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(account.address)) {
        newSelected.delete(account.address);
      } else {
        newSelected.add(account.address);
      }
      return newSelected;
    });
  };

  // Add selected Ledger accounts
  const handleAddSelectedLedgerAccounts = async () => {
    console.log("=== ADDING SELECTED LEDGER WALLETS ===");

    // Filter accounts to only those selected
    const selectedAccountsList = ledgerAccounts.filter((account) =>
      ledgerSelectedAccounts.has(account.address)
    );

    console.log(
      "Number of selected accounts to add:",
      selectedAccountsList.length
    );

    if (selectedAccountsList.length === 0) {
      setLedgerError("Please select at least one account to add.");
      return;
    }

    // Show progress popup
    setLedgerAddingAccounts(true);
    setLedgerAddProgress({ current: 0, total: selectedAccountsList.length });

    const newWallets = [];
    const skippedAccounts = [];
    let processedCount = 0;

    for (const account of selectedAccountsList) {
      // Check for duplicate wallet
      const isDuplicate = wallets.some((w) => w.publicKey === account.address);

      if (isDuplicate) {
        console.log(`Skipping duplicate account: ${account.address}`);
        skippedAccounts.push(account);
        processedCount++;
        setLedgerAddProgress({
          current: processedCount,
          total: selectedAccountsList.length,
        });
        continue;
      }

      const newWallet = {
        id: Date.now() + account.displayIndex,
        name: `Ledger ${account.displayIndex + 1}`,
        address: account.address,
        publicKey: account.address,
        selected: false,
        isLedger: true,
        derivationPath: account.derivationPath,
        ledgerDeviceId: ledgerDeviceId,
        hideZeroBalanceTokens: false,
      };

      newWallets.push(newWallet);
      console.log(
        `Added account ${account.displayIndex + 1}: ${account.address}`
      );

      // Register each wallet with the transaction indexer
      await registerWalletWithIndexer(
        account.address,
        currentNetwork.providerId
      );

      // Update progress
      processedCount++;
      setLedgerAddProgress({
        current: processedCount,
        total: selectedAccountsList.length,
      });
    }

    if (newWallets.length === 0) {
      setLedgerAddingAccounts(false);
      setLedgerError("All selected accounts have already been added.");
      return;
    }

    // Set the first new wallet as selected
    if (newWallets.length > 0) {
      newWallets[0].selected = true;
    }

    // Deselect all existing wallets and add all new wallets
    const updatedWallets = [
      ...wallets.map((w) => ({ ...w, selected: false })),
      ...newWallets,
    ];

    setWallets(updatedWallets);
    await saveWalletsToStorage(updatedWallets);

    // Set the first new wallet as the selected wallet
    setSelectedWallet(newWallets[0]);

    console.log(`Successfully added ${newWallets.length} wallet(s)`);
    if (skippedAccounts.length > 0) {
      console.log(`Skipped ${skippedAccounts.length} duplicate(s)`);
    }
    console.log("=== END ADDING SELECTED LEDGER WALLETS ===");

    // Hide progress popup
    setLedgerAddingAccounts(false);

    // Clear selection
    setLedgerSelectedAccounts(new Set());

    ledgerSheetRef.current?.dismiss();
    setLedgerAccounts([]);

    // Clean up BLE connection after accounts are added
    cleanupLedgerBLE().catch((e) =>
      console.log("Cleanup error (ignoring):", e.message)
    );
  };

  const handleSheetChanges = useCallback((index) => {
    console.log("handleSheetChanges", index);
  }, []);

  const renderBackdrop = useCallback(
    (props) => (
      <SimpleActionSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  const openExplorer = (signature) => {
    let url;
    if (currentNetwork.id === "SOLANA") {
      url = `https://explorer.solana.com/tx/${signature}`;
    } else {
      // X1 network
      url = `http://explorer.mainnet.x1.xyz/tx/${signature}`;
    }
    Linking.openURL(url);
  };

  // Test Browser Page
  if (showTestBrowser) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: easterEggMode ? "#111827" : "#000" }}
      >
        <StatusBar hidden={true} />
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 15,
            backgroundColor: "#1a1a1a",
            borderBottomWidth: 1,
            borderBottomColor: "#333",
          }}
        >
          <TouchableOpacity
            onPress={() => setShowTestBrowser(false)}
            style={{ marginRight: 15 }}
          >
            <Text style={{ color: "#fff", fontSize: 24 }}>←</Text>
          </TouchableOpacity>
          <Text
            style={{ color: "#fff", fontSize: 18, fontWeight: "bold", flex: 1 }}
          >
            Browser
          </Text>
        </View>

        {/* URL Bar */}
        <View
          style={{
            flexDirection: "row",
            padding: 10,
            backgroundColor: "#1a1a1a",
            borderBottomWidth: 1,
            borderBottomColor: "#333",
          }}
        >
          <TextInput
            style={{
              flex: 1,
              backgroundColor: "#2a2a2a",
              color: "#fff",
              padding: 10,
              borderRadius: 5,
              marginRight: 10,
            }}
            value={browserInputUrl}
            onChangeText={setBrowserInputUrl}
            placeholder="Enter URL (e.g., http://192.168.1.61:4000/test)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              let url = browserInputUrl.trim().replace(/\s/g, "");
              if (url.length === 0) return;

              if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "http://" + url;
              }
              console.log("Loading URL:", url);
              setBrowserUrl(url);
              // Also force reload if WebView is already loaded
              if (webViewRef.current) {
                setTimeout(() => {
                  webViewRef.current.reload();
                }, 100);
              }
            }}
            style={{
              backgroundColor: "#4a90e2",
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 5,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Go</Text>
          </TouchableOpacity>
        </View>

        {/* WebView */}
        <View style={{ flex: 1 }}>
          <WebView
            ref={webViewRef}
            key={browserUrl}
            source={{ uri: browserUrl }}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={handleWebViewMessage}
            onLoadStart={() => console.log("WebView loading:", browserUrl)}
            onLoad={() => console.log("WebView loaded successfully")}
            onError={(e) => console.error("WebView error:", e.nativeEvent)}
            injectedJavaScriptBeforeContentLoaded={`
              (function() {
                // Buffer polyfill for Solana SDK compatibility
                if (typeof window.Buffer === 'undefined') {
                  window.Buffer = {
                    from: function(data, encoding) {
                      if (typeof data === 'string') {
                        if (encoding === 'base64') {
                          const binary = atob(data);
                          const bytes = new Uint8Array(binary.length);
                          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                          return bytes;
                        } else if (encoding === 'hex') {
                          const bytes = new Uint8Array(data.length / 2);
                          for (let i = 0; i < data.length; i += 2) bytes[i / 2] = parseInt(data.substr(i, 2), 16);
                          return bytes;
                        }
                        // Default: UTF-8
                        const encoder = new TextEncoder();
                        return encoder.encode(data);
                      }
                      if (Array.isArray(data) || data instanceof Uint8Array) {
                        return new Uint8Array(data);
                      }
                      return new Uint8Array(0);
                    },
                    alloc: function(size) {
                      return new Uint8Array(size);
                    },
                    allocUnsafe: function(size) {
                      return new Uint8Array(size);
                    },
                    isBuffer: function(obj) {
                      return obj instanceof Uint8Array;
                    },
                    concat: function(list, totalLength) {
                      if (totalLength === undefined) {
                        totalLength = list.reduce((acc, arr) => acc + arr.length, 0);
                      }
                      const result = new Uint8Array(totalLength);
                      let offset = 0;
                      for (const arr of list) {
                        result.set(arr, offset);
                        offset += arr.length;
                      }
                      return result;
                    }
                  };
                  console.log('[WebView] Buffer polyfill installed');
                }

                // Intercept console.log/error and send to React Native
                const originalLog = console.log;
                const originalError = console.error;
                const originalWarn = console.warn;

                function sendToRN(type, args) {
                  try {
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'console',
                        level: type,
                        message: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
                      }));
                    }
                  } catch(e) {}
                }

                console.log = function() { sendToRN('log', arguments); originalLog.apply(console, arguments); };
                console.error = function() { sendToRN('error', arguments); originalError.apply(console, arguments); };
                console.warn = function() { sendToRN('warn', arguments); originalWarn.apply(console, arguments); };

                // Global error handler
                window.onerror = function(msg, url, line, col, error) {
                  sendToRN('error', ['UNCAUGHT ERROR:', msg, 'at', url, line, col, error ? error.stack : '']);
                  return false;
                };

                window.addEventListener('unhandledrejection', function(event) {
                  sendToRN('error', ['UNHANDLED PROMISE:', event.reason]);
                });

                console.log('[WebView] Console interceptor initialized');

                // Debug: Log all touch events to see if they're reaching the WebView
                document.addEventListener('touchstart', function(e) {
                  const target = e.target;
                  console.log('[TOUCH] touchstart on:', target.tagName, target.className, target.id || '(no id)');
                }, true);

                document.addEventListener('touchend', function(e) {
                  const target = e.target;
                  console.log('[TOUCH] touchend on:', target.tagName, target.className, target.id || '(no id)');
                }, true);

                document.addEventListener('click', function(e) {
                  const target = e.target;
                  console.log('[CLICK] click on:', target.tagName, target.className, target.id || '(no id)');
                }, true);

                // Create a promise-based request system
                let requestId = 0;
                const pendingRequests = {};

                // Listen for responses from React Native
                window.addEventListener('message', (event) => {
                  try {
                    const response = typeof event.data === 'string'
                      ? JSON.parse(event.data)
                      : event.data;

                    if (response.id && pendingRequests[response.id]) {
                      const { resolve, reject } = pendingRequests[response.id];

                      if (response.error) {
                        reject(new Error(response.error));
                      } else {
                        resolve(response.result);
                      }

                      delete pendingRequests[response.id];
                    }
                  } catch (err) {
                    console.error('Error processing message:', err);
                  }
                });

                // Helper function to send requests to React Native
                function sendRequest(method, params = {}) {
                  return new Promise((resolve, reject) => {
                    const id = ++requestId;
                    pendingRequests[id] = { resolve, reject };

                    const message = JSON.stringify({ id, method, params });
                    window.ReactNativeWebView.postMessage(message);

                    // Timeout after 30 seconds
                    setTimeout(() => {
                      if (pendingRequests[id]) {
                        delete pendingRequests[id];
                        reject(new Error('Request timeout'));
                      }
                    }, 30000);
                  });
                }

                // Create the window.x1 API
                window.x1 = {
                  isConnected: false,
                  publicKey: null,

                  // Connect to the wallet and get public key
                  connect: async function() {
                    try {
                      const result = await sendRequest('connect');
                      const pubKeyStr = result.publicKey;

                      // Helper to decode base58 to bytes
                      function decodeBase58(str) {
                        const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
                        const ALPHABET_MAP = {};
                        for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP[ALPHABET[i]] = i;
                        const bytes = [];
                        for (let i = 0; i < str.length; i++) {
                          let carry = ALPHABET_MAP[str[i]];
                          for (let j = 0; j < bytes.length; j++) {
                            carry += bytes[j] * 58;
                            bytes[j] = carry & 0xff;
                            carry >>= 8;
                          }
                          while (carry > 0) {
                            bytes.push(carry & 0xff);
                            carry >>= 8;
                          }
                        }
                        for (let i = 0; i < str.length && str[i] === '1'; i++) bytes.push(0);
                        return new Uint8Array(bytes.reverse());
                      }

                      // Create a BN-like object from bytes (for publicKey._bn compatibility)
                      function createBNFromBytes(bytes) {
                        // Convert bytes to array of 26-bit words (BN.js internal format)
                        const words = [];
                        let acc = 0;
                        let accBits = 0;
                        for (let i = bytes.length - 1; i >= 0; i--) {
                          acc |= bytes[i] << accBits;
                          accBits += 8;
                          while (accBits >= 26) {
                            words.push(acc & 0x3ffffff);
                            acc >>>= 26;
                            accBits -= 26;
                          }
                        }
                        if (accBits > 0 || words.length === 0) {
                          words.push(acc);
                        }
                        // Trim leading zeros
                        while (words.length > 1 && words[words.length - 1] === 0) {
                          words.pop();
                        }
                        return {
                          negative: 0,
                          words: words,
                          length: words.length,
                          red: null,
                          toArray: function(endian, length) {
                            const arr = Array.from(bytes);
                            if (endian === 'le') arr.reverse();
                            if (length && arr.length < length) {
                              const pad = new Array(length - arr.length).fill(0);
                              return endian === 'le' ? arr.concat(pad) : pad.concat(arr);
                            }
                            return arr;
                          },
                          toArrayLike: function(ArrayType, endian, length) {
                            const arr = this.toArray(endian, length);
                            return new ArrayType(arr);
                          },
                          toString: function(base) {
                            if (base === 16 || base === 'hex') {
                              return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
                            }
                            return pubKeyStr;
                          },
                          toNumber: function() {
                            let n = 0;
                            for (let i = 0; i < bytes.length && i < 6; i++) {
                              n = n * 256 + bytes[i];
                            }
                            return n;
                          },
                          cmp: function(other) {
                            const otherBytes = other.toArrayLike ? other.toArrayLike(Uint8Array, 'be', 32) : other;
                            for (let i = 0; i < 32; i++) {
                              if (bytes[i] < otherBytes[i]) return -1;
                              if (bytes[i] > otherBytes[i]) return 1;
                            }
                            return 0;
                          },
                          eq: function(other) { return this.cmp(other) === 0; },
                          lt: function(other) { return this.cmp(other) < 0; },
                          lte: function(other) { return this.cmp(other) <= 0; },
                          gt: function(other) { return this.cmp(other) > 0; },
                          gte: function(other) { return this.cmp(other) >= 0; },
                          isZero: function() { return bytes.every(b => b === 0); },
                          clone: function() { return createBNFromBytes(bytes); }
                        };
                      }

                      const pubKeyBytes = decodeBase58(pubKeyStr);
                      const pubKeyBN = createBNFromBytes(pubKeyBytes);

                      // Create a PublicKey-like object (compatible with Backpack/Phantom/Solana web3.js)
                      this.publicKey = {
                        _key: pubKeyStr,
                        _bn: pubKeyBN,
                        toString: function() { return this._key; },
                        toBase58: function() { return this._key; },
                        toJSON: function() { return this._key; },
                        toBytes: function() {
                          return decodeBase58(this._key);
                        },
                        toBuffer: function() {
                          // Return Uint8Array which is Buffer-compatible in browser
                          return decodeBase58(this._key);
                        },
                        equals: function(other) {
                          if (!other) return false;
                          const otherKey = typeof other === 'string' ? other :
                                          (other.toBase58 ? other.toBase58() :
                                          (other.toString ? other.toString() : String(other)));
                          return this._key === otherKey;
                        }
                      };
                      this.isConnected = true;

                      // Return in same format as Backpack/Phantom
                      return { publicKey: this.publicKey };
                    } catch (err) {
                      console.error('x1.connect error:', err);
                      throw err;
                    }
                  },

                  // Disconnect wallet
                  disconnect: async function() {
                    this.isConnected = false;
                    this.publicKey = null;
                    return true;
                  },

                  // Sign and send a transaction
                  signAndSendTransaction: async function(transaction, options = {}) {
                    try {
                      // Serialize the transaction to base64
                      let txData;
                      if (transaction.serialize) {
                        // If it's a Transaction object
                        const serialized = transaction.serialize({
                          requireAllSignatures: false,
                          verifySignatures: false
                        });
                        // Use btoa for browser environment (not Buffer.toString('base64'))
                        txData = btoa(String.fromCharCode.apply(null, serialized));
                      } else if (transaction instanceof Uint8Array) {
                        // If it's already serialized
                        txData = btoa(String.fromCharCode.apply(null, transaction));
                      } else {
                        throw new Error('Invalid transaction format');
                      }

                      const result = await sendRequest('signAndSendTransaction', {
                        transaction: txData,
                        options
                      });

                      return result;
                    } catch (err) {
                      console.error('x1.signAndSendTransaction error:', err);
                      throw err;
                    }
                  },

                  // Sign a transaction (without sending) - for multi-sig flows
                  signTransaction: async function(transaction) {
                    try {
                      console.log('[x1.signTransaction] Signing transaction...');
                      // Serialize the transaction to base64
                      let txData;
                      if (transaction.serialize) {
                        const serialized = transaction.serialize({
                          requireAllSignatures: false,
                          verifySignatures: false
                        });
                        // Use btoa for browser environment (not Buffer.toString('base64'))
                        txData = btoa(String.fromCharCode.apply(null, serialized));
                      } else if (transaction instanceof Uint8Array) {
                        txData = btoa(String.fromCharCode.apply(null, transaction));
                      } else {
                        throw new Error('Invalid transaction format');
                      }

                      const result = await sendRequest('signTransaction', {
                        transaction: txData
                      });

                      // Decode the signed transaction from base64
                      if (result.signedTransaction) {
                        const binary = atob(result.signedTransaction);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) {
                          bytes[i] = binary.charCodeAt(i);
                        }
                        // Return a transaction-like object that can be serialized
                        return {
                          serialize: function() { return bytes; },
                          _signedBytes: bytes
                        };
                      }
                      throw new Error('No signed transaction returned');
                    } catch (err) {
                      console.error('x1.signTransaction error:', err);
                      throw err;
                    }
                  },

                  // Sign a message
                  signMessage: async function(message) {
                    try {
                      // Encode the message to base64
                      let encodedMessage;
                      if (typeof message === 'string') {
                        encodedMessage = btoa(message);
                      } else if (message instanceof Uint8Array) {
                        encodedMessage = btoa(String.fromCharCode.apply(null, message));
                      } else {
                        throw new Error('Invalid message format');
                      }

                      const result = await sendRequest('signMessage', {
                        encodedMessage
                      });

                      return result.signature;
                    } catch (err) {
                      console.error('x1.signMessage error:', err);
                      throw err;
                    }
                  },

                  // Test function: Sign a message using memo transaction (for testing Ledger)
                  testSignMemo: async function(message) {
                    try {
                      console.log('[testSignMemo] Starting test with message:', message);

                      // Encode the message to base64
                      let encodedMessage;
                      if (typeof message === 'string') {
                        encodedMessage = btoa(message);
                      } else if (message instanceof Uint8Array) {
                        encodedMessage = btoa(String.fromCharCode.apply(null, message));
                      } else {
                        throw new Error('Invalid message format');
                      }

                      console.log('[testSignMemo] Encoded message:', encodedMessage);

                      const result = await sendRequest('testSignMemo', {
                        encodedMessage
                      });

                      console.log('[testSignMemo] Got result:', result);
                      return result;
                    } catch (err) {
                      console.error('x1.testSignMemo error:', err);
                      throw err;
                    }
                  }
                };

                console.log('window.x1 API initialized');

                // Also expose as window.x1_wallet for webapp compatibility
                window.x1_wallet = window.x1;
                console.log('window.x1_wallet alias initialized');
              })();
            `}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Show PIN setup screen
  if (authState === "setup") {
    return (
      <PinSetup
        password={password}
        onComplete={() => setAuthState("unlocked")}
      />
    );
  }

  // Show PIN unlock screen
  if (authState === "locked") {
    return (
      <PinUnlock
        onUnlock={(recoveredPassword) => {
          setPassword(recoveredPassword);
          setAuthState("unlocked");
        }}
      />
    );
  }

  // Show loading screen
  if (authState === "loading" || (authState === "unlocked" && !walletsLoaded)) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require("./assets/bg.png")}
          style={styles.loadingBackground}
          resizeMode="cover"
        />
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </View>
    );
  }

  // Check if we should show empty state when no wallets exist (but not when modals are open)
  const showWelcomeScreen =
    authState === "unlocked" &&
    walletsLoaded &&
    wallets.length === 0 &&
    !showCreateWalletModal &&
    !showAddWalletModal &&
    !showImportWalletModal;

  return (
    <>
      {showWelcomeScreen ? (
        <SafeAreaView style={styles.emptyStateContainer}>
          <StatusBar hidden={true} />
          <Image
            source={require("./assets/bg.png")}
            style={styles.emptyStateBackground}
            resizeMode="cover"
          />
          {/* Dark blue to transparent gradient overlay */}
          <LinearGradient
            colors={["#1a1a2e", "transparent"]}
            style={styles.emptyStateGradientOverlay}
          />
          <View
            style={[styles.emptyStateContent, { paddingTop: insets.top + 20 }]}
          >
            {/* Logo with blur background */}
            <View style={styles.emptyStateLogoContainer}>
              <Image
                source={require("./assets/x1-logo-with-blur.png")}
                style={styles.emptyStateLogoBlur}
                resizeMode="contain"
              />
              <Image
                source={require("./assets/x1-wallet.png")}
                style={styles.emptyStateLogo}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text style={styles.emptyStateTitle}>X1 Wallet</Text>

            {/* Buttons */}
            <View
              style={[
                styles.emptyStateButtons,
                { paddingBottom: insets.bottom + 20 },
              ]}
            >
              <TouchableOpacity
                style={styles.emptyStateCreateButton}
                onPress={async () => {
                  triggerHaptic();
                  await handleCreateNewWallet();
                }}
              >
                <Text style={styles.emptyStateCreateButtonText}>
                  Create Wallet
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.emptyStateImportButton}
                onPress={() => {
                  triggerHaptic();
                  setShowAddWalletModal(true);
                }}
              >
                <Text style={styles.emptyStateImportButtonText}>
                  Import Wallet
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaView
            style={[
              styles.container,
              { backgroundColor: easterEggMode ? "#111827" : "#000" },
            ]}
          >
            <StatusBar hidden={true} />
            {/* Top Header with Safe Area */}
            <View
              style={[
                styles.safeTopArea,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
            />
            <View
              style={[
                styles.topBar,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
            >
              {/* Wallet selector on the left */}
              <View style={styles.walletSelectorLeft}>
                <TouchableOpacity
                  testID="wallet-selector-button"
                  style={styles.walletDropdownButton}
                  onPress={() => {
                    triggerHaptic();
                    showWalletSelector();
                  }}
                >
                  <Image
                    source={currentNetwork.logo}
                    style={styles.x1LogoSmall}
                  />
                  <Text
                    style={styles.walletDropdownText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {selectedWallet?.name
                      ? selectedWallet.name.length > 10
                        ? `${selectedWallet.name.slice(0, 10)}...`
                        : selectedWallet.name
                      : wallets.length > 0
                        ? wallets[0].name.length > 10
                          ? `${wallets[0].name.slice(0, 10)}...`
                          : wallets[0].name
                        : "No wallet"}
                  </Text>
                  <Text style={styles.walletDropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* Network switch in the middle */}
              <View style={styles.quickSwitchContainer}>
                <TouchableOpacity
                  testID="x1-network-button"
                  style={[
                    styles.quickSwitchButton,
                    (currentNetwork.id === "X1" ||
                      currentNetwork.id === "X1_TESTNET") &&
                      styles.quickSwitchButtonActiveX1,
                  ]}
                  onPress={handleX1NetworkPress}
                >
                  <Image
                    source={require("./assets/x1.png")}
                    style={styles.quickSwitchIconX1}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  testID="solana-network-button"
                  style={[
                    styles.quickSwitchButton,
                    currentNetwork.id === "SOLANA" &&
                      styles.quickSwitchButtonActive,
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    switchNetwork(NETWORKS.find((n) => n.id === "SOLANA"));
                  }}
                >
                  <Image
                    source={require("./assets/solana.png")}
                    style={styles.quickSwitchIcon}
                  />
                </TouchableOpacity>
              </View>

              {/* Activity and Settings icons on the right */}
              <View style={styles.topBarRightIcons}>
                {/* Offline indicator */}
                {!isOnline && (
                  <TouchableOpacity
                    style={styles.offlineIndicator}
                    onPress={() => {
                      if (Platform.OS === "android") {
                        Linking.sendIntent("android.settings.WIFI_SETTINGS");
                      } else {
                        Linking.openURL("app-settings:");
                      }
                    }}
                  >
                    <Text style={styles.offlineIcon}>📡</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.activityIcon}
                  onPress={() => {
                    triggerHaptic();
                    checkTransactions();
                    activitySheetRef.current?.present();

                    // Triple-tap detection for auto-loading more transactions
                    const now = Date.now();
                    const recentTaps = activityTapTimes.filter(
                      (time) => now - time < 2000
                    );
                    const newTapTimes = [...recentTaps, now];
                    setActivityTapTimes(newTapTimes);

                    // If 3 taps within 2 seconds, auto-load more transactions
                    if (newTapTimes.length >= 3) {
                      if (hasMoreTransactions && !isLoadingMore) {
                        console.log(
                          "🎯 Triple-tap detected! Auto-loading more transactions..."
                        );
                        loadMoreTransactions();
                        if (Platform.OS === "android") {
                          ToastAndroid.show(
                            "Loading more transactions...",
                            ToastAndroid.SHORT
                          );
                        }
                      }
                      // Reset tap times after triggering
                      setActivityTapTimes([]);
                    }
                  }}
                >
                  <Image
                    source={require("./assets/clock.png")}
                    style={styles.activityIconImage}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.settingsIcon}
                  onPress={() => {
                    triggerHaptic();
                    console.log("Settings button pressed!");
                    console.log(
                      "Current showSettingsModal:",
                      showSettingsModal
                    );
                    console.log(
                      "Current settingsNavigationStack:",
                      settingsNavigationStack
                    );
                    setSettingsNavigationStack([]); // Reset navigation stack
                    setShowSettingsModal(true);
                    console.log("After setting showSettingsModal to true");
                  }}
                >
                  <Image
                    source={require("./assets/settings.png")}
                    style={styles.settingsIconImage}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Main Scrollable Content */}
            <ScrollView
              style={[
                styles.mainContent,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
              contentContainerStyle={styles.mainContentContainer}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#4A90E2"
                  colors={["#4A90E2"]}
                />
              }
            >
              {/* Balance Section with all content */}
              <View
                style={[
                  styles.balanceSection,
                  { backgroundColor: easterEggMode ? "#111827" : "#000" },
                ]}
              >
                {/* Balance display - shown for all chains */}
                {currentNetwork && (
                  <TouchableOpacity
                    style={styles.balanceContent}
                    onPress={handleBalanceTap}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.balanceUSD}>{balanceUSD}</Text>
                    <Text
                      style={[
                        styles.balanceChange,
                        {
                          color:
                            portfolioGainLoss.valueChange > 0
                              ? "#00D084"
                              : portfolioGainLoss.valueChange < 0
                                ? "#FF6B6B"
                                : "#999999",
                        },
                      ]}
                    >
                      {portfolioGainLoss.valueChange !== 0
                        ? `${portfolioGainLoss.valueChange > 0 ? "+" : ""}$${Math.abs(
                            portfolioGainLoss.valueChange
                          ).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} (${portfolioGainLoss.percentChange > 0 ? "+" : ""}${portfolioGainLoss.percentChange.toFixed(
                            2
                          )}%)`
                        : "$0.00 (0.00%)"}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.actionCircle}
                    onPress={() => {
                      if (hapticMode) {
                        triggerHaptic();
                        animateButtonPress(receiveScale);
                      }
                      handleReceive();
                    }}
                  >
                    <Animated.View
                      style={[
                        styles.actionCircleBg,
                        hapticMode && styles.actionCircleBgEnhanced,
                        { backgroundColor: hapticMode ? "#4A90E2" : "#1a1a1a" },
                        hapticMode && { transform: [{ scale: receiveScale }] },
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionCircleIcon,
                          !hapticMode && { color: "#4A90E2" },
                        ]}
                      >
                        ▼
                      </Text>
                    </Animated.View>
                    <Text style={styles.actionCircleText}>Receive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCircle}
                    onPress={() => {
                      if (hapticMode) {
                        triggerHaptic();
                        animateButtonPress(sendScale);
                      }
                      handleSend();
                    }}
                  >
                    <Animated.View
                      style={[
                        styles.actionCircleBg,
                        hapticMode && styles.actionCircleBgEnhanced,
                        { backgroundColor: hapticMode ? "#E8A951" : "#1a1a1a" },
                        hapticMode && { transform: [{ scale: sendScale }] },
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionCircleIcon,
                          !hapticMode && { color: "#4A90E2" },
                        ]}
                      >
                        ▲
                      </Text>
                    </Animated.View>
                    <Text style={styles.actionCircleText}>Send</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCircle}
                    onPress={() => {
                      if (hapticMode) {
                        triggerHaptic();
                        animateButtonPress(swapScale);
                      }
                      handleSwap();
                    }}
                  >
                    <Animated.View
                      style={[
                        styles.actionCircleBg,
                        hapticMode && styles.actionCircleBgEnhanced,
                        { backgroundColor: hapticMode ? "#9B59B6" : "#1a1a1a" },
                        hapticMode && { transform: [{ scale: swapScale }] },
                      ]}
                    >
                      <Image
                        source={require("./assets/swap.png")}
                        style={[
                          styles.swapIcon,
                          !hapticMode && { tintColor: "#4A90E2" },
                        ]}
                      />
                    </Animated.View>
                    <Text style={styles.actionCircleText}>Swap</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCircle}
                    onPress={() => {
                      if (hapticMode) {
                        triggerHaptic();
                        animateButtonPress(stakeScale);
                      }
                      handleStake();
                    }}
                  >
                    <Animated.View
                      style={[
                        styles.actionCircleBg,
                        hapticMode && styles.actionCircleBgEnhanced,
                        { backgroundColor: hapticMode ? "#2ECC71" : "#1a1a1a" },
                        hapticMode && { transform: [{ scale: stakeScale }] },
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionCircleIcon,
                          !hapticMode && { color: "#4A90E2" },
                        ]}
                      >
                        ◈
                      </Text>
                    </Animated.View>
                    <Text style={styles.actionCircleText}>Stake</Text>
                  </TouchableOpacity>
                </View>

                {/* Token List - Use GraphQL for Solana, REST for others */}
                {selectedWallet &&
                currentNetwork &&
                currentNetwork.providerId.startsWith("SOLANA") ? (
                  <View style={styles.tokenSection}>
                    <TokenBalances
                      address={selectedWallet.publicKey}
                      providerId={currentNetwork.providerId}
                      pollingIntervalSeconds={60}
                      enableColorfulIcons={easterEggMode}
                      hideZeroBalanceTokens={
                        selectedWallet.hideZeroBalanceTokens || false
                      }
                      onBalanceUpdate={handleBalanceUpdate}
                      onItemClick={handleTokenClick}
                    />
                  </View>
                ) : (
                  <View style={styles.tokenSection}>
                    {tokens.map((token) => {
                      return (
                        <View
                          key={token.id}
                          style={[
                            styles.tokenRow,
                            hapticMode && styles.tokenRowEnhanced,
                          ]}
                        >
                          <View style={styles.tokenLeft}>
                            <TokenIcon
                              symbol={token.symbol || token.name}
                              logo={token.logo}
                              logoUrl={token.logoUrl}
                              size={50}
                              imageStyle={styles.x1LogoLarge}
                            />
                            <View style={styles.tokenInfo}>
                              <Text style={styles.tokenNameLarge}>
                                {token.name}
                              </Text>
                              <Text style={styles.tokenBalanceSmall}>
                                {token.balance} {token.symbol || token.name}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.tokenRight}>
                            <Text style={styles.tokenUsdLarge}>
                              ${token.usdValue}
                            </Text>
                            <Text style={styles.tokenChange}>+$0.00</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Bottom Tab Bar */}
            <View
              style={[
                styles.bottomTabBar,
                { paddingBottom: Math.max(insets.bottom, 8) },
              ]}
            >
              <TouchableOpacity
                style={styles.bottomTabItem}
                onPress={() => {
                  setCurrentBottomTab("portfolio");
                  setShowTestBrowser(false);
                }}
              >
                <Image
                  source={require("./assets/pie-chart-icon.png")}
                  style={[
                    styles.bottomTabIconImage,
                    currentBottomTab === "portfolio" &&
                      styles.bottomTabIconImageActive,
                  ]}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.bottomTabText,
                    currentBottomTab === "portfolio" &&
                      styles.bottomTabTextActive,
                  ]}
                >
                  Portfolio
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomTabItem}
                onPress={() => {
                  setCurrentBottomTab("swap");
                  handleSwap();
                }}
              >
                <Image
                  source={require("./assets/swap.png")}
                  style={[
                    styles.bottomTabIconImage,
                    currentBottomTab === "swap" &&
                      styles.bottomTabIconImageActive,
                  ]}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.bottomTabText,
                    currentBottomTab === "swap" && styles.bottomTabTextActive,
                  ]}
                >
                  Swap
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomTabItem}
                onPress={() => {
                  setCurrentBottomTab("browser");
                  setShowTestBrowser(true);
                }}
              >
                <Image
                  source={require("./assets/browser.png")}
                  style={styles.bottomTabIconImage}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.bottomTabText,
                    currentBottomTab === "browser" &&
                      styles.bottomTabTextActive,
                  ]}
                >
                  Browser
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Network Selector Side Drawer */}
          <SimpleActionSheet
            ref={networkSheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <View
              style={[
                styles.bottomSheetContent,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
            >
              {/* Header */}
              <View style={styles.bottomSheetHeader}>
                <TouchableOpacity
                  onPress={() => networkSheetRef.current?.dismiss()}
                >
                  <Text style={styles.bottomSheetClose}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.bottomSheetTitle}>Select Network</Text>
                <View style={{ width: 24 }} />
              </View>

              {/* Network List */}
              <ScrollView style={styles.networkList}>
                {NETWORKS.map((network) => (
                  <TouchableOpacity
                    key={network.id}
                    style={[
                      styles.networkItem,
                      currentNetwork.id === network.id &&
                        styles.networkItemSelected,
                    ]}
                    onPress={() => switchNetwork(network)}
                  >
                    <Image
                      source={network.logo}
                      style={styles.networkItemIcon}
                    />
                    <Text style={styles.networkItemText}>{network.name}</Text>
                    {currentNetwork.id === network.id && (
                      <Text style={styles.networkItemCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </SimpleActionSheet>

          {/* Bluetooth Devices Drawer */}
          {showBluetoothDrawer && (
            <Modal
              visible={showBluetoothDrawer}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowBluetoothDrawer(false)}
            >
              <Pressable
                style={styles.networkDrawerOverlay}
                onPress={() => setShowBluetoothDrawer(false)}
              >
                <Pressable
                  style={styles.networkDrawerContent}
                  onPress={(e) => e.stopPropagation()}
                >
                  <View style={styles.networkDrawerContentArea}>
                    {/* Header */}
                    <View style={styles.networkDrawerHeader}>
                      <Text style={styles.networkDrawerTitle}>
                        Bluetooth Devices
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowBluetoothDrawer(false)}
                      >
                        <Text style={styles.networkDrawerClose}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Device List */}
                    <ScrollView style={styles.networkList}>
                      {pairedDevices.length === 0 ? (
                        <View style={styles.emptyBluetoothList}>
                          <Text style={styles.emptyBluetoothText}>
                            No paired Bluetooth devices found
                          </Text>
                          <Text style={styles.emptyBluetoothSubtext}>
                            Connect to a Ledger device to see it here
                          </Text>
                        </View>
                      ) : (
                        pairedDevices.map((device) => (
                          <View
                            key={device.id}
                            style={styles.bluetoothDeviceItem}
                          >
                            <View style={styles.bluetoothDeviceInfo}>
                              <Text style={styles.bluetoothDeviceName}>
                                {device.name}
                              </Text>
                              <Text style={styles.bluetoothDeviceAddress}>
                                {device.address}
                              </Text>
                              {device.isConnected && (
                                <Text style={styles.bluetoothDeviceConnected}>
                                  Connected
                                </Text>
                              )}
                            </View>
                            <View style={styles.bluetoothDeviceButtons}>
                              <TouchableOpacity
                                style={styles.bluetoothDeviceDeleteButton}
                                onPress={() => forgetBluetoothDevice(device.id)}
                              >
                                <Text style={styles.bluetoothDeviceDeleteText}>
                                  Forget
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}
                    </ScrollView>

                    {/* Scan Button */}
                    <TouchableOpacity
                      style={styles.bluetoothRefreshButton}
                      onPress={async () => {
                        setShowBluetoothDrawer(false);
                        ledgerSheetRef.current?.present();
                        await scanForLedger();
                      }}
                    >
                      <Text style={styles.bluetoothRefreshButtonText}>
                        Scan
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
          )}

          {/* Wallet Selector Bottom Sheet */}
          <SimpleActionSheet
            ref={bottomSheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <ScrollView
              testID="wallet-list-sheet"
              contentContainerStyle={[
                styles.bottomSheetScrollContent,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={styles.bottomSheetHeader}>
                <TouchableOpacity
                  onPress={() => bottomSheetRef.current?.dismiss()}
                >
                  <Text style={styles.bottomSheetClose}>✕</Text>
                </TouchableOpacity>
                <View style={styles.bottomSheetTitleContainer}>
                  <Text style={styles.bottomSheetTitle}>Wallets</Text>
                  <Text style={styles.bottomSheetNetworkBadge}>
                    {currentNetwork.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleAddWallet}>
                  <Text style={styles.bottomSheetAdd}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Wallets List */}
              <View style={styles.bottomSheetList}>
                {wallets.map((wallet, index) => (
                  <TouchableOpacity
                    key={wallet.id}
                    testID={`wallet-item-${wallet.id}`}
                    style={[
                      styles.bottomSheetWalletItem,
                      wallet.selected && styles.bottomSheetWalletItemSelected,
                    ]}
                    onPress={() => selectWallet(wallet)}
                  >
                    <View style={styles.bottomSheetWalletLeft}>
                      <Image
                        source={currentNetwork.logo}
                        style={styles.x1LogoLarge}
                      />
                      <View style={styles.bottomSheetWalletInfo}>
                        <Text style={styles.bottomSheetWalletName}>
                          {wallet.name}
                        </Text>
                        <Text style={styles.bottomSheetWalletAddress}>
                          {copiedWalletId === wallet.id ? (
                            "Copied"
                          ) : (
                            <>
                              {wallet.publicKey.slice(0, 12)}
                              <Text style={{ fontSize: 14.4 }}>...</Text>
                              {wallet.publicKey.slice(-12)}
                            </>
                          )}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.bottomSheetWalletRight}>
                      <TouchableOpacity
                        testID={
                          index === 0
                            ? "first-wallet-copy-button"
                            : `wallet-copy-button-${wallet.id}`
                        }
                        style={styles.bottomSheetCopyBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          Clipboard.setString(wallet.publicKey);
                          setCopiedWalletId(wallet.id);
                          setTimeout(() => {
                            setCopiedWalletId(null);
                          }, 3000);
                        }}
                      >
                        <Text style={styles.bottomSheetCopyIcon}>⧉</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={
                          index === 0
                            ? "first-wallet-menu-button"
                            : `wallet-menu-button-${wallet.id}`
                        }
                        style={styles.bottomSheetEditBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          setEditingWallet(wallet);
                          setEditWalletName(wallet.name);
                          editWalletSheetRef.current?.present();
                        }}
                      >
                        <Text style={styles.bottomSheetEditIcon}>⋮</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </SimpleActionSheet>

          {/* Account Selector Side Drawer */}
          <SimpleActionSheet
            ref={accountSheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <View
              style={[
                styles.bottomSheetContent,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
            >
              {/* Header */}
              <View style={styles.bottomSheetHeader}>
                <TouchableOpacity
                  onPress={() => accountSheetRef.current?.dismiss()}
                >
                  <Text style={styles.bottomSheetClose}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.bottomSheetTitle}>Select Account</Text>
                <View style={{ width: 24 }} />
              </View>

              {/* Account List */}
              <ScrollView style={styles.accountList}>
                {accounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    style={[
                      styles.accountItem,
                      account.selected && styles.accountItemSelected,
                    ]}
                    onPress={() => selectAccount(account)}
                  >
                    <View
                      style={[
                        styles.accountBadge,
                        { backgroundColor: account.badgeColor },
                      ]}
                    >
                      <Text style={styles.accountBadgeText}>
                        {account.badge}
                      </Text>
                    </View>
                    <Text style={styles.accountItemText}>{account.name}</Text>
                    {account.selected && (
                      <Text style={styles.accountItemCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Add New Account Button */}
              <TouchableOpacity style={styles.addAccountButton}>
                <Text style={styles.addAccountButtonText}>+ New Account</Text>
              </TouchableOpacity>
            </View>
          </SimpleActionSheet>

          {/* Debug Console - Full Page */}
          <Modal
            visible={showDebugDrawer}
            transparent={false}
            animationType="slide"
            onRequestClose={() => setShowDebugDrawer(false)}
          >
            <SafeAreaView style={styles.debugFullPageContainer}>
              {/* Header */}
              <View style={styles.debugFullPageHeader}>
                <Text style={styles.debugFullPageTitle}>Debug Console</Text>
                <TouchableOpacity onPress={() => setShowDebugDrawer(false)}>
                  <Text style={styles.debugFullPageClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Debug Logs */}
              <ScrollView
                style={styles.debugLogList}
                showsVerticalScrollIndicator={true}
              >
                {debugLogs.length === 0 ? (
                  <Text style={styles.debugNoLogs}>No logs yet...</Text>
                ) : (
                  debugLogs.map((log, index) => (
                    <Text key={index} style={styles.debugLogText}>
                      {log}
                    </Text>
                  ))
                )}
              </ScrollView>

              {/* Clear Button */}
              <View style={styles.debugFullPageFooter}>
                <TouchableOpacity
                  style={styles.debugClearButton}
                  onPress={() => setDebugLogs([])}
                >
                  <Text style={styles.debugClearButtonText}>Clear Logs</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>

          {/* Receive Drawer */}
          <SimpleActionSheet
            ref={receiveSheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <View
              style={[
                styles.bottomSheetContent,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
            >
              {/* Header */}
              <View style={styles.bottomSheetHeader}>
                <Text style={styles.bottomSheetTitle}>
                  Receive {getNativeTokenInfo().symbol}
                </Text>
                <TouchableOpacity
                  onPress={() => receiveSheetRef.current?.dismiss()}
                >
                  <Text style={styles.bottomSheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* QR Code */}
              <View style={styles.receiveQRContainer}>
                <View style={styles.receiveQRWrapper}>
                  <QRCode
                    value={selectedWallet?.publicKey || "No wallet"}
                    size={200}
                    backgroundColor="white"
                    color="black"
                  />
                </View>
              </View>

              {/* Address */}
              <View style={styles.receiveAddressContainer}>
                <Text style={styles.receiveAddressLabel}>Your Address</Text>
                <Text
                  style={styles.receiveAddressText}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                >
                  {addressCopied
                    ? "Copied!"
                    : selectedWallet?.publicKey || "No wallet selected"}
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
          </SimpleActionSheet>

          {/* Send Drawer */}
          <SimpleActionSheet
            ref={sendSheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <View
              style={[
                styles.bottomSheetContent,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
            >
              {/* Header */}
              <View style={styles.bottomSheetHeader}>
                <TouchableOpacity
                  onPress={() => sendSheetRef.current?.dismiss()}
                >
                  <Text style={styles.bottomSheetClose}>✕</Text>
                </TouchableOpacity>
                <View style={styles.bottomSheetTitleContainer}>
                  <Text style={styles.bottomSheetTitle}>
                    Send {getNativeTokenInfo().symbol}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleOpenQRScanner}>
                  <Image
                    source={require("./assets/scan2.png")}
                    style={styles.scanIcon}
                  />
                </TouchableOpacity>
              </View>

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
                    onPress={() => addressSheetRef.current?.present()}
                  >
                    <Text style={styles.sendSelectAddressText}>
                      Select Address
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  ref={sendAddressInputRef}
                  style={styles.sendInput}
                  placeholder="Enter address..."
                  placeholderTextColor="#666666"
                  value={sendAddress}
                  onChangeText={(text) => {
                    setSendAddress(text);
                    setAddressSelection(null); // Clear selection control when user types
                  }}
                  selection={addressSelection}
                  autoCapitalize="none"
                  textAlign="left"
                />
              </View>

              {/* Send Button */}
              <TouchableOpacity
                style={styles.sendSubmitButton}
                onPress={() => handleSendSubmit(sendAmount, sendAddress)}
              >
                <Text style={styles.sendSubmitButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </SimpleActionSheet>

          {/* Address Selector Modal */}
          <SimpleActionSheet
            ref={addressSheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <View
              style={[
                styles.bottomSheetContent,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
            >
              {/* Header */}
              <View style={styles.bottomSheetHeader}>
                <Text style={styles.bottomSheetTitle}>Select Address</Text>
                <TouchableOpacity
                  onPress={() => addressSheetRef.current?.dismiss()}
                >
                  <Text style={styles.bottomSheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Address List */}
              <ScrollView style={styles.addressList}>
                {wallets.map((wallet, index) => (
                  <TouchableOpacity
                    key={wallet.id}
                    style={styles.addressItem}
                    testID={
                      index === 0
                        ? "first-address-selector-wallet"
                        : `address-selector-wallet-${index}`
                    }
                    onPress={() => {
                      setSendAddress(wallet.publicKey);
                      addressSheetRef.current?.dismiss();
                    }}
                  >
                    <View style={styles.addressItemContent}>
                      <Text style={styles.addressItemName}>{wallet.name}</Text>
                      <Text style={styles.addressItemAddress} numberOfLines={1}>
                        {wallet.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </SimpleActionSheet>

          {/* Activity Drawer */}
          {/* Activity Bottom Sheet */}
          <SimpleActionSheet
            ref={activitySheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            {/* Activity List with BottomSheetScrollView */}
            <ScrollView
              contentContainerStyle={
                transactions.length === 0
                  ? styles.emptyStateScrollContent
                  : styles.sheetScrollContent
              }
              showsVerticalScrollIndicator={false}
              onScroll={({ nativeEvent }) => {
                if (!hasMoreTransactions || isLoadingMore) return;

                const { layoutMeasurement, contentOffset, contentSize } =
                  nativeEvent;
                // Trigger auto-load when user scrolls to bottom 600px (roughly when Load More button becomes visible)
                const paddingToBottom = 600;
                const isNearBottom =
                  layoutMeasurement.height + contentOffset.y >=
                  contentSize.height - paddingToBottom;

                if (isNearBottom) {
                  loadMoreTransactions();
                }
              }}
              scrollEventThrottle={500}
            >
              {/* Header */}
              <View style={styles.activitySheetHeader}>
                <TouchableOpacity onPress={() => checkTransactions()}>
                  <Text style={styles.sheetHeaderButton}>↻</Text>
                </TouchableOpacity>
                <Text style={styles.activitySheetTitle}>Activity</Text>
                <TouchableOpacity
                  onPress={() => activitySheetRef.current?.dismiss()}
                >
                  <Text style={styles.sheetHeaderButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Transactions List */}
              {isIndexing ? (
                <>
                  <View style={styles.emptyStateSpacer} />
                  <View style={styles.emptyStateContainer}>
                    <ActivityIndicator size="large" color="#4A90E2" />
                    <Text style={[styles.emptyStateText, { marginTop: 20 }]}>
                      {indexingMessage}
                    </Text>
                  </View>
                </>
              ) : transactions.length === 0 ? (
                <>
                  <View style={styles.emptyStateSpacer} />
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateText}>
                      {indexingMessage || "No transactions yet"}
                    </Text>
                    <Text style={styles.emptyStateSubtext}>
                      Your transaction history will appear here
                    </Text>
                  </View>
                </>
              ) : (
                transactions.map((group) => (
                  <View key={group.date}>
                    {/* Date header */}
                    <Text style={styles.activityDateHeader}>{group.date}</Text>

                    {/* Transactions for this date */}
                    {group.transactions.map((tx) => (
                      <TouchableOpacity
                        key={tx.id}
                        style={styles.activityCard}
                        onPress={() => openExplorer(tx.signature)}
                      >
                        {/* Token logo */}
                        <TokenIcon
                          symbol={tx.token}
                          logo={
                            tx.token === "XNT"
                              ? require("./assets/x1.png")
                              : tx.token === "SOL"
                                ? require("./assets/solana.png")
                                : null
                          }
                          logoUrl={tx.tokenIcon}
                          size={40}
                        />

                        <View style={styles.activityCardContent}>
                          {/* First row: Type and Amount */}
                          <View style={styles.activityCardHeader}>
                            <View style={styles.activityCardTitleContainer}>
                              <Text style={styles.activityCardTitle}>
                                {tx.type === "received" ? "Received" : "Sent"}
                              </Text>
                              <Text style={styles.activityCardAddressLabel}>
                                {tx.type === "received" ? "from" : "to"}:{" "}
                                {tx.signature?.substring(0, 8)}...
                                {tx.signature?.substring(
                                  tx.signature.length - 4
                                )}
                              </Text>
                            </View>
                            <View style={styles.activityCardValueContainer}>
                              <Text
                                style={[
                                  styles.activityCardAmount,
                                  {
                                    color:
                                      tx.type === "received"
                                        ? "#00D084"
                                        : "#FFFFFF",
                                  },
                                ]}
                              >
                                {tx.type === "received" ? "+" : "-"}
                                {tx.amount} {tx.token}
                              </Text>
                              {tx.valueUSD && (
                                <Text style={styles.activityCardValueUSD}>
                                  ≈ ${tx.valueUSD}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}

              {/* Load More Button */}
              {!isLoadingMore &&
                hasMoreTransactions &&
                transactions.length > 0 && (
                  <TouchableOpacity
                    style={{
                      padding: 15,
                      margin: 20,
                      backgroundColor: "#4A90E2",
                      borderRadius: 8,
                      alignItems: "center",
                    }}
                    onPress={loadMoreTransactions}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Load More Transactions
                    </Text>
                  </TouchableOpacity>
                )}

              {/* Loading More Indicator */}
              {isLoadingMore &&
                hasMoreTransactions &&
                transactions.length > 0 && (
                  <View
                    style={{
                      padding: 20,
                      marginVertical: 10,
                      alignItems: "center",
                      backgroundColor: "rgba(74, 144, 226, 0.1)",
                      borderRadius: 12,
                      marginHorizontal: 20,
                    }}
                  >
                    <ActivityIndicator size="large" color="#4A90E2" />
                    <Text
                      style={{
                        marginTop: 12,
                        color: "#4A90E2",
                        fontSize: 15,
                        fontWeight: "600",
                      }}
                    >
                      Loading more transactions...
                    </Text>
                    <Text
                      style={{
                        marginTop: 4,
                        color: "#888888",
                        fontSize: 13,
                      }}
                    >
                      Checking database and blockchain
                    </Text>
                  </View>
                )}

              {/* End of List Indicator */}
              {!hasMoreTransactions &&
                transactions.length > 0 &&
                !isLoadingMore && (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <Text style={styles.emptyStateSubtext}>
                      No more transactions
                    </Text>
                  </View>
                )}
            </ScrollView>
          </SimpleActionSheet>

          {/* Add Wallet Modal - Choice */}
          <Modal
            visible={showAddWalletModal}
            transparent={true}
            animationType="slide"
          >
            <Pressable
              style={styles.settingsDrawerOverlay}
              onPress={() => setShowAddWalletModal(false)}
            >
              <Pressable
                style={[
                  styles.settingsDrawerContent,
                  { backgroundColor: easterEggMode ? "#111827" : "#000" },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.settingsDrawerContentArea}>
                  <View style={styles.settingsDrawerHeader}>
                    <View style={{ width: 32 }} />
                    <Text style={styles.settingsDrawerTitle}>Add Wallet</Text>
                    <TouchableOpacity
                      onPress={() => setShowAddWalletModal(false)}
                    >
                      <Text style={styles.settingsDrawerClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.walletOptionButton}
                    onPress={handleCreateNewWallet}
                  >
                    <Text style={styles.walletOptionText}>
                      Create New Wallet
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.walletOptionButton}
                    onPress={handleShowImportWallet}
                  >
                    <Text style={styles.walletOptionText}>Import Wallet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.walletOptionButton}
                    onPress={handleShowLedger}
                  >
                    <Text style={styles.walletOptionText}>Connect Ledger</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Create Wallet Modal - Display Seed Phrase */}
          <Modal
            visible={showCreateWalletModal}
            transparent={true}
            animationType="slide"
          >
            <Pressable
              style={styles.settingsDrawerOverlay}
              onPress={() => {
                if (!isInitialSetup) {
                  setShowCreateWalletModal(false);
                } else {
                  Toast.show({
                    type: "error",
                    text1: "Setup Required",
                    text2: "Please save your master seed phrase to continue",
                    position: "bottom",
                  });
                }
              }}
            >
              <Pressable
                style={[
                  styles.settingsDrawerContent,
                  { backgroundColor: easterEggMode ? "#111827" : "#000" },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.settingsDrawerContentArea}>
                  <View style={styles.settingsDrawerHeader}>
                    <View style={{ width: 32 }} />
                    <Text style={styles.settingsDrawerTitle}>
                      Create Wallet
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (isInitialSetup) {
                          // Don't allow closing during initial setup
                          Toast.show({
                            type: "error",
                            text1: "Setup Required",
                            text2:
                              "Please save your master seed phrase to continue",
                            position: "bottom",
                          });
                        } else {
                          setShowCreateWalletModal(false);
                        }
                      }}
                    >
                      <Text style={styles.settingsDrawerClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.seedPhraseTitle}>
                    {isInitialSetup
                      ? "Your Master Seed Phrase"
                      : "Your Seed Phrase"}
                  </Text>
                  <View style={styles.seedPhraseContainer}>
                    <TouchableOpacity
                      style={styles.seedPhraseCopyBtnInside}
                      onPress={copySeedPhrase}
                    >
                      <Text
                        style={[
                          styles.seedPhraseCopyIconInside,
                          { fontSize: 20.4 },
                        ]}
                      >
                        ⧉
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.seedPhraseGrid}>
                      {newMnemonic && newMnemonic.trim()
                        ? newMnemonic.split(" ").map((word, index) => (
                            <View key={index} style={styles.seedPhraseWord}>
                              <Text style={styles.seedPhraseText}>
                                {index + 1}. {word}
                              </Text>
                            </View>
                          ))
                        : null}
                    </View>
                  </View>
                  <Text style={styles.seedPhraseWarning}>
                    {isInitialSetup
                      ? "This is your master seed phrase. Save it securely in a safe place. You'll need it to recover all your wallets. All future wallets will be derived from this seed phrase."
                      : "Save this seed phrase securely. You'll need it to recover your wallet."}
                  </Text>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleConfirmCreateWallet}
                  >
                    <Text style={styles.confirmButtonText}>
                      {isInitialSetup
                        ? "I've Saved My Master Seed Phrase"
                        : "I've Saved My Seed Phrase"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Ledger Adding Accounts Progress Modal */}
          <Modal
            visible={ledgerAddingAccounts}
            transparent={true}
            animationType="fade"
          >
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0, 0, 0, 0.85)",
              }}
            >
              <View
                style={{
                  backgroundColor: easterEggMode ? "#1a1a2e" : "#1a1a1a",
                  borderRadius: 16,
                  padding: 32,
                  alignItems: "center",
                  minWidth: 280,
                  borderWidth: 2,
                  borderColor: "#4A90E2",
                }}
              >
                {/* Animated spinner */}
                <ActivityIndicator size="large" color="#4A90E2" />

                {/* Progress text */}
                <Text
                  style={{
                    color: "#FFF",
                    fontSize: 18,
                    fontWeight: "600",
                    marginTop: 20,
                    textAlign: "center",
                  }}
                >
                  Adding Accounts
                </Text>

                <Text
                  style={{
                    color: "#4A90E2",
                    fontSize: 24,
                    fontWeight: "bold",
                    marginTop: 12,
                  }}
                >
                  {ledgerAddProgress.current} / {ledgerAddProgress.total}
                </Text>

                {/* Progress bar */}
                <View
                  style={{
                    width: 200,
                    height: 6,
                    backgroundColor: "rgba(74, 144, 226, 0.2)",
                    borderRadius: 3,
                    marginTop: 16,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${(ledgerAddProgress.current / ledgerAddProgress.total) * 100}%`,
                      height: "100%",
                      backgroundColor: "#4A90E2",
                    }}
                  />
                </View>

                <Text
                  style={{
                    color: "rgba(255, 255, 255, 0.6)",
                    fontSize: 12,
                    marginTop: 16,
                    textAlign: "center",
                  }}
                >
                  Please wait while we add your accounts...
                </Text>
              </View>
            </View>
          </Modal>

          {/* Import Wallet Modal */}
          <Modal
            visible={showImportWalletModal}
            transparent={true}
            animationType="slide"
          >
            <Pressable
              style={styles.settingsDrawerOverlay}
              onPress={() => {
                setShowImportWalletModal(false);
                setPhraseWords(Array(12).fill(""));
                setPhraseDisclaimerAccepted(false);
                setUse24Words(false);
              }}
            >
              <Pressable
                style={[
                  styles.settingsDrawerContent,
                  { backgroundColor: easterEggMode ? "#111827" : "#000" },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.settingsDrawerContentArea}>
                  <View style={styles.settingsDrawerHeader}>
                    <View style={{ width: 32 }} />
                    <Text style={styles.settingsDrawerTitle}>
                      Import Wallet
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowImportWalletModal(false);
                        setImportPrivateKey("");
                      }}
                    >
                      <Text style={styles.settingsDrawerClose}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.importInput}
                    placeholder="Enter your private key (bs58 or JSON array)"
                    placeholderTextColor="#666666"
                    value={importPrivateKey}
                    onChangeText={setImportPrivateKey}
                    multiline
                    numberOfLines={4}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleImportWallet}
                  >
                    <Text style={styles.confirmButtonText}>Import Wallet</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Edit Wallet Modal */}
          <SimpleActionSheet
            ref={editWalletSheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <View testID="edit-wallet-sheet" style={styles.bottomSheetContent}>
              <View style={styles.bottomSheetHeader}>
                <View style={{ width: 32 }} />
                <Text style={styles.bottomSheetTitle}>Edit Wallet</Text>
                <TouchableOpacity
                  onPress={() => {
                    editWalletSheetRef.current?.dismiss();
                    setEditingWallet(null);
                  }}
                >
                  <Text style={styles.bottomSheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Menu Items */}
              <ScrollView style={styles.settingsMenuList}>
                <TouchableOpacity
                  testID="change-account-name-button"
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    editWalletSheetRef.current?.dismiss();
                    setShowChangeNameModal(true);
                  }}
                >
                  <Text style={styles.settingsMenuItemText}>
                    Change Account Name
                  </Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>

                {/* Hide Zero Balance Tokens Toggle */}
                <View
                  testID="hide-zero-balance-toggle"
                  style={styles.settingsMenuItem}
                >
                  <Text style={styles.settingsMenuItemText}>
                    Hide Zero Balance Tokens
                  </Text>
                  <Switch
                    value={editingWallet?.hideZeroBalanceTokens || false}
                    onValueChange={(value) => {
                      if (editingWallet) {
                        // Update states immediately for instant UI response
                        const updatedEditingWallet = {
                          ...editingWallet,
                          hideZeroBalanceTokens: value,
                        };
                        setEditingWallet(updatedEditingWallet);

                        // Update selected wallet immediately if it's the one being edited
                        if (selectedWallet?.id === editingWallet.id) {
                          setSelectedWallet({
                            ...selectedWallet,
                            hideZeroBalanceTokens: value,
                          });
                        }

                        // Update wallets array and save to storage in background
                        const updatedWallets = wallets.map((w) =>
                          w.id === editingWallet.id
                            ? { ...w, hideZeroBalanceTokens: value }
                            : w
                        );
                        setWallets(updatedWallets);
                        saveWalletsToStorage(updatedWallets);
                      }
                    }}
                    trackColor={{ false: "#767577", true: "#4A90E2" }}
                    thumbColor={
                      editingWallet?.hideZeroBalanceTokens
                        ? "#ffffff"
                        : "#f4f3f4"
                    }
                  />
                </View>

                <TouchableOpacity
                  testID="show-private-key-button"
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    editWalletSheetRef.current?.dismiss();
                    setTimeout(() => {
                      setShowAuthForPrivateKey(true);
                    }, 100);
                  }}
                >
                  <Text style={styles.settingsMenuItemText}>
                    Show Private Key
                  </Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="delete-account-button"
                  style={styles.settingsMenuItem}
                  onPress={async () => {
                    if (editingWallet) {
                      const updatedWallets = wallets.filter(
                        (w) => w.id !== editingWallet.id
                      );
                      setWallets(updatedWallets);
                      await saveWalletsToStorage(updatedWallets);
                      editWalletSheetRef.current?.dismiss();
                      setEditingWallet(null);
                      Toast.show({
                        type: "success",
                        text1: "Account Deleted",
                        text2: `${editingWallet.name} has been deleted`,
                        position: "bottom",
                      });
                    }
                  }}
                >
                  <Text
                    style={[styles.settingsMenuItemText, { color: "#FF4444" }]}
                  >
                    Delete Account
                  </Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </SimpleActionSheet>

          {/* Change Name Modal */}
          <Modal
            visible={showChangeNameModal}
            transparent={true}
            animationType="slide"
          >
            <Pressable
              style={styles.settingsDrawerOverlay}
              onPress={() => {
                console.log("OVERLAY PRESSED - Cancelling changes");
                // Reset to original name
                if (editingWallet) {
                  setEditWalletName(editingWallet.name);
                }
                setShowChangeNameModal(false);
                editWalletSheetRef.current?.dismiss();
                setEditingWallet(null);
              }}
            >
              <Pressable
                style={[
                  styles.settingsDrawerContent,
                  { backgroundColor: easterEggMode ? "#111827" : "#000" },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.settingsDrawerContentArea}>
                  <View style={styles.settingsDrawerHeader}>
                    <TouchableOpacity
                      onPress={() => {
                        console.log(
                          "BACK BUTTON PRESSED (<) - Cancelling changes"
                        );
                        // Reset to original name
                        if (editingWallet) {
                          setEditWalletName(editingWallet.name);
                        }
                        setShowChangeNameModal(false);
                        editWalletSheetRef.current?.dismiss();
                        setEditingWallet(null);
                      }}
                    >
                      <Text style={styles.settingsDrawerClose}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.settingsDrawerTitle}>Change Name</Text>
                    <TouchableOpacity
                      onPress={() => {
                        console.log("X BUTTON PRESSED - Cancelling changes");
                        // Reset to original name
                        if (editingWallet) {
                          setEditWalletName(editingWallet.name);
                        }
                        setShowChangeNameModal(false);
                        editWalletSheetRef.current?.dismiss();
                        setEditingWallet(null);
                      }}
                    >
                      <Text style={styles.settingsDrawerClose}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.inputLabel}>Account Name</Text>
                  <TextInput
                    testID="account-name-input"
                    style={styles.walletNameInput}
                    placeholder="Wallet Name"
                    placeholderTextColor="#666666"
                    value={editWalletName}
                    onChangeText={(text) => {
                      setEditWalletName(text);
                    }}
                    autoCorrect={false}
                  />

                  <View style={styles.changeNameButtonContainer}>
                    <TouchableOpacity
                      style={styles.changeNameCancelButton}
                      onPress={() => {
                        console.log(
                          "CANCEL BUTTON PRESSED - Discarding changes"
                        );
                        // Reset to original name
                        if (editingWallet) {
                          setEditWalletName(editingWallet.name);
                        }
                        setShowChangeNameModal(false);
                        editWalletSheetRef.current?.dismiss();
                        setEditingWallet(null);
                      }}
                    >
                      <Text style={styles.changeNameCancelButtonText}>
                        Cancel
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.changeNameConfirmButton,
                        !editWalletName.trim() &&
                          styles.changeNameConfirmButtonDisabled,
                      ]}
                      onPress={() => {
                        console.log("CONFIRM BUTTON PRESSED");
                        console.log("editingWallet:", editingWallet);
                        console.log("editWalletName:", editWalletName);
                        if (editingWallet && editWalletName.trim()) {
                          console.log(
                            "Saving wallet name:",
                            editWalletName.trim()
                          );
                          const updatedWallets = wallets.map((w) =>
                            w.id === editingWallet.id
                              ? { ...w, name: editWalletName.trim() }
                              : w
                          );
                          setWallets(updatedWallets);
                          saveWalletsToStorage(updatedWallets);
                          console.log("Closing both modals");
                          setShowChangeNameModal(false);
                          editWalletSheetRef.current?.dismiss();
                          setEditingWallet(null);
                        } else {
                          console.log("Not saving - wallet or name is empty");
                        }
                      }}
                      disabled={!editWalletName.trim()}
                    >
                      <Text style={styles.changeNameConfirmButtonText}>
                        Confirm
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* View Private Key Bottom Sheet */}
          <SimpleActionSheet
            ref={privateKeySheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <View
              style={[
                styles.bottomSheetContent,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
            >
              <View style={styles.bottomSheetHeader}>
                <View style={{ width: 32 }} />
                <Text style={styles.bottomSheetTitle}>Private Key</Text>
                <TouchableOpacity
                  onPress={() => {
                    privateKeySheetRef.current?.dismiss();
                  }}
                >
                  <Text style={styles.bottomSheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {editingWallet && (
                <View style={styles.privateKeyContainer}>
                  <View style={styles.privateKeyHeader}>
                    <Text style={styles.privateKeyLabel}>Private Key:</Text>
                    {editingWallet.secretKey && (
                      <TouchableOpacity
                        style={styles.bottomSheetCopyBtn}
                        onPress={() => {
                          Clipboard.setString(
                            bs58.encode(new Uint8Array(editingWallet.secretKey))
                          );
                          ToastAndroid.show(
                            "Private key copied!",
                            ToastAndroid.SHORT
                          );
                        }}
                      >
                        <Text style={styles.bottomSheetCopyIcon}>⧉</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {editingWallet.secretKey ? (
                    <Text style={styles.privateKeyText} selectable={true}>
                      {bs58.encode(new Uint8Array(editingWallet.secretKey))}
                    </Text>
                  ) : (
                    <Text style={styles.privateKeyText}>
                      Not available. This is a hardware wallet (Ledger).
                    </Text>
                  )}
                </View>
              )}
            </View>
          </SimpleActionSheet>

          {/* View Seed Phrase Bottom Sheet */}
          <SimpleActionSheet
            ref={seedPhraseSheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <View
              style={[
                styles.bottomSheetContent,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
            >
              <View style={styles.bottomSheetHeader}>
                <View style={{ width: 32 }} />
                <Text style={styles.bottomSheetTitle}>Seed Phrase</Text>
                <TouchableOpacity
                  onPress={() => {
                    seedPhraseSheetRef.current?.dismiss();
                    setWalletSeedPhraseForDisplay(null);
                    setWalletSeedPhraseLoading(false);
                  }}
                >
                  <Text style={styles.bottomSheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {editingWallet && (
                <View style={styles.privateKeyContainer}>
                  <View style={styles.privateKeyHeader}>
                    <Text style={styles.privateKeyLabel}>
                      Seed Phrase (Recovery Phrase):
                    </Text>
                    {!editingWallet.derivationPath &&
                      walletSeedPhraseForDisplay &&
                      !walletSeedPhraseLoading && (
                        <TouchableOpacity
                          style={styles.bottomSheetCopyBtn}
                          onPress={() => {
                            Clipboard.setString(walletSeedPhraseForDisplay);
                            ToastAndroid.show(
                              "Seed phrase copied!",
                              ToastAndroid.SHORT
                            );
                          }}
                        >
                          <Text style={styles.bottomSheetCopyIcon}>⧉</Text>
                        </TouchableOpacity>
                      )}
                  </View>

                  {editingWallet.derivationPath ? (
                    <Text style={styles.privateKeyText}>
                      This wallet is derived from your master seed phrase. Go to
                      Manage Security {"->"} Export Seed Phrase to view or back
                      it up.
                    </Text>
                  ) : walletSeedPhraseLoading ? (
                    <Text style={styles.privateKeyText}>
                      Loading seed phrase...
                    </Text>
                  ) : walletSeedPhraseForDisplay ? (
                    <Text style={styles.seedPhraseText} selectable={true}>
                      {walletSeedPhraseForDisplay}
                    </Text>
                  ) : (
                    <Text style={styles.privateKeyText}>
                      No stored recovery phrase was found for this wallet.
                    </Text>
                  )}
                </View>
              )}
            </View>
          </SimpleActionSheet>

          {/* Transaction Confirmation Bottom Sheet */}
          <SimpleActionSheet
            ref={confirmTransactionSheetRef}
            snapPoints={["45%"]}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <View
              style={[
                styles.bottomSheetContent,
                { backgroundColor: easterEggMode ? "#111827" : "#000" },
              ]}
            >
              <View style={styles.bottomSheetHeader}>
                <View style={{ width: 32 }} />
                <Text style={styles.bottomSheetTitle}>Confirm Transaction</Text>
                <TouchableOpacity
                  onPress={() => {
                    confirmTransactionSheetRef.current?.dismiss();
                    setPendingTransaction(null);
                  }}
                >
                  <Text style={styles.bottomSheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {pendingTransaction && (
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                  {/* Transaction details */}
                  <View
                    style={{
                      backgroundColor: "#1a1a1a",
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 20,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 12,
                      }}
                    >
                      <Text style={{ color: "#999", fontSize: 14 }}>
                        Amount
                      </Text>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        {pendingTransaction.amount}{" "}
                        {currentNetwork.nativeToken.symbol}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 12,
                      }}
                    >
                      <Text style={{ color: "#999", fontSize: 14 }}>To</Text>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 12,
                          fontFamily: "monospace",
                        }}
                      >
                        {pendingTransaction.address.substring(0, 8)}...
                        {pendingTransaction.address.substring(
                          pendingTransaction.address.length - 8
                        )}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ color: "#999", fontSize: 14 }}>
                        Network Fee
                      </Text>
                      <Text style={{ color: "#fff", fontSize: 14 }}>
                        ~0.000005 {currentNetwork.nativeToken.symbol}
                      </Text>
                    </View>
                  </View>

                  {/* Biometric or Approve button */}
                  {biometricAvailable ? (
                    <View
                      style={{
                        alignItems: "center",
                        marginBottom: 20,
                      }}
                    >
                      <Text
                        style={{
                          color: "#4A90E2",
                          fontSize: 16,
                          marginBottom: 12,
                        }}
                      >
                        Confirm
                      </Text>
                      <TouchableOpacity
                        onPress={confirmTransactionWithBiometric}
                        style={{
                          padding: 10,
                        }}
                      >
                        <Image
                          source={require("./assets/fingerprint.png")}
                          style={{
                            width: 95,
                            height: 95,
                            opacity: 0.5,
                          }}
                        />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={confirmTransactionWithBiometric}
                      style={{
                        backgroundColor: "#4A90E2",
                        paddingVertical: 16,
                        borderRadius: 8,
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        Approve Transaction
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => {
                      confirmTransactionSheetRef.current?.dismiss();
                      setPendingTransaction(null);
                    }}
                    style={{
                      paddingVertical: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#999", fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SimpleActionSheet>

          {/* Browser BottomSheet */}
          <SimpleActionSheet
            ref={browserSheetRef}
            backgroundColor={easterEggMode ? "#111827" : "#000"}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Browser</Text>
                <TouchableOpacity
                  onPress={() => browserSheetRef.current?.dismiss()}
                >
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* URL Input */}
              <View style={styles.urlInputContainer}>
                <TextInput
                  style={styles.urlInput}
                  value={browserInputUrl}
                  onChangeText={(text) => {
                    console.log("URL input changed:", text);
                    setBrowserInputUrl(text);
                  }}
                  placeholder="Enter URL"
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.goButton}
                  onPress={() => {
                    console.log(
                      "Go button pressed! Loading URL:",
                      browserInputUrl
                    );

                    // Sanitize and validate URL
                    let url = browserInputUrl.trim();

                    // Add protocol if missing
                    if (
                      url &&
                      !url.startsWith("http://") &&
                      !url.startsWith("https://")
                    ) {
                      url = "https://" + url;
                    }

                    // Remove spaces (common typo)
                    url = url.replace(/\s+/g, "");

                    console.log("Sanitized URL:", url);
                    setBrowserUrl(url);
                    console.log("browserUrl state updated to:", url);

                    // Force reload if WebView is already loaded
                    if (webViewRef.current) {
                      setTimeout(() => {
                        webViewRef.current.reload();
                      }, 100);
                    }
                  }}
                >
                  <Text style={styles.goButtonText}>Go</Text>
                </TouchableOpacity>
              </View>

              {/* WebView */}
              <View
                style={{ flex: 1, backgroundColor: "#FF0000", marginTop: 10 }}
              >
                <WebView
                  key={browserUrl}
                  source={{ uri: browserUrl }}
                  style={{ flex: 1, backgroundColor: "#00FF00" }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  onMessage={handleWebViewMessage}
                  injectedJavaScriptBeforeContentLoaded={`
                (function() {
                  // Intercept console.log/error and send to React Native
                  const originalLog = console.log;
                  const originalError = console.error;
                  const originalWarn = console.warn;

                  function sendToRN(type, args) {
                    try {
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'console',
                          level: type,
                          message: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
                        }));
                      }
                    } catch(e) {}
                  }

                  console.log = function() { sendToRN('log', arguments); originalLog.apply(console, arguments); };
                  console.error = function() { sendToRN('error', arguments); originalError.apply(console, arguments); };
                  console.warn = function() { sendToRN('warn', arguments); originalWarn.apply(console, arguments); };

                  // Global error handler
                  window.onerror = function(msg, url, line, col, error) {
                    sendToRN('error', ['UNCAUGHT ERROR:', msg, 'at', url, line, col, error ? error.stack : '']);
                    return false;
                  };

                  window.addEventListener('unhandledrejection', function(event) {
                    sendToRN('error', ['UNHANDLED PROMISE:', event.reason]);
                  });

                  console.log('[WebView] Console interceptor initialized');

                  // Create a promise-based request system
                  let requestId = 0;
                  const pendingRequests = {};

                  // Listen for responses from React Native
                  window.addEventListener('message', (event) => {
                    try {
                      const response = typeof event.data === 'string'
                        ? JSON.parse(event.data)
                        : event.data;

                      if (response.id && pendingRequests[response.id]) {
                        const { resolve, reject } = pendingRequests[response.id];

                        if (response.error) {
                          reject(new Error(response.error));
                        } else {
                          resolve(response.result);
                        }

                        delete pendingRequests[response.id];
                      }
                    } catch (err) {
                      console.error('Error processing message:', err);
                    }
                  });

                  // Helper function to send requests to React Native
                  function sendRequest(method, params = {}) {
                    return new Promise((resolve, reject) => {
                      const id = ++requestId;
                      pendingRequests[id] = { resolve, reject };

                      const message = JSON.stringify({ id, method, params });
                      window.ReactNativeWebView.postMessage(message);

                      // Timeout after 30 seconds
                      setTimeout(() => {
                        if (pendingRequests[id]) {
                          delete pendingRequests[id];
                          reject(new Error('Request timeout'));
                        }
                      }, 30000);
                    });
                  }

                  // Create the window.x1 API
                  window.x1 = {
                    isConnected: false,
                    publicKey: null,

                    // Connect to the wallet and get public key
                    connect: async function() {
                      try {
                        const result = await sendRequest('connect');
                        const pubKeyStr = result.publicKey;

                        // Create a PublicKey-like object (compatible with Backpack/Phantom)
                        this.publicKey = {
                          _key: pubKeyStr,
                          toString: function() { return this._key; },
                          toBase58: function() { return this._key; }
                        };
                        this.isConnected = true;

                        // Return in same format as Backpack/Phantom
                        return { publicKey: this.publicKey };
                      } catch (err) {
                        console.error('x1.connect error:', err);
                        throw err;
                      }
                    },

                    // Disconnect wallet
                    disconnect: async function() {
                      this.isConnected = false;
                      this.publicKey = null;
                      return true;
                    },

                    // Sign and send a transaction
                    signAndSendTransaction: async function(transaction, options = {}) {
                      try {
                        // Serialize the transaction to base64
                        let txData;
                        if (transaction.serialize) {
                          // If it's a Transaction object
                          const serialized = transaction.serialize({
                            requireAllSignatures: false,
                            verifySignatures: false
                          });
                          // Use btoa for browser environment (not Buffer.toString('base64'))
                          txData = btoa(String.fromCharCode.apply(null, serialized));
                        } else if (transaction instanceof Uint8Array) {
                          // If it's already serialized
                          txData = btoa(String.fromCharCode.apply(null, transaction));
                        } else {
                          throw new Error('Invalid transaction format');
                        }

                        const result = await sendRequest('signAndSendTransaction', {
                          transaction: txData,
                          options
                        });

                        return result.signature;
                      } catch (err) {
                        console.error('x1.signAndSendTransaction error:', err);
                        throw err;
                      }
                    },

                    // Sign a message
                    signMessage: async function(message) {
                      try {
                        // Encode the message to base64
                        let encodedMessage;
                        if (typeof message === 'string') {
                          encodedMessage = btoa(message);
                        } else if (message instanceof Uint8Array) {
                          encodedMessage = btoa(String.fromCharCode.apply(null, message));
                        } else {
                          throw new Error('Invalid message format');
                        }

                        const result = await sendRequest('signMessage', {
                          encodedMessage
                        });

                        return result.signature;
                      } catch (err) {
                        console.error('x1.signMessage error:', err);
                        throw err;
                      }
                    },

                    // Sign a transaction (without sending) - for multi-sig flows
                    signTransaction: async function(transaction) {
                      try {
                        console.log('[x1.signTransaction] Signing transaction...');
                        // Serialize the transaction to base64
                        let txData;
                        if (transaction.serialize) {
                          const serialized = transaction.serialize({
                            requireAllSignatures: false,
                            verifySignatures: false
                          });
                          // Use btoa for browser environment (not Buffer.toString('base64'))
                          txData = btoa(String.fromCharCode.apply(null, serialized));
                        } else if (transaction instanceof Uint8Array) {
                          txData = btoa(String.fromCharCode.apply(null, transaction));
                        } else {
                          throw new Error('Invalid transaction format');
                        }

                        const result = await sendRequest('signTransaction', {
                          transaction: txData
                        });

                        // Decode the signed transaction from base64
                        if (result.signedTransaction) {
                          const binary = atob(result.signedTransaction);
                          const bytes = new Uint8Array(binary.length);
                          for (let i = 0; i < binary.length; i++) {
                            bytes[i] = binary.charCodeAt(i);
                          }
                          // Return a transaction-like object that can be serialized
                          return {
                            serialize: function() { return bytes; },
                            _signedBytes: bytes
                          };
                        }
                        throw new Error('No signed transaction returned');
                      } catch (err) {
                        console.error('x1.signTransaction error:', err);
                        throw err;
                      }
                    }
                  };

                  console.log('window.x1 API initialized');

                  // Also expose as window.x1_wallet for webapp compatibility
                  window.x1_wallet = window.x1;
                  console.log('window.x1_wallet alias initialized');
                })();
              `}
                />
              </View>
            </View>
          </SimpleActionSheet>
        </GestureHandlerRootView>
      )}
      {/* Ledger Connection Bottom Sheet */}
      <SimpleActionSheet
        ref={ledgerSheetRef}
        backgroundColor={easterEggMode ? "#111827" : "#000"}
      >
        <View
          style={[
            styles.bottomSheetContent,
            { backgroundColor: easterEggMode ? "#111827" : "#000" },
          ]}
        >
          <View style={[styles.bottomSheetHeader, { paddingTop: 8 }]}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => {
                // Abort any ongoing scan
                if (ledgerWalletProgress > 0) {
                  ledgerScanAbortRef.current = true;
                  console.log("[Ledger Scan] Scan aborted by user");
                }
                ledgerSheetRef.current?.dismiss();
              }}
            >
              <Text style={styles.bottomSheetClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Check BLE Status Button */}
          {false && (
            <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <TouchableOpacity
                onPress={checkBLEStatus}
                style={{
                  backgroundColor: "#2a2a2a",
                  borderRadius: 8,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "rgba(74, 144, 226, 0.3)",
                }}
              >
                <Text
                  style={{
                    color: "#4A90E2",
                    fontSize: 14,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  📊 Check BLE Status
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Discovered Devices List or Account Selection */}
          <View style={styles.ledgerAccountsList}>
            {ledgerAccounts.length > 0 ? (
              // Account Selection UI - Compact Design
              <>
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingTop: 8,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  {ledgerWalletProgress > 0 && (
                    <ActivityIndicator
                      size="small"
                      color="#4A90E2"
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 14,
                        fontWeight: "600",
                        marginBottom: 4,
                      }}
                    >
                      {ledgerAccounts.length} Account
                      {ledgerAccounts.length > 1 ? "s" : ""} Found
                      {ledgerWalletProgress > 0 &&
                        ` (Scanning ${ledgerWalletProgress})`}
                    </Text>
                    <Text style={{ color: "#666", fontSize: 11 }}>
                      Scanned:{" "}
                      {ledgerDerivationPatterns
                        .map((p) => {
                          if (p === "standard") return "Standard";
                          if (p === "ledgerLive") return "Ledger Live";
                          if (p === "alternate") return "Alternate";
                          return p;
                        })
                        .join(", ")}
                    </Text>
                  </View>
                </View>

                {/* Add Selected/All Accounts Button */}
                {ledgerAccounts.length > 1 && (
                  <View
                    style={{ paddingHorizontal: 20, paddingTop: 8, gap: 8 }}
                  >
                    {/* Add Selected Button - shows when accounts are selected */}
                    {ledgerSelectedAccounts.size > 0 && (
                      <TouchableOpacity
                        onPress={handleAddSelectedLedgerAccounts}
                        style={{
                          backgroundColor: "#4A90E2",
                          borderRadius: 8,
                          padding: 10,
                          marginBottom: 0,
                          borderWidth: 1,
                          borderColor: "rgba(74, 144, 226, 0.3)",
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontSize: 14,
                            fontWeight: "600",
                            textAlign: "center",
                          }}
                        >
                          Add {ledgerSelectedAccounts.size} Selected{" "}
                          {ledgerSelectedAccounts.size === 1
                            ? "Account"
                            : "Accounts"}
                        </Text>
                        <Text
                          style={{
                            color: "rgba(255, 255, 255, 0.8)",
                            fontSize: 11,
                            textAlign: "center",
                            marginTop: 2,
                          }}
                        >
                          Tap accounts below to select/deselect
                        </Text>
                      </TouchableOpacity>
                    )}
                    {/* Add All Button - shows when no selections */}
                    {ledgerSelectedAccounts.size === 0 && (
                      <TouchableOpacity
                        onPress={handleAddAllLedgerAccounts}
                        style={{
                          backgroundColor: "#4A90E2",
                          borderRadius: 8,
                          padding: 10,
                          marginBottom: 0,
                          borderWidth: 1,
                          borderColor: "rgba(74, 144, 226, 0.3)",
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontSize: 14,
                            fontWeight: "600",
                            textAlign: "center",
                          }}
                        >
                          Add All {ledgerAccounts.length} Accounts
                        </Text>
                        <Text
                          style={{
                            color: "rgba(255, 255, 255, 0.8)",
                            fontSize: 11,
                            textAlign: "center",
                            marginTop: 2,
                          }}
                        >
                          Or tap individual accounts to multi-select
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <FlatList
                  data={ledgerAccounts}
                  keyExtractor={(item) => item.address}
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 8,
                  }}
                  renderItem={({ item }) => {
                    const isSelected = ledgerSelectedAccounts.has(item.address);
                    return (
                      <TouchableOpacity
                        onPress={() => handleToggleLedgerAccountSelection(item)}
                        onLongPress={() => handleSelectLedgerAccount(item)}
                        style={{
                          backgroundColor: "#1a1a1a",
                          borderRadius: 8,
                          padding: 10,
                          marginBottom: 8,
                          borderWidth: 2,
                          borderColor: isSelected
                            ? "#4A90E2"
                            : "rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          {/* Checkbox */}
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              borderWidth: 2,
                              borderColor: isSelected
                                ? "#4A90E2"
                                : "rgba(255, 255, 255, 0.3)",
                              backgroundColor: isSelected
                                ? "#4A90E2"
                                : "transparent",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 10,
                            }}
                          >
                            {isSelected && (
                              <Text
                                style={{
                                  color: "#FFF",
                                  fontSize: 14,
                                  fontWeight: "bold",
                                }}
                              >
                                ✓
                              </Text>
                            )}
                          </View>

                          {/* Account Badge */}
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: "#4A90E2",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 10,
                            }}
                          >
                            <Text
                              style={{
                                color: "#FFF",
                                fontSize: 14,
                                fontWeight: "600",
                              }}
                            >
                              {item.displayIndex + 1}
                            </Text>
                          </View>

                          {/* Account Info */}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                color: "#FFF",
                                fontSize: 13,
                                fontWeight: "500",
                                marginBottom: 2,
                              }}
                            >
                              {item.address.slice(0, 6)}...
                              {item.address.slice(-4)}
                            </Text>
                            {(item.solanaBalance > 0 || item.x1Balance > 0) && (
                              <View style={{ flexDirection: "row", gap: 8 }}>
                                {item.solanaBalance > 0 && (
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      color: "#4A90E2",
                                      fontWeight: "500",
                                    }}
                                  >
                                    {item.solanaBalance.toFixed(3)} SOL
                                  </Text>
                                )}
                                {item.x1Balance > 0 && (
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      color: "#4A90E2",
                                      fontWeight: "500",
                                    }}
                                  >
                                    {item.x1Balance.toFixed(3)} XNT
                                  </Text>
                                )}
                              </View>
                            )}
                          </View>

                          {/* Arrow/Instructions */}
                          <Text
                            style={{
                              color: "rgba(255, 255, 255, 0.3)",
                              fontSize: 10,
                              textAlign: "right",
                            }}
                          >
                            {isSelected ? "✓" : "tap"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            ) : ledgerScanning && discoveredDevices.length === 0 ? (
              // Scanning UI
              <View style={styles.ledgerStatus}>
                <Text style={styles.ledgerStatusText}>
                  Scanning for devices...
                </Text>
                <Text style={styles.ledgerStatusSubtext}>
                  Please ensure your Ledger is unlocked and Bluetooth is on.
                </Text>
              </View>
            ) : (
              // Device Discovery UI
              <FlatList
                data={discoveredDevices}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                  <>
                    {/* Derivation Path Selector - Multi-Select */}
                    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                      <Text
                        style={{
                          color: "#999",
                          fontSize: 11,
                          marginBottom: 8,
                        }}
                      >
                        Derivation Paths (tap to toggle)
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {[
                          {
                            key: "standard",
                            label: "Standard",
                            desc: "44'/501'/X'/0'",
                          },
                          {
                            key: "ledgerLive",
                            label: "Ledger Live",
                            desc: "44'/501'/X'",
                          },
                          {
                            key: "alternate",
                            label: "Alternate",
                            desc: "44'/501'/0'/X'",
                          },
                        ].map((pattern) => {
                          const isSelected = ledgerDerivationPatterns.includes(
                            pattern.key
                          );
                          return (
                            <TouchableOpacity
                              key={pattern.key}
                              onPress={() => {
                                if (isSelected) {
                                  // Unselect - but don't allow deselecting if it's the only one
                                  if (ledgerDerivationPatterns.length > 1) {
                                    setLedgerDerivationPatterns(
                                      ledgerDerivationPatterns.filter(
                                        (p) => p !== pattern.key
                                      )
                                    );
                                  }
                                } else {
                                  // Select
                                  setLedgerDerivationPatterns([
                                    ...ledgerDerivationPatterns,
                                    pattern.key,
                                  ]);
                                }
                              }}
                              style={{
                                flex: 1,
                                backgroundColor: isSelected
                                  ? "#4A90E2"
                                  : "#1a1a1a",
                                paddingVertical: 8,
                                paddingHorizontal: 8,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: isSelected
                                  ? "#4A90E2"
                                  : "rgba(255, 255, 255, 0.1)",
                              }}
                            >
                              <Text
                                style={{
                                  color: isSelected ? "#FFF" : "#999",
                                  fontSize: 11,
                                  fontWeight: "600",
                                  textAlign: "center",
                                  marginBottom: 2,
                                }}
                              >
                                {pattern.label} {isSelected ? "✓" : ""}
                              </Text>
                              <Text
                                style={{
                                  color: isSelected
                                    ? "rgba(255,255,255,0.7)"
                                    : "#666",
                                  fontSize: 9,
                                  textAlign: "center",
                                }}
                              >
                                {pattern.desc}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Deep Scan Checkbox */}
                    <TouchableOpacity
                      onPress={() => setLedgerDeepScan(!ledgerDeepScan)}
                      style={{
                        marginHorizontal: 20,
                        marginTop: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        backgroundColor: "#1a1a1a",
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: ledgerDeepScan ? "#4A90E2" : "#666",
                          backgroundColor: ledgerDeepScan
                            ? "#4A90E2"
                            : "transparent",
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 12,
                        }}
                      >
                        {ledgerDeepScan && (
                          <Text style={{ color: "#FFF", fontSize: 14 }}>✓</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: "#FFF",
                            fontSize: 14,
                            fontWeight: "600",
                          }}
                        >
                          Deep Scan Mode
                        </Text>
                        <Text
                          style={{ color: "#999", fontSize: 12, marginTop: 4 }}
                        >
                          Scan up to 50 accounts per path (normally stops at 5
                          consecutive empty)
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Bluetooth Settings Button */}
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#1a1a1a",
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        marginHorizontal: 20,
                        marginTop: 16,
                        marginBottom: 16,
                        borderRadius: 8,
                        borderLeftWidth: 3,
                        borderLeftColor: "#4A90E2",
                      }}
                      onPress={() => {
                        Linking.sendIntent(
                          "android.settings.BLUETOOTH_SETTINGS"
                        );
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#CCCCCC",
                          textAlign: "center",
                        }}
                      >
                        Having connection issues? Check Bluetooth Settings
                      </Text>
                    </TouchableOpacity>
                  </>
                }
                ListFooterComponent={
                  ledgerConnecting ? (
                    // Wallet Discovery Progress Indicator - Tappable to pause/resume
                    <TouchableOpacity
                      onPress={() => {
                        if (ledgerWalletProgress > 0) {
                          const newPausedState = !ledgerScanPaused;
                          ledgerScanPausedRef.current = newPausedState;
                          setLedgerScanPaused(newPausedState);
                          console.log(
                            `[Ledger Scan] ${newPausedState ? "Paused" : "Resumed"} by user`
                          );
                        }
                      }}
                      activeOpacity={ledgerWalletProgress > 0 ? 0.7 : 1}
                      style={{
                        alignItems: "center",
                        paddingVertical: 24,
                        paddingHorizontal: 40,
                      }}
                    >
                      <Text
                        style={{
                          color: ledgerScanPaused
                            ? "#FFA500"
                            : "rgba(255, 255, 255, 0.6)",
                          fontSize: 13,
                          marginBottom: 12,
                          textAlign: "center",
                          fontWeight: ledgerScanPaused ? "600" : "normal",
                        }}
                      >
                        {ledgerScanPaused
                          ? "⏸ Paused - Tap to resume"
                          : ledgerWalletProgress > 0
                            ? ledgerDeepScan
                              ? `Scanning ${ledgerWalletProgress}`
                              : `Scanning accounts... ${ledgerWalletProgress}/${30 * ledgerDerivationPatterns.length}`
                            : "Connecting to Ledger..."}
                      </Text>
                      {ledgerWalletProgress > 0 && (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                              const newPausedState = !ledgerScanPaused;
                              ledgerScanPausedRef.current = newPausedState;
                              setLedgerScanPaused(newPausedState);
                              console.log(
                                `[Ledger Scan] ${newPausedState ? "Paused" : "Resumed"} by user`
                              );
                            }}
                            activeOpacity={0.7}
                            style={{
                              width: "100%",
                              height: 3,
                              backgroundColor: "rgba(74, 144, 226, 0.15)",
                              borderRadius: 1.5,
                              overflow: "hidden",
                              marginBottom: 12,
                            }}
                          >
                            <View
                              style={{
                                width: `${(ledgerWalletProgress / (ledgerDeepScan ? 50 : 30) / ledgerDerivationPatterns.length) * 100}%`,
                                height: "100%",
                                backgroundColor: ledgerScanPaused
                                  ? "#FFA500"
                                  : "#4A90E2",
                              }}
                            />
                          </TouchableOpacity>
                          <Text
                            style={{
                              color: "rgba(255, 255, 255, 0.4)",
                              fontSize: 11,
                              textAlign: "center",
                            }}
                          >
                            {(ledgerAccounts || [])
                              .slice(0, ledgerWalletProgress)
                              .map((acc, i) => acc.address.slice(0, 4))
                              .join(" • ")}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : ledgerAccounts.length === 0 &&
                    !ledgerConnecting &&
                    ledgerSkippedDuplicatesRef.current > 0 ? (
                    // Special message when all accounts are already imported
                    <View
                      style={{
                        alignItems: "center",
                        paddingVertical: 24,
                        paddingHorizontal: 40,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFA500",
                          fontSize: 14,
                          fontWeight: "600",
                          marginBottom: 8,
                          textAlign: "center",
                        }}
                      >
                        All Accounts Already Imported
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255, 255, 255, 0.6)",
                          fontSize: 12,
                          textAlign: "center",
                          lineHeight: 18,
                        }}
                      >
                        All {ledgerSkippedDuplicatesRef.current} scanned
                        accounts are already in your wallet.
                        {"\n\n"}
                        Tap an account below to add a fresh one.
                      </Text>
                    </View>
                  ) : null
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.ledgerAccount}
                    onPress={async () => {
                      // Stop scanning before connecting
                      if (ledgerScanSubscriptionRef.current) {
                        try {
                          ledgerScanSubscriptionRef.current.unsubscribe();
                          ledgerScanSubscriptionRef.current = null;
                        } catch (e) {}
                      }
                      setLedgerScanning(false);

                      // Store device name
                      const deviceName =
                        item.deviceName ||
                        item.name ||
                        item.localName ||
                        "Ledger Device";
                      setLedgerDeviceName(deviceName);

                      // Connect
                      connectToLedger(item);
                    }}
                  >
                    <View style={styles.ledgerAccountLeft}>
                      <View style={styles.ledgerAccountInfo}>
                        <Text style={styles.ledgerAccountIndex}>
                          {item.deviceName ||
                            item.name ||
                            item.localName ||
                            "Unknown Device"}
                        </Text>
                        <Text style={styles.ledgerAccountAddress}>
                          ID: {item.id}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  !ledgerScanning && (
                    <Text style={styles.debugNoLogs}>
                      No devices found. Pull to refresh or try again.
                    </Text>
                  )
                }
              />
            )}
          </View>

          {/* Custom toast notification for Ledger errors */}
          {ledgerError ? (
            <Animated.View
              style={{
                position: "absolute",
                bottom: 20,
                left: 20,
                right: 20,
                backgroundColor: "#1a1a1a",
                borderRadius: 8,
                padding: 16,
                borderLeftWidth: 4,
                borderLeftColor: "#4A90E2",
                minWidth: 300,
                transform: [{ translateY: ledgerErrorSlideAnim }],
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                Duplicate Wallet
              </Text>
              <Text
                style={{
                  color: "#999999",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {ledgerError}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </SimpleActionSheet>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <Modal
          visible={showQRScanner}
          animationType="slide"
          onRequestClose={() => setShowQRScanner(false)}
          statusBarTranslucent
        >
          <SafeAreaViewContext
            style={styles.qrScannerContainer}
            edges={["top"]}
          >
            <CameraView
              onBarcodeScanned={handleQRCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Overlay with scanning frame */}
            <View style={styles.qrOverlayContainer}>
              {/* Top overlay */}
              <View style={styles.qrOverlayTop}>
                <View style={styles.qrScannerTopContent}>
                  <Text style={styles.qrScannerTitle}>Scan QR Code</Text>
                  <Text style={styles.qrScannerSubtitle}>
                    Align QR code within the frame
                  </Text>
                </View>
              </View>

              {/* Middle section with scanning frame */}
              <View style={styles.qrOverlayMiddle}>
                <View style={styles.qrOverlaySide} />
                <View style={styles.qrScanFrame}>
                  {/* Corner brackets */}
                  <View style={styles.qrCornerTopLeft} />
                  <View style={styles.qrCornerTopRight} />
                  <View style={styles.qrCornerBottomLeft} />
                  <View style={styles.qrCornerBottomRight} />
                </View>
                <View style={styles.qrOverlaySide} />
              </View>

              {/* Bottom overlay */}
              <View style={styles.qrOverlayBottom}>
                <TouchableOpacity
                  style={styles.qrScannerCloseButton}
                  onPress={() => setShowQRScanner(false)}
                >
                  <Text style={styles.qrScannerCloseText}>✕ Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaViewContext>
        </Modal>
      )}

      {/* Swap Modal */}
      {showSwapScreen && (
        <Modal
          visible={showSwapScreen}
          animationType="slide"
          onRequestClose={() => setShowSwapScreen(false)}
          statusBarTranslucent
        >
          <SafeAreaViewContext
            style={[styles.swapContainer, { paddingTop: insets.top }]}
            edges={["top"]}
          >
            {/* Header */}
            <View style={styles.swapHeader}>
              <TouchableOpacity onPress={() => setShowSwapScreen(false)}>
                <Text style={styles.swapBackButton}>‹ Back</Text>
              </TouchableOpacity>
              <Text style={styles.swapTitle}>Swap Tokens</Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.swapContent}>
              {/* Token From */}
              <View style={styles.swapSection}>
                <Text style={styles.swapLabel}>
                  From ({getTokenSymbol(swapTokenIn)})
                </Text>
                <View style={styles.swapInputContainer}>
                  <TextInput
                    style={styles.swapInput}
                    placeholder="0.0"
                    placeholderTextColor="#666"
                    keyboardType="decimal-pad"
                    value={swapAmount}
                    onChangeText={(text) => {
                      setSwapAmount(text);
                      if (text && parseFloat(text) > 0) {
                        getSwapEstimate(text);
                      } else {
                        setSwapEstimate(null);
                      }
                    }}
                  />
                  <View style={styles.swapTokenInfo}>
                    <Text style={styles.swapTokenSymbol}>
                      {getTokenSymbol(swapTokenIn)}
                    </Text>
                    <Text style={styles.swapBalance}>
                      Balance: {getTokenBalance(swapTokenIn)}{" "}
                      {getTokenSymbol(swapTokenIn)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Swap Icon */}
              <View style={styles.swapArrowContainer}>
                <TouchableOpacity
                  style={styles.swapArrowCircle}
                  onPress={reverseSwapTokens}
                  activeOpacity={0.7}
                >
                  <Text style={styles.swapArrowIcon}>⇅</Text>
                </TouchableOpacity>
              </View>

              {/* Token To */}
              <View style={styles.swapSection}>
                <Text style={styles.swapLabel}>
                  To ({getTokenSymbol(swapTokenOut)})
                </Text>
                <View style={styles.swapInputContainer}>
                  <View style={styles.swapOutputContainer}>
                    {swapLoading ? (
                      <ActivityIndicator size="small" color="#4A90E2" />
                    ) : (
                      <Text style={styles.swapOutput}>
                        {swapEstimate
                          ? (swapEstimate.data?.outputAmount || 0).toFixed(6)
                          : "0.0"}
                      </Text>
                    )}
                  </View>
                  <View style={styles.swapTokenInfo}>
                    <Text style={styles.swapTokenSymbol}>
                      {getTokenSymbol(swapTokenOut)}
                    </Text>
                    <Text style={styles.swapBalance}>
                      Balance: {getTokenBalance(swapTokenOut)}{" "}
                      {getTokenSymbol(swapTokenOut)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Swap Details */}
              {swapEstimate && (
                <View style={styles.swapDetails}>
                  <View style={styles.swapDetailRow}>
                    <Text style={styles.swapDetailLabel}>Rate</Text>
                    <Text style={styles.swapDetailValue}>
                      1 XNT ≈ {(swapEstimate.data?.rate || 0).toFixed(6)} XNM
                    </Text>
                  </View>
                  {swapEstimate.data?.priceImpactPct !== undefined && (
                    <View style={styles.swapDetailRow}>
                      <Text style={styles.swapDetailLabel}>Price Impact</Text>
                      <Text style={styles.swapDetailValue}>
                        {(swapEstimate.data.priceImpactPct * 100).toFixed(2)}%
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Error Message */}
              {swapError && (
                <View style={styles.swapErrorContainer}>
                  <Text style={styles.swapErrorText}>{swapError}</Text>
                </View>
              )}

              {/* Success Message */}
              {swapSignature && (
                <View style={styles.swapSuccessContainer}>
                  <Text style={styles.swapSuccessText}>✓ Swap Successful!</Text>
                  <Text style={styles.swapSignatureText}>
                    Signature: {swapSignature.slice(0, 8)}...
                    {swapSignature.slice(-8)}
                  </Text>
                  <TouchableOpacity
                    style={styles.swapViewExplorerButton}
                    onPress={() => {
                      const explorerUrl = `${currentNetwork.explorerUrl}/tx/${swapSignature}`;
                      Linking.openURL(explorerUrl).catch((err) =>
                        console.error("Failed to open explorer:", err)
                      );
                    }}
                  >
                    <Text style={styles.swapViewExplorerText}>
                      View in Explorer →
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* Swap Button */}
            <View
              style={[
                styles.swapButtonContainer,
                { paddingBottom: insets.bottom + 16 },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.swapButton,
                  (!swapEstimate || swapConfirming || swapSignature) &&
                    styles.swapButtonDisabled,
                ]}
                onPress={executeSwap}
                disabled={Boolean(
                  !swapEstimate || swapConfirming || swapSignature
                )}
              >
                {swapConfirming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.swapButtonText}>
                    {swapSignature ? "Swap Complete" : "Swap"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaViewContext>
        </Modal>
      )}

      {/* Settings - Full Page - Outside GestureHandler */}
      {showSettingsModal && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            elevation: 10,
          }}
        >
          <View style={[styles.debugFullPageContainer, { paddingTop: 40 }]}>
            {/* Header */}
            <View style={styles.debugFullPageHeader}>
              {settingsNavigationStack[settingsNavigationStack.length - 1] ===
                "changeSeed" && changeSeedPhraseMode === "generate" ? (
                <TouchableOpacity onPress={handleGenerateNewSeedPhrase}>
                  <Text style={[styles.debugFullPageClose, { fontSize: 31 }]}>
                    ⟳
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 32 }} />
              )}
              <Text style={styles.debugFullPageTitle}>
                {settingsNavigationStack.length === 0
                  ? "Settings"
                  : settingsNavigationStack[
                        settingsNavigationStack.length - 1
                      ] === "manageSecurity"
                    ? "Manage Security"
                    : settingsNavigationStack[
                          settingsNavigationStack.length - 1
                        ] === "preferences"
                      ? "Preferences"
                      : settingsNavigationStack[
                            settingsNavigationStack.length - 1
                          ] === "exportSeed"
                        ? "Export Seed Phrase"
                        : "Change Seed Phrase"}
              </Text>
              <TouchableOpacity
                onPress={
                  settingsNavigationStack.length > 0
                    ? navigateBackInSettings
                    : closeAllSettings
                }
              >
                <Text style={styles.debugFullPageClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Account Badge (only on main settings) */}
            {settingsNavigationStack.length === 0 && (
              <View
                style={[
                  styles.settingsHeaderLeft,
                  {
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    paddingBottom: 8,
                  },
                ]}
              >
                <View
                  style={[
                    styles.settingsAccountBadge,
                    { backgroundColor: selectedAccount.badgeColor },
                  ]}
                >
                  <Text style={styles.settingsAccountBadgeText}>
                    {selectedAccount.badge}
                  </Text>
                </View>
                <Text style={styles.settingsAccountName}>
                  {selectedAccount.name}
                </Text>
              </View>
            )}

            {/* Menu Items */}
            <ScrollView
              style={styles.settingsMenuList}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 20,
              }}
            >
              {settingsNavigationStack.length === 0 ? (
                // Main Settings Menu
                <>
                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => {
                      setShowSettingsModal(false);
                      networkSheetRef.current?.present();
                    }}
                  >
                    <Text style={styles.settingsMenuItemText}>Network</Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => {
                      setShowSettingsModal(false);
                      setShowBluetoothDrawer(true);
                      fetchPairedBluetoothDevices();
                    }}
                  >
                    <Text style={styles.settingsMenuItemText}>
                      Bluetooth Devices
                    </Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => {
                      navigateToSettingsScreen("preferences");
                    }}
                  >
                    <Text style={styles.settingsMenuItemText}>Preferences</Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => {
                      // Require PIN/biometric authentication before accessing security settings
                      if (!securityAuthenticated) {
                        setPendingAuthScreen("manageSecurity");
                        setSecurityAuthRequired(true);
                      } else {
                        navigateToSettingsScreen("manageSecurity");
                      }
                    }}
                  >
                    <Text style={styles.settingsMenuItemText}>
                      Manage Security
                    </Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => {
                      setShowSettingsModal(false);
                      if (Platform.OS === "android") {
                        Linking.sendIntent("android.settings.WIFI_SETTINGS");
                      } else {
                        Linking.openURL("app-settings:");
                      }
                    }}
                  >
                    <Text style={styles.settingsMenuItemText}>
                      WiFi Settings
                    </Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => {
                      setShowSettingsModal(false);
                      Toast.show({
                        type: "info",
                        text1: "About X1 Wallet",
                        text2: "About X1 Wallet info would open here",
                        position: "bottom",
                      });
                    }}
                  >
                    <Text style={styles.settingsMenuItemText}>
                      About X1 Wallet
                    </Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => {
                      setShowSettingsModal(false);
                      setShowDebugDrawer(true);
                    }}
                  >
                    <Text style={styles.settingsMenuItemText}>Debug</Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  {/* Lock App Button */}
                  <TouchableOpacity
                    style={[
                      styles.settingsMenuItem,
                      {
                        marginTop: 20,
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255, 255, 255, 0.1)",
                      },
                    ]}
                    onPress={() => {
                      setShowSettingsModal(false);
                      // Add delay to ensure modal closes before locking
                      setTimeout(() => {
                        setAuthState("locked");
                      }, 300);
                    }}
                  >
                    <Text style={styles.settingsMenuItemText}>Lock</Text>
                    <Text style={styles.settingsMenuItemArrow}>🔒</Text>
                  </TouchableOpacity>
                </>
              ) : settingsNavigationStack[
                  settingsNavigationStack.length - 1
                ] === "manageSecurity" ? (
                // Manage Security Menu
                <>
                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => navigateToSettingsScreen("changePin")}
                  >
                    <Text style={styles.settingsMenuItemText}>Change PIN</Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() =>
                      navigateToSettingsScreen("biometricSettings")
                    }
                  >
                    <Text style={styles.settingsMenuItemText}>
                      Biometric Unlock
                    </Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => navigateToSettingsScreen("exportSeed")}
                  >
                    <Text style={styles.settingsMenuItemText}>
                      Export Seed Phrase
                    </Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => navigateToSettingsScreen("changeSeed")}
                  >
                    <Text style={styles.settingsMenuItemText}>
                      Change Seed Phrase
                    </Text>
                    <Text style={styles.settingsMenuItemArrow}>›</Text>
                  </TouchableOpacity>

                  {/* Clear PIN Button */}
                  <TouchableOpacity
                    style={[
                      styles.settingsMenuItem,
                      {
                        marginTop: 20,
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255, 255, 255, 0.1)",
                      },
                    ]}
                    onPress={async () => {
                      try {
                        Toast.show({
                          type: "info",
                          text1: "Clearing PIN",
                          text2: "Removing authentication settings...",
                          position: "bottom",
                        });

                        // Get the existing master password before clearing
                        const existingPassword =
                          await AuthManager.getMasterPassword();

                        // Clear PIN and biometric data using correct SecureStore keys
                        const secureAvailable =
                          await SecureStore.isAvailableAsync();
                        if (secureAvailable) {
                          // Use the correct SecureStore keys from AuthManager
                          const authKeys = [
                            "pin_config", // Contains PIN hash and salt
                            "biometric_password", // Biometric-protected password
                          ];

                          for (const key of authKeys) {
                            try {
                              await SecureStore.deleteItemAsync(key);
                            } catch (e) {
                              console.log(`Could not delete ${key}:`, e);
                            }
                          }
                        }

                        // Also clear biometric preference and lock state from AsyncStorage
                        try {
                          await AsyncStorage.multiRemove([
                            "@wallet:biometricPreference",
                            "@wallet:pinLockState",
                          ]);
                        } catch (e) {
                          console.log("Could not clear AsyncStorage keys:", e);
                        }

                        // Reset auth state to setup to trigger new PIN creation
                        // Keep the existing password so new PIN can be associated with it
                        setPassword(existingPassword);
                        setSecurityAuthenticated(false);
                        setSecurityAuthRequired(false);
                        setShowSettingsModal(false);
                        setAuthState("setup");

                        Toast.show({
                          type: "success",
                          text1: "PIN Cleared",
                          text2: "Please set up a new PIN to continue.",
                          position: "bottom",
                        });
                      } catch (error) {
                        console.error("Error clearing PIN:", error);
                        Toast.show({
                          type: "error",
                          text1: "Error",
                          text2: "Failed to clear PIN. Please try again.",
                          position: "bottom",
                        });
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.settingsMenuItemText,
                        { color: "#FFA500" },
                      ]}
                    >
                      Clear PIN & Biometrics
                    </Text>
                    <Text style={styles.settingsMenuItemArrow}>🗑️</Text>
                  </TouchableOpacity>
                </>
              ) : settingsNavigationStack[
                  settingsNavigationStack.length - 1
                ] === "preferences" ? (
                // Preferences Menu
                <>
                  <TouchableOpacity
                    style={[
                      styles.settingsMenuItem,
                      {
                        marginTop: 20,
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255, 255, 255, 0.1)",
                      },
                    ]}
                    onPress={() => {
                      // Require PIN/biometric authentication before resetting wallet
                      if (!securityAuthenticated) {
                        setPendingAuthScreen("preferences");
                        setPendingResetWallet(true);
                        setSecurityAuthRequired(true);
                      } else {
                        // Show confirmation dialog
                        handleResetWalletConfirmation();
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.settingsMenuItemText,
                        { color: "#EF4444" },
                      ]}
                    >
                      Reset Wallet
                    </Text>
                    <Text style={styles.settingsMenuItemArrow}>⚠️</Text>
                  </TouchableOpacity>
                </>
              ) : settingsNavigationStack[
                  settingsNavigationStack.length - 1
                ] === "changePin" ? (
                // Change PIN Screen
                <ChangePin
                  onComplete={() => {
                    setShowSettingsModal(false);
                    setSettingsNavigationStack(["main"]);
                  }}
                  onCancel={() => {
                    setSettingsNavigationStack(["manageSecurity"]);
                  }}
                />
              ) : settingsNavigationStack[
                  settingsNavigationStack.length - 1
                ] === "biometricSettings" ? (
                // Biometric Settings Screen
                <BiometricSettings
                  password={password}
                  onBack={() => {
                    setSettingsNavigationStack(["manageSecurity"]);
                  }}
                />
              ) : settingsNavigationStack[
                  settingsNavigationStack.length - 1
                ] === "exportSeed" ? (
                // Export Seed Phrase Screen
                <View
                  style={[
                    styles.bottomSheetContent,
                    { backgroundColor: easterEggMode ? "#111827" : "#000" },
                  ]}
                >
                  {masterSeedPhrase ? (
                    <>
                      <Text style={styles.seedPhraseTitle}>
                        Your Master Seed Phrase
                      </Text>
                      <View style={styles.seedPhraseContainer}>
                        <TouchableOpacity
                          style={styles.seedPhraseCopyBtnInside}
                          onPress={handleCopyMasterSeedPhrase}
                        >
                          <Text style={styles.seedPhraseCopyIconInside}>⧉</Text>
                        </TouchableOpacity>
                        <View style={styles.seedPhraseGrid}>
                          {masterSeedPhrase.split(" ").map((word, index) => (
                            <View key={index} style={styles.seedPhraseWord}>
                              <Text style={styles.seedPhraseText}>
                                {index + 1}. {word}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <Text style={styles.seedPhraseWarning}>
                        Keep this seed phrase secure. All your HD wallets are
                        derived from this master seed.
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.seedPhraseWarning}>
                      No master seed phrase found. Create a new wallet to
                      generate one.
                    </Text>
                  )}
                </View>
              ) : (
                // Change Seed Phrase Screen
                <View
                  style={[
                    styles.bottomSheetContent,
                    { backgroundColor: easterEggMode ? "#111827" : "#000" },
                  ]}
                >
                  {/* Mode Selector */}
                  <View
                    style={{
                      flexDirection: "row",
                      marginBottom: 20,
                      borderBottomWidth: 1,
                      borderBottomColor: "#333",
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderBottomWidth:
                          changeSeedPhraseMode === "enter" ? 2 : 0,
                        borderBottomColor: "#4A90E2",
                      }}
                      onPress={() => setChangeSeedPhraseMode("enter")}
                    >
                      <Text
                        style={{
                          color:
                            changeSeedPhraseMode === "enter"
                              ? "#4A90E2"
                              : "#888",
                          textAlign: "center",
                          fontSize: 16,
                          fontWeight:
                            changeSeedPhraseMode === "enter" ? "600" : "400",
                        }}
                      >
                        Enter Existing
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderBottomWidth:
                          changeSeedPhraseMode === "generate" ? 2 : 0,
                        borderBottomColor: "#4A90E2",
                      }}
                      onPress={() => {
                        setChangeSeedPhraseMode("generate");
                        handleGenerateNewSeedPhrase();
                      }}
                    >
                      <Text
                        style={{
                          color:
                            changeSeedPhraseMode === "generate"
                              ? "#4A90E2"
                              : "#888",
                          textAlign: "center",
                          fontSize: 16,
                          fontWeight:
                            changeSeedPhraseMode === "generate" ? "600" : "400",
                        }}
                      >
                        Generate New
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {changeSeedPhraseMode === "enter" ? (
                    <>
                      <Text
                        style={[styles.seedPhraseWarning, { color: "#888" }]}
                      >
                        Enter your new 12-word seed phrase:
                      </Text>
                      <TextInput
                        style={styles.seedPhraseInput}
                        value={newSeedPhraseInput}
                        onChangeText={setNewSeedPhraseInput}
                        placeholder="word1 word2 word3 ..."
                        placeholderTextColor="#666"
                        multiline
                      />
                      <TouchableOpacity
                        style={styles.dangerButton}
                        onPress={handleChangeSeedPhrase}
                      >
                        <Text style={styles.dangerButtonText}>
                          Change Seed Phrase
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={styles.seedPhraseContainer}>
                        <TouchableOpacity
                          style={styles.seedPhraseCopyBtnInside}
                          onPress={copyGeneratedSeedPhrase}
                        >
                          <Text
                            style={[
                              styles.seedPhraseCopyIconInside,
                              { fontSize: 20.4 },
                            ]}
                          >
                            ⧉
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.seedPhraseGrid}>
                          {generatedNewSeed.split(" ").map((word, index) => (
                            <View key={index} style={styles.seedPhraseWord}>
                              <Text style={styles.seedPhraseText}>
                                {index + 1}. {word}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.dangerButton}
                        onPress={() => {
                          handleChangeSeedPhrase(generatedNewSeed);
                        }}
                      >
                        <Text style={styles.dangerButtonText}>
                          Change Seed Phrase
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <Text style={[styles.seedPhraseWarning, { marginTop: 20 }]}>
                    ⚠️ WARNING: Changing your master seed phrase will only
                    affect newly created wallets. Existing wallets will remain
                    unchanged and will continue to use their original seed
                    phrases.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Security Settings Authentication Overlay */}
      {securityAuthRequired && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            elevation: 11,
            backgroundColor: easterEggMode ? "#111827" : "#000",
          }}
        >
          <PinUnlock
            onUnlock={(recoveredPassword) => {
              setSecurityAuthRequired(false);
              setSecurityAuthenticated(true);
              const targetScreen = pendingAuthScreen || "manageSecurity";
              const shouldResetWallet = pendingResetWallet;
              setPendingAuthScreen(null);
              setPendingResetWallet(false);

              if (targetScreen === "preferences") {
                // Navigate to preferences if not already there
                if (
                  settingsNavigationStack[
                    settingsNavigationStack.length - 1
                  ] !== "preferences"
                ) {
                  navigateToSettingsScreen("preferences");
                }
                // Auto-trigger reset confirmation if pending
                if (shouldResetWallet) {
                  setTimeout(() => {
                    handleResetWalletConfirmation();
                  }, 300);
                }
              } else {
                navigateToSettingsScreen(targetScreen);
              }
            }}
          />
        </View>
      )}

      {showAuthForPrivateKey && (
        <Modal
          transparent={false}
          visible={showAuthForPrivateKey}
          animationType="fade"
          onRequestClose={() => {
            setShowAuthForPrivateKey(false);
          }}
          statusBarTranslucent
        >
          <PinUnlock
            onUnlock={() => {
              setShowAuthForPrivateKey(false);
              setTimeout(() => {
                privateKeySheetRef.current?.present();
              }, 100);
            }}
          />
        </Modal>
      )}

      {/* Toast notifications */}
      <Toast
        config={{
          success: (props) => (
            <View
              style={{
                backgroundColor: "#1a1a1a",
                padding: 16,
                borderRadius: 8,
                borderLeftWidth: 4,
                borderLeftColor: "#00D084",
                minWidth: 300,
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}
              >
                {props.text1}
              </Text>
              {props.text2 && (
                <Text style={{ color: "#999999", fontSize: 12, marginTop: 4 }}>
                  {props.text2}
                </Text>
              )}
            </View>
          ),
          error: (props) => (
            <View
              style={{
                backgroundColor: "#1a1a1a",
                padding: 16,
                borderRadius: 8,
                borderLeftWidth: 4,
                borderLeftColor: "#FF6B6B",
                minWidth: 300,
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}
              >
                {props.text1}
              </Text>
              {props.text2 && (
                <Text style={{ color: "#999999", fontSize: 12, marginTop: 4 }}>
                  {props.text2}
                </Text>
              )}
            </View>
          ),
          info: (props) => (
            <View
              style={{
                backgroundColor: "#1a1a1a",
                padding: 16,
                borderRadius: 8,
                borderLeftWidth: 4,
                borderLeftColor: "#4A90E2",
                minWidth: 300,
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}
              >
                {props.text1}
              </Text>
              {props.text2 && (
                <Text style={{ color: "#999999", fontSize: 12, marginTop: 4 }}>
                  {props.text2}
                </Text>
              )}
            </View>
          ),
        }}
        position="bottom"
        bottomOffset={80}
      />

      {/* Token Chart Modal */}
      <TokenChartModal
        visible={showChartModal}
        onClose={() => setShowChartModal(false)}
        tokenSymbol={selectedChartToken?.symbol}
        tokenName={selectedChartToken?.name}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  safeTopArea: {
    backgroundColor: "#000",
    height: 40,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#000",
    position: "relative",
  },
  viewToggle: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#000",
    gap: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  viewToggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  viewToggleButtonActive: {
    backgroundColor: "#1e3a5f",
  },
  viewToggleText: {
    color: "#999999",
    fontSize: 16,
    fontWeight: "600",
  },
  viewToggleTextActive: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  activityContainer: {
    paddingTop: 0,
  },
  activitySheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  activitySheetTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  sheetHeaderButton: {
    fontSize: 18,
    color: "#888888",
    fontWeight: "400",
  },
  activityDateHeader: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  activityCard: {
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 0,
    marginTop: 8,
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
  activityCardTitleContainer: {
    flexDirection: "column",
  },
  activityCardAddressLabel: {
    color: "#999999",
    fontSize: 12,
    marginTop: 2,
  },
  activityCardTime: {
    color: "#999999",
    fontSize: 12,
    marginTop: 4,
  },
  activityCardAmount: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  activityCardValueContainer: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  activityCardValueUSD: {
    color: "#999999",
    fontSize: 12,
    marginTop: 2,
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
  emptyStateScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  emptyStateSpacer: {
    height: 40,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
    width: "100%",
  },
  emptyStateSubtext: {
    color: "#999999",
    fontSize: 14,
    textAlign: "center",
    width: "100%",
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  topBarCenter: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 12,
  },
  walletDropdown: {
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  walletDropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  walletDropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  walletDropdownText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 8,
    marginRight: 4,
  },
  walletDropdownArrow: {
    color: "#FFFFFF",
    fontSize: 10,
  },
  copyButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333333",
  },
  copyIcon: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  quickSwitchContainer: {
    flexDirection: "row",
    gap: 8,
  },
  quickSwitchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333333",
  },
  quickSwitchButtonActive: {
    borderColor: "#4A90E2",
    borderWidth: 2,
  },
  quickSwitchIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  quickSwitchIconX1: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
  },
  quickSwitchButtonActiveX1: {
    borderColor: "#4A90E2",
    borderWidth: 1.2,
  },
  topBarRightIcons: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  offlineIndicator: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  offlineIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  activityIcon: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  activityIconImage: {
    width: 20,
    height: 20,
    tintColor: "#999999",
  },
  activityIconText: {
    fontSize: 20,
    color: "#999999",
  },
  settingsIcon: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsIconImage: {
    width: 20,
    height: 20,
    tintColor: "#999999",
  },
  settingsIconText: {
    fontSize: 20,
    color: "#999999",
  },
  x1LogoSmall: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
  },
  x1LogoLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  mainContent: {
    flex: 1,
  },
  mainContentContainer: {
    paddingBottom: 80,
  },
  walletSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    position: "absolute",
    left: 16,
  },
  balanceSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: "#000",
  },
  balanceContent: {
    alignItems: "center",
    marginBottom: 24,
  },
  balance: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#888888",
    marginBottom: 8,
  },
  balanceUSD: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  balanceChange: {
    fontSize: 21,
    color: "#888888",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
    marginBottom: 32,
  },
  actionCircle: {
    alignItems: "center",
    gap: 8,
  },
  actionCircleBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  actionCircleBgEnhanced: {
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  actionCircleIcon: {
    fontSize: 26,
    color: "#FFFFFF",
  },
  swapIcon: {
    width: 26,
    height: 26,
    tintColor: "#FFFFFF",
  },
  actionCircleText: {
    fontSize: 12,
    color: "#FFFFFF",
  },
  tokenSection: {
    marginBottom: 24,
  },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
    borderRadius: 12,
    marginBottom: 8,
  },
  tokenRowEnhanced: {
    paddingHorizontal: 16,
    backgroundColor: "#0a0a0a",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1a1a1a",
  },
  tokenLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tokenIconLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  x1LogoLarge: {
    width: 41.6,
    height: 41.6,
    borderRadius: 20.8,
  },
  tokenInfo: {
    gap: 4,
  },
  tokenNameLarge: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  tokenBalanceSmall: {
    fontSize: 12,
    color: "#888888",
  },
  tokenRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  tokenUsdLarge: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  tokenChange: {
    fontSize: 12,
    color: "#00D084",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#4A90E2",
  },
  tabText: {
    fontSize: 14,
    color: "#888888",
  },
  tabTextActive: {
    fontSize: 14,
    color: "#4A90E2",
    fontWeight: "600",
  },
  transactionsList: {
    gap: 8,
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  transactionIconText: {
    fontSize: 20,
    color: "#FFFFFF",
  },
  transactionInfo: {
    gap: 4,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  transactionTime: {
    fontSize: 12,
    color: "#888888",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  bottomBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1a1a1a",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  bottomBadgeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  networkBadgeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  bottomBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888888",
    letterSpacing: 1,
  },
  networkDrawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  networkDrawerContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
  },
  networkDrawerContentArea: {
    padding: 20,
  },
  networkDrawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  networkDrawerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  networkDrawerClose: {
    fontSize: 24,
    color: "#888888",
  },
  networkList: {
    maxHeight: 300,
  },
  networkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    marginBottom: 8,
  },
  networkItemSelected: {
    borderWidth: 1,
    borderColor: "#4A90E2",
  },
  networkItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  networkItemText: {
    fontSize: 16,
    color: "#FFFFFF",
    flex: 1,
  },
  networkItemCheck: {
    fontSize: 20,
    color: "#4A90E2",
  },
  // Bluetooth Drawer Styles
  emptyBluetoothList: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyBluetoothText: {
    fontSize: 16,
    color: "#888888",
    marginBottom: 8,
  },
  emptyBluetoothSubtext: {
    fontSize: 14,
    color: "#666666",
  },
  bluetoothDeviceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
    justifyContent: "space-between",
  },
  bluetoothDeviceInfo: {
    flex: 1,
  },
  bluetoothDeviceName: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  bluetoothDeviceAddress: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 4,
  },
  bluetoothDeviceConnected: {
    fontSize: 12,
    color: "#4A90E2",
  },
  bluetoothDeviceButtons: {
    flexDirection: "row",
    gap: 8,
  },
  bluetoothDeviceConnectButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#4A90E2",
    borderRadius: 8,
  },
  bluetoothDeviceConnectText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  bluetoothDeviceDeleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
  },
  bluetoothDeviceDeleteText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  bluetoothRefreshButton: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: "#4A90E2",
    borderRadius: 8,
    alignItems: "center",
  },
  bluetoothRefreshButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bottomSheetScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 20,
  },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 4,
  },
  bottomSheetClose: {
    fontSize: 24,
    color: "#888888",
  },
  bottomSheetTitleContainer: {
    alignItems: "center",
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  bottomSheetNetworkBadge: {
    fontSize: 11,
    color: "#888888",
    marginTop: 2,
  },
  bottomSheetAdd: {
    fontSize: 37.8,
    color: "#4A90E2",
    fontWeight: "300",
  },
  bottomSheetLogo: {
    alignItems: "center",
    marginBottom: 20,
  },
  x1LogoMedium: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  bottomSheetList: {
    flex: 1,
  },
  bottomSheetWalletItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    marginBottom: 8,
  },
  bottomSheetWalletItemSelected: {
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#4A90E2",
  },
  bottomSheetWalletLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  bottomSheetWalletInfo: {
    marginLeft: 12,
  },
  bottomSheetWalletName: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  bottomSheetWalletAddress: {
    fontSize: 12,
    color: "#888888",
  },
  bottomSheetWalletRight: {
    flexDirection: "row",
    gap: 8,
  },
  bottomSheetCopyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "transparent",
    borderRadius: 6,
  },
  bottomSheetCopyIcon: {
    fontSize: 18,
    color: "#999999",
  },
  bottomSheetMoreBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  bottomSheetMoreText: {
    fontSize: 20,
    color: "#FFFFFF",
  },
  bottomSheetEditBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: -2,
  },
  bottomSheetEditIcon: {
    fontSize: 21.6,
    color: "#FFFFFF",
  },
  bottomSheetAddButton: {
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "transparent",
    marginTop: 8,
  },
  bottomSheetAddButtonText: {
    fontSize: 16,
    color: "#4A90E2",
  },
  bottomSheetFooter: {
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "transparent",
    marginTop: 12,
  },
  bottomSheetFooterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888888",
    letterSpacing: 1,
  },
  accountDrawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  accountDrawerContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
  },
  accountDrawerContentArea: {
    padding: 20,
  },
  accountDrawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  accountDrawerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  accountDrawerClose: {
    fontSize: 24,
    color: "#888888",
  },
  accountList: {
    maxHeight: 300,
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    marginBottom: 8,
  },
  accountItemSelected: {
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#4A90E2",
  },
  accountBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  accountBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  accountItemText: {
    fontSize: 16,
    color: "#FFFFFF",
    flex: 1,
  },
  accountItemCheck: {
    fontSize: 20,
    color: "#4A90E2",
  },
  addAccountButton: {
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
    borderStyle: "dashed",
    marginTop: 12,
  },
  addAccountButtonText: {
    fontSize: 20.8,
    color: "#4A90E2",
  },
  // Settings Drawer Styles
  settingsDrawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  settingsDrawerContent: {
    height: "95%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  settingsDrawerContentArea: {
    flex: 1,
    padding: 20,
  },
  settingsDrawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  settingsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsAccountBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsAccountBadgeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  settingsAccountName: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  settingsDrawerClose: {
    fontSize: 22,
    color: "#888888",
  },
  settingsMenuList: {
    flex: 1,
  },
  settingsMenuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    marginBottom: 8,
  },
  settingsMenuItemText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  settingsMenuItemArrow: {
    fontSize: 20,
    color: "#666666",
  },
  debugFullPageContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  debugFullPageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  debugFullPageTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  debugFullPageClose: {
    fontSize: 22,
    color: "#888888",
    width: 32,
    textAlign: "center",
  },
  debugFullPageFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#000",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  debugLogList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  debugNoLogs: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    paddingVertical: 20,
  },
  debugLogText: {
    fontSize: 12,
    color: "#CCCCCC",
    fontFamily: "monospace",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#0a0a0a",
    borderRadius: 4,
    marginBottom: 4,
  },
  debugClearButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#4A90E2",
    borderRadius: 8,
    alignItems: "center",
  },
  debugClearButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Receive Modal Styles
  receiveQRContainer: {
    alignItems: "center",
    paddingVertical: 30,
  },
  receiveQRWrapper: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 16,
  },
  receiveAddressContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  receiveAddressLabel: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 8,
    textAlign: "center",
  },
  receiveAddressText: {
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "monospace",
  },
  receiveCopyButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#4A90E2",
    borderRadius: 8,
    alignItems: "center",
  },
  receiveCopyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Send Modal Styles
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
  // Address Selector Styles
  addressList: {
    flex: 1,
  },
  addressItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    marginBottom: 8,
  },
  addressItemContent: {
    flex: 1,
  },
  addressItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  addressItemAddress: {
    fontSize: 12,
    color: "#888888",
    fontFamily: "monospace",
  },
  walletOptionButton: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  walletOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  seedPhraseTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 16,
    textAlign: "center",
  },
  seedPhraseContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    minHeight: 100,
    position: "relative",
  },
  seedPhraseCopyBtnInside: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
    backgroundColor: "transparent",
    zIndex: 10,
  },
  seedPhraseCopyIconInside: {
    fontSize: 24,
    color: "#888888",
  },
  seedPhraseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingRight: 48,
    paddingTop: 4,
  },
  seedPhraseWord: {
    width: "50%",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  seedPhraseText: {
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "left",
  },
  seedPhraseWarning: {
    fontSize: 12,
    color: "#FF6B6B",
    marginBottom: 24,
    textAlign: "center",
  },
  confirmButton: {
    backgroundColor: "#4A90E2",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  dangerButton: {
    backgroundColor: "#FF4444",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modeButton: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  modeButtonActive: {
    backgroundColor: "#4A90E2",
    borderColor: "#4A90E2",
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#999999",
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#999999",
    marginBottom: 8,
    marginTop: 16,
  },
  walletNameInput: {
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#333333",
  },
  changeNameButtonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 4,
  },
  changeNameCancelButton: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  changeNameCancelButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  changeNameConfirmButton: {
    flex: 1,
    backgroundColor: "#4A90E2",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  changeNameConfirmButtonDisabled: {
    backgroundColor: "#333333",
    opacity: 0.5,
  },
  changeNameConfirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  showPrivateKeyButton: {
    backgroundColor: "#333333",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  showPrivateKeyButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  privateKeyContainer: {
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#333333",
  },
  privateKeyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  privateKeyLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#999999",
  },
  privateKeyText: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#FFFFFF",
    lineHeight: 18,
  },
  seedPhraseText: {
    fontSize: 14,
    fontFamily: "monospace",
    color: "#FFFFFF",
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  importTypeToggle: {
    flexDirection: "row",
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  importTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
  },
  importTypeButtonActive: {
    backgroundColor: "#1a1a1a",
  },
  importTypeButtonText: {
    fontSize: 14,
    color: "#888888",
  },
  importTypeButtonTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  importInput: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    color: "#FFFFFF",
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  importLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  importDerivationInput: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    color: "#FFFFFF",
    fontSize: 16,
  },
  importHelperText: {
    color: "#888888",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 24,
  },
  // New phrase import styles
  deriveTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
    marginTop: 8,
  },
  deriveInstructions: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    marginBottom: 24,
  },
  phraseControls: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 8,
    alignItems: "center",
  },
  wordCountButton: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#333333",
    alignItems: "center",
  },
  wordCountButtonActive: {
    backgroundColor: "#2a2a2a",
    borderColor: "#4A90E2",
  },
  wordCountButtonText: {
    color: "#888888",
    fontSize: 14,
    fontWeight: "500",
  },
  wordCountButtonTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  pasteButton: {
    backgroundColor: "#4A90E2",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pasteButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  phraseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
    gap: 8,
  },
  phraseWordContainer: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  phraseWordNumber: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "600",
    width: 24,
    marginRight: 8,
  },
  phraseWordInput: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#333333",
  },
  disclaimerContainer: {
    flexDirection: "row",
    marginBottom: 24,
    alignItems: "flex-start",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#4A90E2",
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  checkboxCheck: {
    color: "#4A90E2",
    fontSize: 14,
    fontWeight: "bold",
  },
  disclaimerText: {
    flex: 1,
    color: "#888888",
    fontSize: 12,
    lineHeight: 18,
  },
  findWalletsButton: {
    backgroundColor: "#4A90E2",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  findWalletsButtonDisabled: {
    backgroundColor: "#333333",
    opacity: 0.5,
  },
  findWalletsButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  findWalletsButtonTextDisabled: {
    color: "#888888",
  },
  backButton: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  ledgerStatus: {
    padding: 32,
    alignItems: "center",
  },
  ledgerStatusText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  ledgerStatusSubtext: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
  },
  ledgerAccountsTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  ledgerAccountsList: {
    flex: 1,
  },
  ledgerAccount: {
    backgroundColor: "#1a1a1a",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  ledgerAccountLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  ledgerAccountInfo: {
    flex: 1,
  },
  ledgerAccountIndex: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 4,
  },
  ledgerAccountAddress: {
    fontSize: 12,
    color: "#888888",
    fontFamily: "monospace",
  },
  // Browser styles
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  closeButton: {
    fontSize: 24,
    color: "#888888",
    fontWeight: "300",
  },
  urlInputContainer: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#333333",
  },
  goButton: {
    backgroundColor: "#4A90E2",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  goButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    overflow: "hidden",
  },
  webView: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: "row",
    backgroundColor: "transparent",
    borderTopWidth: 0,
    paddingTop: 0,
    paddingHorizontal: 20,
    justifyContent: "space-around",
    alignItems: "flex-start",
  },
  bottomTabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  bottomTabIcon: {
    fontSize: 22,
    marginBottom: 4,
    opacity: 0.5,
  },
  bottomTabIconActive: {
    opacity: 1,
  },
  bottomTabIconImage: {
    width: 25,
    height: 25,
    marginBottom: 4,
    opacity: 0.5,
    tintColor: "#888888",
  },
  bottomTabIconImageActive: {
    opacity: 1,
    tintColor: "#4A90E2",
  },
  bottomTabText: {
    fontSize: 11,
    color: "#888888",
    fontWeight: "500",
  },
  bottomTabTextActive: {
    color: "#4A90E2",
    fontWeight: "600",
  },
  // Empty State Styles
  emptyStateContainer: {
    flex: 1,
    position: "relative",
  },
  emptyStateBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  emptyStateGradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  emptyStateContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyStateLogoContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyStateLogoBlur: {
    position: "absolute",
    width: 120,
    height: 120,
    zIndex: 0,
  },
  emptyStateLogo: {
    width: 120,
    height: 120,
    zIndex: 1,
  },
  emptyStateTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 60,
    textAlign: "center",
  },
  emptyStateButtons: {
    width: "100%",
  },
  emptyStateCreateButton: {
    backgroundColor: "#4A90E2",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 16,
  },
  emptyStateCreateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptyStateImportButton: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: "#333333",
  },
  emptyStateImportButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // QR Scanner styles
  scanIcon: {
    width: 24,
    height: 24,
    tintColor: "#888888",
  },
  qrScannerContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  qrOverlayContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  qrOverlayTop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 60,
  },
  qrScannerTopContent: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  qrOverlayMiddle: {
    flexDirection: "row",
    height: 300,
  },
  qrOverlaySide: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  qrScanFrame: {
    width: 300,
    height: 300,
    backgroundColor: "transparent",
    position: "relative",
  },
  qrOverlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  qrScannerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
    textAlign: "center",
  },
  qrScannerSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
  },
  qrScannerCloseButton: {
    backgroundColor: "#4A90E2",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  qrScannerCloseText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // Corner brackets
  qrCornerTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#888888",
  },
  qrCornerTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: "#888888",
  },
  qrCornerBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#888888",
  },
  qrCornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: "#888888",
  },
  loadingContainer: {
    flex: 1,
    position: "relative",
  },
  loadingBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  // Swap Styles
  swapContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  swapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  swapBackButton: {
    fontSize: 18,
    color: "#4A90E2",
    fontWeight: "600",
  },
  swapTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  swapContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  swapSection: {
    marginBottom: 16,
  },
  swapLabel: {
    fontSize: 14,
    color: "#888",
    marginBottom: 8,
    fontWeight: "500",
  },
  swapInputContainer: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  swapInput: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 8,
  },
  swapOutputContainer: {
    minHeight: 48,
    justifyContent: "center",
  },
  swapOutput: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 8,
  },
  swapTokenInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  swapTokenSymbol: {
    fontSize: 16,
    color: "#4A90E2",
    fontWeight: "600",
  },
  swapBalance: {
    fontSize: 14,
    color: "#666",
  },
  swapArrowContainer: {
    alignItems: "center",
    marginVertical: 8,
  },
  swapArrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  swapArrowIcon: {
    fontSize: 20,
    color: "#4A90E2",
    fontWeight: "bold",
  },
  swapDetails: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  swapDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  swapDetailLabel: {
    fontSize: 14,
    color: "#888",
  },
  swapDetailValue: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  swapErrorContainer: {
    backgroundColor: "#2a1111",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#ff4444",
  },
  swapErrorText: {
    fontSize: 14,
    color: "#ff6666",
    textAlign: "center",
  },
  swapSuccessContainer: {
    backgroundColor: "#112a11",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#44ff44",
  },
  swapSuccessText: {
    fontSize: 16,
    color: "#66ff66",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 8,
  },
  swapSignatureText: {
    fontSize: 12,
    color: "#88ff88",
    textAlign: "center",
    fontFamily: "monospace",
    marginBottom: 12,
  },
  swapViewExplorerButton: {
    backgroundColor: "#1a4d1a",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 8,
  },
  swapViewExplorerText: {
    fontSize: 14,
    color: "#66ff66",
    fontWeight: "600",
  },
  swapButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#222",
  },
  swapButton: {
    backgroundColor: "#4A90E2",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
  },
  swapButtonDisabled: {
    backgroundColor: "#333",
    opacity: 0.5,
  },
  swapButtonText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
});

// Export App with SafeAreaProvider and ApolloProvider wrappers
export default function App() {
  return (
    <SafeAreaProvider>
      <ApolloProvider client={apolloClient}>
        <AppContent />
      </ApolloProvider>
    </SafeAreaProvider>
  );
}
