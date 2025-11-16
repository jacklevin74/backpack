import { Blockchain } from "@coral-xyz/common";
import { PublicKey } from "@solana/web3.js";

import type { BlockchainConfig } from "../../types/blockchain";

import { X1Cluster } from "./cluster";
import { X1Explorer } from "./explorer";

// Embedded base64 data URI for instant logo loading (no network request)
const X1_LOGO_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAAclBMVEVMaXH+/v4Ahv/8/Pz///8Adv8Arf70+fz///8BvP/+/v79/f3+/v4Agv3q9Pj+/v4Axf8Bof39/f0Afv/+/v79/f39/f0BwP8Buv4BvP0AjP4Ao/0AjP7///8Bxf8Aof8Cq/8Ajv8Al/8CtP8Asv8Cnv8Amv8Aqv////9VL09QAAAAI3RSTlMAAgEDBAUKCAYJDw0OCxQLEhMVGBkaHiAfISMkKSs0OkhPh6fcAAaGAAADYUlEQVRo3u2X25KbMBBENQgJCxhjL3jxhbvNxv//hSnZ3qh6psBVE0plX06KGo92q5mkyfdf5JhZllFzKs1y+a2A8xY+L8Dp9BqAx/M+z+M59vx/tHoMxPz6B/w0AHL7IWD5MWD9IUD/ETBVAGYBEBVAW8Hh9BmgTQFPBGgJeFHAH3HVFHBVgK0BV18cKSsAo7m7QQXg7goVgBYS6iAtAHQhfK8bW9TsqoDN/3j3e/KedsUP6gNW/vhcj1EBsP5wfKnHFAAMx5d6DAAYN8/1SBwAgj8/10MLwMEfn+oBAPj5p+fWBwBhOEaEZ1GUn+rxJQBGiA+d4jvpRkf0jfRQwMwRvqGQ9H6F/A1C0mvqKQCTdIZu0Xvphh4+9D2F2BUAI8SZu6e4OqK7J/wJwEd0tN2ge4oTesAecKzVNKKT8ztB0Y3uALf+tpGYB6IPB+b+gH9FG3PbjB4Y8AC4+8OPH/5gbm7RY9oBTv7obTtfOjvvb5wTeiDk8vVT9UD4RP8mxH/OrzeiR4qvHfgn/ZDJPxN/YKc/m0/9C+YP6z+sH+5fWg/t9z+sf2j/Svv/vdD/0vdv/5/6YdD/qv1z/5/2w/zB/bv5b/qhf+W/8t+8/9D+te//qv3b+Yf1L/TX/Bfvn+r/w/7X+sf+f/D/tf2j///u/9f+5fb/2P+/9s9+AHyq/4/t/3P9dP/D/av+8P3o/w/7f+U/7h/9H/3g/0f/H+7/+fqZ/n/s/w/1//H++f6Z///s/+/27/T/l/uf+f5v9f9X+sH/N/1H/r9RP/wf/f/v/f/R/x/5/9f6F/z/Q/9/tX/A/9P+A/p/+v+w/4D/D/sf8P9F/4D/L/c/8P/l/kf+v9x/2P+X+1/b/0f7N+2f/+79Y/9c/d+qf+j/2/3j/nv/Rv2D/+v+kfoH/wf/N/8f2/9C/1z/AP/P9f/R/iv9w/3L/cP9a/sf/n/s/8P/y/2P+vfQv+f+ffT/sf+f7l/zf3P/pP/u/Un+j/pn//+5f/T/c//o/2f/t/n/Vv/e+r+1/x/7/37/1v3/qH/2/1P///x/mf9r+r+h/3P/z+//rv/D/w/1D/3f0v/T/rf0f1v/5/7f0f/5/+/0/3T/t/Z/a/839b+z/1v7v7n/2/o/+q9tAAQxXBZilwQwAAAAAElFTkSuQmCC";

const bip44CoinType = 501;
export const x1BlockchainConfig: BlockchainConfig<Blockchain.X1> = {
  caip2Id: "solana:TBD_X1_GENESIS_HASH", // caip-2 "namespace:reference"
  caip2Namespace: "solana",
  caip2Reference: "TBD_X1_GENESIS_HASH",

  defaultRpcUrl: X1Cluster.MAINNET,
  blowfishUrl: "http://162.250.126.66:4000/solana/v0/mainnet/scan/transactions",
  isTestnet: false,

  Enabled: true,
  Name: "X1",
  Blockchain: Blockchain.X1,
  GasTokenName: "XNT",
  GasTokenDecimals: 9,
  AppTokenName: "SPL",
  RampSupportedTokens: [],
  DerivationPathPrefix: "m/44'/501'",
  DerivationPathRequireHardening: true,
  DerivationPathOptions: [
    {
      label: "Backpack",
      pattern: "m/44'/501'/x'/0'",
    },
    {
      label: "Backpack Legacy",
      pattern: "m/44'/501'/0'/0'/x'",
    },
    {
      label: "Solana Legacy",
      pattern: "m/44'/501'/x'",
    },
    {
      label: "Ledger Live",
      pattern: "m/44'/501'/x'/0'/0'",
    },
  ],
  PreferencesDefault: {
    explorer: X1Explorer.DEFAULT,
    connectionUrl: X1Cluster.DEFAULT,
    commitment: "processed",
  },
  validatePublicKey: (address: string) => {
    try {
      new PublicKey(address);
    } catch (err) {
      return false;
    }
    return true;
  },
  logoUri: X1_LOGO_DATA_URI,
  localLogoUri: "./x1.png",
  bip44CoinType,
  requiresChainId: false,
  RpcConnectionUrls: {
    MAINNET: {
      name: "X1 Mainnet",
      url: X1Cluster.MAINNET,
    },
    TESTNET: {
      name: "X1 Testnet",
      url: X1Cluster.TESTNET,
    },
    LOCALNET: {
      name: "X1 Localnet",
      url: X1Cluster.LOCALNET,
      description: "Local validator on port 8901",
    },
  },
  ConfirmationCommitments: {
    Processed: {
      commitment: "processed",
    },
    Confirmed: {
      commitment: "confirmed",
    },
    Finalized: {
      commitment: "finalized",
    },
  },
  Explorers: {
    "X1 Mainnet": {
      url: X1Explorer.X1_EXPLORER,
    },
    "X1 Testnet": {
      url: X1Explorer.X1_TESTNET_EXPLORER,
    },
  },
};
