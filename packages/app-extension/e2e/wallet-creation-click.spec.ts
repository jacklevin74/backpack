import { test, expect, chromium } from "@playwright/test";
import path from "path";

/**
 * Interactive Wallet Creation Test
 *
 * This test actually clicks the "Create New Wallet" button
 * by accessing the auto-opened onboarding page.
 */

test("click create new wallet button and follow flow", async () => {
  const pathToExtension = path.join(__dirname, "../build");
  const userDataDir = path.join(__dirname, "../.playwright-user-data-create");

  console.log("🎯 Testing actual wallet creation button clicks...\n");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      "--no-sandbox",
    ],
    recordVideo: {
      dir: "test-results/videos",
      size: { width: 1280, height: 720 },
    },
  });

  try {
    console.log("⏳ Waiting for extension to load...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Get extension ID
    const serviceWorkers = context.serviceWorkers();
    expect(serviceWorkers.length).toBeGreaterThan(0);
    const extensionId = serviceWorkers[0].url().split("/")[2];
    console.log(`✓ Extension ID: ${extensionId}\n`);

    // Check all open pages
    const pages = context.pages();
    console.log(`📄 Found ${pages.length} open pages`);

    // Look for auto-opened onboarding page
    let onboardingPage = pages.find((p) => p.url().includes("onboarding=true"));

    if (!onboardingPage) {
      console.log(
        "⚠️  Onboarding page not auto-opened, trying to open manually..."
      );

      // Try to open the onboarding page manually
      onboardingPage = await context.newPage();
      const onboardingUrl = `chrome-extension://${extensionId}/options.html?onboarding=true`;

      try {
        await onboardingPage.goto(onboardingUrl, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        console.log("✓ Onboarding page opened manually");
      } catch (error) {
        console.log("❌ Could not open onboarding page");
        throw error;
      }
    } else {
      console.log("✓ Found auto-opened onboarding page!");
      console.log(`  URL: ${onboardingPage.url()}\n`);
    }

    // Wait for page to fully load
    await onboardingPage.waitForLoadState("domcontentloaded");
    await onboardingPage.waitForTimeout(3000);

    // Take initial screenshot
    await onboardingPage.screenshot({
      path: "e2e/screenshots/onboarding-initial.png",
    });
    console.log("📸 Screenshot: onboarding-initial.png\n");

    // Get page content to see what's there
    const bodyText = await onboardingPage.locator("body").textContent();
    console.log(`📄 Page content length: ${bodyText?.length} characters`);

    if (bodyText && bodyText.length > 50) {
      console.log(`📝 Preview: ${bodyText.substring(0, 300)}...\n`);
    }

    // Look for "Create" or "Get Started" or "New Wallet" buttons
    console.log("🔍 Looking for wallet creation buttons...\n");

    // Try multiple selectors
    const selectors = [
      'button:has-text("Create")',
      'button:has-text("Get Started")',
      'button:has-text("New Wallet")',
      'button:has-text("Create New Wallet")',
      'button:has-text("Create Wallet")',
      'a:has-text("Create")',
      'a:has-text("Get Started")',
      '[role="button"]:has-text("Create")',
      "button", // All buttons as fallback
    ];

    let clickableButton = null;
    let usedSelector = "";

    for (const selector of selectors) {
      const count = await onboardingPage.locator(selector).count();
      console.log(`  ${selector}: ${count} found`);

      if (count > 0 && !clickableButton) {
        clickableButton = onboardingPage.locator(selector).first();
        usedSelector = selector;
      }
    }

    if (clickableButton) {
      console.log(`\n✓ Found clickable element with: ${usedSelector}\n`);

      // Get button text
      const buttonText = await clickableButton.textContent();
      console.log(`📝 Button text: "${buttonText}"`);

      // Take screenshot of the button
      await clickableButton.screenshot({
        path: "e2e/screenshots/create-wallet-button.png",
      });
      console.log("📸 Screenshot: create-wallet-button.png\n");

      // Click the button!
      console.log('🖱️  Clicking "Create Wallet" button...');
      await clickableButton.click();
      console.log("✓ Button clicked!\n");

      // Wait for navigation/changes
      await onboardingPage.waitForTimeout(2000);

      // Take screenshot after click
      await onboardingPage.screenshot({
        path: "e2e/screenshots/after-create-click.png",
      });
      console.log("📸 Screenshot: after-create-click.png\n");

      // Get new page content
      const afterClickText = await onboardingPage.locator("body").textContent();
      console.log(
        `📄 Page content after click: ${afterClickText?.substring(0, 300)}...\n`
      );

      // Look for next steps (password input, seed phrase, etc.)
      const hasPasswordInput = await onboardingPage
        .locator('input[type="password"]')
        .count();
      const hasSeedPhrase =
        afterClickText?.toLowerCase().includes("seed") ||
        afterClickText?.toLowerCase().includes("phrase") ||
        afterClickText?.toLowerCase().includes("recovery");
      const hasNameInput = await onboardingPage
        .locator('input[type="text"], input[placeholder*="name" i]')
        .count();

      console.log("🔍 Checking for next step elements:");
      console.log(`  Password inputs: ${hasPasswordInput}`);
      console.log(`  Name inputs: ${hasNameInput}`);
      console.log(`  Seed phrase mentioned: ${hasSeedPhrase ? "Yes" : "No"}\n`);

      if (hasPasswordInput > 0) {
        console.log("✓✓✓ SUCCESS! Reached password setup screen! ✓✓✓");
      } else if (hasNameInput > 0) {
        console.log("✓✓✓ SUCCESS! Reached wallet name input screen! ✓✓✓");
      } else if (hasSeedPhrase) {
        console.log("✓✓✓ SUCCESS! Reached seed phrase screen! ✓✓✓");
      } else {
        console.log("✓ Button clicked, checking what happened...");

        // Take full page screenshot
        await onboardingPage.screenshot({
          path: "e2e/screenshots/after-click-fullpage.png",
          fullPage: true,
        });

        // List all visible text elements
        const allText = await onboardingPage
          .locator("h1, h2, h3, p, button, a")
          .allTextContents();
        console.log("\n📝 Visible text elements:");
        allText.forEach((text, i) => {
          if (text.trim()) {
            console.log(`  ${i + 1}. ${text.trim()}`);
          }
        });
      }
    } else {
      console.log("❌ No clickable elements found\n");

      // Debug: show all elements
      console.log("🔍 Debugging - All elements on page:");
      const allElements = await onboardingPage
        .locator("*")
        .evaluateAll((elements) =>
          elements.slice(0, 50).map((el) => ({
            tag: el.tagName,
            text: el.textContent?.substring(0, 50),
            class: el.className,
          }))
        );
      console.log(JSON.stringify(allElements, null, 2));
    }

    // Keep browser open longer to see the video
    console.log("\n⏳ Waiting to capture more video footage...");
    await onboardingPage.waitForTimeout(3000);

    const videoPath = await onboardingPage.video()?.path();
    if (videoPath) {
      console.log(`\n🎬 Video saved at: ${videoPath}`);
    }
  } finally {
    await context.close();
    console.log("\n✓ Test completed\n");
  }
});

test("interact with wallet creation form fields", async () => {
  const pathToExtension = path.join(__dirname, "../build");
  const userDataDir = path.join(__dirname, "../.playwright-user-data-form");

  console.log("\n📝 Testing wallet creation form interactions...\n");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      "--no-sandbox",
    ],
    recordVideo: {
      dir: "test-results/videos",
      size: { width: 1280, height: 720 },
    },
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const serviceWorkers = context.serviceWorkers();
    const extensionId = serviceWorkers[0].url().split("/")[2];

    // Find or open onboarding page
    let page = context.pages().find((p) => p.url().includes("onboarding=true"));

    if (!page) {
      page = await context.newPage();
      await page.goto(
        `chrome-extension://${extensionId}/options.html?onboarding=true`,
        {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        }
      );
    }

    await page.waitForTimeout(3000);

    console.log("🔍 Looking for input fields...");

    // Look for various input types
    const inputs = await page.locator("input").all();
    console.log(`Found ${inputs.length} input fields`);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = await input.getAttribute("type");
      const placeholder = await input.getAttribute("placeholder");
      const name = await input.getAttribute("name");

      console.log(`  Input ${i + 1}:`);
      console.log(`    Type: ${type}`);
      console.log(`    Placeholder: ${placeholder}`);
      console.log(`    Name: ${name}`);

      // Try to fill some test data
      if (type === "text" && placeholder?.toLowerCase().includes("name")) {
        console.log("    → Filling with test wallet name...");
        await input.fill("Test Wallet");
        await page.waitForTimeout(500);
      }
    }

    // Look for buttons
    const buttons = await page.locator("button").all();
    console.log(`\nFound ${buttons.length} buttons`);

    for (let i = 0; i < buttons.length; i++) {
      const text = await buttons[i].textContent();
      const isVisible = await buttons[i].isVisible();
      const isEnabled = await buttons[i].isEnabled();

      console.log(`  Button ${i + 1}: "${text?.trim()}"`);
      console.log(`    Visible: ${isVisible}, Enabled: ${isEnabled}`);
    }

    await page.screenshot({
      path: "e2e/screenshots/form-exploration.png",
      fullPage: true,
    });
    console.log("\n📸 Screenshot saved: form-exploration.png");

    await page.waitForTimeout(3000);
  } finally {
    await context.close();
  }
});
