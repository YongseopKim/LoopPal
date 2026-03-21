import { describe, expect, it, vi } from 'vitest';
import {
  findWatchPlayerVideo,
  waitForVideoElement,
} from '../../src/content/runtime/videoLocator';

describe('videoLocator', () => {
  it('prefers the scoped watch-player video element over other page videos', () => {
    const unrelatedVideo = document.createElement('video');
    const moviePlayer = document.createElement('div');
    const mainPlayerVideo = document.createElement('video');

    unrelatedVideo.className = 'html5-main-video';
    moviePlayer.id = 'movie_player';
    mainPlayerVideo.className = 'html5-main-video';
    moviePlayer.append(mainPlayerVideo);
    document.body.append(unrelatedVideo, moviePlayer);

    expect(findWatchPlayerVideo(document)).toBe(mainPlayerVideo);
  });

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

  it('keeps retrying by default until a video element appears', async () => {
    const video = document.createElement('video');
    const sleep = vi.fn().mockResolvedValue(undefined);
    let attempts = 0;
    const findVideo = vi.fn<() => HTMLVideoElement | null>().mockImplementation(() => {
      attempts += 1;
      return attempts > 40 ? video : null;
    });

    await expect(
      waitForVideoElement({
        findVideo,
        isActive: () => true,
        sleep,
      }),
    ).resolves.toBe(video);

    expect(findVideo).toHaveBeenCalledTimes(41);
    expect(sleep).toHaveBeenCalledTimes(40);
  });
});
