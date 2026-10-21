import mammoth from 'mammoth';
import fs from 'fs';

const buf = fs.readFileSync('scratch_group5/doc1_alignment.docx');

// Let's test styleMap with headings and alignments
const styleMap = [
  "p[style-name='heading 1'] => h1:fresh",
  "p[style-name='heading 1 center'] => h1.text-center:fresh",
  "p[style-name='heading 2 center'] => h2.text-center:fresh",
  "p[style-name='heading 3 center'] => h3.text-center:fresh",
  "p[style-name='heading 1 right'] => h1.text-right:fresh",
  "p[style-name='heading 2 right'] => h2.text-right:fresh",
  "p[style-name='heading 3 right'] => h3.text-right:fresh",
  "p[style-name='align-center'] => p.text-center:fresh",
  "p[style-name='align-right'] => p.text-right:fresh",
  "p[style-name='align-justify'] => p.text-justify:fresh",
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
      const origStyle = (el.styleName || el.styleId || '').toLowerCase();
      let alignSuffix = '';
      if (el.alignment === 'center') alignSuffix = 'center';
      else if (el.alignment === 'right' || el.alignment === 'end') alignSuffix = 'right';
      else if (el.alignment === 'both' || el.alignment === 'justify') alignSuffix = 'justify';

      if (alignSuffix) {
        if (origStyle.startsWith('heading')) {
          el.styleName = `${origStyle} ${alignSuffix}`;
        } else {
          el.styleName = `align-${alignSuffix}`;
        }
      }
    }
    if (el.children) el.children.forEach(walk);
  }
  walk(doc);
  return doc;
}

const res = await mammoth.convertToHtml({ buffer: buf }, { styleMap, transformDocument: transform });
console.log('Result HTML with heading preservation:');
console.log(res.value);
