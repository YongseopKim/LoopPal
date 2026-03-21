import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createShortcutController } from '../../src/content/runtime/shortcutController';

describe('shortcutController', () => {
  beforeEach(() => {
    document.body.innerHTML = '';

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

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

  it('ignores modified shortcut combinations', () => {
    const onAction = vi.fn();
    const controller = createShortcutController({ onAction });

    controller.handle(
      new KeyboardEvent('keydown', { code: 'BracketRight', metaKey: true }),
    );

    expect(onAction).not.toHaveBeenCalled();
  });

  it('ignores key presses from contenteditable elements', () => {
    const editable = document.createElement('div');
    const child = document.createElement('span');

    editable.setAttribute('contenteditable', 'true');
    editable.append(child);
    document.body.append(editable);

    const onAction = vi.fn();
    const controller = createShortcutController({ onAction });

    document.addEventListener('keydown', controller.handle);
    child.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, code: 'BracketRight' }),
    );
    document.removeEventListener('keydown', controller.handle);

    expect(onAction).not.toHaveBeenCalled();
  });
});
