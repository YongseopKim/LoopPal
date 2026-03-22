# Repository Guidelines

## Project Structure & Module Organization
LoopPal is a TypeScript Chrome extension with a strict `src` → `dist` flow.

- `src/background/`: extension lifecycle hooks (currently install-time logging).
- `src/content/`: YouTube runtime entry (`index.ts`), UI overlay, and runtime helpers.
- `src/core/`: session/state logic that is shared by content controllers.
- `src/assets/`: extension icons and other static assets.
- `scripts/`: local build and smoke-test automation.
- `tests/`: unit and integration tests, separated by domain (`tests/core`, `tests/content`).
- `dist/`: generated build artifacts (`content.js`, `background.js`, `overlay.css`, `manifest.json`, icons). Rebuild this directory with `npm run build`.
- `manifest.json`, `package.json`, `.github/workflows/`, and `README.md` are the primary project-level configuration/docs files.

## Build, Test, and Development Commands
- `npm install`: install dev dependencies for build/test tooling.
- `npm run build`: bundle `src/content/index.ts` and `src/background/index.ts` into `dist/`, copy manifest/CSS/icons.
- `npm run test`: run Vitest unit tests (`jsdom`, `globals` enabled).
- `npm run test:watch`: run Vitest in watch mode.
- `npm run test:smoke`: run the Playwright-based smoke check against the built bundle.
- `npm run check`: run `npm run test && npm run build`.
- Mandatory after code edits: run `npm run build`, `npm run test`, then `npm run test:smoke` (in this order).
- For smoke tests on non-default Chrome paths:
  - `export BASS_PRACTICE_CHROME_BIN=/path/to/Chrome`

## Coding Style & Naming Conventions
- TypeScript is strict (`tsconfig.json`) with ES2022 modules and semicolon-terminated, single-quote style.
- Prefer 2-space indentation and keep existing formatting in place.
- Use clear, descriptive function names with action verbs (`createAppController`, `findWatchPlayerVideo`, `handlePlaybackStart`).
- Use explicit storage keys and domain prefixes (`video:<videoId>` in storage).
- Files are organized by feature area, then concern (`content/runtime`, `content/ui`, `core/session`).

## Testing Guidelines
- Framework: Vitest; browser behavior smoke coverage via Playwright.
- Test files should be named `*.test.ts` and live near the feature area (`tests/content/...`, `tests/core/...`).
- Keep tests deterministic: mock browser/YouTube globals instead of depending on network.
- Run at least `npm run check` before handoff; add/adjust tests alongside behavior changes.

## Commit & Pull Request Guidelines
- Commit history uses Conventional Commit prefixes:
  - `feat:`, `fix:`, `chore:`, `test:`
- Write commit subjects in imperative mood and keep each commit focused.
- PRs should include:
  - a short summary of user-visible behavior changes,
  - verification command outputs (`npm run check`, specific test names when needed),
  - linked issue/goal reference when applicable,
  - screenshots or short reproduction steps for UI-related changes.
- If changing `manifest.json` permissions, call out privacy/security impact explicitly.

## Security & Configuration Notes
- Data is stored locally via `chrome.storage.local`; no external sync/import/export is implemented.
- Restrict behavior to required hosts (`https://www.youtube.com/*`), and avoid adding unnecessary manifest permissions.

## Release & Distribution Checklist
- For every release candidate: run `npm run check`.
- Tag releases with semantic versions, e.g. `v1.2.3`.
- CI publishes on tags matching `v*` and attaches `looppal-chrome-extension.zip`.
- Ensure `dist/` is cleanly regenerated in CI (`npm run build`) before packaging.
- For manual distribution/testing:
  - `npm run build`
  - `zip -r looppal-chrome-extension.zip dist`
  - Load `dist/` in `chrome://extensions` (Developer mode → Load unpacked).
