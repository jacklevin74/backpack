import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { PinPad } from "./PinPad";
import { PinDots } from "./PinDots";
import { AuthManager } from "./AuthManager";

export const PinSetup = ({ password, onComplete }) => {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState("enter"); // 'enter' or 'confirm'

  const handleNumberPress = (num) => {
    if (step === "enter") {
      if (pin.length < 6) {
        const newPin = pin + num;
        setPin(newPin);

        if (newPin.length === 6) {
          setTimeout(() => {
            setStep("confirm");
          }, 200);
        }
      }
    } else {
      if (confirmPin.length < 6) {
        const newConfirmPin = confirmPin + num;
        setConfirmPin(newConfirmPin);

        if (newConfirmPin.length === 6) {
          setTimeout(async () => {
            if (newConfirmPin === pin) {
              try {
                await AuthManager.setupPin(pin, password);
                onComplete();
              } catch (error) {
                Alert.alert("Error", error.message || "Failed to setup PIN");
                setPin("");
                setConfirmPin("");
                setStep("enter");
              }
            } else {
              Alert.alert("Error", "PINs do not match. Please try again.");
              setPin("");
              setConfirmPin("");
              setStep("enter");
            }
          }, 200);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (step === "enter") {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {step === "enter" ? "Create PIN" : "Confirm PIN"}
        </Text>
        <Text style={styles.subtitle}>
          {step === "enter"
            ? "Enter a 6-digit PIN to secure your wallet"
            : "Re-enter your PIN to confirm"}
        </Text>
      </View>

      <PinDots
        length={6}
        filled={step === "enter" ? pin.length : confirmPin.length}
      />

      <PinPad onNumberPress={handleNumberPress} onBackspace={handleBackspace} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
