#!/bin/bash

# Backpack Extension - Clean Build Script
# This script forces a complete rebuild without any caching issues

set -e  # Exit on error

echo "=========================================="
echo "Backpack Extension - Clean Build"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current version from manifest
CURRENT_VERSION=$(grep -oP '"version":\s*"\K[^"]+' packages/app-extension/src/manifest.json)
echo -e "${BLUE}Current version:${NC} ${CURRENT_VERSION}"
echo ""

# Step 1: Clean all caches
echo -e "${YELLOW}Step 1: Cleaning build caches...${NC}"
rm -rf node_modules/.cache
rm -rf .turbo
rm -rf packages/*/dist
rm -rf packages/*/.turbo
rm -rf packages/*/build
echo -e "${GREEN}✓ Caches cleared${NC}"
echo ""

# Step 2: Build packages
echo -e "${YELLOW}Step 2: Building packages...${NC}"
echo -e "${BLUE}Using Bun for faster builds...${NC}"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Bun not found. Install with: curl -fsSL https://bun.sh/install | bash${NC}"
    echo -e "${YELLOW}Falling back to yarn...${NC}"
    yarn build --force
else
    BUNS_VERSION=$(bun --version)
    echo -e "  Bun version: ${BUNS_VERSION}"
    bun run build --force
fi

echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 3: Verify build
echo -e "${YELLOW}Step 3: Verifying build...${NC}"

BUILT_VERSION=$(grep -oP '"version":\s*"\K[^"]+' packages/app-extension/build/manifest.json)
BUILT_LOG_VERSION=$(grep -oP 'ext:0\.10\.\K[0-9]+' packages/app-extension/build/injected.js | head -1)

echo -e "  Manifest version: ${BUILT_VERSION}"
echo -e "  Log version: 0.10.${BUILT_LOG_VERSION}"

if [ "$BUILT_VERSION" = "$CURRENT_VERSION" ] && [ "$BUILT_LOG_VERSION" = "${CURRENT_VERSION##*.}" ]; then
    echo -e "${GREEN}✓ Build verification passed${NC}"
else
    echo -e "${RED}✗ Build verification failed - version mismatch${NC}"
    exit 1
fi
echo ""

# Step 4: Touch files to update timestamps
echo -e "${YELLOW}Step 4: Updating file timestamps...${NC}"
touch packages/app-extension/build/manifest.json
touch packages/app-extension/build/injected.js
touch packages/app-extension/build/contentScript.js
touch packages/app-extension/build/background.js
echo -e "${GREEN}✓ Timestamps updated${NC}"
echo ""

# Step 5: Display next steps
echo -e "${GREEN}=========================================="
echo -e "Build Complete!"
echo -e "==========================================${NC}"
echo ""
echo -e "${BLUE}Extension location:${NC}"
echo -e "  ${PWD}/packages/app-extension/build"
echo ""
echo -e "${BLUE}Next steps to load in Chrome:${NC}"
echo -e "  1. Open Chrome and go to: ${YELLOW}chrome://extensions/${NC}"
echo -e "  2. Enable ${YELLOW}Developer mode${NC} (toggle in top right)"
echo -e "  3. Click ${YELLOW}Remove${NC} on existing Backpack extension (if any)"
echo -e "  4. Click ${YELLOW}Load unpacked${NC}"
echo -e "  5. Select: ${YELLOW}${PWD}/packages/app-extension/build${NC}"
echo -e "  6. Verify version shows: ${YELLOW}${CURRENT_VERSION}${NC}"
echo -e "  7. ${RED}Close ALL browser tabs${NC} with test pages"
echo -e "  8. Open a ${YELLOW}new tab${NC} and test"
echo ""
echo -e "${BLUE}To clear Chrome cache (if still seeing old version):${NC}"
echo -e "  1. Close Chrome completely"
echo -e "  2. Run: ${YELLOW}rm -rf ~/.cache/google-chrome/*${NC}"
echo -e "  3. Run: ${YELLOW}rm -rf ~/.config/google-chrome/Default/Service\\ Worker/*${NC}"
echo -e "  4. Restart Chrome and reload extension"
echo ""
