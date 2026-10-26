import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { exportTipTapJsonToDocx } from '../src/renderer/src/io/docxExport.ts';

// Simulated HTML to TipTap JSON (for simple paragraph)
function simpleHtmlToTipTap(html) {
  // extract text from <p>...</p>
  const match = html.match(/<p>([\s\S]*?)<\/p>/i);
  const text = match ? match[1].replace(/<[^>]+>/g, '').trim() : 'Test';
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }]
      }
    ]
  };
}

async function testFixture(name) {
  const p = path.resolve('tests/fixtures', name);
  const buf = fs.readFileSync(p);
  const zipSrc = await JSZip.loadAsync(buf);
  const docXmlSrc = await zipSrc.file('word/document.xml').async('string');
  const pgSzSrc = docXmlSrc.match(/<w:pgSz\b[^>]*\/?>/)?.[0] || 'none';
  const pgMarSrc = docXmlSrc.match(/<w:pgMar\b[^>]*\/?>/)?.[0] || 'none';

  // vText current import via mammoth
  const mammothRes = await mammoth.convertToHtml({ buffer: buf });
  const tipTapJson = simpleHtmlToTipTap(mammothRes.value);

  // vText current export
  const exportedBuf = await exportTipTapJsonToDocx(tipTapJson, 'Test');
  const zipOut = await JSZip.loadAsync(exportedBuf);
  const docXmlOut = await zipOut.file('word/document.xml').async('string');
  const pgSzOut = docXmlOut.match(/<w:pgSz\b[^>]*\/?>/)?.[0] || 'none';
  const pgMarOut = docXmlOut.match(/<w:pgMar\b[^>]*\/?>/)?.[0] || 'none';

  console.log(`==================== ${name} ====================`);
  console.log(`KAYNAK w:pgSz:  ${pgSzSrc}`);
  console.log(`KAYDEDİLEN:     ${pgSzOut}`);
  console.log(`KAYNAK w:pgMar: ${pgMarSrc}`);
  console.log(`KAYDEDİLEN:     ${pgMarOut}`);
}

async function main() {
  await testFixture('fixture-i4-landscape-a4.docx');
  await testFixture('fixture-i4-letter.docx');
  await testFixture('fixture-i4-narrow-margins.docx');
}

main().catch(console.error);
