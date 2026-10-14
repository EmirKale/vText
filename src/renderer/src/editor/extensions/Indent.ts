import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      /** Increase indent of current paragraph or list item */
      indent: () => ReturnType;
      /** Decrease indent of current paragraph or list item */
      outdent: () => ReturnType;
    };
  }
}

/**
 * Word/LibreOffice style Paragraph & Heading Indentation.
 * Automatically delegates to sinkListItem/liftListItem when inside a list.
 */
export const Indent = Extension.create({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'blockquote'],
      minLevel: 0,
      maxLevel: 8,
      indentUnit: 28 // 28px per indent level
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const marginLeft = element.style.marginLeft;
              if (marginLeft) {
                const px = parseInt(marginLeft, 10);
                return Math.round(px / this.options.indentUnit) || 0;
              }
              return 0;
            },
            renderHTML: (attributes) => {
              const indent = attributes.indent || 0;
              if (indent <= 0) return {};
              return {
                style: `margin-left: ${indent * this.options.indentUnit}px;`
              };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch, editor }) => {
          // If in a list item, use TipTap's native sinkListItem
          if (editor.isActive('listItem')) {
            return editor.chain().sinkListItem('listItem').run();
          }
          if (editor.isActive('taskItem')) {
            return editor.chain().sinkListItem('taskItem').run();
          }

          const { selection } = state;
          tr.setSelection(selection);

          const { from, to } = selection;
          let changed = false;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const currentIndent = node.attrs.indent || 0;
              if (currentIndent < this.options.maxLevel) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: currentIndent + 1
                });
                changed = true;
              }
            }
          });

          if (changed && dispatch) {
            dispatch(tr);
          }
          return changed;
        },

      outdent:
        () =>
        ({ tr, state, dispatch, editor }) => {
          // If in a list item, use TipTap's native liftListItem
          if (editor.isActive('listItem')) {
            return editor.chain().liftListItem('listItem').run();
          }
          if (editor.isActive('taskItem')) {
            return editor.chain().liftListItem('taskItem').run();
          }

          const { selection } = state;
          tr.setSelection(selection);

          const { from, to } = selection;
          let changed = false;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const currentIndent = node.attrs.indent || 0;
              if (currentIndent > this.options.minLevel) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: currentIndent - 1
                });
                changed = true;
              }
            }
          });

          if (changed && dispatch) {
            dispatch(tr);
          }
          return changed;
        }
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // If at start of paragraph or in list, indent
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return this.editor.commands.indent();
        }
        return false;
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return this.editor.commands.outdent();
        }
        return false;
      }
    };
  }
});
