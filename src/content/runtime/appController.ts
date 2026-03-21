import type {
  PracticeSection,
  VideoPracticeSession,
} from '../../core/session/types';
import type { OverlayViewModel } from '../ui/overlayView';

type RestoreStatus = 'idle' | 'started' | 'blocked';

type AppStore = {
  load(videoId: string): Promise<VideoPracticeSession | null>;
  save(session: VideoPracticeSession): Promise<void>;
};

type AppPlayer = {
  setPlaybackRate(value: number): void;
  playSafely(): Promise<'started' | 'blocked'>;
};

type AppOverlay = {
  render(model: OverlayViewModel): void;
};

export type AppControllerDeps = {
  store: AppStore;
  player: AppPlayer;
  overlay: AppOverlay;
  videoId: string;
  isActive?: () => boolean;
};

export type RestoreResult = {
  session: VideoPracticeSession;
  activeSection: PracticeSection | null;
  restoreStatus: RestoreStatus;
} | null;

function getActiveSection(session: VideoPracticeSession): PracticeSection | null {
  const sectionIds = [session.activeSectionId, session.selectedSectionId].filter(
    (value): value is string => value !== null,
  );

  for (const sectionId of sectionIds) {
    const match = session.sections.find((section) => section.id === sectionId);

    if (match) {
      return match;
    }
  }

  return null;
}

function formatSpeedLabel(speed: number): string {
  return `${speed.toFixed(2).replace(/\.?0+$/, '')}x`;
}

function toViewModel(
  session: VideoPracticeSession,
  activeSection: PracticeSection | null,
  restoreStatus: RestoreStatus,
): OverlayViewModel {
  const speed = activeSection?.speedOverride ?? session.defaultSpeed;

  return {
    selectedSectionName: activeSection?.name ?? null,
    speedLabel: formatSpeedLabel(speed),
    loopEnabled: session.loopEnabled,
    panelExpanded: false,
    restoreStatus,
    sections: session.sections
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((section) => ({
        id: section.id,
        name: section.name,
        memo: section.memo,
      })),
  };
}

export function createAppController(deps: AppControllerDeps) {
  return {
    async start(): Promise<RestoreResult> {
      const isActive = deps.isActive ?? (() => true);
      const session = await deps.store.load(deps.videoId);

      if (!session || !isActive()) {
        return null;
      }

      const activeSection = getActiveSection(session);
      const speed = activeSection?.speedOverride ?? session.defaultSpeed;
      const canRestoreLoop = session.loopEnabled && activeSection !== null;

      if (!isActive()) {
        return null;
      }

      deps.player.setPlaybackRate(speed);

      const restoreStatus = canRestoreLoop
        ? await deps.player.playSafely()
        : ('idle' as const);

      if (!isActive()) {
        return null;
      }

      deps.overlay.render(toViewModel(session, activeSection, restoreStatus));

      return { session, activeSection, restoreStatus };
    },
  };
}
