import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { Buffer } from "buffer";
import { randomBytes } from "tweetnacl";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";

const PIN_CONFIG_KEY = "pin_config";
const MASTER_PASSWORD_KEY = "master_password";
const BIOMETRIC_PASSWORD_KEY = "biometric_password";
const BIOMETRIC_PREFERENCE_KEY = "@wallet:biometricPreference";
const LOCK_STATE_KEY = "@wallet:pinLockState";
const LOCK_WINDOWS_MS = [30_000, 120_000, 600_000];
const MAX_FAILED_ATTEMPTS = 5;
const PIN_KDF_ITERATIONS = 10_000; // Reduced for mobile performance

export class PinLockoutError extends Error {
  constructor(remainingMs) {
    super("PIN entry temporarily locked");
    this.remainingMs = remainingMs;
  }
}

export class AuthManager {
  static async hasPin() {
    try {
      const config = await SecureStore.getItemAsync(PIN_CONFIG_KEY);
      return Boolean(config);
    } catch (error) {
      console.error("hasPin error:", error);
      return false;
    }
  }

  static async isBiometricEnabled() {
    try {
      const pref = await AsyncStorage.getItem(BIOMETRIC_PREFERENCE_KEY);
      return pref === "true";
    } catch (error) {
      console.error("isBiometricEnabled error:", error);
      return false;
    }
  }

  static async isBiometricSupported() {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return compatible && enrolled;
    } catch (error) {
      console.error("isBiometricSupported error:", error);
      return false;
    }
  }

  static async setupPin(pin, password) {
    console.log(
      "setupPin called with pin length:",
      pin?.length,
      "password length:",
      password?.length
    );
    AuthManager.assertValidPin(pin);

    console.log("Generating salt...");
    const salt = randomBytes(16);
    console.log("Salt generated, deriving PIN hash...");
    const derived = await AuthManager.derivePinHash(
      pin,
      salt,
      PIN_KDF_ITERATIONS
    );
    console.log("PIN hash derived, creating config...");
    const config = {
      salt: Buffer.from(salt).toString("base64"),
      hash: Buffer.from(derived).toString("base64"),
      iterations: PIN_KDF_ITERATIONS,
    };

    console.log("Saving PIN config to SecureStore...");
    await SecureStore.setItemAsync(PIN_CONFIG_KEY, JSON.stringify(config));
    console.log("Storing master password...");
    await AuthManager.storeMasterPassword(password);
    console.log("Clearing lock state...");
    await AuthManager.clearLockState();
    console.log("PIN setup complete!");
  }

  static async clearSecurityState() {
    try {
      await AsyncStorage.multiRemove([
        BIOMETRIC_PREFERENCE_KEY,
        LOCK_STATE_KEY,
      ]);
      await SecureStore.deleteItemAsync(PIN_CONFIG_KEY);
      await SecureStore.deleteItemAsync(MASTER_PASSWORD_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
    } catch (error) {
      console.error("clearSecurityState error:", error);
    }
  }

  static async unlockWithPin(pin) {
    await AuthManager.ensureNotLocked();
    const pinConfig = await AuthManager.getPinConfig();

    try {
      await AuthManager.verifyPin(pin, pinConfig);
    } catch (error) {
      await AuthManager.registerFailedAttempt();
      throw error;
    }

    const password = await AuthManager.getMasterPassword();
    await AuthManager.clearLockState();
    return password;
  }

  static async enableBiometrics(password) {
    const supported = await AuthManager.isBiometricSupported();
    if (!supported) {
      throw new Error("Biometrics not supported on this device");
    }

    await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password, {
      requireAuthentication: true,
    });
    await AsyncStorage.setItem(BIOMETRIC_PREFERENCE_KEY, "true");
  }

  static async disableBiometrics() {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
      await AsyncStorage.setItem(BIOMETRIC_PREFERENCE_KEY, "false");
    } catch (error) {
      console.error("disableBiometrics error:", error);
    }
  }

  static async unlockWithBiometrics() {
    const biometricEnabled = await AuthManager.isBiometricEnabled();
    if (!biometricEnabled) {
      throw new Error("Biometrics not enabled");
    }

    // SecureStore will automatically trigger biometric authentication
    // because the password was stored with requireAuthentication: true
    const password = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY, {
      requireAuthentication: true,
      authenticationPrompt: "Authenticate to unlock X1 Wallet",
    });

    if (!password) {
      throw new Error("Biometric password not found");
    }

    await AuthManager.clearLockState();
    return password;
  }

  static assertValidPin(pin) {
    if (!/^\d{6}$/.test(pin)) {
      throw new Error("PIN must be a 6-digit number");
    }
  }

  static async getLockState() {
    try {
      const raw = await AsyncStorage.getItem(LOCK_STATE_KEY);
      if (!raw) {
        return { failedAttempts: 0, lockUntil: null };
      }
      return JSON.parse(raw);
    } catch {
      return { failedAttempts: 0, lockUntil: null };
    }
  }

  static async saveLockState(state) {
    await AsyncStorage.setItem(LOCK_STATE_KEY, JSON.stringify(state));
  }

  static async clearLockState() {
    await AuthManager.saveLockState({ failedAttempts: 0, lockUntil: null });
  }

  static async ensureNotLocked() {
    const state = await AuthManager.getLockState();
    if (state.lockUntil && state.lockUntil > Date.now()) {
      throw new PinLockoutError(state.lockUntil - Date.now());
    }
    if (state.lockUntil && state.lockUntil <= Date.now()) {
      await AuthManager.clearLockState();
    }
  }

  static async registerFailedAttempt() {
    const state = await AuthManager.getLockState();
    const failedAttempts = state.failedAttempts + 1;
    let lockUntil = null;

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const tier = Math.min(
        LOCK_WINDOWS_MS.length - 1,
        Math.floor((failedAttempts - MAX_FAILED_ATTEMPTS) / MAX_FAILED_ATTEMPTS)
      );
      lockUntil = Date.now() + LOCK_WINDOWS_MS[tier];
    }

    await AuthManager.saveLockState({ failedAttempts, lockUntil });
  }

  static async getPinConfig() {
    const config = await SecureStore.getItemAsync(PIN_CONFIG_KEY);
    if (!config) {
      throw new Error("PIN is not configured");
    }
    return JSON.parse(config);
  }

  static async derivePinHash(pin, salt, iterations) {
    // Use @noble/hashes for PBKDF2 (React Native compatible)
    const saltBytes = salt instanceof Uint8Array ? salt : Buffer.from(salt);
    const hash = pbkdf2(sha256, pin, saltBytes, { c: iterations, dkLen: 32 });
    return Buffer.from(hash);
  }

  static async verifyPin(pin, config) {
    const salt = Buffer.from(config.salt, "base64");
    const expectedHash = Buffer.from(config.hash, "base64");
    const derived = await AuthManager.derivePinHash(
      pin,
      salt,
      config.iterations
    );

    // Timing-safe comparison
    if (expectedHash.length !== derived.length) {
      throw new Error("Invalid PIN");
    }

    let mismatch = 0;
    for (let i = 0; i < expectedHash.length; i++) {
      mismatch |= expectedHash[i] ^ derived[i];
    }

    if (mismatch !== 0) {
      throw new Error("Invalid PIN");
    }
  }

  static async storeMasterPassword(password) {
    await SecureStore.setItemAsync(MASTER_PASSWORD_KEY, password);
  }

  static async getMasterPassword() {
    const password = await SecureStore.getItemAsync(MASTER_PASSWORD_KEY);
    if (!password) {
      throw new Error("Master password not found");
    }
    return password;
  }
}
