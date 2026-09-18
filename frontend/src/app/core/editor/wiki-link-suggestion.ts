import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { PopupItem, createSuggestionRenderer } from './suggestion-popup';

const WIKI_LINK_PLUGIN_KEY = new PluginKey('wikiLinkSuggestion');

export interface WikiLinkTarget extends PopupItem {
  id: string;
  label: string; // document title
}

export function createWikiLinkSuggestionExtension(search: (query: string) => Promise<WikiLinkTarget[]>) {
  return Extension.create({
    name: 'wikiLinkSuggestion',
    addProseMirrorPlugins() {
      return [
        Suggestion<WikiLinkTarget>({
          editor: this.editor,
          pluginKey: WIKI_LINK_PLUGIN_KEY,
          char: '[[',
          allowedPrefixes: null,
          items: ({ query }) => search(query),
          command: ({ editor, range, props }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent({
                type: 'wikiLink',
                attrs: { documentId: props.id, title: props.label },
              })
              .insertContent(' ')
              .run();
          },
          render: () => createSuggestionRenderer<WikiLinkTarget>((item) => item.label),
        }),
      ];
    },
  });
}
