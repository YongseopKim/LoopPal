# YouTube Bass Practice Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a keyboard-first Chrome extension for `youtube.com/watch` that stores up to 10 loop sections per video, supports `0.1s` loop edits and `0.05x` speed steps, and restores the last practice session from local storage.

**Architecture:** Keep the MVP runtime inside a content script that talks directly to the page `<video>` element. Isolate pure session logic and storage helpers in `src/core/` so they can be tested without the browser. Render a small always-visible overlay over the player and expand it in place for section management, while a minimal MV3 service worker exists only to satisfy the manifest and leave room for later background features.

**Tech Stack:** TypeScript, Chrome Extension Manifest V3, esbuild, Vitest, jsdom

---

## Planned File Structure

- `package.json`: npm scripts and development dependencies
- `tsconfig.json`: TypeScript compiler settings for source and tests
- `vitest.config.ts`: jsdom-based test runner configuration
- `scripts/build.mjs`: bundles content/background scripts and copies static assets into `dist/`
- `manifest.json`: MV3 manifest pointing at the bundled assets
- `.gitignore`: ignores `node_modules/` and `dist/`
- `src/background/index.ts`: minimal service worker entry
- `src/content/index.ts`: content-script bootstrap for YouTube watch pages
- `src/content/overlay.css`: overlay and panel styles
- `src/content/runtime/youtubePage.ts`: watch-page detection and YouTube SPA navigation hooks
- `src/content/runtime/youtubePlayer.ts`: wrapper around the page `<video>` element
- `src/content/runtime/defaultKeymap.ts`: default action-to-key mapping in one place
- `src/content/runtime/shortcutController.ts`: keyboard event routing
- `src/content/runtime/loopMonitor.ts`: loop-end detection while a section is active
- `src/content/runtime/appController.ts`: wiring between player, store, shortcuts, and overlay
- `src/content/ui/overlayView.ts`: always-visible overlay bar and expandable panel DOM
- `src/core/session/types.ts`: persisted session types plus runtime-only controller state
- `src/core/session/sessionMath.ts`: pure time/speed math and validation helpers
- `src/core/session/sessionReducer.ts`: pure state transitions for selection, execution, and edits
- `src/core/session/storage.ts`: `chrome.storage.local` adapter with normalization
- `tests/core/sessionMath.test.ts`: time and speed helper tests
- `tests/core/sessionReducer.test.ts`: state transition tests
- `tests/core/storage.test.ts`: persistence tests with fake storage
- `tests/content/youtubePage.test.ts`: URL parsing and route-change detection tests
- `tests/content/youtubePlayer.test.ts`: player wrapper behavior tests
- `tests/content/overlayView.test.ts`: UI rendering and expansion tests
- `tests/content/shortcutController.test.ts`: keyboard routing tests
- `tests/content/appController.test.ts`: restore/loop/autoplay fallback integration tests
- `README.md`: local development, build, load-unpacked, and manual QA instructions

## Notes Before Starting

- Use `@superpowers:test-driven-development` discipline for every task after Task 1.
- Use `@superpowers:verification-before-completion` before claiming the feature is done.
- The repo is currently empty, so Task 1 is the only bootstrap task that is not driven by a pre-existing failing unit test.

### Task 1: Bootstrap the extension workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `scripts/build.mjs`
- Create: `manifest.json`
- Create: `src/background/index.ts`
- Create: `src/content/index.ts`
- Create: `src/content/overlay.css`
- Modify: `.gitignore`

- [ ] **Step 1: Add npm scripts and dependencies**

```json
{
  "name": "my-bass-tutor",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "npm run test && npm run build"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.270",
    "esbuild": "^0.25.0",
    "jsdom": "^26.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Add TypeScript, Vitest, and build config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

```js
// scripts/build.mjs
import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/content/index.ts'], bundle: true, outfile: 'dist/content.js' });
await build({ entryPoints: ['src/background/index.ts'], bundle: true, outfile: 'dist/background.js' });
await cp('manifest.json', 'dist/manifest.json');
await cp('src/content/overlay.css', 'dist/overlay.css');
```

- [ ] **Step 3: Add the MV3 shell and stub entry points**

```json
{
  "manifest_version": 3,
  "name": "Bass Practice Looper",
  "version": "0.1.0",
  "background": { "service_worker": "background.js", "type": "module" },
  "permissions": ["storage"],
  "host_permissions": ["https://www.youtube.com/*"],
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/watch*"],
      "js": ["content.js"],
      "css": ["overlay.css"],
      "run_at": "document_idle"
    }
  ]
}
```

```ts
// src/content/index.ts
console.info('bass-practice content script loaded');
```

```ts
// src/background/index.ts
chrome.runtime.onInstalled.addListener(() => {
  console.info('bass-practice extension installed');
});
```

- [ ] **Step 4: Install dependencies and verify the workspace builds**

Run: `npm install`  
Expected: packages install without errors and `package-lock.json` is created

Run: `npm run build`  
Expected: exit code `0` and `dist/manifest.json`, `dist/content.js`, `dist/background.js`, `dist/overlay.css` exist

- [ ] **Step 5: Commit the bootstrap**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vitest.config.ts scripts/build.mjs manifest.json src/background/index.ts src/content/index.ts src/content/overlay.css
git commit -m "chore: bootstrap chrome extension workspace"
```

### Task 2: Implement session time and speed math

**Files:**
- Create: `src/core/session/types.ts`
- Create: `src/core/session/sessionMath.ts`
- Test: `tests/core/sessionMath.test.ts`

- [ ] **Step 1: Write the failing math tests**

```ts
import { describe, expect, it } from 'vitest';
import { clampSectionRange, normalizeTime, stepSpeed } from '../../src/core/session/sessionMath';

describe('sessionMath', () => {
  it('rounds times to 0.1s precision', () => {
    expect(normalizeTime(12.26)).toBe(12.3);
    expect(normalizeTime(12.24)).toBe(12.2);
  });

  it('clamps section ranges to video bounds', () => {
    expect(clampSectionRange(-0.1, 191.2, 180.4)).toEqual({
      startTimeSec: 0,
      endTimeSec: 180.4,
    });
  });

  it('steps playback speed in 0.05x increments', () => {
    expect(stepSpeed(0.75, 1)).toBe(0.8);
    expect(stepSpeed(0.75, -1)).toBe(0.7);
  });
});
```

- [ ] **Step 2: Run the math test and verify it fails**

Run: `npm run test -- tests/core/sessionMath.test.ts`  
Expected: FAIL with module-not-found or missing-export errors for `sessionMath`

- [ ] **Step 3: Write the minimal math helpers**

```ts
export type PracticeSection = {
  id: string;
  name: string;
  memo: string;
  startTimeSec: number;
  endTimeSec: number;
  speedOverride: number | null;
  order: number;
  updatedAt: number;
};

export type VideoPracticeSession = {
  videoId: string;
  defaultSpeed: number;
  loopEnabled: boolean;
  selectedSectionId: string | null;
  activeSectionId: string | null;
  sections: PracticeSection[];
  resolvedSpeed?: number; // runtime-only, never persisted
};

export function normalizeTime(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

export function clampSectionRange(startTimeSec: number, endTimeSec: number, durationSec: number) {
  const start = Math.min(normalizeTime(startTimeSec), durationSec);
  const minEnd = Math.min(durationSec, start + 0.1);
  const end = Math.max(minEnd, Math.min(normalizeTime(endTimeSec), durationSec));
  return { startTimeSec: start, endTimeSec: normalizeTime(end) };
}

export function stepSpeed(currentSpeed: number, direction: -1 | 1): number {
  const stepped = currentSpeed + direction * 0.05;
  return Math.min(2, Math.max(0.25, Math.round(stepped * 20) / 20));
}
```

- [ ] **Step 4: Run the math test and verify it passes**

Run: `npm run test -- tests/core/sessionMath.test.ts`  
Expected: PASS with all `sessionMath` tests green

- [ ] **Step 5: Commit the math layer**

```bash
git add src/core/session/types.ts src/core/session/sessionMath.ts tests/core/sessionMath.test.ts
git commit -m "feat: add session math helpers"
```

### Task 3: Implement pure session state transitions

**Files:**
- Create: `src/core/session/sessionReducer.ts`
- Test: `tests/core/sessionReducer.test.ts`

- [ ] **Step 1: Write the failing reducer tests**

```ts
import { describe, expect, it } from 'vitest';
import { reduceSession } from '../../src/core/session/sessionReducer';

it('moves selection without activating a loop', () => {
  const next = reduceSession(seedSession, { type: 'selectNextSection' });
  expect(next.selectedSectionId).toBe('section-2');
  expect(next.activeSectionId).toBeNull();
});

it('activates the selected section and resolves speed override', () => {
  const next = reduceSession(seedSession, { type: 'executeSelectedSection' });
  expect(next.activeSectionId).toBe('section-1');
  expect(next.resolvedSpeed).toBe(0.65);
});

it('rejects an 11th section', () => {
  expect(() => reduceSession(fullSession, { type: 'createSection', payload: newSection })).toThrow(/10 sections/);
});
```

- [ ] **Step 2: Run the reducer test and verify it fails**

Run: `npm run test -- tests/core/sessionReducer.test.ts`  
Expected: FAIL because `reduceSession` does not exist yet

- [ ] **Step 3: Write the minimal reducer**

```ts
export function reduceSession(session: VideoPracticeSession, action: SessionAction): VideoPracticeSession {
  switch (action.type) {
    case 'selectNextSection':
      return { ...session, selectedSectionId: getAdjacentSectionId(session, 1) };
    case 'executeSelectedSection': {
      const activeSection = getSectionById(session, session.selectedSectionId);
      return {
        ...session,
        activeSectionId: activeSection?.id ?? null,
        loopEnabled: Boolean(activeSection),
        resolvedSpeed: activeSection?.speedOverride ?? session.defaultSpeed,
      };
    }
    default:
      return session;
  }
}
```

- [ ] **Step 4: Run the reducer test and verify it passes**

Run: `npm run test -- tests/core/sessionReducer.test.ts`  
Expected: PASS with state transitions covering selection, execution, and the 10-section limit

- [ ] **Step 5: Commit the reducer**

```bash
git add src/core/session/sessionReducer.ts tests/core/sessionReducer.test.ts
git commit -m "feat: add practice session reducer"
```

### Task 4: Implement local storage persistence

**Files:**
- Create: `src/core/session/storage.ts`
- Test: `tests/core/storage.test.ts`

- [ ] **Step 1: Write the failing storage tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSessionStore } from '../../src/core/session/storage';

it('loads a saved session by video id', async () => {
  const storageArea = fakeStorage({ 'video:abc123': seedSession });
  const store = createSessionStore(storageArea);
  await expect(store.load('abc123')).resolves.toMatchObject({ videoId: 'abc123' });
});

it('normalizes and saves sessions by video id', async () => {
  const storageArea = fakeStorage();
  const store = createSessionStore(storageArea);
  await store.save(dirtySession);
  expect(storageArea.set).toHaveBeenCalledWith(expect.objectContaining({ 'video:abc123': expect.any(Object) }));
});
```

- [ ] **Step 2: Run the storage test and verify it fails**

Run: `npm run test -- tests/core/storage.test.ts`  
Expected: FAIL because `createSessionStore` does not exist yet

- [ ] **Step 3: Write the minimal storage adapter**

```ts
type StorageAreaLike = Pick<chrome.storage.StorageArea, 'get' | 'set'>;

export function createSessionStore(storageArea: StorageAreaLike) {
  return {
    async load(videoId: string) {
      const key = `video:${videoId}`;
      const result = await storageArea.get(key);
      return result[key] ?? null;
    },
    async save(session: VideoPracticeSession) {
      const key = `video:${session.videoId}`;
      await storageArea.set({ [key]: normalizeSession(session) }); // strips runtime-only fields like resolvedSpeed
    },
  };
}
```

- [ ] **Step 4: Run the storage test and verify it passes**

Run: `npm run test -- tests/core/storage.test.ts`  
Expected: PASS with load/save behavior green

- [ ] **Step 5: Commit the storage layer**

```bash
git add src/core/session/storage.ts tests/core/storage.test.ts
git commit -m "feat: add local session storage"
```

### Task 5: Implement YouTube page and player adapters

**Files:**
- Create: `src/content/runtime/youtubePage.ts`
- Create: `src/content/runtime/youtubePlayer.ts`
- Test: `tests/content/youtubePage.test.ts`
- Test: `tests/content/youtubePlayer.test.ts`

- [ ] **Step 1: Write the failing page and player tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { extractVideoId, isWatchPage } from '../../src/content/runtime/youtubePage';
import { createYoutubePlayer } from '../../src/content/runtime/youtubePlayer';

it('detects YouTube watch pages and extracts the video id', () => {
  expect(isWatchPage('https://www.youtube.com/watch?v=abc123')).toBe(true);
  expect(extractVideoId('https://www.youtube.com/watch?v=abc123&t=12')).toBe('abc123');
});

it('reports autoplay blocking when play() is rejected', async () => {
  const video = document.createElement('video');
  video.play = vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
  const player = createYoutubePlayer(video);
  await expect(player.playSafely()).resolves.toBe('blocked');
});
```

- [ ] **Step 2: Run the adapter tests and verify they fail**

Run: `npm run test -- tests/content/youtubePage.test.ts tests/content/youtubePlayer.test.ts`  
Expected: FAIL because page/player helpers do not exist yet

- [ ] **Step 3: Write the minimal adapters**

```ts
export function isWatchPage(rawUrl: string): boolean {
  const url = new URL(rawUrl);
  return url.hostname === 'www.youtube.com' && url.pathname === '/watch' && url.searchParams.has('v');
}

export function extractVideoId(rawUrl: string): string | null {
  return isWatchPage(rawUrl) ? new URL(rawUrl).searchParams.get('v') : null;
}

export function createYoutubePlayer(video: HTMLVideoElement) {
  return {
    getCurrentTime: () => video.currentTime,
    setCurrentTime: (value: number) => { video.currentTime = value; },
    setPlaybackRate: (value: number) => { video.playbackRate = value; },
    async playSafely() {
      try {
        await video.play();
        return 'started' as const;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotAllowedError') return 'blocked' as const;
        throw error;
      }
    },
  };
}
```

- [ ] **Step 4: Run the adapter tests and verify they pass**

Run: `npm run test -- tests/content/youtubePage.test.ts tests/content/youtubePlayer.test.ts`  
Expected: PASS with watch-page parsing and autoplay fallback handling green

- [ ] **Step 5: Commit the adapters**

```bash
git add src/content/runtime/youtubePage.ts src/content/runtime/youtubePlayer.ts tests/content/youtubePage.test.ts tests/content/youtubePlayer.test.ts
git commit -m "feat: add youtube page and player adapters"
```

### Task 6: Implement the always-visible overlay and expandable panel

**Files:**
- Create: `src/content/ui/overlayView.ts`
- Modify: `src/content/overlay.css`
- Test: `tests/content/overlayView.test.ts`

- [ ] **Step 1: Write the failing overlay tests**

```ts
import { describe, expect, it } from 'vitest';
import { createOverlayView } from '../../src/content/ui/overlayView';

it('renders the compact bar with section and speed state', () => {
  const root = document.createElement('div');
  const view = createOverlayView(root);
  view.render(viewModel);
  expect(root.textContent).toContain('Chorus groove');
  expect(root.textContent).toContain('0.75x');
});

it('shows the saved section list when expanded', () => {
  const root = document.createElement('div');
  const view = createOverlayView(root);
  view.render({ ...viewModel, panelExpanded: true });
  expect(root.textContent).toContain('memo: mute on beat 4');
});
```

- [ ] **Step 2: Run the overlay test and verify it fails**

Run: `npm run test -- tests/content/overlayView.test.ts`  
Expected: FAIL because `createOverlayView` does not exist yet

- [ ] **Step 3: Write the minimal overlay renderer**

```ts
export function createOverlayView(root: HTMLElement) {
  return {
    render(model: OverlayViewModel) {
      root.innerHTML = `
        <div class="bp-overlay">
          <div class="bp-overlay__bar">
            <strong>${model.selectedSectionName ?? 'No section selected'}</strong>
            <span>${model.speedLabel}</span>
            <span>${model.loopEnabled ? 'Loop on' : 'Loop off'}</span>
          </div>
          ${model.panelExpanded ? renderPanel(model) : ''}
        </div>
      `;
    },
  };
}
```

- [ ] **Step 4: Run the overlay test and verify it passes**

Run: `npm run test -- tests/content/overlayView.test.ts`  
Expected: PASS with compact bar and expanded panel rendering green

- [ ] **Step 5: Commit the overlay UI**

```bash
git add src/content/ui/overlayView.ts src/content/overlay.css tests/content/overlayView.test.ts
git commit -m "feat: add overlay practice controls"
```

### Task 7: Implement keyboard shortcut routing

**Files:**
- Create: `src/content/runtime/defaultKeymap.ts`
- Create: `src/content/runtime/shortcutController.ts`
- Test: `tests/content/shortcutController.test.ts`

- [ ] **Step 1: Write the failing shortcut tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createShortcutController } from '../../src/content/runtime/shortcutController';

it('routes a matching key to an action', () => {
  const onAction = vi.fn();
  const controller = createShortcutController({ onAction });
  controller.handle(new KeyboardEvent('keydown', { code: 'BracketRight' }));
  expect(onAction).toHaveBeenCalledWith('selectNextSection');
});

it('ignores key presses inside text inputs', () => {
  const input = document.createElement('input');
  document.body.append(input);
  input.focus();
  const onAction = vi.fn();
  const controller = createShortcutController({ onAction });
  controller.handle(new KeyboardEvent('keydown', { code: 'BracketRight' }));
  expect(onAction).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the shortcut test and verify it fails**

Run: `npm run test -- tests/content/shortcutController.test.ts`  
Expected: FAIL because shortcut handling does not exist yet

- [ ] **Step 3: Write the minimal keymap and controller**

```ts
export const DEFAULT_KEYMAP = {
  selectPreviousSection: 'BracketLeft',
  selectNextSection: 'BracketRight',
  executeSelectedSection: 'Backslash',
  togglePanel: 'Slash',
} as const;

export function createShortcutController({ onAction }: { onAction: (action: ShortcutAction) => void }) {
  return {
    handle(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      const match = Object.entries(DEFAULT_KEYMAP).find(([, code]) => code === event.code);
      if (!match) return;
      event.preventDefault();
      onAction(match[0] as ShortcutAction);
    },
  };
}
```

- [ ] **Step 4: Run the shortcut test and verify it passes**

Run: `npm run test -- tests/content/shortcutController.test.ts`  
Expected: PASS with action routing and input-ignore behavior green

- [ ] **Step 5: Commit the shortcut controller**

```bash
git add src/content/runtime/defaultKeymap.ts src/content/runtime/shortcutController.ts tests/content/shortcutController.test.ts
git commit -m "feat: add keyboard shortcut routing"
```

### Task 8: Integrate the app controller, loop monitor, and restore flow

**Files:**
- Create: `src/content/runtime/loopMonitor.ts`
- Create: `src/content/runtime/appController.ts`
- Modify: `src/content/index.ts`
- Modify: `src/content/ui/overlayView.ts`
- Test: `tests/content/appController.test.ts`

- [ ] **Step 1: Write the failing controller test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createAppController } from '../../src/content/runtime/appController';
import { createLoopMonitor } from '../../src/content/runtime/loopMonitor';

it('restores a saved session and falls back cleanly when autoplay is blocked', async () => {
  const store = { load: vi.fn().mockResolvedValue(seedSession), save: vi.fn() };
  const player = fakePlayer({ playSafely: vi.fn().mockResolvedValue('blocked') });
  const overlay = fakeOverlay();

  const controller = createAppController({ store, player, overlay, videoId: 'abc123' });
  await controller.start();

  expect(player.setPlaybackRate).toHaveBeenCalledWith(0.65);
  expect(overlay.render).toHaveBeenCalledWith(expect.objectContaining({ restoreStatus: 'blocked' }));
});

it('seeks back to the loop start when playback crosses the loop end', async () => {
  const player = fakePlayer({ currentTime: 20.2 });
  const monitor = createLoopMonitor(player);
  monitor.tick({ startTimeSec: 10.1, endTimeSec: 20.1 });
  expect(player.setCurrentTime).toHaveBeenCalledWith(10.1);
});
```

- [ ] **Step 2: Run the controller test and verify it fails**

Run: `npm run test -- tests/content/appController.test.ts`  
Expected: FAIL because controller and monitor do not exist yet

- [ ] **Step 3: Write the minimal integration layer**

```ts
export function createLoopMonitor(player: YoutubePlayer) {
  return {
    tick(section: PracticeSection) {
      if (player.getCurrentTime() >= section.endTimeSec) {
        player.setCurrentTime(section.startTimeSec);
      }
    },
  };
}

export function createAppController(deps: AppControllerDeps) {
  return {
    async start() {
      const session = await deps.store.load(deps.videoId);
      if (!session) return;
      const activeSection = getActiveSection(session);
      const speed = activeSection?.speedOverride ?? session.defaultSpeed;
      deps.player.setPlaybackRate(speed);
      const playResult = session.loopEnabled ? await deps.player.playSafely() : 'idle';
      deps.overlay.render(toViewModel(session, playResult));
    },
  };
}
```

- [ ] **Step 4: Run the controller test and verify it passes**

Run: `npm run test -- tests/content/appController.test.ts`  
Expected: PASS with restore flow, blocked autoplay fallback, and loop-end jump behavior green

- [ ] **Step 5: Commit the integrated runtime**

```bash
git add src/content/runtime/loopMonitor.ts src/content/runtime/appController.ts src/content/index.ts src/content/ui/overlayView.ts tests/content/appController.test.ts
git commit -m "feat: wire the practice session runtime"
```

### Task 9: Add developer docs and run full verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

```md
# Bass Practice Looper

## Development
- `npm install`
- `npm run test`
- `npm run build`

## Load in Chrome
1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked extension from `dist/`

## Manual QA
1. Open a YouTube watch page
2. Create a section
3. Nudge start/end by `0.1s`
4. Change speed by `0.05x`
5. Refresh the page and verify restore behavior
```

- [ ] **Step 2: Run the full automated checks**

Run: `npm run test`  
Expected: PASS with all Vitest suites green

Run: `npm run build`  
Expected: PASS and a fresh `dist/` directory with the current manifest and bundles

- [ ] **Step 3: Run manual verification in Chrome**

Manual checklist:
1. Load `dist/` as an unpacked extension
2. Open a bass practice video on `https://www.youtube.com/watch`
3. Create two sections and confirm selection vs execution behavior
4. Verify `0.1s` nudges and `0.05x` speed stepping
5. Refresh the page and confirm the previous session restores
6. Navigate to another watch page and confirm the overlay rebinds to the new `videoId`

- [ ] **Step 4: Update anything found during verification**

Run: `npm run check`  
Expected: PASS after any final fixes from manual QA

- [ ] **Step 5: Commit the verified MVP**

```bash
git add README.md
git commit -m "docs: add extension usage and verification notes"
```

## Review Notes

- If the final shortcut defaults feel awkward during manual QA, change only `src/content/runtime/defaultKeymap.ts` and rerun the shortcut and app-controller tests.
- Keep loop timing logic in `loopMonitor.ts`; do not spread loop-end comparisons across the UI layer.
- Do not add popup, sync, export/import, waveform, or sharing work in this MVP.
