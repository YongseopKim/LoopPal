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

type NavigationEventName = 'popstate' | 'yt-navigate-finish';

type PageWindowLike = {
  location: PageLocationLike;
  addEventListener(type: NavigationEventName, listener: () => void): void;
  removeEventListener(type: NavigationEventName, listener: () => void): void;
};

export function subscribeToPageNavigations(
  pageWindow: PageWindowLike,
  onNavigate: (url: string) => void,
) {
  let previousUrl = pageWindow.location.href;

  const notifyIfChanged = () => {
    const nextUrl = pageWindow.location.href;

    if (nextUrl === previousUrl) {
      return;
    }

    previousUrl = nextUrl;
    onNavigate(nextUrl);
  };

  const handleNavigation = () => {
    notifyIfChanged();
  };

  pageWindow.addEventListener('yt-navigate-finish', handleNavigation);
  pageWindow.addEventListener('popstate', handleNavigation);

  return () => {
    pageWindow.removeEventListener('yt-navigate-finish', handleNavigation);
    pageWindow.removeEventListener('popstate', handleNavigation);
  };
}
