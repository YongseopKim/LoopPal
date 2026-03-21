# YouTube Bass Practice Chrome Extension Design

Date: 2026-03-21
Status: Draft approved in conversation, written for spec review

## Summary

Build a Chrome extension for `youtube.com/watch` that turns a YouTube video into a practice session for bass players. The extension should let the user save up to 10 repeatable practice sections per video, refine section boundaries in `0.1s` steps, adjust playback speed in `0.05x` steps, and resume the last practice state when reopening the same video.

The recommended product shape is a keyboard-first experience with a small always-visible overlay on top of the YouTube player. The overlay shows current practice state at a glance and expands in place for section management and editing.

## Problem Definition

The user practices bass by playing along with YouTube videos that include tablature on screen. Their current workflow is limited by three issues:

1. Practice sections are scattered throughout a song, but repeat ranges have to be set manually each time.
2. YouTube controls are too coarse for precise section boundaries, so loop start and end points often feel slightly wrong.
3. YouTube speed control is not granular enough for deliberate practice.

The core problem is not generic video playback. It is repeated, precise, low-friction rehearsal of multiple saved sections inside a single YouTube video.

## Goals

1. Reduce the friction of setting up repeated practice sections.
2. Support multiple named practice sections per video.
3. Allow section boundary adjustment with `0.1s` precision.
4. Allow playback speed adjustment with `0.05x` precision.
5. Keep interaction fast during practice, with keyboard as the primary input method.
6. Restore the user's last practice context when the same video is opened again.

## Non-Goals

1. Support for pages outside `youtube.com/watch`
2. Cloud sync, export/import, or sharing
3. Sample-level or frame-perfect editing
4. Full audio-editor style waveform tools
5. Multi-user collaboration

## Chosen UX Direction

Three high-level options were considered:

1. Large in-player overlay
2. Popup or side-panel centric controls
3. Small always-visible overlay with in-place expansion

The chosen direction is option 3, implemented as:

1. A small overlay bar that is always visible on the YouTube player
2. A larger expandable panel anchored to the same overlay for section list and editing
3. Keyboard-first interaction, with mouse support as secondary

This direction best matches the user's preference for:

1. Always-visible status
2. Keyboard-heavy use
3. Fast switching between sections and precise adjustment without leaving the video

## Primary User Flow

### During practice

1. Open a YouTube watch page.
2. See a small overlay showing current selection, current loop, playback speed, and loop status.
3. Use keyboard shortcuts to mark a rough start and end while the video is playing.
4. Refine the saved section with `+/-0.1s` adjustments before or after saving.
5. Move selection between saved sections without executing them immediately.
6. Press a separate execute shortcut to jump to the selected section and start loop playback.
7. Adjust playback speed in `0.05x` increments as needed.

### On return to the same video

1. Reopen the same `youtube.com/watch` video.
2. The extension restores:
   - saved sections for that video
   - last selected section
   - last active loop
   - last playback speed
   - loop enabled state
3. The extension attempts to continue the practice session immediately.
4. If autoplay or programmatic playback is blocked, the UI falls back to a ready-to-resume state with the correct section and speed already applied.

## UI Design

### Small always-visible overlay bar

The always-visible bar should stay compact and readable over the player. It should show:

1. Selected section name
2. Active loop section name, if different
3. Current playback speed
4. Loop on/off state
5. A compact hint for the most important shortcuts

The bar should avoid covering tablature more than necessary. It should be visually lightweight, fixed in a predictable location, and remain usable without becoming the main thing on screen.

### Expandable management panel

The overlay can expand into an in-player panel for heavier actions:

1. View the saved section list for the current video
2. See section names and short memos
3. Create a new section
4. Edit name and memo
5. Fine-adjust start and end times
6. Delete a section
7. Set or clear a section-specific speed override

The panel should still be temporary and subordinate to the small overlay. It exists to finish a task, then collapse.

## Interaction Model

### Section creation

The user prefers a hybrid creation flow:

1. Mark start and end quickly during playback
2. Save a rough range
3. Fine-tune with `0.1s` nudges

This is faster than forcing precise initial capture and more practical than purely numeric editing.

### Section navigation and execution

Selection and execution are intentionally separate:

1. Previous/next section shortcuts move the current selection only
2. A separate execute shortcut jumps to the selected section and starts looping

This reduces accidental playback jumps while browsing saved sections.

### Playback speed

Speed behavior supports both session-level and per-section needs:

1. Each video stores a default practice speed
2. Each section may optionally override that speed
3. When a section is executed, its override speed applies if present
4. Otherwise the video default speed applies

## Proposed Data Model

Store state by YouTube `videoId` in local extension storage.

### Video session record

```ts
type VideoPracticeSession = {
  videoId: string;
  videoTitle?: string;
  defaultSpeed: number;
  loopEnabled: boolean;
  selectedSectionId: string | null;
  activeSectionId: string | null;
  panelExpanded: boolean;
  updatedAt: number;
  sections: PracticeSection[];
};

type PracticeSection = {
  id: string;
  name: string;
  memo: string;
  startTimeSec: number;
  endTimeSec: number;
  speedOverride: number | null;
  order: number;
  updatedAt: number;
};
```

### Constraints

1. Maximum `10` sections per video
2. `startTimeSec < endTimeSec`
3. Start and end are stored as decimal seconds and edited in `0.1s` steps
4. Speeds change in `0.05x` steps

## Persistence Rules

Use local browser storage only. No cloud sync is required.

Persistence behavior:

1. A session is keyed by `videoId`
2. Loading the same video restores the last known session state
3. The extension should save eagerly after meaningful changes, not only on page unload
4. Section order should be stable between visits

## Runtime Behavior

### Loop playback

When a section is active:

1. Seek to the section start
2. Apply resolved speed
3. Monitor playback position
4. Jump back to section start when playback reaches section end

### Restored playback

When returning to a video:

1. Load stored session state
2. Restore the selected section and active section
3. Restore resolved speed
4. Re-enable loop mode if it was on
5. Attempt playback
6. If blocked, surface a small status message and keep the player ready to resume

## Technical Architecture

Use standard Chrome Extension Manifest V3 architecture.

### Components

1. `content script`
   - Detects YouTube watch pages
   - Locates and controls the YouTube player
   - Renders the overlay UI
   - Handles section timing, playback monitoring, and keyboard shortcuts

2. `service worker`
   - Manages extension lifecycle concerns
   - Coordinates storage and future background-only features if needed

3. `storage layer`
   - Wraps `chrome.storage.local`
   - Validates and normalizes saved data

4. `UI state/controller layer`
   - Keeps current session state consistent between player events, keyboard events, and storage writes

### Why keep core runtime in the content script

Loop timing, player reads, and user keystrokes are tightly coupled to the active YouTube page. Running the practice session logic in the content script avoids unnecessary messaging overhead and keeps the behavior easier to reason about.

## Error Handling and Edge Cases

Handle the following cases explicitly:

1. YouTube player not ready yet
2. Route changes between videos on YouTube's single-page app shell
3. Ad playback or non-standard player states
4. Invalid stored ranges after a video changes or bad data is present
5. Attempting to save an 11th section
6. Playback restoration blocked by browser autoplay rules
7. Section start or end nudged out of legal bounds

Expected behaviors:

1. Disable controls until the player is ready
2. Re-bind state when the active `videoId` changes
3. Clamp invalid times to legal bounds
4. Block invalid saves and explain why
5. Show a clear replacement or delete-first flow when at the 10-section limit
6. Gracefully degrade from autoplay to ready-to-play state

## Testing Scope

### Unit-level tests

1. Session storage CRUD by `videoId`
2. Section validation and normalization
3. `0.1s` nudge behavior
4. `0.05x` speed stepping
5. Speed resolution precedence: section override over video default
6. Selection navigation without execution
7. Restore-state resolution logic

### Integration and manual tests

1. Create a section from live playback
2. Refine start and end times
3. Save memo and name
4. Navigate selected section without playback jumps
5. Execute selected section and verify looping
6. Switch between section-specific speed and video default speed
7. Refresh or reopen the same video and verify session restore
8. Verify behavior when autoplay restoration is blocked
9. Verify YouTube SPA navigation between different videos

## Open Implementation Decisions

These are intentionally left for implementation planning rather than product design:

1. Exact default keyboard shortcut mapping
2. Exact overlay location and styling details
3. Whether keyboard shortcuts are configurable in-app, via Chrome commands, or both
4. Whether the overlay uses vanilla DOM or a UI framework

## Acceptance Criteria

The MVP is complete when all of the following are true:

1. On `youtube.com/watch`, the extension shows a compact always-visible practice overlay
2. A user can create, edit, delete, and run up to `10` saved sections per video
3. Section boundaries can be adjusted in `0.1s` increments
4. Playback speed can be adjusted in `0.05x` increments
5. Section navigation and execution are separate actions
6. Name and memo are saved for each section
7. State persists in local browser storage by `videoId`
8. Reopening the same video restores the previous practice context
9. If autoplay restoration is blocked, the extension remains in a correct ready-to-resume state
