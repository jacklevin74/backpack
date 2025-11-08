import { useCallback, useEffect, useRef,useState } from "react";
import { BACKEND_API_URL, type Blockchain } from "@coral-xyz/common";

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

function getProviderId(blockchain: Blockchain): string {
  const blockchainLower = blockchain.toLowerCase();

  if (blockchainLower === "x1") {
    return "X1-testnet";
  }

  return blockchain.toUpperCase();
}

export function useCustomTransactions(address: string, blockchain: Blockchain) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);

  const fetchTransactions = useCallback(
    async (loadMore = false) => {
      try {
        if (!loadMore) {
          setLoading(true);
        }

        const providerId = getProviderId(blockchain);
        const url = `${BACKEND_API_URL}/transactions`;

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
    [address, blockchain]
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

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
