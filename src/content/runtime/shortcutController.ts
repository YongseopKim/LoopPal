import {
  DEFAULT_KEYMAP,
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
}: {
  onAction: (action: ShortcutAction) => void;
}) {
  return {
    handle(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (hasEditableTarget(event)) {
        return;
      }

      const match = Object.entries(DEFAULT_KEYMAP).find(
        ([, code]) => code === event.code,
      );

      if (!match) {
        return;
      }

      event.preventDefault();
      onAction(match[0] as ShortcutAction);
    },
  };
}
