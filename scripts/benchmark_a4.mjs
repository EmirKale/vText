import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const html = fs.readFileSync('test-artifacts/a4_comparison/lo_600words.html', 'utf-8');
const pMatches = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map(m => m[1]);

const children = pMatches.map(text => new Paragraph({
  children: [new TextRun({ text, font: 'Calibri', size: 24, color: '1C2523' })],
  spacing: { after: 120, line: 276 }
}));

const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
      }
    },
    children
  }]
});

const buf = await Packer.toBuffer(doc);
const outDocx = path.resolve('test-artifacts/a4_comparison/vtext_generated_521.docx');
fs.writeFileSync(outDocx, buf);
console.log('Saved docx:', outDocx);

const soffice = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
execSync(`"${soffice}" --headless --convert-to pdf --outdir "test-artifacts/a4_comparison" "${outDocx}"`);
console.log('Converted to PDF via LibreOffice');
