import { createSessionStore } from '../core/session/storage';
import { createAppController } from './runtime/appController';
import { createLoopMonitor } from './runtime/loopMonitor';
import { extractVideoId, isWatchPage } from './runtime/youtubePage';
import { createYoutubePlayer } from './runtime/youtubePlayer';
import { createOverlayView } from './ui/overlayView';

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

async function bootstrap() {
  if (!isWatchPage(window.location.href)) {
    return;
  }

  const videoId = extractVideoId(window.location.href);

  if (!videoId) {
    return;
  }

  const video = document.querySelector('video');

  if (!(video instanceof HTMLVideoElement)) {
    return;
  }

  const store = createSessionStore(chrome.storage.local);
  const player = createYoutubePlayer(video);
  const overlay = createOverlayView(ensureOverlayRoot());
  const controller = createAppController({ store, player, overlay, videoId });
  const restored = await controller.start();

  if (!restored?.activeSection || !restored.session.loopEnabled) {
    return;
  }

  const loopMonitor = createLoopMonitor(player);

  window.setInterval(() => {
    loopMonitor.tick(restored.activeSection);
  }, 250);
}

void bootstrap();
