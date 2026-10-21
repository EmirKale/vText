import { BrowserWindow, app } from 'electron';
import fs from 'fs';
import path from 'path';

await app.whenReady();

const html = fs.readFileSync('test-artifacts/a4_comparison/lo_600words.html', 'utf-8');
const pMatches = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map(m => m[1]);

const fullHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: A4;
      margin: 25.4mm;
    }
    body {
      font-family: 'Calibri', 'Carlito', 'Segoe UI', sans-serif;
      font-size: 12pt;
      line-height: 1.4;
      color: #1F2937;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
    }
    p { margin-top: 0; margin-bottom: 6pt; }
  </style>
</head>
<body>
  ${pMatches.map(p => `<p>${p}</p>`).join('\n')}
</body>
</html>`;

const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

const pdfBuf = await win.webContents.printToPDF({
  pageSize: 'A4',
  printBackground: true,
  margins: {
    marginType: 'custom',
    top: 1.0,
    bottom: 1.0,
    left: 1.0,
    right: 1.0
  }
});

const outPath = path.resolve('test-artifacts/a4_comparison/vtext_test_unified.pdf');
fs.writeFileSync(outPath, pdfBuf);
console.log('Wrote unified PDF:', outPath);
app.quit();
