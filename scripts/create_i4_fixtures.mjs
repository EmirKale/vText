import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import JSZip from 'jszip';

const SOFFICE = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

function createFodt(widthCm, heightCm, orientation, topCm, bottomCm, leftCm, rightCm, text) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">
  <office:automatic-styles>
    <style:page-layout style:name="pm1">
      <style:page-layout-properties fo:page-width="${widthCm}cm" fo:page-height="${heightCm}cm"${orientation ? ` style:print-orientation="${orientation}"` : ''}
        fo:margin-top="${topCm}cm" fo:margin-bottom="${bottomCm}cm" fo:margin-left="${leftCm}cm" fo:margin-right="${rightCm}cm"/>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Standard" style:page-layout-name="pm1"/>
  </office:master-styles>
  <office:body>
    <office:text>
      <text:p>${text}</text:p>
    </office:text>
  </office:body>
</office:document>`;
}

async function main() {
  const fixturesDir = path.resolve('tests/fixtures');
  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });

  const tempDir = path.resolve('scratch_i4');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // 1. Yatay A4 (29.7cm x 21cm, landscape, 2.54cm margins)
  const f1 = path.join(tempDir, 'fixture-i4-landscape-a4.fodt');
  fs.writeFileSync(f1, createFodt('29.7', '21.0', 'landscape', '2.54', '2.54', '2.54', '2.54', 'Yatay A4 Test Belgesi'));

  // 2. Letter (21.59cm x 27.94cm, 2.54cm margins)
  const f2 = path.join(tempDir, 'fixture-i4-letter.fodt');
  fs.writeFileSync(f2, createFodt('21.59', '27.94', '', '2.54', '2.54', '2.54', '2.54', 'Letter Test Belgesi'));

  // 3. Dar Kenar Boşluklu A4 (21.0cm x 29.7cm, 1.27cm = 0.5 inç margins)
  const f3 = path.join(tempDir, 'fixture-i4-narrow-margins.fodt');
  fs.writeFileSync(f3, createFodt('21.0', '29.7', '', '1.27', '1.27', '1.27', '1.27', 'Dar Kenar Boşluklu Test Belgesi'));

  // Convert all 3 with soffice
  for (const f of [f1, f2, f3]) {
    execSync(`"${SOFFICE}" --headless --convert-to docx --outdir "${fixturesDir}" "${f}"`);
  }

  // Inspect generated docx files
  for (const name of ['fixture-i4-landscape-a4.docx', 'fixture-i4-letter.docx', 'fixture-i4-narrow-margins.docx']) {
    const docxPath = path.join(fixturesDir, name);
    const buf = fs.readFileSync(docxPath);
    const zip = await JSZip.loadAsync(buf);
    const docXml = await zip.file('word/document.xml').async('string');
    const sectPr = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] || 'no sectPr';
    console.log(`=== ${name} ===\n${sectPr}\n`);
  }

  // Clean up scratch dir
  fs.rmSync(tempDir, { recursive: true, force: true });
}

main().catch(console.error);
