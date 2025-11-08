import { useCallback, useEffect, useRef, useState } from "react";
import { type Blockchain } from "@coral-xyz/common";
import {
  backendApiUrl,
  blockchainConnectionUrl,
} from "@coral-xyz/recoil/src/atoms/preferences";
import { useRecoilValue } from "recoil";

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
  const blockchainLower = blockchain.toLowerCase();

  if (blockchainLower === "x1") {
    // Detect if connected to mainnet or testnet based on RPC URL
    if (connectionUrl.includes("mainnet")) {
      return "X1-mainnet";
    } else {
      return "X1-testnet";
    }
  }

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

  const fetchTransactions = useCallback(
    async (loadMore = false) => {
      try {
        if (!loadMore) {
          setLoading(true);
        }

        const providerId = getProviderId(blockchain, connectionUrl);
        const url = `${apiUrl}/transactions`;

        console.log("🌐 [CustomTransactionHook] Fetching from:", url, {
          address,
          providerId,
          offset: loadMore ? offsetRef.current : 0,
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
        console.log("✅ [CustomTransactionHook] Response:", {
          count: result.transactions?.length || 0,
          hasMore: result.hasMore,
        });

        if (loadMore) {
          setTransactions((prev) => [...prev, ...(result.transactions || [])]);
          offsetRef.current += result.transactions?.length || 0;
        } else {
          setTransactions(result.transactions || []);
          offsetRef.current = result.transactions?.length || 0;
        }

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
        setLoading(false);
      }
    },
    [address, blockchain, apiUrl, connectionUrl]
  );

  useEffect(() => {
    fetchTransactions();

    // Aggressive polling - poll more frequently when there are no or few transactions
    const startPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

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
      console.log(
        `🔄 [CustomTransactionHook] Starting polling every ${interval}ms (${transactions.length} transactions)`
      );

      pollIntervalRef.current = setInterval(() => {
        console.log("🔄 [CustomTransactionHook] Auto-refreshing transactions");
        fetchTransactions();
      }, interval);
    };

    startPolling();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchTransactions, transactions.length]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchTransactions(true);
    }
  }, [hasMore, loading, fetchTransactions]);

  const refresh = useCallback(() => {
    offsetRef.current = 0;
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}
