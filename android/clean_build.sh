!#bin/sh
cd /Users/wei/projects/backpack-android-2/android/android && rm -rf app/.cxx app/build .gradle build && find . -name ".cxx" -type d -exec rm -rf {} + 2>/dev/null || true
