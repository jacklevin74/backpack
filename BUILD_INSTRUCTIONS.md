# Backpack Browser Extension - Build Instructions

## Overview

This document provides comprehensive instructions for building the Backpack browser extension from source.

---

## Prerequisites

### Required Software

- **Node.js**: v20.10.0 (exact version required)
- **Yarn**: v4.0.2 or higher
- **Git**: For version control
- **Bun** (optional): For faster builds

### Installing Node.js v20.10.0

Using nvm (recommended):

```bash
# Install nvm if not already installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 20.10.0
nvm install 20.10.0

# Use Node.js 20.10.0
nvm use 20.10.0

# Verify installation
node --version  # Should output: v20.10.0
```

### Installing Yarn

```bash
# Enable corepack (comes with Node.js)
corepack enable

# Verify yarn installation
yarn --version  # Should output: 4.0.2 or higher
```

---

## Quick Start

```bash
# 1. Ensure correct Node version
source ~/.nvm/nvm.sh
nvm use 20.10.0

# 2. Install dependencies
yarn install

# 3. Build the extension
./build-clean.sh
```

The built extension will be located at: `packages/app-extension/build/`

---

## Detailed Build Process

### Method 1: Using build-clean.sh (Recommended)

The `build-clean.sh` script performs a complete clean build:

```bash
./build-clean.sh
```

**What it does:**

1. Cleans all build caches:

   - `.turbo/` (Turborepo cache)
   - `node_modules/.cache/` (Module caches)
   - `packages/*/dist/` (Distribution folders)
   - `packages/*/.turbo/` (Package-level turbo caches)
   - `packages/*/build/` (Build outputs)

2. Builds packages using Bun (if available) or Yarn:

   - Builds all workspace packages in dependency order
   - Uses Turborepo for parallel builds
   - Caches successful builds for faster rebuilds

3. Verifies the build:

   - Checks manifest.json version matches source
   - Validates build artifacts exist

4. Updates timestamps on critical files

### Method 2: Manual Build

If you need more control:

```bash
# 1. Clean caches manually
rm -rf node_modules/.cache .turbo packages/*/dist packages/*/.turbo packages/*/build

# 2. Install dependencies
yarn install

# 3. Build all packages
yarn build

# Or build just the extension
npx turbo run build --filter=@coral-xyz/app-extension
```

### Method 3: Development Build

For faster development builds without cleaning:

```bash
# Build without cleaning cache
yarn build

# Or watch mode for development
cd packages/app-extension
yarn start
```

---

## Common Build Issues and Solutions

### Issue 1: Wrong Node Version

**Error:**

```
ERROR: React type incompatibilities
'View' cannot be used as a JSX component
```

**Solution:**

```bash
# Switch to Node 20.10.0
nvm use 20.10.0

# If not installed, install it first
nvm install 20.10.0
nvm use 20.10.0

# Verify
node --version
```

### Issue 2: Duplicate React Types

**Error:**

```
Type 'React.ReactNode' is not assignable to type
'import(".../react-test-renderer/.../@types/react/index").ReactNode'
```

**Solution:**

```bash
# Deduplicate React type packages
yarn dedupe "@types/react"
yarn dedupe "@types/react-dom"

# Reinstall dependencies
rm -rf node_modules
yarn install

# Rebuild
./build-clean.sh
```

### Issue 3: Build Cache Issues

**Symptoms:**

- Builds fail unexpectedly
- Changes not reflected in build output
- Stale dependencies

**Solution:**

```bash
# Method 1: Use build-clean.sh (cleans everything)
./build-clean.sh

# Method 2: Manual cache cleaning
rm -rf .turbo
rm -rf node_modules/.cache
rm -rf packages/*/.turbo
yarn install
yarn build
```

### Issue 4: Missing Dependencies

**Error:**

```
Cannot find module '@coral-xyz/...'
```

**Solution:**

```bash
# Clean reinstall
rm -rf node_modules
rm -rf yarn.lock  # Only if necessary
yarn install
```

### Issue 5: TypeScript Compilation Errors

**Error:**

```
TS2786: '...' cannot be used as a JSX component
```

**Solution:**
This usually indicates wrong Node version or duplicate types. Follow solutions for Issues 1 and 2.

---

## Build Output Structure

After successful build, the extension will be at:

```
packages/app-extension/build/
├── manifest.json          # Extension manifest (v3)
├── background.js          # Background service worker (3.6MB)
├── contentScript.js       # Content script injected into pages (350KB)
├── injected.js            # Provider injection script (3.4MB)
├── popup.html             # Extension popup HTML
├── popup.js               # Extension popup logic (17MB)
├── options.html           # Options page HTML
├── options.js             # Options page logic (17MB)
├── permissions.html       # Permissions page HTML
├── permissions.js         # Permissions page logic (667KB)
├── icons/                 # Extension icons
├── *.png                  # Logo assets (x1.png, solana.png)
└── *.js                   # Code-split chunks
```

---

## Loading the Extension in Chrome/Brave

### Step 1: Open Extension Management

```
chrome://extensions/
```

Or: Menu → More Tools → Extensions

### Step 2: Enable Developer Mode

Toggle "Developer mode" in the top-right corner.

### Step 3: Remove Old Version (if exists)

Click "Remove" on any existing Backpack extension.

### Step 4: Load Unpacked Extension

1. Click "Load unpacked"
2. Navigate to: `/home/jack/backpack/packages/app-extension/build`
3. Select the `build` folder
4. Click "Select"

### Step 5: Verify Installation

Check that:

- Extension name: "Backpack"
- Version: 0.10.61 (or your current version)
- Status: Enabled
- No errors shown

### Step 6: Test the Extension

1. **Close all browser tabs** (important for clean state)
2. Open a new tab
3. Click the Backpack extension icon
4. Verify the extension opens correctly

---

## Troubleshooting Extension Loading

### Issue: Extension Won't Load

**Symptoms:**

- "Manifest file is missing or unreadable"
- Extension icon grayed out

**Solution:**

```bash
# Verify build exists
ls -la packages/app-extension/build/

# Rebuild if necessary
./build-clean.sh

# Check manifest is valid JSON
cat packages/app-extension/build/manifest.json | jq '.'
```

### Issue: Old Version Still Showing

**Symptoms:**

- Changes not reflected
- Old features still present

**Solution:**

```bash
# 1. In Chrome: Remove the extension completely
# 2. Clear Chrome cache
rm -rf ~/.cache/google-chrome/*
rm -rf ~/.config/google-chrome/Default/Service\ Worker/*

# 3. Close Chrome completely
killall chrome

# 4. Rebuild
./build-clean.sh

# 5. Restart Chrome and reload extension
```

### Issue: Extension Crashes on Open

**Check Console:**

1. Right-click extension icon → "Inspect popup"
2. Check Console for errors
3. Look for:
   - Network errors (feature gates, RPC)
   - localStorage errors
   - React rendering errors

---

## Build Performance Tips

### Speed Up Builds

1. **Use Bun** (if available):

   ```bash
   curl -fsSL https://bun.sh/install | bash
   ./build-clean.sh  # Will automatically use Bun
   ```

2. **Skip unnecessary packages**:

   ```bash
   # Build only extension
   npx turbo run build --filter=@coral-xyz/app-extension
   ```

3. **Use Turbo cache**:

   ```bash
   # After first build, subsequent builds use cache
   yarn build  # Much faster than build-clean.sh
   ```

4. **Parallel builds**:
   Turborepo automatically parallelizes builds based on dependency graph.

### Build Times

- **First clean build**: ~1-2 minutes
- **Cached rebuild**: ~10-30 seconds
- **Watch mode** (development): Instant on file changes

---

## Environment Variables

The build process respects these environment variables:

```bash
# Production build (default for build-clean.sh)
NODE_ENV=production

# Development build (includes source maps, faster)
NODE_ENV=development

# Skip TypeScript type checking (faster but risky)
SKIP_TYPE_CHECK=true
```

---

## CI/CD Considerations

For automated builds:

```bash
#!/bin/bash
set -e  # Exit on error

# Ensure correct Node version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20.10.0

# Install dependencies
yarn install --frozen-lockfile

# Deduplicate types (prevent CI failures)
yarn dedupe "@types/react"
yarn dedupe "@types/react-dom"

# Build
./build-clean.sh

# Verify build output
test -f packages/app-extension/build/manifest.json || exit 1
```

---

## Package-Specific Build Info

### Workspace Structure

```
packages/
├── app-extension/        # Browser extension (main output)
├── background/           # Extension background logic
├── common/               # Shared utilities
├── data-components/      # Data fetching components
├── recoil/               # State management
├── secure-background/    # Secure background process
├── secure-clients/       # Secure client communications
├── secure-ui/            # Secure UI components
├── tamagui-core/         # UI component library
└── react-common/         # Common React components
```

### Build Order (handled by Turborepo)

1. `common`, `i18n`, `wallet-standard`
2. `secure-background`, `secure-clients`
3. `provider-core`, `recoil`, `tamagui-core`
4. `react-common`, `data-components`, `background`
5. `secure-ui`, `app-extension`

---

## Verification Checklist

After building, verify:

- [ ] Build completed without errors
- [ ] `packages/app-extension/build/` directory exists
- [ ] `manifest.json` version matches source
- [ ] All JS files present (background, popup, options, etc.)
- [ ] Assets copied (icons, PNGs)
- [ ] Extension loads in Chrome without errors
- [ ] Popup opens and displays correctly
- [ ] No console errors in extension popup

---

## Additional Resources

### Project Files

- `package.json` - Root package configuration
- `turbo.json` - Turborepo configuration
- `tsconfig.json` - TypeScript configuration
- `build-clean.sh` - Clean build script

### Webpack Configuration

- `packages/app-extension/webpack.config.js` - Production config
- `packages/app-extension/webpack.dev.config.js` - Development config

### Useful Commands

```bash
# Check which packages would be built
npx turbo run build --dry-run

# Build specific package
npx turbo run build --filter=@coral-xyz/tamagui

# Clear all Turbo caches
npx turbo run build --force

# Lint before building
yarn lint

# Format code
yarn format:all
```

---

## Getting Help

If you encounter issues not covered here:

1. **Check git history**: `git log --oneline -20`
2. **Check Node version**: `node --version` (must be 20.10.0)
3. **Check dependencies**: `yarn why <package-name>`
4. **Clean everything**:
   ```bash
   rm -rf node_modules yarn.lock .turbo packages/*/node_modules packages/*/dist
   nvm use 20.10.0
   yarn install
   ./build-clean.sh
   ```

---

## Build Script Reference

### build-clean.sh Options

The script currently has no command-line options but can be modified to support:

```bash
# Potential future enhancements:
./build-clean.sh --skip-cache-clean   # Don't clean caches
./build-clean.sh --dev                # Development build
./build-clean.sh --extension-only     # Build only extension
```

### Exit Codes

- `0` - Success
- `1` - Build failed or verification failed
- `129` - Process terminated (e.g., Ctrl+C)

---

**Last Updated**: November 10, 2025
**Version**: 0.10.61
**Node Version**: 20.10.0
