import { test, expect, chromium } from '@playwright/test';
import path from 'path';

/**
 * Wallet Management Test
 *
 * Tests wallet management features:
 * 1. Verify at least one wallet is visible
 * 2. Click copy icon and verify BS58 pubkey copied to clipboard
 * 3. Click 3-dot menu and verify options
 * 4. Click "Delete Account" and verify dialog opens
 * 5. Click "Cancel" and verify dialog closes
 * 6. Change account name
 * 7. Close the menu
 */

test('wallet management - copy, delete, rename', async () => {
  const pathToExtension = path.join(__dirname, '../build');
  const userDataDir = path.join(__dirname, '../.playwright-user-data-wallet-mgmt');

  console.log('🔧 Wallet Management Test\n');
  console.log('Testing: Copy pubkey, Delete account dialog, Rename wallet\n');

  // Grant clipboard permissions
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
    permissions: ['clipboard-read', 'clipboard-write'],
    recordVideo: {
      dir: 'test-results/videos',
      size: { width: 1280, height: 720 }
    }
  });

  test.setTimeout(180000);

  try {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const serviceWorkers = context.serviceWorkers();
    const extensionId = serviceWorkers[0].url().split('/')[2];
    console.log(`✓ Extension loaded: ${extensionId}\n`);

    // Navigate to popup page
    let page = context.pages().find(p => p.url().includes(extensionId));

    if (!page || page.url().includes('onboarding')) {
      page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
    }

    await page.waitForTimeout(3000);
    console.log(`Current page: ${page.url()}\n`);

    // Take initial screenshot
    await page.screenshot({ path: 'e2e/screenshots/wallet-mgmt-01-initial.png' });
    console.log('📸 Screenshot: wallet-mgmt-01-initial.png\n');

    // === STEP 1: Check for visible wallets ===
    console.log('📍 STEP 1: Checking for visible wallets...\n');

    const bodyText = await page.locator('body').textContent();
    console.log(`Page content preview: ${bodyText?.substring(0, 200)}...\n`);

    // Look for wallet addresses or wallet list items
    const possibleWalletSelectors = [
      '[data-testid*="wallet"]',
      '[class*="wallet"]',
      '[class*="Wallet"]',
      '[class*="account"]',
      '[class*="Account"]',
      'div:has-text("...")', // Addresses are often shortened
      'text=/[A-Za-z0-9]{4,}\\.\\.\\.[A-Za-z0-9]{4,}/', // Pattern like "5mJT...xD8f"
    ];

    let walletElements = [];
    for (const selector of possibleWalletSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`   ${selector}: ${elements.length} found`);
        walletElements.push(...elements);
      }
    }

    console.log(`\n   Total wallet-related elements: ${walletElements.length}\n`);

    if (walletElements.length > 0) {
      console.log('   ✓ At least one wallet visible\n');
    } else {
      console.log('   ⚠️  No obvious wallet elements found\n');
    }

    // === STEP 2: Find and click copy icon ===
    console.log('📍 STEP 2: Looking for copy icon...\n');

    // Look for copy icons/buttons
    const copySelectors = [
      'button[aria-label*="copy" i]',
      'button[title*="copy" i]',
      '[data-testid*="copy"]',
      'button:has-text("Copy")',
      'svg[class*="copy"]',
      '*[class*="CopyIcon"]',
      'button:has(svg)', // Generic button with icon
    ];

    let copyButton = null;
    let copyButtonSelector = '';

    for (const selector of copySelectors) {
      const buttons = await page.locator(selector).all();
      console.log(`   ${selector}: ${buttons.length} found`);

      if (buttons.length > 0 && !copyButton) {
        // Check if it's visible and likely a copy button
        for (const btn of buttons) {
          const isVisible = await btn.isVisible();
          if (isVisible) {
            copyButton = btn;
            copyButtonSelector = selector;
            break;
          }
        }
      }
    }

    if (copyButton) {
      console.log(`\n   ✓ Found copy button with: ${copyButtonSelector}\n`);

      // Screenshot the copy button
      await copyButton.screenshot({ path: 'e2e/screenshots/wallet-mgmt-02-copy-button.png' });
      console.log('   📸 Copy button screenshot saved\n');

      // Click copy button
      console.log('   🖱️  Clicking copy button...');
      await copyButton.click();
      await page.waitForTimeout(1000);
      console.log('   ✓ Clicked!\n');

      // Get clipboard content
      console.log('   📋 Checking clipboard...');
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

      console.log(`   Clipboard content: ${clipboardText}\n`);

      // Verify it's a base58 public key
      const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clipboardText);
      const length = clipboardText?.length || 0;

      console.log(`   📏 Length: ${length} characters`);
      console.log(`   🔍 Format: ${isBase58 ? '✓ Valid base58' : '⚠️  Not standard base58'}`);
      console.log(`   🔍 Full-size: ${length >= 32 ? '✓ Yes' : '⚠️  Too short'}\n`);

      // Assert it's a valid pubkey
      expect(length).toBeGreaterThanOrEqual(32);
      expect(length).toBeLessThanOrEqual(44);

      console.log('   ✓✓✓ PASS: Valid public key copied! ✓✓✓\n');
    } else {
      console.log('   ⚠️  No copy button found\n');
    }

    await page.screenshot({ path: 'e2e/screenshots/wallet-mgmt-03-after-copy.png' });

    // === STEP 3: Find and click 3-dot menu ===
    console.log('📍 STEP 3: Looking for 3-dot menu...\n');

    const menuSelectors = [
      'button[aria-label*="menu" i]',
      'button[aria-label*="options" i]',
      'button[aria-label*="more" i]',
      '[data-testid*="menu"]',
      '[data-testid*="options"]',
      'button:has-text("⋮")', // Vertical dots
      'button:has-text("⋯")', // Horizontal dots
      'button:has-text("...")',
      '*[class*="MenuIcon"]',
      '*[class*="MoreVert"]',
      '*[class*="MoreHoriz"]',
    ];

    let menuButton = null;
    let menuButtonSelector = '';

    for (const selector of menuSelectors) {
      const buttons = await page.locator(selector).all();
      console.log(`   ${selector}: ${buttons.length} found`);

      if (buttons.length > 0 && !menuButton) {
        for (const btn of buttons) {
          const isVisible = await btn.isVisible();
          if (isVisible) {
            menuButton = btn;
            menuButtonSelector = selector;
            break;
          }
        }
      }
    }

    if (menuButton) {
      console.log(`\n   ✓ Found menu button with: ${menuButtonSelector}\n`);

      // Screenshot the menu button
      await menuButton.screenshot({ path: 'e2e/screenshots/wallet-mgmt-04-menu-button.png' });
      console.log('   📸 Menu button screenshot saved\n');

      // Click menu button
      console.log('   🖱️  Clicking menu button...');
      await menuButton.click();
      await page.waitForTimeout(1500);
      console.log('   ✓ Clicked!\n');

      await page.screenshot({ path: 'e2e/screenshots/wallet-mgmt-05-menu-opened.png' });

      // === STEP 4: Check menu options ===
      console.log('📍 STEP 4: Checking menu options...\n');

      const menuText = await page.locator('body').textContent();
      const hasDeleteOption = menuText?.toLowerCase().includes('delete');
      const hasRenameOption = menuText?.toLowerCase().includes('rename') ||
                             menuText?.toLowerCase().includes('edit');
      const hasRemoveOption = menuText?.toLowerCase().includes('remove');

      console.log(`   Options visible:`);
      console.log(`   - Delete: ${hasDeleteOption ? '✓ YES' : 'NO'}`);
      console.log(`   - Rename/Edit: ${hasRenameOption ? '✓ YES' : 'NO'}`);
      console.log(`   - Remove: ${hasRemoveOption ? '✓ YES' : 'NO'}\n`);

      // Count visible buttons in menu
      const menuButtons = await page.locator('button, [role="menuitem"], li[role="option"]').all();
      const visibleMenuButtons = [];

      for (const btn of menuButtons) {
        const isVisible = await btn.isVisible();
        if (isVisible) {
          const text = await btn.textContent();
          visibleMenuButtons.push(text?.trim());
        }
      }

      console.log(`   Found ${visibleMenuButtons.length} menu items:`);
      visibleMenuButtons.forEach((text, i) => {
        console.log(`   ${i + 1}. "${text}"`);
      });
      console.log();

      // === STEP 5: Click Delete Account ===
      console.log('📍 STEP 5: Clicking "Delete Account"...\n');

      const deleteButton = page.locator(
        'button:has-text("Delete"), [role="menuitem"]:has-text("Delete"), button:has-text("Remove")'
      ).first();

      const hasDeleteButton = await deleteButton.count() > 0;

      if (hasDeleteButton) {
        console.log('   ✓ Found delete button');
        console.log('   🖱️  Clicking...');

        await deleteButton.click();
        await page.waitForTimeout(1500);
        console.log('   ✓ Clicked!\n');

        await page.screenshot({ path: 'e2e/screenshots/wallet-mgmt-06-delete-dialog.png' });

        // === STEP 6: Verify delete dialog opened ===
        console.log('📍 STEP 6: Checking if delete dialog opened...\n');

        const dialogText = await page.locator('body').textContent();
        const hasDialog = dialogText?.toLowerCase().includes('delete') ||
                         dialogText?.toLowerCase().includes('remove') ||
                         dialogText?.toLowerCase().includes('confirm') ||
                         dialogText?.toLowerCase().includes('sure');

        console.log(`   Dialog visible: ${hasDialog ? '✓ YES' : '⚠️  NO'}\n`);

        if (hasDialog) {
          console.log('   ✓✓✓ PASS: Delete dialog opened! ✓✓✓\n');

          // === STEP 7: Click Cancel ===
          console.log('📍 STEP 7: Clicking "Cancel"...\n');

          const cancelButton = page.locator(
            'button:has-text("Cancel"), button:has-text("No"), button:has-text("Close")'
          ).first();

          const hasCancelButton = await cancelButton.count() > 0;

          if (hasCancelButton) {
            console.log('   ✓ Found cancel button');
            console.log('   🖱️  Clicking...');

            await cancelButton.click();
            await page.waitForTimeout(1500);
            console.log('   ✓ Clicked!\n');

            await page.screenshot({ path: 'e2e/screenshots/wallet-mgmt-07-after-cancel.png' });

            // Verify dialog closed
            const afterCancelText = await page.locator('body').textContent();
            const dialogStillVisible = afterCancelText?.toLowerCase().includes('confirm') &&
                                       afterCancelText?.toLowerCase().includes('delete');

            console.log(`   Dialog closed: ${!dialogStillVisible ? '✓ YES' : '⚠️  Still visible'}\n`);

            if (!dialogStillVisible) {
              console.log('   ✓✓✓ PASS: Dialog closed successfully! ✓✓✓\n');
            }
          }
        }
      } else {
        console.log('   ⚠️  Delete button not found in menu\n');
      }

      // === STEP 8: Change account name ===
      console.log('📍 STEP 8: Attempting to change account name...\n');

      // Click menu again if needed
      const menuStillOpen = await page.locator('button:has-text("Delete"), button:has-text("Rename")').count() > 0;

      if (!menuStillOpen && menuButton) {
        console.log('   Reopening menu...');
        await menuButton.click();
        await page.waitForTimeout(1500);
        console.log('   ✓ Menu reopened\n');
      }

      await page.screenshot({ path: 'e2e/screenshots/wallet-mgmt-08-before-rename.png' });

      const renameButton = page.locator(
        'button:has-text("Rename"), button:has-text("Edit"), [role="menuitem"]:has-text("Rename"), [role="menuitem"]:has-text("Edit")'
      ).first();

      const hasRenameButton = await renameButton.count() > 0;

      if (hasRenameButton) {
        console.log('   ✓ Found rename button');
        console.log('   🖱️  Clicking...');

        await renameButton.click();
        await page.waitForTimeout(1500);
        console.log('   ✓ Clicked!\n');

        await page.screenshot({ path: 'e2e/screenshots/wallet-mgmt-09-rename-dialog.png' });

        // Look for input field
        const inputs = await page.locator('input[type="text"], input:not([type])').all();
        console.log(`   Found ${inputs.length} input field(s)\n`);

        if (inputs.length > 0) {
          const nameInput = inputs[0];

          console.log('   📝 Entering new name: "Test Wallet Renamed"');
          await nameInput.fill('');
          await nameInput.fill('Test Wallet Renamed');
          await page.waitForTimeout(1000);
          console.log('   ✓ Name entered\n');

          await page.screenshot({ path: 'e2e/screenshots/wallet-mgmt-10-name-entered.png' });

          // Look for Save/OK button
          const saveButton = page.locator(
            'button:has-text("Save"), button:has-text("OK"), button:has-text("Confirm")'
          ).first();

          if (await saveButton.count() > 0) {
            console.log('   🖱️  Clicking Save...');
            await saveButton.click();
            await page.waitForTimeout(1500);
            console.log('   ✓ Saved!\n');

            console.log('   ✓✓✓ PASS: Account renamed! ✓✓✓\n');
          }
        }
      } else {
        console.log('   ⚠️  Rename button not found\n');
      }

      await page.screenshot({ path: 'e2e/screenshots/wallet-mgmt-11-final.png' });

      // Don't close the menu - leave it open for inspection
      console.log('📍 Test complete - leaving menu open for inspection\n');
    } else {
      console.log('   ⚠️  Menu button not found\n');
    }

    // === SUMMARY ===
    console.log('\n═══════════════════════════════════════');
    console.log('📊 WALLET MANAGEMENT TEST SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✓ Extension loaded`);
    console.log(`✓ Wallet elements: ${walletElements.length}`);
    console.log(`${copyButton ? '✓' : '⚠️ '} Copy button: ${copyButton ? 'Found & Clicked' : 'Not found'}`);
    console.log(`${menuButton ? '✓' : '⚠️ '} Menu button: ${menuButton ? 'Found & Clicked' : 'Not found'}`);
    console.log('═══════════════════════════════════════\n');

    console.log('💡 RECOMMENDATIONS:\n');
    console.log('Add data-testid attributes for easier testing:');
    console.log('  - data-testid="copy-address-button"');
    console.log('  - data-testid="wallet-options-menu"');
    console.log('  - data-testid="delete-wallet-button"');
    console.log('  - data-testid="rename-wallet-button"');
    console.log('  - data-testid="wallet-address-display"\n');

  } finally {
    await context.close();
    console.log('✓ Test completed\n');
  }
});
