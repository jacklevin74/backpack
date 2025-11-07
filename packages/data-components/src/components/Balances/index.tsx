import type { Blockchain } from "@coral-xyz/common";
import { hiddenTokenAddresses, useBlockchainConnectionUrl } from "@coral-xyz/recoil";
import { YStack } from "@coral-xyz/tamagui";
import {
  type ReactElement,
  type ReactNode,
  Suspense,
  useMemo,
  useState,
  useEffect,
} from "react";
import { useRecoilValue } from "recoil";

import {
  BalanceSummary,
  BalanceSummaryLoader,
  type BalanceSummaryProps,
} from "./BalanceSummary";
import { BalancesTable } from "./BalancesTable";
import type { ResponseBalanceSummary, ResponseTokenBalance } from "./utils";
import type { ProviderId } from "../../apollo/graphql";
import type { DataComponentScreenProps } from "../common";

export {
  BalanceDetails,
  type BalanceDetailsProps,
  TokenMarketInfoTable,
} from "./BalanceDetails";
export { BalancesTable } from "./BalancesTable";
export type { ResponseBalanceSummary, ResponseTokenBalance };

const DEFAULT_POLLING_INTERVAL_SECONDS = 60;

export type TokenBalancesProps = DataComponentScreenProps & {
  address: string;
  onItemClick?: (args: {
    id: string;
    displayAmount: string;
    symbol: string;
    token: string;
    tokenAccount: string;
  }) => void | Promise<void>;
  providerId: ProviderId;
  summaryStyle?: BalanceSummaryProps["style"];
  tableFooterComponent?: ReactElement;
  tableLoaderComponent: ReactNode;
  widgets?: ReactNode;
};

export const TokenBalances = ({
  tableLoaderComponent,
  ...rest
}: TokenBalancesProps) => (
  <Suspense
    fallback={
      <YStack
        alignItems="center"
        gap={30}
        marginHorizontal={16}
        marginVertical={20}
      >
        <BalanceSummaryLoader />
        {tableLoaderComponent}
      </YStack>
    }
  >
    <_TokenBalances {...rest} />
  </Suspense>
);

function _TokenBalances({
  address,
  fetchPolicy,
  onItemClick,
  pollingIntervalSeconds,
  providerId,
  summaryStyle,
  tableFooterComponent,
  widgets,
}: Omit<TokenBalancesProps, "tableLoaderComponent">) {
  const hidden = useRecoilValue(
    hiddenTokenAddresses(providerId.toLowerCase() as Blockchain)
  );

  // Get connection URL to detect testnet for X1
  const blockchain = providerId.toLowerCase() as Blockchain;
  const connectionUrl = useBlockchainConnectionUrl(blockchain);

  const [rawBalances, setRawBalances] = useState<ResponseTokenBalance[]>([]);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        // Determine the correct providerId for X1 blockchain
        let finalProviderId = providerId;
        if (blockchain === 'x1' && connectionUrl) {
          if (connectionUrl.includes('testnet')) {
            finalProviderId = 'X1-testnet' as ProviderId;
          } else {
            finalProviderId = 'X1-mainnet' as ProviderId;
          }
        }

        const url = `http://162.250.126.66:4000/wallet/${address}?providerId=${finalProviderId}`;
        console.log("🌐 [TokenBalances] Fetching from:", url);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ [TokenBalances] JSON Response:", data);

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

        setRawBalances(transformedTokens);
      } catch (error) {
        console.error("❌ [TokenBalances] Fetch error:", error);
        setRawBalances([]);
      }
    };

    fetchBalances();

    // Poll for updates
    const pollInterval =
      pollingIntervalSeconds ?? DEFAULT_POLLING_INTERVAL_SECONDS;
    if (typeof pollInterval === "number") {
      const interval = setInterval(fetchBalances, pollInterval * 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [address, providerId, pollingIntervalSeconds, blockchain, connectionUrl]);

  /**
   * Memoized value of the individual wallet token balances that
   * returned from the REST API. Also calculates the
   * monetary value and value change to be omitted from the total balance
   * aggregation based on the user's hidden token settings.
   */
  const { balances, omissions } = useMemo<{
    balances: ResponseTokenBalance[];
    omissions: { value: number; valueChange: number };
  }>(() => {
    let balances = rawBalances;

    // Override XNT token price to $1.00 for X1 blockchain
    const isX1Provider = providerId.toLowerCase() === "x1";
    const nativeMintAddress = "11111111111111111111111111111111"; // Native token address for SVM chains

    if (isX1Provider) {
      balances = balances.map((balance) => {
        // Check if this is the native XNT token
        if (
          balance.token === nativeMintAddress &&
          balance.tokenListEntry?.symbol === "XNT"
        ) {
          const amount = parseFloat(balance.displayAmount || "0");
          const fixedPrice = 1.0;
          const fixedValue = amount * fixedPrice;

          return {
            ...balance,
            marketData: balance.marketData
              ? {
                  ...balance.marketData,
                  price: fixedPrice,
                  value: fixedValue,
                  percentChange: 0, // No change for fixed price
                  valueChange: 0,
                }
              : null,
          };
        }
        return balance;
      });
    }

    const omissions = { value: 0, valueChange: 0 };
    if (hidden && hidden.length > 0) {
      balances = balances.filter((b) => {
        if (hidden.includes(b.token)) {
          omissions.value += b.marketData?.value ?? 0;
          omissions.valueChange += b.marketData?.valueChange ?? 0;
          return false;
        }
        return true;
      });
    }

    return { balances, omissions };
  }, [rawBalances, hidden, providerId]);

  /**
   * Memoized value of the inner balance summary aggregate
   * calculated from the token balances.
   */
  const aggregate: ResponseBalanceSummary = useMemo(() => {
    const totalValue = balances.reduce(
      (sum, b) => sum + (b.marketData?.value ?? 0),
      0
    );
    const totalValueChange = balances.reduce(
      (sum, b) => sum + (b.marketData?.valueChange ?? 0),
      0
    );

    return {
      id: "",
      percentChange: totalValue > 0 ? (totalValueChange / totalValue) * 100 : 0,
      value: totalValue,
      valueChange: totalValueChange,
    };
  }, [balances]);

  return (
    <YStack alignItems="center" gap={20} marginVertical={16}>
      <BalanceSummary style={summaryStyle} {...aggregate} />
      {widgets}
      <BalancesTable
        balances={balances}
        footerComponent={tableFooterComponent}
        onItemClick={onItemClick}
      />
    </YStack>
  );
}
