#!/bin/bash

# restart-metro.sh - Kills existing Metro bundler and restarts it with ADB reverse


# Clear caches
echo "🗑️  Clearing Metro and Expo caches..."
cd /home/jack/backpack/backpack-ui-only
rm -rf .expo node_modules/.cache .metro-cache 2>/dev/null || true
echo "✅ Caches cleared"

echo "🚀 Starting Metro bundler..."
npx expo start --clear --reset-cache &

# Wait for Metro to start
echo "⏳ Waiting for Metro to start..."
sleep 5

# Setup ADB reverse
echo "🔗 Setting up ADB reverse for port 8081..."
if ~/android-sdk/platform-tools/adb devices | grep -q "SM02G4061979385"; then
    ~/android-sdk/platform-tools/adb -s SM02G4061979385 reverse tcp:8081 tcp:8081
    echo "✅ ADB reverse configured for device SM02G4061979385"
else
    # Try without specific device if only one is connected
    DEVICE_COUNT=$(~/android-sdk/platform-tools/adb devices | grep -v "List" | grep "device$" | wc -l)
    if [ "$DEVICE_COUNT" -eq 1 ]; then
        ~/android-sdk/platform-tools/adb reverse tcp:8081 tcp:8081
        echo "✅ ADB reverse configured for connected device"
    else
        echo "⚠️  No device found or multiple devices connected"
        echo "   Please ensure device SM02G4061979385 is connected"
    fi
fi

echo ""
echo "✅ Metro bundler is running!"
echo "📱 You can now reload your app on the device"
echo ""
echo "To view Metro logs, check the background process or run:"
echo "   tail -f out.log"
