/**
 * Price history utility for fetching token price data from CoinGecko
 * Based on the example from ~/dev/priceHistory.ts
 */

// Simple in-memory cache with 5-minute expiry
const priceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches price history for a token from CoinGecko API
 * @param {string} tokenId - CoinGecko token ID (e.g., 'solana', 'bitcoin')
 * @param {number} days - Number of days of history to fetch
 * @returns {Promise<Array<{timestamp: number, value: number}>>}
 */
export async function fetchPriceHistory(tokenId, days = 1) {
  const cacheKey = `${tokenId}-${days}`;
  const cached = priceCache.get(cacheKey);

  // Return cached data if it's still fresh
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached data for ${cacheKey}`);
    return cached.data;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?vs_currency=usd&days=${days}`
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Please wait a moment and try again."
        );
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const prices = data.prices; // [[timestamp_ms, price], ...]

    // Convert to the format expected by react-native-graph
    const priceData = prices.map(([timestampMs, price]) => ({
      timestamp: Math.floor(timestampMs / 1000), // Convert to seconds
      value: price,
    }));

    // Cache the result
    priceCache.set(cacheKey, {
      data: priceData,
      timestamp: Date.now(),
    });

    return priceData;
  } catch (error) {
    console.error("Error fetching price history:", error);
    throw error;
  }
}

/**
 * Aggregates price data to N-minute intervals
 * Uses the closing price (last price in each interval)
 * @param {Array<{timestamp: number, value: number}>} pricePoints
 * @param {number} minutes - Interval size in minutes
 * @returns {Array<{timestamp: number, value: number}>}
 */
export function aggregateToMinutes(pricePoints, minutes) {
  const intervalMs = minutes * 60 * 1000;
  const intervalMap = new Map();

  // Group prices by interval
  pricePoints.forEach((point) => {
    const intervalStart =
      Math.floor((point.timestamp * 1000) / intervalMs) * intervalMs;

    if (!intervalMap.has(intervalStart)) {
      intervalMap.set(intervalStart, []);
    }
    intervalMap.get(intervalStart).push(point);
  });

  // Get closing price for each interval
  const aggregated = [];
  intervalMap.forEach((points) => {
    const sorted = points.sort((a, b) => a.timestamp - b.timestamp);
    aggregated.push(sorted[sorted.length - 1]);
  });

  return aggregated.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Fetches 24-hour price history for a token with 15-minute resolution
 * @param {string} tokenId - CoinGecko token ID
 * @returns {Promise<Array<{timestamp: number, value: number}>>}
 */
export async function fetch24HourPriceHistory(tokenId) {
  // Fetch 1 day (automatically gets 5-minute intervals from CoinGecko)
  const fiveMinData = await fetchPriceHistory(tokenId, 1);

  // Aggregate to 15-minute intervals
  const fifteenMinData = aggregateToMinutes(fiveMinData, 15);

  return fifteenMinData;
}

/**
 * Calculate statistics from price data
 * @param {Array<{timestamp: number, value: number}>} priceData
 * @returns {{firstPrice: number, lastPrice: number, priceChange: number, percentChange: number, high: number, low: number, average: number}}
 */
export function calculateStats(priceData) {
  if (!priceData || priceData.length === 0) {
    return {
      firstPrice: 0,
      lastPrice: 0,
      priceChange: 0,
      percentChange: 0,
      high: 0,
      low: 0,
      average: 0,
    };
  }

  const prices = priceData.map((p) => p.value);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  const firstPrice = priceData[0].value;
  const lastPrice = priceData[priceData.length - 1].value;
  const priceChange = lastPrice - firstPrice;
  const percentChange = (priceChange / firstPrice) * 100;

  return {
    firstPrice,
    lastPrice,
    priceChange,
    percentChange,
    high: maxPrice,
    low: minPrice,
    average: avgPrice,
  };
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use calculateStats instead
 */
export function calculate24HStats(priceData) {
  return calculateStats(priceData);
}

/**
 * Get YTD start date (January 1 of current year)
 * @returns {Date}
 */
export function getYTDStartDate() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1); // Jan 1, current year
}

/**
 * Calculate days for YTD
 * @returns {number}
 */
export function getYTDDays() {
  const now = new Date();
  const ytdStart = getYTDStartDate();
  const diffTime = Math.abs(now - ytdStart);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get period configuration for data fetching and display
 * @param {string} period - One of: '1D', '1W', '1M', '1Y', 'YTD'
 * @returns {{days: number, interval: number, label: string}}
 */
export function getPeriodConfig(period) {
  const configs = {
    "1D": { days: 1, interval: 15, label: "1d" }, // 15-minute intervals
    "1W": { days: 7, interval: 60, label: "7d" }, // 1-hour intervals
    "1M": { days: 30, interval: 240, label: "30d" }, // 4-hour intervals
    "1Y": { days: 365, interval: 1440, label: "1y" }, // 1-day intervals
    YTD: { days: getYTDDays(), interval: 1440, label: "ytd" }, // 1-day intervals
  };
  return configs[period] || configs["1D"];
}

/**
 * Fetch price history for a specific period with appropriate aggregation
 * @param {string} tokenId - CoinGecko token ID
 * @param {string} period - One of: '1D', '1W', '1M', '1Y', 'YTD'
 * @returns {Promise<Array<{timestamp: number, value: number}>>}
 */
export async function fetchPriceHistoryForPeriod(tokenId, period) {
  const config = getPeriodConfig(period);
  const rawData = await fetchPriceHistory(tokenId, config.days);

  // Aggregate to the appropriate interval
  const aggregatedData = aggregateToMinutes(rawData, config.interval);

  return aggregatedData;
}
