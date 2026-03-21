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
