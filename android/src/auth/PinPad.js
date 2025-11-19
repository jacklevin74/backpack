import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export const PinPad = ({ onNumberPress, onBackspace }) => {
  const renderButton = (num, index) => {
    if (num === "") {
      return <View key={index} style={styles.button} />;
    }

    if (num === "←") {
      return (
        <TouchableOpacity
          key={index}
          style={styles.button}
          onPress={onBackspace}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>{num}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={index}
        style={styles.button}
        onPress={() => onNumberPress(num)}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>{num}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Row 1: 1, 2, 3 */}
      <View style={styles.row}>
        {["1", "2", "3"].map((num, index) => renderButton(num, index))}
      </View>
      {/* Row 2: 4, 5, 6 */}
      <View style={styles.row}>
        {["4", "5", "6"].map((num, index) => renderButton(num, index + 3))}
      </View>
      {/* Row 3: 7, 8, 9 */}
      <View style={styles.row}>
        {["7", "8", "9"].map((num, index) => renderButton(num, index + 6))}
      </View>
      {/* Row 4: empty, 0, backspace */}
      <View style={styles.row}>
        {renderButton("", 9)}
        {renderButton("0", 10)}
        {renderButton("←", 11)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 300,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
  },
  button: {
    width: 80,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(26, 26, 26, 0.8)",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "400",
  },
});
