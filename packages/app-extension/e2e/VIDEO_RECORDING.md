# Video Recording Guide for Playwright Tests

## ✅ Yes, Playwright Can Record Videos!

Videos are automatically recorded and saved as `.webm` files.

## Quick Start

### Run tests with video recording:

```bash
# Run video recording demo
yarn playwright test e2e/video-recording-demo.spec.ts

# Run all tests (videos enabled in config)
yarn e2e:playwright
```

### Find your videos:

```bash
# Videos are saved here:
test-results/videos/*.webm
```

## Video Configuration Options

### 1. Global Config (in playwright.config.ts)

```typescript
use: {
  video: 'on',  // Always record
  // OR
  video: 'retain-on-failure',  // Only keep videos of failed tests
  // OR
  video: 'on-first-retry',  // Record only when retrying
  // OR
  video: 'off',  // No videos
}
```

### 2. Per-Test Recording

```typescript
const context = await chromium.launchPersistentContext(userDataDir, {
  recordVideo: {
    dir: "test-results/videos",
    size: { width: 1280, height: 720 },
  },
});
```

## Video Settings

### Resolution Options:

```typescript
recordVideo: {
  dir: 'videos/',
  size: {
    width: 1920,   // Full HD
    height: 1080
  }
}

// OR

recordVideo: {
  dir: 'videos/',
  size: {
    width: 1280,   // HD
    height: 720
  }
}

// OR

recordVideo: {
  dir: 'videos/',
  size: {
    width: 800,    // Smaller (faster)
    height: 600
  }
}
```

## Current Setup

### Videos are recorded at:

- **Resolution**: 1280x720 (HD)
- **Format**: WebM
- **Location**: `test-results/videos/`
- **Mode**: On (all tests)

### Example Output:

```
test-results/videos/
├── 017c6f408cd1037814c4d137ff54bb96.webm  (258 KB)
├── 5201f5e95ba8b16cabcf180ae668b754.webm  (182 KB)
└── af1e06ca2c6b07b3c8dc5475e85ee4b1.webm  ( 16 KB)
```

## What Gets Recorded

### ✅ Recorded in Videos:

- Browser window content
- Extension pages (chrome://extensions)
- Web pages with extension interactions
- Page navigations
- Screenshots being taken
- All visible UI interactions

### ❌ NOT Recorded:

- Extension popup clicks (Playwright limitation)
- Browser chrome/toolbar
- Multiple windows simultaneously (one video per page)

## Viewing Videos

### On Linux:

```bash
# Using VLC
vlc test-results/videos/*.webm

# Using mpv
mpv test-results/videos/017c6f408cd1037814c4d137ff54bb96.webm

# Using browser
firefox test-results/videos/017c6f408cd1037814c4d137ff54bb96.webm
```

### On macOS:

```bash
open test-results/videos/017c6f408cd1037814c4d137ff54bb96.webm
```

### On Windows:

```bash
start test-results/videos/017c6f408cd1037814c4d137ff54bb96.webm
```

## Video Recording Best Practices

### 1. Use Descriptive Test Names

Videos are named by hash, so check test output to match videos to tests:

```
🎬 Video will be saved at: test-results/videos/017c6f40....webm
```

### 2. Add Waits for Better Videos

```typescript
// Wait before critical actions
await page.waitForTimeout(1000);

// Wait after actions to see results
await page.click("button");
await page.waitForTimeout(2000); // See what happens
```

### 3. Only Record When Needed

For CI/CD, save storage by only keeping failure videos:

```typescript
use: {
  video: 'retain-on-failure',
}
```

### 4. Control Video Size

Smaller resolutions = smaller files = faster CI:

```typescript
recordVideo: {
  size: { width: 800, height: 600 }  // Smaller files
}
```

## Integration with HTML Report

Playwright's HTML report automatically embeds videos:

```bash
# Generate and open HTML report
yarn playwright show-report
```

The report will show:

- Test results
- Screenshots
- **Videos** (embedded and playable)
- Traces

## Example: Recording Wallet Creation Flow

```typescript
test("wallet creation with video", async () => {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Must be false for videos
    recordVideo: {
      dir: "test-results/videos",
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();

  // Your test steps here...
  await page.goto("chrome-extension://ID/popup.html");
  await page.waitForTimeout(2000);

  // Get video path
  const videoPath = await page.video()?.path();
  console.log("Video saved at:", videoPath);

  await page.close();
  await context.close(); // Finalizes the video
});
```

## Troubleshooting

### Video not created?

1. **Check headless mode**: Videos only work with `headless: false`
2. **Wait for close**: Video finalizes when context closes
3. **Check permissions**: Ensure write access to video directory

### Video file too large?

1. **Reduce resolution**: Use 800x600 instead of 1920x1080
2. **Shorten test**: Less time = smaller file
3. **Use retain-on-failure**: Only keep failed test videos

### Can't find video?

1. **Check test output**: Shows exact path
2. **Look in test-results**: Videos go to test-results/videos/
3. **Check HTML report**: `yarn playwright show-report`

## Video File Naming

Videos use hash-based names. To find your video:

1. **Check test output** for the path:

   ```
   🎬 Video will be saved at: .../017c6f40....webm
   ```

2. **Or check test-results**:

   ```bash
   ls -lt test-results/videos/  # Sorted by time
   ```

3. **Or use HTML report**:
   ```bash
   yarn playwright show-report  # Videos linked to tests
   ```

## CI/CD Configuration

### GitHub Actions Example:

```yaml
- name: Run Playwright Tests
  run: yarn e2e:playwright

- name: Upload Videos
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-videos
    path: test-results/videos/
    retention-days: 7
```

### GitLab CI Example:

```yaml
test:
  script:
    - yarn e2e:playwright
  artifacts:
    when: on_failure
    paths:
      - test-results/videos/
    expire_in: 1 week
```

## Video Recording Statistics

From our tests:

| Test           | Duration | Video Size | Resolution |
| -------------- | -------- | ---------- | ---------- |
| Extension load | 5.1s     | 16 KB      | 1280x720   |
| API injection  | 10s      | 182 KB     | 1280x720   |
| Full demo      | 14.6s    | 258 KB     | 1280x720   |

**Average**: ~14 KB per second of recording

## Advanced: Programmatic Video Access

```typescript
test("access video info", async ({ page }) => {
  // Get video object
  const video = page.video();

  // Get video path (after context closes)
  const path = await video?.path();
  console.log("Video path:", path);

  // Save to custom location
  await video?.saveAs("custom-path/my-test.webm");
});
```

## Summary

✅ **Videos are enabled and working**
✅ **Saved to**: `test-results/videos/*.webm`
✅ **Format**: WebM (widely supported)
✅ **Resolution**: 1280x720 HD
✅ **View in**: HTML report or any video player

Run the demo:

```bash
yarn playwright test e2e/video-recording-demo.spec.ts
```

Your videos will be in:

```
test-results/videos/
```
