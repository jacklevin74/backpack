import { Blockchain } from "@coral-xyz/common";
import {
  blockchainConfigAtom,
  blockchainConnectionUrl,
  useActiveWallet,
  useBackgroundClient,
} from "@coral-xyz/recoil";
import { useTheme } from "@coral-xyz/tamagui";
import { Check } from "@mui/icons-material";
import { useRecoilValue } from "recoil";

import { SettingsList } from "../../../../components/common/Settings/List";
import { changeNetwork } from "../../../../components/Unlocked/Settings/Preferences/Blockchains/ConnectionSwitch";
import { ScreenContainer } from "../../../components/ScreenContainer";
import type {
  Routes,
  SettingsScreenProps,
} from "../../../navigation/SettingsNavigator";

export function NetworkSelectScreen(
  _props: SettingsScreenProps<Routes.NetworkSelectScreen>
) {
  return (
    <ScreenContainer loading={<Loading />}>
      <Container />
    </ScreenContainer>
  );
}

function Loading() {
  return null;
}

function Checkmark() {
  const theme = useTheme();
  return (
    <Check
      style={{
        color: theme.accentBlue.val,
      }}
    />
  );
}

function Container() {
  const activeWallet = useActiveWallet();
  const background = useBackgroundClient();

  // Get connection URLs for both blockchains
  const x1ConnectionUrl = useRecoilValue(
    blockchainConnectionUrl(Blockchain.X1)
  );
  const solanaConnectionUrl = useRecoilValue(
    blockchainConnectionUrl(Blockchain.SOLANA)
  );

  // Get configs for both X1 and Solana
  const x1Config = useRecoilValue(blockchainConfigAtom(Blockchain.X1));
  const solanaConfig = useRecoilValue(blockchainConfigAtom(Blockchain.SOLANA));

  // Only show for X1 and Solana blockchains
  if (
    activeWallet.blockchain !== Blockchain.X1 &&
    activeWallet.blockchain !== Blockchain.SOLANA
  ) {
    return null;
  }

  const menuItems: Record<string, any> = {};

  // Add X1 networks
  if (x1Config) {
    Object.entries(x1Config.RpcConnectionUrls).forEach(
      ([, { name, url, chainId }]) => {
        menuItems[name] = {
          onClick: () => {
            changeNetwork(background, Blockchain.X1, url, chainId);
          },
          detail: x1ConnectionUrl === url ? <Checkmark /> : null,
        };
      }
    );
  }

  // Add Solana networks
  if (solanaConfig) {
    Object.entries(solanaConfig.RpcConnectionUrls).forEach(
      ([, { name, url, chainId }]) => {
        menuItems[name] = {
          onClick: () => {
            changeNetwork(background, Blockchain.SOLANA, url, chainId);
          },
          detail: solanaConnectionUrl === url ? <Checkmark /> : null,
        };
      }
    );
  }

  return <SettingsList menuItems={menuItems} />;
}
