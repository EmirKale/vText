import { _electron as electron } from 'playwright';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve('.');
const outDir = path.resolve('test-artifacts', 'a4_comparison');
fs.mkdirSync(outDir, { recursive: true });

const sofficePath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
const pyExe = 'C:\\Users\\User\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';

// ~600 kelimelik metin (5 paragraf, toplam ~600 kelime)
const paragraphs = [
  "Kelime işlemciler ve masaüstü yayıncılık sistemleri arasındaki en kritik köprü, metnin ekrandaki görünümü ile fiziki kağıt çıktısı arasındaki geometrik uyumdur. Dijital ortamda hazırlanan bir belgenin, A4 standardındaki sayfa sınırları içinde nasıl konumlandığı, satır sonlarının nerede kırıldığı ve paragraflar arası düşey boşlukların nasıl hesaplandığı tipografik sadakatin temel göstergelerinden biridir. Gelişmiş belge motorları, gliflerin genişliklerini, harf aralıklarını ve satır yüksekliği katsayılarını piksel ya da nokta düzeyinde işleyerek yazıcılara veya PDF oluşturucularına iletir. Bu süreçte karşılaşılan en büyük zorluklardan biri, farklı motorların yazı tipi rasterleştirme ve metin dizgileme algoritmalarındaki ince ayrımlardır. Bir motorun tercih ettiği satır sonu kırma mantığı, diğer bir motorda bir kelimenin bir sonraki satıra sarkmasına neden olabilir. Bu sarkma, sayfa sonuna gelindiğinde tüm paragraf bloklarının kaymasına ve sayfa sayısının beklenmedik şekilde değişmesine yol açabilir.",

  "Calibri yazı tipi, modern ofis belgelerinde yaygın olarak kullanılan hümanist bir sans-serif yazı tipidir. Açık ve yuvarlak hatları, ekran okunabilirliğini artırırken baskı süreçlerinde de dengeli bir mürekkep dağılımı sağlar. 12 punto gövde metni boyutu, standart bir A4 sayfasında yaklaşık olarak 65 ila 75 karakterlik ideal satır genişliğine tekabül eder. Bu genişlik, insan gözünün satır takibini yorulmadan sürdürebilmesi açısından ergonomik bir standart olarak kabul edilmiştir. Paragraf aralarındaki 6 puntoluk boşluk ise, paragrafları birbirinden net biçimde ayırırken sayfanın bütünsel dikey ritmini korumaya yardımcı olur. Metin akışı sırasında satır aralığı katsayısının 1.15 olarak belirlenmesi, harf satırlarının birbirine temas etmesini önler ve beyaz alan dengesini kurar. Ancak bu katsayıların uygulanışında, CSS tabanlı web tarayıcı motorları ile masaüstü ofis paketleri arasında hesaplama farkları görülebilmektedir.",

  "Chromium motoru, web standartlarına uygun olarak tasarlanmış olup metinleri CSS kutu modeline göre konumlandırır. Yazı tipi metrikleri doğrudan font dosyasından okunurken, satır kutusunun yüksekliği fontun ascent, descent ve line-gap değerlerinin toplamı üzerinden CSS çarpanıyla belirlenir. Baskı emülasyonunda Chromium, sayfayı A4 boyutunda (210 milimetreye 297 milimetre) piksellere dönüştürür ve 20 milimetrelik sayfa kenar boşluklarını düşerek kalan kullanılabilir alana metni yerleştirir. Bu yerleştirme sırasında tarayıcının harf aralığı sıkıştırma veya esnetme algoritmaları, metnin iki yana yaslı olmadığı durumlarda dahi mikroskobik düzeyde farklılıklar üretebilir. Bu durum, tamamen aynı metin ve aynı yazı tipi kullanılsa bile satır sonlarındaki kelime dizilimini etkileyebilecek niteliktedir.",

  "LibreOffice ve benzeri geleneksel ofis yazılımları ise kendi özel mizanpaj motorlarını kullanır. OpenDocument ve OpenXML standartlarını temel alan bu motorlar, karakter genişliklerini doğrudan işletim sisteminin yazı tipi alt sisteminden (örneğin Windows GDI veya DirectWrite) talep eder. Paragraf özellikleri, satır yüksekliği ve kenar boşlukları milimetre veya punto cinsinden mutlak koordinatlarla sayfaya çizilir. Sayfa sonu kırma algoritmaları, yetim ve dul satır koruma kuralları ile desteklenerek metnin sayfa sınırlarında estetik bir şekilde bölünmesini sağlar. PDF dışa aktarımında LibreOffice, vektörel glif yollarını ve metin bloklarını doğrudan PDF operatörleri olarak kodlar. Bu yaklaşım, dokümanın orijinal ofis görünümüyle azami örtüşmesini garanti altına alır.",

  "Sonuç olarak, web tabanlı bir kelime işlemci olan vText'in ürettiği PDF ile LibreOffice'in ürettiği PDF karşılaştırıldığında, temel tipografik unsurların ne ölçüde örtüştüğü matematiksel verilerle sınanmalıdır. Her iki motorun A4 sayfa ebadı, 20 milimetre kenar boşlukları ve Calibri 12 punto ayarları altında kaç sayfa ürettiği, sayfa başına kaç satır düştüğü ve toplam satır sayısındaki sapmalar açıkça ortaya konmalıdır. İddiaların soyut söylemler yerine somut ölçüm sonuçlarına dayanması, yazılım mühendisliğinin temel ilkelerinden biridir. Bu deney, iki farklı render mimarisinin sınırlarını ve örtüşme derecesini tarafsız bir şekilde belgelemektedir."
];

const fullText = paragraphs.join('\n\n');
const wordCount = fullText.split(/\s+/).filter(Boolean).length;
console.log(`[Metin Üretildi]: Toplam ${wordCount} kelime, ${paragraphs.length} paragraf.`);

// 1. vText'te DOCX ve PDF üretimi (Playwright Electron ile vText içinde aynı metni yazıp kaydet)
const loDocxPath = path.join(outDir, 'lo_600words.docx');
const loPdfPath = path.join(outDir, 'lo_600words.pdf');
const vtextPdfPath = path.join(outDir, 'vtext_600words.pdf');

console.log('[vText Başlatılıyor]: Electron çalıştırılıyor...');
const app = await electron.launch({
  args: ['.'],
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    VTEXT_E2E: '1'
  }
});

const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1000);

// Metni editöre yerleştir
await page.evaluate((paras) => {
  const el = document.querySelector('.ProseMirror');
  if (el) {
    el.innerHTML = paras.map((p) => `<p>${p}</p>`).join('');
  }
}, paragraphs);
await page.waitForTimeout(500);

// 1. DOCX Kaydet (Ctrl+s)
await app.evaluate(({ dialog }, p) => {
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
}, loDocxPath);

console.log('[vText DOCX Kaydediliyor]: Control+s...');
await page.keyboard.press('Control+s');
await page.waitForTimeout(3000);
console.log(`[vText DOCX]: ${loDocxPath} (${fs.statSync(loDocxPath).size} bayt)`);

// 2. PDF Dışa Aktar (Control+Alt+p)
await app.evaluate(({ dialog }, p) => {
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
}, vtextPdfPath);

console.log('[vText PDF Dışa Aktarılıyor]: Control+Alt+p...');
await page.keyboard.press('Control+Alt+p');
await page.waitForTimeout(3000);
console.log(`[vText PDF]: ${vtextPdfPath} (${fs.statSync(vtextPdfPath).size} bayt)`);

await app.close();

// 3. LibreOffice ile vText DOCX -> PDF
execFileSync(sofficePath, [
  '--headless',
  '--convert-to',
  'pdf:writer_pdf_Export',
  '--outdir',
  outDir,
  loDocxPath
]);
console.log(`[LibreOffice (vText'in DOCX'inden) PDF]: ${loPdfPath} (${fs.statSync(loPdfPath).size} bayt)`);

// 3. Python PyMuPDF ile Karşılaştırma
const pyScript = `
import fitz, json, sys

lo_doc = fitz.open(r"${loPdfPath.replace(/\\/g, '\\\\')}")
vt_doc = fitz.open(r"${vtextPdfPath.replace(/\\/g, '\\\\')}")

def analyze_doc(doc, name):
    pages_data = []
    total_lines = 0
    total_words = 0
    for p_idx, page in enumerate(doc):
        blocks = page.get_text("blocks")
        lines_on_page = []
        for b in blocks:
            # b: (x0, y0, x1, y1, text, block_no, block_type)
            if b[6] == 0: # text block
                b_lines = [l.strip() for l in b[4].split('\\n') if l.strip()]
                lines_on_page.extend(b_lines)
        total_lines += len(lines_on_page)
        p_words = sum(len(l.split()) for l in lines_on_page)
        total_words += p_words
        pages_data.append({
            "page_num": p_idx + 1,
            "line_count": len(lines_on_page),
            "word_count": p_words,
            "first_line": lines_on_page[0] if lines_on_page else "",
            "last_line": lines_on_page[-1] if lines_on_page else ""
        })
    return {
        "name": name,
        "page_count": len(doc),
        "total_lines": total_lines,
        "total_words": total_words,
        "pages": pages_data
    }

lo_res = analyze_doc(lo_doc, "LibreOffice PDF")
vt_res = analyze_doc(vt_doc, "vText (Chromium) PDF")

print("--- KARŞILAŞTIRMA SONUÇLARI ---")
print(json.dumps({"libreoffice": lo_res, "vtext": vt_res}, indent=2, ensure_ascii=False))
`;

const pyScriptPath = path.join(outDir, 'analyze_layout.py');
fs.writeFileSync(pyScriptPath, pyScript, 'utf-8');

const analysisOut = execFileSync(pyExe, [pyScriptPath], { encoding: 'utf-8' });
console.log(analysisOut);
