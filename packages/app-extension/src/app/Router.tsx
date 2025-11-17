import { Suspense, useEffect, useState } from "react";
import {
  BACKEND_API_URL,
  Blockchain,
  EXTENSION_HEIGHT,
  EXTENSION_WIDTH,
  getLogger,
  QUERY_ONBOARDING,
} from "@coral-xyz/common";
import { useActiveWallet, useBackgroundClient } from "@coral-xyz/recoil";
import {
  blockchainConnectionUrl,
  isDeveloperMode,
} from "@coral-xyz/recoil/src/atoms/preferences";
import { useAllUsersNullable } from "@coral-xyz/recoil/src/hooks/preferences";
import {
  AlertTriangleIcon,
  StyledText,
  temporarilyMakeStylesForBrowserExtension,
  useTheme,
  XStack,
} from "@coral-xyz/tamagui";
import { useRecoilValue } from "recoil";

import { PopupLoadingSkeleton } from "../components/common/LoadingSkeleton";
import { Unlocked } from "../components/Unlocked";
import { refreshFeatureGates } from "../gates/FEATURES";

import "./App.css";

const logger = getLogger("router");

export default function Router() {
  const classes = useStyles();

  return (
    <div className={classes.appContainer}>
      <PopupRouter />
      <OfflineBanner />
      <TestnetBanner />
    </div>
  );
}

function TestnetBanner() {
  const { blockchain } = useActiveWallet();
  const connectionUrl = useRecoilValue(blockchainConnectionUrl(blockchain));
  const developerMode = useRecoilValue(isDeveloperMode);

  // Determine network name based on connection URL
  // Since we treat Solana networks as alternative RPCs for X1, we check the URL directly
  const getNetworkName = () => {
    // Check X1 URLs
    if (connectionUrl === "http://127.0.0.1:8901") {
      return developerMode ? "X1 LOCALNET • DEVELOPER MODE" : "X1 LOCALNET";
    } else if (connectionUrl === "https://rpc.testnet.x1.xyz") {
      return developerMode ? "X1 TESTNET • DEVELOPER MODE" : "X1 TESTNET";
    } else if (connectionUrl === "https://rpc.mainnet.x1.xyz") {
      return developerMode ? "X1 MAINNET • DEVELOPER MODE" : "X1 MAINNET";
    }
    // Check Solana URLs (including QuickNode)
    else if (connectionUrl === "http://127.0.0.1:8899") {
      return developerMode
        ? "SOLANA LOCALNET • DEVELOPER MODE"
        : "SOLANA LOCALNET";
    } else if (
      connectionUrl === "https://api.mainnet-beta.solana.com" ||
      connectionUrl?.includes("solana-mainnet.quiknode.pro")
    ) {
      return developerMode
        ? "SOLANA MAINNET • DEVELOPER MODE"
        : "SOLANA MAINNET";
    } else if (
      connectionUrl === "https://api.devnet.solana.com" ||
      connectionUrl?.includes("solana-devnet")
    ) {
      return developerMode ? "SOLANA DEVNET • DEVELOPER MODE" : "SOLANA DEVNET";
    } else if (
      connectionUrl === "https://api.testnet.solana.com" ||
      connectionUrl?.includes("solana-testnet")
    ) {
      return developerMode
        ? "SOLANA TESTNET • DEVELOPER MODE"
        : "SOLANA TESTNET";
    }
    return null;
  };

  const networkName = getNetworkName();

  // Log network status for debugging
  console.log(
    `[Network Banner] Blockchain: ${blockchain}, URL: ${connectionUrl}, Network: ${networkName}, DevMode: ${developerMode}`
  );

  if (!networkName) {
    return null;
  }

  return (
    <XStack
      width="100%"
      backgroundColor="rgba(59, 130, 246, 0.15)"
      gap="4px"
      paddingVertical="2px"
      paddingHorizontal="$2"
      justifyContent="center"
      alignItems="center"
      zIndex={100}
      height="16px"
    >
      <StyledText fontSize={10} fontWeight="600" color="rgb(59, 130, 246)">
        {networkName}
      </StyledText>
    </XStack>
  );
}

function OfflineBanner() {
  // Offline banner disabled
  return null;
}

function PopupRouter() {
  return <FullApp />;
}

function FullApp() {
  logger.debug("full app");
  const background = useBackgroundClient();
  const allUsers = useAllUsersNullable();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Refresh feature gates in background without blocking UI render
    // With caching, this will be instant on subsequent loads
    refreshFeatureGates(background).catch((err) => {
      console.warn("Failed to refresh feature gates:", err);
    });
  }, [background]);

  // Check if there are no users and redirect to onboarding
  // This handles the case where user started onboarding but didn't finish
  // When they click the extension icon, they should be sent back to onboarding
  useEffect(() => {
    if (allUsers !== null && allUsers.length === 0 && !hasRedirected) {
      console.log("No users found, redirecting to onboarding");
      setHasRedirected(true);
      // Open onboarding in a new tab and close the popup
      const url = globalThis.chrome?.runtime?.getURL(
        `options.html?${QUERY_ONBOARDING}`
      );
      if (url) {
        globalThis.chrome?.tabs?.create({ url });
        window.close();
      }
    }
  }, [allUsers, hasRedirected]);

  // Show loading skeleton while we're checking for users or redirecting
  if (allUsers === null || allUsers.length === 0) {
    return <PopupLoadingSkeleton />;
  }

  return <Unlocked />;
}

export function WithSuspense(props: any) {
  return <Suspense fallback={<BlankApp />}>{props.children}</Suspense>;
}

const useStyles = temporarilyMakeStylesForBrowserExtension(() => {
  return {
    appContainer: {
      minWidth: `${EXTENSION_WIDTH}px`,
      minHeight: `${EXTENSION_HEIGHT}px`,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "relative",
    },
  };
});

function BlankApp() {
  const classes = useStyles();
  const theme = useTheme();
  return (
    <div
      className={classes.appContainer}
      style={{
        backgroundColor: theme.baseBackgroundL0.val,
      }}
    />
  );
}

export const MOTION_VARIANTS = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: { delay: 0.09 },
  },
  exit: {
    transition: { delay: 0.09, duration: 0.1 },
    opacity: 0,
  },
};
