import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import JSZip from 'jszip';

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: vi.fn()
  },
  BrowserWindow: {
    getFocusedWindow: () => undefined,
    getAllWindows: () => []
  },
  protocol: {},
  net: {}
}));

import { openFileByPath, extractPageSetupFromDocx } from '../src/main/files';
import { detectUnsupportedDocxFeatures } from '../src/main/docxFeatureDetector';
import { exportTipTapJsonToDocx } from '../src/renderer/src/io/docxExport';
import { PageSetup } from '../src/shared/types';

function parseSectPrXml(xml: string) {
  const sectPr = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] || '';
  const pgSzMatch = sectPr.match(/<w:pgSz\b([^>]*)\/?>/i);
  const pgMarMatch = sectPr.match(/<w:pgMar\b([^>]*)\/?>/i);

  const szAttrs = pgSzMatch ? pgSzMatch[1] : '';
  const marAttrs = pgMarMatch ? pgMarMatch[1] : '';

  const w = szAttrs.match(/w:w=["'](\d+)["']/i)?.[1];
  const h = szAttrs.match(/w:h=["'](\d+)["']/i)?.[1];
  const orient = szAttrs.match(/w:orient=["']([^"']+)["']/i)?.[1] || 'portrait';

  const top = marAttrs.match(/w:top=["'](\d+)["']/i)?.[1];
  const right = marAttrs.match(/w:right=["'](\d+)["']/i)?.[1];
  const bottom = marAttrs.match(/w:bottom=["'](\d+)["']/i)?.[1];
  const left = marAttrs.match(/w:left=["'](\d+)["']/i)?.[1];
  const header = marAttrs.match(/w:header=["'](\d+)["']/i)?.[1];
  const footer = marAttrs.match(/w:footer=["'](\d+)["']/i)?.[1];
  const gutter = marAttrs.match(/w:gutter=["'](\d+)["']/i)?.[1];

  return {
    w: Number(w),
    h: Number(h),
    orient,
    top: Number(top),
    right: Number(right),
    bottom: Number(bottom),
    left: Number(left),
    header: header !== undefined ? Number(header) : undefined,
    footer: footer !== undefined ? Number(footer) : undefined,
    gutter: gutter !== undefined ? Number(gutter) : undefined,
    rawPgSz: pgSzMatch?.[0],
    rawPgMar: pgMarMatch?.[0]
  };
}

describe('I4: Sayfa Yapısı Korunumu & w:sectPr Testleri', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');

  it('a & b & e. Üç fixture için round-trip sonrası w:pgSz ve w:pgMar değerleri kaynakla birebir aynıdır (dxa)', async () => {
    const testCases = [
      {
        file: 'fixture-i4-landscape-a4.docx',
        expectedOrient: 'landscape',
        expectedW: 16838,
        expectedH: 11906,
        expectedMargin: 1440
      },
      {
        file: 'fixture-i4-letter.docx',
        expectedOrient: 'portrait',
        expectedW: 12240,
        expectedH: 15840,
        expectedMargin: 1440
      },
      {
        file: 'fixture-i4-narrow-margins.docx',
        expectedOrient: 'portrait',
        expectedW: 11906,
        expectedH: 16838,
        expectedMargin: 720
      }
    ];

    for (const tc of testCases) {
      const srcPath = path.join(fixturesDir, tc.file);
      const srcBuf = fs.readFileSync(srcPath);
      const srcZip = await JSZip.loadAsync(srcBuf);
      const srcXml = await srcZip.file('word/document.xml')!.async('string');
      const srcParsed = parseSectPrXml(srcXml);

      // 1. openFileByPath ile aç
      const openRes = await openFileByPath(srcPath);
      expect(openRes.success).toBe(true);
      expect(openRes.pageSetup).toBeDefined();

      const ps: PageSetup = openRes.pageSetup!;
      expect(ps.orientation).toBe(tc.expectedOrient);
      expect(ps.widthDxa).toBe(tc.expectedW);
      expect(ps.heightDxa).toBe(tc.expectedH);
      expect(ps.margins.top).toBe(tc.expectedMargin);
      expect(ps.margins.left).toBe(tc.expectedMargin);

      // 2. exportTipTapJsonToDocx ile tekrar kaydet
      const dummyTipTap = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Test içeriği' }]
          }
        ]
      };
      const exportedBuf = await exportTipTapJsonToDocx(dummyTipTap, 'Test', { pageSetup: ps });
      const outZip = await JSZip.loadAsync(exportedBuf);
      const outXml = await outZip.file('word/document.xml')!.async('string');
      const outParsed = parseSectPrXml(outXml);

      // Ham XML çıktılarını doğrula
      console.log(`[TEST RESULT] ${tc.file}`);
      console.log(`  Kaynak:    ${srcParsed.rawPgSz} | ${srcParsed.rawPgMar}`);
      console.log(`  Kaydedilen: ${outParsed.rawPgSz} | ${outParsed.rawPgMar}`);

      // Birebir dxa eşitlikleri
      expect(outParsed.w).toBe(srcParsed.w);
      expect(outParsed.h).toBe(srcParsed.h);
      expect(outParsed.orient).toBe(srcParsed.orient);
      expect(outParsed.top).toBe(srcParsed.top);
      expect(outParsed.right).toBe(srcParsed.right);
      expect(outParsed.bottom).toBe(srcParsed.bottom);
      expect(outParsed.left).toBe(srcParsed.left);
      if (srcParsed.header !== undefined) expect(outParsed.header).toBe(srcParsed.header);
      if (srcParsed.footer !== undefined) expect(outParsed.footer).toBe(srcParsed.footer);
      if (srcParsed.gutter !== undefined) expect(outParsed.gutter).toBe(srcParsed.gutter);
    }
  });

  it('K2 Ek Senaryo 1: w:orient yok ama w:w > w:h olan sectPr yatay olarak algılanmalı ve korunmalıdır', async () => {
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Oryantasyonsuz ama geniş sayfa</w:t></w:r></w:p>
          <w:sectPr>
            <w:pgSz w:w="16838" w:h="11906"/>
            <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
          </w:sectPr>
        </w:body>
      </w:document>`
    );

    const ps = await extractPageSetupFromDocx(zip);
    expect(ps).toBeDefined();
    expect(ps!.orientation).toBe('landscape');
    expect(ps!.widthDxa).toBe(16838);
    expect(ps!.heightDxa).toBe(11906);

    const dummyTipTap = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test' }] }]
    };
    const exportedBuf = await exportTipTapJsonToDocx(dummyTipTap, 'Test', { pageSetup: ps });
    const outZip = await JSZip.loadAsync(exportedBuf);
    const outXml = await outZip.file('word/document.xml')!.async('string');
    const outParsed = parseSectPrXml(outXml);

    expect(outParsed.w).toBe(16838);
    expect(outParsed.h).toBe(11906);
    expect(outParsed.orient).toBe('landscape');
  });

  it('K2 Ek Senaryo 2: Letter + yatay (15840 x 12240 dxa) round-trip sonrası kaynakla eşit olmalıdır', async () => {
    // Letter: 8.5 x 11 inç = 12240 x 15840 dxa. Yatay Letter: w:w=15840, w:h=12240, w:orient="landscape"
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Yatay Letter Belgesi</w:t></w:r></w:p>
          <w:sectPr>
            <w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>
            <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
          </w:sectPr>
        </w:body>
      </w:document>`
    );

    const ps = await extractPageSetupFromDocx(zip);
    expect(ps).toBeDefined();
    expect(ps!.orientation).toBe('landscape');
    expect(ps!.widthDxa).toBe(15840);
    expect(ps!.heightDxa).toBe(12240);

    const dummyTipTap = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test' }] }]
    };
    const exportedBuf = await exportTipTapJsonToDocx(dummyTipTap, 'Test Letter Landscape', { pageSetup: ps });
    const outZip = await JSZip.loadAsync(exportedBuf);
    const outXml = await outZip.file('word/document.xml')!.async('string');
    const outParsed = parseSectPrXml(outXml);

    expect(outParsed.w).toBe(15840);
    expect(outParsed.h).toBe(12240);
    expect(outParsed.orient).toBe('landscape');
    expect(outParsed.top).toBe(1440);
    expect(outParsed.bottom).toBe(1440);
  });

  it('b. Yeni belge A4 dikey (11906 x 16838 dxa) ve 25,4 mm (1440 dxa) ile devam eder', async () => {
    const dummyTipTap = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Yeni Belge' }] }]
    };
    // pageSetup verilmediğinde (yeni belge)
    const exportedBuf = await exportTipTapJsonToDocx(dummyTipTap, 'Yeni Belge');
    const zip = await JSZip.loadAsync(exportedBuf);
    const xml = await zip.file('word/document.xml')!.async('string');
    const parsed = parseSectPrXml(xml);

    expect(parsed.w).toBe(11906);
    expect(parsed.h).toBe(16838);
    expect(parsed.orient).toBe('portrait');
    expect(parsed.top).toBe(1440);
    expect(parsed.bottom).toBe(1440);
    expect(parsed.left).toBe(1440);
    expect(parsed.right).toBe(1440);
  });

  it('c. w:sectPr sayısı > 1 ise docxFeatureDetector uyarı verir', async () => {
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:pPr></w:p>
          <w:p><w:r><w:t>İkinci bölüm</w:t></w:r></w:p>
          <w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>
        </w:body>
      </w:document>`
    );

    const res = await detectUnsupportedDocxFeatures(zip);
    expect(res.hasUnsupported).toBe(true);
    expect(res.features).toContain('birden fazla bölüm');
    expect(res.warningMessage).toContain('Bu belge birden fazla bölüm içeriyor; kaydedilirken tek bölüme indirilecek.');
  });

  it('c. Sayfa boyutu A4 veya Letter dışındaysa (örn. B5) docxFeatureDetector uyarı verir', async () => {
    const zip = new JSZip();
    // B5 boyutu: 10000 x 14000 dxa
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>B5 belgesi</w:t></w:r></w:p>
          <w:sectPr><w:pgSz w:w="10000" w:h="14000"/></w:sectPr>
        </w:body>
      </w:document>`
    );

    const res = await detectUnsupportedDocxFeatures(zip);
    expect(res.hasUnsupported).toBe(true);
    expect(res.features).toContain('özel sayfa boyutu');
    expect(res.warningMessage).toContain('Sayfa boyutu korunuyor ama editördeki görünüm A4 olarak gösterilir.');
  });

  it('e. LibreOffice PDF çıktısında yatay belgenin sayfası yataydır (PyMuPDF genişlik > yükseklik)', () => {
    const sofficePath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
    if (!fs.existsSync(sofficePath)) {
      console.warn('LibreOffice bulunamadı, PDF dönüşüm adımı atlandı');
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-pdf-check-'));
    try {
      const srcDocx = path.join(fixturesDir, 'fixture-i4-landscape-a4.docx');
      execSync(`"${sofficePath}" --headless --convert-to pdf --outdir "${tmpDir}" "${srcDocx}"`);
      const pdfPath = path.join(tmpDir, 'fixture-i4-landscape-a4.pdf');
      expect(fs.existsSync(pdfPath)).toBe(true);

      // Python PyMuPDF ile ölç
      const pyCmd = `py -c "import fitz; doc=fitz.open(r'${pdfPath}'); page=doc[0]; rect=page.rect; print('PDF_DIMS: %s x %s' % (rect.width, rect.height)); assert rect.width > rect.height, 'Yatay olmalıydı!' "`;
      const out = execSync(pyCmd, { encoding: 'utf8' });
      console.log('[PYMUPDF CHECK]', out.trim());
      expect(out).toContain('PDF_DIMS');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
