import type { JsonRpcProvider } from "ethers6";
import type { ActivityChecker } from "../../store/KeyringStore/activityDetection";

/**
 * Ethereum/EVM-specific activity checker
 *
 * Checks if an Ethereum address has activity by:
 * 1. Checking if the account has a non-zero ETH balance
 * 2. Checking if the account has any transaction history (nonce > 0)
 */
export class EthereumActivityChecker implements ActivityChecker {
  constructor(private provider: JsonRpcProvider) {}

  async checkActivity(address: string): Promise<{
    hasActivity: boolean;
    balance?: string;
    transactionCount?: number;
  }> {
    try {
      // Check balance (in wei)
      const balance = await this.provider.getBalance(address);

      // Check transaction count (nonce indicates number of transactions sent)
      const txCount = await this.provider.getTransactionCount(address);

      const hasBalance = balance > 0n;
      const hasTransactions = txCount > 0;
      const hasActivity = hasBalance || hasTransactions;

      return {
        hasActivity,
        balance: balance.toString(),
        transactionCount: txCount,
      };
    } catch (error) {
      console.error(`Error checking Ethereum activity for ${address}:`, error);
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
 * Optimized Ethereum activity checker with caching
 *
 * This is more efficient when checking multiple addresses
 */
export class BatchedEthereumActivityChecker implements ActivityChecker {
  private cache: Map<string, {
    hasActivity: boolean;
    balance?: string;
    transactionCount?: number;
  }> = new Map();

  constructor(private provider: JsonRpcProvider) {}

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
      // Batch the RPC calls
      const [balance, txCount] = await Promise.all([
        this.provider.getBalance(address),
        this.provider.getTransactionCount(address),
      ]);

      const hasActivity = balance > 0n || txCount > 0;

      const result = {
        hasActivity,
        balance: balance.toString(),
        transactionCount: txCount,
      };

      // Cache result
      this.cache.set(address, result);

      return result;
    } catch (error) {
      console.error(`Error checking Ethereum activity for ${address}:`, error);
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
