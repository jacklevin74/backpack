import React, { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet } from "react-native";

/**
 * TokenIcon component that displays a character-based fallback icon immediately
 * and optionally loads a URL-based logo after a 1-second delay.
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
  const [showUrlLogo, setShowUrlLogo] = useState(false);
  const [urlLoadError, setUrlLoadError] = useState(false);

  useEffect(() => {
    // Only delay URL-based logos by 1 second
    // Local require() assets should load immediately
    if (logoUrl && !logo) {
      const timer = setTimeout(() => {
        setShowUrlLogo(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [logo, logoUrl]);

  // Get first character of symbol for fallback
  const charIcon = symbol ? symbol.charAt(0).toUpperCase() : "?";

  // Determine which icon to show
  // Show local logo immediately, or character icon while waiting for URL
  const shouldShowChar = !logo && (!logoUrl || !showUrlLogo || urlLoadError);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {shouldShowChar ? (
        // Show character-based icon
        <View
          style={[
            styles.charIconContainer,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.charIcon, { fontSize: size * 0.5 }]}>
            {charIcon}
          </Text>
        </View>
      ) : (
        // Show logo (local or URL-based)
        <Image
          source={showUrlLogo && logoUrl && !logo ? { uri: logoUrl } : logo}
          style={[
            { width: size, height: size, borderRadius: size / 2 },
            imageStyle,
          ]}
          onError={() => {
            if (showUrlLogo && logoUrl && !logo) {
              console.log(`Failed to load token logo from URL: ${logoUrl}`);
              setUrlLoadError(true);
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
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  charIcon: {
    color: "#FFF",
    fontWeight: "bold",
  },
});

export default TokenIcon;
