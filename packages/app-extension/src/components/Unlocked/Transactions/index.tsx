import type { CSSProperties } from "react";
import { type Blockchain /*, XNFT_GG_LINK */ } from "@coral-xyz/common";
import { useTranslation } from "@coral-xyz/i18n";
import { EmptyState, Loading } from "@coral-xyz/react-common";
import { useTheme, YStack } from "@coral-xyz/tamagui";
import Bolt from "@mui/icons-material/BoltRounded";
import { Skeleton } from "@mui/material";

import { SkeletonRow } from "../../common/TokenTable";

import { ActivityPage } from "./ActivityPage";

export function Transactions({
  ctx,
}: {
  ctx: { publicKey: string; blockchain: Blockchain };
}) {
  // Use new activity page implementation for all blockchains
  return <ActivityPage address={ctx.publicKey} blockchain={ctx.blockchain} />;
}

export function TransactionsLoader() {
  const theme = useTheme();
  return (
    <YStack flex={1} mx={16}>
      <Skeleton
        style={{
          backgroundColor: theme.baseBackgroundL1.val,
          marginLeft: 12,
        }}
        height={35}
        width={125}
      />
      <YStack
        backgroundColor="$baseBackgroundL1"
        borderRadius={12}
        mb={12}
        px={12}
      >
        <SkeletonRow backgroundColor={theme.baseBackgroundL2.val} />
        <SkeletonRow backgroundColor={theme.baseBackgroundL2.val} />
        <SkeletonRow backgroundColor={theme.baseBackgroundL2.val} />
      </YStack>
    </YStack>
  );
}

function _NoRecentActivityLabel({
  hideButton,
  minimize,
}: {
  hideButton?: boolean;
  minimize: boolean;
  style?: CSSProperties;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <YStack
      display={minimize ? "none" : "flex"}
      flex={1}
      alignItems="center"
      justifyContent="center"
      padding="$1"
    >
      <EmptyState
        icon={(props: any) => <Bolt {...props} />}
        title={t("no_recent_activity.title")}
        subtitle={t("no_recent_activity.subtitle")}
        onClick={() => {} /* window.open(XNFT_GG_LINK) */}
        buttonText={hideButton ? undefined : t("browse_xnft")}
        contentStyle={{
          color: minimize ? theme.baseTextMedEmphasis.val : "inherit",
        }}
        minimize={minimize}
      />
    </YStack>
  );
}
