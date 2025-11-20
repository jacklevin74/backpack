const startTime = Date.now();
console.log(`[PERF] Popup script start: ${startTime}ms`);

// Store start time globally for other components to access
(window as any).__APP_START_TIME__ = startTime;

// Log DOM ready state
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log(`[PERF] DOMContentLoaded: ${Date.now() - startTime}ms`);
  });
} else {
  console.log(`[PERF] DOM already ready: ${Date.now() - startTime}ms`);
}

// Suppress React Native BackHandler warning in web environment
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("BackHandler is not supported on web")
  ) {
    return; // Suppress this specific warning
  }
  originalConsoleWarn.apply(console, args);
};

import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BACKPACK_FEATURE_POP_MODE, openPopupWindow } from "@coral-xyz/common";
import {
  notificationListenerAtom,
  secureBackgroundSenderAtom,
} from "@coral-xyz/recoil";
import {
  FromExtensionTransportSender,
  NotificationExtensionBroadcastListener,
  ToSecureUITransportReceiver,
} from "@coral-xyz/secure-clients";
import type { SECURE_EVENTS } from "@coral-xyz/secure-clients/types";
import SecureUI, { RequireUserUnlocked } from "@coral-xyz/secure-ui";
import { config as tamaguiConfig, TamaguiProvider } from "@coral-xyz/tamagui";
import { RecoilRoot } from "recoil";
import { v4 } from "uuid";

import { PopupLoadingSkeleton } from "./components/common/LoadingSkeleton";
import { OptClickToComponent } from "./utils/click-to-component";

import "./index.css";

const App = lazy(() => import("./app/App"));
// const LedgerIframe = lazy(() => import("./components/LedgerIframe"));

const urlParams = new URLSearchParams(window.location.search);
const requestWindowId = urlParams.get("windowId");
// if popup was passed windowId it was opened by secure-background
// and should not render app since secure-ui will handle the request.
const shouldRenderApp = !requestWindowId;
const windowId = requestWindowId ?? v4();

const extensionTransportSender =
  new FromExtensionTransportSender<SECURE_EVENTS>({
    origin: {
      name: "X1 Wallet Extension",
      address: "https://backpack.app",
      context: "extension",
    },
  });

const secureUITransportReceiver = new ToSecureUITransportReceiver<
  SECURE_EVENTS,
  "ui"
>(windowId);

const secureUITransportSender = new FromExtensionTransportSender<SECURE_EVENTS>(
  {
    origin: {
      name: "X1 Wallet Extension",
      address: "https://backpack.app",
      context: "secureUI",
    },
  }
);

const notificationBroadcastListener =
  new NotificationExtensionBroadcastListener();

console.log(
  `[PERF] Imports and initialization complete: ${Date.now() - startTime}ms`
);

//
// Configure event listeners.
//
document.addEventListener("keydown", async function onKeyDown(event) {
  // Ctrl+Cmd+G opens wallet in a new tab in development mode.
  if (
    process.env.NODE_ENV === "development" &&
    event.key === "g" &&
    event.ctrlKey &&
    event.metaKey
  ) {
    event.preventDefault();
    window.open(window.location.href);
  }
  //
  // Pop open the window with Ctrl+G when pop mode is enabled.
  //
  else if (BACKPACK_FEATURE_POP_MODE) {
    if (event.key === "g" && event.ctrlKey) {
      event.preventDefault();
      const popupWindow = await openPopupWindow("popup.html");
      const currentWindow = await globalThis.chrome?.windows.getCurrent();
      if (currentWindow.id !== popupWindow.id) {
        window.close();
      }
    }
  }
});

// Render the UI.
// TOOD(react) createRoot is required: https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html#updates-to-client-rendering-apis
const container = document.getElementById("root");
if (container) {
  console.log(`[PERF] Root container found: ${Date.now() - startTime}ms`);
} else {
  console.error(`[PERF] Root container NOT found: ${Date.now() - startTime}ms`);
}
const root = createRoot(container!);
console.log(`[PERF] React root created: ${Date.now() - startTime}ms`);
console.log(`[PERF] Starting React render: ${Date.now() - startTime}ms`);
root.render(
  <>
    <OptClickToComponent />
    {shouldRenderApp ? (
      <RecoilRoot
        initializeState={({ set }) => {
          set(secureBackgroundSenderAtom, extensionTransportSender);
          set(notificationListenerAtom, notificationBroadcastListener);
        }}
      >
        <Suspense
          fallback={
            <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
              <PopupLoadingSkeleton />
            </TamaguiProvider>
          }
        >
          <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
            <RequireUserUnlocked
              onReset={() => {
                window.close();
              }}
              onSuccess={() => {
                console.log(
                  `[PERF] User unlocked, ready to show app: ${Date.now() - startTime}ms`
                );
              }}
            >
              <App />
            </RequireUserUnlocked>
          </TamaguiProvider>
        </Suspense>
      </RecoilRoot>
    ) : null}
    <SecureUI
      timing={startTime}
      secureBackgroundSender={secureUITransportSender}
      secureUIReceiver={secureUITransportReceiver}
      notificationListener={notificationBroadcastListener}
    />
  </>
);
