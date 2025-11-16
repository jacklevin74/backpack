# Maestro E2E Tests for Backpack Mobile Wallet

Maestro tests for critical user flows in the Backpack mobile wallet app.

## Prerequisites

1. **Maestro CLI installed** (already done!)

   ```bash
   export PATH="$PATH":"$HOME/.maestro/bin"
   ```

2. **Device connected** via ADB or running emulator

3. **App installed** on the device

## Test Flows

### 1. Network Switching (`network-switching.yaml`)

Tests switching between X1 Mainnet, X1 Testnet, and Solana networks.

**What it catches:**

- ✅ Broken network selector buttons
- ✅ UI elements blocking network options
- ✅ Network switch not actually changing
- ✅ Token symbol not updating

**This would have caught your Solana button bug!**

### 2. Wallet Creation (`wallet-creation.yaml`)

Tests creating a new wallet and verifying it appears in the list.

**What it catches:**

- ✅ Wallet creation UI issues
- ✅ Wallet not appearing after creation
- ✅ Selection not working

### 3. Browser Integration (`browser-integration.yaml`)

Tests the WebView browser with window.x1 wallet API.

**What it catches:**

- ✅ WebView not loading
- ✅ window.x1 API not working
- ✅ Connect/sign buttons not functional

### 4. Send Transaction (`send-transaction.yaml`)

Tests the complete send transaction flow.

**What it catches:**

- ✅ Send button not working
- ✅ Amount input issues
- ✅ Fee calculation errors
- ✅ Transaction not actually sending

### 5. Ledger Connection (`ledger-connection.yaml`)

Tests Ledger hardware wallet BLE connection.

**What it catches:**

- ✅ BLE scan not starting
- ✅ Connection UI issues
- ✅ Device pairing problems

## Running Tests

### Run a single test:

```bash
cd /home/jack/backpack/backpack-ui-only
maestro test .maestro/network-switching.yaml
```

### Run all tests:

```bash
cd /home/jack/backpack/backpack-ui-only
maestro test .maestro/
```

### Run with device selection:

```bash
# List connected devices
adb devices

# Run on specific device
maestro --device SM02G4061979385 test .maestro/network-switching.yaml
```

### Run and record video:

```bash
maestro test --format junit .maestro/network-switching.yaml
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Maestro Tests
  run: |
    export PATH="$PATH":"$HOME/.maestro/bin"
    maestro test .maestro/
```

### Before Each Release

```bash
# Run all critical flows
maestro test .maestro/network-switching.yaml
maestro test .maestro/send-transaction.yaml
maestro test .maestro/browser-integration.yaml
```

## Debugging Failed Tests

1. **See what Maestro sees:**

   ```bash
   maestro studio
   ```

   This opens an interactive UI where you can see exactly what elements are visible.

2. **Add screenshots to flows:**

   ```yaml
   - takeScreenshot: "before-network-switch"
   - tapOn: "Solana"
   - takeScreenshot: "after-network-switch"
   ```

3. **Use `maestro hierarchy` to see element tree:**
   ```bash
   maestro hierarchy
   ```

## Tips

- **Tests should be fast** - aim for <30 seconds per flow
- **Tests should be independent** - each test should work in isolation
- **Use descriptive assertions** - helps debug when they fail
- **Run tests before every PR** - catch bugs early

## Test Coverage

Current coverage:

- ✅ Network switching
- ✅ Wallet creation
- ✅ Browser/WebView
- ✅ Send transactions
- ✅ Ledger connection

Future tests to add:

- Import wallet via seed phrase
- Transaction history
- Multiple wallet selection
- Settings screens
- Error handling flows

## Example Output

```
✅ network-switching.yaml
   ✓ Launch app
   ✓ Verify X1 Mainnet visible
   ✓ Switch to X1 Testnet
   ✓ Switch to Solana  ← This would FAIL if button is broken!
   ✓ Switch back to X1 Mainnet

   Test passed in 12.3s
```

## When a Test Fails

Maestro will show you:

1. Which step failed
2. Screenshot of the screen at that moment
3. Expected vs actual state
4. Full device logs

This makes it very easy to understand what broke and why!
