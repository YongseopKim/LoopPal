import type { PracticeSection, VideoPracticeSession } from './types';

const MAX_SECTIONS = 10;

export type SessionAction =
  | { type: 'selectPreviousSection' }
  | { type: 'selectNextSection' }
  | { type: 'executeSelectedSection' }
  | { type: 'createSection'; payload: PracticeSection };

function getOrderedSections(session: VideoPracticeSession): PracticeSection[] {
  return [...session.sections].sort((left, right) => left.order - right.order);
}

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
  const orderedSections = getOrderedSections(session);

  if (orderedSections.length === 0) {
    return null;
  }

  if (!session.selectedSectionId) {
    return orderedSections[0]?.id ?? null;
  }

  const currentIndex = orderedSections.findIndex(
    (section) => section.id === session.selectedSectionId,
  );

  if (currentIndex === -1) {
    return orderedSections[0]?.id ?? null;
  }

  const nextIndex =
    (currentIndex + direction + orderedSections.length) % orderedSections.length;

  return orderedSections[nextIndex]?.id ?? null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session action: ${JSON.stringify(value)}`);
}

export function reduceSession(
  session: VideoPracticeSession,
  action: SessionAction,
): VideoPracticeSession {
  switch (action.type) {
    case 'selectPreviousSection':
      return {
        ...session,
        selectedSectionId: getAdjacentSectionId(session, -1),
      };
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
        selectedSectionId: action.payload.id,
        sections: [...session.sections, action.payload],
      };
    default:
      return assertNever(action);
  }
}
