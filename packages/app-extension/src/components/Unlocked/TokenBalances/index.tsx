import React from "react";
import { Blockchain } from "@coral-xyz/common";
import {
  type ProviderId,
  TokenBalances as _TokenBalances,
} from "@coral-xyz/data-components";
import { useTranslation } from "@coral-xyz/i18n";
import {
  blockchainConnectionUrl,
  useActiveWallet,
  useIsDevnet,
} from "@coral-xyz/recoil";
import {
  temporarilyMakeStylesForBrowserExtension,
  XStack,
  YStack,
} from "@coral-xyz/tamagui";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useRecoilValueLoadable } from "recoil";

import { SkeletonRow } from "../../common/TokenTable";
import { TransferWidget } from "../Balances/TransferWidget";

export { TokenDetails } from "./TokenDetails";
import { useNavigation } from "@react-navigation/native";

import { Routes } from "../../../refactor/navigation/WalletsNavigator";

const useStyles = temporarilyMakeStylesForBrowserExtension((theme) => ({
  settings: {
    color: theme.baseTextMedEmphasis.val,
    "&:hover": {
      color: theme.accentBlue.val,
    },
  },
}));

export function TokenBalances() {
  const { t } = useTranslation();
  const classes = useStyles();
  const { publicKey, blockchain } = useActiveWallet();
  const navigation = useNavigation<any>();
  const isDevnet = useIsDevnet();

  // Safely get connection URL using loadable to handle errors
  const connectionUrlLoadable = useRecoilValueLoadable(
    blockchainConnectionUrl(blockchain)
  );

  // Get connection URL with fallback
  const connectionUrl =
    connectionUrlLoadable.state === "hasValue"
      ? connectionUrlLoadable.contents
      : undefined;

  // Determine if we're on Solana network based on connection URL
  const isSolanaNetwork = connectionUrl?.includes("solana") ?? false;
  const swapEnabled = blockchain === Blockchain.SOLANA && !isDevnet;

  // Use SOLANA or X1 as providerId based on the connection URL
  // Note: Backpack GraphQL API accepts "SOLANA" without network suffix
  const providerId = isSolanaNetwork
    ? "SOLANA"
    : (blockchain.toUpperCase() as ProviderId);

  return (
    <_TokenBalances
      address={publicKey}
      providerId={providerId as ProviderId}
      fetchPolicy="cache-and-network"
      tableFooterComponent={
        <XStack
          className={classes.settings}
          ai="center"
          alignSelf="center"
          cursor="pointer"
          gap={4}
          jc="center"
          marginTop={12}
          marginBottom={8}
          maxWidth="fit-content"
          onPress={() => {
            navigation.push(Routes.TokensDisplayManagementScreen);
          }}
        >
          <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} />
          <p style={{ margin: 0 }}>{t("manage_token_display")}</p>
        </XStack>
      }
      tableLoaderComponent={<TokenBalanceTableLoader />}
      widgets={
        <div>
          <TransferWidget
            rampEnabled
            blockchain={blockchain}
            publicKey={publicKey}
            swapEnabled={swapEnabled}
          />
        </div>
      }
    />
  );
}

export function TokenBalanceTableLoader() {
  return (
    <div style={{ borderRadius: 16, width: "100%" }}>
      <YStack>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </YStack>
    </div>
  );
}
