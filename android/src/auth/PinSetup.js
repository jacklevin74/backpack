import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PinPad } from "./PinPad";
import { PinDots } from "./PinDots";
import { AuthManager } from "./AuthManager";
import { Toast } from "./Toast";

export const PinSetup = ({ password, onComplete }) => {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState("enter"); // 'enter' or 'confirm'
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info",
  });

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
                setToast({
                  visible: true,
                  message: "PIN created successfully",
                  type: "success",
                });

                // Give the toast a moment to appear before navigating
                setTimeout(() => {
                  onComplete();
                }, 300);
              } catch (error) {
                setToast({
                  visible: true,
                  message: error.message || "Failed to setup PIN",
                  type: "error",
                });
                setPin("");
                setConfirmPin("");
                setStep("enter");
              }
            } else {
              setToast({
                visible: true,
                message: "PINs do not match",
                type: "error",
              });
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
      <Image
        source={require("../../assets/bg.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      {/* Dark blue to transparent gradient overlay */}
      <LinearGradient
        colors={["#1a1a2e", "transparent"]}
        style={styles.gradientOverlay}
      />
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        {/* Logo with blur background */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/x1-logo-with-blur.png")}
            style={styles.logoBlur}
            resizeMode="contain"
          />
          <Image
            source={require("../../assets/x1-wallet.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Header */}
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

        {/* PIN Dots */}
        <PinDots
          length={6}
          filled={step === "enter" ? pin.length : confirmPin.length}
        />

        {/* Keypad */}
        <View style={[styles.keypadContainer, { paddingBottom: insets.bottom + 20 }]}>
          <PinPad onNumberPress={handleNumberPress} onBackspace={handleBackspace} />
        </View>
      </View>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  logoContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoBlur: {
    position: "absolute",
    width: 100,
    height: 100,
    zIndex: 0,
  },
  logo: {
    width: 100,
    height: 100,
    zIndex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  keypadContainer: {
    marginTop: 20,
    width: "100%",
    alignItems: "center",
  },
});
