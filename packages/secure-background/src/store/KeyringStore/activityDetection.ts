import type { Blockchain } from "@coral-xyz/common";
import { GAP_LIMIT, MAX_DISCOVERY_ADDRESSES } from "@coral-xyz/common";
import type { HdKeyring } from "../../keyring/types";

/**
 * Interface for checking address activity on blockchain
 */
export interface ActivityChecker {
  checkActivity(address: string): Promise<{
    hasActivity: boolean;
    balance?: string;
    transactionCount?: number;
  }>;
}

/**
 * Information about a discovered address
 */
export interface AddressActivity {
  address: string;
  derivationPath: string;
  index: number;
  hasActivity: boolean;
  balance?: string;
  transactionCount?: number;
}

/**
 * Result of the discovery process
 */
export interface DiscoveryResult {
  activeWallets: AddressActivity[];
  totalChecked: number;
  consecutiveEmpty: number;
}

/**
 * Discovers all wallets with activity using the BIP-44 gap limit algorithm.
 *
 * This algorithm checks sequential derivation paths starting from index 0,
 * and stops when it finds GAP_LIMIT consecutive addresses with no activity.
 * This ensures all used wallets are discovered while avoiding unnecessary checks.
 *
 * @param keyring HD keyring to derive addresses from
 * @param activityChecker Blockchain-specific activity checker
 * @param derivationPathGenerator Function to generate derivation path for an index
 * @param onProgress Optional callback for progress updates
 * @returns Discovery result with all active wallets found
 */
export async function discoverActiveWallets(
  keyring: HdKeyring,
  activityChecker: ActivityChecker,
  derivationPathGenerator: (index: number) => string,
  onProgress?: (checkedCount: number, foundCount: number) => void
): Promise<DiscoveryResult> {
  const activeWallets: AddressActivity[] = [];
  let consecutiveEmpty = 0;
  let index = 0;

  while (consecutiveEmpty < GAP_LIMIT && index < MAX_DISCOVERY_ADDRESSES) {
    try {
      // Generate derivation path for this index
      const derivationPath = derivationPathGenerator(index);

      // Derive address from the keyring
      // We create a temporary keyring with just this one path to get the address
      const tempKeyring = keyring.constructor.prototype.constructor.call(
        Object.create(keyring.constructor.prototype),
        {
          mnemonic: keyring.mnemonic,
          seed: (keyring as any).seed,
          derivationPaths: [derivationPath],
        }
      );
      const addresses = tempKeyring.publicKeys();
      const address = addresses[0];

      // Check for activity
      const activity = await activityChecker.checkActivity(address);

      if (activity.hasActivity) {
        activeWallets.push({
          address,
          derivationPath,
          index,
          hasActivity: true,
          balance: activity.balance,
          transactionCount: activity.transactionCount,
        });
        consecutiveEmpty = 0; // Reset gap counter
      } else {
        consecutiveEmpty++;
      }

      index++;

      // Report progress
      if (onProgress) {
        onProgress(index, activeWallets.length);
      }
    } catch (error) {
      console.error(`Error checking address at index ${index}:`, error);
      consecutiveEmpty++;
      index++;
    }
  }

  return {
    activeWallets,
    totalChecked: index,
    consecutiveEmpty,
  };
}

/**
 * Batch check multiple addresses for activity in parallel
 *
 * @param addresses Array of addresses to check
 * @param activityChecker Activity checker to use
 * @param batchSize Number of concurrent checks (default: 10)
 * @returns Array of activity results
 */
export async function batchCheckActivity(
  addresses: Array<{ address: string; derivationPath: string; index: number }>,
  activityChecker: ActivityChecker,
  batchSize: number = 10
): Promise<AddressActivity[]> {
  const results: AddressActivity[] = [];

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ({ address, derivationPath, index }) => {
        try {
          const activity = await activityChecker.checkActivity(address);
          return {
            address,
            derivationPath,
            index,
            ...activity,
          };
        } catch (error) {
          console.error(`Error checking address ${address}:`, error);
          return {
            address,
            derivationPath,
            index,
            hasActivity: false,
          };
        }
      })
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Optimized discovery using batched parallel checking
 *
 * @param keyring HD keyring to derive addresses from
 * @param activityChecker Blockchain-specific activity checker
 * @param derivationPathGenerator Function to generate derivation path for an index
 * @param batchSize Number of addresses to check in parallel
 * @param onProgress Optional callback for progress updates
 * @returns Discovery result with all active wallets found
 */
export async function discoverActiveWalletsBatched(
  keyring: HdKeyring,
  activityChecker: ActivityChecker,
  derivationPathGenerator: (index: number) => string,
  batchSize: number = 10,
  onProgress?: (checkedCount: number, foundCount: number) => void
): Promise<DiscoveryResult> {
  const activeWallets: AddressActivity[] = [];
  let consecutiveEmpty = 0;
  let index = 0;

  while (consecutiveEmpty < GAP_LIMIT && index < MAX_DISCOVERY_ADDRESSES) {
    // Prepare batch of addresses to check
    const batch: Array<{ address: string; derivationPath: string; index: number }> = [];

    for (let i = 0; i < batchSize && (index + i) < MAX_DISCOVERY_ADDRESSES; i++) {
      const currentIndex = index + i;
      const derivationPath = derivationPathGenerator(currentIndex);

      // Derive address
      const tempKeyring = keyring.constructor.prototype.constructor.call(
        Object.create(keyring.constructor.prototype),
        {
          mnemonic: keyring.mnemonic,
          seed: (keyring as any).seed,
          derivationPaths: [derivationPath],
        }
      );
      const addresses = tempKeyring.publicKeys();

      batch.push({
        address: addresses[0],
        derivationPath,
        index: currentIndex,
      });
    }

    // Check batch for activity
    const results = await batchCheckActivity(batch, activityChecker, batchSize);

    // Process results
    for (const result of results) {
      if (result.hasActivity) {
        activeWallets.push(result);
        consecutiveEmpty = 0;
      } else {
        consecutiveEmpty++;

        // Early exit if we hit gap limit
        if (consecutiveEmpty >= GAP_LIMIT) {
          break;
        }
      }
    }

    index += batch.length;

    // Report progress
    if (onProgress) {
      onProgress(index, activeWallets.length);
    }
  }

  return {
    activeWallets,
    totalChecked: index,
    consecutiveEmpty,
  };
}
