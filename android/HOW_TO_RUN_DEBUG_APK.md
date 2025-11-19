# How to Build and Run Debug APK on Android Device

## Prerequisites

- Android device connected via USB
- `adb` installed and in PATH
- Metro bundler running (`npx expo start --host lan` in `android/` directory)

## 1. Build the APK

From the project root:

```bash
cd android/android
./gradlew assembleDebug
# OR to force rebuild:
./gradlew assembleDebug --rerun-tasks
```

## 2. Deploy to Device

From the project root (assuming `adb` is configured):

```bash
# 1. Uninstall/Force-stop old app (Optional but recommended)
adb shell am force-stop com.anonymous.backpackuionly

# 2. Install the new APK
adb install -r android/android/app/build/outputs/apk/debug/app-debug.apk

# 3. Connect Metro Bundler
adb reverse tcp:8081 tcp:8081

# 4. Launch the App
adb shell am start -n com.anonymous.backpackuionly/.MainActivity
```

## One-Liner for Deployment

```bash
adb shell am force-stop com.anonymous.backpackuionly && \
adb install -r android/android/app/build/outputs/apk/debug/app-debug.apk && \
adb reverse tcp:8081 tcp:8081 && \
adb shell am start -n com.anonymous.backpackuionly/.MainActivity
```
