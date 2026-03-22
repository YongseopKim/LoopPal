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

const SMALL_NUDGE_STEP_SEC = 0.1;
const BIG_NUDGE_STEP_SEC = 5;
const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

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
  confirmDelete?: (message: string) => boolean;
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

function getOrderedSections(session: VideoPracticeSession): PracticeSection[] {
  return [...session.sections].sort((left, right) => left.order - right.order);
}

function getSelectedSection(session: VideoPracticeSession): PracticeSection | null {
  return getSectionById(session, session.selectedSectionId);
}

function getActiveSection(session: VideoPracticeSession): PracticeSection | null {
  return getSectionById(session, session.activeSectionId);
}

function getSectionSlotIndex(
  session: VideoPracticeSession,
  sectionId: string,
): number {
  return getOrderedSections(session).findIndex((section) => section.id === sectionId);
}

function findNextSelectedSectionId(
  session: VideoPracticeSession,
  removedIndex: number,
): string | null {
  const orderedSections = getOrderedSections(session);

  if (orderedSections.length === 0) {
    return null;
  }

  if (removedIndex >= orderedSections.length) {
    return orderedSections[orderedSections.length - 1]?.id ?? null;
  }

  return orderedSections[removedIndex]?.id ?? null;
}

function removeSectionFromSession(
  session: VideoPracticeSession,
  sectionId: string,
): VideoPracticeSession {
  const removedIndex = getSectionSlotIndex(session, sectionId);
  const nextSections = session.sections.filter((section) => section.id !== sectionId);
  const nextSession = { ...session, sections: nextSections };

  if (removedIndex === -1) {
    return nextSession;
  }

  const selectedSectionId =
    nextSections.length === 0
      ? null
      : session.selectedSectionId === sectionId
        ? findNextSelectedSectionId(
          { ...nextSession, selectedSectionId: null },
          removedIndex,
        )
        : session.selectedSectionId;

  const isDeletedActive = session.activeSectionId === sectionId;

  return {
    ...nextSession,
    selectedSectionId,
    activeSectionId: isDeletedActive ? null : nextSession.activeSectionId,
    loopEnabled: isDeletedActive ? false : nextSession.loopEnabled,
  };
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

function formatSectionRangeLabel(section: PracticeSection): string {
  return `${formatTimeLabel(section.startTimeSec)} ~ ${formatTimeLabel(section.endTimeSec)}`;
}

type SectionExecutionCounts = {
  lastHour: number;
  lastDay: number;
  lastWeek: number;
  lastMonth: number;
  total: number;
};

function getSectionExecutionCounts(
  section: PracticeSection,
  now: number,
): SectionExecutionCounts {
  const history = section.executionHistory ?? [];
  const total = section.executionCount ?? history.length;

  return {
    lastHour: history.filter((ts) => ts >= now - ONE_HOUR_MS).length,
    lastDay: history.filter((ts) => ts >= now - ONE_DAY_MS).length,
    lastWeek: history.filter((ts) => ts >= now - ONE_WEEK_MS).length,
    lastMonth: history.filter((ts) => ts >= now - ONE_MONTH_MS).length,
    total,
  };
}

function withRecordedExecution(
  session: VideoPracticeSession,
  sectionId: string,
  now: number,
): VideoPracticeSession {
  const cutoff = now - ONE_MONTH_MS;

  return updateSection(session, sectionId, (section) => {
    const nextHistory = [...(section.executionHistory ?? []), now].filter((time) => time >= cutoff);

    return {
      ...section,
      executionCount: (section.executionCount ?? 0) + 1,
      executionHistory: nextHistory,
      updatedAt: now,
    };
  });
}

function clearLoopState(
  session: VideoPracticeSession,
  options: { clearSelection: boolean },
): VideoPracticeSession {
  return {
    ...session,
    loopEnabled: false,
    activeSectionId: null,
    selectedSectionId: options.clearSelection ? null : session.selectedSectionId,
  };
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
  now: number,
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
        rangeLabel: formatSectionRangeLabel(section),
        executionCounts: getSectionExecutionCounts(section, now),
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
  const confirmDelete =
    deps.confirmDelete ??
    ((message: string) => {
      try {
        return window.confirm(message);
      } catch {
        return true;
      }
    });
  let session: VideoPracticeSession | null = null;
  let panelExpanded = false;
  let restoreStatus: RestoreStatus = 'idle';
  let currentSpeed = 1;
  let draftStartTimeSec: number | null = null;
  let statusMessage: string | null = null;
  let pendingShortcut: Promise<void> = Promise.resolve();

  const enqueue = async (operation: () => Promise<void>) => {
    const nextRun = pendingShortcut.then(operation);

    pendingShortcut = nextRun.catch(() => undefined);

    await nextRun;
  };

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
        getNow(),
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

  const renderSelectionRequired = () => {
    statusMessage = 'Select a section first.';
    render();
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
    stepSeconds: number = SMALL_NUDGE_STEP_SEC,
  ) => {
    if (!session) {
      renderSelectionRequired();
      return;
    }

    const selectedSection = getSelectedSection(session);

    if (!selectedSection) {
      renderSelectionRequired();
      return;
    }

    const duration = getSafeDuration(
      deps.player.getDuration(),
      selectedSection.endTimeSec,
    );
    const nextRange =
      field === 'start'
        ? clampSectionRange(
          selectedSection.startTimeSec + direction * stepSeconds,
          selectedSection.endTimeSec,
          duration,
        )
        : clampSectionRange(
          selectedSection.startTimeSec,
          selectedSection.endTimeSec + direction * stepSeconds,
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

  const executeSelectedSection = async () => {
    if (!session || !getSelectedSection(session)) {
      renderSelectionRequired();
      return;
    }

    statusMessage = null;
    const now = getNow();

    session = reduceSession(session, { type: 'executeSelectedSection' });
    session = withRecordedExecution(
      session,
      getActiveSection(session)?.id ?? '',
      now,
    );
    restoreStatus = await applySectionPlayback(getActiveSection(session), true);

    if (!isActive()) {
      return;
    }

    await deps.store.save(session);

    if (!isActive()) {
      return;
    }

    render();
  };

  const deleteSectionById = async (
    sectionId: string,
    options: { skipConfirm?: boolean } = {},
  ) => {
    if (!isActive() || !session) {
      return;
    }

    const targetSection = getSectionById(session, sectionId);

    if (!targetSection) {
      return;
    }

    const shouldDelete = options.skipConfirm || confirmDelete(
      `Delete ${targetSection.name}?`,
    );

    if (!shouldDelete) {
      return;
    }

    session = removeSectionFromSession(session, sectionId);
    statusMessage = `Deleted ${targetSection.name}`;

    await deps.store.save(session);

    if (!isActive()) {
      return;
    }

    render();
  };

  const deleteSelectedSection = async () => {
    const selected = session ? getSelectedSection(session) : null;

    if (!selected) {
      renderSelectionRequired();
      return;
    }

    await deleteSectionById(selected.id);
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
      await enqueue(async () => {
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

        if (action === 'nudgeSectionStartBackwardLarge') {
          await handleSectionNudge('start', -1, BIG_NUDGE_STEP_SEC);
          return;
        }

        if (action === 'nudgeSectionStartForwardLarge') {
          await handleSectionNudge('start', 1, BIG_NUDGE_STEP_SEC);
          return;
        }

        if (action === 'nudgeSectionEndBackwardLarge') {
          await handleSectionNudge('end', -1, BIG_NUDGE_STEP_SEC);
          return;
        }

        if (action === 'nudgeSectionEndForwardLarge') {
          await handleSectionNudge('end', 1, BIG_NUDGE_STEP_SEC);
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

        if (action === 'selectPreviousSection' || action === 'selectNextSection') {
          if (!session) {
            return;
          }

          statusMessage = null;
          session = reduceSession(session, { type: action });
          if (!isActive()) {
            return;
          }

          await deps.store.save(session);

          if (!isActive()) {
            return;
          }

          render();
          return;
        }

        if (action === 'executeSelectedSection') {
          await executeSelectedSection();
          return;
        }

        if (action === 'deleteSelectedSection') {
          await deleteSelectedSection();
        }
      });
    },
    async executeSection(sectionId: string): Promise<void> {
      await enqueue(async () => {
        if (!isActive() || !session) {
          return;
        }

        const nextSection = getSectionById(session, sectionId);

        if (!nextSection) {
          return;
        }

        const now = getNow();
        const isActiveSectionRunning = session.loopEnabled
          && session.activeSectionId === nextSection.id;

        if (isActiveSectionRunning) {
          session = clearLoopState(session, { clearSelection: true });
          restoreStatus = 'idle';
          statusMessage = `Stopped ${nextSection.name}`;

          await deps.store.save(session);

          if (!isActive()) {
            return;
          }

          render();
          return;
        }

        statusMessage = null;
        session = reduceSession(
          {
            ...session,
            selectedSectionId: nextSection.id,
          },
          { type: 'executeSelectedSection' },
        );
        session = withRecordedExecution(
          session,
          nextSection.id,
          now,
        );
        restoreStatus = await applySectionPlayback(getActiveSection(session), true);

        if (!isActive()) {
          return;
        }

        await deps.store.save(session);

        if (!isActive()) {
          return;
        }

        render();
      });
    },
    async selectSectionSlot(slotNumber: number): Promise<void> {
      await enqueue(async () => {
        if (!isActive() || !session) {
          return;
        }

        const targetSection = getOrderedSections(session)[slotNumber - 1];

        if (!targetSection) {
          return;
        }

        session = {
          ...session,
          selectedSectionId: targetSection.id,
        };
        statusMessage = null;

        await deps.store.save(session);

        if (!isActive()) {
          return;
        }

        render();
      });
    },
    async deleteSection(sectionId: string): Promise<void> {
      await enqueue(async () => {
        await deleteSectionById(sectionId, { skipConfirm: true });
      });
    },
    async toggleLoop(sectionId?: string): Promise<void> {
      await enqueue(async () => {
        if (!isActive()) {
          return;
        }

        if (!session) {
          renderSelectionRequired();
          return;
        }

        if (sectionId) {
          const targetSection = getSectionById(session, sectionId);

          if (!targetSection) {
            return;
          }

          const isTargetActive = session.loopEnabled
            && session.activeSectionId === sectionId;

          if (isTargetActive) {
            session = clearLoopState(session, { clearSelection: true });
            restoreStatus = 'idle';
            statusMessage = `Stopped ${targetSection.name}`;

            await deps.store.save(session);

            if (!isActive()) {
              return;
            }

            render();
            return;
          }

          statusMessage = null;
          session = {
            ...session,
            selectedSectionId: sectionId,
          };
          session = reduceSession(session, { type: 'executeSelectedSection' });
          session = withRecordedExecution(
            session,
            sectionId,
            getNow(),
          );
          restoreStatus = await applySectionPlayback(getActiveSection(session), true);

          if (!isActive()) {
            return;
          }

          await deps.store.save(session);

          if (!isActive()) {
            return;
          }

          render();
          return;
        }

        if (session.loopEnabled) {
          session = clearLoopState(session, { clearSelection: false });
          restoreStatus = 'idle';
          statusMessage = 'Loop stopped';

          await deps.store.save(session);

          if (!isActive()) {
            return;
          }

          render();
          return;
        }

        if (!getSelectedSection(session)) {
          renderSelectionRequired();
          return;
        }

        statusMessage = null;
        session = reduceSession(session, { type: 'executeSelectedSection' });
        restoreStatus = await applySectionPlayback(getActiveSection(session), true);

        if (!isActive()) {
          return;
        }

        await deps.store.save(session);

        if (!isActive()) {
          return;
        }

        render();
      });
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
