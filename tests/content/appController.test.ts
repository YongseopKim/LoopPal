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
    getCurrentTime: vi.fn(function getCurrentTime(this: { currentTime: number }) {
      return this.currentTime;
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
    expect(overlay.render).not.toHaveBeenCalled();
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
    expect(overlay.render).toHaveBeenCalledWith(
      expect.objectContaining({
        restoreStatus: 'idle',
        selectedSectionName: null,
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
        restoreStatus: 'idle',
        selectedSectionName: 'Chorus',
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
