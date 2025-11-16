#!/bin/bash
set -e

echo "Building Simple Crypto Wallet APK..."

# Navigate to Android directory
cd android

# Clean build
./gradlew clean

# Build release APK
./gradlew assembleRelease

# Copy APK to root directory
cp app/build/outputs/apk/release/app-release.apk ../simple-crypto-wallet.apk

echo "APK built successfully: simple-crypto-wallet.apk"
