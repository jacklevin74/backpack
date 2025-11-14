import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { PinPad } from "./PinPad";
import { PinDots } from "./PinDots";
import { AuthManager, PinLockoutError } from "./AuthManager";
import { Toast } from "./Toast";

export const ChangePin = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState("current"); // 'current', 'new', 'confirm'
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info",
  });

  const handleNumberPress = (num) => {
    setError("");

    if (step === "current") {
      if (currentPin.length < 6) {
        const pin = currentPin + num;
        setCurrentPin(pin);

        if (pin.length === 6) {
          setTimeout(async () => {
            try {
              // Verify current PIN
              await AuthManager.unlockWithPin(pin);
              setStep("new");
            } catch (err) {
              if (err instanceof PinLockoutError) {
                setError(
                  `Too many attempts. Try again in ${Math.ceil(err.remainingMs / 1000)}s`
                );
              } else {
                setError("Current PIN is incorrect");
                setToast({
                  visible: true,
                  message: "Current PIN is incorrect",
                  type: "error",
                });
              }
              setCurrentPin("");
            }
          }, 200);
        }
      }
    } else if (step === "new") {
      if (newPin.length < 6) {
        const pin = newPin + num;
        setNewPin(pin);

        if (pin.length === 6) {
          setTimeout(() => {
            setStep("confirm");
          }, 200);
        }
      }
    } else if (step === "confirm") {
      if (confirmPin.length < 6) {
        const pin = confirmPin + num;
        setConfirmPin(pin);

        if (pin.length === 6) {
          setTimeout(async () => {
            if (pin === newPin) {
              try {
                // Get the master password first
                const password = await AuthManager.getMasterPassword();

                // Update PIN with the same password
                await AuthManager.setupPin(newPin, password);

                setToast({
                  visible: true,
                  message: "PIN changed successfully",
                  type: "success",
                });

                setTimeout(() => {
                  onComplete();
                }, 800);
              } catch (error) {
                setError(error.message || "Failed to change PIN");
                setToast({
                  visible: true,
                  message: error.message || "Failed to change PIN",
                  type: "error",
                });
                setNewPin("");
                setConfirmPin("");
                setStep("new");
              }
            } else {
              setError("PINs do not match");
              setToast({
                visible: true,
                message: "PINs do not match",
                type: "error",
              });
              setNewPin("");
              setConfirmPin("");
              setStep("new");
            }
          }, 200);
        }
      }
    }
  };

  const handleBackspace = () => {
    setError("");
    if (step === "current") {
      setCurrentPin(currentPin.slice(0, -1));
    } else if (step === "new") {
      setNewPin(newPin.slice(0, -1));
    } else if (step === "confirm") {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const getTitle = () => {
    if (step === "current") return "Enter Current PIN";
    if (step === "new") return "Enter New PIN";
    return "Confirm New PIN";
  };

  const getSubtitle = () => {
    if (step === "current") return "Verify your current PIN to continue";
    if (step === "new") return "Enter a new 6-digit PIN";
    return "Re-enter your new PIN to confirm";
  };

  const getFilledDots = () => {
    if (step === "current") return currentPin.length;
    if (step === "new") return newPin.length;
    return confirmPin.length;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{getTitle()}</Text>
        <Text style={styles.subtitle}>{getSubtitle()}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PinDots length={6} filled={getFilledDots()} />

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
    fontSize: 24,
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
});
