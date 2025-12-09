import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import type { ActivityChecker } from "../../store/KeyringStore/activityDetection";

/**
 * Solana-specific activity checker
 *
 * Checks if a Solana address has activity by:
 * 1. Checking if the account has a non-zero SOL balance
 * 2. Checking if the account has any transaction history
 */
export class SolanaActivityChecker implements ActivityChecker {
  constructor(private connection: Connection) {}

  async checkActivity(address: string): Promise<{
    hasActivity: boolean;
    balance?: string;
    transactionCount?: number;
  }> {
    try {
      const pubkey = new PublicKey(address);

      // Check balance (in lamports)
      const balance = await this.connection.getBalance(pubkey);

      // Check transaction history (limit to 1 to minimize RPC calls)
      const signatures = await this.connection.getSignaturesForAddress(pubkey, {
        limit: 1,
      });

      const hasTransactions = signatures.length > 0;
      const hasBalance = balance > 0;
      const hasActivity = hasBalance || hasTransactions;

      return {
        hasActivity,
        balance: balance.toString(),
        transactionCount: signatures.length,
      };
    } catch (error) {
      console.error(`Error checking Solana activity for ${address}:`, error);
      // In case of error, assume no activity to be safe
      return {
        hasActivity: false,
        balance: "0",
        transactionCount: 0,
      };
    }
  }
}

/**
 * Optimized Solana activity checker that uses batch RPC calls
 *
 * This is more efficient when checking multiple addresses
 */
export class BatchedSolanaActivityChecker implements ActivityChecker {
  private cache: Map<string, {
    hasActivity: boolean;
    balance?: string;
    transactionCount?: number;
  }> = new Map();

  constructor(private connection: Connection) {}

  async checkActivity(address: string): Promise<{
    hasActivity: boolean;
    balance?: string;
    transactionCount?: number;
  }> {
    // Check cache first
    if (this.cache.has(address)) {
      return this.cache.get(address)!;
    }

    try {
      const pubkey = new PublicKey(address);

      // Use getMultipleAccountsInfo for batch efficiency if needed in the future
      const balance = await this.connection.getBalance(pubkey);
      const signatures = await this.connection.getSignaturesForAddress(pubkey, {
        limit: 1,
      });

      const hasActivity = balance > 0 || signatures.length > 0;

      const result = {
        hasActivity,
        balance: balance.toString(),
        transactionCount: signatures.length,
      };

      // Cache result
      this.cache.set(address, result);

      return result;
    } catch (error) {
      console.error(`Error checking Solana activity for ${address}:`, error);
      const result = {
        hasActivity: false,
        balance: "0",
        transactionCount: 0,
      };
      this.cache.set(address, result);
      return result;
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
