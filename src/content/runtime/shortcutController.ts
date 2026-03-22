import {
  bindingsEqual,
  keyboardEventToBinding,
  type ShortcutKeymap,
  type ShortcutAction,
} from './defaultKeymap';

function isEditableTarget(target: EventTarget | null): boolean {
  let element =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  while (element) {
    const contentEditable = element.getAttribute('contenteditable');

    if (
      ['INPUT', 'TEXTAREA'].includes(element.tagName) ||
      element.isContentEditable ||
      (contentEditable !== null && contentEditable.toLowerCase() !== 'false')
    ) {
      return true;
    }

    element = element.parentElement;
  }

  return false;
}

function hasEditableTarget(event: KeyboardEvent): boolean {
  const targets = event.composedPath();
  const fallbackTarget = event.target ?? document.activeElement;

  if (targets.length === 0) {
    return isEditableTarget(fallbackTarget);
  }

  return targets.some((target) => isEditableTarget(target));
}

export function createShortcutController({
  onAction,
  getKeymap,
}: {
  onAction: (action: ShortcutAction) => void;
  getKeymap: () => ShortcutKeymap;
}) {
  return {
    handle(event: KeyboardEvent) {
      if (hasEditableTarget(event)) {
        return;
      }

      const binding = keyboardEventToBinding(event);

      if (!binding) {
        return;
      }

      const keymap = getKeymap();
      const match = Object.entries(keymap).find(
        ([, expectedBinding]) => bindingsEqual(expectedBinding, binding),
      );

      if (!match) {
        const deleteBinding = keymap.deleteSelectedSection;

        if (
          deleteBinding.code === 'Delete'
          && !deleteBinding.shiftKey
          && !deleteBinding.altKey
          && !deleteBinding.ctrlKey
          && !deleteBinding.metaKey
          && binding.code === 'Backspace'
          && !binding.shiftKey
          && !binding.altKey
          && !binding.ctrlKey
          && !binding.metaKey
        ) {
          event.preventDefault();
          onAction('deleteSelectedSection');
        }

        return;
      }

      event.preventDefault();
      onAction(match[0] as ShortcutAction);
    },
  };
}
