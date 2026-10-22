import { _electron as electron } from 'playwright';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Document, Paragraph, TextRun, Packer } from 'docx';

const projectRoot = path.resolve('.');
const artifactsDir = path.resolve('test-artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const sofficePath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
const pyExe = 'C:\\Users\\User\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';

// 521 kelimelik metin (5 paragraf)
const paragraphs = [
  "Kelime işlemciler ve masaüstü yayıncılık sistemleri arasındaki en kritik köprü, metnin ekrandaki görünümü ile fiziki kağıt çıktısı arasındaki geometrik uyumdur. Dijital ortamda hazırlanan bir belgenin, A4 standardındaki sayfa sınırları içinde nasıl konumlandığı, satır sonlarının nerede kırıldığı ve paragraflar arası düşey boşlukların nasıl hesaplandığı tipografik sadakatin temel göstergelerinden biridir. Gelişmiş belge motorları, gliflerin genişliklerini, harf aralıklarını ve satır yüksekliği katsayılarını piksel ya da nokta düzeyinde işleyerek yazıcılara veya PDF oluşturucularına iletir. Bu süreçte karşılaşılan en büyük zorluklardan biri, farklı motorların yazı tipi rasterleştirme ve metin dizgileme algoritmalarındaki ince ayrımlardır. Bir motorun tercih ettiği satır sonu kırma mantığı, diğer bir motorda bir kelimenin bir sonraki satıra sarkmasına neden olabilir. Bu sarkma, sayfa sonuna gelindiğinde tüm paragraf bloklarının kaymasına ve sayfa sayısının beklenmedik şekilde değişmesine yol açabilir.",

  "Calibri yazı tipi, modern ofis belgelerinde yaygın olarak kullanılan hümanist bir sans-serif yazı tipidir. Açık ve yuvarlak hatları, ekran okunabilirliğini artırırken baskı süreçlerinde de dengeli bir mürekkep dağılımı sağlar. 12 punto gövde metni boyutu, standart bir A4 sayfasında yaklaşık olarak 65 ila 75 karakterlik ideal satır genişliğine tekabül eder. Bu genişlik, insan gözünün satır takibini yorulmadan sürdürebilmesi açısından ergonomik bir standart olarak kabul edilmiştir. Paragraf aralarındaki 6 puntoluk boşluk ise, paragrafları birbirinden net biçimde ayırırken sayfanın bütünsel dikey ritmini korumaya yardımcı olur. Metin akışı sırasında satır aralığı katsayısının 1.15 olarak belirlenmesi, harf satırlarının birbirine temas etmesini önler ve beyaz alan dengesini kurar. Ancak bu katsayıların uygulanışında, CSS tabanlı web tarayıcı motorları ile masaüstü ofis paketleri arasında hesaplama farkları görülebilmektedir.",

  "Chromium motoru, web standartlarına uygun olarak tasarlanmış olup metinleri CSS kutu modeline göre konumlandırır. Yazı tipi metrikleri doğrudan font dosyasından okunurken, satır kutusunun yüksekliği fontun ascent, descent ve line-gap değerlerinin toplamı üzerinden CSS çarpanıyla belirlenir. Baskı emülasyonunda Chromium, sayfayı A4 boyutunda (210 milimetreye 297 milimetre) piksellere dönüştürür ve 20 milimetrelik sayfa kenar boşluklarını düşerek kalan kullanılabilir alana metni yerleştirir. Bu yerleştirme sırasında tarayıcının harf aralığı sıkıştırma veya esnetme algoritmaları, metnin iki yana yaslı olmadığı durumlarda dahi mikroskobik düzeyde farklılıklar üretebilir. Bu durum, tamamen aynı metin ve aynı yazı tipi kullanılsa bile satır sonlarındaki kelime dizilimini etkileyebilecek niteliktedir.",

  "LibreOffice ve benzeri geleneksel ofis yazılımları ise kendi özel mizanpaj motorlarını kullanır. OpenDocument ve OpenXML standartlarını temel alan bu motorlar, karakter genişliklerini doğrudan işletim sisteminin yazı tipi alt sisteminden (örneğin Windows GDI veya DirectWrite) talep eder. Paragraf özellikleri, satır yüksekliği ve kenar boşlukları milimetre veya punto cinsinden mutlak koordinatlarla sayfaya çizilir. Sayfa sonu kırma algoritmaları, yetim ve dul satır koruma kuralları ile desteklenerek metnin sayfa sınırlarında estetik bir şekilde bölünmesini sağlar. PDF dışa aktarımında LibreOffice, vektörel glif yollarını ve metin bloklarını doğrudan PDF operatörleri olarak kodlar. Bu yaklaşım, dokümanın orijinal ofis görünümüyle azami örtüşmesini garanti altına alır.",

  "Sonuç olarak, web tabanlı bir kelime işlemci olan vText'in ürettiği PDF ile LibreOffice'in ürettiği PDF karşılaştırıldığında, temel tipografik unsurların ne ölçüde örtüştüğü matematiksel verilerle sınanmalıdır. Her iki motorun A4 sayfa ebadı, 20 milimetre kenar boşlukları ve Calibri 12 punto ayarları altında kaç sayfa ürettiği, sayfa başına kaç satır düştüğü ve toplam satır sayısındaki sapmalar açıkça ortaya konmalıdır. İddiaların soyut söylemler yerine somut ölçüm sonuçlarına dayanması, yazılım mühendisliğinin temel ilkelerinden biridir. Bu deney, iki farklı render mimarisinin sınırlarını ve örtüşme derecesini tarafsız bir şekilde belgelemektedir."
];

const fullText = paragraphs.join('\n\n');
const wordCount = fullText.split(/\s+/).filter(Boolean).length;
console.log(`[H4 Ölçümü]: Metin kelime sayısı = ${wordCount}`);

async function run() {
  const tmpDir = path.join(artifactsDir, 'h4_temp');
  fs.mkdirSync(tmpDir, { recursive: true });

  // 1. LibreOffice DOCX ve PDF üretimi (1.15 ve 1.4)
  for (const lh of [1.15, 1.4]) {
    const lineDxa = Math.round(240 * lh); // 1.15 -> 276, 1.4 -> 336
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4
              margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } // 25.4mm
            }
          },
          children: paragraphs.map(p => new Paragraph({
            children: [new TextRun({ text: p, font: 'Calibri', size: 24 })],
            spacing: { line: lineDxa, after: 120 } // 6pt after
          }))
        }
      ]
    });

    const docxBuf = await Packer.toBuffer(doc);
    const docxPath = path.join(tmpDir, `lo_${lh}.docx`);
    fs.writeFileSync(docxPath, docxBuf);

    execFileSync(sofficePath, [
      '--headless',
      '--convert-to',
      'pdf:writer_pdf_Export',
      '--outdir',
      tmpDir,
      docxPath
    ]);
  }

  // 2. Electron uygulamasını başlat ve hem ekran görüntülerini al hem de vText PDF'lerini üret
  const app = await electron.launch({
    args: ['./out/main/index.js'],
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: 'test' }
  });

  const page = await app.firstWindow();
  await page.waitForSelector('.ProseMirror', { timeout: 15000 });

  // Açık tema sağla
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('vtext-theme', 'light');
  });
  await page.waitForTimeout(300);

  // Metni editöre yükle
  await page.evaluate((paras) => {
    const pm = document.querySelector('.ProseMirror');
    if (pm) {
      pm.innerHTML = paras.map(p => `<p>${p}</p>`).join('');
    }
  }, paragraphs);
  await page.waitForTimeout(500);

  // Ekran görüntüleri ve vText PDF üretimi
  for (const lh of [1.15, 1.4]) {
    // Editör satır aralığını ayarla
    await page.evaluate((val) => {
      const pm = document.querySelector('.ProseMirror');
      if (pm) {
        pm.style.lineHeight = String(val);
        const pTags = pm.querySelectorAll('p');
        pTags.forEach(p => { p.style.lineHeight = String(val); });
      }
    }, lh);
    await page.waitForTimeout(500);

    // Ekran görüntüsü kaydet (test-artifacts/editor-lh-1.15.png ve editor-lh-1.4.png)
    const ssPath = path.join(artifactsDir, `editor-lh-${lh}.png`);
    await page.screenshot({ path: ssPath });
    console.log(`[Ekran Görüntüsü Kaydedildi]: ${ssPath}`);

    // vText PDF üretimi
    // Editörün HTML'ini alıp Chromium printToPDF ile dışa aktar
    const pdfPath = path.join(tmpDir, `vtext_${lh}.pdf`);
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
      line-height: ${lh};
      color: #1F2937;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
    }
    p { margin-top: 0; margin-bottom: 6pt; }
  </style>
</head>
<body>
  ${paragraphs.map(p => `<p>${p}</p>`).join('\n')}
</body>
</html>`;

    // vText PDF üretimi via app.evaluate returning base64
    const b64 = await app.evaluate(async ({ BrowserWindow }, { html }) => {
      const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const buf = await win.webContents.printToPDF({
        pageSize: 'A4',
        margins: {
          marginType: 'custom',
          top: 1.0,
          bottom: 1.0,
          left: 1.0,
          right: 1.0
        },
        printBackground: true
      });
      win.destroy();
      return buf.toString('base64');
    }, { html: fullHtml });
    fs.writeFileSync(pdfPath, Buffer.from(b64, 'base64'));
    console.log(`[vText PDF Üretildi]: ${pdfPath}`);
  }

  await app.close();

  // 3. PyMuPDF ile tüm PDF'lerin sayfa sayısı ve satır sayısını ölç
  const pyCode = `
import fitz, json, sys, glob

results = {}
for path in glob.glob(r"${tmpDir.replace(/\\/g, '\\\\')}\\\\*.pdf"):
    name = path.split("\\\\")[-1]
    doc = fitz.open(path)
    page_count = len(doc)
    total_lines = 0
    pages_lines = []
    for p in doc:
        blocks = p.get_text("blocks")
        lines_on_p = 0
        for b in blocks:
            if b[6] == 0:
                lines = [l for l in b[4].split("\\n") if l.strip()]
                lines_on_p += len(lines)
        pages_lines.append(lines_on_p)
        total_lines += lines_on_p
    results[name] = {
        "page_count": page_count,
        "total_lines": total_lines,
        "pages_lines": pages_lines
    }

print(json.dumps(results, indent=2))
`;
  const pyOut = execFileSync(pyExe, ['-c', pyCode], { encoding: 'utf-8' });
  console.log('=== PYMUPDF ÖLÇÜM SONUÇLARI ===');
  console.log(pyOut);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
