/**
 * Shared floating-list popup renderer for Tiptap's Suggestion plugin -
 * both the slash command menu ("/") and the wiki-link autocomplete
 * ("[[") need the identical behavior (positioned under the cursor,
 * arrow-key navigation, enter to select, mouse click to select, escape
 * to close), so this is written once and parameterized by a label
 * renderer instead of copy-pasted per extension.
 */
export interface PopupItem {
  id: string;
  label: string;
  sublabel?: string;
}

export function createSuggestionRenderer<T extends PopupItem>(getLabel?: (item: T) => string) {
  let element: HTMLDivElement | null = null;
  let items: T[] = [];
  let selectedIndex = 0;
  let onSelect: ((item: T) => void) | null = null;

  function render() {
    if (!element) return;
    element.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'suggestion-popup__empty';
      empty.textContent = 'No matches';
      element.appendChild(empty);
      return;
    }
    items.forEach((item, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'suggestion-popup__item' + (index === selectedIndex ? ' is-selected' : '');
      row.textContent = getLabel ? getLabel(item) : item.label;
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        onSelect?.(item);
      });
      element!.appendChild(row);
    });
  }

  function positionAt(clientRect?: (() => DOMRect | null) | null) {
    if (!element || !clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    element.style.left = `${rect.left + window.scrollX}px`;
    element.style.top = `${rect.bottom + window.scrollY + 4}px`;
  }

  return {
    onStart: (props: {
      items: T[];
      command: (item: T) => void;
      clientRect?: (() => DOMRect | null) | null;
    }) => {
      items = props.items;
      selectedIndex = 0;
      onSelect = props.command;

      element = document.createElement('div');
      element.className = 'suggestion-popup';
      document.body.appendChild(element);
      render();
      positionAt(props.clientRect);
    },

    onUpdate: (props: { items: T[]; clientRect?: (() => DOMRect | null) | null }) => {
      items = props.items;
      selectedIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));
      render();
      positionAt(props.clientRect);
    },

    onKeyDown: (props: { event: KeyboardEvent }): boolean => {
      if (props.event.key === 'Escape') {
        element?.remove();
        element = null;
        return true;
      }
      if (props.event.key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % Math.max(items.length, 1);
        render();
        return true;
      }
      if (props.event.key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + items.length) % Math.max(items.length, 1);
        render();
        return true;
      }
      if (props.event.key === 'Enter') {
        if (items[selectedIndex]) onSelect?.(items[selectedIndex]);
        return true;
      }
      return false;
    },

    onExit: () => {
      element?.remove();
      element = null;
    },
  };
}
