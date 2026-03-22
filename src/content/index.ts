import { createSessionStore } from '../core/session/storage';
import { createAppController } from './runtime/appController';
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
  mountPracticePanel,
  subscribeToPageNavigations,
  waitForInlinePracticePanelMount,
} from './runtime/youtubePage';
import { createYoutubePlayer } from './runtime/youtubePlayer';
import { createOverlayView } from './ui/overlayView';

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
    const player = createYoutubePlayer(video);
    const overlayRoot = ensureOverlayRoot();
    const overlay = createOverlayView(overlayRoot);
    const controller = createAppController({
      store,
      player,
      overlay: {
        render(model) {
          if (isActive()) {
            mountPracticePanel(document, overlayRoot);
            overlay.render(model);
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

    void waitForInlinePracticePanelMount({
      root: document,
      panelRoot: overlayRoot,
      isActive,
      sleep,
      intervalMs: VIDEO_LOOKUP_INTERVAL_MS,
    }).catch(reportRuntimeError);

    const shortcutController = createShortcutController({
      onAction(action) {
        void controller.handleShortcut(action).catch(reportRuntimeError);
      },
    });
    const handlePlaybackStart = () => {
      controller.markPlaybackStarted();
    };
    const handleKeydown = (event: KeyboardEvent) => {
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
