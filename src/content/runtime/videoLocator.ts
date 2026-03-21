type WaitForVideoElementArgs = {
  findVideo: () => HTMLVideoElement | null;
  isActive: () => boolean;
  sleep: (ms: number) => Promise<void>;
  intervalMs?: number;
  maxAttempts?: number;
};

const DEFAULT_INTERVAL_MS = 50;
const DEFAULT_MAX_ATTEMPTS = 40;

export async function waitForVideoElement({
  findVideo,
  isActive,
  sleep,
  intervalMs = DEFAULT_INTERVAL_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: WaitForVideoElementArgs): Promise<HTMLVideoElement | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!isActive()) {
      return null;
    }

    const video = findVideo();

    if (video instanceof HTMLVideoElement) {
      return video;
    }

    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }

  return null;
}
