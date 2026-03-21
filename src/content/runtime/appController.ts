import { reduceSession } from '../../core/session/sessionReducer';
import type {
  PracticeSection,
  VideoPracticeSession,
} from '../../core/session/types';
import type { OverlayViewModel } from '../ui/overlayView';
import type { ShortcutAction } from './defaultKeymap';

type RestoreStatus = 'idle' | 'started' | 'blocked';

type AppStore = {
  load(videoId: string): Promise<VideoPracticeSession | null>;
  save(session: VideoPracticeSession): Promise<void>;
};

type AppPlayer = {
  setCurrentTime(value: number): void;
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

function getSectionById(
  session: VideoPracticeSession,
  sectionId: string | null,
): PracticeSection | null {
  if (!sectionId) {
    return null;
  }

  return session.sections.find((section) => section.id === sectionId) ?? null;
}

function getSelectedSection(session: VideoPracticeSession): PracticeSection | null {
  return getSectionById(session, session.selectedSectionId);
}

function getActiveSection(session: VideoPracticeSession): PracticeSection | null {
  return getSectionById(session, session.activeSectionId);
}

function formatSpeedLabel(speed: number): string {
  return `${speed.toFixed(2).replace(/\.?0+$/, '')}x`;
}

function toViewModel(
  session: VideoPracticeSession,
  selectedSection: PracticeSection | null,
  activeSection: PracticeSection | null,
  currentSpeed: number,
  restoreStatus: RestoreStatus,
  panelExpanded: boolean,
): OverlayViewModel {
  return {
    selectedSectionName: selectedSection?.name ?? null,
    activeSectionName: activeSection?.name ?? null,
    speedLabel: formatSpeedLabel(currentSpeed),
    loopEnabled: session.loopEnabled,
    panelExpanded,
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
  const isActive = deps.isActive ?? (() => true);
  let session: VideoPracticeSession | null = null;
  let panelExpanded = false;
  let restoreStatus: RestoreStatus = 'idle';
  let currentSpeed = 1;
  let pendingShortcut: Promise<void> = Promise.resolve();

  const render = () => {
    if (!session) {
      return;
    }

    deps.overlay.render(
      toViewModel(
        session,
        getSelectedSection(session),
        getActiveSection(session),
        currentSpeed,
        restoreStatus,
        panelExpanded,
      ),
    );
  };

  const applySectionPlayback = async (
    nextSection: PracticeSection | null,
    shouldAutoplay: boolean,
  ): Promise<RestoreStatus> => {
    if (!session || !isActive()) {
      return 'idle';
    }

    const speed = nextSection?.speedOverride ?? session.defaultSpeed;
    currentSpeed = speed;

    if (nextSection) {
      deps.player.setCurrentTime(nextSection.startTimeSec);
    }

    deps.player.setPlaybackRate(speed);

    if (!shouldAutoplay || !nextSection) {
      return 'idle';
    }

    try {
      return await deps.player.playSafely();
    } catch (error) {
      if (
        !isActive() &&
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        return 'idle';
      }

      throw error;
    }
  };

  return {
    async start(): Promise<RestoreResult> {
      session = await deps.store.load(deps.videoId);

      if (!session || !isActive()) {
        return null;
      }

      const activeSection = getActiveSection(session);
      const canRestoreLoop = session.loopEnabled && activeSection !== null;
      panelExpanded = false;
      restoreStatus = await applySectionPlayback(activeSection, canRestoreLoop);

      if (!isActive()) {
        return null;
      }

      render();

      return { session, activeSection, restoreStatus };
    },
    async handleShortcut(action: ShortcutAction): Promise<void> {
      const runShortcut = async () => {
        if (!session || !isActive()) {
          return;
        }

        if (action === 'togglePanel') {
          panelExpanded = !panelExpanded;
          render();
          return;
        }

        session = reduceSession(session, { type: action });

        if (action === 'executeSelectedSection') {
          restoreStatus = await applySectionPlayback(getActiveSection(session), true);
        }

        if (!isActive()) {
          return;
        }

        await deps.store.save(session);

        if (!isActive()) {
          return;
        }

        render();
      };

      const nextRun = pendingShortcut.then(runShortcut);

      pendingShortcut = nextRun.catch(() => undefined);

      await nextRun;
    },
    getLoopSection(): PracticeSection | null {
      if (!session || !session.loopEnabled) {
        return null;
      }

      return getActiveSection(session);
    },
    hasSession(): boolean {
      return session !== null;
    },
    markPlaybackStarted(): void {
      if (!session || !session.loopEnabled || restoreStatus !== 'blocked') {
        return;
      }

      restoreStatus = 'started';
      render();
    },
  };
}
