import { Keypair } from '@solana/web3.js';
import { mnemonicToSeedSync, generateMnemonic, validateMnemonic } from 'bip39';
import { encode, decode } from 'bs58';
import { HDNodeWallet, Wallet } from 'ethers6';
import nacl from 'tweetnacl';
import { derivePath } from 'ed25519-hd-key';
import { randomBytes, secretbox } from 'tweetnacl';
//@ts-ignore
import Crypto from 'crypto-browserify';

// Types
export interface WalletAccount {
  publicKey: string;
  blockchain: 'solana' | 'ethereum';
  derivationPath: string;
}

export interface SecretPayload {
  ciphertext: string;
  nonce: string;
  salt: string;
  kdf: string;
  iterations: number;
  digest: string;
}

// Encryption functions
export async function encrypt(
  plaintext: string,
  password: string
): Promise<SecretPayload> {
  const salt = randomBytes(16);
  const kdf = 'pbkdf2';
  const iterations = 100000; // Mobile optimized
  const digest = 'sha256';

  const key = await new Promise<Buffer>((resolve, reject) =>
    Crypto.pbkdf2(
      password,
      salt,
      iterations,
      secretbox.keyLength,
      digest,
      (err: Error, key: Buffer) => (err ? reject(err) : resolve(key))
    )
  );

  const nonce = randomBytes(secretbox.nonceLength);
  const ciphertext = secretbox(Buffer.from(plaintext), nonce, key);

  return {
    ciphertext: encode(ciphertext),
    nonce: encode(nonce),
    kdf,
    salt: encode(salt),
    iterations,
    digest,
  };
}

export async function decrypt(
  cipherObj: SecretPayload,
  password: string
): Promise<string> {
  const {
    ciphertext: encodedCiphertext,
    nonce: encodedNonce,
    salt: encodedSalt,
    iterations,
    digest,
  } = cipherObj;

  const ciphertext = decode(encodedCiphertext);
  const nonce = decode(encodedNonce);
  const salt = decode(encodedSalt);

  const key = await new Promise<Buffer>((resolve, reject) =>
    Crypto.pbkdf2(
      password,
      salt,
      iterations,
      secretbox.keyLength,
      digest,
      (err: Error, key: Buffer) => (err ? reject(err) : resolve(key))
    )
  );

  const plaintext = secretbox.open(ciphertext, nonce, key);
  if (!plaintext) {
    throw new Error('Incorrect password');
  }

  return Buffer.from(plaintext).toString();
}

// Solana functions
export function deriveSolanaKeypair(seed: Buffer, derivationPath: string): Keypair {
  const derivedSeed = derivePath(derivationPath, seed.toString('hex')).key;
  return Keypair.fromSeed(derivedSeed);
}

export function deriveSolanaPrivateKey(seed: Buffer, derivationPath: string): Uint8Array {
  const keypair = deriveSolanaKeypair(seed, derivationPath);
  return keypair.secretKey;
}

export function getSolanaKeypair(secretKey: string): Keypair {
  try {
    // Try bs58 format first
    return Keypair.fromSecretKey(decode(secretKey));
  } catch {
    // Try hex format
    return Keypair.fromSecretKey(Buffer.from(secretKey, 'hex'));
  }
}

export async function signSolanaTransaction(
  tx: Buffer,
  secretKey: string
): Promise<string> {
  const keypair = getSolanaKeypair(secretKey);
  return encode(nacl.sign.detached(new Uint8Array(tx), keypair.secretKey));
}

export async function signSolanaMessage(
  message: Buffer,
  secretKey: string
): Promise<string> {
  const keypair = getSolanaKeypair(secretKey);
  return encode(nacl.sign.detached(new Uint8Array(message), keypair.secretKey));
}

// Ethereum functions
export function deriveEthereumWallet(seed: Buffer, derivationPath: string): HDNodeWallet {
  const hdNode = HDNodeWallet.fromSeed(seed);
  return hdNode.derivePath(derivationPath);
}

export function deriveEthereumPrivateKey(seed: Buffer, derivationPath: string): string {
  const wallet = deriveEthereumWallet(seed, derivationPath);
  return wallet.privateKey;
}

export function getEthereumWallet(secretKey: string): Wallet {
  return new Wallet(secretKey);
}

export async function signEthereumTransaction(
  serializedTx: string,
  secretKey: string
): Promise<string> {
  const wallet = new Wallet(secretKey);
  return await wallet.signTransaction(JSON.parse(serializedTx));
}

export async function signEthereumMessage(
  message: string,
  secretKey: string
): Promise<string> {
  const wallet = new Wallet(secretKey);
  return await wallet.signMessage(message);
}

// Wallet management
export class WalletCore {
  private mnemonic: string | null = null;
  private seed: Buffer | null = null;
  private accounts: WalletAccount[] = [];

  // Generate new wallet
  generateWallet(): string {
    this.mnemonic = generateMnemonic(128); // 12 words
    this.seed = mnemonicToSeedSync(this.mnemonic);

    // Generate default accounts
    this.accounts = [
      {
        publicKey: this.deriveSolanaAccount("m/44'/501'/0'/0'").publicKey.toString(),
        blockchain: 'solana',
        derivationPath: "m/44'/501'/0'/0'",
      },
      {
        publicKey: this.deriveEthereumAccount("m/44'/60'/0'/0/0").address,
        blockchain: 'ethereum',
        derivationPath: "m/44'/60'/0'/0/0",
      },
    ];

    return this.mnemonic;
  }

  // Import wallet from mnemonic
  importWallet(mnemonic: string): void {
    if (!validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }

    this.mnemonic = mnemonic;
    this.seed = mnemonicToSeedSync(mnemonic);

    // Restore default accounts
    this.accounts = [
      {
        publicKey: this.deriveSolanaAccount("m/44'/501'/0'/0'").publicKey.toString(),
        blockchain: 'solana',
        derivationPath: "m/44'/501'/0'/0'",
      },
      {
        publicKey: this.deriveEthereumAccount("m/44'/60'/0'/0/0").address,
        blockchain: 'ethereum',
        derivationPath: "m/44'/60'/0'/0/0",
      },
    ];
  }

  // Get mnemonic (must be unlocked)
  getMnemonic(): string {
    if (!this.mnemonic) {
      throw new Error('Wallet not initialized');
    }
    return this.mnemonic;
  }

  // Get accounts
  getAccounts(): WalletAccount[] {
    return this.accounts;
  }

  // Derive Solana account
  private deriveSolanaAccount(path: string): Keypair {
    if (!this.seed) {
      throw new Error('Wallet not initialized');
    }
    return deriveSolanaKeypair(this.seed, path);
  }

  // Derive Ethereum account
  private deriveEthereumAccount(path: string): HDNodeWallet {
    if (!this.seed) {
      throw new Error('Wallet not initialized');
    }
    return deriveEthereumWallet(this.seed, path);
  }

  // Get private key for account
  getPrivateKey(publicKey: string): string {
    const account = this.accounts.find(a => a.publicKey === publicKey);
    if (!account || !this.seed) {
      throw new Error('Account not found or wallet not initialized');
    }

    if (account.blockchain === 'solana') {
      const keypair = deriveSolanaKeypair(this.seed, account.derivationPath);
      return encode(keypair.secretKey);
    } else {
      const wallet = deriveEthereumWallet(this.seed, account.derivationPath);
      return wallet.privateKey;
    }
  }

  // Add new account
  addAccount(blockchain: 'solana' | 'ethereum'): WalletAccount {
    if (!this.seed) {
      throw new Error('Wallet not initialized');
    }

    const accountIndex = this.accounts.filter(a => a.blockchain === blockchain).length;

    if (blockchain === 'solana') {
      const path = `m/44'/501'/${accountIndex}'/0'`;
      const keypair = deriveSolanaKeypair(this.seed, path);
      const account: WalletAccount = {
        publicKey: keypair.publicKey.toString(),
        blockchain: 'solana',
        derivationPath: path,
      };
      this.accounts.push(account);
      return account;
    } else {
      const path = `m/44'/60'/0'/0/${accountIndex}`;
      const wallet = deriveEthereumWallet(this.seed, path);
      const account: WalletAccount = {
        publicKey: wallet.address,
        blockchain: 'ethereum',
        derivationPath: path,
      };
      this.accounts.push(account);
      return account;
    }
  }

  // Clear wallet (logout)
  clear(): void {
    this.mnemonic = null;
    this.seed = null;
    this.accounts = [];
  }
}
