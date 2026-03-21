import { describe, expect, it } from 'vitest';
import type {
  PracticeSection,
  VideoPracticeSession,
} from '../../src/core/session/types';
import { reduceSession } from '../../src/core/session/sessionReducer';

function makeSection(
  id: string,
  order: number,
  speedOverride: number | null = null,
): PracticeSection {
  return {
    id,
    name: `Section ${order + 1}`,
    memo: '',
    startTimeSec: order * 10,
    endTimeSec: order * 10 + 5,
    speedOverride,
    order,
    updatedAt: 1_710_000_000_000 + order,
  };
}

const seedSession: VideoPracticeSession = {
  videoId: 'video-1',
  defaultSpeed: 0.8,
  loopEnabled: false,
  selectedSectionId: 'section-1',
  activeSectionId: null,
  sections: [makeSection('section-1', 0, 0.65), makeSection('section-2', 1)],
};

const fullSession: VideoPracticeSession = {
  ...seedSession,
  sections: Array.from({ length: 10 }, (_, index) =>
    makeSection(`section-${index + 1}`, index),
  ),
};

const newSection = makeSection('section-11', 10);

describe('sessionReducer', () => {
  it('moves selection without activating a loop', () => {
    const next = reduceSession(seedSession, { type: 'selectNextSection' });

    expect(next.selectedSectionId).toBe('section-2');
    expect(next.activeSectionId).toBeNull();
  });

  it('activates the selected section and resolves speed override', () => {
    const next = reduceSession(seedSession, { type: 'executeSelectedSection' });

    expect(next.activeSectionId).toBe('section-1');
    expect(next.resolvedSpeed).toBe(0.65);
  });

  it('rejects an 11th section', () => {
    expect(() =>
      reduceSession(fullSession, {
        type: 'createSection',
        payload: newSection,
      }),
    ).toThrow(/10 sections/);
  });
});
