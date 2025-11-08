import { useEffect } from "react";
import type { Blockchain } from "@coral-xyz/common";
import { Loading } from "@coral-xyz/react-common";
import { StyledText,useTheme, XStack, YStack } from "@coral-xyz/tamagui";
import { useNavigation } from "@react-navigation/native";

import { Routes } from "../../../refactor/navigation/WalletsNavigator";

import { useCustomTransactions } from "./useCustomTransactions";

interface CustomTransactionsListProps {
  ctx: { publicKey: string; blockchain: Blockchain };
}

export function CustomTransactionsList({ ctx }: CustomTransactionsListProps) {
  const { transactions, loading, hasMore, error, loadMore, refresh } =
    useCustomTransactions(ctx.publicKey, ctx.blockchain);
  const theme = useTheme();
  const navigation = useNavigation<any>();

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
    <YStack flex={1} padding="$4">
      {transactions.map((tx, index) => (
        <XStack
          key={tx.hash || index}
          backgroundColor="$baseBackgroundL1"
          borderRadius={12}
          padding="$3"
          marginBottom="$2"
          cursor="pointer"
          onPress={() => {
            // Open explorer or detail screen
            const explorerUrl = getExplorerUrl(tx.hash, ctx.blockchain);
            window.open(explorerUrl, "_blank");
          }}
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
                {tx.description || getTransactionLabel(tx.type)}
              </StyledText>
              <StyledText fontSize="$xs" color="$baseTextMedEmphasis">
                {tx.timestamp ? formatTimestamp(tx.timestamp) : ""}
              </StyledText>
            </XStack>

            {tx.amount ? <XStack justifyContent="space-between">
              <StyledText fontSize="$xs" color="$baseTextMedEmphasis">
                Amount
              </StyledText>
              <StyledText
                fontSize="$xs"
                fontWeight="$medium"
                color={tx.type === "SEND" ? "$redText" : "$greenText"}
                >
                {tx.type === "SEND" ? "-" : "+"}
                {tx.amount} {tx.tokenSymbol || ""}
              </StyledText>
            </XStack> : null}

            {tx.fee ? <XStack justifyContent="space-between">
              <StyledText fontSize="$xs" color="$baseTextMedEmphasis">
                Fee
              </StyledText>
              <StyledText fontSize="$xs" color="$baseTextMedEmphasis">
                {tx.fee} {tx.tokenSymbol || "XNT"}
              </StyledText>
            </XStack> : null}

            {tx.error ? <StyledText fontSize="$xs" color="$redText">
              Error: {tx.error}
            </StyledText> : null}
          </YStack>
        </XStack>
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
      // Less than a week
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
