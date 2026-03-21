import type { PracticeSection, VideoPracticeSession } from './types';

const MAX_SECTIONS = 10;

export type SessionAction =
  | { type: 'selectNextSection' }
  | { type: 'executeSelectedSection' }
  | { type: 'createSection'; payload: PracticeSection };

function getSectionById(
  session: VideoPracticeSession,
  sectionId: string | null,
): PracticeSection | null {
  if (!sectionId) {
    return null;
  }

  return session.sections.find((section) => section.id === sectionId) ?? null;
}

function getAdjacentSectionId(
  session: VideoPracticeSession,
  direction: -1 | 1,
): string | null {
  if (session.sections.length === 0) {
    return null;
  }

  if (!session.selectedSectionId) {
    return session.sections[0]?.id ?? null;
  }

  const currentIndex = session.sections.findIndex(
    (section) => section.id === session.selectedSectionId,
  );

  if (currentIndex === -1) {
    return session.sections[0]?.id ?? null;
  }

  const nextIndex =
    (currentIndex + direction + session.sections.length) % session.sections.length;

  return session.sections[nextIndex]?.id ?? null;
}

export function reduceSession(
  session: VideoPracticeSession,
  action: SessionAction,
): VideoPracticeSession {
  switch (action.type) {
    case 'selectNextSection':
      return {
        ...session,
        selectedSectionId: getAdjacentSectionId(session, 1),
      };
    case 'executeSelectedSection': {
      const activeSection = getSectionById(session, session.selectedSectionId);

      return {
        ...session,
        activeSectionId: activeSection?.id ?? null,
        loopEnabled: Boolean(activeSection),
        resolvedSpeed: activeSection?.speedOverride ?? session.defaultSpeed,
      };
    }
    case 'createSection':
      if (session.sections.length >= MAX_SECTIONS) {
        throw new Error('A session can include at most 10 sections.');
      }

      return {
        ...session,
        sections: [...session.sections, action.payload],
      };
    default:
      return session;
  }
}
