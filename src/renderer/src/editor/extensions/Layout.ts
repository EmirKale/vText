import { Extension, Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (value: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

/** Paragraph / heading line spacing (1.0, 1.15, 1.5, 2.0 …), stored as inline line-height. */
export const LineHeight = Extension.create({
  name: 'lineHeight',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.lineHeight || null,
            renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {})
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (value) =>
        ({ commands }) =>
          ['paragraph', 'heading'].map((t) => commands.updateAttributes(t, { lineHeight: value })).some(Boolean),
      unsetLineHeight:
        () =>
        ({ commands }) =>
          ['paragraph', 'heading'].map((t) => commands.resetAttributes(t, 'lineHeight')).some(Boolean)
    };
  }
});

/** Hard page break (Ctrl+Enter), rendered as a dashed divider and a real break in print/PDF/DOCX. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [
      { tag: 'div[data-page-break]' },
      // Word / LibreOffice HTML exports
      { tag: 'br[style*="page-break-before"]' },
      { tag: 'div[style*="page-break-after: always"]' }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': '', class: 'page-break', style: 'page-break-after: always' })];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent([{ type: this.name }, { type: 'paragraph' }]).run()
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak()
    };
  }
});
