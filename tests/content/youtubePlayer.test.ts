import { describe, expect, it, vi } from 'vitest';
import { createYoutubePlayer } from '../../src/content/runtime/youtubePlayer';

describe('youtubePlayer', () => {
  it('reports autoplay blocking when play() is rejected', async () => {
    const video = document.createElement('video');
    video.play = vi
      .fn()
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));

    const player = createYoutubePlayer(video);

    await expect(player.playSafely()).resolves.toBe('blocked');
  });
});
