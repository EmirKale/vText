import { Node, mergeAttributes } from '@tiptap/core';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info', // 'info' | 'warning' | 'success'
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes.type || 'info';
    let borderColor = 'border-blue-500';
    let bgColor = 'bg-blue-50 dark:bg-blue-950/20';
    let icon = 'ℹ️';

    if (type === 'warning') {
      borderColor = 'border-amber-500';
      bgColor = 'bg-amber-50 dark:bg-amber-950/20';
      icon = '⚠️';
    } else if (type === 'success') {
      borderColor = 'border-emerald-500';
      bgColor = 'bg-emerald-50 dark:bg-emerald-950/20';
      icon = '✅';
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'callout',
        class: `kalem-callout my-4 p-4 rounded-lg border-l-4 ${borderColor} ${bgColor} flex items-start gap-3`
      }),
      ['span', { class: 'select-none text-base leading-none pt-0.5' }, icon],
      ['div', { class: 'callout-content flex-1 outline-none' }, 0],
    ];
  },
});
