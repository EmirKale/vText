import mammoth from 'mammoth';
import fs from 'fs';

const MAMMOTH_STYLE_MAP = [
  "p[style-name='heading 1 center'] => h1.text-center:fresh",
  "p[style-name='heading 2 center'] => h2.text-center:fresh",
  "p[style-name='heading 3 center'] => h3.text-center:fresh",
  "p[style-name='heading 1 right'] => h1.text-right:fresh",
  "p[style-name='heading 2 right'] => h2.text-right:fresh",
  "p[style-name='heading 3 right'] => h3.text-right:fresh",
  "p[style-name='heading 1 justify'] => h1.text-justify:fresh",
  "p[style-name='heading 2 justify'] => h2.text-justify:fresh",
  "p[style-name='heading 3 justify'] => h3.text-justify:fresh",
  "p[style-name='align-center'] => p.text-center:fresh",
  "p[style-name='align-right'] => p.text-right:fresh",
  "p[style-name='align-justify'] => p.text-justify:fresh",
  "r[style-name='Emphasis'] => em",
  "r[style-id='Emphasis'] => em",
  "r[style-name='Strong'] => strong",
  "r[style-id='Strong'] => strong",
  "u => u"
];

function preserveDocxStructureAndAlignment(docElement) {
  if (!docElement) return docElement;
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
          el.styleName = origStyle + ' ' + alignSuffix;
        } else {
          el.styleName = 'align-' + alignSuffix;
        }
      }
    }
    if (Array.isArray(el.children)) {
      el.children.forEach(walk);
    }
  }
  walk(docElement);
  return docElement;
}

const buf1 = fs.readFileSync('scratch_group5/doc1_alignment.docx');
const res1 = await mammoth.convertToHtml({ buffer: buf1 }, {
  styleMap: MAMMOTH_STYLE_MAP,
  transformDocument: preserveDocxStructureAndAlignment,
  ignoreEmptyParagraphs: false
});
console.log('--- Enhanced doc1_alignment HTML ---');
console.log(res1.value);

const buf4 = fs.readFileSync('scratch_group5/doc4_run_styles.docx');
const res4 = await mammoth.convertToHtml({ buffer: buf4 }, {
  styleMap: MAMMOTH_STYLE_MAP,
  transformDocument: preserveDocxStructureAndAlignment,
  ignoreEmptyParagraphs: false
});
console.log('--- Enhanced doc4_run_styles HTML ---');
console.log(res4.value);
