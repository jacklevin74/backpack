import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export const PinPad = ({ onNumberPress, onBackspace }) => {
  const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <View style={styles.container}>
      {numbers.map((num, index) => {
        if (num === "") {
          return <View key={index} style={styles.button} />;
        }

        if (num === "⌫") {
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
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 300,
    justifyContent: "center",
  },
  button: {
    width: 90,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    margin: 5,
    borderRadius: 45,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "300",
  },
});
