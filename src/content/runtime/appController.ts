import {
  clampSectionRange,
  normalizeTime,
  stepSpeed,
} from '../../core/session/sessionMath';
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
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
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
  createSectionId?: () => string;
  getNow?: () => number;
  promptForSectionDetails?: (
    defaults: SectionDetails,
  ) => SectionDetails | null;
};

export type RestoreResult = {
  session: VideoPracticeSession;
  activeSection: PracticeSection | null;
  restoreStatus: RestoreStatus;
} | null;

type SectionDetails = {
  name: string;
  memo: string;
};

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

function normalizeSessionState(
  session: VideoPracticeSession,
): VideoPracticeSession {
  const selectedSection = getSelectedSection(session);
  const activeSection = getActiveSection(session);
  let changed = false;
  let nextSession = session;

  if (session.selectedSectionId && !selectedSection) {
    changed = true;
    nextSession = {
      ...nextSession,
      selectedSectionId: null,
    };
  }

  if (session.loopEnabled && session.activeSectionId === null) {
    changed = true;
    nextSession = {
      ...nextSession,
      loopEnabled: false,
    };
  }

  if (session.activeSectionId && !activeSection) {
    changed = true;
    nextSession = {
      ...nextSession,
      activeSectionId: null,
      loopEnabled: false,
    };
  }

  return changed ? nextSession : session;
}

function createEmptySession(
  videoId: string,
  defaultSpeed: number,
): VideoPracticeSession {
  return {
    videoId,
    defaultSpeed,
    loopEnabled: false,
    selectedSectionId: null,
    activeSectionId: null,
    sections: [],
  };
}

function formatSpeedLabel(speed: number): string {
  return `${speed.toFixed(2).replace(/\.?0+$/, '')}x`;
}

function formatTimeLabel(timeSec: number): string {
  return `${normalizeTime(timeSec).toFixed(1)}s`;
}

function getNextSectionOrder(session: VideoPracticeSession): number {
  return session.sections.reduce((highestOrder, section) => {
    return Math.max(highestOrder, section.order);
  }, -1) + 1;
}

function getSafeDuration(duration: number, fallbackTimeSec: number): number {
  if (Number.isFinite(duration) && duration > 0) {
    return duration;
  }

  return Math.max(0.1, normalizeTime(fallbackTimeSec));
}

function normalizeSectionDetails(
  details: SectionDetails | null | undefined,
  fallbackName: string,
): SectionDetails {
  const trimmedName = details?.name.trim() ?? '';

  return {
    name: trimmedName || fallbackName,
    memo: details?.memo.trim() ?? '',
  };
}

function updateSection(
  session: VideoPracticeSession,
  sectionId: string,
  updater: (section: PracticeSection) => PracticeSection,
): VideoPracticeSession {
  return {
    ...session,
    sections: session.sections.map((section) => {
      return section.id === sectionId ? updater(section) : section;
    }),
  };
}

function toViewModel(
  session: VideoPracticeSession | null,
  currentSpeed: number,
  restoreStatus: RestoreStatus,
  panelExpanded: boolean,
  statusMessage: string | null,
): OverlayViewModel {
  const selectedSection = session ? getSelectedSection(session) : null;
  const activeSection = session ? getActiveSection(session) : null;

  return {
    selectedSectionName: selectedSection?.name ?? null,
    activeSectionName: activeSection?.name ?? null,
    selectedSectionId: session?.selectedSectionId ?? null,
    activeSectionId: session?.activeSectionId ?? null,
    speedLabel: formatSpeedLabel(currentSpeed),
    loopEnabled: session?.loopEnabled ?? false,
    panelExpanded,
    restoreStatus,
    statusMessage,
    sections: (session?.sections ?? [])
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
  const getNow = deps.getNow ?? (() => Date.now());
  const createSectionId =
    deps.createSectionId ??
    (() => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }

      return `section-${getNow()}-${Math.random().toString(36).slice(2, 8)}`;
    });
  const promptForSectionDetails =
    deps.promptForSectionDetails ??
    ((defaults: SectionDetails) => {
      const promptedName = window.prompt('Section name', defaults.name);
      const promptedMemo = window.prompt('Section memo', defaults.memo);

      return normalizeSectionDetails(
        {
          name: promptedName ?? defaults.name,
          memo: promptedMemo ?? defaults.memo,
        },
        defaults.name,
      );
    });
  let session: VideoPracticeSession | null = null;
  let panelExpanded = false;
  let restoreStatus: RestoreStatus = 'idle';
  let currentSpeed = 1;
  let draftStartTimeSec: number | null = null;
  let statusMessage: string | null = null;
  let pendingShortcut: Promise<void> = Promise.resolve();

  const render = () => {
    if (!isActive()) {
      return;
    }

    deps.overlay.render(
      toViewModel(
        session,
        currentSpeed,
        restoreStatus,
        panelExpanded,
        statusMessage,
      ),
    );
  };

  const ensureSession = () => {
    if (session) {
      return session;
    }

    session = createEmptySession(deps.videoId, currentSpeed);

    return session;
  };

  const saveSession = async () => {
    if (!session) {
      return;
    }

    await deps.store.save(session);
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

  const handleSectionCreation = async () => {
    if (draftStartTimeSec === null) {
      statusMessage = 'Mark a section start first.';
      render();
      return;
    }

    const nextSession = ensureSession();

    if (nextSession.sections.length >= 10) {
      statusMessage = 'A session can include at most 10 sections.';
      render();
      return;
    }

    const currentTimeSec = deps.player.getCurrentTime();
    const sectionRange = clampSectionRange(
      draftStartTimeSec,
      currentTimeSec,
      getSafeDuration(
        deps.player.getDuration(),
        Math.max(draftStartTimeSec, currentTimeSec),
      ),
    );
    const defaultName = `Section ${nextSession.sections.length + 1}`;
    const details = normalizeSectionDetails(
      promptForSectionDetails({
        name: defaultName,
        memo: '',
      }),
      defaultName,
    );
    const nextSection: PracticeSection = {
      id: createSectionId(),
      name: details.name,
      memo: details.memo,
      startTimeSec: sectionRange.startTimeSec,
      endTimeSec: sectionRange.endTimeSec,
      speedOverride: null,
      order: getNextSectionOrder(nextSession),
      updatedAt: getNow(),
    };

    session = reduceSession(nextSession, {
      type: 'createSection',
      payload: nextSection,
    });
    draftStartTimeSec = null;
    statusMessage = `Saved ${nextSection.name}`;

    await saveSession();

    if (!isActive()) {
      return;
    }

    render();
  };

  const handleSectionNudge = async (
    field: 'start' | 'end',
    direction: -1 | 1,
  ) => {
    if (!session) {
      return;
    }

    const selectedSection = getSelectedSection(session);

    if (!selectedSection) {
      return;
    }

    const duration = getSafeDuration(
      deps.player.getDuration(),
      selectedSection.endTimeSec,
    );
    const nextRange =
      field === 'start'
        ? clampSectionRange(
          selectedSection.startTimeSec + direction * 0.1,
          selectedSection.endTimeSec,
          duration,
        )
        : clampSectionRange(
          selectedSection.startTimeSec,
          selectedSection.endTimeSec + direction * 0.1,
          duration,
        );

    session = updateSection(session, selectedSection.id, (section) => ({
      ...section,
      ...nextRange,
      updatedAt: getNow(),
    }));
    statusMessage = null;

    if (session.activeSectionId === selectedSection.id && field === 'start') {
      deps.player.setCurrentTime(nextRange.startTimeSec);
    }

    await saveSession();

    if (!isActive()) {
      return;
    }

    render();
  };

  const handleSpeedStep = async (direction: -1 | 1) => {
    const nextSession = ensureSession();
    const selectedSection = getSelectedSection(nextSession);

    if (selectedSection) {
      const nextSpeed = stepSpeed(
        selectedSection.speedOverride ?? nextSession.defaultSpeed,
        direction,
      );

      session = updateSection(nextSession, selectedSection.id, (section) => ({
        ...section,
        speedOverride: nextSpeed,
        updatedAt: getNow(),
      }));

      if (
        session.activeSectionId === null ||
        session.activeSectionId === selectedSection.id
      ) {
        currentSpeed = nextSpeed;
        deps.player.setPlaybackRate(nextSpeed);
      }
    } else {
      const nextSpeed = stepSpeed(nextSession.defaultSpeed, direction);

      session = {
        ...nextSession,
        defaultSpeed: nextSpeed,
      };

      if (session.activeSectionId === null) {
        currentSpeed = nextSpeed;
        deps.player.setPlaybackRate(nextSpeed);
      }
    }

    statusMessage = null;

    await saveSession();

    if (!isActive()) {
      return;
    }

    render();
  };

  return {
    async start(): Promise<RestoreResult> {
      currentSpeed = deps.player.getPlaybackRate();
      session = await deps.store.load(deps.videoId);

      if (!isActive()) {
        return null;
      }

      if (!session) {
        panelExpanded = false;
        restoreStatus = 'idle';
        draftStartTimeSec = null;
        statusMessage = null;
        render();
        return null;
      }

      const normalizedSession = normalizeSessionState(session);

      if (normalizedSession !== session) {
        session = normalizedSession;
        await deps.store.save(session);

        if (!isActive()) {
          return null;
        }
      }

      const activeSection = getActiveSection(session);
      const canRestoreLoop = session.loopEnabled && activeSection !== null;
      panelExpanded = false;
      draftStartTimeSec = null;
      statusMessage = null;
      restoreStatus = await applySectionPlayback(activeSection, canRestoreLoop);

      if (!isActive()) {
        return null;
      }

      render();

      return { session, activeSection, restoreStatus };
    },
    async handleShortcut(action: ShortcutAction): Promise<void> {
      const runShortcut = async () => {
        if (!isActive()) {
          return;
        }

        if (action === 'togglePanel') {
          panelExpanded = !panelExpanded;
          render();
          return;
        }

        if (action === 'markSectionStart') {
          draftStartTimeSec = normalizeTime(deps.player.getCurrentTime());
          statusMessage = `Start marked at ${formatTimeLabel(draftStartTimeSec)}`;
          render();
          return;
        }

        if (action === 'markSectionEnd') {
          await handleSectionCreation();
          return;
        }

        if (action === 'nudgeSectionStartBackward') {
          await handleSectionNudge('start', -1);
          return;
        }

        if (action === 'nudgeSectionStartForward') {
          await handleSectionNudge('start', 1);
          return;
        }

        if (action === 'nudgeSectionEndBackward') {
          await handleSectionNudge('end', -1);
          return;
        }

        if (action === 'nudgeSectionEndForward') {
          await handleSectionNudge('end', 1);
          return;
        }

        if (action === 'decreaseSpeed') {
          await handleSpeedStep(-1);
          return;
        }

        if (action === 'increaseSpeed') {
          await handleSpeedStep(1);
          return;
        }

        if (!session) {
          return;
        }

        statusMessage = null;

        if (action === 'selectPreviousSection' || action === 'selectNextSection') {
          session = reduceSession(session, { type: action });
        }

        if (action === 'executeSelectedSection') {
          session = reduceSession(session, { type: action });
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
