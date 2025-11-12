# Playwright E2E Tests for Browser Extension

This directory contains Playwright tests for the Backpack browser extension.

## Overview

Playwright tests allow you to:

- ✅ Verify the extension loads correctly
- ✅ Check that service workers are registered
- ✅ Test extension interactions with web pages
- ✅ Capture screenshots for debugging
- ✅ Run automated tests in CI/CD

## Setup

1. Install dependencies (already done):

   ```bash
   yarn add -D @playwright/test
   yarn playwright install chromium
   ```

2. Build the extension:
   ```bash
   yarn build
   ```

## Running Tests

### Run all tests

```bash
yarn e2e:playwright
```

### Run specific test file

```bash
yarn playwright test e2e/extension-basic.spec.ts
```

### Run with UI mode (interactive)

```bash
yarn e2e:playwright:ui
```

### Run with debugger

```bash
yarn e2e:playwright:debug
```

## Test Files

### `extension-basic.spec.ts`

Basic tests that verify:

- Extension loads successfully
- Service worker is registered
- Extension ID is generated correctly
- Extension can interact with web pages

### `extension-popup.spec.ts` (experimental)

Attempts to test the extension popup directly. Note: Playwright has limitations with opening extension popups directly.

## How It Works

1. **Extension Loading**: Tests use `chromium.launchPersistentContext()` with special Chrome flags:

   ```typescript
   const context = await chromium.launchPersistentContext(userDataDir, {
     headless: false,
     args: [
       `--disable-extensions-except=${pathToExtension}`,
       `--load-extension=${pathToExtension}`,
       "--no-sandbox",
     ],
   });
   ```

2. **Getting Extension ID**: The extension ID is extracted from the service worker URL:

   ```typescript
   const serviceWorkers = context.serviceWorkers();
   const extensionId = serviceWorkers[0].url().split("/")[2];
   ```

3. **Screenshots**: Tests automatically save screenshots to `e2e/screenshots/`

## Current Test Results

```
✓ extension loads successfully
✓ extension can interact with web pages

2 passed (10.9s)
```

## Limitations

- **Popup Testing**: Playwright cannot reliably open extension popups via `chrome-extension://` URLs. This is a known limitation.
- **Workaround**: Test extension behavior on regular web pages instead, or manually verify the popup at the URL shown in test output.

## Example Output

```
Loading extension from: /home/jack/backpack/packages/app-extension/build
✓ Found 1 service worker(s)
✓ Extension ID: jhlbmmmflolgejnkfiggbcikbjbniidi
✓ Screenshot saved: extensions-page.png
✓ chrome://extensions page loaded

✓✓✓ SUCCESS! Extension loaded correctly ✓✓✓

Extension ID: jhlbmmmflolgejnkfiggbcikbjbniidi
Extension path: /home/jack/backpack/packages/app-extension/build
You can manually open the popup at: chrome-extension://jhlbmmmflolgejnkfiggbcikbjbniidi/popup.html
```

## Screenshots

Screenshots are saved to `e2e/screenshots/`:

- `extensions-page.png` - Chrome extensions management page
- `example-page.png` - Test webpage with extension loaded

## Debugging

1. **Visual Mode**: Run with `--headed` to see the browser:

   ```bash
   yarn playwright test --headed
   ```

2. **Slow Motion**: Add delays between actions:

   ```bash
   yarn playwright test --headed --slow-mo=1000
   ```

3. **Playwright Inspector**: Debug step-by-step:

   ```bash
   yarn e2e:playwright:debug
   ```

4. **HTML Report**: View detailed test results:
   ```bash
   yarn playwright show-report
   ```

## Adding New Tests

Create a new file in `e2e/`:

```typescript
import { test, expect, chromium } from "@playwright/test";
import path from "path";

test("my new test", async () => {
  const pathToExtension = path.join(__dirname, "../build");
  const userDataDir = path.join(__dirname, "../.playwright-user-data");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      "--no-sandbox",
    ],
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const serviceWorkers = context.serviceWorkers();
    const extensionId = serviceWorkers[0].url().split("/")[2];

    // Your test logic here
    const page = await context.newPage();
    await page.goto("https://example.com");

    // Make assertions
    expect(await page.title()).toBeTruthy();
  } finally {
    await context.close();
  }
});
```

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Install Playwright
  run: yarn playwright install chromium

- name: Build Extension
  run: yarn build

- name: Run E2E Tests
  run: yarn e2e:playwright
```

## Comparison with Jest/Puppeteer

| Feature           | Playwright      | Jest/Puppeteer |
| ----------------- | --------------- | -------------- |
| Speed             | Fast            | Fast           |
| API               | Modern, cleaner | Older          |
| Extension support | Good            | Good           |
| Auto-wait         | Built-in        | Manual         |
| Debugging         | Excellent UI    | Command-line   |
| Screenshots       | Automatic       | Manual         |

## Tips

- Always `yarn build` before running tests
- Tests run in headed mode by default to see what's happening
- Use `--headed` flag to watch tests run
- Check `e2e/screenshots/` for visual debugging
- Extension ID changes each load in some cases, always get it dynamically

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Testing Chrome Extensions](https://playwright.dev/docs/chrome-extensions)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
