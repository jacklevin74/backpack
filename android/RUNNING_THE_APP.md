# Running the Backpack UI Only App on Android

This document describes the steps to run the app on a physical Android device using ADB.

## Prerequisites

- Android SDK installed at `~/android-sdk`
- Android device connected via ADB (USB or wireless)
- Node.js and npm installed
- Expo CLI

## Setup Environment

```bash
export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
```

## Running the App

### Method 1: Development Build with Live Reload

1. **Connect Android device**

   ```bash
   adb devices
   ```

   Should show your device (e.g., `192.168.1.203:5555`)

2. **Set up port forwarding**

   ```bash
   adb reverse tcp:8081 tcp:8081
   ```

3. **Start Expo server**

   ```bash
   npx expo start --host lan
   ```

4. **Build and install (first time or after native changes)**

   ```bash
   cd android
   ./gradlew assembleDebug
   cd ..
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

5. **Launch the app**
   ```bash
   adb shell am start -n com.anonymous.backpackuionly/.MainActivity
   ```

### Method 2: Quick Start (App Already Installed)

If the app is already installed on your device:

1. **Connect device and set up port forwarding**

   ```bash
   export ANDROID_HOME=~/android-sdk
   export PATH=$ANDROID_HOME/platform-tools:$PATH
   adb reverse tcp:8081 tcp:8081
   ```

2. **Start Expo server**

   ```bash
   npx expo start --host lan
   ```

3. **Launch the app**
   ```bash
   adb shell am start -n com.anonymous.backpackuionly/.MainActivity
   ```

### Method 3: Full Rebuild and Install

When you need to rebuild everything:

1. **Stop any running servers**

   ```bash
   killall node 2>/dev/null
   killall -9 node 2>/dev/null
   lsof -ti:8081 | xargs kill -9 2>/dev/null
   ```

2. **Clean build**

   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

3. **Build APK**

   ```bash
   cd android
   ./gradlew assembleDebug
   cd ..
   ```

4. **Force stop old app**

   ```bash
   adb shell am force-stop com.anonymous.backpackuionly
   ```

5. **Reinstall APK**

   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

6. **Start server and launch**
   ```bash
   npx expo start --host lan
   adb shell am start -n com.anonymous.backpackuionly/.MainActivity
   ```

## Useful Commands

### Check device connection

```bash
adb devices
```

### Connect to device over WiFi

```bash
adb tcpip 5555
adb connect 192.168.1.203:5555
```

### View logs

```bash
adb logcat
```

### Filter logs for React Native/Expo

```bash
adb logcat | grep -E "ReactNative|Expo|Error|Exception"
```

### Open React Native dev menu

```bash
adb shell input keyevent 82
```

### Force stop app

```bash
adb shell am force-stop com.anonymous.backpackuionly
```

### Uninstall app

```bash
adb uninstall com.anonymous.backpackuionly
```

### List installed packages

```bash
adb shell pm list packages | grep backpack
```

## Troubleshooting

### Grey screen or app not loading

1. Check Metro bundler is running
2. Verify port forwarding: `adb reverse tcp:8081 tcp:8081`
3. Force stop and restart app
4. Rebuild and reinstall APK

### Connection issues

1. Verify device is connected: `adb devices`
2. Reconnect device: `adb connect <device-ip>:5555`
3. Check firewall settings
4. Ensure device and computer are on same network

### Build errors

1. Clean build: `cd android && ./gradlew clean`
2. Clear Metro cache: `rm -rf .metro-cache`
3. Reinstall dependencies: `npm install`

## Package Information

- **Package name**: `com.anonymous.backpackuionly`
- **Main activity**: `.MainActivity`
- **APK location**: `android/app/build/outputs/apk/debug/app-debug.apk`

## Notes

- The app connects to Metro bundler for live reload in development
- After native code changes, you must rebuild the APK
- JavaScript-only changes can be hot reloaded
- Use `--host lan` to make the server accessible over network
