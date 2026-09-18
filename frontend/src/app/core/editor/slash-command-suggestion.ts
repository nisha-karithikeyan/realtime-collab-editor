import { Editor, Extension, Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';

const SLASH_COMMAND_PLUGIN_KEY = new PluginKey('slashCommandSuggestion');
import { PopupItem, createSuggestionRenderer } from './suggestion-popup';

export interface SlashCommandItem extends PopupItem {
  run: (editor: Editor, range: Range) => void;
}

const IMAGE_URL_PROMPT = 'Image URL';

// No "embed" block type: rendering an arbitrary iframe from user-entered
// content is a real XSS/clickjacking surface, and building it safely
// (an allowlist of trusted embed providers, sandboxing, CSP) is its own
// project - cut from this pass rather than shipped half-safe.
export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    id: 'heading1',
    label: 'Heading 1',
    sublabel: 'Big section heading',
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    sublabel: 'Medium section heading',
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    sublabel: 'Small section heading',
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    id: 'bulletList',
    label: 'Bullet list',
    sublabel: 'Simple unordered list',
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: 'orderedList',
    label: 'Numbered list',
    sublabel: 'List with numbering',
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: 'taskList',
    label: 'To-do list',
    sublabel: 'Checkbox list',
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    sublabel: 'Monospace code with syntax highlighting off',
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: 'blockquote',
    label: 'Quote',
    sublabel: 'Blockquote callout',
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: 'divider',
    label: 'Divider',
    sublabel: 'Horizontal rule',
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: 'image',
    label: 'Image',
    sublabel: 'Embed by URL',
    run: (editor, range) => {
      const url = window.prompt(IMAGE_URL_PROMPT);
      const chain = editor.chain().focus().deleteRange(range);
      if (url) chain.setImage({ src: url }).run();
      else chain.run();
    },
  },
];

function filterItems(query: string): SlashCommandItem[] {
  const q = query.toLowerCase();
  return SLASH_COMMAND_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
}

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        pluginKey: SLASH_COMMAND_PLUGIN_KEY,
        char: '/',
        allowedPrefixes: null,
        items: ({ query }) => filterItems(query),
        // @tiptap/suggestion v3.31.3's reported `range` only spans the
        // trigger char itself ({from, to: from+1}), not the full typed
        // query - deleteRange(range) then leaves the query text behind
        // as plain text in front of the inserted block. Recompute the
        // real end from the live selection (the cursor sits right after
        // the full "/query" at command time) instead of trusting it.
        command: ({ editor, range, props }) => {
          const correctedRange = { from: range.from, to: editor.state.selection.from };
          props.run(editor, correctedRange);
        },
        render: () =>
          createSuggestionRenderer<SlashCommandItem>((item) => `${item.label} — ${item.sublabel}`),
      }),
    ];
  },
});
