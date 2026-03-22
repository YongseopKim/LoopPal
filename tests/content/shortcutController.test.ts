import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createShortcutController } from '../../src/content/runtime/shortcutController';
import {
  createShortcutKeymap,
  type ShortcutKeymap,
} from '../../src/content/runtime/defaultKeymap';

describe('shortcutController', () => {
  beforeEach(() => {
    document.body.innerHTML = '';

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  it('routes a matching key to an action', () => {
    const onAction = vi.fn();
    const controller = createShortcutController({
      onAction,
      getKeymap: () => createShortcutKeymap(),
    });

    controller.handle(new KeyboardEvent('keydown', { code: 'BracketRight' }));

    expect(onAction).toHaveBeenCalledWith('selectNextSection');
  });

  it('routes the section start shortcut', () => {
    const onAction = vi.fn();
    const controller = createShortcutController({
      onAction,
      getKeymap: () => createShortcutKeymap(),
    });

    controller.handle(new KeyboardEvent('keydown', { code: 'Semicolon' }));

    expect(onAction).toHaveBeenCalledWith('markSectionStart');
  });

  it('ignores key presses inside text inputs', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    const onAction = vi.fn();
    const controller = createShortcutController({
      onAction,
      getKeymap: () => createShortcutKeymap(),
    });

    controller.handle(new KeyboardEvent('keydown', { code: 'BracketRight' }));

    expect(onAction).not.toHaveBeenCalled();
  });

  it('supports exact modifier combinations from the configured keymap', () => {
    const onAction = vi.fn();
    const customKeymap: ShortcutKeymap = createShortcutKeymap({
      increaseSpeed: {
        code: 'KeyP',
        shiftKey: true,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      },
    });
    const controller = createShortcutController({
      onAction,
      getKeymap: () => customKeymap,
    });

    controller.handle(
      new KeyboardEvent('keydown', { code: 'KeyP', shiftKey: true }),
    );

    expect(onAction).toHaveBeenCalledWith('increaseSpeed');
  });

  it('routes delete shortcut', () => {
    const onAction = vi.fn();
    const controller = createShortcutController({
      onAction,
      getKeymap: () => createShortcutKeymap(),
    });

    controller.handle(new KeyboardEvent('keydown', { code: 'Delete' }));

    expect(onAction).toHaveBeenCalledWith('deleteSelectedSection');
  });

  it('also routes Backspace when delete is mapped to the default', () => {
    const onAction = vi.fn();
    const controller = createShortcutController({
      onAction,
      getKeymap: () => createShortcutKeymap(),
    });

    controller.handle(
      new KeyboardEvent('keydown', { code: 'Backspace' }),
    );

    expect(onAction).toHaveBeenCalledWith('deleteSelectedSection');
  });

  it('ignores modified combinations when the modifiers do not match exactly', () => {
    const onAction = vi.fn();
    const customKeymap: ShortcutKeymap = createShortcutKeymap({
      selectNextSection: {
        code: 'BracketRight',
        shiftKey: false,
        altKey: false,
        ctrlKey: true,
        metaKey: false,
      },
    });
    const controller = createShortcutController({
      onAction,
      getKeymap: () => customKeymap,
    });

    controller.handle(
      new KeyboardEvent('keydown', {
        code: 'BracketRight',
        ctrlKey: true,
        shiftKey: true,
      }),
    );

    expect(onAction).not.toHaveBeenCalled();
  });

  it('routes the default numpad section slot shortcuts', () => {
    const onAction = vi.fn();
    const controller = createShortcutController({
      onAction,
      getKeymap: () => createShortcutKeymap(),
    });

    controller.handle(new KeyboardEvent('keydown', { code: 'Numpad1' }));

    expect(onAction).toHaveBeenCalledWith('selectSectionSlot1');
  });

  it('ignores key presses from contenteditable elements', () => {
    const editable = document.createElement('div');
    const child = document.createElement('span');

    editable.setAttribute('contenteditable', 'true');
    editable.append(child);
    document.body.append(editable);

    const onAction = vi.fn();
    const controller = createShortcutController({
      onAction,
      getKeymap: () => createShortcutKeymap(),
    });

    document.addEventListener('keydown', controller.handle);
    child.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, code: 'BracketRight' }),
    );
    document.removeEventListener('keydown', controller.handle);

    expect(onAction).not.toHaveBeenCalled();
  });

  it('ignores key presses from shadow-dom text inputs', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');

    shadowRoot.append(input);
    document.body.append(host);
    input.focus();

    const onAction = vi.fn();
    const controller = createShortcutController({
      onAction,
      getKeymap: () => createShortcutKeymap(),
    });

    document.addEventListener('keydown', controller.handle);
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        code: 'BracketRight',
        composed: true,
      }),
    );
    document.removeEventListener('keydown', controller.handle);

    expect(onAction).not.toHaveBeenCalled();
  });
});
