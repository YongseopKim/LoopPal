export type { PracticeSection, VideoPracticeSession } from './types';

export function normalizeTime(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

export function clampSectionRange(
  startTimeSec: number,
  endTimeSec: number,
  durationSec: number,
) {
  const maxTime = Math.max(0, Math.floor(durationSec * 10) / 10);
  const canFitMinimumSection = maxTime >= 0.1;
  const maxStart = canFitMinimumSection ? maxTime - 0.1 : maxTime;
  const start = Math.min(normalizeTime(startTimeSec), maxStart);
  const minEnd = canFitMinimumSection ? start + 0.1 : maxTime;
  const end = Math.max(minEnd, Math.min(normalizeTime(endTimeSec), maxTime));

  return { startTimeSec: normalizeTime(start), endTimeSec: normalizeTime(end) };
}

export function stepSpeed(currentSpeed: number, direction: -1 | 1): number {
  const stepped = currentSpeed + direction * 0.05;

  return Math.min(2, Math.max(0.25, Math.round(stepped * 20) / 20));
}
