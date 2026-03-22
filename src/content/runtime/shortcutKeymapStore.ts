import {
  createShortcutKeymap,
  type ShortcutAction,
  type ShortcutBinding,
  type ShortcutKeymap,
} from './defaultKeymap';

type StorageAreaLike = Pick<chrome.storage.StorageArea, 'get' | 'set'>;

const SHORTCUT_KEYMAP_STORAGE_KEY = 'settings:shortcutKeymap';

function isBinding(value: unknown): value is Partial<ShortcutBinding> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'code' in value;
}

export function createShortcutKeymapStore(storageArea: StorageAreaLike) {
  return {
    async load(): Promise<ShortcutKeymap> {
      const result = await storageArea.get(SHORTCUT_KEYMAP_STORAGE_KEY);
      const storedKeymap = result[SHORTCUT_KEYMAP_STORAGE_KEY] as
        | Partial<Record<ShortcutAction, Partial<ShortcutBinding>>>
        | undefined;

      if (!storedKeymap || typeof storedKeymap !== 'object') {
        return createShortcutKeymap();
      }

      const overrides = Object.entries(storedKeymap).reduce(
        (nextOverrides, [action, binding]) => {
          if (isBinding(binding)) {
            nextOverrides[action as ShortcutAction] = binding;
          }

          return nextOverrides;
        },
        {} as Partial<Record<ShortcutAction, Partial<ShortcutBinding>>>,
      );

      return createShortcutKeymap(overrides);
    },
    async save(keymap: ShortcutKeymap): Promise<void> {
      await storageArea.set({
        [SHORTCUT_KEYMAP_STORAGE_KEY]: keymap,
      });
    },
  };
}
