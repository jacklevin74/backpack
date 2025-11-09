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
} from "react-native";
import { Keypair, Connection, clusterApiUrl } from "@solana/web3.js";
import * as bip39 from "bip39";
import { randomBytes, secretbox } from "tweetnacl";
import bs58 from "bs58";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import QRCode from "react-native-qrcode-svg";

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

  // Send and Receive states
  const [showReceiveDrawer, setShowReceiveDrawer] = useState(false);
  const [showSendDrawer, setShowSendDrawer] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");
  const [showAddressSelector, setShowAddressSelector] = useState(false);

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
      const data = await response.json();

      if (data.balance !== undefined) {
        // Format balance with full precision for display
        const balanceStr = data.balance.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const usdStr = data.tokens[0]?.valueUSD
          ? `${data.tokens[0].valueUSD.toLocaleString("en-US", {
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
      const data = await response.json();

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

          return {
            id: tx.hash || tx.signature,
            type: tx.type === "SEND" ? "sent" : "received",
            amount: amountNum.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 9,
            }),
            token: tx.tokenSymbol || tx.symbol || getNativeTokenInfo().symbol,
            timestamp: isValidDate
              ? date.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : "Unknown",
            fee: tx.fee || "0.000001650",
            signature: tx.hash || tx.signature,
          };
        });

        setTransactions(formattedTransactions);
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
    // TODO: Implement actual send transaction
    Alert.alert("Success", `Sent ${sendAmount} ${getNativeTokenInfo().symbol} to ${sendAddress.substring(0, 8)}...`);
    setShowSendDrawer(false);
    setSendAmount("");
    setSendAddress("");
  };

  const handleSwap = () => {
    Alert.alert("Swap", "Swap functionality would open here");
  };

  const handleBridge = () => {
    Alert.alert("Bridge", "Bridge functionality would open here");
  };

  const copyAddress = () => {
    Clipboard.setString(selectedWallet.publicKey);
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
              <Text style={styles.activityIconText}>🕐</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsIcon}
              onPress={() => setShowSettingsDrawer(true)}
            >
              <Text style={styles.settingsIconText}>⚙</Text>
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
                <Text style={styles.balance}>{balance}</Text>
                <Text style={styles.balanceLabel}>
                  {getNativeTokenInfo().symbol}
                </Text>
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
            <TouchableOpacity>
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
                  <TouchableOpacity style={styles.bottomSheetMoreBtn}>
                    <Text style={styles.bottomSheetMoreText}>⋯</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}

            {/* Add Button */}
            <TouchableOpacity style={styles.bottomSheetAddButton}>
              <Text style={styles.bottomSheetAddButtonText}>Add</Text>
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
                <Text style={styles.settingsDrawerTitle}>Receive {getNativeTokenInfo().symbol}</Text>
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
                <Text style={styles.settingsDrawerTitle}>Send {getNativeTokenInfo().symbol}</Text>
                <TouchableOpacity onPress={() => setShowSendDrawer(false)}>
                  <Text style={styles.settingsDrawerClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Balance Display */}
              <View style={styles.sendBalanceContainer}>
                <Text style={styles.sendBalanceLabel}>Available Balance</Text>
                <TouchableOpacity onPress={() => setSendAmount(balance)}>
                  <Text style={styles.sendBalanceText}>{balance} {getNativeTokenInfo().symbol}</Text>
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
                  <TouchableOpacity onPress={() => setShowAddressSelector(true)}>
                    <Text style={styles.sendSelectAddressText}>Select Address</Text>
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
                      setSendAddress(wallet.address);
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
                          {tx.type === "received" ? "Received" : "Sent"} {tx.token}
                        </Text>
                        <Text style={styles.activityCardTime}>{tx.timestamp}</Text>
                      </View>

                      {/* Amount row */}
                      <View style={styles.activityCardRow}>
                        <Text style={styles.activityCardLabel}>Amount</Text>
                        <Text
                          style={[
                            styles.activityCardValue,
                            {
                              color: tx.type === "received" ? "#00D084" : "#FF6B6B",
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
    padding: 14,
    marginHorizontal: 16,
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
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  balanceChange: {
    fontSize: 14,
    color: "#00D084",
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
});
