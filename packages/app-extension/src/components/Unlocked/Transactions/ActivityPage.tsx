import { useCallback, useEffect, useRef } from "react";
import type { Blockchain } from "@coral-xyz/common";
import { Loading } from "@coral-xyz/react-common";
import { blockchainConnectionUrl } from "@coral-xyz/recoil/src/atoms/preferences";
import {
  ScrollView,
  StyledText,
  useTheme,
  XStack,
  YStack,
} from "@coral-xyz/tamagui";
import { useRecoilValue } from "recoil";

import type { Transaction } from "./useCustomTransactions";
import { useCustomTransactions } from "./useCustomTransactions";

// Debug flag - set to true to enable verbose logging
const DEBUG_ACTIVITY_PAGE = false;

const debugLog = (...args: any[]) => {
  if (DEBUG_ACTIVITY_PAGE) {
    console.log(...args);
  }
};

interface ActivityPageProps {
  address: string;
  blockchain: Blockchain;
  onRefreshReady?: (refreshFn: () => void) => void;
}

export function ActivityPage({
  address,
  blockchain,
  onRefreshReady,
}: ActivityPageProps) {
  const { transactions, loading, hasMore, error, loadMore, refresh } =
    useCustomTransactions(address, blockchain);
  const theme = useTheme();
  const connectionUrl = useRecoilValue(blockchainConnectionUrl(blockchain));

  debugLog("📋 [ActivityPage] Component rendering:", {
    blockchain,
    connectionUrl,
    address,
    transactionCount: transactions.length,
    loading,
    hasMore,
    error,
  });

  // Log when component loads or values change
  useEffect(() => {
    debugLog("📋 [ActivityPage] useEffect - values changed:", {
      blockchain,
      connectionUrl,
      address,
      transactionCount: transactions.length,
      loading,
      hasMore,
    });
  }, [
    blockchain,
    connectionUrl,
    address,
    transactions.length,
    loading,
    hasMore,
  ]);

  // Expose refresh function to parent component
  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(refresh);
    }
  }, [refresh, onRefreshReady]);

  if (loading && transactions.length === 0) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Loading iconStyle={{ width: 35, height: 35 }} />
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <StyledText color="$redText" fontSize="$base" textAlign="center">
          {error}
        </StyledText>
        <StyledText
          color="$accentBlue"
          fontSize="$sm"
          marginTop="$3"
          cursor="pointer"
          onPress={refresh}
        >
          Try Again
        </StyledText>
      </YStack>
    );
  }

  if (!loading && transactions.length === 0) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <StyledText color="$baseTextMedEmphasis" fontSize="$base">
          No recent activity
        </StyledText>
      </YStack>
    );
  }

  return (
    <YStack flex={1}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <YStack padding="$4" gap="$2">
          {transactions.map((tx, index) => (
            <TransactionItem
              key={tx.hash || index}
              transaction={tx}
              blockchain={blockchain}
              connectionUrl={connectionUrl}
            />
          ))}

          {hasMore ? (
            <XStack justifyContent="center" padding="$3">
              {loading ? (
                <Loading iconStyle={{ width: 20, height: 20 }} />
              ) : (
                <StyledText
                  fontSize="$sm"
                  color="$accentBlue"
                  cursor="pointer"
                  onPress={() => {
                    debugLog("🔘 [ActivityPage] Load More button clicked");
                    loadMore();
                  }}
                >
                  Load More
                </StyledText>
              )}
            </XStack>
          ) : null}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function TransactionItem({
  transaction,
  blockchain,
  connectionUrl,
}: {
  transaction: Transaction;
  blockchain: Blockchain;
  connectionUrl: string;
}) {
  const theme = useTheme();

  const handleClick = () => {
    debugLog("🔍 [ActivityPage] Transaction clicked:", {
      hash: transaction.hash,
      blockchain,
      connectionUrl,
    });
    const explorerUrl = getExplorerUrl(
      transaction.hash,
      blockchain,
      connectionUrl
    );
    debugLog("🌐 [ActivityPage] Opening explorer:", explorerUrl);
    window.open(explorerUrl, "_blank");
  };

  return (
    <XStack
      backgroundColor="$baseBackgroundL1"
      borderRadius={12}
      padding="$3"
      cursor="pointer"
      onPress={handleClick}
      hoverStyle={{
        backgroundColor: "$baseBackgroundL2",
      }}
    >
      <YStack flex={1} gap="$1">
        <XStack justifyContent="space-between" alignItems="center">
          <StyledText
            fontSize="$sm"
            fontWeight="$semiBold"
            color="$baseTextHighEmphasis"
          >
            {transaction.description || getTransactionLabel(transaction.type)}
          </StyledText>
          <StyledText fontSize="$xs" color="$baseTextMedEmphasis">
            {formatTimestamp(transaction.timestamp)}
          </StyledText>
        </XStack>

        {transaction.amount ? (
          <XStack justifyContent="space-between">
            <StyledText fontSize="$xs" color="$baseTextMedEmphasis">
              Amount
            </StyledText>
            <StyledText
              fontSize="$xs"
              fontWeight="$medium"
              color={transaction.type === "SEND" ? "$redText" : "$greenText"}
            >
              {transaction.type === "SEND" ? "-" : "+"}
              {transaction.amount} {transaction.tokenSymbol || ""}
            </StyledText>
          </XStack>
        ) : null}

        {transaction.fee ? (
          <XStack justifyContent="space-between">
            <StyledText fontSize="$xs" color="$baseTextMedEmphasis">
              Fee
            </StyledText>
            <StyledText fontSize="$xs" color="$baseTextMedEmphasis">
              {transaction.fee} {transaction.tokenSymbol || "XNT"}
            </StyledText>
          </XStack>
        ) : null}

        {transaction.error ? (
          <StyledText fontSize="$xs" color="$redText">
            Error: {transaction.error}
          </StyledText>
        ) : null}
      </YStack>
    </XStack>
  );
}

function getTransactionLabel(type: string): string {
  const labels: Record<string, string> = {
    SEND: "Send",
    RECEIVE: "Receive",
    SWAP: "Swap",
    STAKE: "Stake",
    UNSTAKE: "Unstake",
    NFT_MINT: "NFT Mint",
    NFT_SALE: "NFT Sale",
  };
  return labels[type] || type;
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch {
    return timestamp;
  }
}

function getExplorerUrl(
  hash: string,
  _blockchain: Blockchain,
  connectionUrl: string
): string {
  // Determine the correct explorer based on the connection URL
  // The blockchain type is always "X1" for the wallet, but it can connect to Solana
  if (connectionUrl.includes("solana")) {
    // Use Solscan for Solana mainnet, explorer.solana.com for others
    if (connectionUrl.includes("mainnet")) {
      return `https://solscan.io/tx/${hash}`;
    } else if (connectionUrl.includes("devnet")) {
      return `https://explorer.solana.com/tx/${hash}?cluster=devnet`;
    } else if (connectionUrl.includes("testnet")) {
      return `https://explorer.solana.com/tx/${hash}?cluster=testnet`;
    }
    return `https://solscan.io/tx/${hash}`;
  }

  // X1 blockchain
  if (connectionUrl.includes("testnet")) {
    return `https://explorer.testnet.x1.xyz/tx/${hash}`;
  }
  return `https://explorer.mainnet.x1.xyz/tx/${hash}`;
}
