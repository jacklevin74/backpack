/* eslint-disable react-hooks/exhaustive-deps */
import type { Blockchain } from "@coral-xyz/common";
import {
  BACKPACK_FEATURE_AGGREGATE_WALLETS,
  UI_RPC_METHOD_SETTINGS_AGGREGATE_WALLETS_UPDATE,
} from "@coral-xyz/common";
import { useTranslation } from "@coral-xyz/i18n";
import {
  enabledBlockchainConfigsAtom,
  getBlockchainLogo,
  secureUserAtom,
  useActiveWallet,
  useBackgroundClient,
  useIsAggregateWallets,
  userClientAtom,
} from "@coral-xyz/recoil";
import { temporarilyMakeStylesForBrowserExtension } from "@coral-xyz/tamagui";
import { Switch, Typography } from "@mui/material";
import { useNavigation } from "@react-navigation/native";
import { useRecoilValue } from "recoil";

import { Routes } from "../../../../refactor/navigation/SettingsNavigator";
import { SettingsList } from "../../../common/Settings/List";

const useStyles = temporarilyMakeStylesForBrowserExtension((theme) => ({
  switchBase: {
    "&:hover": {
      backgroundColor: "transparent !important",
      "@media (hover: none)": {
        backgroundColor: "transparent !important",
      },
    },
  },
  colorPrimary: {
    "&.Mui-checked": {
      color: theme.accentBlue.val,
    },
  },
  disabled: {
    "&.Mui-checked": {
      color: `${theme.accentBlue.val} !important`,
      opacity: 0.5,
    },
  },
  track: {},
  trackChecked: {
    backgroundColor: `${theme.accentBlue.val} !important`,
  },
}));

export function Preferences() {
  const navigation = useNavigation<any>();
  const user = useRecoilValue(secureUserAtom);
  const background = useBackgroundClient();
  const userClient = useRecoilValue(userClientAtom);
  const isAggregateWallets = useIsAggregateWallets();
  const enabledBlockchainConfigs = useRecoilValue(enabledBlockchainConfigsAtom);
  const { blockchain } = useActiveWallet();
  const { t } = useTranslation();

  const onDeveloperModeSwitch = async (developerMode: boolean) => {
    await userClient.updateUserPreferences({
      uuid: user.user.uuid,
      preferences: {
        developerMode,
      },
    });
  };

  //
  // Global.
  //
  const menuItems: any = {
    [t("auto_lock_timer")]: {
      onClick: () => navigation.push(Routes.PreferencesAutolockScreen),
    },
    [t("trusted_sites")]: {
      onClick: () => navigation.push(Routes.PreferencesTrustedSitesScreen),
    },
    [t("language")]: {
      onClick: () => navigation.push(Routes.PreferencesLanguageScreen),
    },
    [t("developer_mode")]: {
      onClick: () => onDeveloperModeSwitch(!user.preferences.developerMode),
      detail: (
        <ModeSwitch
          enabled={user.preferences.developerMode}
          onSwitch={(enabled) => onDeveloperModeSwitch(enabled)}
        />
      ),
    },
    [t("hidden_tokens")]: {
      onClick: () => navigation.push(Routes.PreferencesHiddenTokensScreen),
    },
  };

  // Add blockchain-specific settings
  menuItems["RPC Connection"] = {
    onClick: () =>
      navigation.push(Routes.PreferencesBlockchainRpcConnectionScreen, {
        blockchain,
      }),
  };

  menuItems["Confirmation Commitment"] = {
    onClick: () =>
      navigation.push(Routes.PreferencesBlockchainCommitmentScreen, {
        blockchain,
      }),
  };

  menuItems["Explorer"] = {
    onClick: () =>
      navigation.push(Routes.PreferencesBlockchainExplorerScreen, {
        blockchain,
      }),
  };

  // Add reset wallet option (destructive action)
  menuItems[t("reset_backpack")] = {
    onClick: () => navigation.push(Routes.PreferencesResetWalletScreen),
    label: (
      <Typography style={{ fontWeight: 500, color: "#EF4444" }}>
        {t("reset_backpack")}
      </Typography>
    ),
  };

  // if (BACKPACK_FEATURE_LIGHT_MODE) {
  //   menuItems[t("dark_mode")] = {
  //     onClick: () => onDarkModeSwitch(!isDarkMode),
  //     detail: (
  //       <ModeSwitch
  //         enabled={isDarkMode}
  //         onSwitch={(enabled) => onDarkModeSwitch(enabled)}
  //       />
  //     ),
  //   };
  // }

  /*
  menuItems[t("developer_mode")] = {
    onClick: () => onDeveloperModeSwitch(!isDeveloperMode),
    detail: (
      <ModeSwitch
        enabled={isDeveloperMode}
        onSwitch={(enabled) => onDeveloperModeSwitch(enabled)}
      />
    ),
  };

  menuItems[t("full_screen_avatar")] = {
    onClick: () => onFullScreenLockSwitch(!isFullScreenLockAvatar),
    detail: (
      <ModeSwitch
        enabled={isFullScreenLockAvatar}
        onSwitch={(enabled) => onFullScreenLockSwitch(enabled)}
      />
    ),
  };
  */

  return (
    <div>
      <SettingsList menuItems={menuItems} />
    </div>
  );
}

export function ModeSwitch({
  enabled,
  onSwitch,
}: {
  enabled: boolean;
  onSwitch: (enabled: boolean) => void;
}) {
  return <SwitchToggle enabled={enabled} onChange={() => onSwitch(!enabled)} />;
}

export function SwitchToggle({
  enabled,
  onChange,
  disableUiState = false,
}: {
  enabled: boolean;
  onChange: () => void;
  disableUiState?: boolean;
}) {
  const classes = useStyles();
  return (
    <Switch
      disableRipple
      disabled={disableUiState}
      checked={enabled}
      onChange={onChange}
      classes={{
        switchBase: classes.switchBase,
        track: enabled ? classes.trackChecked : classes.track,
        colorPrimary: disableUiState ? classes.disabled : classes.colorPrimary,
      }}
    />
  );
}
