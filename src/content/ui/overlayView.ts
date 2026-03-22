import { DEFAULT_KEYMAP, type ShortcutAction } from '../runtime/defaultKeymap';

export type OverlaySectionSummary = {
  id: string;
  name: string;
  memo: string;
};

export type OverlayViewModel = {
  selectedSectionName: string | null;
  activeSectionName: string | null;
  selectedSectionId: string | null;
  activeSectionId: string | null;
  speedLabel: string;
  loopEnabled: boolean;
  panelExpanded: boolean;
  restoreStatus?: 'idle' | 'started' | 'blocked';
  statusMessage?: string | null;
  sections: OverlaySectionSummary[];
};

type OverlayViewHandlers = {
  onShortcutAction?: (action: ShortcutAction) => void;
  onExecuteSection?: (sectionId: string) => void;
  onToggleLoop?: () => void;
};

const OVERLAY_VIEW_HANDLERS = new WeakMap<HTMLElement, OverlayViewHandlers>();
const OVERLAY_VIEW_BOUND_ROOTS = new WeakSet<HTMLElement>();

type OverlayControlSpec = {
  action: ShortcutAction;
  label: string;
  description: string;
};

const CONTROL_SPECS: OverlayControlSpec[] = [
  {
    action: 'decreaseSpeed',
    label: 'Speed -',
    description: 'Decrease speed',
  },
  {
    action: 'increaseSpeed',
    label: 'Speed +',
    description: 'Increase speed',
  },
  {
    action: 'nudgeSectionStartBackward',
    label: 'Start -0.1',
    description: 'Move section start earlier by 0.1s',
  },
  {
    action: 'nudgeSectionStartForward',
    label: 'Start +0.1',
    description: 'Move section start later by 0.1s',
  },
  {
    action: 'nudgeSectionEndBackward',
    label: 'End -0.1',
    description: 'Move section end earlier by 0.1s',
  },
  {
    action: 'nudgeSectionEndForward',
    label: 'End +0.1',
    description: 'Move section end later by 0.1s',
  },
  {
    action: 'markSectionStart',
    label: 'Mark Start',
    description: 'Mark the current playback time as the section start',
  },
  {
    action: 'markSectionEnd',
    label: 'Mark End',
    description: 'Save the section using the current playback time as the end',
  },
];

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getShortcutLabel(action: ShortcutAction): string {
  const code = DEFAULT_KEYMAP[action];

  switch (code) {
    case 'BracketLeft':
      return '[';
    case 'BracketRight':
      return ']';
    case 'Backslash':
      return '\\';
    case 'Slash':
      return '/';
    case 'Semicolon':
      return ';';
    case 'Quote':
      return "'";
    case 'Minus':
      return '-';
    case 'Equal':
      return '=';
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    case 'KeyO':
      return 'O';
    case 'KeyP':
      return 'P';
    default:
      return code;
  }
}

function describeShortcut(action: ShortcutAction): string {
  return `${getShortcutLabel(action)}`;
}

function renderControlButton(spec: OverlayControlSpec): string {
  return `
    <button
      type="button"
      class="bp-overlay__control-button"
      data-shortcut-action="${spec.action}"
      title="${escapeHtml(`${spec.description} (${describeShortcut(spec.action)})`)}"
    >
      ${escapeHtml(spec.label)}
    </button>
  `;
}

function renderLegend(): string {
  const legendRows = [
    ['Prev section', 'selectPreviousSection'],
    ['Next section', 'selectNextSection'],
    ['Run selected', 'executeSelectedSection'],
    ['Toggle key guide', 'togglePanel'],
    ['Mark start', 'markSectionStart'],
    ['Mark end', 'markSectionEnd'],
    ['Start -0.1', 'nudgeSectionStartBackward'],
    ['Start +0.1', 'nudgeSectionStartForward'],
    ['End -0.1', 'nudgeSectionEndBackward'],
    ['End +0.1', 'nudgeSectionEndForward'],
    ['Speed -', 'decreaseSpeed'],
    ['Speed +', 'increaseSpeed'],
  ] as const;

  return `
    <div class="bp-overlay__legend">
      <p class="bp-overlay__legend-title">Keyboard shortcuts</p>
      <div class="bp-overlay__legend-grid">
        ${legendRows
          .map(
            ([label, action]) => `
              <div class="bp-overlay__legend-row">
                <span>${escapeHtml(label)}</span>
                <kbd>${escapeHtml(describeShortcut(action))}</kbd>
              </div>
            `,
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderSections(model: OverlayViewModel): string {
  if (model.sections.length === 0) {
    return `
      <div class="bp-overlay__panel">
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

  const sectionItems = model.sections
    .map((section) => {
      const isSelected = section.id === model.selectedSectionId;
      const isActive = section.id === model.activeSectionId;
      const badges = [
        isSelected ? '<span class="bp-overlay__badge bp-overlay__badge--selected">Selected</span>' : '',
        isActive ? '<span class="bp-overlay__badge bp-overlay__badge--active">Looping</span>' : '',
      ]
        .filter(Boolean)
        .join('');
      const memo =
        isSelected && section.memo
          ? `<p class="bp-overlay__section-memo">${escapeHtml(section.memo)}</p>`
          : '';

      return `
        <li>
          <button
            type="button"
            class="bp-overlay__section${isSelected ? ' bp-overlay__section--selected' : ''}${isActive ? ' bp-overlay__section--active' : ''}"
            data-section-id="${escapeHtml(section.id)}"
            title="Click to run this section immediately"
          >
            <span class="bp-overlay__section-topline">
              <strong class="bp-overlay__section-name">${escapeHtml(section.name)}</strong>
              <span class="bp-overlay__section-badges">${badges}</span>
            </span>
            ${memo}
          </button>
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
        Click a section to run it immediately.${selectedSection?.memo ? ' The selected memo appears inline.' : ''}
      </p>
    </div>
  `;
}

function renderToolbar(model: OverlayViewModel): string {
  const loopTitle = model.loopEnabled
    ? 'Loop off: stop repeating the active section (button only)'
    : `Loop on: run the selected section and start looping it (${describeShortcut('executeSelectedSection')})`;
  const loopLabel = model.loopEnabled ? 'Loop Off' : 'Loop On';
  const activeSummary = model.activeSectionName
    ? `Looping ${model.activeSectionName}`
    : 'No active loop';

  return `
    <div class="bp-overlay__toolbar">
      <div class="bp-overlay__toolbar-group bp-overlay__toolbar-group--identity">
        <span class="bp-overlay__selection-chip" title="Currently selected section">
          ${escapeHtml(model.selectedSectionName ?? 'No section selected')}
        </span>
        <span class="bp-overlay__active-chip">${escapeHtml(activeSummary)}</span>
      </div>

      <div class="bp-overlay__toolbar-group bp-overlay__toolbar-group--speed">
        ${renderControlButton(CONTROL_SPECS[0])}
        <span class="bp-overlay__speed-chip" title="Current playback speed">
          ${escapeHtml(model.speedLabel)}
        </span>
        ${renderControlButton(CONTROL_SPECS[1])}
      </div>

      <div class="bp-overlay__toolbar-group">
        ${renderControlButton(CONTROL_SPECS[2])}
        ${renderControlButton(CONTROL_SPECS[3])}
      </div>

      <div class="bp-overlay__toolbar-group">
        ${renderControlButton(CONTROL_SPECS[4])}
        ${renderControlButton(CONTROL_SPECS[5])}
      </div>

      <div class="bp-overlay__toolbar-group">
        ${renderControlButton(CONTROL_SPECS[6])}
        ${renderControlButton(CONTROL_SPECS[7])}
        <button
          type="button"
          class="bp-overlay__control-button bp-overlay__control-button--loop"
          data-overlay-action="toggleLoop"
          title="${escapeHtml(loopTitle)}"
        >
          ${escapeHtml(loopLabel)}
        </button>
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
      const shortcutAction = target.dataset.shortcutAction;

      if (shortcutAction) {
        currentHandlers?.onShortcutAction?.(shortcutAction as ShortcutAction);
        return;
      }

      if (target.dataset.overlayAction === 'toggleLoop') {
        currentHandlers?.onToggleLoop?.();
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
    render(model: OverlayViewModel) {
      const statusText =
        model.statusMessage ??
        (model.restoreStatus === 'blocked' ? 'Tap play to resume loop' : '');
      const statusLabel = statusText
        ? `<span class="bp-overlay__restore">${escapeHtml(statusText)}</span>`
        : '<span class="bp-overlay__restore bp-overlay__restore--muted">Hover buttons to see the shortcuts. Press / to open the full key guide.</span>';

      root.innerHTML = `
        <div class="bp-overlay">
          ${renderToolbar(model)}
          <div class="bp-overlay__status-row">
            <span class="bp-overlay__loop">${model.loopEnabled ? 'Loop on' : 'Loop off'}</span>
            ${statusLabel}
          </div>
          ${renderSections(model)}
          ${model.panelExpanded ? renderLegend() : ''}
        </div>
      `;
    },
  };
}
