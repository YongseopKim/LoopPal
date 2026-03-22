import { describe, expect, it, vi } from 'vitest';
import {
  createShortcutKeymap,
  type ShortcutKeymap,
} from '../../src/content/runtime/defaultKeymap';
import { createShortcutKeymapStore } from '../../src/content/runtime/shortcutKeymapStore';

describe('shortcutKeymapStore', () => {
  it('loads the default keymap when nothing has been saved yet', async () => {
    const store = createShortcutKeymapStore({
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn(),
    });

    await expect(store.load()).resolves.toEqual(createShortcutKeymap());
  });

  it('loads and saves customized shortcut bindings', async () => {
    const customKeymap: ShortcutKeymap = createShortcutKeymap({
      increaseSpeed: {
        code: 'KeyK',
        shiftKey: true,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      },
      selectSectionSlot1: {
        code: 'Digit1',
        shiftKey: false,
        altKey: false,
        ctrlKey: true,
        metaKey: false,
      },
    });
    const storage = {
      get: vi.fn().mockResolvedValue({
        'settings:shortcutKeymap': customKeymap,
      }),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const store = createShortcutKeymapStore(storage);

    await expect(store.load()).resolves.toEqual(customKeymap);

    await store.save(customKeymap);

    expect(storage.set).toHaveBeenCalledWith({
      'settings:shortcutKeymap': customKeymap,
    });
  });
});
