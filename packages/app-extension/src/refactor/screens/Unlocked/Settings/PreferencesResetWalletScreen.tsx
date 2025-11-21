import { WarningIcon } from "@coral-xyz/react-common";
import { useBackgroundClient, userClientAtom } from "@coral-xyz/recoil";
import { BpDangerButton, BpSecondaryButton, YStack } from "@coral-xyz/tamagui";
import { Box } from "@mui/material";
import { useNavigation } from "@react-navigation/native";
import { useRecoilValue } from "recoil";

import { useTranslation } from "../../../../../../i18n/src";
import {
  Header,
  HeaderIcon,
  SubtextParagraph,
} from "../../../../components/common";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { useNavigationPersistence } from "../../../hooks/useNavigationPersistence";
import type {
  Routes,
  SettingsScreenProps,
} from "../../../navigation/SettingsNavigator";

export function PreferencesResetWalletScreen(
  props: SettingsScreenProps<Routes.PreferencesResetWalletScreen>
) {
  return (
    <ScreenContainer loading={<Loading />}>
      <Container {...props} />
    </ScreenContainer>
  );
}

function Loading() {
  return null;
}

function Container(
  _props: SettingsScreenProps<Routes.PreferencesResetWalletScreen>
) {
  return <ResetWallet />;
}

function ResetWallet() {
  const navigation = useNavigation<any>();
  const background = useBackgroundClient();
  const { t } = useTranslation();
  const { reset } = useNavigationPersistence();
  const userClient = useRecoilValue(userClientAtom);

  const close = () => {
    navigation.popToTop();
    navigation.popToTop();
  };

  return (
    <Warning
      buttonTitle={t("reset_backpack")}
      title={t("reset_backpack")}
      subtext={t("reset_backpack_subtitle")}
      onNext={async () => {
        reset();
        await userClient.resetBackpack();
        setTimeout(close, 250);
      }}
    />
  );
}

function Warning({
  title,
  buttonTitle,
  subtext,
  onNext,
}: {
  title: string;
  buttonTitle: string;
  subtext: string;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const close = () => {
    navigation.popToTop();
    navigation.popToTop();
  };
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
      }}
    >
      <Box sx={{ margin: "0 24px" }}>
        <HeaderIcon icon={<WarningIcon />} />
        <Header text={title} />
        <SubtextParagraph>{subtext}</SubtextParagraph>
      </Box>
      <YStack padding="$4" space="$3">
        <BpDangerButton label={buttonTitle} onPress={() => onNext()} />
        <BpSecondaryButton label={t("cancel")} onPress={() => close()} />
      </YStack>
    </Box>
  );
}
