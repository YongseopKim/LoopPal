export type OverlaySectionSummary = {
  id: string;
  name: string;
  memo: string;
};

export type OverlayViewModel = {
  selectedSectionName: string | null;
  speedLabel: string;
  loopEnabled: boolean;
  panelExpanded: boolean;
  restoreStatus?: 'idle' | 'started' | 'blocked';
  sections: OverlaySectionSummary[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPanel(model: OverlayViewModel): string {
  if (model.sections.length === 0) {
    return `
      <div class="bp-overlay__panel">
        <p class="bp-overlay__empty">No saved sections yet.</p>
      </div>
    `;
  }

  const sections = model.sections
    .map(
      (section) => `
        <li class="bp-overlay__section" data-section-id="${escapeHtml(section.id)}">
          <strong class="bp-overlay__section-name">${escapeHtml(section.name)}</strong>
          <p class="bp-overlay__section-memo">${escapeHtml(section.memo)}</p>
        </li>
      `,
    )
    .join('');

  return `
    <div class="bp-overlay__panel">
      <p class="bp-overlay__panel-title">Saved sections</p>
      <ul class="bp-overlay__sections">${sections}</ul>
    </div>
  `;
}

export function createOverlayView(root: HTMLElement) {
  return {
    render(model: OverlayViewModel) {
      const restoreLabel =
        model.restoreStatus === 'blocked'
          ? '<span class="bp-overlay__restore">Tap play to resume loop</span>'
          : '';

      root.innerHTML = `
        <div class="bp-overlay">
          <div class="bp-overlay__bar">
            <strong class="bp-overlay__section-label">${escapeHtml(model.selectedSectionName ?? 'No section selected')}</strong>
            <span class="bp-overlay__speed">${escapeHtml(model.speedLabel)}</span>
            <span class="bp-overlay__loop">${model.loopEnabled ? 'Loop on' : 'Loop off'}</span>
            ${restoreLabel}
          </div>
          ${model.panelExpanded ? renderPanel(model) : ''}
        </div>
      `;
    },
  };
}
