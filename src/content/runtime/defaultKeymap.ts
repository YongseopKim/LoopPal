export const DEFAULT_KEYMAP = {
  selectPreviousSection: 'BracketLeft',
  selectNextSection: 'BracketRight',
  executeSelectedSection: 'Backslash',
  togglePanel: 'Slash',
  markSectionStart: 'Semicolon',
  markSectionEnd: 'Quote',
  nudgeSectionStartBackward: 'Minus',
  nudgeSectionStartForward: 'Equal',
  nudgeSectionEndBackward: 'Comma',
  nudgeSectionEndForward: 'Period',
  decreaseSpeed: 'KeyO',
  increaseSpeed: 'KeyP',
} as const;

export type ShortcutAction = keyof typeof DEFAULT_KEYMAP;
