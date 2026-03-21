export const DEFAULT_KEYMAP = {
  selectPreviousSection: 'BracketLeft',
  selectNextSection: 'BracketRight',
  executeSelectedSection: 'Backslash',
  togglePanel: 'Slash',
} as const;

export type ShortcutAction = keyof typeof DEFAULT_KEYMAP;
