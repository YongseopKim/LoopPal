# Bass Practice Looper

Keyboard-first Chrome extension for `https://www.youtube.com/watch*` pages.
It keeps bass practice sections in `chrome.storage.local`, restores the last
session for each video, and renders a small always-visible practice panel below
the YouTube player.

## Current MVP

- Stores up to 10 sections per YouTube `videoId`
- Restores the last loop state, selected section, and saved speed on reload
- Separates section selection from section execution
- Creates sections from a marked start/end pair
- Nudges selected section boundaries in `0.1s` steps
- Steps playback speed in `0.05x` increments
- Prompts for section name and memo when a new section is created

## Development

```bash
npm install
npm run test
npm run test:smoke
npm run build
```

`npm run test` is the fast jsdom/unit suite.
`npm run test:smoke` launches local Chrome through Playwright, loads the built
content bundle on a routed YouTube watch page, and verifies that the panel is
mounted below the player, stays visible in the viewport, and responds to the
section-start shortcut.
It is a real-browser smoke test for the built runtime, not a full Chrome
extension installation test.

If Chrome is not installed in the default macOS location, set
`BASS_PRACTICE_CHROME_BIN` to a local Chrome or Chromium binary.

## Load In Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this project's `dist/` directory

## Default Shortcuts

- `[` select previous saved section
- `]` select next saved section
- `\` execute the selected section and start looping it
- `/` toggle the overlay section list
- `;` mark the current playback time as the new section start
- `'` mark the current playback time as the new section end and save the section
- `-` nudge the selected section start backward by `0.1s`
- `=` nudge the selected section start forward by `0.1s`
- `,` nudge the selected section end backward by `0.1s`
- `.` nudge the selected section end forward by `0.1s`
- `O` decrease speed by `0.05x`
- `P` increase speed by `0.05x`

## Practice Flow

1. Open a YouTube bass practice video.
2. Press `;` at the section start.
3. Press `'` at the section end.
4. Enter the section name and memo in the prompts.
5. Use `[` and `]` to move selection without changing playback.
6. Press `\` to jump to the selected section and loop it.
7. Use `-`, `=`, `,`, `.` to fine-tune the selected section.
8. Use `O` and `P` to adjust speed.

If no saved session exists yet, the overlay still appears and the speed
shortcuts can create the initial per-video session state.

## Manual QA Checklist

1. Run `npm run test:smoke`.
2. Run `npm run build`.
3. Load `dist/` as an unpacked extension in Chrome.
4. Open a `https://www.youtube.com/watch*` page.
5. Create two sections with `;` then `'`, and confirm the name/memo prompts save.
6. Toggle the section list with `/` and confirm the selected and active states are visible.
7. Use `[` and `]` to change selection, then `\` to execute the selected loop.
8. Use `-`, `=`, `,`, `.` and confirm the selected loop boundaries move in `0.1s` steps.
9. Use `O` and `P` and confirm playback rate changes in `0.05x` steps.
10. Refresh the page and confirm the previous session restores.
11. Navigate to a different watch page and confirm the runtime rebinds to the new player.

## Notes

- Data is stored locally in `chrome.storage.local`.
- The current MVP uses browser prompts for section name and memo entry.
- There is no popup page, sync, import/export, or sharing flow in this branch.
