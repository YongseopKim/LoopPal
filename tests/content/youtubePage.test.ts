import { describe, expect, it, vi } from 'vitest';
import {
  extractVideoId,
  isWatchPage,
  subscribeToPageNavigations,
} from '../../src/content/runtime/youtubePage';

function createFakeWindow(initialUrl: string) {
  let href = initialUrl;
  const listeners = new Map<string, Set<() => void>>();
  const history = {
    pushState: vi.fn((_data: unknown, _unused: string, nextUrl?: string | URL | null) => {
      if (typeof nextUrl === 'string') {
        href = nextUrl;
      }
    }),
    replaceState: vi.fn(
      (_data: unknown, _unused: string, nextUrl?: string | URL | null) => {
        if (typeof nextUrl === 'string') {
          href = nextUrl;
        }
      },
    ),
  };

  return {
    history,
    location: {
      get href() {
        return href;
      },
      set href(value: string) {
        href = value;
      },
    },
    addEventListener: vi.fn((type: string, listener: () => void) => {
      const callbacks = listeners.get(type) ?? new Set<() => void>();

      callbacks.add(listener);
      listeners.set(type, callbacks);
    }),
    removeEventListener: vi.fn((type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    }),
    dispatch(type: string) {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },
  };
}

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

  it('notifies when in-page navigation changes to another watch video', () => {
    const fakeWindow = createFakeWindow('https://www.youtube.com/watch?v=abc123');
    const onNavigate = vi.fn();
    const unsubscribe = subscribeToPageNavigations(
      fakeWindow as unknown as Window,
      onNavigate,
    );

    fakeWindow.location.href = 'https://www.youtube.com/watch?v=next456';
    fakeWindow.dispatch('yt-navigate-finish');

    expect(onNavigate).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=next456',
    );

    unsubscribe();
  });

  it('ignores finish events when the URL did not change', () => {
    const fakeWindow = createFakeWindow('https://www.youtube.com/watch?v=abc123');
    const onNavigate = vi.fn();
    const unsubscribe = subscribeToPageNavigations(
      fakeWindow as unknown as Window,
      onNavigate,
    );

    fakeWindow.dispatch('yt-navigate-finish');

    expect(onNavigate).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const fakeWindow = createFakeWindow('https://www.youtube.com/watch?v=abc123');
    const onNavigate = vi.fn();
    const unsubscribe = subscribeToPageNavigations(
      fakeWindow as unknown as Window,
      onNavigate,
    );

    unsubscribe();
    fakeWindow.history.pushState({}, '', 'https://www.youtube.com/watch?v=next456');

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('notifies on popstate when the URL changes', () => {
    const fakeWindow = createFakeWindow('https://www.youtube.com/watch?v=abc123');
    const onNavigate = vi.fn();
    const unsubscribe = subscribeToPageNavigations(
      fakeWindow as unknown as Window,
      onNavigate,
    );

    fakeWindow.location.href = 'https://www.youtube.com/watch?v=next456';
    fakeWindow.dispatch('popstate');

    expect(onNavigate).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=next456',
    );

    unsubscribe();
  });
});
