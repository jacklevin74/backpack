import type { ChannelAppUiClient } from "@coral-xyz/common";
import {
  buildFullFeatureGatesMap,
  UI_RPC_METHOD_SET_FEATURE_GATES,
} from "@coral-xyz/common";

const FEATURE_GATE_URL = "https://backpack-api.xnfts.dev/v2/feature-gates";
const CACHE_KEY = "backpack_feature_gates_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface FeatureGatesCache {
  gates: any;
  timestamp: number;
}

// Get cached feature gates if still valid
function getCachedFeatureGates(): any | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: FeatureGatesCache = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid (less than 5 minutes old)
    if (now - data.timestamp < CACHE_DURATION) {
      return data.gates;
    }

    // Cache expired, remove it
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch (e) {
    // If there's any error reading cache, ignore it
    return null;
  }
}

// Save feature gates to cache
function cacheFeatureGates(gates: any) {
  try {
    const data: FeatureGatesCache = {
      gates,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    // Ignore cache save errors (e.g., localStorage full)
  }
}

export const refreshFeatureGates = async (background: ChannelAppUiClient) => {
  // Try to use cached gates first for instant load
  const cachedGates = getCachedFeatureGates();
  if (cachedGates) {
    // Use cached gates immediately, then refresh in background
    await background.request({
      method: UI_RPC_METHOD_SET_FEATURE_GATES,
      params: [cachedGates],
    });

    // Refresh in background (don't await)
    fetchAndUpdateFeatureGates(background).catch(() => {
      // Silently fail background refresh
    });
    return;
  }

  // No cache available, fetch synchronously
  await fetchAndUpdateFeatureGates(background);
};

async function fetchAndUpdateFeatureGates(background: ChannelAppUiClient) {
  try {
    const res = await fetch(`${FEATURE_GATE_URL}/gates`);
    const json = await res.json();
    if (!json.gates) throw new Error(json.message);
    const gates = buildFullFeatureGatesMap(json.gates);

    // Cache the gates for future use
    cacheFeatureGates(gates);

    await background.request({
      method: UI_RPC_METHOD_SET_FEATURE_GATES,
      params: [gates],
    });
  } catch (e) {
    console.warn(
      `Error while refreshing feature gates, falling back to defaults`
    );
  }
}
