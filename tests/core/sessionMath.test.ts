import { describe, expect, it } from 'vitest';
import {
  clampSectionRange,
  normalizeTime,
  stepSpeed,
} from '../../src/core/session/sessionMath';

describe('sessionMath', () => {
  it('rounds times to 0.1s precision', () => {
    expect(normalizeTime(12.26)).toBe(12.3);
    expect(normalizeTime(12.24)).toBe(12.2);
  });

  it('clamps section ranges to video bounds', () => {
    expect(clampSectionRange(-0.1, 191.2, 180.4)).toEqual({
      startTimeSec: 0,
      endTimeSec: 180.4,
    });
  });

  it('normalizes clamped ranges when duration is not on a tenth', () => {
    expect(clampSectionRange(181, 191.2, 180.44)).toEqual({
      startTimeSec: 180.4,
      endTimeSec: 180.4,
    });
  });

  it('steps playback speed in 0.05x increments', () => {
    expect(stepSpeed(0.75, 1)).toBe(0.8);
    expect(stepSpeed(0.75, -1)).toBe(0.7);
  });
});
