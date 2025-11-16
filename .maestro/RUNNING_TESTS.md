# How to Run Maestro Tests

## Prerequisites

Make sure your Android device is connected via ADB and the app is installed.

## Running Tests

### Run a single test:

```bash
maestro test .maestro/receive-button.yaml
```

### Run all tests in the directory:

```bash
maestro test .maestro/
```

### Run specific tests:

```bash
# Test that wallet selector shows wallet list
maestro test .maestro/wallet-selector.yaml

# Test that receive button is tappable
maestro test .maestro/receive-button.yaml

# Test that send screen shows balance
maestro test .maestro/send-balance.yaml

# Simple smoke test
maestro test .maestro/smoke-test.yaml
```

## Test Results

### View results in terminal

The test output will show in the terminal with ✓ for passed steps and ✗ for failed steps.

### View HTML reports

After each test run, Maestro generates an HTML report:

```bash
# Find the latest test report
ls -lt ~/.maestro/tests/

# Open the HTML report in browser (copy this URL to your browser)
file://$(ls -t ~/.maestro/tests/*/ai-report-*.html | head -1)
```

Or directly access reports:

```
file:///home/jack/.maestro/tests/[timestamp]/ai-report-[test-name].html
```

### View screenshots

Screenshots are saved in the test output directory:

```bash
# List all screenshots from latest test
ls -lh ~/.maestro/tests/$(ls -t ~/.maestro/tests/ | head -1)/screenshot*.png
```

## Understanding Test Results

- ✅ COMPLETED - Step passed successfully
- ❌ FAILED - Step failed (test will stop here)
- Screenshots are automatically captured at each step
- Failed tests include a screenshot showing where it failed

## Continuous Integration

To run tests in CI/CD, add to your pipeline:

```yaml
- name: Run Maestro Tests
  run: |
    export PATH="$PATH":"$HOME/.maestro/bin"
    maestro test .maestro/
```

## Tips

1. Tests run on the actual device/emulator
2. Keep tests focused on user journeys
3. Use screenshots to debug failures
4. Update element selectors if UI changes
5. Add `waitForAnimationToEnd` after taps and navigation
