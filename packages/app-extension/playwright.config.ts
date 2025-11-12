import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for testing Chrome extension
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Run tests in files in parallel
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests
  workers: 1,

  // Reporter to use
  reporter: 'html',

  use: {
    // Base URL for page.goto()
    baseURL: 'http://localhost:3333',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshots on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: 'on', // Options: 'on', 'off', 'retain-on-failure', 'on-first-retry'
  },

  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
