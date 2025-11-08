import { useCallback } from "react";
import type { Blockchain } from "@coral-xyz/common";
import { Loading } from "@coral-xyz/react-common";
import {
  ScrollView,
  StyledText,
  useTheme,
  XStack,
  YStack,
} from "@coral-xyz/tamagui";

import type { Transaction } from "./useCustomTransactions";
import { useCustomTransactions } from "./useCustomTransactions";

interface ActivityPageProps {
  address: string;
  blockchain: Blockchain;
}

export function ActivityPage({ address, blockchain }: ActivityPageProps) {
  const { transactions, loading, hasMore, error, loadMore, refresh } =
    useCustomTransactions(address, blockchain);
  const theme = useTheme();

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
    <ScrollView
      flex={1}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      <YStack padding="$4" gap="$2">
        {transactions.map((tx, index) => (
          <TransactionItem
            key={tx.hash || index}
            transaction={tx}
            blockchain={blockchain}
          />
        ))}

        {hasMore ? <XStack justifyContent="center" padding="$3">
          {loading ? (
            <Loading iconStyle={{ width: 20, height: 20 }} />
            ) : (
              <StyledText
                fontSize="$sm"
                color="$accentBlue"
                cursor="pointer"
                onPress={loadMore}
              >
                Load More
              </StyledText>
            )}
        </XStack> : null}
      </YStack>
    </ScrollView>
  );
}

function TransactionItem({
  transaction,
  blockchain,
}: {
  transaction: Transaction;
  blockchain: Blockchain;
}) {
  const theme = useTheme();

  const handleClick = () => {
    const explorerUrl = getExplorerUrl(transaction.hash, blockchain);
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

        {transaction.amount ? <XStack justifyContent="space-between">
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
        </XStack> : null}

        {transaction.fee ? <XStack justifyContent="space-between">
          <StyledText fontSize="$xs" color="$baseTextMedEmphasis">
            Fee
          </StyledText>
          <StyledText fontSize="$xs" color="$baseTextMedEmphasis">
            {transaction.fee} {transaction.tokenSymbol || "XNT"}
          </StyledText>
        </XStack> : null}

        {transaction.error ? <StyledText fontSize="$xs" color="$redText">
          Error: {transaction.error}
        </StyledText> : null}
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

function getExplorerUrl(hash: string, blockchain: Blockchain): string {
  if (blockchain.toLowerCase() === "x1") {
    return `https://explorer.testnet.x1.xyz/tx/${hash}`;
  }
  return `https://explorer.solana.com/tx/${hash}`;
}
