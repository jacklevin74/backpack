import { useCallback, useEffect, useState } from "react";
import { gql, useFragment } from "@apollo/client";
import { Blockchain, UNKNOWN_ICON_SRC, wait } from "@coral-xyz/common";
import { useTranslation } from "@coral-xyz/i18n";
import { blockchainClientAtom, useActiveWallet } from "@coral-xyz/recoil";
import { ListItemIconCore, YStack, XStack, StyledText } from "@coral-xyz/tamagui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useRecoilValue } from "recoil";
import { useAsyncEffect } from "use-async-effect";

import { ScreenContainer } from "../../../components/ScreenContainer";
import {
  ConfirmationButtons,
  ConfirmationIcon,
  ConfirmationSubtitle,
  ConfirmationTokenAmountHeader,
} from "../../../components/TransactionConfirmation";
import type { SendConfirmationScreenProps } from "../../../navigation/SendNavigator";

export function SendConfirmationScreen(props: SendConfirmationScreenProps) {
  return (
    <ScreenContainer loading={<Loading />}>
      <Container {...props} />
    </ScreenContainer>
  );
}

function Loading() {
  return null;
}

type _TokenBalanceConfirmationFragment = {
  token?: string;
  tokenListEntry?: {
    logo?: string;
    symbol?: string;
  };
};

function Container({ navigation, route }: SendConfirmationScreenProps) {
  const { amount, signature, tokenId } = route.params;

  const { t } = useTranslation();
  const { blockchain, publicKey } = useActiveWallet();
  const client = useRecoilValue(blockchainClientAtom(blockchain));
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  );

  // Set the header of the screen based on the state of the confirmation
  useEffect(() => {
    navigation.setOptions({
      headerTitle: isConfirmed ? t("send_confirmed") : t("sending_dots"),
    });
  }, [isConfirmed, navigation, t]);

  // Handle the asynchronous confirmation of the transaction signature
  useAsyncEffect(async () => {
    try {
      // For X1, skip waiting for confirmation - show success immediately
      if (blockchain === Blockchain.X1) {
        setIsConfirmed(true);
      } else {
        await client.confirmTransaction(signature);
        await wait(2);
        setIsConfirmed(true);
      }
    } catch (e) {
      const error = e as Error;
      setErrorMessage(error?.message ?? t("failed"));
    }
  }, [
    blockchain,
    client,
    publicKey,
    setErrorMessage,
    setIsConfirmed,
    signature,
    t,
  ]);

  // Handle the navigation pop back to the root
  const handlePressPrimary = useCallback(() => {
    if (isConfirmed) {
      navigation.popToTop();
      navigation.popToTop();
    }
  }, [isConfirmed, navigation]);

  // Fetch the Apollo cache data for the argued token balance node ID
  const { data } = useFragment<_TokenBalanceConfirmationFragment>({
    fragmentName: "TokenBalanceConfirmationFragment",
    from: {
      __typename: "TokenBalance",
      id: tokenId,
    },
    fragment: gql`
      fragment TokenBalanceConfirmationFragment on TokenBalance {
        token
        tokenListEntry {
          logo
          symbol
        }
      }
    `,
  });

  const symbol = data?.tokenListEntry?.symbol || "";
  const subtitle = errorMessage || t("send_pending", { symbol });

  // Determine native token symbol for priority fee display
  const nativeSymbol = blockchain === Blockchain.X1 ? "XNT" : "SOL";
  // X1 has minimal priority fees, show a standard low value
  const maxPriorityFee = blockchain === Blockchain.X1 ? "0.000001" : "0.000005";

  return (
    <YStack ai="center" f={1} jc="center" p={24}>
      <YStack
        ai="center"
        backgroundColor="$baseBackgroundL1"
        borderRadius={24}
        gap={32}
        p={32}
        width="100%"
        style={{
          boxShadow: "0 8px 32px rgba(0, 255, 255, 0.1)",
          border: "1px solid rgba(0, 255, 255, 0.2)",
        }}
      >
        <ConfirmationIcon confirmed={isConfirmed} hasError={!!errorMessage} />

        <YStack ai="center" gap={12}>
          <ConfirmationTokenAmountHeader
            amount={amount}
            symbol={symbol}
            icon={
              data?.tokenListEntry?.logo && data.tokenListEntry.logo !== UNKNOWN_ICON_SRC ? (
                <ListItemIconCore
                  radius="$circular"
                  size={48}
                  image={data.tokenListEntry.logo}
                />
              ) : null
            }
          />
        </YStack>

        <ConfirmationSubtitle confirmed={isConfirmed} content={subtitle} />

        {/* Max Priority Fee Display */}
        <XStack f={1} ai="center" jc="space-between" width="100%">
          <StyledText
            color="$baseTextMedEmphasis"
            fontWeight="$bold"
            fontSize="$xs"
          >
            {t("max_priority_fee")}
          </StyledText>
          <StyledText color="$baseTextMedEmphasis" fontSize="$xs">
            {maxPriorityFee} {nativeSymbol}
          </StyledText>
        </XStack>

        <ConfirmationButtons
          blockchain={blockchain}
          confirmed={isConfirmed}
          confirmedLabel={t("view_balances")}
          onConfirmedPress={handlePressPrimary}
          signature={signature}
        />
      </YStack>
    </YStack>
  );
}
