# Android Deployment Notes

This document details the process of building and deploying the Android application, including troubleshooting steps encountered during the process.

## 1. Initial Attempt (Debug APK with Metro)

**Objective:** Build and deploy the debug APK with Metro bundler running.

**Steps Taken:**

1.  Started Metro Bundler in the background using `cd android && npx expo start --host lan &`.
2.  Built the debug APK using `cd android/android && ./gradlew assembleDebug`.
3.  Attempted to deploy using `adb shell am force-stop com.anonymous.backpackuionly && adb install -r android/android/app/build/outputs/apk/debug/app-debug.apk && adb reverse tcp:8081 tcp:8081 && adb shell am start -n com.anonymous.backpackuionly/.MainActivity`.

**Issue:** The `adb` command was not found, resulting in an `Exit Code: 127`. The Metro Bundler processes were subsequently terminated.

**Resolution:**

- Located the `adb` executable at `/home/jack/android-sdk/platform-tools/adb`.
- Future `adb` commands were executed using the full path or by setting an `ADB` environment variable.

## 2. Deploying Release APK (Troubleshooting and Fixes)

**Objective:** Clear Metro cache, build the release APK, and install it on the device.

**Steps Taken:**

1.  **Cache Cleaning:**

    - Removed Metro-related caches: `rm -rf android/.expo android/node_modules/.cache/babel-loader android/node_modules/.cache/metro-cache`.
    - Executed Gradle clean: `cd android/android && ./gradlew clean`. This initial clean failed with CMake errors.

2.  **Troubleshooting Clean Build Failure:**

    - **Issue:** The `gradlew clean` command failed with `CMake Error` messages, indicating missing directories related to `codegen` and `add_subdirectory given source ... which is not an existing directory`. This suggested stale CMake caches were causing issues.
    - **Resolution:** Performed a deeper clean by manually removing the `.cxx` and build directories: `rm -rf android/android/app/.cxx android/android/app/build android/android/build`.
    - Re-ran Gradle clean successfully: `cd android/android && ./gradlew clean`.

3.  **Building Release APK:**

    - Initiated the release APK build: `cd android/android && ./gradlew assembleRelease`.
    - **Issue:** The build failed during the `createBundleReleaseJsAndAssets` task with a `SyntaxError: Unexpected token (1740:14)` in `/home/jack/backpack/android/App.js`. Closer inspection of the raw build log suggested interleaved console output from other build processes, making it appear as if the file contained garbage data like `rm64-v8a]` and `leReleaseKotlin`.
    - **Root Cause Analysis:** Upon reading `android/App.js` around the indicated line, it was determined there was a missing closing brace `}` in the JavaScript code, causing a syntax error in the bundling process. Specifically, a `catch` block was not properly closed before an `else` block for the main `if/else` logic.
    - **Resolution:** A missing closing brace `}` was added to `android/App.js` at the appropriate location using the `replace` tool.

4.  **Rebuilding and Installing Release APK:**
    - After fixing the syntax error, the build process was re-initiated with a quick clean of `app/build` to ensure the new JS bundle was created: `rm -rf android/android/app/build && cd android/android && ./gradlew assembleRelease`.
    - The build completed successfully.
    - The release APK was installed and launched on the device: `export ADB=/home/jack/android-sdk/platform-tools/adb && $ADB install -r android/android/app/build/outputs/apk/release/app-release.apk && $ADB shell am start -n com.anonymous.backpackuionly/.MainActivity`.

## Summary of Key Differences from Standard Instructions:

- **`adb` Path:** The `adb` command was not in PATH, requiring the full path (`/home/jack/android-sdk/platform-tools/adb`) to be explicitly used or stored in an environment variable.
- **Deep Clean for Gradle:** Resolved a `CMake Error` during `gradlew clean` by manually deleting `.cxx` and `build` directories in `android/android/app/`.
- **Syntax Error Fix:** Addressed a specific `SyntaxError` in `android/App.js` by inserting a missing closing brace.
- **Metro Bundler:** The Metro bundler was not continuously run; instead, the build process for release APKs handled JS bundling internally. For debug builds with Metro, `npx expo start --host lan` would be necessary.
