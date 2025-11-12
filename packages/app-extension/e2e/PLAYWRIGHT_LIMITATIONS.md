# Playwright Testing Limitations for Browser Extensions

## Summary

While Playwright is excellent for E2E testing, browser extensions have specific limitations that make certain features difficult or impossible to test.

## Successfully Tested ✓

1. **Extension Loading**: ✓ Works perfectly

   - Loading extension in persistent context
   - Verifying service workers
   - Getting extension ID

2. **Onboarding Flow**: ✓ Works perfectly

   - `options.html?onboarding=true` opens in full page
   - Can click through entire wallet creation process
   - Can fill forms, click buttons, navigate steps
   - **See: `e2e/wallet-creation-full-flow.spec.ts`**

3. **Video Recording**: ✓ Works perfectly

   - Records entire test flow as WebM video
   - Screenshots at each step
   - See test-results/videos/

4. **Web Page Injection**: ✓ Works perfectly
   - Extension APIs injected into web pages
   - Can test `window.x1`, `window.ethereum`
   - **See: `e2e/extension-basic.spec.ts`**

## Limitations ⚠️

### 1. Cannot Access Extension Popup (popup.html)

**Problem**: Playwright cannot reliably navigate to or interact with `chrome-extension://ID/popup.html`

**Why**:

- Extension popups close immediately when they lose focus
- Playwright's `page.goto()` fails with "Target page, context or browser has been closed"
- `window.open()` opens the popup but it closes before interaction

**Error Messages**:

```
Error: page.goto: Target page, context or browser has been closed
Error: page.waitForTimeout: Target page, context or browser has been closed
```

**Attempted Workarounds** (all failed):

- Direct navigation: `await page.goto('chrome-extension://ID/popup.html')` ❌
- Window.open from another page ❌
- Creating new context/page ❌

**Impact**: Cannot test features that only appear in popup:

- Main wallet interface (balance, send/receive buttons)
- Copy wallet address button
- 3-dot menu for wallet options
- Delete account dialog
- Rename wallet feature

### 2. Options Page Shows Different Content

**Problem**: `options.html` is the settings/preferences page, not the main wallet UI

**What Works**:

- Can navigate to `chrome-extension://ID/options.html` ✓
- Can interact with settings/preferences ✓
- Onboarding flow works (`options.html?onboarding=true`) ✓

**What Doesn't Work**:

- options.html doesn't show wallet list ❌
- No copy address button ❌
- No 3-dot menu ❌
- Different UI than popup ❌

## Solutions & Workarounds

### Option 1: Test in options.html Instead

Move wallet management features to settings page where they can be tested.

```typescript
// This works:
await page.goto(`chrome-extension://${extensionId}/options.html`);
// Can test anything rendered in options.html
```

### Option 2: URL Parameters

Add URL parameters to options.html to show wallet view:

```typescript
await page.goto(`chrome-extension://${extensionId}/options.html?view=wallet`);
```

### Option 3: Standalone Test Page

Create a test-only HTML page that renders the wallet component:

```html
<!-- test-wallet-ui.html -->
<div id="wallet-root"></div>
<script src="wallet-component.js"></script>
```

### Option 4: Manual Testing

Some features may need to be tested manually:

- Popup UI interactions
- Extension icon click behavior
- Browser action popup

## Recommended Testing Strategy

### Automated with Playwright ✓

- Onboarding flow
- Wallet creation
- Settings/preferences
- Web page interactions
- Extension API injection

### Manual Testing

- Popup UI (copy address, menus)
- Extension icon behavior
- Popup-specific features

### Unit/Component Tests

- Individual React components
- Business logic
- API calls

## Current Test Files

| Test File                              | Status     | What It Tests                         |
| -------------------------------------- | ---------- | ------------------------------------- |
| `extension-basic.spec.ts`              | ✓ PASSING  | Extension loading, API injection      |
| `wallet-creation-full-flow.spec.ts`    | ✓ PASSING  | Complete onboarding flow (21 steps)   |
| `wallet-creation-click.spec.ts`        | ✓ PASSING  | Create wallet button clicks           |
| `blockchain-icon-verification.spec.ts` | ⚠️ LIMITED | Icon checks (limited by popup access) |
| `wallet-management.spec.ts`            | ❌ BLOCKED | Blocked by popup.html limitation      |

## References

- [Playwright Extension Testing Docs](https://playwright.dev/docs/chrome-extensions)
- [Chrome Extension Popup Behavior](https://developer.chrome.com/docs/extensions/mv3/user_interface/#popup)
- Issue: Extension popups close on blur (by design)

## Last Updated

2025-11-12 - Documented popup.html testing limitation
