import type { VideoPracticeSession } from './types';

type StorageAreaLike = Pick<chrome.storage.StorageArea, 'get' | 'set'>;
type PersistedVideoPracticeSession = Omit<VideoPracticeSession, 'resolvedSpeed'>;

function normalizeSession(
  session: VideoPracticeSession,
): PersistedVideoPracticeSession {
  const { resolvedSpeed: _resolvedSpeed, ...persistedSession } = session;

  return persistedSession;
}

export function createSessionStore(storageArea: StorageAreaLike) {
  return {
    async load(videoId: string): Promise<VideoPracticeSession | null> {
      const key = `video:${videoId}`;
      const result = await storageArea.get(key);
      const session = result[key] as VideoPracticeSession | undefined;

      return session ? normalizeSession(session) : null;
    },
    async save(session: VideoPracticeSession): Promise<void> {
      const key = `video:${session.videoId}`;

      await storageArea.set({ [key]: normalizeSession(session) });
    },
  };
}
