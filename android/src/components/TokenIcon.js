import React, { useState, useEffect, useMemo, memo, useRef } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Log module load
console.log("========================================");
console.log("[TokenIcon] Module loaded - Performance logging enabled");
console.log("========================================");

// Performance tracking
const perfStats = {
  totalRenders: 0,
  cacheHits: 0,
  cacheMisses: 0,
  totalRenderTime: 0,
  renderTimes: [],
  symbolCounts: {},
};

// Global cache to track which symbol+size combinations we've seen before
// Key: `${symbol}-${size}`, Value: true if we've rendered it before
const globalSymbolCache = new Map();

// Global cache for URL-based images
// Key: logoUrl string, Value: { loaded: true/false, timestamp: number }
// loaded: true = image loaded successfully, false = image failed to load
const imageUrlCache = new Map();

// AsyncStorage key for persisting image cache
const IMAGE_CACHE_STORAGE_KEY = "@tokenIconImageCache";

// Load image cache from AsyncStorage on module load
let cacheLoaded = false;
const loadImageCacheFromStorage = async () => {
  if (cacheLoaded) return;
  try {
    const cached = await AsyncStorage.getItem(IMAGE_CACHE_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.entries(parsed).forEach(([url, data]) => {
        imageUrlCache.set(url, data);
      });
      logPerf(`[CACHE LOAD] Loaded ${imageUrlCache.size} cached image URLs from storage`);
    }
    cacheLoaded = true;
  } catch (error) {
    console.error("[TokenIcon] Error loading image cache from storage:", error);
    cacheLoaded = true; // Mark as loaded even on error to prevent retries
  }
};

// Save image cache to AsyncStorage (debounced)
let saveCacheTimeout = null;
const saveImageCacheToStorage = async () => {
  if (saveCacheTimeout) {
    clearTimeout(saveCacheTimeout);
  }
  saveCacheTimeout = setTimeout(async () => {
    try {
      const cacheObject = Object.fromEntries(imageUrlCache);
      await AsyncStorage.setItem(IMAGE_CACHE_STORAGE_KEY, JSON.stringify(cacheObject));
      logPerf(`[CACHE SAVE] Saved ${imageUrlCache.size} image URLs to storage`);
    } catch (error) {
      console.error("[TokenIcon] Error saving image cache to storage:", error);
    }
  }, 1000); // Debounce saves by 1 second
};

// Initialize cache loading
loadImageCacheFromStorage();

// Track image load performance
const imageLoadStats = {
  totalLoads: 0,
  cacheHits: 0,
  cacheMisses: 0,
  failedLoads: 0,
};

// Enable/disable performance logging (always enabled for now)
const ENABLE_PERF_LOGS = true; // Force enabled for debugging

// Performance logging helper
const logPerf = (message, data = {}) => {
  // Always log with a clear prefix - use simple format for better visibility
  try {
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
    console.log(`[TokenIcon Perf] ${message}`, dataStr);
  } catch (e) {
    console.log(`[TokenIcon Perf] ${message}`, data);
  }
};

// Get high-resolution timestamp
const getPerfTime = () => {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }
  return Date.now();
};

// Generate a consistent background color based on symbol
const getBackgroundColor = (symbol) => {
  if (!symbol) return "#333";
  const colors = [
    "#6366F1", // Indigo
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#F59E0B", // Amber
    "#10B981", // Emerald
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#EF4444", // Red
    "#3B82F6", // Blue
    "#14B8A6", // Teal
  ];
  const charCode = symbol.charCodeAt(0) || 0;
  return colors[charCode % colors.length];
};

// Memoized character icon component for immediate rendering
const CachedCharIcon = memo(
  ({ char, size, backgroundColor, symbol }) => {
    const renderId = useRef(Math.random().toString(36).substr(2, 9));
    const renderStartTime = useRef(getPerfTime());

    // Track render performance using global cache
    useEffect(() => {
      const renderEndTime = getPerfTime();
      const renderTime = renderEndTime - renderStartTime.current;
      const cacheKey = `${symbol}-${size}`;
      
      perfStats.totalRenders++;
      perfStats.totalRenderTime += renderTime;
      perfStats.renderTimes.push(renderTime);

      // Check if we've seen this symbol+size combination before
      const isCached = globalSymbolCache.has(cacheKey);
      
      if (!isCached) {
        // First time seeing this symbol+size combination
        globalSymbolCache.set(cacheKey, true);
        perfStats.cacheMisses++;
        perfStats.symbolCounts[symbol] = (perfStats.symbolCounts[symbol] || 0) + 1;
        logPerf(`[CACHE MISS] First render for "${symbol}" (${size}px)`, {
          char,
          size,
          renderTime: `${renderTime.toFixed(2)}ms`,
          renderId: renderId.current,
          cacheKey,
        });
      } else {
        // We've seen this before - this is a cache hit!
        perfStats.cacheHits++;
        logPerf(`[CACHE HIT] Re-render for "${symbol}" (${size}px) - using cached component`, {
          char,
          size,
          renderTime: `${renderTime.toFixed(2)}ms`,
          renderId: renderId.current,
          cacheKey,
        });
      }

      // Log summary every 10 renders
      if (perfStats.totalRenders % 10 === 0) {
        const avgRenderTime =
          perfStats.totalRenderTime / perfStats.totalRenders;
        const cacheHitRate =
          (perfStats.cacheHits / perfStats.totalRenders) * 100;
        logPerf(`[SUMMARY] Performance Stats`, {
          totalRenders: perfStats.totalRenders,
          cacheHits: perfStats.cacheHits,
          cacheMisses: perfStats.cacheMisses,
          cacheHitRate: `${cacheHitRate.toFixed(1)}%`,
          avgRenderTime: `${avgRenderTime.toFixed(2)}ms`,
          minRenderTime: `${Math.min(...perfStats.renderTimes).toFixed(2)}ms`,
          maxRenderTime: `${Math.max(...perfStats.renderTimes).toFixed(2)}ms`,
        });
      }

      // Update start time for next render
      renderStartTime.current = getPerfTime();
    }, [char, size, backgroundColor, symbol]);

    const containerStyle = useMemo(
      () => {
        const styleStart = getPerfTime();
        const style = [
          styles.charIconContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor,
          },
        ];
        const styleTime = getPerfTime() - styleStart;
        if (ENABLE_PERF_LOGS && styleTime > 0.1) {
          logPerf(`[STYLE] Style calculation took ${styleTime.toFixed(2)}ms`, {
            symbol,
          });
        }
        return style;
      },
      [size, backgroundColor, symbol]
    );

    const textStyle = useMemo(
      () => {
        // Adjust font size based on character length
        // For 3 characters, use smaller font; for 1-2 characters, use larger
        const fontSize = char.length > 2 ? size * 0.35 : size * 0.5;
        return [styles.charIcon, { fontSize }];
      },
      [size, char]
    );

    return (
      <View style={containerStyle}>
        <Text style={textStyle}>{char}</Text>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Return true if props are equal (skip re-render)
    const isEqual =
      prevProps.char === nextProps.char &&
      prevProps.size === nextProps.size &&
      prevProps.backgroundColor === nextProps.backgroundColor &&
      prevProps.symbol === nextProps.symbol;

    if (!isEqual) {
      logPerf(`[MEMO] Props changed, will re-render CachedCharIcon`, {
        symbol: nextProps.symbol,
        prevChar: prevProps.char,
        nextChar: nextProps.char,
        prevSize: prevProps.size,
        nextSize: nextProps.size,
        prevBg: prevProps.backgroundColor,
        nextBg: nextProps.backgroundColor,
      });
    } else {
      logPerf(`[MEMO] Props unchanged, using cached CachedCharIcon`, {
        symbol: nextProps.symbol,
      });
    }

    return isEqual;
  }
);

CachedCharIcon.displayName = "CachedCharIcon";

/**
 * TokenIcon component that displays a character-based fallback icon immediately
 * and optionally loads a URL-based logo after a 1-second delay.
 * Character icons are cached for instant rendering.
 *
 * @param {object} props
 * @param {string} props.symbol - Token symbol (e.g., "XNT", "SOL")
 * @param {any} props.logo - Local logo asset (from require())
 * @param {string} [props.logoUrl] - Optional URL to fetch logo from
 * @param {object} [props.style] - Style for the container
 * @param {object} [props.imageStyle] - Style for the image
 * @param {number} [props.size] - Size of the icon (default: 40)
 */
const TokenIcon = ({ symbol, logo, logoUrl, style, imageStyle, size = 40 }) => {
  // Check if this URL has been attempted before (success or failure)
  const cacheEntry = logoUrl ? imageUrlCache.get(logoUrl) : null;
  const isUrlCached = !!cacheEntry;
  const urlLoadSuccess = cacheEntry?.loaded === true;
  const urlLoadFailed = cacheEntry?.loaded === false;
  
  // Initialize state based on cache
  // If cached and successful, show image; if cached and failed, show character; if not cached, try loading
  const [showUrlLogo, setShowUrlLogo] = useState(urlLoadSuccess);
  const [urlLoadError, setUrlLoadError] = useState(urlLoadFailed);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const componentRenderStart = useRef(getPerfTime());
  const hasLoggedMount = useRef(false);

  // Log component mount
  useEffect(() => {
    if (!hasLoggedMount.current) {
      logPerf(`[MOUNT] TokenIcon component mounted`, {
        symbol,
        hasLogo: !!logo,
        hasLogoUrl: !!logoUrl,
        size,
      });
      hasLoggedMount.current = true;
    }
  }, []);

  useEffect(() => {
    // Handle URL-based logos
    if (logoUrl && !logo) {
      if (isUrlCached) {
        // URL has been attempted before - use cached result
        if (urlLoadSuccess) {
          // Cached success - show image
          setShowUrlLogo(true);
          setUrlLoadError(false);
          imageLoadStats.cacheHits++;
          logPerf(`[IMAGE CACHE HIT] Using cached image for "${symbol}"`, {
            logoUrl,
            symbol,
          });
        } else if (urlLoadFailed) {
          // Cached failure - show character icon, don't retry
          setShowUrlLogo(false);
          setUrlLoadError(true);
          imageLoadStats.cacheHits++;
          logPerf(`[IMAGE CACHE HIT] Using cached failure for "${symbol}", showing character icon`, {
            logoUrl,
            symbol,
          });
        }
      } else {
        // URL not cached - attempt to load it once
        setIsLoadingUrl(true);
        imageLoadStats.cacheMisses++;
        logPerf(`[IMAGE CACHE MISS] Attempting to load image from URL for "${symbol}"`, {
          logoUrl,
          symbol,
        });
        // Set a brief delay before attempting to load (to prioritize character icons)
        const timer = setTimeout(() => {
          setShowUrlLogo(true);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [logo, logoUrl, isUrlCached, urlLoadSuccess, urlLoadFailed, symbol]);

  // Get 2-3 letter abbreviation for placeholder (memoized)
  // Excludes dollar signs and other special characters
  const charIcon = useMemo(
    () => {
      const start = getPerfTime();
      if (!symbol) return "?";
      
      // Remove dollar signs and other special characters
      const cleanSymbol = symbol.replace(/[$]/g, '');
      // Get 2-3 letter abbreviation
      const text = cleanSymbol.length <= 3 ? cleanSymbol : cleanSymbol.substring(0, 3);
      const char = text.toUpperCase();
      
      const time = getPerfTime() - start;
      if (ENABLE_PERF_LOGS && time > 0.1) {
        logPerf(`[CHAR] Character extraction took ${time.toFixed(2)}ms`, {
          symbol,
        });
      }
      return char;
    },
    [symbol]
  );

  // Get background color (memoized)
  const backgroundColor = useMemo(
    () => {
      const start = getPerfTime();
      const color = getBackgroundColor(symbol);
      const time = getPerfTime() - start;
      if (ENABLE_PERF_LOGS && time > 0.1) {
        logPerf(`[COLOR] Color calculation took ${time.toFixed(2)}ms`, {
          symbol,
        });
      }
      return color;
    },
    [symbol]
  );

  // Determine which icon to show
  // Show character icon if:
  // - No local logo AND
  // - (No URL OR URL not cached OR URL load failed)
  const shouldShowChar = !logo && (!logoUrl || !showUrlLogo || urlLoadError);

  // Log when character icon is being rendered
  useEffect(() => {
    const totalTime = getPerfTime() - componentRenderStart.current;
    logPerf(`[RENDER] TokenIcon render decision`, {
      symbol,
      shouldShowChar,
      hasLogo: !!logo,
      hasLogoUrl: !!logoUrl,
      showUrlLogo,
      urlLoadError,
      char: charIcon,
      size,
      totalComponentTime: `${totalTime.toFixed(2)}ms`,
    });
    
    if (shouldShowChar) {
      logPerf(`[RENDER] Character icon will be displayed`, {
        symbol,
        char: charIcon,
        size,
        backgroundColor,
      });
    } else {
      logPerf(`[RENDER] Logo will be displayed instead of character`, {
        symbol,
        hasLogo: !!logo,
        hasLogoUrl: !!logoUrl,
      });
    }
  }, [shouldShowChar, symbol, charIcon, size, logo, logoUrl, showUrlLogo, urlLoadError, backgroundColor]);

  // Memoize container style
  const containerStyle = useMemo(
    () => [styles.container, { width: size, height: size }, style],
    [size, style]
  );

  // Memoize image style
  const memoizedImageStyle = useMemo(
    () => [{ width: size, height: size, borderRadius: size / 2 }, imageStyle],
    [size, imageStyle]
  );

  return (
    <View style={containerStyle}>
      {shouldShowChar ? (
        // Show cached character-based icon (renders immediately)
        <CachedCharIcon
          char={charIcon}
          size={size}
          backgroundColor={backgroundColor}
          symbol={symbol}
        />
      ) : (
        // Show logo (local or URL-based)
        <Image
          source={showUrlLogo && logoUrl && !logo ? { uri: logoUrl, cache: 'force-cache' } : logo}
          style={memoizedImageStyle}
          onLoad={() => {
            // Image loaded successfully - cache the success
            if (logoUrl && !logo && isLoadingUrl && !imageUrlCache.has(logoUrl)) {
              imageUrlCache.set(logoUrl, {
                loaded: true,
                timestamp: Date.now(),
              });
              imageLoadStats.totalLoads++;
              setIsLoadingUrl(false);
              // Persist to AsyncStorage
              saveImageCacheToStorage();
              logPerf(`[IMAGE LOADED] Successfully loaded and cached image for "${symbol}" (persisted)`, {
                logoUrl,
                symbol,
                cacheSize: imageUrlCache.size,
              });
            }
          }}
          onError={() => {
            // Image failed to load - cache the failure and show character icon
            if (logoUrl && !logo && isLoadingUrl) {
              imageUrlCache.set(logoUrl, {
                loaded: false,
                timestamp: Date.now(),
              });
              imageLoadStats.failedLoads++;
              setIsLoadingUrl(false);
              setUrlLoadError(true);
              setShowUrlLogo(false);
              // Persist to AsyncStorage
              saveImageCacheToStorage();
              logPerf(`[IMAGE ERROR] Failed to load image for "${symbol}", cached failure and showing character icon (persisted)`, {
                logoUrl,
                symbol,
                cacheSize: imageUrlCache.size,
              });
            }
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  charIconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  charIcon: {
    color: "#FFF",
    fontWeight: "bold",
    textAlign: "center",
  },
});

// Export memoized component for better performance
const MemoizedTokenIcon = memo(TokenIcon, (prevProps, nextProps) => {
  // Custom comparison for TokenIcon memoization
  const isEqual =
    prevProps.symbol === nextProps.symbol &&
    prevProps.size === nextProps.size &&
    prevProps.logo === nextProps.logo &&
    prevProps.logoUrl === nextProps.logoUrl;

  if (!isEqual) {
    const changedProps = Object.keys(nextProps).filter(
      (key) => prevProps[key] !== nextProps[key]
    );
    logPerf(`[TOKEN_ICON_MEMO] Props changed, will re-render TokenIcon`, {
      symbol: nextProps.symbol,
      changedProps,
      prevSymbol: prevProps.symbol,
      nextSymbol: nextProps.symbol,
    });
  } else {
    logPerf(`[TOKEN_ICON_MEMO] Props unchanged, using cached TokenIcon`, {
      symbol: nextProps.symbol,
    });
  }

  return isEqual;
});

// Export function to get performance stats
export const getTokenIconPerfStats = () => {
  const avgRenderTime =
    perfStats.totalRenders > 0
      ? perfStats.totalRenderTime / perfStats.totalRenders
      : 0;
  const cacheHitRate =
    perfStats.totalRenders > 0
      ? (perfStats.cacheHits / perfStats.totalRenders) * 100
      : 0;
  
  const imageCacheHitRate =
    imageLoadStats.totalLoads + imageLoadStats.cacheHits > 0
      ? (imageLoadStats.cacheHits / (imageLoadStats.totalLoads + imageLoadStats.cacheHits)) * 100
      : 0;

  return {
    ...perfStats,
    avgRenderTime: avgRenderTime.toFixed(2) + "ms",
    cacheHitRate: cacheHitRate.toFixed(1) + "%",
    minRenderTime:
      perfStats.renderTimes.length > 0
        ? Math.min(...perfStats.renderTimes).toFixed(2) + "ms"
        : "N/A",
    maxRenderTime:
      perfStats.renderTimes.length > 0
        ? Math.max(...perfStats.renderTimes).toFixed(2) + "ms"
        : "N/A",
    imageCache: {
      totalLoads: imageLoadStats.totalLoads,
      cacheHits: imageLoadStats.cacheHits,
      cacheMisses: imageLoadStats.cacheMisses,
      failedLoads: imageLoadStats.failedLoads,
      cacheHitRate: imageCacheHitRate.toFixed(1) + "%",
      cachedUrls: imageUrlCache.size,
    },
  };
};

// Export function to reset performance stats
export const resetTokenIconPerfStats = () => {
  perfStats.totalRenders = 0;
  perfStats.cacheHits = 0;
  perfStats.cacheMisses = 0;
  perfStats.totalRenderTime = 0;
  perfStats.renderTimes = [];
  perfStats.symbolCounts = {};
  globalSymbolCache.clear();
  imageLoadStats.totalLoads = 0;
  imageLoadStats.cacheHits = 0;
  imageLoadStats.cacheMisses = 0;
  imageLoadStats.failedLoads = 0;
  // Note: We don't clear imageUrlCache here to preserve loaded images
  // Use clearImageCache() if you want to clear it
  logPerf("Performance stats reset");
};

// Export function to clear image URL cache
export const clearImageCache = async () => {
  const cacheSize = imageUrlCache.size;
  imageUrlCache.clear();
  try {
    await AsyncStorage.removeItem(IMAGE_CACHE_STORAGE_KEY);
    logPerf(`Image URL cache cleared (${cacheSize} entries removed from memory and storage)`);
  } catch (error) {
    console.error("[TokenIcon] Error clearing image cache from storage:", error);
    logPerf(`Image URL cache cleared from memory (${cacheSize} entries), but storage clear failed`);
  }
};

export default MemoizedTokenIcon;
