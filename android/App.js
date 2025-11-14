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
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
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
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  Keypair,
  Connection,
  clusterApiUrl,
  PublicKey,
  Transaction,
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
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import QRCode from "react-native-qrcode-svg";
import TransportBLE from "@ledgerhq/react-native-hw-transport-ble";
import AppSolana from "@ledgerhq/hw-app-solana";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { WebView } from "react-native-webview";

// Import native USB Ledger module
const { LedgerUsb } = NativeModules;

// Network configurations
const API_SERVER = "http://162.250.126.66:4000";
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

export default function App() {
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [selectedAccount, setSelectedAccount] = useState(MOCK_ACCOUNTS[0]);
  const [balance, setBalance] = useState("0");
  const [balanceUSD, setBalanceUSD] = useState("$0.00");
  const [tokenPrice, setTokenPrice] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [balanceCache, setBalanceCache] = useState({});
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

  // Wallet management states
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showImportWalletModal, setShowImportWalletModal] = useState(false);
  const [newMnemonic, setNewMnemonic] = useState("");
  const [importMnemonic, setImportMnemonic] = useState("");
  const [importPrivateKey, setImportPrivateKey] = useState("");
  const [importType, setImportType] = useState("mnemonic"); // "mnemonic" or "privateKey"
  const [importDerivationIndex, setImportDerivationIndex] = useState("0");
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
  const [ledgerConnecting, setLedgerConnecting] = useState(false);
  const [ledgerDeviceName, setLedgerDeviceName] = useState(null);
  const [ledgerDeviceId, setLedgerDeviceId] = useState(null); // Store device ID to skip scanning
  const [ledgerDeviceInfo, setLedgerDeviceInfo] = useState(null); // Store device info (name, id)
  const [ledgerConnectionType, setLedgerConnectionType] = useState("usb"); // 'usb' or 'bluetooth'
  const ledgerTransportRef = useRef(null); // Store transport reference for cleanup
  const ledgerScanSubscriptionRef = useRef(null); // Store scan subscription for cleanup
  const ledgerCleaningRef = useRef(false); // Prevent concurrent cleanup
  const ledgerCleanedUpRef = useRef(false); // Track if cleanup has already been completed

  // Send and Receive states
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendConfirming, setSendConfirming] = useState(false);
  const [sendSignature, setSendSignature] = useState("");
  const [sendError, setSendError] = useState("");

  // Browser/WebView states
  const [browserUrl, setBrowserUrl] = useState(
    "http://162.250.126.66:4000/test"
  );
  const [browserInputUrl, setBrowserInputUrl] = useState(
    "http://162.250.126.66:4000/test"
  );
  const [showTestBrowser, setShowTestBrowser] = useState(false);
  const webViewRef = useRef(null);

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

  const snapPoints = useMemo(() => ["50%", "90%"], []);

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

  // Load wallets and master seed phrase on mount
  useEffect(() => {
    loadWalletsFromStorage();
    loadMasterSeedPhrase();
    loadDerivationIndex();
  }, []);

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

  // Check network connectivity after 5 seconds
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (hasCheckedNetwork) return;

      try {
        const netInfoState = await NetInfo.fetch();

        if (!netInfoState.isConnected || !netInfoState.isInternetReachable) {
          Alert.alert(
            "No Network Connection",
            "Please open Settings and connect to WiFi to use this app.",
            [
              {
                text: "Open Settings",
                onPress: () => {
                  if (Platform.OS === "android") {
                    Linking.openSettings();
                  } else {
                    Linking.openURL("app-settings:");
                  }
                },
              },
              { text: "Cancel", style: "cancel" },
            ]
          );
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
      const cacheKey = `${selectedWallet.publicKey}-${activeNetwork.providerId}`;

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
        const price = data.tokens[0]?.price || 0;

        const formattedTokens = data.tokens.map((token, idx) => ({
          id: String(idx + 1),
          name: token.symbol,
          balance: token.balance.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 5,
          }),
          usdValue: `${token.valueUSD.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          icon:
            token.symbol === "XNT" ? "💎" : token.symbol === "SOL" ? "◎" : "🪙",
        }));

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
      console.error("Error checking balance:", error);
    }
  };

  // Fetch transactions
  const checkTransactions = async (network = null) => {
    if (!selectedWallet) return;
    try {
      const activeNetwork = network || currentNetwork;
      const url = `${API_SERVER}/transactions/${selectedWallet.publicKey}?providerId=${activeNetwork.providerId}`;
      console.log("Fetching fresh transactions from:", url);

      const response = await fetch(url);
      console.log(
        `Transactions API Response: ${response.status} ${response.statusText}`
      );
      const data = await response.json();
      console.log(
        `Received ${data?.transactions?.length || 0} transactions from API`
      );
      console.log("Full API response:", JSON.stringify(data, null, 2));

      if (data && data.transactions) {
        const formattedTransactions = data.transactions.map((tx) => {
          // Handle both Unix timestamp (number) and ISO string formats
          let date;
          if (typeof tx.timestamp === "string") {
            date = new Date(tx.timestamp);
          } else if (typeof tx.timestamp === "number") {
            date = new Date(tx.timestamp * 1000);
          } else {
            date = new Date();
          }
          const isValidDate = !isNaN(date.getTime());

          // Parse amount - could be string or number
          const amountNum =
            typeof tx.amount === "string"
              ? parseFloat(tx.amount)
              : tx.amount || 0;

          // Map transaction type to display type
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

          return {
            id: tx.hash || tx.signature,
            type: displayType,
            amount: amountNum.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 9,
            }),
            token: tx.tokenSymbol || tx.symbol || getNativeTokenInfo().symbol,
            timestamp: isValidDate
              ? date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : "Unknown",
            fee: tx.fee || "0.000001650",
            signature: tx.hash || tx.signature,
          };
        });

        console.log(
          `Setting ${formattedTransactions.length} formatted transactions to state`
        );
        console.log("First transaction:", formattedTransactions[0]);
        setTransactions(formattedTransactions);
      } else {
        console.log("No transactions in response or invalid response format");
      }
    } catch (error) {
      console.error("Error checking transactions:", error);
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

  // Load initial balance
  useEffect(() => {
    if (!selectedWallet) return;
    checkBalance();
    checkTransactions();
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
    checkTransactions(network);
    networkSheetRef.current?.close();
  };

  const selectWallet = (wallet) => {
    setWallets(wallets.map((w) => ({ ...w, selected: w.id === wallet.id })));
    setSelectedWallet(wallet);
    bottomSheetRef.current?.close();
  };

  // Settings navigation helpers
  const navigateToSettingsScreen = (screen) => {
    setSettingsNavigationStack([...settingsNavigationStack, screen]);
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

    Alert.alert(
      "Delete Wallet",
      `Are you sure you want to delete "${wallet.name}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            console.log("Delete cancelled for wallet:", wallet.name);
          },
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
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

            Alert.alert("Success", "Wallet deleted successfully");
          },
        },
      ]
    );
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
      seedPhraseSheetRef.current?.expand();
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
    accountSheetRef.current?.close();
  };

  const showWalletSelector = () => {
    bottomSheetRef.current?.expand();
  };

  const showNetworkSelector = () => {
    networkSheetRef.current?.expand();
  };

  const showAccountSelector = () => {
    accountSheetRef.current?.expand();
  };

  const handleReceive = () => {
    receiveSheetRef.current?.expand();
  };

  const handleSend = () => {
    sendSheetRef.current?.expand();
  };

  const copyToClipboard = (text) => {
    console.log("📋 Copying to clipboard:", text);
    console.log("📋 Text length:", text?.length);
    console.log("📋 selectedWallet.address:", selectedWallet?.address);
    console.log("📋 selectedWallet.publicKey:", selectedWallet?.publicKey);
    Clipboard.setString(text);
    Alert.alert("Copied", "Address copied to clipboard");
  };

  const handleSendSubmit = async () => {
    // Dismiss keyboard when Send button is pressed
    Keyboard.dismiss();

    if (!selectedWallet) {
      Alert.alert("Error", "No wallet selected");
      return;
    }
    if (!sendAddress || !sendAmount) {
      Alert.alert("Error", "Please enter both address and amount");
      return;
    }

    // Trim the address to remove any whitespace
    const trimmedAddress = sendAddress.trim();

    // Validate address format
    try {
      new PublicKey(trimmedAddress);
    } catch (e) {
      Alert.alert("Error", "Invalid recipient address");
      return;
    }

    // Validate amount
    const amountNum = parseFloat(sendAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Error", "Invalid amount");
      return;
    }

    // Close send drawer and show confirmation screen
    sendSheetRef.current?.close();
    setShowSendConfirm(true);
    setSendConfirming(true);
    setSendError("");

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

        // Connect to Ledger via BLE
        const transport = await TransportBLE.open(deviceId);
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

        // Disconnect from Ledger
        await transport.close();
        console.log("Ledger disconnected");
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

      // Show elegant toast with clickable transaction link
      const explorerUrl = `${currentNetwork.explorerUrl}/tx/${signature}`;
      const toastMessage = `✅ Transaction confirmed!\nTap to view: ${signature.substring(0, 8)}...${signature.substring(signature.length - 8)}`;

      if (Platform.OS === "android") {
        ToastAndroid.showWithGravityAndOffset(
          toastMessage,
          ToastAndroid.LONG,
          ToastAndroid.BOTTOM,
          0,
          100
        );

        // Open explorer URL after short delay to allow user to see toast
        setTimeout(() => {
          Alert.alert("Transaction Successful", `View on explorer?`, [
            {
              text: "View Transaction",
              onPress: () => Linking.openURL(explorerUrl),
            },
            { text: "Close", style: "cancel" },
          ]);
        }, 1000);
      }

      // Refresh balance after a short delay
      setTimeout(() => {
        checkBalance(currentNetwork, false); // Force refresh without cache
      }, 2000);
    } catch (error) {
      console.error("Send transaction error:", error);
      setSendConfirming(false);
      setSendError(error.message || "Transaction failed");
    }
  };

  const handleSwap = () => {
    Alert.alert("Swap", "Swap functionality would open here");
  };

  const handleStake = () => {
    Alert.alert("Stake", "Stake functionality would open here");
  };

  const handleBridge = () => {
    Alert.alert("Bridge", "Bridge functionality would open here");
  };

  const copyAddress = () => {
    Clipboard.setString(selectedWallet.publicKey);
  };

  // Browser WebView message handler
  const handleWebViewMessage = async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
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
                // Connect to Ledger via BLE
                const transport = await TransportBLE.open(deviceId);
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

                // Disconnect from Ledger
                await transport.close();
                console.log("Ledger disconnected");
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
                  ledgerError.message.includes("0x6985")
                ) {
                  errorMessage +=
                    "Transaction rejected by user on Ledger device.";
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

    // If master seed phrase already exists, create wallet directly without showing seed phrase
    if (masterSeedPhrase) {
      console.log("Master seed phrase exists, creating wallet directly");
      await handleConfirmCreateWallet();
      return;
    }

    // First wallet - generate master seed phrase and show it for backup
    const newMasterSeed = bip39.generateMnemonic();
    setMasterSeedPhrase(newMasterSeed);
    await saveMasterSeedPhrase(newMasterSeed);
    setNewMnemonic(newMasterSeed);
    console.log("Generated and saved new master seed phrase");
    setShowCreateWalletModal(true);
  };

  const handleShowImportWallet = () => {
    setShowAddWalletModal(false);
    setImportType("mnemonic");
    setImportMnemonic("");
    setImportPrivateKey("");
    setImportDerivationIndex("0");
    setShowImportWalletModal(true);
  };

  const copySeedPhrase = () => {
    Clipboard.setString(newMnemonic);
    ToastAndroid.show("Copied to clipboard", ToastAndroid.SHORT);
  };

  const copyGeneratedSeedPhrase = () => {
    Clipboard.setString(generatedNewSeed);
    ToastAndroid.show("Copied to clipboard", ToastAndroid.SHORT);
  };

  const handleImportWallet = async () => {
    try {
      let keypair;
      let derivationPath = null;
      let mnemonicForWallet = null;
      const normalizedMnemonic = importMnemonic
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

      if (importType === "mnemonic") {
        if (!bip39.validateMnemonic(normalizedMnemonic)) {
          Alert.alert("Error", "Invalid recovery phrase");
          return;
        }

        const parsedIndex = parseInt(importDerivationIndex, 10);
        if (Number.isNaN(parsedIndex) || parsedIndex < 0) {
          Alert.alert(
            "Error",
            "Derivation index must be a non-negative number"
          );
          return;
        }

        requestedDerivationIndex = parsedIndex;
        const seed = await bip39.mnemonicToSeed(normalizedMnemonic);
        derivationPath = `m/44'/501'/${parsedIndex}'/0'`;

        const hdkey = slip10.fromMasterSeed(seed);
        const derivedKey = hdkey.derive(derivationPath);
        keypair = Keypair.fromSeed(derivedKey.privateKey);
        mnemonicForWallet = normalizedMnemonic;

        if (!masterSeedPhrase) {
          setMasterSeedPhrase(normalizedMnemonic);
          await saveMasterSeedPhrase(normalizedMnemonic);
        }

        if (walletDerivationIndex <= parsedIndex) {
          const nextIndex = parsedIndex + 1;
          setWalletDerivationIndex(nextIndex);
          await saveDerivationIndex(nextIndex);
        }
      } else {
        // Import from private key (try bs58 first, then JSON array)
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
            Alert.alert(
              "Error",
              "Invalid private key format. Use bs58 or JSON array format."
            );
            return;
          }
        }
      }

      // Check for duplicate wallet
      const publicKeyStr = keypair.publicKey.toString();
      const isDuplicate = wallets.some((w) => w.publicKey === publicKeyStr);

      if (isDuplicate) {
        Alert.alert("Duplicate Wallet", "This wallet has already been added.");
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
        derivationPath,
      };

      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);
      await saveWalletsToStorage(updatedWallets);

      if (
        mnemonicForWallet &&
        masterSeedPhrase &&
        masterSeedPhrase !== mnemonicForWallet
      ) {
        await saveWalletMnemonicSecurely(newWallet.id, mnemonicForWallet);
      }

      setImportMnemonic("");
      setImportPrivateKey("");
      setImportDerivationIndex("0");
      setShowImportWalletModal(false);

      // Register the wallet with the transaction indexer
      await registerWalletWithIndexer(publicKeyStr, currentNetwork.providerId);
    } catch (error) {
      Alert.alert("Error", "Failed to import wallet: " + error.message);
    }
  };

  const handleConfirmCreateWallet = async () => {
    try {
      // Use master seed phrase for derivation
      const seedPhraseToUse = masterSeedPhrase || newMnemonic;
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
        Alert.alert("Duplicate Wallet", "This wallet has already been added.");
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
      };

      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);
      await saveWalletsToStorage(updatedWallets);

      // Increment and save derivation index for next wallet
      const nextIndex = walletDerivationIndex + 1;
      setWalletDerivationIndex(nextIndex);
      await saveDerivationIndex(nextIndex);
      console.log(`Wallet created at ${path}, next index: ${nextIndex}`);

      setNewMnemonic("");
      setShowCreateWalletModal(false);
    } catch (error) {
      Alert.alert("Error", "Failed to create wallet: " + error.message);
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
    ToastAndroid.show("New seed phrase generated", ToastAndroid.SHORT);
  };

  const handleConfirmChangeSeedPhrase = async () => {
    let seedToUse = "";

    // Determine which seed phrase to use based on mode
    if (changeSeedPhraseMode === "enter") {
      // Validate entered seed phrase
      if (!newSeedPhraseInput.trim()) {
        Alert.alert("Error", "Please enter a seed phrase");
        return;
      }

      if (!bip39.validateMnemonic(newSeedPhraseInput.trim())) {
        Alert.alert(
          "Error",
          "Invalid seed phrase. Please check and try again."
        );
        return;
      }
      seedToUse = newSeedPhraseInput.trim();
    } else {
      // Use generated seed phrase
      if (!generatedNewSeed) {
        Alert.alert("Error", "Please generate a seed phrase first");
        return;
      }
      seedToUse = generatedNewSeed;
    }

    // Warn user about existing wallets
    Alert.alert(
      "Change Seed Phrase",
      "Changing your seed phrase will affect newly created wallets only. Existing wallets will remain unchanged. Do you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            try {
              setMasterSeedPhrase(seedToUse);
              await saveMasterSeedPhrase(seedToUse);

              // Reset derivation index to 0 for new seed phrase
              setWalletDerivationIndex(0);
              await saveDerivationIndex(0);

              console.log("Master seed phrase changed successfully");
              ToastAndroid.show(
                "Seed phrase changed successfully",
                ToastAndroid.SHORT
              );

              // Reset modal state
              setNewSeedPhraseInput("");
              setGeneratedNewSeed("");
              setChangeSeedPhraseMode("enter");
              closeAllSettings();
            } catch (error) {
              Alert.alert(
                "Error",
                "Failed to change seed phrase: " + error.message
              );
              console.error("Change seed phrase error:", error);
            }
          },
        },
      ]
    );
  };

  const requestBluetoothPermissions = async () => {
    if (Platform.OS === "android" && Platform.Version >= 31) {
      try {
        console.log("Requesting Bluetooth permissions for Android 12+...");
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        console.log("Permission results:", granted);
        const allGranted =
          granted["android.permission.BLUETOOTH_SCAN"] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted["android.permission.BLUETOOTH_CONNECT"] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted["android.permission.ACCESS_FINE_LOCATION"] ===
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
    setShowAddWalletModal(false);

    // Request Bluetooth permissions first
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      Alert.alert(
        "Permissions Required",
        "Bluetooth permissions are required to connect to Ledger.",
        [{ text: "OK", onPress: () => setShowAddWalletModal(true) }]
      );
      return;
    }

    // If Bluetooth device is already stored/connected, skip setup instructions
    if (ledgerDeviceInfo || ledgerDeviceId) {
      console.log("Bluetooth device already known, skipping setup dialog");
      ledgerSheetRef.current?.expand();
      scanForLedger();
      return;
    }

    // Show setup instructions only for first-time connection
    Alert.alert(
      "Ledger Bluetooth Setup",
      "Before connecting, please ensure:\n\n1. Your Ledger is unlocked\n2. The Solana app is open on your Ledger\n3. Bluetooth is enabled on your phone\n\nThe app will automatically pair with your Ledger when you connect.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setShowAddWalletModal(true),
        },
        {
          text: "Continue",
          onPress: () => {
            ledgerSheetRef.current?.expand();
            scanForLedger();
          },
        },
      ],
      { cancelable: false }
    );
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
      Alert.alert("Error", `Failed to fetch paired devices: ${error.message}`);
    }
  };

  // Forget/unpair a Bluetooth device
  const forgetBluetoothDevice = async (deviceId) => {
    try {
      console.log("Forgetting device:", deviceId);

      Alert.alert(
        "Forget Device",
        "Are you sure you want to forget this device? You will need to pair it again to use it.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Forget",
            style: "destructive",
            onPress: () => {
              try {
                // Clear stored device ID and info if it matches
                if (ledgerDeviceId === deviceId) {
                  setLedgerDeviceId(null);
                  setLedgerDeviceInfo(null);
                  console.log("Cleared stored ledger device ID and info");
                }

                // Refresh the list
                fetchPairedBluetoothDevices();

                Alert.alert(
                  "Success",
                  "Device has been forgotten. You will need to reconnect it to use it again."
                );
              } catch (error) {
                console.error("Error forgetting device:", error);
                Alert.alert(
                  "Error",
                  `Failed to forget device: ${error.message}`
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error in forgetBluetoothDevice:", error);
      Alert.alert("Error", `Failed to forget device: ${error.message}`);
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
      console.log("Starting Ledger Bluetooth scan...");

      const subscription = TransportBLE.listen({
        complete: () => {
          console.log("Ledger scan complete");
          setLedgerScanning(false);
        },
        next: async (e) => {
          console.log("Ledger device event received!");
          console.log("Event type:", e.type);
          if (e.type === "add") {
            const device = e.descriptor;
            console.log("Found Ledger device:", device);

            // Unsubscribe immediately to prevent finding the device multiple times
            try {
              subscription.unsubscribe();
              console.log("✓ Stopped scan to prevent duplicate connections");
              ledgerScanSubscriptionRef.current = null;
            } catch (unsubError) {
              console.log("⚠ Error stopping scan:", unsubError.message);
            }

            setLedgerScanning(false);

            // Store device name for UI display
            const deviceName =
              device.deviceName || device.name || "Ledger Device";
            setLedgerDeviceName(deviceName);
            console.log("Device name:", deviceName);

            // Wait for BLE stack to settle after scan cleanup before connecting
            console.log(
              "Waiting for BLE stack to settle after scan cleanup..."
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));

            connectToLedger(device);
          }
        },
        error: (error) => {
          console.error("Ledger scan error:", error);
          setLedgerScanning(false);
          ledgerScanSubscriptionRef.current = null;
          Alert.alert(
            "Scan Error",
            error.message ||
              "Failed to scan for Ledger devices. Make sure Bluetooth is enabled and the Solana app is open on your Ledger."
          );
        },
      });

      // Store subscription for cleanup
      ledgerScanSubscriptionRef.current = subscription;
      console.log("Scan subscription created and stored");

      // Stop scanning after 30 seconds
      setTimeout(() => {
        if (ledgerScanSubscriptionRef.current) {
          ledgerScanSubscriptionRef.current.unsubscribe();
          ledgerScanSubscriptionRef.current = null;
          setLedgerScanning(false);
          console.log(
            "Ledger scan timeout - no devices found after 30 seconds"
          );
        }
      }, 30000);
    } catch (error) {
      setLedgerScanning(false);
      console.error("Error starting Ledger scan:", error);
      Alert.alert("Error", error.message || "Failed to start Ledger scan");
    }
  };

  const connectToLedger = async (device, retryCount = 0) => {
    const MAX_RETRIES = 3;
    let transport = null;

    try {
      setLedgerConnecting(true);

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

      // Disconnect any existing connection to this device before attempting new connection
      try {
        console.log("Disconnecting any existing connection to device...");
        await TransportBLE.disconnect(deviceId);
        console.log("Previous connection disconnected");
        // Wait for BLE stack to settle after disconnect
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (disconnectError) {
        console.log(
          "No active connection to disconnect (or error disconnecting):",
          disconnectError.message
        );
        // Brief wait even if disconnect failed
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log("Opening BLE transport with timeout...");

      // Open transport with timeout (8 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timeout after 8 seconds")),
          8000
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

      // Get first 5 accounts
      const accounts = [];
      for (let i = 0; i < 5; i++) {
        const derivationPath = `44'/501'/${i}'/0'`;
        console.log(`Getting address for path: ${derivationPath}`);
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

        console.log(`Address ${i}: ${addressString}`);

        accounts.push({
          index: i,
          address: addressString,
          derivationPath,
        });
      }

      // DON'T close transport immediately! Keep it alive.
      // This prevents the BLE crash from happening during the RxJava cleanup phase.
      // The transport will be cleaned up when:
      // - User selects an account (handleSelectLedgerAccount)
      // - Modal is dismissed
      // - Next scan is initiated
      console.log("Keeping transport alive for account selection...");
      console.log("Successfully retrieved Ledger accounts!");

      // Set accounts and update state - transport stays alive
      setLedgerAccounts(accounts);
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
        console.log(`Connection cancelled, retrying in ${delayMs}ms...`);

        // Clean up transport if it exists
        if (transport) {
          try {
            await transport.close();
            ledgerTransportRef.current = null;
          } catch (closeError) {
            console.log(
              "Error closing transport (ignoring):",
              closeError.message
            );
            ledgerTransportRef.current = null;
          }
        }

        // Wait for exponential backoff delay
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // Retry connection
        return connectToLedger(device, retryCount + 1);
      }

      // If we've exhausted retries or it's a different error, handle it
      setLedgerConnecting(false);

      // Try to clean up transport if it was created
      if (transport) {
        try {
          await transport.close();
          ledgerTransportRef.current = null;
          console.log("Transport cleaned up after error");
        } catch (closeError) {
          console.log(
            "Error closing transport after error (ignoring):",
            closeError.message
          );
          // Store in ref for cleanup attempt next time
          ledgerTransportRef.current = transport;
        }
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
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage +=
          "Please ensure:\n• Ledger is unlocked\n• Solana app is open on Ledger\n• Accept the pairing request when it appears";
      }

      Alert.alert("Connection Error", errorMessage, [
        { text: "Try Again", onPress: () => scanForLedger() },
        { text: "Cancel" },
      ]);
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

      Alert.alert(
        "USB Connection Error",
        error.message || "Failed to connect to Ledger via USB",
        [{ text: "OK" }]
      );
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
      Alert.alert("Duplicate Wallet", "This wallet has already been added.");
      return;
    }

    const newWallet = {
      id: Date.now(),
      name: `Ledger ${account.index + 1}`,
      address: account.address,
      publicKey: account.address,
      selected: true, // Set new wallet as selected
      isLedger: true,
      derivationPath: account.derivationPath,
      ledgerDeviceId: ledgerDeviceId, // Store device ID for later signing
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

    ledgerSheetRef.current?.close();
    setLedgerAccounts([]);

    // Register the wallet with the transaction indexer
    await registerWalletWithIndexer(account.address, currentNetwork.providerId);

    // Clean up BLE connection after account is selected
    // Run in background to not block UI
    cleanupLedgerBLE().catch((e) =>
      console.log("Cleanup error (ignoring):", e.message)
    );
  };

  const handleSheetChanges = useCallback((index) => {
    console.log("handleSheetChanges", index);
  }, []);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
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
              let url = browserInputUrl.trim();
              if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "http://" + url;
              }
              console.log("Loading URL:", url);
              setBrowserUrl(url);
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
                  // Connect to the wallet and get public key
                  connect: async function() {
                    try {
                      const result = await sendRequest('connect');
                      return result.publicKey;
                    } catch (err) {
                      console.error('x1.connect error:', err);
                      throw err;
                    }
                  },

                  // Sign and send a transaction
                  signAndSendTransaction: async function(transaction, options = {}) {
                    try {
                      // Serialize the transaction to base64
                      let txData;
                      if (transaction.serialize) {
                        // If it's a Transaction object
                        txData = transaction.serialize({
                          requireAllSignatures: false,
                          verifySignatures: false
                        }).toString('base64');
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
              })();
            `}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          <StatusBar hidden={true} />
          {/* Top Header with Safe Area */}
          <View style={styles.safeTopArea} />
          <View style={styles.topBar}>
            {/* Wallet selector on the left */}
            <View style={styles.walletSelectorLeft}>
              <TouchableOpacity
                testID="wallet-selector-button"
                style={styles.walletDropdownButton}
                onPress={showWalletSelector}
              >
                <Image
                  source={currentNetwork.logo}
                  style={styles.x1LogoSmall}
                />
                <Text style={styles.walletDropdownText}>
                  {selectedWallet?.name || "No wallet"}
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
                  currentNetwork.id === "X1" && styles.quickSwitchButtonActive,
                ]}
                onPress={() =>
                  switchNetwork(NETWORKS.find((n) => n.id === "X1"))
                }
              >
                <Image
                  source={require("./assets/x1.png")}
                  style={styles.quickSwitchIcon}
                />
              </TouchableOpacity>
              <TouchableOpacity
                testID="solana-network-button"
                style={[
                  styles.quickSwitchButton,
                  currentNetwork.id === "SOLANA" &&
                    styles.quickSwitchButtonActive,
                ]}
                onPress={() =>
                  switchNetwork(NETWORKS.find((n) => n.id === "SOLANA"))
                }
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
                onPress={() => activitySheetRef.current?.expand()}
              >
                <Image
                  source={require("./assets/clock.png")}
                  style={styles.activityIconImage}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingsIcon}
                onPress={() => {
                  console.log("Settings button pressed!");
                  setShowSettingsModal(true);
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
            style={styles.mainContent}
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
            <View style={styles.balanceSection}>
              {/* Balance display */}
              <View style={styles.balanceContent}>
                <Text style={styles.balanceUSD}>{balanceUSD}</Text>
                <Text style={styles.balanceChange}>
                  {tokenPrice !== null
                    ? `${getNativeTokenInfo().symbol} $${tokenPrice.toLocaleString(
                        "en-US",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}`
                    : "$0.00"}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionCircle}
                  onPress={handleReceive}
                >
                  <View style={styles.actionCircleBg}>
                    <Text style={styles.actionCircleIcon}>▼</Text>
                  </View>
                  <Text style={styles.actionCircleText}>Receive</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCircle}
                  onPress={handleSend}
                >
                  <View style={styles.actionCircleBg}>
                    <Text style={styles.actionCircleIcon}>▲</Text>
                  </View>
                  <Text style={styles.actionCircleText}>Send</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCircle}
                  onPress={handleSwap}
                >
                  <View style={styles.actionCircleBg}>
                    <Image
                      source={require("./assets/swap.png")}
                      style={styles.swapIcon}
                    />
                  </View>
                  <Text style={styles.actionCircleText}>Swap</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCircle}
                  onPress={handleStake}
                >
                  <View style={styles.actionCircleBg}>
                    <Text style={styles.actionCircleIcon}>◈</Text>
                  </View>
                  <Text style={styles.actionCircleText}>Stake</Text>
                </TouchableOpacity>
              </View>

              {/* Token List */}
              <View style={styles.tokenSection}>
                {tokens.map((token) => {
                  const nativeToken = getNativeTokenInfo();
                  return (
                    <View key={token.id} style={styles.tokenRow}>
                      <View style={styles.tokenLeft}>
                        <View style={styles.tokenIconLarge}>
                          <Image
                            testID={`native-token-icon-${currentNetwork.id.toLowerCase()}`}
                            source={nativeToken.logo}
                            style={styles.x1LogoLarge}
                          />
                        </View>
                        <View style={styles.tokenInfo}>
                          <Text style={styles.tokenNameLarge}>
                            {nativeToken.name}
                          </Text>
                          <Text style={styles.tokenBalanceSmall}>
                            {token.balance} {nativeToken.symbol}
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
            </View>
          </ScrollView>

          {/* Bottom Tab Bar */}
          <View style={styles.bottomTabBar}>
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
                  currentBottomTab === "browser" && styles.bottomTabTextActive,
                ]}
              >
                Browser
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Network Selector Side Drawer */}
        <BottomSheet
          ref={networkSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4A90E2" }}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <TouchableOpacity
                onPress={() => networkSheetRef.current?.close()}
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
                  <Image source={network.logo} style={styles.networkItemIcon} />
                  <Text style={styles.networkItemText}>{network.name}</Text>
                  {currentNetwork.id === network.id && (
                    <Text style={styles.networkItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BottomSheetView>
        </BottomSheet>

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
                      ledgerSheetRef.current?.expand();
                      await scanForLedger();
                    }}
                  >
                    <Text style={styles.bluetoothRefreshButtonText}>Scan</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {/* Wallet Selector Bottom Sheet */}
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          onChange={handleSheetChanges}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4A90E2" }}
        >
          <BottomSheetScrollView
            testID="wallet-list-sheet"
            contentContainerStyle={styles.bottomSheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <TouchableOpacity onPress={() => bottomSheetRef.current?.close()}>
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
                        editWalletSheetRef.current?.expand();
                      }}
                    >
                      <Text style={styles.bottomSheetEditIcon}>⋮</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </BottomSheetScrollView>
        </BottomSheet>

        {/* Account Selector Side Drawer */}
        <BottomSheet
          ref={accountSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4A90E2" }}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <TouchableOpacity
                onPress={() => accountSheetRef.current?.close()}
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
                    <Text style={styles.accountBadgeText}>{account.badge}</Text>
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
          </BottomSheetView>
        </BottomSheet>

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
        <BottomSheet
          ref={receiveSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4A90E2" }}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>
                Receive {getNativeTokenInfo().symbol}
              </Text>
              <TouchableOpacity
                onPress={() => receiveSheetRef.current?.close()}
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
              <Text style={styles.receiveAddressText} numberOfLines={1}>
                {addressCopied
                  ? "Copied"
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
          </BottomSheetView>
        </BottomSheet>

        {/* Send Drawer */}
        <BottomSheet
          ref={sendSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4A90E2" }}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <TouchableOpacity onPress={() => sendSheetRef.current?.close()}>
                <Text style={styles.bottomSheetClose}>✕</Text>
              </TouchableOpacity>
              <View style={styles.bottomSheetTitleContainer}>
                <Text style={styles.bottomSheetTitle}>
                  Send {getNativeTokenInfo().symbol}
                </Text>
              </View>
              <View style={{ width: 24 }} />
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
                  onPress={() => addressSheetRef.current?.expand()}
                >
                  <Text style={styles.sendSelectAddressText}>
                    Select Address
                  </Text>
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
            <TouchableOpacity
              style={styles.sendSubmitButton}
              onPress={handleSendSubmit}
            >
              <Text style={styles.sendSubmitButtonText}>Send</Text>
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheet>

        {/* Address Selector Modal */}
        <BottomSheet
          ref={addressSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4A90E2" }}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Select Address</Text>
              <TouchableOpacity
                onPress={() => addressSheetRef.current?.close()}
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
                    addressSheetRef.current?.close();
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
          </BottomSheetView>
        </BottomSheet>

        {/* Activity Drawer */}
        {/* Activity Bottom Sheet */}
        <BottomSheet
          ref={activitySheetRef}
          index={-1}
          snapPoints={["75%"]}
          enablePanDownToClose={true}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              opacity={0.5}
              enableTouchThrough={false}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              style={[
                { backgroundColor: "rgba(0, 0, 0, 1)" },
                StyleSheet.absoluteFillObject,
              ]}
            />
          )}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4E5056" }}
        >
          {/* Activity List with BottomSheetScrollView */}
          <BottomSheetScrollView
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.activitySheetHeader}>
              <TouchableOpacity onPress={() => checkTransactions()}>
                <Text style={styles.sheetHeaderButton}>↻</Text>
              </TouchableOpacity>
              <Text style={styles.activitySheetTitle}>Activity</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Transactions List */}
            {transactions.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>No transactions yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Your transaction history will appear here
                </Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <TouchableOpacity
                  key={tx.id}
                  style={styles.activityCard}
                  onPress={() => openExplorer(tx.signature)}
                >
                  {/* Token logo */}
                  <Image
                    source={
                      tx.token === "XNT"
                        ? require("./assets/x1.png")
                        : require("./assets/solana.png")
                    }
                    style={styles.activityCardLogo}
                  />

                  <View style={styles.activityCardContent}>
                    {/* Header with title and time */}
                    <View style={styles.activityCardHeader}>
                      <Text style={styles.activityCardTitle}>
                        {tx.type === "received" ? "Received" : "Sent"}{" "}
                        {tx.token}
                      </Text>
                      <Text style={styles.activityCardTime}>
                        {tx.timestamp}
                      </Text>
                    </View>

                    {/* Amount row */}
                    <View style={styles.activityCardRow}>
                      <Text style={styles.activityCardLabel}>Amount</Text>
                      <Text
                        style={[
                          styles.activityCardValue,
                          {
                            color:
                              tx.type === "received" ? "#00D084" : "#FF6B6B",
                          },
                        ]}
                      >
                        {tx.type === "received" ? "+" : "-"}
                        {tx.amount} {tx.token}
                      </Text>
                    </View>

                    {/* Fee row */}
                    <View style={styles.activityCardRow}>
                      <Text style={styles.activityCardLabel}>Fee</Text>
                      <Text style={styles.activityCardValue}>
                        {tx.fee || "0.000001650"} {tx.token}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </BottomSheetScrollView>
        </BottomSheet>

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
              style={styles.settingsDrawerContent}
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
                  <Text style={styles.walletOptionText}>Create New Wallet</Text>
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
            onPress={() => setShowCreateWalletModal(false)}
          >
            <Pressable
              style={styles.settingsDrawerContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.settingsDrawerContentArea}>
                <View style={styles.settingsDrawerHeader}>
                  <View style={{ width: 32 }} />
                  <Text style={styles.settingsDrawerTitle}>Create Wallet</Text>
                  <TouchableOpacity
                    onPress={() => setShowCreateWalletModal(false)}
                  >
                    <Text style={styles.settingsDrawerClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.seedPhraseTitle}>Your Seed Phrase</Text>
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
                    {newMnemonic.split(" ").map((word, index) => (
                      <View key={index} style={styles.seedPhraseWord}>
                        <Text style={styles.seedPhraseText}>
                          {index + 1}. {word}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={styles.seedPhraseWarning}>
                  Save this seed phrase securely. You'll need it to recover your
                  wallet.
                </Text>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirmCreateWallet}
                >
                  <Text style={styles.confirmButtonText}>
                    I've Saved My Seed Phrase
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Import Wallet Modal */}
        <Modal
          visible={showImportWalletModal}
          transparent={true}
          animationType="slide"
        >
          <Pressable
            style={styles.settingsDrawerOverlay}
            onPress={() => setShowImportWalletModal(false)}
          >
            <Pressable
              style={styles.settingsDrawerContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.settingsDrawerContentArea}>
                <View style={styles.settingsDrawerHeader}>
                  <View style={{ width: 32 }} />
                  <Text style={styles.settingsDrawerTitle}>Import Wallet</Text>
                  <TouchableOpacity
                    onPress={() => setShowImportWalletModal(false)}
                  >
                    <Text style={styles.settingsDrawerClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.importTypeToggle}>
                  <TouchableOpacity
                    style={[
                      styles.importTypeButton,
                      importType === "mnemonic" &&
                        styles.importTypeButtonActive,
                    ]}
                    onPress={() => setImportType("mnemonic")}
                  >
                    <Text
                      style={[
                        styles.importTypeButtonText,
                        importType === "mnemonic" &&
                          styles.importTypeButtonTextActive,
                      ]}
                    >
                      Recovery Phrase
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.importTypeButton,
                      importType === "privateKey" &&
                        styles.importTypeButtonActive,
                    ]}
                    onPress={() => setImportType("privateKey")}
                  >
                    <Text
                      style={[
                        styles.importTypeButtonText,
                        importType === "privateKey" &&
                          styles.importTypeButtonTextActive,
                      ]}
                    >
                      Private Key
                    </Text>
                  </TouchableOpacity>
                </View>

                {importType === "mnemonic" ? (
                  <>
                    <TextInput
                      style={styles.importInput}
                      placeholder="Enter your 12-word recovery phrase"
                      placeholderTextColor="#666666"
                      value={importMnemonic}
                      onChangeText={setImportMnemonic}
                      multiline
                      numberOfLines={4}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={styles.importLabel}>
                      Derivation Index (m/44'/501'/index'/0')
                    </Text>
                    <TextInput
                      style={styles.importDerivationInput}
                      placeholder="0"
                      placeholderTextColor="#666666"
                      keyboardType="number-pad"
                      value={importDerivationIndex}
                      onChangeText={(text) =>
                        setImportDerivationIndex(text.replace(/[^0-9]/g, ""))
                      }
                    />
                    <Text style={styles.importHelperText}>
                      Use 0 to recover the first wallet, or increase the index
                      to restore additional accounts derived from the same seed
                      phrase.
                    </Text>
                  </>
                ) : (
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
                )}

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
        <BottomSheet
          ref={editWalletSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4A90E2" }}
        >
          <BottomSheetView
            testID="edit-wallet-sheet"
            style={styles.bottomSheetContent}
          >
            <View style={styles.bottomSheetHeader}>
              <View style={{ width: 32 }} />
              <Text style={styles.bottomSheetTitle}>Edit Wallet</Text>
              <TouchableOpacity
                onPress={() => {
                  editWalletSheetRef.current?.close();
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
                  editWalletSheetRef.current?.close();
                  setShowChangeNameModal(true);
                }}
              >
                <Text style={styles.settingsMenuItemText}>
                  Change Account Name
                </Text>
                <Text style={styles.settingsMenuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="show-private-key-button"
                style={styles.settingsMenuItem}
                onPress={() => {
                  editWalletSheetRef.current?.close();
                  setTimeout(() => {
                    privateKeySheetRef.current?.expand();
                  }, 100);
                }}
              >
                <Text style={styles.settingsMenuItemText}>
                  Show Private Key
                </Text>
                <Text style={styles.settingsMenuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="show-seed-phrase-button"
                style={styles.settingsMenuItem}
                onPress={() => {
                  editWalletSheetRef.current?.close();
                  setWalletSeedPhraseForDisplay(null);
                  setTimeout(() => {
                    openSeedPhraseSheet();
                  }, 100);
                }}
              >
                <Text style={styles.settingsMenuItemText}>
                  Show Seed Phrase
                </Text>
                <Text style={styles.settingsMenuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="delete-account-button"
                style={styles.settingsMenuItem}
                onPress={() => {
                  Alert.alert(
                    "Delete Account",
                    `Are you sure you want to delete "${editingWallet?.name}"? This action cannot be undone.`,
                    [
                      {
                        text: "Cancel",
                        style: "cancel",
                      },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                          if (editingWallet) {
                            const updatedWallets = wallets.filter(
                              (w) => w.id !== editingWallet.id
                            );
                            setWallets(updatedWallets);
                            await saveWalletsToStorage(updatedWallets);
                            editWalletSheetRef.current?.close();
                            setEditingWallet(null);
                          }
                        },
                      },
                    ]
                  );
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
          </BottomSheetView>
        </BottomSheet>

        {/* Change Name Modal */}
        <Modal
          visible={showChangeNameModal}
          transparent={true}
          animationType="slide"
        >
          <Pressable
            style={styles.settingsDrawerOverlay}
            onPress={() => {
              console.log("OVERLAY PRESSED - Closing all modals");
              setShowChangeNameModal(false);
              editWalletSheetRef.current?.close();
              setEditingWallet(null);
            }}
          >
            <Pressable
              style={styles.settingsDrawerContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.settingsDrawerContentArea}>
                <View style={styles.settingsDrawerHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      console.log(
                        "BACK BUTTON PRESSED (<) - Closing all modals"
                      );
                      setShowChangeNameModal(false);
                      editWalletSheetRef.current?.close();
                      setEditingWallet(null);
                    }}
                  >
                    <Text style={styles.settingsDrawerClose}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.settingsDrawerTitle}>Change Name</Text>
                  <TouchableOpacity
                    onPress={() => {
                      console.log("X BUTTON PRESSED - Closing all modals");
                      setShowChangeNameModal(false);
                      editWalletSheetRef.current?.close();
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
                    if (editingWallet && text.trim()) {
                      const updatedWallets = wallets.map((w) =>
                        w.id === editingWallet.id
                          ? { ...w, name: text.trim() }
                          : w
                      );
                      setWallets(updatedWallets);
                      saveWalletsToStorage(updatedWallets);
                    }
                  }}
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={{ paddingVertical: 16, paddingHorizontal: 20 }}
                  onPress={() => {
                    console.log("SAVE BUTTON PRESSED");
                    console.log("editingWallet:", editingWallet);
                    console.log("editWalletName:", editWalletName);
                    if (editingWallet && editWalletName.trim()) {
                      console.log("Saving wallet name:", editWalletName.trim());
                      const updatedWallets = wallets.map((w) =>
                        w.id === editingWallet.id
                          ? { ...w, name: editWalletName.trim() }
                          : w
                      );
                      setWallets(updatedWallets);
                      saveWalletsToStorage(updatedWallets);
                      console.log("Closing both modals");
                      setShowChangeNameModal(false);
                      editWalletSheetRef.current?.close();
                      setEditingWallet(null);
                    } else {
                      console.log("Not saving - wallet or name is empty");
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.settingsDrawerTitle,
                      { fontSize: 18, fontWeight: "600" },
                    ]}
                  >
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* View Private Key Bottom Sheet */}
        <BottomSheet
          ref={privateKeySheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4A90E2" }}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetHeader}>
              <View style={{ width: 32 }} />
              <Text style={styles.bottomSheetTitle}>Private Key</Text>
              <TouchableOpacity
                onPress={() => {
                  privateKeySheetRef.current?.close();
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
          </BottomSheetView>
        </BottomSheet>

        {/* View Seed Phrase Bottom Sheet */}
        <BottomSheet
          ref={seedPhraseSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4A90E2" }}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetHeader}>
              <View style={{ width: 32 }} />
              <Text style={styles.bottomSheetTitle}>Seed Phrase</Text>
              <TouchableOpacity
                onPress={() => {
                  seedPhraseSheetRef.current?.close();
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
                    Manage Security -> Export Seed Phrase to view or back it up.
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
          </BottomSheetView>
        </BottomSheet>

        {/* Ledger Connection Bottom Sheet */}
        <BottomSheet
          ref={ledgerSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#000000" }}
          handleIndicatorStyle={{ backgroundColor: "#4A90E2" }}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetHeader}>
              <View style={{ width: 32 }} />
              <Text style={styles.bottomSheetTitle}>Connect Ledger</Text>
              <TouchableOpacity onPress={() => ledgerSheetRef.current?.close()}>
                <Text style={styles.bottomSheetClose}>✕</Text>
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
          </BottomSheetView>
        </BottomSheet>

        {/* Browser BottomSheet */}
        <BottomSheet
          ref={browserSheetRef}
          index={-1}
          snapPoints={["90%"]}
          enablePanDownToClose={true}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              disappearsOnIndex={-1}
              appearsOnIndex={0}
              opacity={0.5}
            />
          )}
        >
          <BottomSheetView style={{ flex: 1 }}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Browser</Text>
              <TouchableOpacity
                onPress={() => browserSheetRef.current?.close()}
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
                source={{ uri: browserUrl }}
                style={{ flex: 1, backgroundColor: "#00FF00" }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                onMessage={handleWebViewMessage}
                injectedJavaScriptBeforeContentLoaded={`
                (function() {
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
                    // Connect to the wallet and get public key
                    connect: async function() {
                      try {
                        const result = await sendRequest('connect');
                        return result.publicKey;
                      } catch (err) {
                        console.error('x1.connect error:', err);
                        throw err;
                      }
                    },

                    // Sign and send a transaction
                    signAndSendTransaction: async function(transaction, options = {}) {
                      try {
                        // Serialize the transaction to base64
                        let txData;
                        if (transaction.serialize) {
                          // If it's a Transaction object
                          txData = transaction.serialize({
                            requireAllSignatures: false,
                            verifySignatures: false
                          }).toString('base64');
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
                    }
                  };

                  console.log('window.x1 API initialized');
                })();
              `}
              />
            </View>
          </BottomSheetView>
        </BottomSheet>
      </GestureHandlerRootView>

      {/* Settings - Full Page - Outside GestureHandler */}
      <Modal
        visible={showSettingsModal}
        transparent={false}
        animationType="slide"
        onRequestClose={navigateBackInSettings}
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
                    networkSheetRef.current?.expand();
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
                    setShowSettingsModal(false);
                    Alert.alert(
                      "Rename Wallet",
                      "Rename wallet functionality would open here"
                    );
                  }}
                >
                  <Text style={styles.settingsMenuItemText}>Rename Wallet</Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setShowSettingsModal(false);
                    Alert.alert(
                      "New Account",
                      "Create new account functionality would open here"
                    );
                  }}
                >
                  <Text style={styles.settingsMenuItemText}>New Account</Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setShowSettingsModal(false);
                    Alert.alert("Preferences", "Preferences would open here");
                  }}
                >
                  <Text style={styles.settingsMenuItemText}>Preferences</Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => navigateToSettingsScreen("manageSecurity")}
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
                  <Text style={styles.settingsMenuItemText}>WiFi Settings</Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setShowSettingsModal(false);
                    Alert.alert(
                      "About X1 Wallet",
                      "About X1 Wallet info would open here"
                    );
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
              </>
            ) : settingsNavigationStack[settingsNavigationStack.length - 1] ===
              "manageSecurity" ? (
              // Manage Security Menu
              <>
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
              </>
            ) : settingsNavigationStack[settingsNavigationStack.length - 1] ===
              "exportSeed" ? (
              // Export Seed Phrase Screen
              <View style={styles.bottomSheetContent}>
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
                    No master seed phrase found. Create a new wallet to generate
                    one.
                  </Text>
                )}
              </View>
            ) : (
              // Change Seed Phrase Screen
              <View style={styles.bottomSheetContent}>
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
                          changeSeedPhraseMode === "enter" ? "#4A90E2" : "#888",
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
                    <Text style={[styles.seedPhraseWarning, { color: "#888" }]}>
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
                  ⚠️ WARNING: Changing your master seed phrase will only affect
                  newly created wallets. Existing wallets will remain unchanged
                  and will continue to use their original seed phrases.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  safeTopArea: {
    backgroundColor: "#000000",
    height: 40,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#000000",
    position: "relative",
  },
  viewToggle: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#000000",
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
  activityCardTime: {
    color: "#999999",
    fontSize: 13,
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: "#999999",
    fontSize: 14,
    textAlign: "center",
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
    backgroundColor: "#1a1a1a",
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
    width: 20,
    height: 20,
    borderRadius: 10,
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
    backgroundColor: "#000000",
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
    fontSize: 14,
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
  actionCircleIcon: {
    fontSize: 24,
    color: "#4A90E2",
  },
  swapIcon: {
    width: 24,
    height: 24,
    tintColor: "#4A90E2",
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
  tokenLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tokenIconLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#000000",
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
    backgroundColor: "#000000",
  },
  bottomSheetScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
    backgroundColor: "#000000",
  },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
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
    backgroundColor: "#000000",
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
    backgroundColor: "#000000",
  },
  debugFullPageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#000000",
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
    backgroundColor: "#000000",
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
    paddingBottom: 10,
    paddingTop: 0,
    paddingHorizontal: 20,
    justifyContent: "space-around",
    alignItems: "flex-start",
    height: 86,
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
});
