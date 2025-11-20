import { BACKPACK_CONFIG_VERSION, Blockchain } from "@coral-xyz/common";
import { useTranslation } from "@coral-xyz/i18n";
import { List, ListItem, XTwitterIcon } from "@coral-xyz/react-common";
import { getBlockchainLogo } from "@coral-xyz/recoil";
import {
  temporarilyMakeStylesForBrowserExtension,
  useTheme,
  YStack,
} from "@coral-xyz/tamagui";
import { GitHub } from "@mui/icons-material";
import { Typography } from "@mui/material";

import { ScreenContainer } from "../../../components/ScreenContainer";
import type {
  Routes,
  SettingsScreenProps,
} from "../../../navigation/SettingsNavigator";

export function AboutScreen(props: SettingsScreenProps<Routes.AboutScreen>) {
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

function Container(_props: SettingsScreenProps<Routes.AboutScreen>) {
  const theme = useTheme();
  const { t } = useTranslation();

  const menuItems = [
    {
      label: t("help_ampersand_support"),
      url: "https://x1.xyz",
    },
    {
      label: t("website"),
      url: "https://x1.xyz",
    },
  ];

  const handleOpenURL = (url: string) => window.open(url, "_blank");

  return (
    <YStack>
      <div style={{ marginBottom: "35px" }}>
        <img
          src={getBlockchainLogo(Blockchain.X1)}
          alt="X1 Wallet"
          style={{
            display: "flex",
            justifyContent: "center",
            margin: "32px auto",
            marginBottom: 4,
            width: "64px",
            height: "64px",
          }}
        />
        <div
          style={{
            textAlign: "center",
            marginTop: 22,
          }}
        >
          <Typography
            style={{
              fontWeight: 600,
              fontSize: "24px",
              color: theme.baseTextHighEmphasis.val,
            }}
          >
            X1 Wallet
          </Typography>
        </div>

        <Typography
          style={{ color: theme.baseTextMedEmphasis.val, textAlign: "center" }}
        >
          {BACKPACK_CONFIG_VERSION}
        </Typography>
      </div>
      {menuItems.map((item, idx) => (
        <List
          key={idx}
          style={{
            border: `${theme.baseBorderLight.val}`,
            borderRadius: "10px",
            marginBottom: "8px",
          }}
        >
          <ListItem
            key={item.label}
            isFirst={idx === 0}
            isLast={idx === menuItems.length - 1}
            onClick={() => handleOpenURL(item.url)}
            style={{
              borderRadius: "10px",
              height: "44px",
              padding: "12px",
            }}
          >
            <Typography
              style={{ fontWeight: 500, fontSize: "16px", lineHeight: "24px" }}
            >
              {item.label}
            </Typography>
          </ListItem>
        </List>
      ))}
      <div style={{ marginTop: 24 }}>
        <SocialMediaRow />
      </div>
    </YStack>
  );
}

const socialMediaItems = [
  {
    label: "X",
    onClick: () => window.open("https://x.com/mrjacklevin", "_blank"),
    icon: (props: any) => <XTwitterIcon {...props} />,
  },
  {
    label: "Github",
    onClick: () => window.open("https://github.com/jacklevin74", "_blank"),
    icon: (props: any) => <GitHub {...props} />,
  },
];

const SocialMediaRow: React.FC = () => {
  const theme = useTheme();
  const classes = useStyles();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {socialMediaItems.map((item) => (
        <div
          key={item.label}
          className={classes.icon}
          onClick={item.onClick}
          style={{ cursor: "pointer", margin: "0 12px" }}
        >
          <item.icon
            fill={theme.baseIcon.val}
            style={{ color: theme.baseIcon.val }}
            size={item.label === "X" ? 27 : 22}
          />
        </div>
      ))}
    </div>
  );
};

const useStyles = temporarilyMakeStylesForBrowserExtension(() => ({
  icon: {
    "&:hover": {
      opacity: 0.8,
    },
  },
}));
