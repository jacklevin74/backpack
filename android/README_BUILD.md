# Backpack UI Only - Build Guide

Quick reference for building and deploying the Backpack wallet application.

## Quick Start

### Build Release APK (Recommended)

Use the automated build script:

```bash
cd /home/jack/backpack/backpack-ui-only
./build-release.sh
```

This will:

- Check requirements
- Clean previous builds
- Build the release APK
- Copy to ~/Downloads
- Optionally install on connected device

### Manual Build

```bash
cd /home/jack/backpack/backpack-ui-only/android
./gradlew clean
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Installation

### Install on Device

```bash
~/android-sdk/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### Reload App After Code Changes

```bash
~/android-sdk/platform-tools/adb shell am force-stop com.anonymous.backpackuionly
~/android-sdk/platform-tools/adb shell am start -n com.anonymous.backpackuionly/.MainActivity
```

## Development

### Start Metro Bundler

```bash
cd /home/jack/backpack/backpack-ui-only
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.61 npx expo start --clear
```

### Setup ADB Reverse

```bash
~/android-sdk/platform-tools/adb reverse tcp:8081 tcp:8081
```

### Kill Metro Bundler

```bash
lsof -ti:8081 | xargs kill -9
```

## Testing

### Run Maestro Tests

```bash
export PATH="$PATH":"$HOME/.maestro/bin"
maestro test .maestro/send-transaction-flow.yaml
maestro test .maestro/wallet-dropdown.yaml
```

### Run All Tests

```bash
maestro test .maestro/
```

## Troubleshooting

### Metro Bundler Issues

```bash
# Kill existing bundler
lsof -ti:8081 | xargs kill -9

# Clear cache and restart
cd /home/jack/backpack/backpack-ui-only
rm -rf node_modules
yarn install
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.61 npx expo start --clear
```

### Build Issues

```bash
# Clean everything
cd android
./gradlew clean
./gradlew --stop
rm -rf build app/build

# Rebuild
./gradlew assembleRelease
```

### ADB Connection Issues

```bash
# Restart ADB
~/android-sdk/platform-tools/adb kill-server
~/android-sdk/platform-tools/adb start-server

# Check devices
~/android-sdk/platform-tools/adb devices
```

## Documentation

- **BUILD_RELEASE.md** - Complete build documentation with all options and troubleshooting
- **build-release.sh** - Automated build script

## Project Structure

```
backpack-ui-only/
├── App.js                 # Main application code
├── android/              # Android native code
│   ├── app/
│   └── build.gradle
├── .maestro/            # E2E tests
│   ├── send-transaction-flow.yaml
│   └── wallet-dropdown.yaml
├── build-release.sh     # Build automation script
├── BUILD_RELEASE.md     # Detailed build guide
└── README_BUILD.md      # This file
```

## Quick Commands Reference

```bash
# Build release
./build-release.sh

# Build for CI
./build-release.sh --ci

# Install on device
adb install -r android/app/build/outputs/apk/release/app-release.apk

# Reload app
adb shell am force-stop com.anonymous.backpackuionly && \
adb shell am start -n com.anonymous.backpackuionly/.MainActivity

# Run test
maestro test .maestro/send-transaction-flow.yaml

# Start development
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.61 npx expo start --clear
```

## Notes

- Default Android SDK location: `~/android-sdk`
- Default device IP for Metro: `192.168.1.61`
- Build time: ~3-5 minutes
- APK size: ~25-50 MB (varies by build configuration)
