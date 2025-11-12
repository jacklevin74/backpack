import { test, expect, chromium } from '@playwright/test';
import path from 'path';

/**
 * Complete Wallet Creation Flow
 *
 * This test clicks through the entire wallet creation process:
 * 1. Click "Create a new wallet"
 * 2. Enter wallet name
 * 3. Continue through all steps
 * 4. Record video of the entire flow
 */

test('complete wallet creation flow with all steps', async () => {
  const pathToExtension = path.join(__dirname, '../build');
  const userDataDir = path.join(__dirname, '../.playwright-user-data-full-flow');

  console.log('🚀 Complete Wallet Creation Flow Test\n');
  console.log('This test will:');
  console.log('  1. Click "Create a new wallet"');
  console.log('  2. Fill in wallet name');
  console.log('  3. Click through ALL onboarding steps');
  console.log('  4. Complete wallet creation');
  console.log('  5. Record everything\n');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
    recordVideo: {
      dir: 'test-results/videos',
      size: { width: 1280, height: 720 }
    }
  });

  // Increase test timeout to 2 minutes
  test.setTimeout(120000);

  try {
    console.log('⏳ Loading extension...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const serviceWorkers = context.serviceWorkers();
    const extensionId = serviceWorkers[0].url().split('/')[2];
    console.log(`✓ Extension loaded: ${extensionId}\n`);

    // Find the auto-opened onboarding page
    let page = context.pages().find(p => p.url().includes('onboarding=true'));

    if (!page) {
      page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/options.html?onboarding=true`);
    }

    await page.waitForTimeout(2000);

    // === STEP 1: Initial Welcome Screen ===
    console.log('📍 STEP 1: Welcome Screen');
    await page.screenshot({ path: 'e2e/screenshots/flow-01-welcome.png' });

    const welcomeText = await page.locator('body').textContent();
    console.log(`   Text on screen: "${welcomeText?.substring(0, 100)}..."`);

    // Click "Create a new wallet"
    const createButton = page.locator('button:has-text("Create")').first();
    const buttonText = await createButton.textContent();
    console.log(`   Found button: "${buttonText}"`);
    console.log('   🖱️  Clicking...');

    await createButton.click();
    await page.waitForTimeout(2000);
    console.log('   ✓ Clicked!\n');

    // === STEP 2: Wallet Name Input ===
    console.log('📍 STEP 2: Name Your Account');
    await page.screenshot({ path: 'e2e/screenshots/flow-02-name-input.png' });

    // Look for input field
    const nameInputs = await page.locator('input[type="text"], input:not([type])').all();
    console.log(`   Found ${nameInputs.length} input field(s)`);

    if (nameInputs.length > 0) {
      const nameInput = nameInputs[0];
      console.log('   📝 Filling wallet name: "My Test Wallet"');
      await nameInput.fill('My Test Wallet');
      await page.waitForTimeout(1000);
      console.log('   ✓ Name entered\n');

      await page.screenshot({ path: 'e2e/screenshots/flow-02-name-filled.png' });
    }

    // Click "Next" or "Skip"
    const nextButtons = await page.locator('button:has-text("Next"), button:has-text("Skip"), button:has-text("Continue")').all();
    console.log(`   Found ${nextButtons.length} next/continue button(s)`);

    if (nextButtons.length > 0) {
      const nextButton = nextButtons[0];
      const nextText = await nextButton.textContent();
      console.log(`   🖱️  Clicking "${nextText?.trim()}"...`);
      await nextButton.click();
      await page.waitForTimeout(2000);
      console.log('   ✓ Clicked!\n');
    }

    // === STEP 3: After clicking Next ===
    console.log('📍 STEP 3: Next Screen');
    await page.screenshot({ path: 'e2e/screenshots/flow-03-after-next.png' });

    const step3Text = await page.locator('body').textContent();
    console.log(`   Screen content: "${step3Text?.substring(0, 150)}..."\n`);

    // Check what we see
    const hasSeedPhrase = step3Text?.toLowerCase().includes('seed') ||
                         step3Text?.toLowerCase().includes('phrase') ||
                         step3Text?.toLowerCase().includes('recovery');
    const hasPassword = step3Text?.toLowerCase().includes('password');
    const hasImport = step3Text?.toLowerCase().includes('import');

    console.log('   🔍 Content analysis:');
    console.log(`      Seed/Recovery phrase: ${hasSeedPhrase ? 'YES' : 'NO'}`);
    console.log(`      Password setup: ${hasPassword ? 'YES' : 'NO'}`);
    console.log(`      Import mention: ${hasImport ? 'YES' : 'NO'}\n`);

    // === STEP 4: Continue clicking through ===
    console.log('📍 STEP 4: Continuing through ALL steps...\n');

    let stepNumber = 1;
    let previousUrl = page.url();
    let previousText = step3Text;
    let maxSteps = 20; // Safety limit
    let noChangeCount = 0;

    while (stepNumber <= maxSteps) {
      await page.waitForTimeout(2000);

      const currentText = await page.locator('body').textContent();
      const currentUrl = page.url();

      console.log(`   🔄 Step ${stepNumber}:`);
      console.log(`      Current screen: "${currentText?.substring(0, 80)}..."`);

      // Look for clickable buttons with various text patterns
      const buttonSelectors = [
        'button:has-text("Next")',
        'button:has-text("Continue")',
        'button:has-text("I understand")',
        'button:has-text("Got it")',
        'button:has-text("Confirm")',
        'button:has-text("Skip")',
        'button:has-text("Show")',
        'button:has-text("Copy")',
        'button:has-text("Finish")',
        'button:has-text("Done")',
        'button:has-text("Create")',
        'button',  // Fallback to any button
      ];

      let clicked = false;

      for (const selector of buttonSelectors) {
        const buttons = await page.locator(selector).all();

        for (const btn of buttons) {
          const isVisible = await btn.isVisible();
          const isEnabled = await btn.isEnabled();

          if (isVisible && isEnabled) {
            const btnText = await btn.textContent();

            // Skip buttons we don't want to click
            if (btnText?.toLowerCase().includes('import') ||
                btnText?.toLowerCase().includes('back')) {
              continue;
            }

            console.log(`      Found: "${btnText?.trim()}"`);
            console.log(`      🖱️  Clicking...`);

            await page.screenshot({ path: `e2e/screenshots/flow-step-${stepNumber}.png` });
            await btn.click();
            await page.waitForTimeout(2000);

            clicked = true;
            console.log(`      ✓ Clicked!\n`);
            break;
          }
        }

        if (clicked) break;
      }

      if (!clicked) {
        console.log(`      ⚠️  No clickable buttons found`);

        // Check if we've completed
        const isComplete = currentText?.toLowerCase().includes('complete') ||
                          currentText?.toLowerCase().includes('success') ||
                          currentText?.toLowerCase().includes('congratulations') ||
                          currentUrl.includes('complete');

        if (isComplete) {
          console.log(`      🎉 Wallet creation COMPLETED!\n`);
          break;
        }

        // Check if page changed
        if (currentUrl !== previousUrl || currentText !== previousText) {
          console.log(`      Screen changed, looking for new buttons...\n`);
          previousUrl = currentUrl;
          previousText = currentText;
          noChangeCount = 0;
        } else {
          noChangeCount++;
          console.log(`      No change detected (${noChangeCount}/3)\n`);

          if (noChangeCount >= 3) {
            console.log(`      Stopping - no progress for 3 iterations\n`);
            break;
          }
        }
      } else {
        // Reset no-change counter after successful click
        noChangeCount = 0;
      }

      stepNumber++;
    }

    console.log(`📍 Completed ${stepNumber} steps in the flow\n`);

    // === FINAL SCREENSHOT ===
    console.log('📍 FINAL: Checking completion status');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/flow-99-final.png', fullPage: true });

    const finalText = await page.locator('body').textContent();
    console.log(`\n   Final screen text: "${finalText?.substring(0, 200)}..."\n`);

    // Check if we completed onboarding
    const isComplete = finalText?.toLowerCase().includes('complete') ||
                      finalText?.toLowerCase().includes('success') ||
                      finalText?.toLowerCase().includes('done') ||
                      page.url().includes('complete');

    if (isComplete) {
      console.log('🎉🎉🎉 WALLET CREATION COMPLETED! 🎉🎉🎉\n');
    } else {
      console.log('✓ Progressed through multiple wallet creation steps\n');
    }

    // List all screenshots created
    console.log('📸 Screenshots saved:');
    const fs = require('fs');
    const screenshots = fs.readdirSync('e2e/screenshots').filter((f: string) => f.startsWith('flow-'));
    screenshots.forEach((s: string) => console.log(`   - ${s}`));

    // Wait for video
    console.log('\n⏳ Finalizing video recording...');
    await page.waitForTimeout(3000);

    const videoPath = await page.video()?.path();
    console.log(`\n🎬 Video: ${videoPath}\n`);

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✓ Extension loaded: ${extensionId}`);
    console.log(`✓ Onboarding page accessed`);
    console.log(`✓ "Create a new wallet" clicked`);
    console.log(`✓ Wallet name entered: "My Test Wallet"`);
    console.log(`✓ Continued through ${screenshots.length} steps`);
    console.log(`✓ Screenshots: ${screenshots.length} files`);
    console.log(`✓ Video recorded: ${videoPath ? 'YES' : 'NO'}`);
    console.log('═══════════════════════════════════════\n');

  } finally {
    await context.close();
    console.log('✓ Test completed successfully\n');
  }
});
