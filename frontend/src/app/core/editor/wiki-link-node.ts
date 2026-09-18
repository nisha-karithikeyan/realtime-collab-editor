import { Node, mergeAttributes } from '@tiptap/core';

export interface WikiLinkOptions {
  onNavigate: ((documentId: string) => void) | null;
}

/**
 * An inline, atomic node representing a `[[Page Title]]` reference.
 * Rendered as a styled chip; clicking it navigates to the target
 * document. The actual backlink bookkeeping happens server-side (see
 * documents.views.DocumentViewSet.set_links) - this node just needs to
 * carry the target document's id and a display title.
 */
export const WikiLinkNode = Node.create<WikiLinkOptions>({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return { onNavigate: null };
  },

  addAttributes() {
    return {
      documentId: { default: null },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-link]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': '',
        'data-document-id': node.attrs['documentId'],
        class: 'wiki-link',
      }),
      `[[${node.attrs['title']}]]`,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'wiki-link';
      dom.dataset['documentId'] = node.attrs['documentId'];
      dom.textContent = `[[${node.attrs['title']}]]`;
      dom.addEventListener('click', (event) => {
        event.preventDefault();
        this.options.onNavigate?.(node.attrs['documentId']);
      });
      return { dom };
    };
  },
});
