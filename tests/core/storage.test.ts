import { describe, expect, it, vi } from 'vitest';
import type { VideoPracticeSession } from '../../src/core/session/types';
import { createSessionStore } from '../../src/core/session/storage';

type StoredValues = Record<string, unknown>;

function fakeStorage(initial: StoredValues = {}) {
  const values = { ...initial };

  return {
    get: vi.fn(async (key: string) => ({
      [key]: values[key],
    })),
    set: vi.fn(async (next: StoredValues) => {
      Object.assign(values, next);
    }),
  };
}

const seedSession: VideoPracticeSession = {
  videoId: 'abc123',
  defaultSpeed: 0.8,
  loopEnabled: true,
  selectedSectionId: 'section-1',
  activeSectionId: 'section-1',
  sections: [
    {
      id: 'section-1',
      name: 'Verse',
      memo: 'Lock the groove',
      startTimeSec: 12.3,
      endTimeSec: 25.4,
      speedOverride: 0.65,
      order: 0,
      updatedAt: 1_710_000_000_000,
    },
  ],
};

const dirtySession: VideoPracticeSession = {
  ...seedSession,
  resolvedSpeed: 0.65,
};

describe('session storage', () => {
  it('loads a saved session by video id', async () => {
    const storageArea = fakeStorage({ 'video:abc123': seedSession });
    const store = createSessionStore(storageArea);

    await expect(store.load('abc123')).resolves.toMatchObject({
      videoId: 'abc123',
    });
  });

  it('normalizes and saves sessions by video id', async () => {
    const storageArea = fakeStorage();
    const store = createSessionStore(storageArea);

    await store.save(dirtySession);

    expect(storageArea.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'video:abc123': expect.not.objectContaining({
          resolvedSpeed: expect.any(Number),
        }),
      }),
    );
  });
});
