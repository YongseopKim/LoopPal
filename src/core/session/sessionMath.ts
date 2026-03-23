export type { PracticeSection, VideoPracticeSession } from './types';

const DURATION_EPSILON = 1e-9;

export function normalizeTime(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

export function formatTimeLabel(value: number): string {
  const normalized = normalizeTime(value);
  const totalTenths = Math.round(normalized * 10);
  const totalSeconds = Math.floor(totalTenths / 10);
  const tenths = totalTenths % 10;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${paddedSeconds}.${tenths}`;
  }

  return `${minutes}:${paddedSeconds}.${tenths}`;
}

function normalizeDurationLimit(durationSec: number): number {
  return Math.floor((Math.max(0, durationSec) + DURATION_EPSILON) * 10) / 10;
}

export function clampSectionRange(
  startTimeSec: number,
  endTimeSec: number,
  durationSec: number,
) {
  const maxTime = normalizeDurationLimit(durationSec);
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
