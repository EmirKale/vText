import { BrowserWindow } from 'electron';
import fs from 'fs';

export async function exportToPdf(htmlContent: string, outputPath: string): Promise<boolean> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  });

  const fullHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 15px;
      line-height: 1.7;
      color: #1F2937;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
    }
    h1, h2, h3, h4 {
      color: #111827;
      font-weight: 700;
      line-height: 1.3;
      page-break-after: avoid;
    }
    h1 { font-size: 26px; margin-top: 0; margin-bottom: 16px; }
    h2 { font-size: 20px; margin-top: 24px; margin-bottom: 12px; }
    h3 { font-size: 17px; margin-top: 20px; margin-bottom: 8px; }
    p { margin-top: 0; margin-bottom: 14px; }
    blockquote {
      border-left: 4px solid #6366F1;
      padding-left: 16px;
      margin-left: 0;
      color: #4B5563;
      font-style: italic;
    }
    pre, code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 13px;
    }
    pre {
      background-color: #F3F4F6;
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      padding: 12px;
      overflow-x: hidden;
      white-space: pre-wrap;
      page-break-inside: avoid;
    }
    .prompt-block {
      border-left: 4px solid #6366F1;
      background: #EEF2FF;
      border-radius: 6px;
      padding: 12px 16px;
      margin: 16px 0;
      page-break-inside: avoid;
    }
    .prompt-label {
      font-size: 11px;
      font-weight: 700;
      color: #4F46E5;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #E5E7EB;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #F9FAFB;
      font-weight: 600;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

    const pdfBuffer = await printWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        marginType: 'custom',
        top: 0.8,
        bottom: 0.8,
        left: 0.8,
        right: 0.8
      }
    });

    await fs.promises.writeFile(outputPath, pdfBuffer);
    return true;
  } catch (err) {
    return false;
  } finally {
    printWindow.destroy();
  }
}
