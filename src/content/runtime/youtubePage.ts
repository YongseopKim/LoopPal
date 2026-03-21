export function isWatchPage(rawUrl: string): boolean {
  const url = new URL(rawUrl);

  return (
    url.hostname === 'www.youtube.com' &&
    url.pathname === '/watch' &&
    url.searchParams.has('v')
  );
}

export function extractVideoId(rawUrl: string): string | null {
  return isWatchPage(rawUrl) ? new URL(rawUrl).searchParams.get('v') : null;
}
