export const SHORTCUT_ACTIONS = [
  'selectPreviousSection',
  'selectNextSection',
  'executeSelectedSection',
  'deleteSelectedSection',
  'togglePanel',
  'markSectionStart',
  'markSectionEnd',
  'nudgeSectionStartBackward',
  'nudgeSectionStartForward',
  'nudgeSectionEndBackward',
  'nudgeSectionEndForward',
  'decreaseSpeed',
  'increaseSpeed',
  'selectSectionSlot1',
  'selectSectionSlot2',
  'selectSectionSlot3',
  'selectSectionSlot4',
  'selectSectionSlot5',
  'selectSectionSlot6',
  'selectSectionSlot7',
  'selectSectionSlot8',
  'selectSectionSlot9',
  'selectSectionSlot10',
] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

export type ShortcutBinding = {
  code: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type ShortcutKeymap = Record<ShortcutAction, ShortcutBinding>;

export const SHORTCUT_ACTION_GROUPS = [
  {
    id: 'navigation',
    label: 'Section Navigation',
    actions: [
      'selectPreviousSection',
      'selectNextSection',
      'executeSelectedSection',
      'deleteSelectedSection',
      'togglePanel',
    ],
  },
  {
    id: 'editing',
    label: 'Section Editing',
    actions: [
      'markSectionStart',
      'markSectionEnd',
      'nudgeSectionStartBackward',
      'nudgeSectionStartForward',
      'nudgeSectionEndBackward',
      'nudgeSectionEndForward',
    ],
  },
  {
    id: 'playback',
    label: 'Playback',
    actions: ['decreaseSpeed', 'increaseSpeed'],
  },
  {
    id: 'direct',
    label: 'Direct Section Select',
    actions: [
      'selectSectionSlot1',
      'selectSectionSlot2',
      'selectSectionSlot3',
      'selectSectionSlot4',
      'selectSectionSlot5',
      'selectSectionSlot6',
      'selectSectionSlot7',
      'selectSectionSlot8',
      'selectSectionSlot9',
      'selectSectionSlot10',
    ],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  actions: readonly ShortcutAction[];
}>;

export const SHORTCUT_ACTION_META: Record<
  ShortcutAction,
  { label: string; description: string }
> = {
  selectPreviousSection: {
    label: 'Previous section',
    description: 'Select the previous saved section',
  },
  selectNextSection: {
    label: 'Next section',
    description: 'Select the next saved section',
  },
  executeSelectedSection: {
    label: 'Run selected section',
    description: 'Run the currently selected section',
  },
  deleteSelectedSection: {
    label: 'Delete selected section',
    description: 'Delete the selected section',
  },
  togglePanel: {
    label: 'Toggle key guide',
    description: 'Show or hide the keyboard shortcut guide',
  },
  markSectionStart: {
    label: 'Mark section start',
    description: 'Mark the current playback time as the section start',
  },
  markSectionEnd: {
    label: 'Mark section end',
    description: 'Save the section using the current playback time as the end',
  },
  nudgeSectionStartBackward: {
    label: 'Section start -0.1s',
    description: 'Move the selected section start earlier by 0.1 seconds',
  },
  nudgeSectionStartForward: {
    label: 'Section start +0.1s',
    description: 'Move the selected section start later by 0.1 seconds',
  },
  nudgeSectionEndBackward: {
    label: 'Section end -0.1s',
    description: 'Move the selected section end earlier by 0.1 seconds',
  },
  nudgeSectionEndForward: {
    label: 'Section end +0.1s',
    description: 'Move the selected section end later by 0.1 seconds',
  },
  decreaseSpeed: {
    label: 'Speed -',
    description: 'Decrease speed',
  },
  increaseSpeed: {
    label: 'Speed +',
    description: 'Increase speed',
  },
  selectSectionSlot1: {
    label: 'Select section 1',
    description: 'Select the first saved section',
  },
  selectSectionSlot2: {
    label: 'Select section 2',
    description: 'Select the second saved section',
  },
  selectSectionSlot3: {
    label: 'Select section 3',
    description: 'Select the third saved section',
  },
  selectSectionSlot4: {
    label: 'Select section 4',
    description: 'Select the fourth saved section',
  },
  selectSectionSlot5: {
    label: 'Select section 5',
    description: 'Select the fifth saved section',
  },
  selectSectionSlot6: {
    label: 'Select section 6',
    description: 'Select the sixth saved section',
  },
  selectSectionSlot7: {
    label: 'Select section 7',
    description: 'Select the seventh saved section',
  },
  selectSectionSlot8: {
    label: 'Select section 8',
    description: 'Select the eighth saved section',
  },
  selectSectionSlot9: {
    label: 'Select section 9',
    description: 'Select the ninth saved section',
  },
  selectSectionSlot10: {
    label: 'Select section 10',
    description: 'Select the tenth saved section',
  },
};

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

export const DEFAULT_KEYMAP: ShortcutKeymap = {
  selectPreviousSection: {
    code: 'BracketLeft',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectNextSection: {
    code: 'BracketRight',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  executeSelectedSection: {
    code: 'Backslash',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  deleteSelectedSection: {
    code: 'Delete',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  togglePanel: {
    code: 'Slash',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  markSectionStart: {
    code: 'Semicolon',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  markSectionEnd: {
    code: 'Quote',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  nudgeSectionStartBackward: {
    code: 'Minus',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  nudgeSectionStartForward: {
    code: 'Equal',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  nudgeSectionEndBackward: {
    code: 'Comma',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  nudgeSectionEndForward: {
    code: 'Period',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  decreaseSpeed: {
    code: 'KeyO',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  increaseSpeed: {
    code: 'KeyP',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectSectionSlot1: {
    code: 'Numpad1',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectSectionSlot2: {
    code: 'Numpad2',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectSectionSlot3: {
    code: 'Numpad3',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectSectionSlot4: {
    code: 'Numpad4',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectSectionSlot5: {
    code: 'Numpad5',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectSectionSlot6: {
    code: 'Numpad6',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectSectionSlot7: {
    code: 'Numpad7',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectSectionSlot8: {
    code: 'Numpad8',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectSectionSlot9: {
    code: 'Numpad9',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
  selectSectionSlot10: {
    code: 'Numpad0',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  },
};

function normalizeBinding(
  binding: Partial<ShortcutBinding> | undefined,
  fallback: ShortcutBinding,
): ShortcutBinding {
  return {
    code: binding?.code ?? fallback.code,
    shiftKey: binding?.shiftKey ?? fallback.shiftKey,
    altKey: binding?.altKey ?? fallback.altKey,
    ctrlKey: binding?.ctrlKey ?? fallback.ctrlKey,
    metaKey: binding?.metaKey ?? fallback.metaKey,
  };
}

export function createShortcutKeymap(
  overrides: Partial<Record<ShortcutAction, Partial<ShortcutBinding>>> = {},
): ShortcutKeymap {
  return SHORTCUT_ACTIONS.reduce((keymap, action) => {
    keymap[action] = normalizeBinding(overrides[action], DEFAULT_KEYMAP[action]);
    return keymap;
  }, {} as ShortcutKeymap);
}

export function bindingsEqual(
  left: ShortcutBinding,
  right: ShortcutBinding,
): boolean {
  return (
    left.code === right.code &&
    left.shiftKey === right.shiftKey &&
    left.altKey === right.altKey &&
    left.ctrlKey === right.ctrlKey &&
    left.metaKey === right.metaKey
  );
}

export function keyboardEventToBinding(
  event: Pick<
    KeyboardEvent,
    'code' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'
  >,
): ShortcutBinding | null {
  if (!event.code || MODIFIER_CODES.has(event.code)) {
    return null;
  }

  return {
    code: event.code,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  };
}

function formatCode(code: string): string {
  switch (code) {
    case 'BracketLeft':
      return '[';
    case 'BracketRight':
      return ']';
    case 'Backslash':
      return '\\';
    case 'Slash':
      return '/';
    case 'Semicolon':
      return ';';
    case 'Quote':
      return "'";
    case 'Minus':
      return '-';
    case 'Equal':
      return '=';
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    case 'Space':
      return 'Space';
  }

  if (code.startsWith('Key')) {
    return code.slice(3);
  }

  if (code.startsWith('Digit')) {
    return code.slice(5);
  }

  if (code.startsWith('Numpad')) {
    return `Num ${code.slice(6)}`;
  }

  return code;
}

export function formatShortcutBinding(binding: ShortcutBinding): string {
  const parts: string[] = [];

  if (binding.ctrlKey) {
    parts.push('Ctrl');
  }

  if (binding.altKey) {
    parts.push('Alt');
  }

  if (binding.shiftKey) {
    parts.push('Shift');
  }

  if (binding.metaKey) {
    parts.push('Cmd');
  }

  parts.push(formatCode(binding.code));

  return parts.join('+');
}

export function formatShortcutForAction(
  keymap: ShortcutKeymap,
  action: ShortcutAction,
): string {
  return formatShortcutBinding(keymap[action]);
}

export function parseSectionSlotShortcutAction(
  action: ShortcutAction,
): number | null {
  const match = /^selectSectionSlot(\d+)$/.exec(action);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}
