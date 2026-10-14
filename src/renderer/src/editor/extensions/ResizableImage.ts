import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

export const ResizableImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (element) =>
          element.getAttribute('data-width') || element.style.width || element.getAttribute('width') || '100%',
        renderHTML: (attributes) => ({
          'data-width': attributes.width || '100%'
        })
      },
      alignment: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => ({
          'data-align': attributes.alignment || 'center'
        })
      }
    };
  },

  renderHTML({ HTMLAttributes }) {
    const { alignment = 'center', width = '100%', style: customStyle = '', ...attrs } = HTMLAttributes;

    let marginStyle = 'margin-left: auto; margin-right: auto; display: block;';
    if (alignment === 'left') {
      marginStyle = 'margin-left: 0; margin-right: auto; display: block;';
    } else if (alignment === 'right') {
      marginStyle = 'margin-left: auto; margin-right: 0; display: block;';
    }

    const computedStyle = `width: ${width}; max-width: 100%; height: auto; border-radius: 8px; ${marginStyle} ${customStyle}`.trim();

    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, attrs, {
        style: computedStyle,
        'data-width': width,
        'data-align': alignment
      })
    ];
  }
});
