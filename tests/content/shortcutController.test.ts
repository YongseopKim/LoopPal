import { describe, expect, it, vi } from 'vitest';
import { createShortcutController } from '../../src/content/runtime/shortcutController';

describe('shortcutController', () => {
  it('routes a matching key to an action', () => {
    const onAction = vi.fn();
    const controller = createShortcutController({ onAction });

    controller.handle(new KeyboardEvent('keydown', { code: 'BracketRight' }));

    expect(onAction).toHaveBeenCalledWith('selectNextSection');
  });

  it('ignores key presses inside text inputs', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    const onAction = vi.fn();
    const controller = createShortcutController({ onAction });

    controller.handle(new KeyboardEvent('keydown', { code: 'BracketRight' }));

    expect(onAction).not.toHaveBeenCalled();
  });
});
