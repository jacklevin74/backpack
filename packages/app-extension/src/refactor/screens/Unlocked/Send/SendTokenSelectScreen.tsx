import { useEffect,useMemo, useState } from "react";
import { useTranslation } from "@coral-xyz/i18n";
import { EmptyState, WarningIcon } from "@coral-xyz/react-common";
import { useActiveWallet } from "@coral-xyz/recoil";
import {
  ETH_NATIVE_MINT,
  SOL_NATIVE_MINT,
} from "@coral-xyz/secure-clients/legacyCommon";
import {
  ContentLoader,
  Skeleton,
  useTheme,
  XStack,
  YStack,
} from "@coral-xyz/tamagui";

import { SearchableTokenTable } from "../../../../components/common/TokenTable";
import { ScreenContainer } from "../../../components/ScreenContainer";
import {
  Routes,
  type SendTokenSelectScreenProps,
} from "../../../navigation/SendNavigator";

export function SendTokenSelectScreen(props: SendTokenSelectScreenProps) {
  return (
    <ScreenContainer loading={<Loading />}>
      <Container {...props} />
    </ScreenContainer>
  );
}

function Container({ navigation }: SendTokenSelectScreenProps) {
  const { blockchain, publicKey } = useActiveWallet();
  const { t } = useTranslation();
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  console.log("🔍 [SendTokenSelect] Component mounted");
  console.log("🔍 [SendTokenSelect] Active wallet:", { blockchain, publicKey });

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = `http://localhost:4000/wallet/${publicKey}?providerId=${blockchain.toUpperCase()}`;
        console.log("🌐 [SendTokenSelect] Fetching from:", url);

        const response = await fetch(url);
        console.log("📡 [SendTokenSelect] Response status:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ [SendTokenSelect] JSON Response:", data);

        // Transform JSON server response to token format
        const transformedTokens = data.tokens.map((token: any) => ({
          id: token.mint,
          address: token.mint,
          amount: Math.floor(
            token.balance * Math.pow(10, token.decimals)
          ).toString(),
          decimals: token.decimals,
          displayAmount: token.balance.toString(),
          token: token.mint,
          tokenListEntry: {
            id: token.symbol.toLowerCase(),
            address: token.mint,
            decimals: token.decimals,
            logo: token.logo,
            name: token.name,
            symbol: token.symbol,
          },
          marketData: {
            id: `${token.symbol.toLowerCase()}-market`,
            price: token.price,
            value: token.valueUSD,
            percentChange: 0,
            valueChange: 0,
          },
        }));

        console.log(
          "📦 [SendTokenSelect] Transformed tokens:",
          transformedTokens
        );
        console.log(
          "📦 [SendTokenSelect] Token count:",
          transformedTokens.length
        );

        setTokens(transformedTokens);
      } catch (err) {
        console.error("❌ [SendTokenSelect] Fetch error:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    };

    if (publicKey) {
      fetchTokens();
    }
  }, [publicKey, blockchain]);

  if (loading) {
    console.log("🔍 [SendTokenSelect] Showing loading state");
    return <Loading />;
  }

  if (error) {
    console.error("❌ [SendTokenSelect] Error state:", error);
    return (
      <YStack padding="$4" flex={1} justifyContent="center" alignItems="center">
        <EmptyState
          verticallyCentered
          icon={(props: any) => <WarningIcon {...props} />}
          title={t("no_tokens_to_show")}
          subtitle={error.message || t("we_couldnt_load_any_tokens_try_again")}
        />
      </YStack>
    );
  }

  return (
    <SearchableTokenTable
      tokens={tokens}
      onClickRow={(blockchain, token) => {
        navigation.push(Routes.SendAddressSelectScreen, {
          blockchain,
          assetId: token.id,
        });
      }}
      customFilter={(token) => {
        if (token.token === SOL_NATIVE_MINT) {
          return true;
        }
        if (token.token === ETH_NATIVE_MINT) {
          return true;
        }
        return parseFloat(token.amount) !== 0;
      }}
    />
  );
}

function Loading() {
  return (
    <>
      {[...Array(3)].map((_, index) => (
        <LoadingRow key={index} size={24} />
      ))}
    </>
  );
}

function LoadingRow({ size }: { size: number }) {
  const width = size * 2;
  const height = width;
  const theme = useTheme();
  return (
    <YStack gap={24} mb={24}>
      <XStack mx={16} ai="center" jc="space-between">
        <ContentLoader
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          backgroundColor={theme.baseBackgroundL0.val}
          foregroundColor={theme.baseBackgroundL1.val}
        >
          <circle cx={size} cy={size} r={size} />
        </ContentLoader>
        <XStack f={1} jc="flex-start" ml={24}>
          <Skeleton height={12} width={176} radius={10} />
        </XStack>
        <Skeleton height={12} width={74} radius={10} />
      </XStack>
      <XStack mx={16} ai="center" jc="space-between">
        <ContentLoader
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          backgroundColor={theme.baseBackgroundL0.val}
          foregroundColor={theme.baseBackgroundL1.val}
        >
          <circle cx={size} cy={size} r={size} />
        </ContentLoader>
        <XStack f={1} jc="flex-start" ml={24}>
          <Skeleton height={12} width={131} radius={10} />
        </XStack>
        <Skeleton height={12} width={74} radius={10} />
      </XStack>
    </YStack>
  );
}
