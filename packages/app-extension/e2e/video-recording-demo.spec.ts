import { test, expect, chromium } from '@playwright/test';
import path from 'path';

/**
 * Video Recording Demo
 *
 * This test demonstrates how to record videos of extension tests.
 * Videos are saved to test-results/ directory.
 */

test('extension demo with video recording', async () => {
  const pathToExtension = path.join(__dirname, '../build');
  const userDataDir = path.join(__dirname, '../.playwright-user-data-video');
  const videoDir = path.join(__dirname, '../test-results/videos');

  console.log('🎥 Starting video recording demo...\n');

  // Launch browser with video recording enabled
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 }
    }
  });

  try {
    console.log('✓ Browser launched with video recording');
    console.log(`  Video directory: ${videoDir}\n`);

    // Wait for extension to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get extension ID
    const serviceWorkers = context.serviceWorkers();
    expect(serviceWorkers.length).toBeGreaterThan(0);
    const extensionId = serviceWorkers[0].url().split('/')[2];
    console.log(`✓ Extension loaded: ${extensionId}\n`);

    // Create a page and navigate to chrome://extensions
    const page = await context.newPage();
    console.log('✓ Opening chrome://extensions page...');
    await page.goto('chrome://extensions');
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/video-demo-extensions.png' });
    console.log('✓ Screenshot captured\n');

    // Navigate to a test webpage
    console.log('✓ Navigating to example.com...');
    await page.goto('https://example.com');
    await page.waitForTimeout(2000);

    // Check for injected wallet APIs
    const apis = await page.evaluate(() => {
      return {
        x1: typeof (window as any).x1 !== 'undefined',
        ethereum: typeof (window as any).ethereum !== 'undefined',
      };
    });

    console.log('✓ Wallet API check:');
    console.log(`  - window.x1: ${apis.x1 ? '✓' : '✗'}`);
    console.log(`  - window.ethereum: ${apis.ethereum ? '✓' : '✗'}\n`);

    // Take another screenshot
    await page.screenshot({ path: 'e2e/screenshots/video-demo-webpage.png' });

    // Wait a bit more for the video
    console.log('📹 Recording additional footage...');
    await page.waitForTimeout(3000);

    console.log('\n✓✓✓ Demo completed successfully! ✓✓✓\n');

    // Get video path before closing
    const videoPath = await page.video()?.path();
    if (videoPath) {
      console.log(`🎬 Video will be saved at: ${videoPath}`);
    }

    await page.close();

  } finally {
    // Close context - this finalizes the video
    await context.close();

    // Wait a moment for video to finish saving
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n✓ Browser closed');
    console.log('✓ Video recording finalized\n');
  }
});

test('wallet creation flow with video', async () => {
  const pathToExtension = path.join(__dirname, '../build');
  const userDataDir = path.join(__dirname, '../.playwright-user-data-wallet-video');
  const videoDir = path.join(__dirname, '../test-results/videos');

  console.log('\n🎥 Recording wallet creation flow...\n');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 }
    }
  });

  try {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const serviceWorkers = context.serviceWorkers();
    const extensionId = serviceWorkers[0].url().split('/')[2];

    console.log(`Extension ID: ${extensionId}`);
    console.log(`\n📝 Manual Wallet Creation Steps:`);
    console.log(`   1. Open: chrome-extension://${extensionId}/popup.html`);
    console.log(`   2. Click "Create New Wallet"`);
    console.log(`   3. Save recovery phrase`);
    console.log(`   4. Set password`);
    console.log(`   5. Complete onboarding\n`);

    // Open a test page
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(2000);

    console.log('✓ Test page loaded');
    console.log('📹 Recording in progress...\n');

    await page.screenshot({ path: 'e2e/screenshots/wallet-flow-demo.png' });
    await page.waitForTimeout(3000);

    const videoPath = await page.video()?.path();
    console.log(`🎬 Video location: ${videoPath}\n`);

    await page.close();

  } finally {
    await context.close();
    console.log('✓ Video saved\n');
  }
});
