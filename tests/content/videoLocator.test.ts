import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findWatchPlayerVideo,
  waitForVideoElement,
} from '../../src/content/runtime/videoLocator';

describe('videoLocator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

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

  it('waits for the watch-player source to change before reusing the same video element', () => {
    const moviePlayer = document.createElement('div');
    const mainPlayerVideo = document.createElement('video');

    moviePlayer.id = 'movie_player';
    mainPlayerVideo.className = 'html5-main-video';
    Object.defineProperty(mainPlayerVideo, 'currentSrc', {
      configurable: true,
      value: 'https://cdn.test/old.mp4',
    });
    moviePlayer.append(mainPlayerVideo);
    document.body.append(moviePlayer);

    expect(
      findWatchPlayerVideo(document, {
        element: mainPlayerVideo,
        currentSrc: 'https://cdn.test/old.mp4',
      }),
    ).toBeNull();

    Object.defineProperty(mainPlayerVideo, 'currentSrc', {
      configurable: true,
      value: 'https://cdn.test/new.mp4',
    });

    expect(
      findWatchPlayerVideo(document, {
        element: mainPlayerVideo,
        currentSrc: 'https://cdn.test/old.mp4',
      }),
    ).toBe(mainPlayerVideo);
  });

  it('skips a stale watch-player video when a replacement video is already present', () => {
    const moviePlayer = document.createElement('div');
    const staleVideo = document.createElement('video');
    const replacementVideo = document.createElement('video');

    moviePlayer.id = 'movie_player';
    staleVideo.className = 'html5-main-video';
    replacementVideo.className = 'html5-main-video';
    Object.defineProperty(staleVideo, 'currentSrc', {
      configurable: true,
      value: 'https://cdn.test/old.mp4',
    });
    Object.defineProperty(replacementVideo, 'currentSrc', {
      configurable: true,
      value: 'https://cdn.test/new.mp4',
    });
    moviePlayer.append(staleVideo, replacementVideo);
    document.body.append(moviePlayer);

    expect(
      findWatchPlayerVideo(document, {
        element: staleVideo,
        currentSrc: 'https://cdn.test/old.mp4',
      }),
    ).toBe(replacementVideo);
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
