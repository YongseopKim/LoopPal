import { createSessionStore } from '../core/session/storage';
import { createAppController } from './runtime/appController';
import { createLoopMonitor } from './runtime/loopMonitor';
import { createShortcutController } from './runtime/shortcutController';
import { waitForVideoElement } from './runtime/videoLocator';
import {
  extractVideoId,
  isWatchPage,
  subscribeToPageNavigations,
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
  document.body.append(root);

  return root;
}

function clearOverlayRoot() {
  ensureOverlayRoot().innerHTML = '';
}

function createBootstrapBinding(videoId: string | null) {
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
      findVideo: () => {
        const candidate = document.querySelector('video');

        return candidate instanceof HTMLVideoElement ? candidate : null;
      },
      isActive,
      sleep,
      intervalMs: VIDEO_LOOKUP_INTERVAL_MS,
    });

    if (!(video instanceof HTMLVideoElement) || !isActive()) {
      return;
    }

    const store = createSessionStore(chrome.storage.local);
    const player = createYoutubePlayer(video);
    const overlay = createOverlayView(ensureOverlayRoot());
    const controller = createAppController({
      store,
      player,
      overlay: {
        render(model) {
          if (isActive()) {
            overlay.render(model);
          }
        },
      },
      videoId,
      isActive,
    });

    await controller.start();

    if (!isActive() || !controller.hasSession()) {
      return;
    }

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

let binding = createBootstrapBinding(extractVideoId(window.location.href));

const unsubscribeFromNavigations = subscribeToPageNavigations(window, (url) => {
  const nextVideoId = extractVideoId(url);

  if (nextVideoId === binding.videoId) {
    return;
  }

  binding.stop();
  binding = createBootstrapBinding(nextVideoId);
});

void unsubscribeFromNavigations;
