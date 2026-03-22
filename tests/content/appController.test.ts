import { describe, expect, it, vi } from 'vitest';
import type { VideoPracticeSession } from '../../src/core/session/types';
import { createAppController } from '../../src/content/runtime/appController';
import { createLoopMonitor } from '../../src/content/runtime/loopMonitor';

const seedSession: VideoPracticeSession = {
  videoId: 'abc123',
  defaultSpeed: 0.8,
  loopEnabled: true,
  selectedSectionId: 'section-1',
  activeSectionId: 'section-1',
  sections: [
    {
      id: 'section-1',
      name: 'Verse',
      memo: 'Lock the groove',
      startTimeSec: 12.3,
      endTimeSec: 25.4,
      speedOverride: 0.65,
      order: 0,
      updatedAt: 1_710_000_000_000,
    },
    {
      id: 'section-2',
      name: 'Chorus',
      memo: 'Push the accents',
      startTimeSec: 30.1,
      endTimeSec: 44.2,
      speedOverride: null,
      order: 1,
      updatedAt: 1_710_000_000_100,
    },
  ],
};

function fakePlayer(overrides: Partial<ReturnType<typeof basePlayer>> = {}) {
  return {
    ...basePlayer(),
    ...overrides,
  };
}

function basePlayer() {
  return {
    currentTime: 0,
    duration: 180.4,
    playbackRate: 1,
    getCurrentTime: vi.fn(function getCurrentTime(this: { currentTime: number }) {
      return this.currentTime;
    }),
    getDuration: vi.fn(function getDuration(this: { duration: number }) {
      return this.duration;
    }),
    getPlaybackRate: vi.fn(function getPlaybackRate(this: { playbackRate: number }) {
      return this.playbackRate;
    }),
    setCurrentTime: vi.fn(),
    setPlaybackRate: vi.fn(),
    playSafely: vi.fn().mockResolvedValue('started' as const),
  };
}

function fakeOverlay() {
  return {
    render: vi.fn(),
  };
}

describe('appController', () => {
  it('renders an empty practice state when there is no saved session', async () => {
    const store = { load: vi.fn().mockResolvedValue(null), save: vi.fn() };
    const player = fakePlayer({
      playbackRate: 1.15,
      getPlaybackRate: vi.fn().mockReturnValue(1.15),
    });
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await expect(controller.start()).resolves.toBeNull();

    expect(overlay.render).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedSectionName: null,
        activeSectionName: null,
        loopEnabled: false,
        sections: [],
        speedLabel: '1.15x',
      }),
    );
  });

  it('returns null without rendering when there is no saved session', async () => {
    const store = { load: vi.fn().mockResolvedValue(null), save: vi.fn() };
    const player = fakePlayer();
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await expect(controller.start()).resolves.toBeNull();
    expect(player.setPlaybackRate).not.toHaveBeenCalled();
    expect(player.playSafely).not.toHaveBeenCalled();
    expect(overlay.render).toHaveBeenCalledTimes(1);
  });

  it('creates and selects a new section after marking start and end', async () => {
    const store = { load: vi.fn().mockResolvedValue(null), save: vi.fn() };
    const player = fakePlayer();
    const overlay = fakeOverlay();
    const promptForSectionDetails = vi.fn().mockReturnValue({
      name: 'Intro riff',
      memo: 'watch the ghost notes',
    });
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
      createSectionId: () => 'section-new',
      getNow: () => 123,
      promptForSectionDetails,
    });

    await controller.start();

    player.currentTime = 12.34;
    await controller.handleShortcut('markSectionStart');
    player.currentTime = 18.82;
    await controller.handleShortcut('markSectionEnd');

    expect(promptForSectionDetails).toHaveBeenCalledWith({
      name: 'Section 1',
      memo: '',
    });
    expect(store.save).toHaveBeenCalledWith({
      videoId: 'abc123',
      defaultSpeed: 1,
      loopEnabled: false,
      selectedSectionId: 'section-new',
      activeSectionId: null,
      sections: [
        {
          id: 'section-new',
          name: 'Intro riff',
          memo: 'watch the ghost notes',
          startTimeSec: 12.3,
          endTimeSec: 18.8,
          speedOverride: null,
          order: 0,
          updatedAt: 123,
        },
      ],
    });
    expect(overlay.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedSectionName: 'Intro riff',
        activeSectionName: null,
        loopEnabled: false,
      }),
    );
  });

  it('persists a default speed change even when the video has no saved session yet', async () => {
    const store = { load: vi.fn().mockResolvedValue(null), save: vi.fn() };
    const player = fakePlayer({
      playbackRate: 0.8,
      getPlaybackRate: vi.fn().mockReturnValue(0.8),
    });
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await controller.start();
    await controller.handleShortcut('increaseSpeed');

    expect(player.setPlaybackRate).toHaveBeenCalledWith(0.85);
    expect(store.save).toHaveBeenCalledWith({
      videoId: 'abc123',
      defaultSpeed: 0.85,
      loopEnabled: false,
      selectedSectionId: null,
      activeSectionId: null,
      sections: [],
    });
    expect(overlay.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        speedLabel: '0.85x',
      }),
    );
  });

  it('nudges the selected section boundaries in 0.1s steps and persists the edits', async () => {
    const store = { load: vi.fn().mockResolvedValue(seedSession), save: vi.fn() };
    const player = fakePlayer();
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
      getNow: () => 999,
    });

    await controller.start();
    player.setCurrentTime.mockClear();

    await controller.handleShortcut('nudgeSectionStartForward');
    await controller.handleShortcut('nudgeSectionEndBackward');

    expect(player.setCurrentTime).toHaveBeenCalledWith(12.4);
    expect(store.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 'section-1',
            startTimeSec: 12.4,
            endTimeSec: 25.3,
            updatedAt: 999,
          }),
        ]),
      }),
    );
  });

  it('stores a per-section speed override for the selected section', async () => {
    const store = {
      load: vi.fn().mockResolvedValue({
        ...seedSession,
        activeSectionId: null,
        loopEnabled: false,
        selectedSectionId: 'section-2',
      }),
      save: vi.fn(),
    };
    const player = fakePlayer({
      playbackRate: 0.8,
      getPlaybackRate: vi.fn().mockReturnValue(0.8),
    });
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
      getNow: () => 555,
    });

    await controller.start();
    await controller.handleShortcut('decreaseSpeed');

    expect(player.setPlaybackRate).toHaveBeenCalledWith(0.75);
    expect(store.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 'section-2',
            speedOverride: 0.75,
            updatedAt: 555,
          }),
        ]),
      }),
    );
    expect(overlay.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedSectionName: 'Chorus',
        speedLabel: '0.75x',
      }),
    );
  });

  it('restores a saved session and falls back cleanly when autoplay is blocked', async () => {
    const store = { load: vi.fn().mockResolvedValue(seedSession), save: vi.fn() };
    const player = fakePlayer({ playSafely: vi.fn().mockResolvedValue('blocked' as const) });
    const overlay = fakeOverlay();

    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await controller.start();

    expect(player.setCurrentTime).toHaveBeenCalledWith(12.3);
    expect(player.setPlaybackRate).toHaveBeenCalledWith(0.65);
    expect(overlay.render).toHaveBeenCalledWith(
      expect.objectContaining({ restoreStatus: 'blocked' }),
    );
  });

  it('keeps a blocked restore hint until playback actually resumes', async () => {
    const store = { load: vi.fn().mockResolvedValue(seedSession), save: vi.fn() };
    const player = fakePlayer({
      playSafely: vi.fn().mockResolvedValue('blocked' as const),
    });
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await controller.start();
    overlay.render.mockClear();

    await controller.handleShortcut('selectNextSection');

    expect(overlay.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        restoreStatus: 'blocked',
        selectedSectionName: 'Chorus',
      }),
    );

    controller.markPlaybackStarted();

    expect(overlay.render).toHaveBeenLastCalledWith(
      expect.objectContaining({ restoreStatus: 'started' }),
    );
  });

  it('does not autoplay when looping is enabled but the saved section ids are stale', async () => {
    const store = {
      load: vi.fn().mockResolvedValue({
        ...seedSession,
        selectedSectionId: 'missing-section',
        activeSectionId: 'missing-section',
      }),
      save: vi.fn(),
    };
    const player = fakePlayer();
    const overlay = fakeOverlay();

    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await controller.start();

    expect(player.playSafely).not.toHaveBeenCalled();
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSectionId: null,
        loopEnabled: false,
        selectedSectionId: null,
      }),
    );
    expect(overlay.render).toHaveBeenCalledWith(
      expect.objectContaining({
        restoreStatus: 'idle',
        selectedSectionName: null,
        activeSectionName: null,
        loopEnabled: false,
      }),
    );
  });

  it('normalizes loop-enabled restore state when no active section is persisted', async () => {
    const store = {
      load: vi.fn().mockResolvedValue({
        ...seedSession,
        activeSectionId: null,
        loopEnabled: true,
        selectedSectionId: 'section-1',
      }),
      save: vi.fn(),
    };
    const player = fakePlayer();
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await controller.start();

    expect(player.playSafely).not.toHaveBeenCalled();
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSectionId: null,
        loopEnabled: false,
        selectedSectionId: 'section-1',
      }),
    );
    expect(overlay.render).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedSectionName: 'Verse',
        activeSectionName: null,
        loopEnabled: false,
        restoreStatus: 'idle',
      }),
    );
  });

  it('keeps the playback speed label at the current speed when only a section is selected on restore', async () => {
    const store = {
      load: vi.fn().mockResolvedValue({
        ...seedSession,
        loopEnabled: false,
        activeSectionId: null,
        selectedSectionId: 'section-1',
      }),
      save: vi.fn(),
    };
    const player = fakePlayer();
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await controller.start();

    expect(overlay.render).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedSectionName: 'Verse',
        activeSectionName: null,
        speedLabel: '0.8x',
      }),
    );
  });

  it('skips player and overlay side effects after restore is invalidated mid-start', async () => {
    let active = true;
    let resolveLoad: ((value: VideoPracticeSession) => void) | null = null;
    const store = {
      load: vi.fn().mockImplementation(
        () =>
          new Promise<VideoPracticeSession>((resolve) => {
            resolveLoad = resolve;
          }),
      ),
      save: vi.fn(),
    };
    const player = fakePlayer();
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
      isActive: () => active,
    });

    const startPromise = controller.start();

    active = false;
    resolveLoad?.(seedSession);

    await expect(startPromise).resolves.toBeNull();
    expect(player.setPlaybackRate).not.toHaveBeenCalled();
    expect(player.playSafely).not.toHaveBeenCalled();
    expect(overlay.render).not.toHaveBeenCalled();
  });

  it('treats teardown-time autoplay aborts as a cancelled restore', async () => {
    let active = true;
    let resolvePlayStarted: (() => void) | null = null;
    let rejectPlay:
      | ((reason?: DOMException) => void)
      | null = null;
    const playStarted = new Promise<void>((resolve) => {
      resolvePlayStarted = resolve;
    });
    const store = { load: vi.fn().mockResolvedValue(seedSession), save: vi.fn() };
    const player = fakePlayer({
      playSafely: vi.fn().mockImplementation(
        () => {
          resolvePlayStarted?.();

          return (
          new Promise<'started' | 'blocked'>((_resolve, reject) => {
            rejectPlay = reject;
          })
          );
        },
      ),
    });
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
      isActive: () => active,
    });

    const startPromise = controller.start();

    await playStarted;
    active = false;
    rejectPlay?.(new DOMException('aborted', 'AbortError'));

    await expect(startPromise).resolves.toBeNull();
    expect(overlay.render).not.toHaveBeenCalled();
  });

  it('seeks back to the loop start when playback crosses the loop end', () => {
    const player = fakePlayer({ currentTime: 20.2 });
    const monitor = createLoopMonitor(player);

    monitor.tick({ startTimeSec: 10.1, endTimeSec: 20.1 });

    expect(player.setCurrentTime).toHaveBeenCalledWith(10.1);
  });

  it('updates selection, executes the selected section, and toggles the panel from shortcuts', async () => {
    const store = { load: vi.fn().mockResolvedValue(seedSession), save: vi.fn() };
    const player = fakePlayer();
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await controller.start();
    overlay.render.mockClear();
    player.setCurrentTime.mockClear();
    player.setPlaybackRate.mockClear();
    player.playSafely.mockClear();

    await controller.handleShortcut('selectNextSection');

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({ selectedSectionId: 'section-2' }),
    );
    expect(overlay.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedSectionName: 'Chorus',
        activeSectionName: 'Verse',
        speedLabel: '0.65x',
        panelExpanded: false,
      }),
    );

    await controller.handleShortcut('togglePanel');

    expect(overlay.render).toHaveBeenLastCalledWith(
      expect.objectContaining({ panelExpanded: true }),
    );

    await controller.handleShortcut('executeSelectedSection');

    expect(player.setCurrentTime).toHaveBeenCalledWith(30.1);
    expect(player.setPlaybackRate).toHaveBeenCalledWith(0.8);
    expect(player.playSafely).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeSectionId: 'section-2',
        loopEnabled: true,
      }),
    );
  });

  it('executes a clicked section immediately and updates selection', async () => {
    const store = { load: vi.fn().mockResolvedValue(seedSession), save: vi.fn() };
    const player = fakePlayer();
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await controller.start();
    overlay.render.mockClear();
    player.setCurrentTime.mockClear();
    player.setPlaybackRate.mockClear();
    player.playSafely.mockClear();

    await controller.executeSection('section-2');

    expect(player.setCurrentTime).toHaveBeenCalledWith(30.1);
    expect(player.setPlaybackRate).toHaveBeenCalledWith(0.8);
    expect(player.playSafely).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedSectionId: 'section-2',
        activeSectionId: 'section-2',
        loopEnabled: true,
      }),
    );
    expect(overlay.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedSectionName: 'Chorus',
        activeSectionName: 'Chorus',
        loopEnabled: true,
      }),
    );
  });

  it('toggles the current loop off while keeping the selection', async () => {
    const store = { load: vi.fn().mockResolvedValue(seedSession), save: vi.fn() };
    const player = fakePlayer();
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await controller.start();
    overlay.render.mockClear();
    store.save.mockClear();
    player.playSafely.mockClear();

    await controller.toggleLoop();

    expect(player.playSafely).not.toHaveBeenCalled();
    expect(store.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedSectionId: 'section-1',
        activeSectionId: null,
        loopEnabled: false,
      }),
    );
    expect(overlay.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedSectionName: 'Verse',
        activeSectionName: null,
        loopEnabled: false,
      }),
    );
  });

  it('serializes shortcut handling so later inputs win the final rendered state', async () => {
    let resolvePlay: ((value: 'started' | 'blocked') => void) | null = null;
    const store = {
      load: vi.fn().mockResolvedValue({
        ...seedSession,
        loopEnabled: false,
        activeSectionId: null,
      }),
      save: vi.fn(),
    };
    const player = fakePlayer({
      playSafely: vi.fn().mockImplementation(
        () =>
          new Promise<'started' | 'blocked'>((resolve) => {
            resolvePlay = resolve;
          }),
      ),
    });
    const overlay = fakeOverlay();
    const controller = createAppController({
      store,
      player,
      overlay,
      videoId: 'abc123',
    });

    await controller.start();
    overlay.render.mockClear();
    store.save.mockClear();

    const executePromise = controller.handleShortcut('executeSelectedSection');
    await Promise.resolve();
    const selectPromise = controller.handleShortcut('selectNextSection');

    resolvePlay?.('started');

    await Promise.all([executePromise, selectPromise]);

    expect(overlay.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        restoreStatus: 'started',
        selectedSectionName: 'Chorus',
        activeSectionName: 'Verse',
      }),
    );
    expect(store.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeSectionId: 'section-1',
        selectedSectionId: 'section-2',
      }),
    );
  });
});
