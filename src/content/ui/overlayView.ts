import {
  SHORTCUT_ACTION_GROUPS,
  SHORTCUT_ACTION_META,
  formatShortcutForAction,
  type ShortcutAction,
  type ShortcutKeymap,
} from '../runtime/defaultKeymap';
import { formatTimeLabel } from '../../core/session/sessionMath';

export type OverlaySectionSummary = {
  id: string;
  name: string;
  memo: string;
  rangeLabel?: string;
  startTimeSec?: number;
  endTimeSec?: number;
  executionCounts?: {
    lastHour: number;
    lastDay: number;
    lastWeek: number;
    lastMonth: number;
    total: number;
  };
};

export type OverlayViewModel = {
  selectedSectionName: string | null;
  activeSectionName: string | null;
  selectedSectionId: string | null;
  activeSectionId: string | null;
  speedLabel: string;
  loopEnabled: boolean;
  panelExpanded: boolean;
  markStartPending?: boolean;
  restoreStatus?: 'idle' | 'started' | 'blocked';
  statusMessage?: string | null;
  videoDurationSec?: number;
  currentVideoTimeSec?: number;
  sections: OverlaySectionSummary[];
};

export type OverlayShortcutModalState = {
  isOpen: boolean;
  captureAction: ShortcutAction | null;
  statusMessage: string | null;
};

export type OverlayScreenModel = {
  practice: OverlayViewModel;
  shortcutKeymap: ShortcutKeymap;
  shortcutModal: OverlayShortcutModalState;
};

type OverlayViewHandlers = {
  onShortcutAction?: (action: ShortcutAction) => void;
  onExecuteSection?: (sectionId: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  onNudgeSection?: (
    sectionId: string,
    field: 'start' | 'end',
    direction: -1 | 1,
  ) => void;
  onToggleLoop?: (sectionId?: string) => void;
  onOpenShortcutSettings?: () => void;
  onOpenKeyGuide?: () => void;
  onCloseShortcutSettings?: () => void;
  onBeginShortcutCapture?: (action: ShortcutAction) => void;
  onResetShortcut?: (action: ShortcutAction) => void;
  onResetAllShortcuts?: () => void;
  onClearSelection?: () => void;
};

const OVERLAY_VIEW_HANDLERS = new WeakMap<HTMLElement, OverlayViewHandlers>();
const OVERLAY_VIEW_BOUND_ROOTS = new WeakSet<HTMLElement>();

type ToolbarButtonSpec = {
  action: ShortcutAction;
  label: string;
};

const TOOLBAR_BUTTONS: readonly ToolbarButtonSpec[] = [
  { action: 'decreaseSpeed', label: '↓' },
  { action: 'increaseSpeed', label: '↑' },
] as const;

type ControlButtonRenderOptions = {
  isPressed?: boolean;
  className?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderControlButton(
  keymap: ShortcutKeymap,
  spec: ToolbarButtonSpec,
  options: ControlButtonRenderOptions = {},
): string {
  const actionMeta = SHORTCUT_ACTION_META[spec.action];
  const isPressed = options.isPressed ?? false;
  const extraClass = options.className ?? '';
  const pressedClass = isPressed ? ' bp-overlay__control-button--pressed' : '';

  return `
    <button
      type="button"
      class="bp-overlay__control-button${pressedClass}${extraClass ? ` ${extraClass}` : ''}"
      data-shortcut-action="${spec.action}"
      title="${escapeHtml(`${actionMeta.description} (${formatShortcutForAction(keymap, spec.action)})`)}"
    >
      ${escapeHtml(spec.label)}
    </button>
  `;
}

function formatRangeLabel(rangeStart: number, rangeEnd: number): string {
  const format = (value: number): string => `${value.toFixed(1)}s`;

  return `${format(rangeStart)} ~ ${format(rangeEnd)}`;
}

function formatTimelineRangeStyle(
  startSec: number,
  endSec: number,
  durationSec: number,
): string {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return '';
  }

  const safeStart = Math.max(0, startSec);
  const safeEnd = Math.max(safeStart, endSec);
  const left = Math.max(0, Math.min(100, (safeStart / durationSec) * 100));
  const right = Math.max(
    left,
    Math.max(0, Math.min(100, (safeEnd / durationSec) * 100)),
  );
  const width = Math.max(0.6, right - left);

  return `left:${left.toFixed(2)}%;width:${width.toFixed(2)}%`;
}

function formatTimelinePointerStyle(
  timeSec: number | undefined,
  durationSec: number,
): string {
  if (
    timeSec === undefined ||
    !Number.isFinite(timeSec) ||
    !Number.isFinite(durationSec) ||
    durationSec <= 0
  ) {
    return '';
  }

  const left = Math.max(0, Math.min(100, (timeSec / durationSec) * 100));

  return `left:${left.toFixed(2)}%`;
}

function renderLegend(keymap: ShortcutKeymap): string {
  return `
    <div class="bp-overlay__legend">
      <p class="bp-overlay__legend-title">Keyboard shortcuts</p>
      <div class="bp-overlay__legend-grid">
        ${SHORTCUT_ACTION_GROUPS.flatMap((group) =>
          group.actions.map((action) => {
            const meta = SHORTCUT_ACTION_META[action];

            return `
              <div class="bp-overlay__legend-row">
                <span>${escapeHtml(meta.label)}</span>
                <kbd>${escapeHtml(formatShortcutForAction(keymap, action))}</kbd>
              </div>
            `;
          }),
        ).join('')}
      </div>
    </div>
  `;
}

function renderSections(model: OverlayViewModel): string {
  if (model.sections.length === 0) {
    return `
      <div class="bp-overlay__panel bp-overlay__saved-panel">
        <div class="bp-overlay__panel-header">
          <p class="bp-overlay__panel-title">Saved sections</p>
          <span class="bp-overlay__panel-meta">0 saved</span>
        </div>
        <p class="bp-overlay__empty">No saved sections yet. Use Mark Start and Mark End to create one.</p>
      </div>
    `;
  }

  const selectedSection = model.sections.find(
    (section) => section.id === model.selectedSectionId,
  );
  const timelineDuration = model.videoDurationSec ?? 0;
  const fallbackDuration = model.sections.reduce(
    (current, section) => Math.max(current, section.endTimeSec ?? 0),
    0,
  );
  const totalDurationSec = timelineDuration > 0 ? timelineDuration : Math.max(1, fallbackDuration);

  const sectionItems = model.sections
    .map((section) => {
      const isSelected = section.id === model.selectedSectionId;
      const isActive = section.id === model.activeSectionId;
      const startLabel =
        section.startTimeSec === undefined
          ? '—'
          : formatTimeLabel(section.startTimeSec);
      const endLabel =
        section.endTimeSec === undefined
          ? '—'
          : formatTimeLabel(section.endTimeSec);
      const badges = [
        isSelected
          ? '<span class="bp-overlay__badge bp-overlay__badge--selected">Selected</span>'
          : '',
        isActive
          ? `<button type="button" class="bp-overlay__section-loop-chip" data-overlay-action="toggleLoopForSection" data-section-id="${escapeHtml(section.id)}" title="Stop looping this section">Looping</button>`
          : '',
      ]
        .filter(Boolean)
        .join('');
      const inlineMemo = section.memo
        ? `<span class="bp-overlay__section-inline-memo">${escapeHtml(section.memo)}</span>`
        : '';
      const timelineStyle = section.startTimeSec === undefined || section.endTimeSec === undefined
        ? ''
        : `style="${formatTimelineRangeStyle(section.startTimeSec, section.endTimeSec, totalDurationSec)}"`;
      const timelinePointerStyle = isSelected
        ? formatTimelinePointerStyle(model.currentVideoTimeSec, totalDurationSec)
        : '';
      const timelinePointer = timelinePointerStyle
        ? `<span class="bp-overlay__section-timeline-playhead" style="${timelinePointerStyle}" aria-hidden="true"></span>`
        : '';
      const executionCounts = section.executionCounts ?? {
        lastHour: 0,
        lastDay: 0,
        lastWeek: 0,
        lastMonth: 0,
        total: 0,
      };
      const executionLabel = `<span class="bp-overlay__section-stats">1h:${executionCounts.lastHour} / 1d:${executionCounts.lastDay} / 1w:${executionCounts.lastWeek} / 1m:${executionCounts.lastMonth} / total:${executionCounts.total}</span>`;
      const sectionStartControls = isSelected
        ? `
          <button
            type="button"
            class="bp-overlay__section-adjust-button"
            data-section-action="nudgeSectionStartBackward"
            data-section-id="${escapeHtml(section.id)}"
            title="Move section start backward by 0.1s"
          >
            S-
          </button>
          <button
            type="button"
            class="bp-overlay__section-adjust-button"
            data-section-action="nudgeSectionStartForward"
            data-section-id="${escapeHtml(section.id)}"
            title="Move section start forward by 0.1s"
          >
            S+
          </button>
        `
        : '';
      const sectionEndControls = isSelected
        ? `
          <button
            type="button"
            class="bp-overlay__section-adjust-button"
            data-section-action="nudgeSectionEndBackward"
            data-section-id="${escapeHtml(section.id)}"
            title="Move section end backward by 0.1s"
          >
            E-
          </button>
          <button
            type="button"
            class="bp-overlay__section-adjust-button"
            data-section-action="nudgeSectionEndForward"
            data-section-id="${escapeHtml(section.id)}"
            title="Move section end forward by 0.1s"
          >
            E+
          </button>
        `
        : '';
      const sectionRangeControls = isSelected
        ? `${sectionStartControls}
            <span class="bp-overlay__section-range">${escapeHtml(startLabel)}</span>
            <span class="bp-overlay__section-timestamp-sep">~</span>
            <span class="bp-overlay__section-range">${escapeHtml(endLabel)}</span>
            ${sectionEndControls}`
        : `
            <span class="bp-overlay__section-range">${escapeHtml(startLabel)}</span>
            <span class="bp-overlay__section-timestamp-sep">~</span>
            <span class="bp-overlay__section-range">${escapeHtml(endLabel)}</span>`;

      return `
        <li>
          <div class="bp-overlay__section-row">
            <div
              class="bp-overlay__section${isSelected ? ' bp-overlay__section--selected' : ''}${isActive ? ' bp-overlay__section--active' : ''}"
              data-overlay-action="executeSection"
              data-section-id="${escapeHtml(section.id)}"
              role="button"
              tabindex="0"
              title="Click to run this section immediately"
            >
              <span class="bp-overlay__section-topline">
                <span class="bp-overlay__section-title-group">
                  <strong class="bp-overlay__section-name">${escapeHtml(section.name)}</strong>
                  ${inlineMemo}
                  <span class="bp-overlay__section-badges">${badges}</span>
                </span>
                <span class="bp-overlay__section-meta">
                  ${executionLabel}
                  <button
                    type="button"
                    class="bp-overlay__section-delete"
                    data-overlay-action="deleteSection"
                    data-section-id="${escapeHtml(section.id)}"
                    title="Delete this section"
                  >
                    Delete
                  </button>
                </span>
              </span>
              <div class="bp-overlay__section-timeline">
                <span class="bp-overlay__section-timeline-range" ${timelineStyle}></span>
                ${timelinePointer}
              </div>
              <div class="bp-overlay__section-range-row">
                ${sectionRangeControls}
              </div>
          </div>
        </li>
      `;
    })
    .join('');

  return `
    <div class="bp-overlay__panel">
      <div class="bp-overlay__panel-header">
        <p class="bp-overlay__panel-title">Saved sections</p>
        <span class="bp-overlay__panel-meta">${model.sections.length} saved</span>
      </div>
      <ul class="bp-overlay__sections">${sectionItems}</ul>
      <p class="bp-overlay__selection-note">
        Click a section to run it immediately; click an active section again to stop.${selectedSection ? ' Start/End controls are shown when selected.' : ''}
      </p>
    </div>
  `;
}

function renderMainPanel(screen: OverlayScreenModel): string {
  return renderMainControls(screen);
}

function renderSavedPanel(screen: OverlayScreenModel): string {
  const sections = renderSections(screen.practice);

  return `
    <div class="bp-overlay__saved">
      ${sections}
    </div>
  `;
}

function renderMainControls(screen: OverlayScreenModel): string {
  const model = screen.practice;
  const selectedSection = model.sections.find(
    (section) => section.id === model.selectedSectionId,
  );
  const selectedSectionLabel = 'NEW';
  const loopTitle = model.loopEnabled
    ? `Loop off: stop repeating ${selectedSection?.name ?? 'the selected section'}`
    : `Loop on: run ${selectedSection?.name ?? 'the selected section'} (${formatShortcutForAction(screen.shortcutKeymap, 'executeSelectedSection')})`;
  const loopLabel = model.loopEnabled ? 'Loop On' : 'Loop Off';
  return `
      <div class="bp-overlay__main">
      <div class="bp-overlay__main-card">
      <div class="bp-overlay__control-stack">
          <div class="bp-overlay__control-group">
            <button
              type="button"
              class="bp-overlay__control-button${selectedSection || model.markStartPending ? ' bp-overlay__control-button--pressed' : ''}"
              data-overlay-action="clearSelection"
              title="Current selected section"
            >
              ${escapeHtml(selectedSectionLabel)}
            </button>
            ${renderControlButton(screen.shortcutKeymap, { action: 'markSectionStart', label: 'Start' }, {
              isPressed: model.markStartPending ?? false,
              className: 'bp-overlay__control-button--mark',
            })}
            ${renderControlButton(screen.shortcutKeymap, { action: 'markSectionEnd', label: 'End' })}
          </div>
          <div class="bp-overlay__control-group">
            ${renderControlButton(screen.shortcutKeymap, TOOLBAR_BUTTONS[0])}
            <span class="bp-overlay__speed-chip" title="Current playback speed">${escapeHtml(model.speedLabel)}</span>
            ${renderControlButton(screen.shortcutKeymap, TOOLBAR_BUTTONS[1])}
          </div>
          <div class="bp-overlay__control-group">
            <button
              type="button"
              class="bp-overlay__control-button ${model.loopEnabled ? 'bp-overlay__control-button--loop-on' : 'bp-overlay__control-button--loop-off'}"
              data-overlay-action="toggleLoop"
              title="${escapeHtml(loopTitle)}"
            >
              ${escapeHtml(loopLabel)}
            </button>
          </div>
          <div class="bp-overlay__control-group">
            <button
              type="button"
              class="bp-overlay__control-button"
              data-overlay-action="openShortcutSettings"
              title="Open shortcuts"
            >
              Shortcuts / Key guide
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderShortcutModal(screen: OverlayScreenModel): string {
  if (!screen.shortcutModal.isOpen) {
    return '';
  }

  const captureAction = screen.shortcutModal.captureAction;
  const statusMessage =
    screen.shortcutModal.statusMessage ??
    (captureAction
      ? `Press a new shortcut for ${SHORTCUT_ACTION_META[captureAction].label}`
      : 'Click Change to remap a shortcut. Direct section select maps to the saved section list order.');

  return `
    <div class="bp-overlay__modal-backdrop">
      <div class="bp-overlay__modal" role="dialog" aria-modal="true" aria-label="Shortcut settings">
        <div class="bp-overlay__modal-header">
          <div>
            <p class="bp-overlay__modal-title">Shortcut Settings</p>
            <p class="bp-overlay__modal-subtitle">${escapeHtml(statusMessage)}</p>
          </div>
          <button
            type="button"
            class="bp-overlay__modal-close"
            data-overlay-action="closeShortcutSettings"
            title="Close shortcut settings"
          >
            Close
          </button>
        </div>
        <div class="bp-overlay__modal-groups">
          ${SHORTCUT_ACTION_GROUPS.map((group) => {
            const rows = group.actions
              .map((action) => {
                const meta = SHORTCUT_ACTION_META[action];
                const isCapturing = action === captureAction;

                return `
                  <div class="bp-overlay__modal-row${isCapturing ? ' bp-overlay__modal-row--capturing' : ''}">
                    <div class="bp-overlay__modal-copy">
                      <strong>${escapeHtml(meta.label)}</strong>
                      <p>${escapeHtml(meta.description)}</p>
                    </div>
                    <div class="bp-overlay__modal-actions">
                      <span class="bp-overlay__binding-chip">${escapeHtml(formatShortcutForAction(screen.shortcutKeymap, action))}</span>
                      <button
                        type="button"
                        class="bp-overlay__modal-button"
                        data-overlay-action="beginShortcutCapture"
                        data-shortcut-action="${action}"
                      >
                        ${isCapturing ? 'Listening…' : 'Change'}
                      </button>
                      <button
                        type="button"
                        class="bp-overlay__modal-button bp-overlay__modal-button--muted"
                        data-overlay-action="resetShortcut"
                        data-shortcut-action="${action}"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                `;
              })
              .join('');

            return `
              <section class="bp-overlay__modal-group">
                <h3>${escapeHtml(group.label)}</h3>
                ${rows}
              </section>
            `;
          }).join('')}
        </div>
        <div class="bp-overlay__modal-footer">
          <button
            type="button"
            class="bp-overlay__modal-button bp-overlay__modal-button--muted"
            data-overlay-action="resetAllShortcuts"
          >
            Reset all
          </button>
          <button
            type="button"
            class="bp-overlay__modal-button"
            data-overlay-action="closeShortcutSettings"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  `;
}

export function createOverlayView(
  root: HTMLElement,
  handlers: OverlayViewHandlers = {},
) {
  OVERLAY_VIEW_HANDLERS.set(root, handlers);

  if (!OVERLAY_VIEW_BOUND_ROOTS.has(root)) {
    root.addEventListener('click', (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              '[data-shortcut-action], [data-overlay-action], [data-section-id]',
            )
          : null;

      if (!target) {
        return;
      }

      const currentHandlers = OVERLAY_VIEW_HANDLERS.get(root);
      const overlayAction = target.dataset.overlayAction;
      const shortcutAction = target.dataset.shortcutAction;

      if (overlayAction === 'toggleLoop') {
        currentHandlers?.onToggleLoop?.();
        return;
      }

      if (overlayAction === 'toggleLoopForSection') {
        const sectionId = target.dataset.sectionId;

        if (sectionId) {
          currentHandlers?.onToggleLoop?.(sectionId);
        }

        return;
      }

      if (overlayAction === 'openShortcutSettings') {
        currentHandlers?.onOpenShortcutSettings?.();
        return;
      }

      if (overlayAction === 'openKeyGuide') {
        currentHandlers?.onOpenKeyGuide?.();
        return;
      }

      if (overlayAction === 'clearSelection') {
        currentHandlers?.onClearSelection?.();
        return;
      }

      if (overlayAction === 'closeShortcutSettings') {
        currentHandlers?.onCloseShortcutSettings?.();
        return;
      }

      if (overlayAction === 'beginShortcutCapture' && shortcutAction) {
        currentHandlers?.onBeginShortcutCapture?.(shortcutAction as ShortcutAction);
        return;
      }

      if (overlayAction === 'resetShortcut' && shortcutAction) {
        currentHandlers?.onResetShortcut?.(shortcutAction as ShortcutAction);
        return;
      }

      if (overlayAction === 'resetAllShortcuts') {
        currentHandlers?.onResetAllShortcuts?.();
        return;
      }

      if (overlayAction === 'executeSection') {
        const sectionId = target.dataset.sectionId;

        if (sectionId) {
          currentHandlers?.onExecuteSection?.(sectionId);
        }

        return;
      }

      if (overlayAction === 'deleteSection') {
        const sectionId = target.dataset.sectionId;

        if (sectionId) {
          currentHandlers?.onDeleteSection?.(sectionId);
        }

        return;
      }

      const sectionAction = target.dataset.sectionAction;

      if (sectionAction) {
        const sectionId = target.dataset.sectionId;

        if (!sectionId) {
          return;
        }

        if (sectionAction === 'nudgeSectionStartBackward') {
          currentHandlers?.onNudgeSection?.(sectionId, 'start', -1);
          return;
        }

        if (sectionAction === 'nudgeSectionStartForward') {
          currentHandlers?.onNudgeSection?.(sectionId, 'start', 1);
          return;
        }

        if (sectionAction === 'nudgeSectionEndBackward') {
          currentHandlers?.onNudgeSection?.(sectionId, 'end', -1);
          return;
        }

        if (sectionAction === 'nudgeSectionEndForward') {
          currentHandlers?.onNudgeSection?.(sectionId, 'end', 1);
        }

        return;
      }

      if (shortcutAction) {
        currentHandlers?.onShortcutAction?.(shortcutAction as ShortcutAction);
        return;
      }

      const sectionId = target.dataset.sectionId;

      if (sectionId) {
        currentHandlers?.onExecuteSection?.(sectionId);
      }
    });

    OVERLAY_VIEW_BOUND_ROOTS.add(root);
  }

  return {
    render(screen: OverlayScreenModel) {
      const model = screen.practice;
      const statusText =
        model.statusMessage ??
        (model.restoreStatus === 'blocked' ? 'Tap play to resume loop' : '');
      const statusLabel = statusText
        ? `<span class="bp-overlay__restore">${escapeHtml(statusText)}</span>`
        : '<span class="bp-overlay__restore bp-overlay__restore--muted">Hover buttons to see the shortcuts. Open Shortcuts for setup.</span>';
      const loopLabel = model.loopEnabled ? 'Loop On' : 'Loop Off';
      const loopClass = model.loopEnabled
        ? 'bp-overlay__loop bp-overlay__loop--on'
        : 'bp-overlay__loop bp-overlay__loop--off';

      root.innerHTML = `
      <div class="bp-overlay">
          <div class="bp-overlay__status-row">
            <span class="${loopClass}">${escapeHtml(loopLabel)}</span>
            ${statusLabel}
          </div>
          <div class="bp-overlay__shell">
            ${renderMainPanel(screen)}
            ${renderSavedPanel(screen)}
          </div>
          ${model.panelExpanded ? renderLegend(screen.shortcutKeymap) : ''}
          ${renderShortcutModal(screen)}
        </div>
      `;
    },
  };
}
