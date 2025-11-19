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
    marginVertical: 16,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
    marginHorizontal: 8,
  },
  dotFilled: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
});
