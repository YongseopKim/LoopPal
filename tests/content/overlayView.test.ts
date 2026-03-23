import { describe, expect, it } from 'vitest';
import {
  createOverlayView,
  type OverlayScreenModel,
  type OverlayViewModel,
} from '../../src/content/ui/overlayView';
import { createShortcutKeymap } from '../../src/content/runtime/defaultKeymap';

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

const screenModel: OverlayScreenModel = {
  practice: viewModel,
  shortcutKeymap: createShortcutKeymap(),
  shortcutModal: {
    isOpen: false,
    captureAction: null,
    statusMessage: null,
  },
};

describe('overlayView', () => {
  it('renders the control bar and always-visible section list', () => {
    const root = document.createElement('div');
    const view = createOverlayView(root);

    view.render(screenModel);

    expect(root.textContent).toContain('Chorus groove');
    expect(root.textContent).toContain('Verse pocket');
    expect(root.textContent).toContain('0.75x');
    expect(root.querySelector('.bp-overlay__panel')).not.toBeNull();
    expect(root.querySelectorAll('.bp-overlay__section')).toHaveLength(2);
    expect(root.textContent).toContain('memo: mute on beat 4');
    expect(root.textContent).toContain('memo: lean into the pickup');
  });

  it('renders hover help for buttons and row click affordances', () => {
    const root = document.createElement('div');
    const view = createOverlayView(root);

    view.render({
      ...screenModel,
      shortcutKeymap: createShortcutKeymap({
        increaseSpeed: {
          code: 'KeyK',
          shiftKey: true,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
        },
      }),
      shortcutModal: {
        isOpen: true,
        captureAction: 'increaseSpeed',
        statusMessage: 'Press a new shortcut',
      },
    });

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
    expect(increaseSpeedButton?.title).toContain('Shift+K');
    expect(loopToggleButton?.title).toContain('Loop');
    expect(secondSection?.title).toContain('Click to run this section');
    expect(root.textContent).toContain('Press a new shortcut');
    expect(root.textContent).toContain('NEW');
    expect(root.querySelector('.bp-overlay__section--selected')).not.toBeNull();
    expect(root.querySelector('.bp-overlay__section--active')).not.toBeNull();
  });

  it('calls the click handlers for control buttons and section rows', () => {
    const root = document.createElement('div');
    const handledShortcuts: string[] = [];
    const executedSections: string[] = [];
    const deletedSections: string[] = [];
    let toggledLoop = 0;
    const view = createOverlayView(root, {
      onShortcutAction(action) {
        handledShortcuts.push(action);
      },
      onExecuteSection(sectionId) {
        executedSections.push(sectionId);
      },
      onDeleteSection(sectionId) {
        deletedSections.push(sectionId);
      },
      onToggleLoop() {
        toggledLoop += 1;
      },
    });

    view.render(screenModel);

    root
      .querySelector<HTMLElement>('[data-overlay-action="executeSection"][data-section-id="section-2"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    root
      .querySelector<HTMLElement>('[data-overlay-action="deleteSection"][data-section-id="section-2"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    root
      .querySelector<HTMLElement>('[data-shortcut-action="increaseSpeed"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    root
      .querySelector<HTMLElement>('[data-overlay-action="toggleLoop"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(executedSections).toEqual(['section-2']);
    expect(deletedSections).toEqual(['section-2']);
    expect(handledShortcuts).toEqual(['increaseSpeed']);
    expect(toggledLoop).toBe(1);
  });

  it('renders a status message when present', () => {
    const root = document.createElement('div');
    const view = createOverlayView(root);

    view.render({
      ...screenModel,
      practice: {
        ...viewModel,
        statusMessage: 'Start marked at 0:12.3',
      },
    });

    expect(root.textContent).toContain('Start marked at 0:12.3');
  });

  it('renders long section timestamps in watch-style timecode', () => {
    const root = document.createElement('div');
    const view = createOverlayView(root);

    view.render({
      ...screenModel,
      practice: {
        ...viewModel,
        sections: [
          {
            id: 'section-1',
            name: 'Long-form solo',
            memo: 'stay relaxed',
            startTimeSec: 3_723.4,
            endTimeSec: 3_730.8,
          },
        ],
      },
    });

    expect(root.textContent).toContain('1:02:03.4');
    expect(root.textContent).toContain('1:02:10.8');
    expect(root.textContent).not.toContain('3723.4s');
  });
});
