# Running Expo Debug App on Android Phone

This guide explains how to build and run the Android app in debug mode using Expo on a physical device.

## Prerequisites

- Android device connected via USB or WiFi ADB
- Android SDK installed at `~/android-sdk`
- Node.js and npm/yarn installed
- Expo CLI installed globally or via npx

## Quick Start

### Method 1: Using `npx expo run:android` (Recommended)

This is the easiest method as it handles building, installing, and launching automatically:

```bash
cd /home/jack/backpack/android

# Set Android SDK environment variables
export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH

# Build and run on connected device
npx expo run:android
```

**What this does:**

- Builds the debug APK
- Installs it on your connected device
- Launches the app
- Starts Metro bundler automatically
- Connects app to Metro for hot reload

### Method 2: Manual Build and Run

If you prefer more control over the process:

```bash
cd /home/jack/backpack/android

# 1. Set up ADB port forwarding for Metro
export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
adb reverse tcp:8081 tcp:8081

# 2. Start Metro bundler (in a separate terminal or background)
npx expo start --clear

# 3. Build debug APK
cd android
./gradlew assembleDebug

# 4. Install on device
adb install -r app/build/outputs/apk/debug/app-debug.apk

# 5. Launch the app
adb shell am start -n com.anonymous.backpackuionly/.MainActivity
```

## Setup Steps

### 1. Connect Your Android Device

#### Via USB:

```bash
# Enable USB debugging on your phone:
# Settings → Developer Options → USB Debugging

# Check if device is connected
adb devices
```

#### Via WiFi:

```bash
# First connect via USB, then:
adb tcpip 5555
adb connect <DEVICE_IP>:5555

# Example:
adb connect 192.168.1.203:5555

# Verify connection
adb devices
```

### 2. Set Environment Variables

Add to your `~/.bashrc` or `~/.zshrc` for persistence:

```bash
export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
```

Or set them in the current session:

```bash
export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
```

### 3. Build and Run

```bash
cd /home/jack/backpack/android
npx expo run:android
```

## What Happens During Build

1. **Gradle Build**: Compiles native code and dependencies
2. **JavaScript Bundle**: Metro bundler creates the JS bundle
3. **APK Creation**: Packages everything into a debug APK
4. **Installation**: Installs APK on connected device
5. **Launch**: Opens the app automatically
6. **Metro Connection**: App connects to Metro for hot reload

## Development Workflow

### Hot Reload

Once the app is running:

- **Automatic**: Changes to JavaScript files automatically reload
- **Manual Reload**: Shake device → "Reload" or press `r` in Metro terminal
- **Debug Menu**: Shake device or `adb shell input keyevent 82`

### Making Changes

1. Edit JavaScript files in `android/App.js` or other components
2. Save the file
3. App automatically reloads with changes
4. For native code changes, rebuild: `npx expo run:android`

### Viewing Logs

```bash
# View all logs
adb logcat

# Filter for React Native/Expo logs
adb logcat | grep -E "ReactNative|Expo|Error|Exception"

# View Metro bundler logs
# (Check the terminal where Metro is running)
```

## Troubleshooting

### Issue: "Failed to resolve the Android SDK path"

**Solution:**

```bash
export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
```

### Issue: "spawn adb ENOENT"

**Solution:**

```bash
# Ensure ADB is in PATH
export PATH=$ANDROID_HOME/platform-tools:$PATH

# Verify ADB works
adb version
```

### Issue: Device Not Detected

**Solution:**

```bash
# Restart ADB server
adb kill-server
adb start-server

# Check devices
adb devices

# If still not showing, check:
# - USB debugging is enabled on device
# - USB cable is connected
# - Device drivers are installed
```

### Issue: App Won't Connect to Metro

**Solution:**

```bash
# Set up port forwarding
adb reverse tcp:8081 tcp:8081

# Restart Metro bundler
# Kill existing Metro: lsof -ti:8081 | xargs kill -9
npx expo start --clear

# Reload app
adb shell am force-stop com.anonymous.backpackuionly
adb shell am start -n com.anonymous.backpackuionly/.MainActivity
```

### Issue: Build Fails

**Solution:**

```bash
# Clean build
cd android
./gradlew clean

# Clear Metro cache
rm -rf .expo
rm -rf node_modules/.cache

# Rebuild
cd ..
npx expo run:android
```

### Issue: Gray Screen or App Won't Load

**Solution:**

```bash
# 1. Check Metro is running
curl http://localhost:8081/status

# 2. Verify port forwarding
adb reverse tcp:8081 tcp:8081

# 3. Force stop and restart app
adb shell am force-stop com.anonymous.backpackuionly
adb shell am start -n com.anonymous.backpackuionly/.MainActivity

# 4. If still not working, rebuild
npx expo run:android
```

## Useful Commands

### App Management

```bash
# Force stop app
adb shell am force-stop com.anonymous.backpackuionly

# Launch app
adb shell am start -n com.anonymous.backpackuionly/.MainActivity

# Uninstall app
adb uninstall com.anonymous.backpackuionly

# Open React Native debug menu
adb shell input keyevent 82
```

### Metro Bundler

```bash
# Start Metro with cleared cache
npx expo start --clear

# Start Metro on LAN (for WiFi debugging)
npx expo start --host lan

# Kill Metro bundler
lsof -ti:8081 | xargs kill -9
```

### ADB Commands

```bash
# List connected devices
adb devices

# Port forwarding for Metro
adb reverse tcp:8081 tcp:8081

# View app logs
adb logcat | grep -E "ReactNative|Expo"

# Take screenshot
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png
```

## Package Information

- **Package Name**: `com.anonymous.backpackuionly`
- **Main Activity**: `.MainActivity`
- **Debug APK Location**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Metro Port**: `8081`

## Build Times

- **First Build**: ~2-5 minutes (depends on system)
- **Subsequent Builds**: ~20-30 seconds (incremental builds)
- **Hot Reload**: Instant (JavaScript changes only)

## Notes

- Debug builds are larger and slower than release builds
- Debug builds include debugging symbols and source maps
- Hot reload only works for JavaScript changes
- Native code changes require a full rebuild
- Metro bundler must be running for hot reload to work
- The app automatically connects to Metro on launch

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Debugging](https://reactnative.dev/docs/debugging)
- [Android ADB Guide](https://developer.android.com/studio/command-line/adb)
