# LoopPal

<p align="center">
  <img src="./icon1.png" alt="LoopPal logo" width="360" />
</p>

LoopPal is a Chrome extension that helps with repeated practice on YouTube videos.
It is built for `https://www.youtube.com/watch*` pages and focuses on quick section
creation, fine-grained edits, and keyboard-first control.

## Status Snapshot

- The extension is implemented and runnable locally.
- Core flows are covered by unit tests and a browser smoke test.
- Storage is local only (`chrome.storage.local`), no sync/import/export features are
  implemented in this branch.
- `npm run test`, `npm run test:smoke`, and `npm run build` all pass in current state.

## Features Implemented

- Persisted practice sections per YouTube video (`videoId`):
  - Save up to 10 sections per video.
  - Each section stores:
    - name (text)
    - memo (optional note)
    - start/end time (0.1s precision)
    - optional per-section speed override
- Always-visible panel injected below the YouTube player.
- Clear separation between selection and execution:
  - Select section with navigation or direct-slot shortcuts.
  - Execute a section intentionally.
- Section creation and editing:
  - Mark start and end times to create a section.
  - Fine tune selected section boundaries at `±0.1s`.
- Speed control:
  - Adjust by `0.05x` steps.
  - Stored with last session and restored on reload.
- Loop behavior:
  - Toggle loop for active section.
  - Restores last loop/selection state when possible after refresh.
- Complete section visibility:
  - All saved sections are shown in one list at all times.
  - Only selected section memo is shown inline.
- Section deletion:
  - Per-row delete button.
  - Keyboard shortcut supports `Delete` or `Backspace` for selected section, with confirmation.
- Keyboard-first interaction:
  - Full panel actions are available from toolbar buttons with hover hints.
  - Optional shortcut settings modal to remap every action.

## UX Layout

- Toolbar (always visible):
  - current selected section chip
  - loop state chip
  - playback controls (`speed -`, `speed +`)
  - section fine-tune controls:
    - `Start -0.1`, `Start +0.1`, `End -0.1`, `End +0.1`
  - section marking controls: `Mark Start`, `Mark End`
  - `Loop On/Off` toggle
  - `Shortcuts` button to open key mapping modal
- Section panel:
  - shows all saved sections
  - click to jump/execute section
  - inline delete per row
  - section count and simple notes in a compact layout
- Shortcut modal:
  - change binding per action
  - reset one binding to default
  - reset all bindings
  - shows conflicts when a pressed shortcut is already used

## Default Keyboard Map

- `[` : select previous section
- `]` : select next section
- `\` : execute selected section
- `Delete` or `Backspace` : delete selected section (confirmation required)
- `/` : toggle shortcut panel
- `;` : mark section start
- `'` : mark section end and save
- `-` : nudge selected start backward (`-0.1s`)
- `=` : nudge selected start forward (`+0.1s`)
- `,` : nudge selected end backward (`-0.1s`)
- `.` : nudge selected end forward (`+0.1s`)
- `O` : decrease speed by `0.05x`
- `P` : increase speed by `0.05x`
- `NumPad 1~0` : select section 1~10 by list order

> You can remap shortcuts from the `Shortcuts` modal.

## Keyboard Map Persistence

- Keymap overrides are persisted in `chrome.storage.local`.
- Remapping takes effect immediately after save.
- `Reset` and `Reset all` restore defaults.

## Manual Data Model

For each YouTube `videoId`, session state is stored with:

- `defaultSpeed`
- `loopEnabled`
- `selectedSectionId`
- `activeSectionId`
- `sections` (max 10 entries)
- section details (`id`, `name`, `memo`, `startTimeSec`, `endTimeSec`, `speedOverride`, `order`, `updatedAt`)

Section order is used for list rendering and direct slot mapping.

## Development

### Commands

```bash
npm install
npm run test
npm run test:smoke
npm run build
```

- `npm run test`: unit tests (Vitest)
- `npm run test:smoke`: browser smoke test via Playwright (loads built bundle into
  a mocked YouTube route and verifies core interactions)
- `npm run build`: builds `dist/` bundle and copied assets

If Chrome is not at default path on macOS, set:

```bash
export BASS_PRACTICE_CHROME_BIN=/path/to/Chrome.app/Contents/MacOS/Google\ Chrome
```

### Loading in Chrome

1. Download the latest release package:
   [LoopPal latest](https://github.com/YongseopKim/LoopPal/releases/latest/download/looppal-chrome-extension.zip)
2. Unzip `looppal-chrome-extension.zip`
3. Open `chrome://extensions`
4. Enable `Developer mode`
5. Click `Load unpacked`
6. Select the unzipped folder

You can also build locally and load `dist/` directly if you prefer.

### Release flow

- `main` branch pushes keep a build artifact in GitHub Actions.
- Creating a tag that matches `v*` (예: `v0.1.0`) publishes a release and uploads
  `looppal-chrome-extension.zip` as an asset.

## Manual QA Checklist

1. Load extension and open a YouTube watch page.
2. Confirm panel appears below player (not in center) after page load.
3. Create a section:
   - press `;` at the start point,
   - move to end point,
   - press `'`,
   - enter section name and memo.
4. Verify saved sections are listed together in one list.
5. Click a row; confirm jump + loop start.
6. Verify `[` / `]` changes selection only.
7. Execute with `\` and verify it starts from selected section.
8. Use speed controls and boundaries (`±0.1`, `±0.05x`) and confirm expected movement.
9. Delete a section via row button, then via shortcut, with confirmation.
10. Open Shortcuts modal, remap one key, confirm immediate update and persistence.
11. Press `/` to toggle panel and confirm it reflects current binding list.
12. Refresh and confirm loop/session restore.
13. Navigate to another watch video and confirm extension rebinds automatically.

## Notes

- No popup page is implemented.
- No cloud sync, import/export, or sharing workflow is implemented in this version.
- Input prompts are browser-native (`prompt`) for section name/memo and confirm dialogs.
- Data is intentionally local-first.
