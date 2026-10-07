import { Node, mergeAttributes } from '@tiptap/core';

export const PromptBlock = Node.create({
  name: 'promptBlock',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      title: {
        default: 'PROMPT',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="prompt-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'prompt-block',
        class: 'kalem-prompt-block relative group my-4 p-4 rounded-r-lg border-l-4 border-accent bg-accent/5 dark:bg-accent/10 font-mono text-sm'
      }),
      [
        'div',
        { class: 'flex items-center justify-between text-xs font-semibold text-accent mb-1 select-none' },
        ['span', {}, HTMLAttributes.title || 'PROMPT'],
        [
          'button',
          {
            type: 'button',
            class: 'copy-prompt-btn px-2 py-0.5 rounded text-[11px] bg-accent/10 hover:bg-accent/20 transition-colors',
            onclick: 'navigator.clipboard.writeText(this.closest("[data-type=\'prompt-block\']").querySelector(".prompt-content").innerText)'
          },
          'Kopyala'
        ]
      ],
      ['div', { class: 'prompt-content outline-none' }, 0],
    ];
  },
});
