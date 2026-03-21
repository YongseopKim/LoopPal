export type { PracticeSection, VideoPracticeSession } from './types';

export function normalizeTime(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

export function clampSectionRange(
  startTimeSec: number,
  endTimeSec: number,
  durationSec: number,
) {
  const start = Math.min(normalizeTime(startTimeSec), durationSec);
  const minEnd = Math.min(durationSec, start + 0.1);
  const end = Math.max(minEnd, Math.min(normalizeTime(endTimeSec), durationSec));

  return { startTimeSec: start, endTimeSec: normalizeTime(end) };
}

export function stepSpeed(currentSpeed: number, direction: -1 | 1): number {
  const stepped = currentSpeed + direction * 0.05;

  return Math.min(2, Math.max(0.25, Math.round(stepped * 20) / 20));
}
