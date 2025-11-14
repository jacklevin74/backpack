import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { Buffer } from 'buffer';
import { randomBytes } from 'tweetnacl';
// @ts-ignore
import Crypto from 'crypto-browserify';

const PIN_CONFIG_SERVICE = 'com.coralxyz.backpack.mobilewallet.pinconfig';
const MASTER_PASSWORD_SERVICE = 'com.coralxyz.backpack.mobilewallet.masterpassword';
const BIOMETRIC_KEYCHAIN_SERVICE =
  'com.coralxyz.backpack.mobilewallet.masterpassword.biometric';
const BIOMETRIC_PREFERENCE_KEY = '@wallet:biometricPreference';
const LOCK_STATE_KEY = '@wallet:pinLockState';
const LOCK_WINDOWS_MS = [30_000, 120_000, 600_000];
const MAX_FAILED_ATTEMPTS = 5;
const PIN_KDF_ITERATIONS = 250_000;

interface LockState {
  failedAttempts: number;
  lockUntil?: number | null;
}

interface PinConfig {
  salt: string;
  hash: string;
  iterations: number;
}

export class PinLockoutError extends Error {
  remainingMs: number;

  constructor(remainingMs: number) {
    super('PIN entry temporarily locked');
    this.remainingMs = remainingMs;
  }
}

export class AuthManager {
  static async hasPin(): Promise<boolean> {
    const config = await Keychain.getGenericPassword({ service: PIN_CONFIG_SERVICE });
    return Boolean(config);
  }

  static async isBiometricEnabled(): Promise<boolean> {
    const pref = await AsyncStorage.getItem(BIOMETRIC_PREFERENCE_KEY);
    return pref === 'true';
  }

  static async isBiometricSupported(): Promise<boolean> {
    const type = await Keychain.getSupportedBiometryType();
    return Boolean(type);
  }

  static async setupPin(pin: string, password: string): Promise<void> {
    AuthManager.assertValidPin(pin);

    const salt = randomBytes(16);
    const derived = await AuthManager.derivePinHash(pin, salt, PIN_KDF_ITERATIONS);
    const config: PinConfig = {
      salt: Buffer.from(salt).toString('base64'),
      hash: Buffer.from(derived).toString('base64'),
      iterations: PIN_KDF_ITERATIONS,
    };

    await Keychain.setGenericPassword('pin', JSON.stringify(config), {
      service: PIN_CONFIG_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    await AuthManager.storeMasterPassword(password);
    await AuthManager.clearLockState();
  }

  static async clearSecurityState(): Promise<void> {
    await AsyncStorage.multiRemove([
      BIOMETRIC_PREFERENCE_KEY,
      LOCK_STATE_KEY,
    ]);
    await Keychain.resetGenericPassword({ service: PIN_CONFIG_SERVICE });
    await Keychain.resetGenericPassword({ service: MASTER_PASSWORD_SERVICE });
    await Keychain.resetGenericPassword({ service: BIOMETRIC_KEYCHAIN_SERVICE });
  }

  static async unlockWithPin(pin: string): Promise<string> {
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

  static async enableBiometrics(password: string): Promise<void> {
    await Keychain.setGenericPassword('wallet', password, {
      service: BIOMETRIC_KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
    });
    await AsyncStorage.setItem(BIOMETRIC_PREFERENCE_KEY, 'true');
  }

  static async disableBiometrics(): Promise<void> {
    await Keychain.resetGenericPassword({ service: BIOMETRIC_KEYCHAIN_SERVICE });
    await AsyncStorage.setItem(BIOMETRIC_PREFERENCE_KEY, 'false');
  }

  static async unlockWithBiometrics(): Promise<string> {
    const biometricEnabled = await AuthManager.isBiometricEnabled();
    if (!biometricEnabled) {
      throw new Error('Biometrics not enabled');
    }

    const credentials = await Keychain.getGenericPassword({
      service: BIOMETRIC_KEYCHAIN_SERVICE,
      authenticationPrompt: {
        title: 'Authenticate to unlock backpack',
        description: 'Use biometrics to restore wallet access',
      },
    });

    if (!credentials) {
      throw new Error('Biometric authentication was cancelled');
    }

    await AuthManager.clearLockState();
    return credentials.password;
  }

  private static assertValidPin(pin: string) {
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be a 6-digit number');
    }
  }

  private static async getLockState(): Promise<LockState> {
    const raw = await AsyncStorage.getItem(LOCK_STATE_KEY);
    if (!raw) {
      return { failedAttempts: 0, lockUntil: null };
    }
    try {
      return JSON.parse(raw) as LockState;
    } catch {
      return { failedAttempts: 0, lockUntil: null };
    }
  }

  private static async saveLockState(state: LockState): Promise<void> {
    await AsyncStorage.setItem(LOCK_STATE_KEY, JSON.stringify(state));
  }

  private static async clearLockState(): Promise<void> {
    await AuthManager.saveLockState({ failedAttempts: 0, lockUntil: null });
  }

  private static async ensureNotLocked(): Promise<void> {
    const state = await AuthManager.getLockState();
    if (state.lockUntil && state.lockUntil > Date.now()) {
      throw new PinLockoutError(state.lockUntil - Date.now());
    }
    if (state.lockUntil && state.lockUntil <= Date.now()) {
      await AuthManager.clearLockState();
    }
  }

  private static async registerFailedAttempt(): Promise<void> {
    const state = await AuthManager.getLockState();
    const failedAttempts = state.failedAttempts + 1;
    let lockUntil: number | null = null;

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const tier = Math.min(
        LOCK_WINDOWS_MS.length - 1,
        Math.floor((failedAttempts - MAX_FAILED_ATTEMPTS) / MAX_FAILED_ATTEMPTS)
      );
      lockUntil = Date.now() + LOCK_WINDOWS_MS[tier];
    }

    await AuthManager.saveLockState({ failedAttempts, lockUntil });
  }

  private static async getPinConfig(): Promise<PinConfig> {
    const credentials = await Keychain.getGenericPassword({ service: PIN_CONFIG_SERVICE });
    if (!credentials) {
      throw new Error('PIN is not configured');
    }
    return JSON.parse(credentials.password) as PinConfig;
  }

  private static async derivePinHash(
    pin: string,
    salt: Uint8Array,
    iterations: number
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      Crypto.pbkdf2(pin, Buffer.from(salt), iterations, 32, 'sha256', (err: Error, key) =>
        err ? reject(err) : resolve(key)
      );
    });
  }

  private static async verifyPin(pin: string, config: PinConfig): Promise<void> {
    const salt = Buffer.from(config.salt, 'base64');
    const expectedHash = Buffer.from(config.hash, 'base64');
    const derived = await AuthManager.derivePinHash(pin, salt, config.iterations);
    if (
      expectedHash.length !== derived.length ||
      !Crypto.timingSafeEqual(expectedHash, derived)
    ) {
      throw new Error('Invalid PIN');
    }
  }

  private static async storeMasterPassword(password: string): Promise<void> {
    await Keychain.setGenericPassword('wallet', password, {
      service: MASTER_PASSWORD_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  private static async getMasterPassword(): Promise<string> {
    const credentials = await Keychain.getGenericPassword({
      service: MASTER_PASSWORD_SERVICE,
    });
    if (!credentials) {
      throw new Error('Master password not found');
    }
    return credentials.password;
  }
}
