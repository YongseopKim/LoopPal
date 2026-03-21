import { describe, expect, it, vi } from 'vitest';
import { waitForVideoElement } from '../../src/content/runtime/videoLocator';

describe('videoLocator', () => {
  it('retries until a video element appears', async () => {
    const video = document.createElement('video');
    const sleep = vi.fn().mockResolvedValue(undefined);
    const findVideo = vi
      .fn<() => HTMLVideoElement | null>()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValue(video);

    await expect(
      waitForVideoElement({
        findVideo,
        isActive: () => true,
        sleep,
        maxAttempts: 3,
      }),
    ).resolves.toBe(video);

    expect(findVideo).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('stops retrying once the binding becomes inactive', async () => {
    let active = true;
    const sleep = vi.fn().mockImplementation(async () => {
      active = false;
    });
    const findVideo = vi.fn<() => HTMLVideoElement | null>().mockReturnValue(null);

    await expect(
      waitForVideoElement({
        findVideo,
        isActive: () => active,
        sleep,
        maxAttempts: 5,
      }),
    ).resolves.toBeNull();

    expect(findVideo).toHaveBeenCalledTimes(1);
  });
});
