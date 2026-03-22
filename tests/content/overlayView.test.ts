import { describe, expect, it } from 'vitest';
import {
  createOverlayView,
  type OverlayViewModel,
} from '../../src/content/ui/overlayView';

const viewModel: OverlayViewModel = {
  selectedSectionName: 'Chorus groove',
  activeSectionName: 'Verse pocket',
  selectedSectionId: 'section-1',
  activeSectionId: 'section-2',
  speedLabel: '0.75x',
  loopEnabled: true,
  panelExpanded: false,
  statusMessage: null,
  sections: [
    {
      id: 'section-1',
      name: 'Chorus groove',
      memo: 'memo: mute on beat 4',
    },
    {
      id: 'section-2',
      name: 'Verse pocket',
      memo: 'memo: lean into the pickup',
    },
  ],
};

describe('overlayView', () => {
  it('renders the control bar and always-visible section list', () => {
    const root = document.createElement('div');
    const view = createOverlayView(root);

    view.render(viewModel);

    expect(root.textContent).toContain('Chorus groove');
    expect(root.textContent).toContain('Verse pocket');
    expect(root.textContent).toContain('0.75x');
    expect(root.querySelector('.bp-overlay__panel')).not.toBeNull();
    expect(root.querySelectorAll('.bp-overlay__section')).toHaveLength(2);
    expect(root.textContent).toContain('memo: mute on beat 4');
    expect(root.textContent).not.toContain('memo: lean into the pickup');
  });

  it('renders hover help for buttons and row click affordances', () => {
    const root = document.createElement('div');
    const view = createOverlayView(root);

    view.render(viewModel);

    const increaseSpeedButton = root.querySelector<HTMLButtonElement>(
      '[data-shortcut-action="increaseSpeed"]',
    );
    const loopToggleButton = root.querySelector<HTMLButtonElement>(
      '[data-overlay-action="toggleLoop"]',
    );
    const secondSection = root.querySelector<HTMLElement>(
      '[data-section-id="section-2"]',
    );

    expect(increaseSpeedButton?.title).toContain('Increase speed');
    expect(increaseSpeedButton?.title).toContain('P');
    expect(loopToggleButton?.title).toContain('Loop');
    expect(secondSection?.title).toContain('Click to run this section');
    expect(root.querySelector('.bp-overlay__section--selected')).not.toBeNull();
    expect(root.querySelector('.bp-overlay__section--active')).not.toBeNull();
  });

  it('calls the click handlers for control buttons and section rows', () => {
    const root = document.createElement('div');
    const handledShortcuts: string[] = [];
    const executedSections: string[] = [];
    let toggledLoop = 0;
    const view = createOverlayView(root, {
      onShortcutAction(action) {
        handledShortcuts.push(action);
      },
      onExecuteSection(sectionId) {
        executedSections.push(sectionId);
      },
      onToggleLoop() {
        toggledLoop += 1;
      },
    });

    view.render(viewModel);

    root
      .querySelector<HTMLElement>('[data-section-id="section-2"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    root
      .querySelector<HTMLElement>('[data-shortcut-action="increaseSpeed"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    root
      .querySelector<HTMLElement>('[data-overlay-action="toggleLoop"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(executedSections).toEqual(['section-2']);
    expect(handledShortcuts).toEqual(['increaseSpeed']);
    expect(toggledLoop).toBe(1);
  });

  it('renders a status message when present', () => {
    const root = document.createElement('div');
    const view = createOverlayView(root);

    view.render({
      ...viewModel,
      statusMessage: 'Start marked at 12.3s',
    });

    expect(root.textContent).toContain('Start marked at 12.3s');
  });
});
