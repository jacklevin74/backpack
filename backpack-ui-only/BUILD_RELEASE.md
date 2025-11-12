# Building Release APK for Backpack UI Only

This guide explains how to build a production-ready release APK for the Backpack wallet application.

## Prerequisites

Before building, ensure you have:

- Node.js and Yarn installed
- Android SDK installed (ANDROID_HOME set to `~/android-sdk`)
- Java Development Kit (JDK) installed
- Metro bundler stopped (no other instances running)

## Build Methods

### Method 1: Using the Automated Script (Recommended)

The easiest way to build a release APK is using the automated script:

```bash
./build-release.sh
```

The script will:

1. Clean any previous builds
2. Install/update dependencies
3. Build the JavaScript bundle
4. Build the Android release APK
5. Output the APK location when complete

### Method 2: Manual Build Process

If you prefer to build manually or need to troubleshoot, follow these steps:

#### Step 1: Clean Previous Builds

```bash
cd /home/jack/backpack/backpack-ui-only/android
./gradlew clean
```

#### Step 2: Build the Release APK

```bash
cd /home/jack/backpack/backpack-ui-only/android
./gradlew assembleRelease
```

This process typically takes 3-5 minutes depending on your system.

#### Step 3: Locate the APK

After successful build, the APK will be located at:

```
/home/jack/backpack/backpack-ui-only/android/app/build/outputs/apk/release/app-release.apk
```

## Installing the Release APK

### On Physical Device (via ADB)

1. Connect your Android device via USB
2. Enable USB debugging on the device
3. Install the APK:

```bash
~/android-sdk/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### On Physical Device (Manual Transfer)

1. Copy the APK to your device:

```bash
cp android/app/build/outputs/apk/release/app-release.apk ~/Downloads/backpack-release.apk
```

2. Transfer the file to your Android device
3. Open the APK file on your device and install it

### On Emulator

```bash
~/android-sdk/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## Build Configuration

### Release Signing

The release APK is signed automatically using the keystore configuration in:

- `android/app/build.gradle`
- Keystore file location (if configured): `android/app/release.keystore`

### Build Variants

The project supports multiple build variants:

- **Debug**: Development build with debugging enabled
- **Release**: Production build, optimized and minified

## Troubleshooting

### Build Fails with "Daemon not running"

Kill all gradle daemons and try again:

```bash
./gradlew --stop
./gradlew clean
./gradlew assembleRelease
```

### Out of Memory Error

Increase gradle memory in `android/gradle.properties`:

```
org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
```

### Metro Bundler Conflicts

Ensure no Metro bundler is running:

```bash
lsof -ti:8081 | xargs kill -9
```

### Cache Issues

Clear all caches and rebuild:

```bash
cd /home/jack/backpack/backpack-ui-only
rm -rf android/app/build
rm -rf android/build
./gradlew clean
./gradlew assembleRelease
```

## Build Optimization

### Enabling ProGuard/R8

For smaller APK size and code obfuscation, ensure ProGuard/R8 is enabled in `android/app/build.gradle`:

```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### Reducing APK Size

1. Enable APK splitting by ABI in `android/app/build.gradle`
2. Remove unused resources
3. Use vector drawables instead of PNGs where possible
4. Enable ProGuard/R8 optimization

## Verifying the Build

After building, verify the APK:

```bash
# Check APK size
ls -lh android/app/build/outputs/apk/release/app-release.apk

# Inspect APK contents (requires Android SDK build-tools)
~/android-sdk/build-tools/*/aapt dump badging android/app/build/outputs/apk/release/app-release.apk
```

## Distribution

### For Testing

- Install directly via ADB (as shown above)
- Share APK file via file transfer

### For Production

- Upload to Google Play Console
- Use App Bundle format (`.aab`) for Play Store:
  ```bash
  ./gradlew bundleRelease
  ```
  Output: `android/app/build/outputs/bundle/release/app-release.aab`

## Version Management

Update version before building release:

1. Edit `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        versionCode 1
        versionName "1.0.0"
    }
}
```

2. Edit `package.json`:

```json
{
  "version": "1.0.0"
}
```

## Continuous Integration

For CI/CD pipelines, use the automated script:

```bash
./build-release.sh --ci
```

This will:

- Exit with proper error codes
- Log all output for debugging
- Skip interactive prompts

## Additional Resources

- [React Native Documentation](https://reactnative.dev/docs/signed-apk-android)
- [Android Developer Guide](https://developer.android.com/studio/build)
- [Gradle Build Guide](https://docs.gradle.org/current/userguide/userguide.html)

## Support

For build issues:

1. Check the build logs in `android/app/build/outputs/logs/`
2. Review error messages carefully
3. Ensure all dependencies are installed
4. Try cleaning and rebuilding from scratch
