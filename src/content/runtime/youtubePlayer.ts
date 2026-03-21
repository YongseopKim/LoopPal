export function createYoutubePlayer(video: HTMLVideoElement) {
  return {
    getCurrentTime: () => video.currentTime,
    getDuration: () => video.duration,
    getPlaybackRate: () => video.playbackRate,
    setCurrentTime: (value: number) => {
      video.currentTime = value;
    },
    setPlaybackRate: (value: number) => {
      video.playbackRate = value;
    },
    async playSafely() {
      try {
        await video.play();

        return 'started' as const;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          return 'blocked' as const;
        }

        throw error;
      }
    },
  };
}
