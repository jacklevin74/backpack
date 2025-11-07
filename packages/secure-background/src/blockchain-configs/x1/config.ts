import { Blockchain } from "@coral-xyz/common";
import { PublicKey } from "@solana/web3.js";

import type { BlockchainConfig } from "../../types/blockchain";

import { X1Cluster } from "./cluster";
import { X1Explorer } from "./explorer";

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
  logoUri:
    "https://x1.xyz/_next/image?url=%2Fx1-logo.png&w=96&q=75&dpl=dpl_CgqrxgM4ijNMynKBvmQG3HnYr6yY",
  localLogoUri: "./x1.png",
  bip44CoinType,
  requiresChainId: false,
  RpcConnectionUrls: {
    MAINNET: {
      name: "Mainnet",
      url: X1Cluster.MAINNET,
    },
    TESTNET: {
      name: "Testnet",
      url: X1Cluster.TESTNET,
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
