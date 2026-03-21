import {
  DEFAULT_KEYMAP,
  type ShortcutAction,
} from './defaultKeymap';

function isTextInputTarget(target: EventTarget | null): target is HTMLElement {
  return (
    target instanceof HTMLElement &&
    ['INPUT', 'TEXTAREA'].includes(target.tagName)
  );
}

export function createShortcutController({
  onAction,
}: {
  onAction: (action: ShortcutAction) => void;
}) {
  return {
    handle(event: KeyboardEvent) {
      const target = event.target ?? document.activeElement;

      if (isTextInputTarget(target)) {
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
