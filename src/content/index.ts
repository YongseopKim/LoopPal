import { createSessionStore } from '../core/session/storage';
import { createAppController } from './runtime/appController';
import { createLoopMonitor } from './runtime/loopMonitor';
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
    const restored = await controller.start();

    if (!isActive() || !restored?.activeSection || !restored.session.loopEnabled) {
      return;
    }

    const loopMonitor = createLoopMonitor(player);

    loopTimer = window.setInterval(() => {
      if (isActive()) {
        loopMonitor.tick(restored.activeSection);
      }
    }, LOOP_MONITOR_INTERVAL_MS);
  };

  void bootstrap();

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
