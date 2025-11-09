import { Blockchain } from "@coral-xyz/common";
import {
  hiddenTokenAddresses,
  useBlockchainConnectionUrl,
} from "@coral-xyz/recoil";
import { backendApiUrl } from "@coral-xyz/recoil/src/atoms/preferences";
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

const DEFAULT_POLLING_INTERVAL_SECONDS = 1;

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

  // Get connection URL to detect which network we're on
  // Always use Blockchain.X1 because the network toggle changes X1's RPC URL,
  // not a separate Solana blockchain config
  const connectionUrl = useBlockchainConnectionUrl(Blockchain.X1);
  const apiUrl = useRecoilValue(backendApiUrl);

  const [rawBalances, setRawBalances] = useState<ResponseTokenBalance[]>([]);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        console.log(
          "🔵 [TokenBalances] ========== FETCH BALANCES START =========="
        );
        console.log("🔵 [TokenBalances] Input providerId:", providerId);
        console.log("🔵 [TokenBalances] ConnectionURL:", connectionUrl);

        // Determine the correct providerId based on the connection URL
        // Since we treat Solana networks as RPC alternatives for X1 wallets,
        // we need to detect the network from the URL, not the blockchain type
        let finalProviderId = providerId;

        if (connectionUrl) {
          console.log("🔵 [TokenBalances] Checking connection URL...");
          console.log(
            "🔵 [TokenBalances] URL includes 'solana.com'?",
            connectionUrl.includes("solana.com")
          );
          console.log(
            "🔵 [TokenBalances] URL includes 'solana-mainnet.quiknode.pro'?",
            connectionUrl.includes("solana-mainnet.quiknode.pro")
          );
          console.log(
            "🔵 [TokenBalances] URL includes 'solana'?",
            connectionUrl.includes("solana")
          );
          console.log(
            "🔵 [TokenBalances] URL includes 'x1.xyz'?",
            connectionUrl.includes("x1.xyz")
          );

          // Check for Solana networks first (including QuickNode)
          if (connectionUrl.includes("solana")) {
            console.log("🟢 [TokenBalances] Detected SOLANA network!");
            // Check mainnet first (must come before testnet check)
            if (
              connectionUrl.includes("mainnet") ||
              connectionUrl.includes("solana-mainnet")
            ) {
              finalProviderId = "SOLANA-mainnet" as ProviderId;
              console.log("🟢 [TokenBalances] Set to SOLANA-mainnet");
            } else if (connectionUrl.includes("devnet")) {
              finalProviderId = "SOLANA-devnet" as ProviderId;
              console.log("🟢 [TokenBalances] Set to SOLANA-devnet");
            } else if (connectionUrl.includes("testnet")) {
              finalProviderId = "SOLANA-testnet" as ProviderId;
              console.log("🟢 [TokenBalances] Set to SOLANA-testnet");
            }
          }
          // Check for X1 networks
          else if (connectionUrl.includes("x1.xyz")) {
            console.log("🟡 [TokenBalances] Detected X1 network!");
            if (connectionUrl.includes("testnet")) {
              finalProviderId = "X1-testnet" as ProviderId;
              console.log("🟡 [TokenBalances] Set to X1-testnet");
            } else if (connectionUrl.includes("mainnet")) {
              finalProviderId = "X1-mainnet" as ProviderId;
              console.log("🟡 [TokenBalances] Set to X1-mainnet");
            }
          }
        }

        console.log("🔵 [TokenBalances] Final providerId:", finalProviderId);

        const url = `${apiUrl}/wallet/${address}?providerId=${finalProviderId}`;
        console.log("🌐 [TokenBalances] Fetching from:", url);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ [TokenBalances] JSON Response:", data);

        // Detect if we're on a Solana network by checking the connection URL
        const isSolanaNetwork = connectionUrl?.includes("solana") || false;
        console.log("🔵 [TokenBalances] isSolanaNetwork:", isSolanaNetwork);
        const nativeMintAddress = "11111111111111111111111111111111";

        // Transform JSON server response to token format
        const transformedTokens = data.tokens.map(
          (token: any, index: number) => {
            console.log(`🔵 [TokenBalances] Processing token ${index}:`, token);

            // Check if this is the native token (SOL/XNT)
            const isNativeToken = token.mint === nativeMintAddress;
            console.log(
              `🔵 [TokenBalances] Token ${index} - isNativeToken:`,
              isNativeToken
            );
            console.log(
              `🔵 [TokenBalances] Token ${index} - mint:`,
              token.mint
            );
            console.log(
              `🔵 [TokenBalances] Token ${index} - expected mint:`,
              nativeMintAddress
            );

            // Determine display values based on network
            let displaySymbol = token.symbol;
            let displayName = token.name;
            let displayLogo = token.logo;

            console.log(
              `🔵 [TokenBalances] Token ${index} - Original symbol:`,
              displaySymbol
            );
            console.log(
              `🔵 [TokenBalances] Token ${index} - Original name:`,
              displayName
            );
            console.log(
              `🔵 [TokenBalances] Token ${index} - Original logo:`,
              displayLogo
            );

            if (isNativeToken) {
              console.log(
                `🔵 [TokenBalances] Token ${index} - Is native token, checking network...`
              );
              if (isSolanaNetwork) {
                console.log(
                  `🟢 [TokenBalances] Token ${index} - SOLANA network detected, setting SOL values`
                );
                // On Solana networks, show SOL
                displaySymbol = "SOL";
                displayName = "Solana Native Token";
                displayLogo = "solana.png";
              } else {
                console.log(
                  `🟡 [TokenBalances] Token ${index} - X1 network detected, setting XNT values`
                );
                // On X1 networks, show XNT
                displaySymbol = "XNT";
                displayName = token.name;
                displayLogo = "x1.png";
              }
            }

            console.log(
              `🔵 [TokenBalances] Token ${index} - Final symbol:`,
              displaySymbol
            );
            console.log(
              `🔵 [TokenBalances] Token ${index} - Final name:`,
              displayName
            );
            console.log(
              `🔵 [TokenBalances] Token ${index} - Final logo:`,
              displayLogo
            );

            return {
              id: token.mint,
              address: token.mint,
              amount: Math.floor(
                token.balance * Math.pow(10, token.decimals)
              ).toString(),
              decimals: token.decimals,
              displayAmount: token.balance.toString(),
              token: token.mint,
              tokenListEntry: {
                id: displaySymbol.toLowerCase(),
                address: token.mint,
                decimals: token.decimals,
                logo: displayLogo,
                name: displayName,
                symbol: displaySymbol,
              },
              marketData: {
                id: `${displaySymbol.toLowerCase()}-market`,
                price: token.price,
                value: token.valueUSD,
                percentChange: 0,
                valueChange: 0,
              },
            };
          }
        );

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
  }, [address, providerId, pollingIntervalSeconds, connectionUrl, apiUrl]);

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

    // Override native token price to $1.00 for X1 blockchain (XNT)
    // For Solana, use the market price from the server
    const isX1Network = connectionUrl?.includes("x1.xyz") || false;
    const nativeMintAddress = "11111111111111111111111111111111"; // Native token address for SVM chains

    if (isX1Network) {
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
  }, [rawBalances, hidden, providerId, connectionUrl]);

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
