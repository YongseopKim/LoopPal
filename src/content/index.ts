import { createSessionStore } from '../core/session/storage';
import { createAppController } from './runtime/appController';
import {
  DEFAULT_KEYMAP,
  SHORTCUT_ACTION_META,
  bindingsEqual,
  createShortcutKeymap,
  formatShortcutBinding,
  keyboardEventToBinding,
  parseSectionSlotShortcutAction,
} from './runtime/defaultKeymap';
import { createShortcutKeymapStore } from './runtime/shortcutKeymapStore';
import { createLoopMonitor } from './runtime/loopMonitor';
import { createShortcutController } from './runtime/shortcutController';
import {
  captureWatchPlayerVideoState,
  type BoundVideoState,
  findWatchPlayerVideo,
  waitForVideoElement,
} from './runtime/videoLocator';
import {
  extractVideoId,
  isWatchPage,
  subscribeToPageNavigations,
  waitForInlinePracticePanelMount,
} from './runtime/youtubePage';
import { createYoutubePlayer } from './runtime/youtubePlayer';
import {
  createOverlayView,
  type OverlayShortcutModalState,
  type OverlayViewModel,
} from './ui/overlayView';

const LOOP_MONITOR_INTERVAL_MS = 50;
const VIDEO_LOOKUP_INTERVAL_MS = 50;

function reportRuntimeError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return;
  }

  console.error('bass-practice runtime error', error);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function ensureOverlayRoot() {
  const existingRoot = document.querySelector('[data-bp-overlay-root]');

  if (existingRoot instanceof HTMLElement) {
    return existingRoot;
  }

  const root = document.createElement('div');

  root.dataset.bpOverlayRoot = 'true';

  return root;
}

function clearOverlayRoot() {
  ensureOverlayRoot().innerHTML = '';
}

function createBootstrapBinding(
  videoId: string | null,
  previousVideoState: BoundVideoState,
) {
  let loopTimer: number | null = null;
  let disposed = false;
  let removeKeydownListener: (() => void) | null = null;
  let removePlaybackListener: (() => void) | null = null;

  const isActive = () =>
    !disposed &&
    videoId !== null &&
    isWatchPage(window.location.href) &&
    extractVideoId(window.location.href) === videoId;

  const stop = () => {
    disposed = true;

    if (loopTimer !== null) {
      window.clearInterval(loopTimer);
      loopTimer = null;
    }

    removeKeydownListener?.();
    removeKeydownListener = null;
    removePlaybackListener?.();
    removePlaybackListener = null;
    clearOverlayRoot();
  };

  if (!videoId || !isWatchPage(window.location.href)) {
    return { videoId, stop };
  }

  const bootstrap = async () => {
    const video = await waitForVideoElement({
      findVideo: () => findWatchPlayerVideo(document, previousVideoState),
      isActive,
      sleep,
      intervalMs: VIDEO_LOOKUP_INTERVAL_MS,
    });

    if (!(video instanceof HTMLVideoElement) || !isActive()) {
      return;
    }

    lastBoundVideoState = {
      element: video,
      currentSrc: video.currentSrc,
    };

    const store = createSessionStore(chrome.storage.local);
    const shortcutKeymapStore = createShortcutKeymapStore(chrome.storage.local);
    let currentShortcutKeymap = await shortcutKeymapStore.load();
    const player = createYoutubePlayer(video);
    const overlayRoot = ensureOverlayRoot();
    overlayRoot.dataset.bpOverlayPending = 'true';
    let controller: ReturnType<typeof createAppController> | null = null;
    let latestPracticeModel: OverlayViewModel | null = null;
    let shortcutModalState: OverlayShortcutModalState = {
      isOpen: false,
      captureAction: null,
      statusMessage: null,
    };
    let isPanelMounted = false;
    let hasQueuedRender = false;
    const renderOverlay = () => {
      if (!isActive() || latestPracticeModel === null) {
        return;
      }

      if (!isPanelMounted) {
        hasQueuedRender = true;
        return;
      }

      overlay.render({
        practice: latestPracticeModel,
        shortcutKeymap: currentShortcutKeymap,
        shortcutModal: shortcutModalState,
      });
    };
    const overlay = createOverlayView(overlayRoot, {
      onShortcutAction(action) {
        void (() => {
          const slotNumber = parseSectionSlotShortcutAction(action);

          if (slotNumber !== null) {
            return controller?.selectSectionSlot(slotNumber);
          }

          return controller?.handleShortcut(action);
        })()?.catch(reportRuntimeError);
      },
      onExecuteSection(sectionId) {
        void controller?.executeSection(sectionId).catch(reportRuntimeError);
      },
      onDeleteSection(sectionId) {
        void controller?.deleteSection(sectionId).catch(reportRuntimeError);
      },
      onToggleLoop(sectionId?: string) {
        void controller?.toggleLoop(sectionId).catch(reportRuntimeError);
      },
      onOpenKeyGuide() {
        void controller?.handleShortcut('togglePanel').catch(reportRuntimeError);
      },
      onOpenShortcutSettings() {
        shortcutModalState = {
          isOpen: true,
          captureAction: null,
          statusMessage: null,
        };
        renderOverlay();
      },
      onCloseShortcutSettings() {
        shortcutModalState = {
          isOpen: false,
          captureAction: null,
          statusMessage: null,
        };
        renderOverlay();
      },
      onBeginShortcutCapture(action) {
        shortcutModalState = {
          isOpen: true,
          captureAction: action,
          statusMessage: `Press a new shortcut for ${SHORTCUT_ACTION_META[action].label}`,
        };
        renderOverlay();
      },
      onResetShortcut(action) {
        void (async () => {
          currentShortcutKeymap = {
            ...currentShortcutKeymap,
            [action]: DEFAULT_KEYMAP[action],
          };
          await shortcutKeymapStore.save(currentShortcutKeymap);
          shortcutModalState = {
            isOpen: true,
            captureAction: null,
            statusMessage: `Reset ${SHORTCUT_ACTION_META[action].label} to ${formatShortcutBinding(DEFAULT_KEYMAP[action])}`,
          };
          renderOverlay();
        })().catch(reportRuntimeError);
      },
      onResetAllShortcuts() {
        void (async () => {
          currentShortcutKeymap = createShortcutKeymap();
          await shortcutKeymapStore.save(currentShortcutKeymap);
          shortcutModalState = {
            isOpen: true,
            captureAction: null,
            statusMessage: 'Reset all shortcuts to the defaults.',
          };
          renderOverlay();
        })().catch(reportRuntimeError);
      },
    });
    controller = createAppController({
      store,
      player,
      overlay: {
        render(model) {
          if (isActive()) {
            latestPracticeModel = model;
            renderOverlay();
          }
        },
      },
      videoId,
      isActive,
    });

    await controller.start();

    if (!isActive()) {
      return;
    }

    const mountPanel = async () => {
      await waitForInlinePracticePanelMount({
        root: document,
        panelRoot: overlayRoot,
        isActive,
        sleep,
        intervalMs: VIDEO_LOOKUP_INTERVAL_MS,
      });

      if (!isActive()) {
        return;
      }

      isPanelMounted = true;
      delete overlayRoot.dataset.bpOverlayPending;

      if (hasQueuedRender && latestPracticeModel !== null) {
        hasQueuedRender = false;
        overlay.render({
          practice: latestPracticeModel,
          shortcutKeymap: currentShortcutKeymap,
          shortcutModal: shortcutModalState,
        });
      }
    };

    void mountPanel().catch(reportRuntimeError);

    const shortcutController = createShortcutController({
      onAction(action) {
        const slotNumber = parseSectionSlotShortcutAction(action);

        if (slotNumber !== null) {
          void controller.selectSectionSlot(slotNumber).catch(reportRuntimeError);
          return;
        }

        void controller.handleShortcut(action).catch(reportRuntimeError);
      },
      getKeymap() {
        return currentShortcutKeymap;
      },
    });
    const handlePlaybackStart = () => {
      controller.markPlaybackStarted();
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (shortcutModalState.isOpen) {
        const captureAction = shortcutModalState.captureAction;

        if (shortcutModalState.captureAction) {
          if (event.code === 'Escape') {
            event.preventDefault();
            shortcutModalState = {
              isOpen: true,
              captureAction: null,
              statusMessage: 'Shortcut capture canceled.',
            };
            renderOverlay();
            return;
          }

          const binding = keyboardEventToBinding(event);

          if (!binding) {
            event.preventDefault();
            shortcutModalState = {
              ...shortcutModalState,
              statusMessage: 'Press a key with optional modifiers. Modifier-only shortcuts are not supported.',
            };
            renderOverlay();
            return;
          }

          event.preventDefault();
          const conflictingAction = Object.entries(currentShortcutKeymap).find(
            ([action, existingBinding]) => {
              return (
                action !== captureAction &&
                bindingsEqual(existingBinding, binding)
              );
            },
          )?.[0];

          if (conflictingAction) {
            shortcutModalState = {
              ...shortcutModalState,
              statusMessage: `${SHORTCUT_ACTION_META[conflictingAction as keyof typeof SHORTCUT_ACTION_META].label} already uses ${formatShortcutBinding(binding)}.`,
            };
            renderOverlay();
            return;
          }

          void (async () => {
            currentShortcutKeymap = {
              ...currentShortcutKeymap,
              [captureAction]: binding,
            };
            await shortcutKeymapStore.save(currentShortcutKeymap);
            shortcutModalState = {
              isOpen: true,
              captureAction: null,
              statusMessage: `Saved ${SHORTCUT_ACTION_META[captureAction as keyof typeof SHORTCUT_ACTION_META].label} as ${formatShortcutBinding(binding)}.`,
            };
            renderOverlay();
          })().catch(reportRuntimeError);
          return;
        }

        if (event.code === 'Escape') {
          event.preventDefault();
          shortcutModalState = {
            isOpen: false,
            captureAction: null,
            statusMessage: null,
          };
          renderOverlay();
        }

        return;
      }

      shortcutController.handle(event);
    };

    video.addEventListener('play', handlePlaybackStart);
    document.addEventListener('keydown', handleKeydown);
    removePlaybackListener = () => {
      video.removeEventListener('play', handlePlaybackStart);
    };
    removeKeydownListener = () => {
      document.removeEventListener('keydown', handleKeydown);
    };

    const loopMonitor = createLoopMonitor(player);

    loopTimer = window.setInterval(() => {
      const activeSection = controller.getLoopSection();

      if (isActive() && activeSection) {
        loopMonitor.tick(activeSection);
      }
    }, LOOP_MONITOR_INTERVAL_MS);
  };

  void bootstrap().catch(reportRuntimeError);

  return { videoId, stop };
}

let lastBoundVideoState: BoundVideoState = { element: null, currentSrc: '' };
let binding = createBootstrapBinding(
  extractVideoId(window.location.href),
  lastBoundVideoState,
);

const unsubscribeFromNavigations = subscribeToPageNavigations(window, (url) => {
  const nextVideoId = extractVideoId(url);

  if (nextVideoId === binding.videoId) {
    return;
  }

  lastBoundVideoState = captureWatchPlayerVideoState(document, lastBoundVideoState);
  binding.stop();
  binding = createBootstrapBinding(nextVideoId, lastBoundVideoState);
});

void unsubscribeFromNavigations;
