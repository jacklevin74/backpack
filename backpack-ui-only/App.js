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
} from "react-native";
import {
  Keypair,
  Connection,
  clusterApiUrl,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as bip39 from "bip39";
import { randomBytes, secretbox } from "tweetnacl";
import bs58 from "bs58";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import QRCode from "react-native-qrcode-svg";
import TransportBLE from "@ledgerhq/react-native-hw-transport-ble";
import AppSolana from "@ledgerhq/hw-app-solana";

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
    logo: require("./assets/solana.png"),
    nativeToken: {
      name: "Solana",
      symbol: "SOL",
      logo: require("./assets/solana.png"),
    },
  },
];

export default function App() {
  const [wallets, setWallets] = useState(MOCK_WALLETS);
  const [selectedWallet, setSelectedWallet] = useState(MOCK_WALLETS[0]);
  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [selectedAccount, setSelectedAccount] = useState(MOCK_ACCOUNTS[0]);
  const [balance, setBalance] = useState("30,449.46");
  const [balanceUSD, setBalanceUSD] = useState("$30,449.46");
  const [tokens, setTokens] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [balanceCache, setBalanceCache] = useState({});
  const [currentNetwork, setCurrentNetwork] = useState(NETWORKS[0]);

  // Network selector states
  const [showNetworkDrawer, setShowNetworkDrawer] = useState(false);
  const [showAccountDrawer, setShowAccountDrawer] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showDebugDrawer, setShowDebugDrawer] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);

  // Wallet management states
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showImportWalletModal, setShowImportWalletModal] = useState(false);
  const [newMnemonic, setNewMnemonic] = useState("");
  const [importMnemonic, setImportMnemonic] = useState("");
  const [importPrivateKey, setImportPrivateKey] = useState("");
  const [importType, setImportType] = useState("mnemonic"); // "mnemonic" or "privateKey"

  // Ledger states
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerScanning, setLedgerScanning] = useState(false);
  const [ledgerAccounts, setLedgerAccounts] = useState([]);
  const [ledgerConnecting, setLedgerConnecting] = useState(false);
  const [ledgerDeviceId, setLedgerDeviceId] = useState(null); // Store device ID to skip scanning
  const [ledgerConnectionType, setLedgerConnectionType] = useState("usb"); // 'usb' or 'bluetooth'
  const ledgerTransportRef = useRef(null); // Store transport reference for cleanup
  const ledgerScanSubscriptionRef = useRef(null); // Store scan subscription for cleanup
  const ledgerCleaningRef = useRef(false); // Prevent concurrent cleanup
  const ledgerCleanedUpRef = useRef(false); // Track if cleanup has already been completed

  // Send and Receive states
  const [showReceiveDrawer, setShowReceiveDrawer] = useState(false);
  const [showSendDrawer, setShowSendDrawer] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendConfirming, setSendConfirming] = useState(false);
  const [sendSignature, setSendSignature] = useState("");
  const [sendError, setSendError] = useState("");

  // Bottom sheet ref
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["50%", "90%"], []);

  // Debug logging function
  const addDebugLog = useCallback((message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev, `[${timestamp}] ${message}`].slice(-100)); // Keep last 100 logs
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
        // Format balance with full precision for display
        const balanceStr = data.balance.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const usdStr = data.tokens[0]?.valueUSD
          ? `$${data.tokens[0].valueUSD.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "$0.00";

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
        setTokens(formattedTokens);

        // Save to cache
        setBalanceCache((prev) => ({
          ...prev,
          [cacheKey]: {
            balance: balanceStr,
            balanceUSD: usdStr,
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

  // Load initial balance and transactions
  useEffect(() => {
    checkBalance();
    checkTransactions();
  }, [selectedWallet.publicKey, currentNetwork]);

  const switchNetwork = (network) => {
    setCurrentNetwork(network);
    // Use cache for instant switch, then fetch fresh data in background
    checkBalance(network, true);
    checkTransactions(network);
    setShowNetworkDrawer(false);
  };

  const selectWallet = (wallet) => {
    setWallets(wallets.map((w) => ({ ...w, selected: w.id === wallet.id })));
    setSelectedWallet(wallet);
    bottomSheetRef.current?.close();
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
          onPress: () => {
            console.log("Deleting wallet:", wallet.name);
            // Remove the wallet from the list
            const updatedWallets = wallets.filter((w) => w.id !== wallet.id);
            console.log("Wallets after deletion:", updatedWallets.length);
            setWallets(updatedWallets);

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
    setShowAccountDrawer(false);
  };

  const showWalletSelector = () => {
    bottomSheetRef.current?.expand();
  };

  const showNetworkSelector = () => {
    setShowNetworkDrawer(true);
  };

  const showAccountSelector = () => {
    setShowAccountDrawer(true);
  };

  const handleReceive = () => {
    setShowReceiveDrawer(true);
  };

  const handleSend = () => {
    setShowSendDrawer(true);
  };

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert("Copied", "Address copied to clipboard");
  };

  const handleSendSubmit = async () => {
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

    // Check balance
    const balanceNum = parseFloat(balance.replace(/,/g, ""));
    if (amountNum > balanceNum) {
      Alert.alert("Error", "Insufficient balance");
      return;
    }

    // Close send drawer and show confirmation screen
    setShowSendDrawer(false);
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

      // Create transaction
      const fromPubkey = new PublicKey(selectedWallet.publicKey);
      const toPubkey = new PublicKey(trimmedAddress);
      const lamports = Math.floor(amountNum * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
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

        // Sign the transaction with Ledger
        const serializedTx = transaction.serializeMessage();
        const signature = await solana.signTransaction(
          derivationPath,
          serializedTx
        );

        console.log("Ledger signature obtained");

        // Add the signature to the transaction
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

  // Wallet management functions
  const handleAddWallet = () => {
    setShowAddWalletModal(true);
  };

  const handleCreateNewWallet = () => {
    // Generate new mnemonic (12 words)
    const mnemonic = bip39.generateMnemonic();
    setNewMnemonic(mnemonic);
    setShowAddWalletModal(false);
    setShowCreateWalletModal(true);
  };

  const handleShowImportWallet = () => {
    setShowAddWalletModal(false);
    setShowImportWalletModal(true);
  };

  const copySeedPhrase = () => {
    Clipboard.setString(newMnemonic);
    Alert.alert("Copied", "Seed phrase copied to clipboard");
  };

  const handleImportWallet = async () => {
    try {
      let keypair;

      if (importType === "mnemonic") {
        if (!bip39.validateMnemonic(importMnemonic.trim())) {
          Alert.alert("Error", "Invalid recovery phrase");
          return;
        }
        const seed = await bip39.mnemonicToSeed(importMnemonic.trim());
        keypair = Keypair.fromSeed(seed.slice(0, 32));
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

      const newWallet = {
        id: String(wallets.length + 1),
        name: `Wallet ${wallets.length + 1}`,
        address: `${keypair.publicKey.toString().slice(0, 4)}...${keypair.publicKey.toString().slice(-4)}`,
        publicKey: keypair.publicKey.toString(),
        selected: false,
      };

      setWallets([...wallets, newWallet]);
      setImportMnemonic("");
      setImportPrivateKey("");
      setShowImportWalletModal(false);

      // Register the wallet with the transaction indexer
      await registerWalletWithIndexer(
        keypair.publicKey.toString(),
        currentNetwork.providerId
      );
    } catch (error) {
      Alert.alert("Error", "Failed to import wallet: " + error.message);
    }
  };

  const handleConfirmCreateWallet = async () => {
    try {
      const seed = await bip39.mnemonicToSeed(newMnemonic);
      const keypair = Keypair.fromSeed(seed.slice(0, 32));

      const newWallet = {
        id: String(wallets.length + 1),
        name: `Wallet ${wallets.length + 1}`,
        address: `${keypair.publicKey.toString().slice(0, 4)}...${keypair.publicKey.toString().slice(-4)}`,
        publicKey: keypair.publicKey.toString(),
        selected: false,
      };

      setWallets([...wallets, newWallet]);
      setNewMnemonic("");
      setShowCreateWalletModal(false);
    } catch (error) {
      Alert.alert("Error", "Failed to create wallet: " + error.message);
    }
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

    // Show pairing instructions
    Alert.alert(
      "Ledger Bluetooth Setup",
      "Before connecting, please ensure:\n\n1. Your Ledger is unlocked\n2. The Solana app is open on your Ledger\n3. Your Ledger is paired in Android Bluetooth settings\n\nTo pair:\n• Go to Settings > Bluetooth\n• Find 'Ledger Flex' or 'Ledger Nano X'\n• Tap to pair and accept pairing on both devices\n\nOnce paired, tap 'Continue' to connect.",
      [
        {
          text: "Open Settings",
          onPress: () => {
            Linking.openSettings();
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setShowAddWalletModal(true),
        },
        {
          text: "Continue",
          onPress: () => {
            setShowLedgerModal(true);
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
        next: (e) => {
          console.log("Ledger device event received!");
          console.log("Event type:", e.type);
          if (e.type === "add") {
            const device = e.descriptor;
            console.log("Found Ledger device:", device);

            // CRITICAL: Unsubscribe IMMEDIATELY to prevent multiple connection attempts
            console.log(
              "Unsubscribing from scan to prevent multiple connections..."
            );
            try {
              subscription.unsubscribe();
              console.log("✓ Successfully unsubscribed from scan");
              ledgerScanSubscriptionRef.current = null;
            } catch (unsubError) {
              console.log("⚠ Error unsubscribing:", unsubError.message);
            }

            setLedgerScanning(false);
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

  const connectToLedger = async (device) => {
    let transport = null;
    try {
      setLedgerConnecting(true);

      // If device is just a string, it's a device ID
      const deviceId =
        typeof device === "string" ? device : device.id || device;
      const deviceName =
        typeof device === "string"
          ? "Ledger (stored)"
          : device.name || device.localName;

      console.log("Connecting to Ledger device:", deviceName);
      console.log("Device ID:", deviceId);

      console.log("Opening BLE transport...");

      // Add timeout for connection attempt
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timeout after 30 seconds")),
          30000
        )
      );

      transport = await Promise.race([
        TransportBLE.open(deviceId),
        timeoutPromise,
      ]);

      // Store the transport for future cleanup
      ledgerTransportRef.current = transport;

      // Store the device ID for transaction signing
      setLedgerDeviceId(deviceId);
      console.log("Stored device ID for signing:", deviceId);

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
      setLedgerConnecting(false);
      console.error("Error connecting to Ledger:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

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
      } else if (error.message && error.message.includes("pairing")) {
        errorMessage +=
          "Pairing failed. Please pair your Ledger in Android Bluetooth settings first, then try again.";
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage +=
          "Please ensure:\n• Ledger is unlocked\n• Solana app is open on Ledger\n• Device is paired in Bluetooth settings";
      }

      Alert.alert("Connection Error", errorMessage, [
        {
          text: "Open Bluetooth Settings",
          onPress: () => Linking.openSettings(),
        },
        { text: "OK" },
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

    const newWallet = {
      id: Date.now(),
      name: `Ledger ${account.index + 1}`,
      address: account.address.slice(0, 4) + "..." + account.address.slice(-4),
      publicKey: account.address,
      selected: false,
      isLedger: true,
      derivationPath: account.derivationPath,
      ledgerDeviceId: ledgerDeviceId, // Store device ID for later signing
    };

    console.log("New wallet object:", JSON.stringify(newWallet, null, 2));
    console.log("Wallet ledgerDeviceId field:", newWallet.ledgerDeviceId);
    console.log("=== END ADDING LEDGER WALLET ===");

    setWallets([...wallets, newWallet]);
    setShowLedgerModal(false);
    setLedgerAccounts([]);

    // Register the wallet with the transaction indexer
    await registerWalletWithIndexer(account.address, currentNetwork.providerId);

    Alert.alert("Success", `Added Ledger account ${account.index + 1}`);

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        {/* Top Header with Safe Area */}
        <View style={styles.safeTopArea} />
        <View style={styles.topBar}>
          {/* Wallet selector on the left */}
          <View style={styles.walletSelectorLeft}>
            <TouchableOpacity
              style={styles.walletDropdownButton}
              onPress={showWalletSelector}
            >
              <Image
                source={require("./assets/x1.png")}
                style={styles.x1LogoSmall}
              />
              <Text style={styles.walletDropdownText}>
                {selectedWallet.name}
              </Text>
              <Text style={styles.walletDropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Network switch in the middle */}
          <View style={styles.quickSwitchContainer}>
            <TouchableOpacity
              style={[
                styles.quickSwitchButton,
                currentNetwork.id === "X1" && styles.quickSwitchButtonActive,
              ]}
              onPress={() => switchNetwork(NETWORKS[0])}
            >
              <Image
                source={require("./assets/x1.png")}
                style={styles.quickSwitchIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.quickSwitchButton,
                currentNetwork.id === "SOLANA" &&
                  styles.quickSwitchButtonActive,
              ]}
              onPress={() => switchNetwork(NETWORKS[1])}
            >
              <Image
                source={require("./assets/solana.png")}
                style={styles.quickSwitchIcon}
              />
            </TouchableOpacity>
          </View>

          {/* Activity and Settings icons on the right */}
          <View style={styles.topBarRightIcons}>
            <TouchableOpacity
              style={styles.activityIcon}
              onPress={() => setShowActivityDrawer(true)}
            >
              <Image
                source={require("./assets/clock.png")}
                style={styles.activityIconImage}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsIcon}
              onPress={() => setShowSettingsDrawer(true)}
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
        >
          {/* Balance Section with all content */}
          <View style={styles.balanceSection}>
            {/* Balance display */}
            <View style={styles.balanceContent}>
              <Text style={styles.balanceUSD}>{balanceUSD}</Text>
              <Text style={styles.balanceChange}>$0.00 0%</Text>
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
                  <Text style={styles.actionCircleIcon}>⇄</Text>
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
      </SafeAreaView>

      {/* Network Selector Side Drawer */}
      {showNetworkDrawer && (
        <Modal
          visible={showNetworkDrawer}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowNetworkDrawer(false)}
        >
          <Pressable
            style={styles.networkDrawerOverlay}
            onPress={() => setShowNetworkDrawer(false)}
          >
            <Pressable
              style={styles.networkDrawerContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.networkDrawerContentArea}>
                {/* Header */}
                <View style={styles.networkDrawerHeader}>
                  <Text style={styles.networkDrawerTitle}>Select Network</Text>
                  <TouchableOpacity onPress={() => setShowNetworkDrawer(false)}>
                    <Text style={styles.networkDrawerClose}>✕</Text>
                  </TouchableOpacity>
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
        <BottomSheetView style={styles.bottomSheetContent}>
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

          {/* Network Logo */}
          <View style={styles.bottomSheetLogo}>
            <Image source={currentNetwork.logo} style={styles.x1LogoMedium} />
          </View>

          {/* Wallets List */}
          <ScrollView style={styles.bottomSheetList}>
            {wallets.map((wallet) => (
              <TouchableOpacity
                key={wallet.id}
                style={[
                  styles.bottomSheetWalletItem,
                  wallet.selected && styles.bottomSheetWalletItemSelected,
                ]}
                onPress={() => selectWallet(wallet)}
              >
                <View style={styles.bottomSheetWalletLeft}>
                  <Image
                    source={currentNetwork.logo}
                    style={styles.x1LogoSmall}
                  />
                  <View style={styles.bottomSheetWalletInfo}>
                    <Text style={styles.bottomSheetWalletName}>
                      {wallet.name}
                    </Text>
                    <Text style={styles.bottomSheetWalletAddress}>
                      {wallet.address}
                    </Text>
                  </View>
                </View>
                <View style={styles.bottomSheetWalletRight}>
                  <TouchableOpacity style={styles.bottomSheetCopyBtn}>
                    <Text style={styles.bottomSheetCopyIcon}>⧉</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.bottomSheetMoreBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteWallet(wallet);
                    }}
                  >
                    <Text style={styles.bottomSheetMoreText}>⋯</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}

            {/* Add Button */}
            <TouchableOpacity style={styles.bottomSheetAddButton}>
              <Text style={styles.bottomSheetAddButtonText}>+</Text>
            </TouchableOpacity>
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>

      {/* Account Selector Side Drawer */}
      <Modal
        visible={showAccountDrawer}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAccountDrawer(false)}
      >
        <Pressable
          style={styles.accountDrawerOverlay}
          onPress={() => setShowAccountDrawer(false)}
        >
          <Pressable
            style={styles.accountDrawerContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.accountDrawerContentArea}>
              {/* Header */}
              <View style={styles.accountDrawerHeader}>
                <Text style={styles.accountDrawerTitle}>Select Account</Text>
                <TouchableOpacity onPress={() => setShowAccountDrawer(false)}>
                  <Text style={styles.accountDrawerClose}>✕</Text>
                </TouchableOpacity>
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settings Drawer */}
      <Modal
        visible={showSettingsDrawer}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettingsDrawer(false)}
      >
        <Pressable
          style={styles.settingsDrawerOverlay}
          onPress={() => setShowSettingsDrawer(false)}
        >
          <Pressable
            style={styles.settingsDrawerContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.settingsDrawerContentArea}>
              {/* Header with Account Badge */}
              <View style={styles.settingsDrawerHeader}>
                <View style={styles.settingsHeaderLeft}>
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
                <TouchableOpacity onPress={() => setShowSettingsDrawer(false)}>
                  <Text style={styles.settingsDrawerClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Menu Items */}
              <ScrollView style={styles.settingsMenuList}>
                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setShowSettingsDrawer(false);
                    setShowNetworkDrawer(true);
                  }}
                >
                  <Text style={styles.settingsMenuItemText}>Network</Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setShowSettingsDrawer(false);
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
                    setShowSettingsDrawer(false);
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
                    setShowSettingsDrawer(false);
                    Alert.alert("Preferences", "Preferences would open here");
                  }}
                >
                  <Text style={styles.settingsMenuItemText}>Preferences</Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setShowSettingsDrawer(false);
                    Alert.alert("Settings", "Settings would open here");
                  }}
                >
                  <Text style={styles.settingsMenuItemText}>Settings</Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setShowSettingsDrawer(false);
                    Alert.alert(
                      "About Backpack",
                      "About Backpack info would open here"
                    );
                  }}
                >
                  <Text style={styles.settingsMenuItemText}>
                    About Backpack
                  </Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setShowSettingsDrawer(false);
                    setShowDebugDrawer(true);
                  }}
                >
                  <Text style={styles.settingsMenuItemText}>Debug</Text>
                  <Text style={styles.settingsMenuItemArrow}>›</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
      <Modal
        visible={showReceiveDrawer}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReceiveDrawer(false)}
      >
        <Pressable
          style={styles.settingsDrawerOverlay}
          onPress={() => setShowReceiveDrawer(false)}
        >
          <Pressable
            style={styles.settingsDrawerContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.settingsDrawerContentArea}>
              {/* Header */}
              <View style={styles.settingsDrawerHeader}>
                <Text style={styles.settingsDrawerTitle}>
                  Receive {getNativeTokenInfo().symbol}
                </Text>
                <TouchableOpacity onPress={() => setShowReceiveDrawer(false)}>
                  <Text style={styles.settingsDrawerClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* QR Code */}
              <View style={styles.receiveQRContainer}>
                <View style={styles.receiveQRWrapper}>
                  <QRCode
                    value={selectedWallet.address}
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
                  {selectedWallet.address}
                </Text>
              </View>

              {/* Copy Button */}
              <TouchableOpacity
                style={styles.receiveCopyButton}
                onPress={() => copyToClipboard(selectedWallet.address)}
              >
                <Text style={styles.receiveCopyButtonText}>Copy Address</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Send Drawer */}
      <Modal
        visible={showSendDrawer}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSendDrawer(false)}
      >
        <Pressable
          style={styles.settingsDrawerOverlay}
          onPress={() => setShowSendDrawer(false)}
        >
          <Pressable
            style={styles.settingsDrawerContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.settingsDrawerContentArea}>
              {/* Header */}
              <View style={styles.settingsDrawerHeader}>
                <Text style={styles.settingsDrawerTitle}>
                  Send {getNativeTokenInfo().symbol}
                </Text>
                <TouchableOpacity onPress={() => setShowSendDrawer(false)}>
                  <Text style={styles.settingsDrawerClose}>✕</Text>
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
                    onPress={() => setShowAddressSelector(true)}
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
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Address Selector Modal */}
      <Modal
        visible={showAddressSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddressSelector(false)}
      >
        <Pressable
          style={styles.settingsDrawerOverlay}
          onPress={() => setShowAddressSelector(false)}
        >
          <Pressable
            style={styles.settingsDrawerContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.settingsDrawerContentArea}>
              {/* Header */}
              <View style={styles.settingsDrawerHeader}>
                <Text style={styles.settingsDrawerTitle}>Select Address</Text>
                <TouchableOpacity onPress={() => setShowAddressSelector(false)}>
                  <Text style={styles.settingsDrawerClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Address List */}
              <ScrollView style={styles.addressList}>
                {wallets.map((wallet) => (
                  <TouchableOpacity
                    key={wallet.id}
                    style={styles.addressItem}
                    onPress={() => {
                      setSendAddress(wallet.publicKey);
                      setShowAddressSelector(false);
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* Activity Drawer */}
      <Modal
        visible={showActivityDrawer}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowActivityDrawer(false)}
      >
        <Pressable
          style={styles.settingsDrawerOverlay}
          onPress={() => setShowActivityDrawer(false)}
        >
          <Pressable
            style={styles.settingsDrawerContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.settingsDrawerContentArea}>
              {/* Header */}
              <View style={styles.settingsDrawerHeader}>
                <View style={{ width: 32 }} />
                <Text style={styles.settingsDrawerTitle}>Activity</Text>
                <TouchableOpacity onPress={() => setShowActivityDrawer(false)}>
                  <Text style={styles.settingsDrawerClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Activity List */}
              <ScrollView
                style={styles.settingsMenuList}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.transactionsList}>
                  {transactions.map((tx) => (
                    <TouchableOpacity
                      key={tx.id}
                      style={styles.activityCard}
                      onPress={() => openExplorer(tx.signature)}
                    >
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
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
                <TouchableOpacity onPress={() => setShowAddWalletModal(false)}>
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
              <Text style={styles.seedPhraseSubtitle}>
                Tap anywhere to copy to clipboard
              </Text>
              <TouchableOpacity
                style={styles.seedPhraseContainer}
                onPress={copySeedPhrase}
              >
                <View style={styles.seedPhraseGrid}>
                  {newMnemonic.split(" ").map((word, index) => (
                    <View key={index} style={styles.seedPhraseWord}>
                      <Text style={styles.seedPhraseText}>
                        {index + 1}. {word}
                      </Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
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
                    importType === "mnemonic" && styles.importTypeButtonActive,
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

      {/* Ledger Connection Modal */}
      <Modal visible={showLedgerModal} transparent={true} animationType="slide">
        <Pressable
          style={styles.settingsDrawerOverlay}
          onPress={() => setShowLedgerModal(false)}
        >
          <Pressable
            style={styles.settingsDrawerContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.settingsDrawerContentArea}>
              <View style={styles.settingsDrawerHeader}>
                <View style={{ width: 32 }} />
                <Text style={styles.settingsDrawerTitle}>Connect Ledger</Text>
                <TouchableOpacity onPress={() => setShowLedgerModal(false)}>
                  <Text style={styles.settingsDrawerClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {ledgerScanning ? (
                <View style={styles.ledgerStatus}>
                  <Text style={styles.ledgerStatusText}>
                    Scanning for Ledger Nano X...
                  </Text>
                  <Text style={styles.ledgerStatusSubtext}>
                    Make sure Bluetooth is on and Solana app is open
                  </Text>
                </View>
              ) : ledgerConnecting ? (
                <View style={styles.ledgerStatus}>
                  <Text style={styles.ledgerStatusText}>Connecting...</Text>
                </View>
              ) : Array.isArray(ledgerAccounts) && ledgerAccounts.length > 0 ? (
                <ScrollView style={{ maxHeight: 400 }}>
                  <Text style={styles.ledgerAccountsTitle}>
                    Select an account:
                  </Text>
                  {ledgerAccounts.map((account) => (
                    <TouchableOpacity
                      key={`ledger-${account.index}`}
                      style={styles.ledgerAccount}
                      onPress={() => handleSelectLedgerAccount(account)}
                    >
                      <Text style={styles.ledgerAccountIndex}>
                        Account {account.index + 1}
                      </Text>
                      <Text
                        style={styles.ledgerAccountAddress}
                        numberOfLines={2}
                        ellipsizeMode="middle"
                      >
                        {account.address || "Unknown address"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.ledgerStatus}>
                  <Text style={styles.ledgerStatusText}>No device found</Text>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={scanForLedger}
                  >
                    <Text style={styles.confirmButtonText}>Scan Again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </GestureHandlerRootView>
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
  activityCard: {
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 0,
    marginTop: 8,
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
    width: 20,
    height: 20,
    borderRadius: 10,
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
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
    fontSize: 28,
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
    fontSize: 16,
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
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  debugFullPageClose: {
    fontSize: 22,
    color: "#888888",
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
    marginBottom: 8,
    textAlign: "center",
  },
  seedPhraseSubtitle: {
    fontSize: 14,
    color: "#888888",
    marginBottom: 16,
    textAlign: "center",
  },
  seedPhraseContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    minHeight: 100,
  },
  seedPhraseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  seedPhraseWord: {
    width: "33.33%",
    paddingVertical: 8,
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
  ledgerAccount: {
    backgroundColor: "#1a1a1a",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  ledgerAccountIndex: {
    fontSize: 14,
    color: "#888888",
    marginBottom: 4,
  },
  ledgerAccountAddress: {
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: "monospace",
    flexWrap: "wrap",
    maxWidth: "100%",
  },
});
