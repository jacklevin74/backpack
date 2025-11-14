import React from "react";
import { View, StyleSheet } from "react-native";

export const PinDots = ({ length = 6, filled = 0 }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, index) => (
        <View
          key={index}
          style={[styles.dot, index < filled && styles.dotFilled]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
    marginVertical: 30,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
});
