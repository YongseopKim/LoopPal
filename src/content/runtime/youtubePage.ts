export function isWatchPage(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const videoId = url.searchParams.get('v');

    return (
      url.hostname === 'www.youtube.com' &&
      url.pathname === '/watch' &&
      videoId !== null &&
      videoId !== ''
    );
  } catch {
    return false;
  }
}

export function extractVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const videoId = url.searchParams.get('v');

    return (
      url.hostname === 'www.youtube.com' &&
      url.pathname === '/watch' &&
      videoId !== null &&
      videoId !== ''
    )
      ? videoId
      : null;
  } catch {
    return null;
  }
}

type PageLocationLike = {
  href: string;
};

type HistoryMethod = (
  data: unknown,
  unused: string,
  url?: string | URL | null,
) => void;

type HistoryLike = {
  pushState: HistoryMethod;
  replaceState: HistoryMethod;
};

type PageWindowLike = {
  location: PageLocationLike;
  history: HistoryLike;
  addEventListener(type: 'popstate', listener: () => void): void;
  removeEventListener(type: 'popstate', listener: () => void): void;
};

export function subscribeToPageNavigations(
  pageWindow: PageWindowLike,
  onNavigate: (url: string) => void,
) {
  let previousUrl = pageWindow.location.href;
  const originalPushState = pageWindow.history.pushState.bind(pageWindow.history);
  const originalReplaceState = pageWindow.history.replaceState.bind(
    pageWindow.history,
  );

  const notifyIfChanged = () => {
    const nextUrl = pageWindow.location.href;

    if (nextUrl === previousUrl) {
      return;
    }

    previousUrl = nextUrl;
    onNavigate(nextUrl);
  };

  pageWindow.history.pushState = (data, unused, url) => {
    originalPushState(data, unused, url);
    notifyIfChanged();
  };

  pageWindow.history.replaceState = (data, unused, url) => {
    originalReplaceState(data, unused, url);
    notifyIfChanged();
  };

  const handlePopState = () => {
    notifyIfChanged();
  };

  pageWindow.addEventListener('popstate', handlePopState);

  return () => {
    pageWindow.history.pushState = originalPushState;
    pageWindow.history.replaceState = originalReplaceState;
    pageWindow.removeEventListener('popstate', handlePopState);
  };
}
