import type { PracticeSection } from '../../core/session/types';

type LoopPlayer = {
  getCurrentTime(): number;
  setCurrentTime(value: number): void;
};

export function createLoopMonitor(player: LoopPlayer) {
  return {
    tick(section: Pick<PracticeSection, 'startTimeSec' | 'endTimeSec'>) {
      if (player.getCurrentTime() >= section.endTimeSec) {
        player.setCurrentTime(section.startTimeSec);
      }
    },
  };
}
