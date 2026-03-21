type WaitForVideoElementArgs = {
  findVideo: () => HTMLVideoElement | null;
  isActive: () => boolean;
  sleep: (ms: number) => Promise<void>;
  intervalMs?: number;
  maxAttempts?: number | null;
};

const DEFAULT_INTERVAL_MS = 50;
const DEFAULT_MAX_ATTEMPTS = null;

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
