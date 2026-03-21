import { describe, expect, it } from 'vitest';
import {
  extractVideoId,
  isWatchPage,
} from '../../src/content/runtime/youtubePage';

describe('youtubePage', () => {
  it('detects YouTube watch pages and extracts the video id', () => {
    expect(isWatchPage('https://www.youtube.com/watch?v=abc123')).toBe(true);
    expect(extractVideoId('https://www.youtube.com/watch?v=abc123&t=12')).toBe(
      'abc123',
    );
  });

  it('rejects watch pages with an empty video id', () => {
    expect(isWatchPage('https://www.youtube.com/watch?v=')).toBe(false);
    expect(extractVideoId('https://www.youtube.com/watch?v=')).toBeNull();
  });

  it('fails closed on malformed URLs', () => {
    expect(isWatchPage('not a url')).toBe(false);
    expect(extractVideoId('not a url')).toBeNull();
  });
});
