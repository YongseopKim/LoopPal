import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const contentScriptPath = join(repoRoot, 'dist/content.js');
const overlayCssPath = join(repoRoot, 'dist/overlay.css');
const seededSession = {
  'video:smoke-test': {
    videoId: 'smoke-test',
    defaultSpeed: 0.9,
    loopEnabled: false,
    selectedSectionId: 'section-1',
    activeSectionId: null,
    sections: [
      {
        id: 'section-1',
        name: 'Verse groove',
        memo: 'Keep the eighth notes even',
        startTimeSec: 12.3,
        endTimeSec: 18.8,
        speedOverride: null,
        order: 0,
        updatedAt: 1,
      },
      {
        id: 'section-2',
        name: 'Bridge fill',
        memo: 'Push the hammer-on',
        startTimeSec: 30.1,
        endTimeSec: 35.6,
        speedOverride: 0.75,
        order: 1,
        updatedAt: 2,
      },
    ],
  },
};

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
        color: #f8f5ec;
        font-family: system-ui, sans-serif;
      }

      #primary-inner {
        width: min(960px, calc(100vw - 32px));
        margin: 24px auto;
      }

      #player {
        padding: 16px;
        border-radius: 20px;
        background: #1a2230;
      }

      #below {
        margin-top: 16px;
        padding: 20px;
        border-radius: 20px;
        background: #151b26;
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
    <div id="shell">
      <div id="movie_player">
        <video class="html5-main-video"></video>
      </div>
    </div>
    <script>
      window.setTimeout(() => {
        const shell = document.querySelector('#shell');
        const moviePlayer = shell?.querySelector('#movie_player');

        if (!shell || !moviePlayer) {
          return;
        }

        const primaryInner = document.createElement('div');
        primaryInner.id = 'primary-inner';

        const player = document.createElement('div');
        player.id = 'player';
        player.append(moviePlayer);

        const below = document.createElement('div');
        below.id = 'below';
        below.textContent = 'Below content';

        primaryInner.append(player, below);
        shell.replaceWith(primaryInner);
      }, 120);
    </script>
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

    await page.addInitScript((initialStorageState) => {
      const storageState = { ...initialStorageState };

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

      HTMLMediaElement.prototype.play = function patchedPlay() {
        this.dispatchEvent(new Event('play'));

        return Promise.resolve();
      };
    }, seededSession);

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
    await page.waitForSelector('[data-bp-overlay-root] .bp-overlay', {
      timeout: 5_000,
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('[data-bp-overlay-root]');
      const below = document.querySelector('#below');

      return (
        root instanceof HTMLElement &&
        below instanceof HTMLElement &&
        root.dataset.bpOverlayMode === 'inline' &&
        root.nextElementSibling === below
      );
    }, { timeout: 5_000 });

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
      overlayBox.y > viewport.height
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

    await page.waitForFunction(() => {
      return document.querySelectorAll('.bp-overlay__section').length === 2;
    }, { timeout: 5_000 });

    const selectedMemo = page.locator('.bp-overlay__section--selected .bp-overlay__section-memo');
    await selectedMemo.waitFor({ timeout: 5_000 });

    console.log('Clicking a saved section row...');
    await page.click('[data-section-id="section-2"]');
    await page.waitForFunction(() => {
      return document.body.textContent?.includes('Looping Bridge fill') ?? false;
    }, { timeout: 5_000 });

    const speedButtonTitle = await page.getAttribute(
      '[data-shortcut-action="increaseSpeed"]',
      'title',
    );

    if (!speedButtonTitle?.includes('Increase speed') || !speedButtonTitle.includes('P')) {
      throw new Error(`Missing hover help on the speed button: ${speedButtonTitle}`);
    }

    await page.evaluate(() => {
      const video = document.querySelector('#movie_player video.html5-main-video');

      if (!(video instanceof HTMLVideoElement)) {
        throw new Error('Smoke video element not found before mark-start.');
      }

      video.currentTime = 12.3;
    });

    console.log('Clicking the mark-start button...');
    await page.click('[data-shortcut-action="markSectionStart"]');
    await page.waitForFunction(() => {
      return document.body.textContent?.includes('Start marked at 12.3s') ?? false;
    }, { timeout: 5_000 });

    console.log('Playwright smoke test passed.');
  } finally {
    await browser.close();
  }
}

await main();
