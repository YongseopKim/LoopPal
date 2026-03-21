import { createSessionStore } from '../core/session/storage';
import { createAppController } from './runtime/appController';
import { createLoopMonitor } from './runtime/loopMonitor';
import {
  extractVideoId,
  isWatchPage,
  subscribeToPageNavigations,
} from './runtime/youtubePage';
import { createYoutubePlayer } from './runtime/youtubePlayer';
import { createOverlayView } from './ui/overlayView';

const LOOP_MONITOR_INTERVAL_MS = 50;

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

  const video = document.querySelector('video');

  if (!(video instanceof HTMLVideoElement)) {
    return { videoId, stop };
  }

  const bootstrap = async () => {
    const store = createSessionStore(chrome.storage.local);
    const player = createYoutubePlayer(video);
    const overlay = createOverlayView(ensureOverlayRoot());
    const controller = createAppController({ store, player, overlay, videoId });
    const restored = await controller.start();

    if (disposed || !restored?.activeSection || !restored.session.loopEnabled) {
      return;
    }

    const loopMonitor = createLoopMonitor(player);

    loopTimer = window.setInterval(() => {
      loopMonitor.tick(restored.activeSection);
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
