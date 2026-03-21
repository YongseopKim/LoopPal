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

function getWatchPlayerVideoCandidates(root: ParentNode): HTMLVideoElement[] {
  const selectors = [
    '#movie_player video.html5-main-video',
    '#movie_player video',
    'video.html5-main-video',
  ];
  const visitedCandidates = new Set<HTMLVideoElement>();
  const candidates: HTMLVideoElement[] = [];

  for (const selector of selectors) {
    for (const candidate of root.querySelectorAll(selector)) {
      if (!(candidate instanceof HTMLVideoElement) || visitedCandidates.has(candidate)) {
        continue;
      }

      visitedCandidates.add(candidate);
      candidates.push(candidate);
    }
  }

  return candidates;
}

export function findWatchPlayerVideo(
  root: ParentNode,
  previousVideoState?: BoundVideoState,
): HTMLVideoElement | null {
  for (const candidate of getWatchPlayerVideoCandidates(root)) {
    if (
      previousVideoState &&
      previousVideoState.element === candidate &&
      candidate.currentSrc === previousVideoState.currentSrc
    ) {
      continue;
    }

    return candidate;
  }

  return null;
}

export function captureWatchPlayerVideoState(
  root: ParentNode,
  previousVideoState: BoundVideoState,
): BoundVideoState {
  const candidate = getWatchPlayerVideoCandidates(root)[0] ?? null;

  if (!(candidate instanceof HTMLVideoElement)) {
    return previousVideoState;
  }

  return {
    element: candidate,
    currentSrc: candidate.currentSrc,
  };
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
