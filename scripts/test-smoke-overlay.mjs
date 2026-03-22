import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const contentScriptPath = join(repoRoot, 'dist/content.js');
const overlayCssPath = join(repoRoot, 'dist/overlay.css');

function getChromeExecutablePath() {
  const candidates = [
    process.env.BASS_PRACTICE_CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);

  return candidates[0] ?? '';
}

function createWatchPageHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Bass Practice Smoke</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        background: #101522;
      }

      #movie_player {
        width: min(960px, calc(100vw - 32px));
        margin: 24px auto;
        padding: 16px;
        border-radius: 20px;
        background: #1a2230;
      }

      video {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #000;
      }
    </style>
  </head>
  <body>
    <div id="movie_player">
      <video class="html5-main-video"></video>
    </div>
  </body>
</html>`;
}

async function main() {
  const executablePath = getChromeExecutablePath();

  if (!executablePath) {
    throw new Error(
      'No Chrome executable found. Set BASS_PRACTICE_CHROME_BIN to a local Chrome/Chromium binary.',
    );
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  try {
    const context = await browser.newContext({
      viewport: {
        width: 1400,
        height: 900,
      },
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      const storageState = {};

      window.chrome = {
        storage: {
          local: {
            async get(key) {
              if (typeof key === 'string') {
                return { [key]: storageState[key] };
              }

              return { ...storageState };
            },
            async set(items) {
              Object.assign(storageState, items);
            },
          },
        },
      };
    });

    await page.route('https://www.youtube.com/**', async (route) => {
      const request = route.request();
      const url = request.url();

      if (
        request.isNavigationRequest() &&
        url.startsWith('https://www.youtube.com/watch')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: createWatchPageHtml(),
        });
        return;
      }

      await route.abort();
    });

    console.log('Opening routed YouTube watch page...');
    await page.goto('https://www.youtube.com/watch?v=smoke-test', {
      waitUntil: 'domcontentloaded',
    });
    await page.addStyleTag({ path: overlayCssPath });
    await page.addScriptTag({ path: contentScriptPath });
    console.log('Waiting for overlay root...');
    await page.waitForSelector('[data-bp-overlay-root] .bp-overlay__bar', {
      timeout: 5_000,
    });

    const overlay = page.locator('[data-bp-overlay-root] .bp-overlay');
    const overlayBox = await overlay.boundingBox();
    const viewport = page.viewportSize();

    if (!overlayBox || !viewport) {
      throw new Error('Overlay did not render with a measurable bounding box.');
    }

    if (
      overlayBox.width <= 0 ||
      overlayBox.height <= 0 ||
      overlayBox.x < 0 ||
      overlayBox.y < 0 ||
      overlayBox.x + overlayBox.width > viewport.width ||
      overlayBox.y + overlayBox.height > viewport.height
    ) {
      throw new Error(
        `Overlay rendered outside the viewport: ${JSON.stringify({
          overlayBox,
          viewport,
        })}`,
      );
    }

    await page.evaluate(() => {
      const video = document.querySelector('#movie_player video.html5-main-video');

      if (!(video instanceof HTMLVideoElement)) {
        throw new Error('Smoke video element not found.');
      }

      video.currentTime = 12.3;
    });

    console.log('Pressing section-start shortcut...');
    await page.keyboard.press(';');
    await page.waitForFunction(() => {
      return document.body.textContent?.includes('Start marked at 12.3s') ?? false;
    }, { timeout: 5_000 });

    console.log('Playwright smoke test passed.');
  } finally {
    await browser.close();
  }
}

await main();
