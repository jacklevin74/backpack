import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Blockchain, UNKNOWN_ICON_SRC } from "@coral-xyz/common";
import { useTranslation } from "@coral-xyz/i18n";
import { PrimaryButton } from "@coral-xyz/react-common";
import {
  blockchainClientAtom,
  useActiveWallet,
  useAnchorContext,
  useEthereumCtx,
  useIsValidAddress,
  useBlockchainConnectionUrl,
} from "@coral-xyz/recoil";
import {
  BpDangerButton,
  IncognitoAvatar,
  temporarilyMakeStylesForBrowserExtension,
  useTheme,
} from "@coral-xyz/tamagui";
import { BigNumber } from "ethers";
import { useRecoilValue } from "recoil";

import { BLOCKCHAIN_COMPONENTS } from "../../../../components/common/Blockchains";
import { CopyablePublicKey } from "../../../../components/common/CopyablePublicKey";
import type { TokenTableBalance } from "../../../../components/common/TokenTable";
import {
  LargeNumericInput,
  MaxAmountButton,
} from "../../../../components/Unlocked/Balances/TokensWidget/Send";
import { ScreenContainer } from "../../../components/ScreenContainer";
import {
  ConfirmationErrorDrawer,
  withTransactionCancelBypass,
} from "../../../components/TransactionConfirmation";
import {
  Routes,
  type SendAmountSelectScreenProps,
} from "../../../navigation/SendNavigator";

export function SendAmountSelectScreen(props: SendAmountSelectScreenProps) {
  return (
    <ScreenContainer loading={<LoadingContainer />}>
      <Container {...props} />
    </ScreenContainer>
  );
}

function LoadingContainer() {
  // TODO.
  return null;
}

function Container(props: SendAmountSelectScreenProps) {
  return <_Send {...props} />;
}

// TODO: probably needs rewriting.
function _Send({
  navigation,
  route: {
    params: { assetId, to },
  },
}: SendAmountSelectScreenProps) {
  const { blockchain, publicKey } = useActiveWallet();
  const connectionUrl = useBlockchainConnectionUrl(blockchain);
  const [token, setToken] = useState<TokenTableBalance | null>(null);
  const [loading, setLoading] = useState(true);

  console.log("🔍 [SendAmountSelect] Component mounted");
  console.log("🔍 [SendAmountSelect] assetId:", assetId);
  console.log("🔍 [SendAmountSelect] blockchain:", blockchain);
  console.log("🔍 [SendAmountSelect] publicKey:", publicKey);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        setLoading(true);

        // Determine the correct providerId for X1 blockchain
        let providerId = blockchain.toUpperCase();
        if (blockchain === Blockchain.X1 && connectionUrl) {
          if (connectionUrl.includes('testnet')) {
            providerId = 'X1-testnet';
          } else {
            providerId = 'X1-mainnet';
          }
        }

        const url = `http://localhost:4000/wallet/${publicKey}?providerId=${providerId}`;
        console.log("🌐 [SendAmountSelect] Fetching from:", url);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ [SendAmountSelect] JSON Response:", data);

        // Transform and find the specific token by assetId
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

        // Find the token matching the assetId
        const selectedToken = transformedTokens.find(
          (t: any) => t.id === assetId
        );
        console.log("🎯 [SendAmountSelect] Selected token:", selectedToken);

        if (selectedToken) {
          setToken(selectedToken);
        } else {
          console.error(
            "❌ [SendAmountSelect] Token not found for assetId:",
            assetId
          );
        }
      } catch (error) {
        console.error("❌ [SendAmountSelect] Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (publicKey) {
      fetchToken();
    }
  }, [publicKey, blockchain, assetId, connectionUrl]);

  if (loading || !token) {
    console.log(
      "🔍 [SendAmountSelect] Loading or no token, showing loading state"
    );
    return <LoadingContainer />;
  }

  return <_SendInner navigation={navigation} token={token} to={to} />;
}

function _SendInner({
  navigation,
  token,
  to,
}: {
  navigation: SendAmountSelectScreenProps["navigation"];
  token: TokenTableBalance;
  to: {
    address: string;
    username?: string;
    walletName?: string;
    image?: string;
    uuid?: string;
  };
}) {
  const classes = useStyles();
  const { t } = useTranslation();
  const active = useActiveWallet();
  const { provider: solanaProvider } = useAnchorContext();
  const ethereumCtx = useEthereumCtx();
  const blockchainClient = useRecoilValue(
    blockchainClientAtom(active.blockchain)
  );
  const [amount, setAmount] = useState<BigNumber | null>(null);
  const [strAmount, setStrAmount] = useState("");
  const [feeOffset, setFeeOffset] = useState(BigNumber.from(0));
  const [error, setError] = useState<string | undefined>(undefined);
  const [openDrawer, setOpenDrawer] = useState(false);
  const nftId = token.id;

  useEffect(() => {
    navigation.setOptions({
      headerTitle: t("send_ticker", {
        ticker: token.tokenListEntry?.symbol || "UNKNOWN",
      }),
    });
  }, []);

  const { isValidAddress, isErrorAddress } = useIsValidAddress(
    active.blockchain,
    to.address,
    solanaProvider.connection,
    ethereumCtx.provider
  );

  useEffect(() => {
    if (!token) return;
    setFeeOffset(
      BLOCKCHAIN_COMPONENTS[active.blockchain].MaxFeeOffset(
        { address: token.address, mint: token.token },
        ethereumCtx
      )
    );
  }, [active.blockchain, token]); // eslint-disable-line

  const amountSubFee = BigNumber.from(token!.amount).sub(feeOffset);
  const maxAmount = amountSubFee.gt(0) ? amountSubFee : BigNumber.from(0);
  const exceedsBalance = amount && amount.gt(maxAmount);
  const isSendDisabled =
    !isValidAddress || amount === null || amount.eq(0) || !!exceedsBalance;
  const isAmountError = (amount && exceedsBalance) ?? undefined;

  let sendButton;
  if (isErrorAddress) {
    sendButton = <BpDangerButton disabled label={t("invalid_address")} />;
  } else if (isAmountError) {
    sendButton = <BpDangerButton disabled label={t("insufficient_balance")} />;
  } else {
    sendButton = (
      <PrimaryButton
        disabled={isSendDisabled}
        label={t("review")}
        type="submit"
        data-testid="Send"
      />
    );
  }

  useEffect(() => {
    blockchainClient.prefetchAsset(nftId);
  }, [blockchainClient, nftId]);

  const onPressNext = async () => {
    if (!amount) {
      return;
    }

    try {
      await withTransactionCancelBypass(async () => {
        const txSignature = await blockchainClient.transferAsset({
          // Amount must be blockchain *native* units--*not* UI units.
          amount: amount.toString(),
          assetId: nftId,
          from: { publicKey: active.publicKey },
          to: { ...to, publicKey: to.address },
        });

        const amtVal = Number(strAmount.replaceAll(",", ""));
        navigation.push(Routes.SendConfirmationScreen, {
          amount: amtVal >= 1_000 ? amtVal.toLocaleString() : amtVal.toString(),
          signature: txSignature,
          tokenId: token.id,
        });
      });
    } catch (err: any) {
      setError(err.message);
      setOpenDrawer(true);
    }
  };

  return (
    <>
      <form
        noValidate
        className={classes.container}
        onSubmit={(e) => {
          e.preventDefault();
          onPressNext();
        }}
      >
        <SendV2
          to={to}
          sendButton={sendButton}
          strAmount={strAmount}
          token={token}
          maxAmount={maxAmount}
          setAmount={setAmount}
          setStrAmount={setStrAmount}
        />
      </form>
      <ConfirmationErrorDrawer
        error={error}
        open={openDrawer}
        resetError={() => setError(undefined)}
        setOpen={setOpenDrawer}
      />
    </>
  );
}

function ButtonContainer({ children }: { children: React.ReactNode }) {
  return <View style={buttonContainerStyles.container}>{children}</View>;
}

const buttonContainerStyles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 25,
  },
});

function SendV2({
  token,
  maxAmount,
  setAmount,
  strAmount,
  setStrAmount,
  sendButton,
  to,
}: {
  token: TokenTableBalance;
  maxAmount: BigNumber;
  setAmount: (val: BigNumber | null) => void;
  strAmount: string;
  setStrAmount: (val: string) => void;
  sendButton: ReactNode;
  to?: {
    address: string;
    username?: string;
    walletName?: string;
    image?: string;
    uuid?: string;
  };
}) {
  const classes = useStyles();
  const theme = useTheme();
  const { blockchain } = useActiveWallet();

  // Use X1 blockchain logo when on X1 network
  const tokenLogo = blockchain === Blockchain.X1
    ? "./x1.png"
    : (token.tokenListEntry?.logo ?? UNKNOWN_ICON_SRC);

  return (
    <>
      <div
        style={{
          paddingTop: "40px",
          flex: 1,
        }}
      >
        <div>
          {to?.uuid ? (
            <div
              className={classes.horizontalCenter}
              style={{ marginBottom: 6 }}
            >
              <div className={classes.topImageOuter}>
                <IncognitoAvatar uuid={to.uuid} size={80} fontSize={40} />
              </div>
            </div>
          ) : null}
          <div className={classes.horizontalCenter}>
            {to?.walletName || to?.username ? (
              <div
                style={{
                  color: theme.baseTextHighEmphasis.val,
                  fontSize: 16,
                  fontWeight: 500,
                }}
              >
                {to.walletName ? to.walletName : `@${to.username}`}
              </div>
            ) : null}
          </div>
          <div className={classes.horizontalCenter} style={{ marginTop: 4 }}>
            <CopyablePublicKey publicKey={to?.address ?? ""} />
          </div>
        </div>
        <div>
          <div
            style={{ display: "flex", justifyContent: "center", width: "100" }}
          >
            <LargeNumericInput
              decimals={token.decimals}
              strAmount={strAmount}
              setStrAmount={setStrAmount}
              setAmount={setAmount}
            />
          </div>
          <div
            style={{ display: "flex", justifyContent: "center", marginTop: 20 }}
          >
            <img
              src={tokenLogo}
              style={{
                height: 35,
                width: 35,
                borderRadius: "50%",
                marginRight: 5,
              }}
            />
            <div
              style={{
                color: theme.baseTextMedEmphasis.val,
                fontSize: 24,
              }}
            >
              {token.tokenListEntry?.symbol || "UNKNOWN"}
            </div>
          </div>
          <div
            style={{ display: "flex", justifyContent: "center", marginTop: 20 }}
          >
            <MaxAmountButton
              decimals={token.decimals}
              ticker={token.tokenListEntry?.symbol}
              maxAmount={maxAmount}
              setStrAmount={setStrAmount}
              setAmount={setAmount}
            />
          </div>
        </div>
      </div>
      <ButtonContainer>{sendButton}</ButtonContainer>
    </>
  );
}

export const useStyles = temporarilyMakeStylesForBrowserExtension((theme) => ({
  topImageOuter: {
    width: 80,
    height: 80,
  },
  horizontalCenter: {
    display: "flex",
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  topHalf: {
    paddingTop: "24px",
    flex: 1,
  },
  textRoot: {
    marginTop: "0 !important",
    marginBottom: "0 !important",
    "& .MuiOutlinedInput-root": {
      backgroundColor: `${theme.custom?.colors.nav} !important`,
    },
  },
}));
