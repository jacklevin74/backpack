import { useEffect, useRef, useState } from "react";
import { Blockchain } from "@coral-xyz/common";
import {
  blockchainConfigAtom,
  blockchainConnectionUrl,
  useBackgroundClient,
} from "@coral-xyz/recoil";
import { useTheme } from "@coral-xyz/tamagui";
import { useRecoilValue } from "recoil";

import { changeNetwork } from "../Unlocked/Settings/Preferences/Blockchains/ConnectionSwitch";

const X1_MAINNET_URL = "https://rpc.mainnet.x1.xyz";
const SOLANA_MAINNET_URL =
  "https://capable-autumn-thunder.solana-mainnet.quiknode.pro/3d4ed46b454fa0ca3df983502fdf15fe87145d9e/";

export function NetworkToggle() {
  const theme = useTheme();
  const background = useBackgroundClient();
  const currentUrl = useRecoilValue(blockchainConnectionUrl(Blockchain.X1));
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine if we're currently on X1 or Solana based on the connection URL
  const isX1Network =
    currentUrl === X1_MAINNET_URL || !currentUrl.includes("solana");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitch = async (toX1: boolean) => {
    if (switching) return;

    setIsOpen(false);
    setSwitching(true);
    try {
      const newUrl = toX1 ? X1_MAINNET_URL : SOLANA_MAINNET_URL;
      await changeNetwork(
        background,
        Blockchain.X1,
        newUrl,
        undefined,
        Blockchain.X1
      );
    } catch (err) {
      console.error("Error switching network:", err);
    } finally {
      setSwitching(false);
    }
  };

  const NetworkIcon = ({ network }: { network: "x1" | "solana" }) => {
    const isX1 = network === "x1";
    const isActive = isX1 ? isX1Network : !isX1Network;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 10px",
          cursor: "pointer",
        }}
        onClick={() => !isActive && handleSwitch(isX1)}
      >
        {isX1 ? (
          // X1 Icon
          <img
            src="./x1.png"
            alt="X1"
            style={{
              width: "20px",
              height: "20px",
            }}
          />
        ) : (
          // Solana Icon
          <img
            src="./solana.png"
            alt="Solana"
            style={{
              width: "20px",
              height: "20px",
            }}
          />
        )}
        {!isActive ? <span
          style={{
              fontSize: "14px",
              color: theme.baseTextMedEmphasis.val,
            }}
          >
          {isX1 ? "X1" : "Solana"}
        </span> : null}
      </div>
    );
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "relative",
        marginLeft: "8px",
      }}
    >
      {/* Active Network Button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: theme.baseBackgroundL1.val,
          borderRadius: "12px",
          border: `solid 1px ${theme.baseBorderMed.val}`,
          padding: "2px",
          cursor: switching ? "not-allowed" : "pointer",
          opacity: switching ? 0.6 : 1,
        }}
        onClick={() => !switching && setIsOpen(!isOpen)}
      >
        <NetworkIcon network={isX1Network ? "x1" : "solana"} />
      </div>

      {/* Dropdown Menu */}
      {isOpen ? <div
        style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            backgroundColor: theme.baseBackgroundL1.val,
            borderRadius: "12px",
            border: `solid 1px ${theme.baseBorderMed.val}`,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            minWidth: "120px",
          }}
        >
        <NetworkIcon network={isX1Network ? "solana" : "x1"} />
      </div> : null}
    </div>
  );
}
