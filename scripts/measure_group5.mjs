import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import JSZip from 'jszip';

const soffice = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
const workDir = path.resolve('scratch_group5');
fs.mkdirSync(workDir, { recursive: true });

// 1. Generate 5 test documents with LibreOffice
const fixtures = [
  {
    name: 'doc1_alignment',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
      <h1 style="text-align: center;">Ortalanmış Başlık 1</h1>
      <p style="text-align: right;">Bu sağa yaslı bir paragraftır.</p>
      <p style="text-align: justify;">Bu iki yana yaslı bir paragraftır. Satır boyunca düzgün hizalanması amacıyla buraya birkaç ekstra kelime yerleştirilmiştir.</p>
    </body></html>`
  },
  {
    name: 'doc2_fonts_styles',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
      <p><span style="font-family: 'Times New Roman'; font-size: 16pt;">Times New Roman 16pt metin</span></p>
      <p><span style="font-family: Arial; font-size: 10pt;">Arial 10pt metin</span></p>
      <p><span style="color: #e11d48;">Kırmızı renkli metin</span> ve <mark style="background-color: #fef08a;">Sarı vurgulu metin</mark></p>
      <p><u>Altı çizili metin</u> ve <s>Üstü çizili metin</s></p>
    </body></html>`
  },
  {
    name: 'doc3_nested_lists',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
      <ul>
        <li>Madde Seviye 1
          <ul>
            <li>Madde Seviye 2
              <ul>
                <li>Madde Seviye 3</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <ol>
        <li>Numara Seviye 1
          <ol>
            <li>Numara Seviye 2
              <ol>
                <li>Numara Seviye 3</li>
              </ol>
            </li>
          </ol>
        </li>
      </ol>
    </body></html>`
  },
  {
    name: 'doc4_run_styles',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
      <p><b>Sadece Kalın</b>, <i>Sadece İtalik</i> ve <b><i>Kalın ve İtalik Karışık</i></b></p>
      <p><em>Emphasis stili</em> ve <strong>Strong stili</strong></p>
    </body></html>`
  },
  {
    name: 'doc5_complex',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
      <p><a href="https://example.com">Örnek Web Bağlantısı</a></p>
      <p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC" alt="Kırmızı Nokta"></p>
      <table border="1">
        <tr><td colspan="2">Birleşik Sütun (2 Hücre)</td></tr>
        <tr><td>Hücre 2-1</td><td>Hücre 2-2</td></tr>
      </table>
      <div style="page-break-after: always;"></div>
      <p>Sayfa Sonu Sonrası İkinci Sayfa</p>
    </body></html>`
  }
];

console.log('--- 1. LIBREOFFICE ILE 5 BELGE URETILIYOR ---');
for (const fix of fixtures) {
  const htmlPath = path.join(workDir, `${fix.name}.html`);
  const docxPath = path.join(workDir, `${fix.name}.docx`);
  fs.writeFileSync(htmlPath, fix.html, 'utf-8');
  execFileSync(soffice, [
    '--headless',
    '--convert-to',
    'docx:Office Open XML Text',
    '--outdir',
    workDir,
    htmlPath
  ]);
  console.log(`[LO DOCX]: ${fix.name}.docx (${fs.statSync(docxPath).size} bytes)`);
}

console.log('\n--- 2. MAMMOTH VE XML ANALIZI ---');
for (const fix of fixtures) {
  const docxPath = path.join(workDir, `${fix.name}.docx`);
  const buf = fs.readFileSync(docxPath);

  // XML incele
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');

  // Mammoth doğrudan çeviri
  const res = await mammoth.convertToHtml({ buffer: buf }, { ignoreEmptyParagraphs: false });

  console.log(`\n================== ${fix.name} ==================`);
  console.log('--- Word XML Özeti ---');
  if (xml.includes('w:jc')) {
    const jcMatches = [...xml.matchAll(/<w:jc\s+w:val="([^"]+)"/g)].map((m) => m[1]);
    console.log('  w:jc bulunan değerler:', jcMatches);
  }
  if (xml.includes('w:rFonts')) {
    const fontMatches = [...xml.matchAll(/<w:rFonts\s+[^>]*w:ascii="([^"]+)"/g)].map((m) => m[1]);
    console.log('  w:rFonts bulunanlar:', [...new Set(fontMatches)]);
  }
  if (xml.includes('w:sz')) {
    const szMatches = [...xml.matchAll(/<w:sz\s+w:val="([^"]+)"/g)].map((m) => m[1]);
    console.log('  w:sz bulunanlar:', [...new Set(szMatches)]);
  }
  if (xml.includes('w:color')) {
    const colMatches = [...xml.matchAll(/<w:color\s+w:val="([^"]+)"/g)].map((m) => m[1]);
    console.log('  w:color bulunanlar:', [...new Set(colMatches)]);
  }
  if (xml.includes('w:highlight')) {
    console.log('  w:highlight bulundu');
  }
  if (xml.includes('w:u')) {
    console.log('  w:u (underline) bulundu');
  }
  if (xml.includes('w:strike')) {
    console.log('  w:strike bulundu');
  }
  if (xml.includes('w:numPr')) {
    const numMatches = [...xml.matchAll(/<w:ilvl\s+w:val="([^"]+)"/g)].map((m) => m[1]);
    console.log('  w:ilvl (liste seviyeleri):', numMatches);
  }
  if (xml.includes('w:rStyle')) {
    const rStyles = [...xml.matchAll(/<w:rStyle\s+w:val="([^"]+)"/g)].map((m) => m[1]);
    console.log('  w:rStyle bulunanlar:', rStyles);
  }
  if (xml.includes('gridSpan')) {
    console.log('  gridSpan (hücre birleştirme) bulundu');
  }

  console.log('--- Mammoth HTML Çıktısı ---');
  console.log(res.value);
  if (res.messages.length > 0) {
    console.log('  Mammoth uyarıları:', res.messages.map((m) => m.message));
  }
}
