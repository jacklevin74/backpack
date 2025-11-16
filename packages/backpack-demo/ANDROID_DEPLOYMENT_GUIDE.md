# Android Deployment Guide for Backpack Demo

## Overview
This guide documents the process of building and deploying the Backpack demo app to Android devices.

## Prerequisites

### 1. Android SDK Setup
```bash
export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
```

### 2. Phone Setup
- Enable Developer Options (tap Build Number 7 times in Settings > About Phone)
- Enable USB Debugging in Developer Options
- Connect phone via USB
- Change USB mode to "File Transfer" or "MTP"
- Authorize computer when prompted on phone

### 3. Verify Connection
```bash
~/android-sdk/platform-tools/adb devices
```
Should show your device with status "device"

## Building the APK

### Method 1: Using Expo (Current Setup)
```bash
cd /home/jack/backpack/packages/backpack-demo

# Build and install
export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
npx expo run:android
```

Output APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Method 2: Direct Gradle Build
```bash
cd /home/jack/backpack/packages/backpack-demo/android
export ANDROID_HOME=~/android-sdk
./gradlew assembleDebug
```

## Installing on Phone via USB

### Install APK
```bash
~/android-sdk/platform-tools/adb install -r /path/to/app-debug.apk
```

The `-r` flag reinstalls the app if it already exists.

### Launch App
```bash
# Method 1: Using monkey
~/android-sdk/platform-tools/adb shell monkey -p com.backpackdemo 1

# Method 2: Using am (activity manager)
~/android-sdk/platform-tools/adb shell am start -n com.backpackdemo/.MainActivity
```

### Check Installed Packages
```bash
~/android-sdk/platform-tools/adb shell pm list packages | grep backpack
```

## Metro Bundler Setup (for Development)

### Start Metro
```bash
cd /home/jack/backpack/packages/backpack-demo
npx expo start --clear
```

### Set up Port Forwarding
```bash
~/android-sdk/platform-tools/adb reverse tcp:8081 tcp:8081
```

This forwards the phone's port 8081 to the computer's Metro bundler.

## Viewing Logs

### Real-time Logs
```bash
~/android-sdk/platform-tools/adb logcat | grep -i reactnative
```

### Recent Logs Only
```bash
~/android-sdk/platform-tools/adb logcat -d | tail -100
```

### Filter by App
```bash
~/android-sdk/platform-tools/adb logcat | grep com.backpackdemo
```

## Common Issues and Solutions

### Issue 1: Device Not Detected
**Symptoms**: `adb devices` shows empty or "unauthorized"
**Solutions**:
1. Check USB debugging is enabled
2. Change USB mode to File Transfer
3. Revoke USB debugging authorizations and re-authorize
4. Restart adb: `~/android-sdk/platform-tools/adb kill-server && ~/android-sdk/platform-tools/adb start-server`

### Issue 2: Metro Connection Failed
**Symptoms**: App shows "Could not connect to Metro"
**Solutions**:
1. Ensure Metro is running: `npx expo start`
2. Set up reverse port: `~/android-sdk/platform-tools/adb reverse tcp:8081 tcp:8081`
3. Check firewall isn't blocking port 8081

### Issue 3: Crypto Errors (Current Problem)
**Symptoms**: `TypeError: Cannot read property 'S' of undefined`
**Root Cause**: Node.js crypto libraries (ed25519-hd-key, ethers, etc.) are incompatible with React Native's Hermes JavaScript engine
**Status**: UNRESOLVED
**Attempted Solutions**:
- Added metro.config.js with polyfills (crypto-browserify, stream-browserify, buffer)
- Downgraded React from 19.1.0 to 18.2.0
- Created minimal UI-only version (DemoApp-minimal.tsx)
- Removed crypto files from project
- Cleared caches (expo, metro, gradle)

**Potential Solutions**:
1. Use native Android crypto modules instead of JS libraries
2. Switch to React Native-compatible crypto libraries
3. Build as WebView-based wallet
4. Use expo-crypto exclusively (already attempted)

### Issue 4: Gradle Cache Corruption
**Symptoms**: `CorruptedCacheException`
**Solution**:
```bash
rm -rf ~/.gradle/caches/
```

### Issue 5: Java Version Mismatch
**Symptoms**: `Unsupported class file major version 65`
**Solution**: Ensure Java 17 is being used (Gradle 8.x requirement)

## Project Structure

```
backpack-demo/
├── App.js                    # Entry point (imports DemoApp-minimal)
├── index.js                  # Expo entry (calls registerRootComponent)
├── DemoApp-minimal.tsx       # UI-only version (no crypto)
├── DemoApp-simple.tsx        # Simplified with expo-crypto only
├── package.json              # Dependencies
├── metro.config.js           # Metro bundler config with polyfills
└── android/
    └── app/build/outputs/apk/debug/
        └── app-debug.apk     # Built APK
```

## Package IDs
- Current app: `com.backpackdemo`
- Other installed: `com.backpack.wallet`, `app.backpack.mobile.standalone`

## Copying APK to Downloads
```bash
cp android/app/build/outputs/apk/debug/app-debug.apk ~/Downloads/backpack-mobile-demo.apk
```

## Clean Build
```bash
# Clear all caches
rm -rf .expo
rm -rf node_modules/.cache
cd android && ./gradlew clean && cd ..

# Rebuild
export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
npx expo run:android --no-build-cache
```

## Current Status (2025-11-09)

**Working**:
- APK builds successfully
- APK installs on phone
- App launches
- Metro bundler connects

**Not Working**:
- App shows black screen on launch
- Crypto libraries throw runtime errors
- Cannot display crypto functionality

**Next Steps for Fixing**:
1. Completely remove all crypto dependencies from package.json
2. Use only UI components in DemoApp-minimal.tsx
3. OR implement crypto operations using native Android modules
4. OR use a different approach (WebView wallet)
