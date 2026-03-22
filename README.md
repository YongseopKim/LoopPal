# Bass Practice Looper

Keyboard-first Chrome extension for `https://www.youtube.com/watch*` pages.
It keeps bass practice sections in `chrome.storage.local`, restores the last
session for each video, and renders an always-visible practice panel below the
YouTube player.

## Current MVP

- Stores up to 10 sections per YouTube `videoId`
- Restores the last loop state, selected section, and saved speed on reload
- Separates section selection from section execution
- Creates sections from a marked start/end pair
- Nudges selected section boundaries in `0.1s` steps
- Steps playback speed in `0.05x` increments
- Shows all saved sections in one list under the player
- Lets you click a saved section to run it immediately
- Renders clickable toolbar buttons with hover help for each shortcut
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
mounted below the player, shows the saved section list, runs a clicked section,
and responds to the Mark Start toolbar button.
It is a real-browser smoke test for the built runtime, not a full Chrome
extension installation test.

If Chrome is not installed in the default macOS location, set
`BASS_PRACTICE_CHROME_BIN` to a local Chrome or Chromium binary.

## Load In Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this project's `dist/` directory

## Panel UI

- The top toolbar shows the selected section, current loop state, speed buttons,
  `Start +/- 0.1`, `End +/- 0.1`, `Mark Start`, `Mark End`, and `Loop On/Off`
- Hover any toolbar button to see what it does and the matching shortcut
- The section list under the toolbar always shows every saved section
- Clicking a section row immediately jumps to it and starts looping it
- Only the selected section shows its memo inline

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
2. Click `Mark Start` or press `;` at the section start.
3. Click `Mark End` or press `'` at the section end.
4. Enter the section name and memo in the prompts.
5. Click a section row to jump to it immediately, or use `[` and `]` to move selection without changing playback.
6. Press `\` to run the currently selected section.
7. Use the toolbar buttons or `-`, `=`, `,`, `.` to fine-tune the selected section.
8. Use the toolbar buttons or `O` and `P` to adjust speed.

If no saved session exists yet, the overlay still appears and the speed
shortcuts can create the initial per-video session state.

## Manual QA Checklist

1. Run `npm run test:smoke`.
2. Run `npm run build`.
3. Load `dist/` as an unpacked extension in Chrome.
4. Open a `https://www.youtube.com/watch*` page.
5. Confirm the toolbar and full section list are visible below the player.
6. Create two sections with `Mark Start`/`Mark End` or `;` then `'`, and confirm the name/memo prompts save.
7. Click a saved section row and confirm playback jumps to it immediately and starts looping.
8. Use `[` and `]` to change selection without playback changing, then `\` to run the selected loop.
9. Use the toolbar buttons or `-`, `=`, `,`, `.` and confirm the selected loop boundaries move in `0.1s` steps.
10. Use the toolbar buttons or `O` and `P` and confirm playback rate changes in `0.05x` steps.
11. Hover toolbar buttons and confirm the help text includes the action and shortcut.
12. Refresh the page and confirm the previous session restores.
13. Navigate to a different watch page and confirm the runtime rebinds to the new player.

## Notes

- Data is stored locally in `chrome.storage.local`.
- The current MVP uses browser prompts for section name and memo entry.
- There is no popup page, sync, import/export, or sharing flow in this branch.
