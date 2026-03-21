import { describe, expect, it } from 'vitest';
import {
  createOverlayView,
  type OverlayViewModel,
} from '../../src/content/ui/overlayView';

const viewModel: OverlayViewModel = {
  selectedSectionName: 'Chorus groove',
  activeSectionName: 'Verse pocket',
  selectedSectionId: 'section-1',
  activeSectionId: 'section-1',
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
  ],
};

describe('overlayView', () => {
  it('renders the compact bar with section and speed state', () => {
    const root = document.createElement('div');
    const view = createOverlayView(root);

    view.render(viewModel);

    expect(root.textContent).toContain('Chorus groove');
    expect(root.textContent).toContain('Verse pocket');
    expect(root.textContent).toContain('0.75x');
    expect(root.querySelector('.bp-overlay__panel')).toBeNull();
  });

  it('shows the saved section list when expanded', () => {
    const root = document.createElement('div');
    const view = createOverlayView(root);

    view.render({ ...viewModel, panelExpanded: true });

    expect(root.querySelector('.bp-overlay__panel')).not.toBeNull();
    expect(root.textContent).toContain('memo: mute on beat 4');
    expect(root.querySelector('.bp-overlay__section--selected')).not.toBeNull();
    expect(root.querySelector('.bp-overlay__section--active')).not.toBeNull();
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
