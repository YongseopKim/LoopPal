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

export type PracticePanelMountMode = 'inline' | 'fixed';

type WaitForInlinePracticePanelMountOptions = {
  root: ParentNode;
  panelRoot: HTMLElement;
  isActive: () => boolean;
  sleep: (ms: number) => Promise<void>;
  intervalMs?: number;
  maxAttempts?: number;
};

export function mountPracticePanel(
  root: ParentNode,
  panelRoot: HTMLElement,
): PracticePanelMountMode {
  const primaryInner = root.querySelector('#primary-inner');
  const below = root.querySelector('#below');

  if (
    primaryInner instanceof HTMLElement &&
    (!below || below.parentElement === primaryInner)
  ) {
    if (below instanceof HTMLElement) {
      primaryInner.insertBefore(panelRoot, below);
    } else if (panelRoot.parentElement !== primaryInner) {
      primaryInner.append(panelRoot);
    }

    panelRoot.dataset.bpOverlayMode = 'inline';

    return 'inline';
  }

  if (root instanceof Document && panelRoot.parentElement !== root.body) {
    root.body.append(panelRoot);
  }

  panelRoot.dataset.bpOverlayMode = 'fixed';

  return 'fixed';
}

export async function waitForInlinePracticePanelMount({
  root,
  panelRoot,
  isActive,
  sleep,
  intervalMs = 50,
  maxAttempts = 80,
}: WaitForInlinePracticePanelMountOptions): Promise<PracticePanelMountMode> {
  let mode: PracticePanelMountMode = 'fixed';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    mode = mountPracticePanel(root, panelRoot);

    if (mode === 'inline' || !isActive()) {
      return mode;
    }

    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }

  return mode;
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
