import { Suspense, useEffect, useState } from "react";
import {
  BACKEND_API_URL,
  Blockchain,
  EXTENSION_HEIGHT,
  EXTENSION_WIDTH,
  getLogger,
} from "@coral-xyz/common";
import { useActiveWallet, useBackgroundClient } from "@coral-xyz/recoil";
import {
  AlertTriangleIcon,
  StyledText,
  temporarilyMakeStylesForBrowserExtension,
  useTheme,
  XStack,
} from "@coral-xyz/tamagui";
import { useRecoilValue } from "recoil";
import { blockchainConnectionUrl } from "@coral-xyz/recoil/src/atoms/preferences";

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

  // Only show banner for X1 Testnet
  const isX1Testnet =
    blockchain === Blockchain.X1 &&
    connectionUrl === "https://rpc.testnet.x1.xyz";

  // Log network status for debugging
  console.log(
    `[X1 Network ext:0.10.59] Blockchain: ${blockchain}, URL: ${connectionUrl}, IsTestnet: ${isX1Testnet}`
  );

  if (!isX1Testnet) {
    return null;
  }

  return (
    <XStack
      position="absolute"
      width="100%"
      top="0px"
      backgroundColor="rgba(255, 152, 0, 0.15)"
      gap="4px"
      paddingVertical="2px"
      paddingHorizontal="$2"
      justifyContent="center"
      alignItems="center"
      zIndex={100}
      height="16px"
    >
      <AlertTriangleIcon color="rgb(255, 152, 0)" size={12} />
      <StyledText fontSize={10} fontWeight="600" color="rgb(255, 152, 0)">
        X1 TESTNET
      </StyledText>
    </XStack>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);
  useEffect(() => {
    // navigator.onLine is unreliable
    fetch(BACKEND_API_URL, { method: "HEAD" }).catch(() => {
      setOffline(true);
    });
  }, []);
  if (!offline) {
    return null;
  }
  return (
    <XStack
      position="absolute"
      width="100%"
      bottom="0px"
      backgroundColor="rgba(206, 121, 7, 0.1)"
      gap="$2"
      padding="$2"
      justifyContent="center"
      alignItems="center"
    >
      <AlertTriangleIcon color="rgb(177, 87, 0)" size="$md" />
      <StyledText fontSize="$sm" color="rgb(177, 87, 0)">
        No internet connection.
      </StyledText>
    </XStack>
  );
}

function PopupRouter() {
  return <FullApp />;
}

function FullApp() {
  logger.debug("full app");
  const background = useBackgroundClient();
  useEffect(() => {
    (async () => {
      await Promise.all([refreshFeatureGates(background)]);
    })();
  }, [background]);

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
