import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { PinPad } from "./PinPad";
import { PinDots } from "./PinDots";
import { AuthManager, PinLockoutError } from "./AuthManager";
import { Toast } from "./Toast";

export const PinUnlock = ({ onUnlock }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [lockoutMs, setLockoutMs] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info",
  });

  useEffect(() => {
    checkBiometric();
  }, []);

  useEffect(() => {
    if (lockoutMs > 0) {
      const timer = setInterval(() => {
        setLockoutMs((prev) => Math.max(0, prev - 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutMs]);

  const checkBiometric = async () => {
    const enabled = await AuthManager.isBiometricEnabled();
    const supported = await AuthManager.isBiometricSupported();
    setBiometricAvailable(enabled && supported);
  };

  const handleBiometric = async () => {
    try {
      setError("");
      // Add delay to ensure activity is fully ready and UI is stable
      // Increased from 100ms to 500ms to prevent "activity no longer available" errors
      await new Promise((resolve) => setTimeout(resolve, 500));
      const password = await AuthManager.unlockWithBiometrics();
      onUnlock(password);
    } catch (err) {
      console.error("Biometric authentication error:", err);

      // Handle specific error for activity no longer available
      if (err.message && err.message.includes("activity no longer available")) {
        setError("Please try again");
        setToast({
          visible: true,
          message: "Authentication unavailable, please try again",
          type: "error",
        });
      } else if (err.message && err.message.includes("cancelled")) {
        // User cancelled, don't show error
        setError("");
      } else {
        setError(err.message || "Biometric authentication failed");
        setToast({
          visible: true,
          message: "Authentication failed",
          type: "error",
        });
      }
    }
  };

  const handleNumberPress = (num) => {
    if (lockoutMs > 0) {
      return;
    }

    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);

      if (newPin.length === 6) {
        setTimeout(async () => {
          try {
            setError("");
            const password = await AuthManager.unlockWithPin(newPin);

            // Show success toast
            setToast({
              visible: true,
              message: "Unlocking...",
              type: "success",
            });

            // Give the toast a moment to appear before navigating
            setTimeout(() => {
              onUnlock(password);
            }, 300);
          } catch (err) {
            if (err instanceof PinLockoutError) {
              setLockoutMs(err.remainingMs);
              setError(
                `Too many attempts. Try again in ${Math.ceil(err.remainingMs / 1000)}s`
              );
            } else {
              setError(err.message || "Invalid PIN");
              // Show error toast
              setToast({
                visible: true,
                message: "PIN incorrect",
                type: "error",
              });
            }
            setPin("");
          }
        }, 200);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const formatLockoutTime = (ms) => {
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `${seconds}s`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Enter PIN</Text>
        <Text style={styles.subtitle}>
          {lockoutMs > 0
            ? `Locked for ${formatLockoutTime(lockoutMs)}`
            : "Enter your 6-digit PIN to unlock"}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PinDots length={6} filled={pin.length} />

      {biometricAvailable && lockoutMs === 0 && (
        <TouchableOpacity
          style={styles.biometricButton}
          onPress={handleBiometric}
          activeOpacity={0.7}
        >
          <Text style={styles.biometricText}>Use Biometric</Text>
        </TouchableOpacity>
      )}

      <PinPad onNumberPress={handleNumberPress} onBackspace={handleBackspace} />

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
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 10,
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
  error: {
    color: "#EF4444",
    fontSize: 14,
    marginVertical: 10,
    textAlign: "center",
  },
  biometricButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginVertical: 15,
    borderRadius: 8,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.5)",
  },
  biometricText: {
    color: "#A78BFA",
    fontSize: 16,
    fontWeight: "600",
  },
});
