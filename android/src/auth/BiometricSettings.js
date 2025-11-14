import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from "react-native";
import { AuthManager } from "./AuthManager";

export const BiometricSettings = ({ password, onBack }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    checkBiometricStatus();
  }, []);

  const checkBiometricStatus = async () => {
    try {
      const supported = await AuthManager.isBiometricSupported();
      const enabled = await AuthManager.isBiometricEnabled();

      setIsSupported(supported);
      setIsEnabled(enabled);
      setIsLoading(false);
    } catch (err) {
      console.error("Error checking biometric status:", err);
      setError("Failed to check biometric status");
      setIsLoading(false);
    }
  };

  const handleToggle = async (value) => {
    setError("");

    if (!isSupported) {
      setError("Biometric authentication is not available on this device");
      return;
    }

    try {
      if (value) {
        // Enable biometrics
        await AuthManager.enableBiometrics(password);
        setIsEnabled(true);
      } else {
        // Disable biometrics
        await AuthManager.disableBiometrics();
        setIsEnabled(false);
      }
    } catch (err) {
      console.error("Error toggling biometrics:", err);
      setError(err.message || "Failed to update biometric settings");
      // Revert the toggle
      setIsEnabled(!value);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Checking biometric support...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Biometric Unlock</Text>
        <Text style={styles.subtitle}>
          {isSupported
            ? "Use fingerprint or face recognition to unlock your wallet"
            : "Biometric authentication is not available on this device"}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.toggleContainer}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Enable Biometric Unlock</Text>
          <Text style={styles.toggleDescription}>
            {isEnabled
              ? "You can unlock with biometrics instead of PIN"
              : "Use your device biometrics as an alternative to PIN"}
          </Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          disabled={!isSupported}
          trackColor={{ false: "#767577", true: "#8B5CF6" }}
          thumbColor={isEnabled ? "#A78BFA" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
        />
      </View>

      {isSupported && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ How it works</Text>
          <Text style={styles.infoText}>
            • Your PIN is still required for initial setup{"\n"}• Biometrics
            provide a faster way to unlock{"\n"}• You can always use your PIN if
            biometrics fail{"\n"}• Your data is secured by your device's
            biometric system
          </Text>
        </View>
      )}

      {!isSupported && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Not Available</Text>
          <Text style={styles.warningText}>
            Your device doesn't support biometric authentication, or you haven't
            set up fingerprint/face recognition in your device settings.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
    padding: 20,
  },
  header: {
    marginBottom: 30,
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
    lineHeight: 20,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#60A5FA",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    lineHeight: 22,
  },
  warningBox: {
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
    borderRadius: 12,
    padding: 16,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FBBF24",
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    lineHeight: 20,
  },
});
