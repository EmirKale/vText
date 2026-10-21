import mammoth from 'mammoth';
import fs from 'fs';

const buf = fs.readFileSync('scratch_group5/doc1_alignment.docx');
const styleMap = [
  "p[style-name='AlignRight'] => p.text-right:fresh",
  "p[style-name='AlignCenter'] => p.text-center:fresh",
  "p[style-name='AlignJustify'] => p.text-justify:fresh",
  "r[style-name='Emphasis'] => em",
  "r[style-id='Emphasis'] => em",
  "r[style-name='Strong'] => strong",
  "r[style-id='Strong'] => strong",
  "u => u"
];

function transform(doc) {
  function walk(el) {
    if (!el) return;
    if (el.type === 'paragraph' && el.alignment) {
      if (el.alignment === 'both' || el.alignment === 'justify') {
        el.styleName = 'AlignJustify';
      } else if (el.alignment === 'right' || el.alignment === 'end') {
        el.styleName = 'AlignRight';
      } else if (el.alignment === 'center') {
        el.styleName = 'AlignCenter';
      }
    }
    if (el.children) {
      el.children.forEach(walk);
    }
  }
  walk(doc);
  return doc;
}

const res = await mammoth.convertToHtml({ buffer: buf }, { styleMap, transformDocument: transform });
console.log('Result HTML:');
console.log(res.value);

