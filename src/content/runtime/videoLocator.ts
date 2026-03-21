type WaitForVideoElementArgs = {
  findVideo: () => HTMLVideoElement | null;
  isActive: () => boolean;
  sleep: (ms: number) => Promise<void>;
  intervalMs?: number;
  maxAttempts?: number | null;
};

const DEFAULT_INTERVAL_MS = 50;
const DEFAULT_MAX_ATTEMPTS = null;

export type BoundVideoState = {
  element: HTMLVideoElement | null;
  currentSrc: string;
};

export function findWatchPlayerVideo(
  root: ParentNode,
  previousVideoState?: BoundVideoState,
): HTMLVideoElement | null {
  const selectors = [
    '#movie_player video.html5-main-video',
    '#movie_player video',
    'video.html5-main-video',
  ];
  const visitedCandidates = new Set<HTMLVideoElement>();

  for (const selector of selectors) {
    const candidates = root.querySelectorAll(selector);

    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLVideoElement) || visitedCandidates.has(candidate)) {
        continue;
      }

      visitedCandidates.add(candidate);

      if (
        previousVideoState &&
        previousVideoState.element === candidate &&
        candidate.currentSrc === previousVideoState.currentSrc
      ) {
        continue;
      }

      return candidate;
    }
  }

  return null;
}

export async function waitForVideoElement({
  findVideo,
  isActive,
  sleep,
  intervalMs = DEFAULT_INTERVAL_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: WaitForVideoElementArgs): Promise<HTMLVideoElement | null> {
  let attempt = 0;

  while (isActive()) {
    if (!isActive()) {
      return null;
    }

    const video = findVideo();

    if (video instanceof HTMLVideoElement) {
      return video;
    }

    attempt += 1;

    if (maxAttempts !== null && attempt >= maxAttempts) {
      return null;
    }

    await sleep(intervalMs);
  }

  return null;
}
