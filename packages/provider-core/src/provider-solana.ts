import type { Provider } from "@coral-xyz/anchor";
import type { Event } from "@coral-xyz/common";
import {
  Blockchain,
  CHANNEL_PLUGIN_NOTIFICATION,
  CHANNEL_SOLANA_NOTIFICATION,
  CHANNEL_SOLANA_RPC_REQUEST,
  CHANNEL_SOLANA_RPC_RESPONSE,
  getLogger,
  InjectedRequestManager,
  NOTIFICATION_ACTIVE_WALLET_UPDATED,
  NOTIFICATION_CONNECTION_URL_UPDATED,
  NOTIFICATION_SOLANA_CONNECTED,
  NOTIFICATION_SOLANA_DISCONNECTED,
  PLUGIN_NOTIFICATION_CONNECT,
  PLUGIN_NOTIFICATION_CONNECTION_URL_UPDATED,
  PLUGIN_NOTIFICATION_MOUNT,
  PLUGIN_NOTIFICATION_PUBLIC_KEY_UPDATED,
  PLUGIN_NOTIFICATION_UNMOUNT,
  PLUGIN_NOTIFICATION_UPDATE_METADATA,
} from "@coral-xyz/common";
import {
  DEFAULT_SOLANA_CLUSTER,
  DEFAULT_X1_CLUSTER,
} from "@coral-xyz/secure-background/legacyCommon";
import {
  NotificationContentScriptBroadcastListener,
  safeClientResponse,
  SolanaClient,
} from "@coral-xyz/secure-clients";
import type {
  SECURE_SVM_EVENTS,
  SecureNotification,
  TransportSender,
} from "@coral-xyz/secure-clients/types";
import { BackpackWalletAccount } from "@coral-xyz/wallet-standard";
import type { Backpack } from "@coral-xyz/wallet-standard/src/window";
import type {
  SolanaSignInInput,
  SolanaSignInOutput,
} from "@solana/wallet-standard-features";
import { createSignInMessage } from "@solana/wallet-standard-util";
import type {
  Commitment,
  ConfirmOptions,
  Connection,
  SendOptions,
  Signer,
  SimulatedTransactionResponse,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { decode } from "bs58";

import { PrivateEventEmitter } from "./common/PrivateEventEmitter";
import type { ChainedRequestManager } from ".";
import { isValidEventOrigin } from ".";

const logger = getLogger("provider-solana-injection");

const defaultRpcUrl =
  process.env.DEFAULT_SOLANA_CONNECTION_URL || DEFAULT_SOLANA_CLUSTER;

export class ProviderSolanaInjection
  extends PrivateEventEmitter
  implements Backpack
{
  //
  // Channel to send extension specific RPC requests to the extension.
  //
  #backpackRequestManager: InjectedRequestManager;

  #requestManager: InjectedRequestManager | ChainedRequestManager;

  #isBackpack: boolean;
  #isConnected: boolean;
  #isPlugin: boolean;
  #publicKey?: PublicKey;

  #secureSolanaClient: SolanaClient;
  #secureClientSender: TransportSender<SECURE_SVM_EVENTS>;
  #notificationsReceiver: NotificationContentScriptBroadcastListener;
  #blockchain: Blockchain;

  constructor(
    secureClientSender: TransportSender<SECURE_SVM_EVENTS>,
    blockchain: Blockchain = Blockchain.X1
  ) {
    super();
    if (new.target === ProviderSolanaInjection) {
      Object.freeze(this);
    }
    this.#blockchain = blockchain;
    // this.#options = undefined;
    this.#backpackRequestManager = new InjectedRequestManager(
      CHANNEL_SOLANA_RPC_REQUEST,
      CHANNEL_SOLANA_RPC_RESPONSE
    );

    this.#requestManager = this.#backpackRequestManager;

    this.#isBackpack = true;
    this.#isConnected = false;
    this.#publicKey = undefined;
    this.#secureClientSender = secureClientSender;
    this.#notificationsReceiver =
      new NotificationContentScriptBroadcastListener();

    // Use appropriate default RPC URL based on blockchain
    // This will be updated to the user's selected URL when connect() is called
    const rpcUrl =
      blockchain === Blockchain.X1 ? DEFAULT_X1_CLUSTER : defaultRpcUrl;
    console.log(
      `[ProviderSolanaInjection.constructor] ext:0.10.62 Creating SolanaClient for ${blockchain} with initial RPC URL: ${rpcUrl}`
    );

    this.#secureSolanaClient = new SolanaClient(
      this.#secureClientSender,
      rpcUrl,
      undefined,
      blockchain
    );

    this.#notificationsReceiver.addListener(
      this.#handleSecureBackgroundNotifications.bind(this)
    );
    window.addEventListener(
      "message",
      this.#handleLegacyNotifications.bind(this)
    );
  }

  async #handleSecureBackgroundNotifications(notification: SecureNotification) {
    const oldPublicKey = this.#publicKey?.toBase58();
    try {
      await this.connect({
        onlyIfTrusted: true,
        reconnect: true,
        blockchain: this.#blockchain,
      });
      const newPublicKey = this.#publicKey?.toBase58();
      if (oldPublicKey !== newPublicKey) {
        this.emit("accountChanged", { publicKey: newPublicKey });
      }
    } catch {
      await this.disconnect();
    }
  }

  #handleLegacyNotifications(event: Event) {
    if (!isValidEventOrigin(event)) return;
    if (
      event.data.type !== CHANNEL_SOLANA_NOTIFICATION &&
      event.data.type !== CHANNEL_PLUGIN_NOTIFICATION
    )
      return;
    logger.debug("notification", event);

    switch (event.data.detail.name) {
      // BROWSER EVENTS
      case NOTIFICATION_SOLANA_CONNECTED:
        this.#handleNotificationConnected(event);
        break;
      case NOTIFICATION_SOLANA_DISCONNECTED:
        this.#handleNotificationDisconnected(event);
        break;
      case NOTIFICATION_CONNECTION_URL_UPDATED:
        this.#handleNotificationConnectionUrlUpdated(event);
        break;
      case NOTIFICATION_ACTIVE_WALLET_UPDATED:
        this.#handleNotificationActiveWalletUpdated(event);
        break;

      // PLUGIN EVENTS
      case PLUGIN_NOTIFICATION_CONNECT:
        this.#handlePluginConnect(event);
        break;
      case PLUGIN_NOTIFICATION_MOUNT:
        this.#handlePluginMount(event);
        break;
      case PLUGIN_NOTIFICATION_UPDATE_METADATA:
        this.#handlePluginUpdateMetadata(event);
        break;
      case PLUGIN_NOTIFICATION_UNMOUNT:
        this.#handlePluginUnmount(event);
        break;
      case PLUGIN_NOTIFICATION_CONNECTION_URL_UPDATED:
        this.#handlePluginConnectionUrlUpdated(event);
        break;
      case PLUGIN_NOTIFICATION_PUBLIC_KEY_UPDATED:
        this.#handlePluginPublicKeyUpdated(event);
        break;

      default:
        throw new Error(`unexpected notification ${event.data.detail.name}`);
    }
  }

  #handlePluginConnect(event: Event) {
    const { publicKeys, connectionUrls } = event.data.detail.data;
    const publicKey = publicKeys[Blockchain.SOLANA];
    const connectionUrl = connectionUrls[Blockchain.SOLANA];

    this.#isPlugin = true;
    this.#connect(publicKey, connectionUrl);
    this.emit("connect", event.data.detail);
  }

  #handlePluginMount(event: Event) {
    this.emit("mount", event.data.detail);
  }

  #handlePluginUpdateMetadata(event: Event) {
    this.emit("metadata", event.data.detail);
  }

  #handlePluginUnmount(event: Event) {
    this.emit("unmount", event.data.detail);
  }

  #handlePluginConnectionUrlUpdated(event: Event) {
    if (event.data.detail.data.blockchain !== this.#blockchain) {
      return;
    }
    const connectionUrl = event.data.detail.data.url;
    console.log(
      `[ProviderSolanaInjection.#handlePluginConnectionUrlUpdated] v0.10.57 Updating ${this.#blockchain} connection to: ${connectionUrl}`
    );
    this.#secureSolanaClient = new SolanaClient(
      this.#secureClientSender,
      connectionUrl,
      undefined,
      this.#blockchain
    );
    this.emit("accountChanged", event.data.detail);
  }

  #handlePluginPublicKeyUpdated(event: Event) {
    const { publicKey, blockchain } = event.data.detail.data;
    if (blockchain !== this.#blockchain) {
      return;
    }
    this.#publicKey = new PublicKey(publicKey);
    this.emit("publicKeyUpdate", event.data.detail);
  }

  #handleNotificationConnected(event: Event) {
    this.emit("connect", event.data.detail);
  }

  #connect(publicKey: string, connectionUrl: string) {
    this.#isConnected = true;
    this.#publicKey = new PublicKey(publicKey);
    this.#secureSolanaClient = new SolanaClient(
      this.#secureClientSender,
      connectionUrl,
      undefined,
      this.#blockchain
    );
    this.emit("connect", { publicKey });
    // this.emit("accountChanged", { publicKey });
  }

  #handleNotificationDisconnected(event: Event) {
    this.#isConnected = false;
    this.#secureSolanaClient = new SolanaClient(
      this.#secureClientSender,
      defaultRpcUrl,
      undefined,
      this.#blockchain
    );
    this.#publicKey = undefined;
    this.emit("disconnect", event.data.detail);
  }

  #handleNotificationConnectionUrlUpdated(event: Event) {
    if (event.data.detail.data.blockchain !== this.#blockchain) {
      return;
    }
    this.#secureSolanaClient = new SolanaClient(
      this.#secureClientSender,
      event.data.detail.data.url,
      undefined,
      this.#blockchain
    );
    this.emit("accountChanged", event.data.detail);
  }

  #handleNotificationActiveWalletUpdated(event: Event) {
    if (event.data.detail.data.blockchain !== this.#blockchain) {
      return;
    }
    this.#publicKey = new PublicKey(event.data.detail.data.activeWallet);
    this.emit("activeWalletDidChange", event.data.detail);
  }

  async connect(options?: {
    onlyIfTrusted?: boolean;
    reconnect?: boolean;
    blockchain?: Blockchain;
  }) {
    console.log(
      "[ProviderSolanaInjection.connect] ext:0.10.58 Called with options:",
      options
    );
    if (this.#publicKey && !options?.reconnect) {
      return { publicKey: this.#publicKey };
    }
    // Use the blockchain from options, or fallback to the instance's blockchain
    const blockchainToUse = options?.blockchain || this.#blockchain;
    console.log(
      "[ProviderSolanaInjection.connect] ext:0.10.58 Using blockchain:",
      blockchainToUse
    );
    const result = await this.#secureSolanaClient.wallet.connect({
      blockchain: blockchainToUse,
      silent: options?.onlyIfTrusted,
    });
    this.#connect(result.publicKey, result.connectionUrl);
    console.log(
      `[ProviderSolanaInjection.connect] ext:0.10.58 Connected to ${blockchainToUse} network: ${result.connectionUrl}`
    );
    return { publicKey: new PublicKey(result.publicKey) };
  }

  async disconnect() {
    if (this.#isPlugin) {
      console.warn("plugin can't be disconnected");
      return;
    }
    const detail = await this.#secureSolanaClient.wallet.disconnect();
    this.#handleNotificationDisconnected({ data: { detail } });
  }

  async _backpackGetAccounts() {
    return safeClientResponse(this.#secureSolanaClient.backpackGetAccounts());
  }

  async signIn(input?: SolanaSignInInput): Promise<SolanaSignInOutput> {
    const response = await this.#secureSolanaClient.wallet.signIn(input ?? {});
    this.#connect(response.publicKey, response.connectionUrl);

    return {
      account: new BackpackWalletAccount({
        address: response.publicKey,
        publicKey: new PublicKey(response.publicKey).toBuffer(),
      }),
      signedMessage: decode(response.signedMessage),
      signature: decode(response.signature),
    };
  }

  async sendAndConfirm<T extends Transaction | VersionedTransaction>(
    tx: T,
    signers?: Signer[],
    options?: ConfirmOptions,
    connection?: Connection,
    publicKey?: PublicKey,
    uuid?: string
  ): Promise<{ signature: TransactionSignature }> {
    if (!this.#publicKey) {
      console.log(
        "[ProviderSolanaInjection.sendAndConfirm] ext:0.10.58 Auto-connecting with blockchain:",
        this.#blockchain
      );
      await this.connect({ blockchain: this.#blockchain });
    }
    if (!this.#publicKey) {
      throw new Error("wallet not connected");
    }
    console.log(
      `[ProviderSolanaInjection.sendAndConfirm] ext:0.10.58 Sending transaction on ${this.#blockchain} network`
    );
    const solanaResponse = await this.#secureSolanaClient.wallet.sendAndConfirm(
      {
        publicKey: publicKey ?? this.#publicKey,
        tx,
        signers,
        options,
        customConnection: connection,
        uuid,
      }
    );
    console.log(
      `[ProviderSolanaInjection.sendAndConfirm] ext:0.10.58 Transaction sent: ${solanaResponse}`
    );
    return { signature: solanaResponse };
  }

  async signAndSendTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
    options?: SendOptions
  ): Promise<{ signature: TransactionSignature }> {
    return this.sendAndConfirm(transaction, [], options);
  }

  async send<T extends Transaction | VersionedTransaction>(
    tx: T,
    signers?: Signer[],
    options?: SendOptions,
    connection?: Connection,
    publicKey?: PublicKey
  ): Promise<TransactionSignature> {
    if (!this.#publicKey) {
      console.log(
        "[ProviderSolanaInjection.send] ext:0.10.58 Auto-connecting with blockchain:",
        this.#blockchain
      );
      await this.connect({ blockchain: this.#blockchain });
    }
    if (!this.#publicKey) {
      throw new Error("wallet not connected");
    }

    const solanaResponse = await this.#secureSolanaClient.wallet.send({
      publicKey: publicKey ?? this.#publicKey,
      tx,
      signers,
      options,
      customConnection: connection,
    });
    return solanaResponse;
  }

  // @ts-ignore
  async sendAll<T extends Transaction | VersionedTransaction>(
    _txWithSigners: { tx: T; signers?: Signer[] }[],
    _opts?: ConfirmOptions,
    _connection?: Connection,
    _publicKey?: PublicKey
  ): Promise<Array<TransactionSignature>> {
    throw new Error("sendAll not implemented");
  }

  // @ts-ignore
  async simulate<T extends Transaction | VersionedTransaction>(
    tx: T,
    signers?: Signer[],
    commitment?: Commitment,
    connection?: Connection,
    publicKey?: PublicKey
  ): Promise<SimulatedTransactionResponse> {
    if (!this.#publicKey) {
      console.log(
        "[ProviderSolanaInjection.simulate] ext:0.10.58 Auto-connecting with blockchain:",
        this.#blockchain
      );
      await this.connect({ blockchain: this.#blockchain });
    }
    if (!this.#publicKey) {
      throw new Error("wallet not connected");
    }

    const solanaResponse = await this.#secureSolanaClient.wallet.simulate({
      publicKey: publicKey ?? this.#publicKey,
      tx,
      signers,
      customConnection: connection,
      options: {
        commitment,
      },
    });
    return solanaResponse;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
    publicKey?: PublicKey,
    connection?: Connection,
    uuid?: string // Backpack account local uuid.
  ): Promise<T> {
    if (!this.#publicKey) {
      console.log(
        "[ProviderSolanaInjection.signTransaction] ext:0.10.58 Auto-connecting with blockchain:",
        this.#blockchain
      );
      await this.connect({ blockchain: this.#blockchain });
    }
    if (!this.#publicKey) {
      throw new Error("wallet not connected");
    }
    const solanaResponse =
      await this.#secureSolanaClient.wallet.signTransaction({
        publicKey: publicKey ?? this.#publicKey,
        tx,
        customConnection: connection,
        uuid,
      });
    console.warn(solanaResponse);
    return solanaResponse;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: Array<T>,
    publicKey?: PublicKey,
    connection?: Connection,
    uuid?: string
  ): Promise<Array<T>> {
    if (!this.#publicKey) {
      console.log(
        "[ProviderSolanaInjection.signAllTransactions] ext:0.10.58 Auto-connecting with blockchain:",
        this.#blockchain
      );
      await this.connect({ blockchain: this.#blockchain });
    }
    if (!this.#publicKey) {
      throw new Error("wallet not connected");
    }
    const solanaResponse =
      await this.#secureSolanaClient.wallet.signAllTransactions({
        publicKey: publicKey ?? this.#publicKey,
        txs,
        customConnection: connection,
        uuid,
      });
    return solanaResponse;
  }

  public async prepareSolanaOffchainMessage(
    message: Uint8Array,
    encoding: "ASCII" | "UTF-8" = "UTF-8",
    maxLength: 1212 | 65515 = 1212
  ): Promise<Uint8Array> {
    return this.#secureSolanaClient.wallet.prepareSolanaOffchainMessage({
      message,
      encoding,
      maxLength,
    });
  }

  async signMessage(
    msg: Uint8Array,
    publicKey?: PublicKey,
    uuid?: string
  ): Promise<{ signature: Uint8Array }> {
    if (!this.#publicKey) {
      console.log(
        "[ProviderSolanaInjection.signMessage] ext:0.10.58 Auto-connecting with blockchain:",
        this.#blockchain
      );
      await this.connect({ blockchain: this.#blockchain });
    }
    if (!this.#publicKey) {
      throw new Error("wallet not connected");
    }
    const solanaResponse = await this.#secureSolanaClient.wallet.signMessage({
      publicKey: publicKey ?? this.#publicKey,
      message: msg,
      uuid,
    });
    return { signature: solanaResponse };
  }

  public get isBackpack() {
    return this.#isBackpack;
  }

  public get isConnected() {
    return this.#isConnected;
  }

  public get isPlugin() {
    return this.#isPlugin;
  }

  public get publicKey() {
    return this.#publicKey ?? null;
  }

  public get connection() {
    return this.#secureSolanaClient.connection;
  }
}
