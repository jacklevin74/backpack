#!/bin/bash

# Backpack UI Only - Release Build Script
# This script automates the process of building a production release APK

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/jack/backpack/backpack-ui-only"
ANDROID_DIR="${PROJECT_DIR}/android"
APK_OUTPUT="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"
FINAL_OUTPUT_DIR="${HOME}/Downloads"
CI_MODE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --ci)
            CI_MODE=true
            shift
            ;;
        --help|-h)
            echo "Usage: ./build-release.sh [options]"
            echo ""
            echo "Options:"
            echo "  --ci          Run in CI mode (non-interactive)"
            echo "  --help, -h    Show this help message"
            echo ""
            exit 0
            ;;
    esac
done

# Helper functions
print_step() {
    echo -e "${BLUE}==>${NC} ${1}"
}

print_success() {
    echo -e "${GREEN}✓${NC} ${1}"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} ${1}"
}

print_error() {
    echo -e "${RED}✗${NC} ${1}"
}

# Check if we're in the right directory
check_directory() {
    print_step "Checking directory..."
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Project directory not found: $PROJECT_DIR"
        exit 1
    fi
    cd "$PROJECT_DIR"
    print_success "In project directory: $PROJECT_DIR"
}

# Check for required tools
check_requirements() {
    print_step "Checking requirements..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_success "Node.js $(node --version) found"

    # Check Yarn
    if ! command -v yarn &> /dev/null; then
        print_error "Yarn is not installed"
        exit 1
    fi
    print_success "Yarn $(yarn --version) found"

    # Check Java
    if ! command -v java &> /dev/null; then
        print_error "Java is not installed"
        exit 1
    fi
    print_success "Java found"

    # Check ANDROID_HOME
    if [ -z "$ANDROID_HOME" ]; then
        export ANDROID_HOME="$HOME/android-sdk"
        print_warning "ANDROID_HOME not set, using default: $ANDROID_HOME"
    fi

    if [ ! -d "$ANDROID_HOME" ]; then
        print_error "Android SDK not found at: $ANDROID_HOME"
        exit 1
    fi
    print_success "Android SDK found at: $ANDROID_HOME"
}

# Kill any running Metro bundler
kill_metro() {
    print_step "Checking for running Metro bundler..."
    if lsof -ti:8081 &> /dev/null; then
        print_warning "Killing existing Metro bundler on port 8081..."
        lsof -ti:8081 | xargs kill -9 2>/dev/null || true
        sleep 1
        print_success "Metro bundler killed"
    else
        print_success "No Metro bundler running"
    fi
}

# Install/update dependencies
install_dependencies() {
    print_warning "This project is part of a monorepo."
    print_warning "Dependencies should be installed from the root directory: /home/jack/backpack"
    print_step "Skipping dependency installation"
    print_success "Dependencies assumed to be installed"
}

# Clean previous builds
clean_build() {
    print_step "Cleaning previous builds..."
    cd "$ANDROID_DIR"

    # Stop any gradle daemons
    ./gradlew --stop 2>/dev/null || true

    # Clean build directories
    if [ -d "app/build" ]; then
        rm -rf app/build
        print_success "Cleaned app/build directory"
    fi

    if [ -d "build" ]; then
        rm -rf build
        print_success "Cleaned build directory"
    fi

    # Run gradle clean
    ./gradlew clean
    print_success "Gradle clean completed"

    cd "$PROJECT_DIR"
}

# Build the release APK
build_apk() {
    print_step "Building release APK..."
    print_warning "This may take 3-5 minutes..."

    cd "$ANDROID_DIR"

    # Build release APK
    if ./gradlew assembleRelease; then
        print_success "APK build completed successfully!"
    else
        print_error "APK build failed"
        exit 1
    fi

    cd "$PROJECT_DIR"
}

# Verify the build
verify_build() {
    print_step "Verifying build..."

    if [ ! -f "$APK_OUTPUT" ]; then
        print_error "APK not found at expected location: $APK_OUTPUT"
        exit 1
    fi

    # Get APK size
    APK_SIZE=$(du -h "$APK_OUTPUT" | cut -f1)
    print_success "APK found: $APK_OUTPUT"
    print_success "APK size: $APK_SIZE"
}

# Copy APK to Downloads
copy_to_downloads() {
    print_step "Copying APK to Downloads folder..."

    # Generate filename with timestamp
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    FINAL_APK="${FINAL_OUTPUT_DIR}/backpack-release-${TIMESTAMP}.apk"

    cp "$APK_OUTPUT" "$FINAL_APK"
    print_success "APK copied to: $FINAL_APK"

    # Also create a symlink to latest
    LATEST_LINK="${FINAL_OUTPUT_DIR}/backpack-release-latest.apk"
    ln -sf "$FINAL_APK" "$LATEST_LINK"
    print_success "Latest link created: $LATEST_LINK"
}

# Offer to install on device
install_on_device() {
    if [ "$CI_MODE" = false ]; then
        print_step "Install on connected device? (y/n)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            print_step "Checking for connected devices..."

            ADB="${ANDROID_HOME}/platform-tools/adb"
            if [ ! -f "$ADB" ]; then
                print_error "adb not found at: $ADB"
                return
            fi

            # Check for devices
            DEVICE_COUNT=$("$ADB" devices | grep -v "List of devices" | grep "device$" | wc -l)

            if [ "$DEVICE_COUNT" -eq 0 ]; then
                print_error "No devices connected"
                return
            fi

            print_success "Found $DEVICE_COUNT device(s)"
            print_step "Installing APK..."

            if "$ADB" install -r "$APK_OUTPUT"; then
                print_success "APK installed successfully!"
            else
                print_error "Failed to install APK"
            fi
        fi
    fi
}

# Show build summary
show_summary() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}           BUILD COMPLETED SUCCESSFULLY!               ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BLUE}Release APK:${NC}      $APK_OUTPUT"
    echo -e "  ${BLUE}APK Size:${NC}         $(du -h "$APK_OUTPUT" | cut -f1)"
    echo -e "  ${BLUE}Downloads Copy:${NC}   ${FINAL_OUTPUT_DIR}/backpack-release-*.apk"
    echo ""
    echo -e "${YELLOW}Installation Instructions:${NC}"
    echo ""
    echo -e "  ${BLUE}On device (via ADB):${NC}"
    echo -e "    ~/android-sdk/platform-tools/adb install -r $APK_OUTPUT"
    echo ""
    echo -e "  ${BLUE}Manual transfer:${NC}"
    echo -e "    Transfer the APK to your device and install"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Main execution
main() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}         Backpack UI Only - Release Build             ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""

    # Run build steps
    check_directory
    check_requirements
    kill_metro
    install_dependencies
    clean_build
    build_apk
    verify_build
    copy_to_downloads
    install_on_device
    show_summary

    exit 0
}

# Run main function
main
