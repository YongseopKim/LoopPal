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

  it('keeps a valid 0.1s section at the end when duration floors below the real bound', () => {
    expect(clampSectionRange(181, 191.2, 180.44)).toEqual({
      startTimeSec: 180.3,
      endTimeSec: 180.4,
    });
  });

  it('keeps a valid 0.1s section at the end when duration is above the floored tenth', () => {
    expect(clampSectionRange(181, 191.2, 180.45)).toEqual({
      startTimeSec: 180.3,
      endTimeSec: 180.4,
    });
  });

  it('treats epsilon-scale float noise below a tenth as the intended end bound', () => {
    expect(clampSectionRange(181, 191.2, 180.39999999999998)).toEqual({
      startTimeSec: 180.3,
      endTimeSec: 180.4,
    });
  });

  it('treats epsilon-scale float noise near 0.1s as a valid minimum section', () => {
    expect(clampSectionRange(1, 1, 0.09999999999999999)).toEqual({
      startTimeSec: 0,
      endTimeSec: 0.1,
    });
  });

  it('repairs reversed ranges to a valid minimum section', () => {
    expect(clampSectionRange(10.4, 10.3, 180.4)).toEqual({
      startTimeSec: 10.4,
      endTimeSec: 10.5,
    });
  });

  it('steps playback speed in 0.05x increments', () => {
    expect(stepSpeed(0.75, 1)).toBe(0.8);
    expect(stepSpeed(0.75, -1)).toBe(0.7);
  });

  it('clamps playback speed at the supported min and max', () => {
    expect(stepSpeed(2, 1)).toBe(2);
    expect(stepSpeed(0.25, -1)).toBe(0.25);
  });
});
