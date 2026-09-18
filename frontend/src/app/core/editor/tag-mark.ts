import { Mark, markInputRule, mergeAttributes } from '@tiptap/core';

// Matches "#word" (letters/digits/hyphen/underscore) typed right before a
// space - turns it into a styled tag mark as you type. Tag *extraction*
// for the tag browser (documents.views.tag_browser) happens separately,
// by scanning the doc's plain text for this same pattern on save.
export const TAG_PATTERN = /#([a-zA-Z0-9_-]+)$/;

export const TagMark = Mark.create({
  name: 'tag',
  inclusive: false,

  parseHTML() {
    return [{ tag: 'span[data-tag]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-tag': '', class: 'tag-mark' }), 0];
  },

  addInputRules() {
    return [
      markInputRule({
        find: new RegExp(`(?:^|\\s)(${TAG_PATTERN.source} )$`),
        type: this.type,
      }),
    ];
  },
});

export function extractTagsFromText(text: string): string[] {
  const matches = text.matchAll(/#([a-zA-Z0-9_-]+)/g);
  const tags = new Set<string>();
  for (const match of matches) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags];
}
