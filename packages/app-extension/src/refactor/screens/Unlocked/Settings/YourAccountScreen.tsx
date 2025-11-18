import { useTranslation } from "@coral-xyz/i18n";
import { useKeyringHasMnemonic } from "@coral-xyz/recoil";

import { SettingsList } from "../../../../components/common/Settings/List";
import { ScreenContainer } from "../../../components/ScreenContainer";
import {
  Routes,
  type SettingsScreenProps,
} from "../../../navigation/SettingsNavigator";

export function YourAccountScreen(
  props: SettingsScreenProps<Routes.YourAccountScreen>
) {
  return (
    <ScreenContainer loading={<Loading />}>
      <Container {...props} />
    </ScreenContainer>
  );
}

function Loading() {
  // TODO.
  return null;
}

function Container({
  navigation,
}: SettingsScreenProps<Routes.YourAccountScreen>) {
  const hasMnemonic = useKeyringHasMnemonic();
  const { t } = useTranslation();

  // X1 Wallet: Removed account removal and account name update
  const menuItems = {
    [t("change_password")]: {
      onClick: () => navigation.push(Routes.YourAccountChangePasswordScreen),
    },
    ...(hasMnemonic
      ? {
          [t("show_recovery_phrase")]: {
            onClick: () =>
              navigation.push(Routes.YourAccountShowMnemonicWarningScreen),
          },
        }
      : {}),
  };

  return <SettingsList menuItems={menuItems} />;
}
