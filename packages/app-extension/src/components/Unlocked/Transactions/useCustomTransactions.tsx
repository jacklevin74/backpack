import { useCallback, useEffect, useRef, useState } from "react";
import { type Blockchain } from "@coral-xyz/common";
import {
  backendApiUrl,
  blockchainConnectionUrl,
} from "@coral-xyz/recoil/src/atoms/preferences";
import { useRecoilValue } from "recoil";

// Debug flag - set to true to enable verbose logging
const DEBUG_TRANSACTIONS = false;

const debugLog = (...args: any[]) => {
  if (DEBUG_TRANSACTIONS) {
    console.log(...args);
  }
};

export interface Transaction {
  hash: string;
  type: string;
  timestamp: string;
  amount?: string;
  tokenName?: string;
  tokenSymbol?: string;
  fee?: string;
  feePayer?: string;
  description?: string;
  error?: string | null;
}

function getProviderId(blockchain: Blockchain, connectionUrl: string): string {
  // Determine providerId based on connection URL
  // Since we treat Solana networks as RPC alternatives for X1 wallets,
  // we need to detect the network from the URL, not the blockchain type

  if (!connectionUrl) {
    return blockchain.toUpperCase();
  }

  // Check for Solana networks first (including QuickNode)
  if (
    connectionUrl.includes("solana.com") ||
    connectionUrl.includes("solana-mainnet.quiknode.pro") ||
    connectionUrl.includes("solana-devnet") ||
    connectionUrl.includes("solana-testnet")
  ) {
    if (connectionUrl.includes("mainnet")) {
      return "SOLANA-mainnet";
    } else if (connectionUrl.includes("devnet")) {
      return "SOLANA-devnet";
    } else if (connectionUrl.includes("testnet")) {
      return "SOLANA-testnet";
    }
    return "SOLANA-mainnet";
  }

  // Check for X1 networks
  if (connectionUrl.includes("x1.xyz")) {
    if (connectionUrl.includes("testnet")) {
      return "X1-testnet";
    } else if (connectionUrl.includes("mainnet")) {
      return "X1-mainnet";
    }
    return "X1-testnet";
  }

  // Fallback to blockchain type
  return blockchain.toUpperCase();
}

export function useCustomTransactions(address: string, blockchain: Blockchain) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const apiUrl = useRecoilValue(backendApiUrl);
  const connectionUrl = useRecoilValue(blockchainConnectionUrl(blockchain));

  debugLog("🔧 [CustomTransactionHook] Hook called/re-rendered:", {
    address,
    blockchain,
    currentTransactionCount: transactions.length,
    loading,
    hasMore,
    offsetRef: offsetRef.current,
  });

  const fetchTransactions = useCallback(
    async (loadMore = false) => {
      debugLog("📥 [CustomTransactionHook] fetchTransactions called:", {
        loadMore,
        currentOffset: offsetRef.current,
        currentTransactionCount: transactions.length,
        hasMore,
        loading,
      });

      try {
        if (!loadMore) {
          debugLog(
            "🔄 [CustomTransactionHook] Setting loading to true (fresh fetch)"
          );
          setLoading(true);
        } else {
          debugLog(
            "➕ [CustomTransactionHook] Load more request (not setting loading)"
          );
        }

        const providerId = getProviderId(blockchain, connectionUrl);
        const url = `${apiUrl}/transactions`;
        const offset = loadMore ? offsetRef.current : 0;

        debugLog("🌐 [CustomTransactionHook] Fetching from:", url, {
          address,
          providerId,
          offset,
          loadMore,
        });

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address,
            providerId,
            limit: 50,
            offset: loadMore ? offsetRef.current : 0,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        debugLog("✅ [CustomTransactionHook] Response received:", {
          count: result.transactions?.length || 0,
          hasMore: result.hasMore,
          loadMore,
        });

        if (loadMore) {
          debugLog("➕ [CustomTransactionHook] Appending transactions:", {
            previousCount: transactions.length,
            newCount: result.transactions?.length || 0,
            totalAfter:
              transactions.length + (result.transactions?.length || 0),
          });
          setTransactions((prev) => {
            const updated = [...prev, ...(result.transactions || [])];
            debugLog("✏️ [CustomTransactionHook] setTransactions (append):", {
              prevLength: prev.length,
              appendedLength: result.transactions?.length || 0,
              newLength: updated.length,
            });
            return updated;
          });
          const newOffset =
            offsetRef.current + (result.transactions?.length || 0);
          debugLog("📊 [CustomTransactionHook] Updating offset:", {
            oldOffset: offsetRef.current,
            newOffset,
          });
          offsetRef.current = newOffset;
        } else {
          debugLog("🔄 [CustomTransactionHook] Replacing transactions:", {
            oldCount: transactions.length,
            newCount: result.transactions?.length || 0,
          });
          setTransactions(result.transactions || []);
          offsetRef.current = result.transactions?.length || 0;
          debugLog(
            "📊 [CustomTransactionHook] Reset offset to:",
            offsetRef.current
          );
        }

        debugLog(
          "🎯 [CustomTransactionHook] Setting hasMore to:",
          result.hasMore || false
        );
        setHasMore(result.hasMore || false);
        setError(null);
      } catch (err) {
        console.error("❌ [CustomTransactionHook] Error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch transactions";
        setError(errorMessage);

        if (!loadMore) {
          setTransactions([]);
          setHasMore(false);
        }
      } finally {
        debugLog("🏁 [CustomTransactionHook] Setting loading to false");
        setLoading(false);
      }
    },
    [address, blockchain, apiUrl, connectionUrl]
  );

  // Log when dependencies change
  useEffect(() => {
    debugLog(
      "🔧 [CustomTransactionHook] fetchTransactions dependencies changed:",
      {
        address,
        blockchain,
        apiUrl,
        connectionUrl,
      }
    );
  }, [address, blockchain, apiUrl, connectionUrl]);

  // Initial fetch effect - only runs when address/blockchain changes
  useEffect(() => {
    debugLog("⚡ [CustomTransactionHook] Initial fetch useEffect triggered");
    offsetRef.current = 0;
    fetchTransactions();
  }, [address, blockchain, apiUrl, connectionUrl]);

  // Polling effect - only manages polling interval, doesn't fetch
  useEffect(() => {
    debugLog("⏰ [CustomTransactionHook] Polling useEffect triggered");

    // Clear any existing poll
    if (pollIntervalRef.current) {
      debugLog("⏰ [CustomTransactionHook] Clearing existing poll interval");
      clearInterval(pollIntervalRef.current);
    }

    // Only poll if we haven't loaded additional pages
    debugLog("⏰ [CustomTransactionHook] Checking if should poll:", {
      offsetRef: offsetRef.current,
      shouldPoll: offsetRef.current <= 50,
    });

    if (offsetRef.current <= 50) {
      // Determine polling interval based on transaction count
      const getPollingInterval = () => {
        if (transactions.length === 0) {
          // No transactions: poll every 3 seconds
          return 3000;
        } else if (transactions.length < 5) {
          // Few transactions: poll every 5 seconds
          return 5000;
        } else {
          // Many transactions: poll every 15 seconds
          return 15000;
        }
      };

      const interval = getPollingInterval();
      debugLog(
        `🔄 [CustomTransactionHook] Starting polling every ${interval}ms (${transactions.length} transactions)`
      );

      pollIntervalRef.current = setInterval(() => {
        debugLog("🔄 [CustomTransactionHook] Auto-refreshing transactions");
        // Only poll if still on first page
        if (offsetRef.current <= 50) {
          fetchTransactions();
        }
      }, interval);
    } else {
      debugLog(
        `🔄 [CustomTransactionHook] Polling disabled - multiple pages loaded (offset: ${offsetRef.current})`
      );
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [transactions.length, fetchTransactions]);

  const loadMore = useCallback(() => {
    debugLog("🔘 [CustomTransactionHook] loadMore called:", {
      hasMore,
      loading,
      currentTransactionCount: transactions.length,
      currentOffset: offsetRef.current,
    });
    if (hasMore && !loading) {
      debugLog(
        "✅ [CustomTransactionHook] Conditions met, calling fetchTransactions(true)"
      );
      fetchTransactions(true);
    } else {
      debugLog("⛔ [CustomTransactionHook] loadMore conditions NOT met:", {
        hasMore,
        loading,
        reason: !hasMore ? "no more data" : "already loading",
      });
    }
  }, [hasMore, loading, fetchTransactions]);

  const refresh = useCallback(() => {
    debugLog(
      "🔄 [CustomTransactionHook] refresh called - resetting offset to 0"
    );
    offsetRef.current = 0;
    fetchTransactions();
  }, [fetchTransactions]);

  const returnValue = {
    transactions,
    loading,
    hasMore,
    error,
    loadMore,
    refresh,
  };

  debugLog("🔙 [CustomTransactionHook] Returning values:", {
    transactionCount: transactions.length,
    loading,
    hasMore,
    error,
    offset: offsetRef.current,
  });

  return returnValue;
}
