import { Blockchain } from "@coral-xyz/common";
import type {
  SecureUserType,
  TransportSender,
} from "@coral-xyz/secure-background/types";
import { Connection } from "@solana/web3.js";

import { getBlockchainConfig } from "..";

import { EthereumClient } from "./EthereumClient/EthereumClient";
import { SolanaClient } from "./SolanaClient/SolanaClient";
import type { BlockchainClient } from "./BlockchainClientBase";

// Goal: This should be the ONLY blockchain-switch statement in the whole application.
export function createBlockchainClient<B extends Blockchain>(
  blockchain: B, // select blockchain
  transportSender: TransportSender, // get from secureBackgroundTransportAtom
  user?: SecureUserType & {
    publicKeys: NonNullable<SecureUserType["publicKeys"]>;
  } // get from secureUserAtom
): BlockchainClient<B> {
  switch (blockchain) {
    case Blockchain.SOLANA: {
      const preferences = getBlockchainConfig(blockchain);
      const connectionUrl =
        user?.preferences.blockchains.solana.connectionUrl ??
        preferences.PreferencesDefault.connectionUrl;
      const commitment =
        user?.preferences.blockchains.solana.commitment ??
        preferences.PreferencesDefault.commitment;
      const client: BlockchainClient<Blockchain.SOLANA> = new SolanaClient(
        transportSender,
        connectionUrl,
        commitment,
        Blockchain.SOLANA
      );
      // this cast is safe due to switch statement;
      return client as BlockchainClient<B>;
    }
    case Blockchain.ETHEREUM: {
      const client: BlockchainClient<Blockchain.ETHEREUM> = new EthereumClient(
        transportSender
      );

      // this cast is safe due to switch statement;
      return client as BlockchainClient<B>;
    }

    case Blockchain.X1: {
      // X1 is SVM-compatible, so we use SolanaClient with X1 RPC
      // Read connection URL from user preferences
      const preferences = getBlockchainConfig(blockchain);
      const connectionUrl =
        user?.preferences.blockchains.x1.connectionUrl ??
        preferences.PreferencesDefault.connectionUrl;
      const commitment =
        user?.preferences.blockchains.x1.commitment ??
        preferences.PreferencesDefault.commitment;
      console.log(
        `[createBlockchainClient] ext:0.10.62 X1 client with URL: ${connectionUrl}, commitment: ${commitment}`
      );
      const client: BlockchainClient<Blockchain.X1> = new SolanaClient(
        transportSender,
        connectionUrl,
        commitment,
        Blockchain.X1
      );
      // this cast is safe due to switch statement;
      return client as BlockchainClient<B>;
    }

    default: {
      throw new Error(
        `Failed to create BlockchainClient. Unknown blockchain: ${blockchain}`
      );
    }
  }
}
