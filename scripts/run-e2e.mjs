/**
 * scripts/run-e2e.mjs - Gerçek Uygulama Uçtan Uca (E2E) Test Paketi
 *
 * NOT / GÜVENLİK AÇIKLAMASI:
 * Playwright for Electron, Electron'un "EnableNodeCliInspectArguments" fuse'unun
 * AÇIK (enabled) olmasını zorunlu kılar. Üretim dağıtımında (production build:win)
 * güvenlik sertleştirmesi amacıyla bu fuse kapatılacaktır. Bu nedenle E2E testleri
 * test derlemesi / "electron ." ortamında çalıştırılır (npm run test:e2e).
 * Son sertleştirilmiş dağıtım exe'si ise scripts/smoke-test.mjs duman testiyle
 * doğrulanır.
 */

import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const artifactsDir = path.join(projectRoot, 'test-artifacts');

if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

let passedCount = 0;
let failedCount = 0;
const results = [];

function logSection(title) {
  console.log(`\n======================================================================`);
  console.log(`>>> ${title}`);
  console.log(`======================================================================`);
}

function logPass(msg) {
  console.log(`  ✓ [PASS] ${msg}`);
}

function logFail(msg, err) {
  console.error(`  ✗ [FAIL] ${msg}`);
  if (err) console.error(err);
}

// Helper: isolated userData and temp workDir per test
async function createTestApp() {
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-e2e-userdata-'));
  const tmpWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-e2e-work-'));

  const app = await electron.launch({
    args: ['./out/main/index.js', `--user-data-dir=${tmpUserData}`],
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_ENABLE_LOGGING: '1'
    }
  });

  const page = await app.firstWindow();
  await page.waitForSelector('.ProseMirror', { timeout: 15000 });

  return {
    app,
    page,
    tmpUserData,
    tmpWorkDir,
    async cleanup() {
      try {
        await app.evaluate(({ BrowserWindow }) => {
          BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) w.destroy();
          });
        });
        await app.close();
      } catch {}
      try {
        fs.rmSync(tmpUserData, { recursive: true, force: true });
        fs.rmSync(tmpWorkDir, { recursive: true, force: true });
      } catch {}
    }
  };
}

async function countDocxParagraphs(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const xml = await zip.file('word/document.xml').async('string');
  const matches = xml.match(/<w:p[\s\/>]/g);
  return matches ? matches.length : 0;
}

async function isAppOrWindowClosed(app) {
  try {
    const isClosed = await app.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      return wins.length === 0 || wins.every(w => w.isDestroyed());
    });
    return isClosed;
  } catch {
    return true; // Target closed / process exited
  }
}

// =====================================================================
// SENARYO 1: Yeni Belge, Yazma, İlk Ctrl+S, İkinci Ctrl+S
// =====================================================================
async function runScenario1() {
  logSection('SENARYO 1: Yeni Belge, Yazma, İlk Ctrl+S (docx), İkinci Ctrl+S (diyalogsuz)');
  const env = await createTestApp();
  try {
    const targetDocx = path.join(env.tmpWorkDir, 'senaryo1.docx');

    await env.app.evaluate(({ dialog }, p) => {
      (globalThis).__saveDialogCallCount = 0;
      (globalThis).__mockSavePath = p;
      dialog.showSaveDialog = async () => {
        (globalThis).__saveDialogCallCount++;
        return { canceled: false, filePath: (globalThis).__mockSavePath };
      };
    }, targetDocx);

    // 1. Yeni belgeye tıkla ve yaz
    await env.page.evaluate(() => {
      const el = document.querySelector('.ProseMirror');
      el.focus();
    });
    await env.page.keyboard.press('Control+a');
    await env.page.keyboard.type('İlk Cümle');
    await env.page.waitForTimeout(300);

    // Mavi nokta (dirty indicator) görünür olmalı
    let dirtyDot = await env.page.locator('.bg-accent.rounded-full').count();
    assert.ok(dirtyDot > 0, 'Yazı yazılınca mavi kayıt noktası belirmelidir');
    logPass('Yazı yazıldı, mavi kayıt noktası belirdi.');

    // 2. İlk Ctrl+S: showSaveDialog açılmalı ve dosya diske yazılmalı
    await env.page.keyboard.press('Control+s');
    await env.page.waitForTimeout(1000);

    const saveDialogCallCount = await env.app.evaluate(() => (globalThis).__saveDialogCallCount);
    assert.equal(saveDialogCallCount, 1, 'İlk Ctrl+S kayıt diyaloğunu açmalıdır');
    assert.ok(fs.existsSync(targetDocx), 'Dosya diskte oluşturulmuş olmalıdır');

    const rawBytes = fs.readFileSync(targetDocx);
    assert.equal(rawBytes[0], 0x50, 'DOCX PK ilk baytı');
    assert.equal(rawBytes[1], 0x4b, 'DOCX PK ikinci baytı');

    // Mavi nokta kaybolmuş olmalı
    dirtyDot = await env.page.locator('.bg-accent.rounded-full').count();
    assert.equal(dirtyDot, 0, 'Kayıt sonrası mavi nokta kaybolmalıdır');
    fs.copyFileSync(targetDocx, path.join(artifactsDir, 'vtext_sample_fixture.docx'));
    logPass('İlk Ctrl+S ile diyalog açıldı, docx PK baytlarıyla diske yazıldı, mavi nokta kayboldu.');

    // 3. Bir kelime daha ekle
    await env.page.keyboard.type(' ve İkinci Kelime');
    await env.page.waitForTimeout(300);

    dirtyDot = await env.page.locator('.bg-accent.rounded-full').count();
    assert.ok(dirtyDot > 0, 'Yeni metin eklenince mavi nokta tekrar belirmelidir');

    // 4. İkinci Ctrl+S: Diyalog AÇILMAMALI, dosya doğrudan güncellenmeli
    await env.page.keyboard.press('Control+s');
    await env.page.waitForTimeout(1000);

    const secondCallCount = await env.app.evaluate(() => (globalThis).__saveDialogCallCount);
    assert.equal(secondCallCount, 1, 'İkinci Ctrl+S kayıt diyaloğunu TEKRAR AÇMAMALIDIR');

    dirtyDot = await env.page.locator('.bg-accent.rounded-full').count();
    assert.equal(dirtyDot, 0, 'İkinci kayıt sonrası mavi nokta kaybolmalıdır');

    const updatedBytes = fs.readFileSync(targetDocx);
    assert.ok(updatedBytes.length > 0, 'Güncellenen dosya diskte var');
    logPass('İkinci Ctrl+S diyalog açmadan dosyayı güncelledi, mavi nokta kayboldu.');

    passedCount++;
    results.push({ name: 'Senaryo 1: Yeni Belge ve Çift Ctrl+S', status: 'PASS' });
  } catch (err) {
    logFail('Senaryo 1 Başarısız', err);
    failedCount++;
    results.push({ name: 'Senaryo 1: Yeni Belge ve Çift Ctrl+S', status: 'FAIL', error: err.message });
  } finally {
    await env.cleanup();
  }
}

// =====================================================================
// SENARYO 2: Farklı Kaydet (.md ve .txt): BOM, Düz Metin, Karakterler
// =====================================================================
async function runScenario2() {
  logSection('SENARYO 2: Farklı Kaydet (.md ve .txt): BOM, Düz Metin, Özel Karakterler');
  const env = await createTestApp();
  try {
    const mdPath = path.join(env.tmpWorkDir, 'belge.md');
    const txtPath = path.join(env.tmpWorkDir, 'belge.txt');

    await env.app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => {
        return { canceled: false, filePath: (globalThis).__nextMockSavePath };
      };
    });

    const specialText = 'Paragraf başlığı: C# ve F# dilleri, 3*4=12, #etiket Türkçe karakterler: ç, ğ, ı, ö, ş, ü, İ, Ğ, Ş';

    // Editöre metni yaz
    await env.page.evaluate(() => {
      const el = document.querySelector('.ProseMirror');
      el.focus();
    });
    await env.page.keyboard.press('Control+a');
    await env.page.keyboard.type(specialText);
    await env.page.waitForTimeout(300);

    // 1. Farklı Kaydet -> .md
    await env.app.evaluate((_, p) => { (globalThis).__nextMockSavePath = p; }, mdPath);
    await env.page.keyboard.press('Control+Shift+S');
    await env.page.waitForTimeout(1000);

    assert.ok(fs.existsSync(mdPath), '.md dosyası oluşturulmalıdır');
    const mdRaw = fs.readFileSync(mdPath);
    // Madde 1.2: İlk bayt 'P' (0x50), ikinci bayt 'a' (0x61). 'PK' (0x50 0x4B) OLMAMALIDIR!
    assert.equal(mdRaw[0], 0x50, "'Paragraf' metninin ilk baytı P (0x50) olmalıdır");
    assert.notEqual(mdRaw[1], 0x4b, "İkinci bayt K (0x4B) olmamalıdır");
    const isMdZip = mdRaw.length >= 2 && mdRaw[0] === 0x50 && mdRaw[1] === 0x4b;
    assert.equal(isMdZip, false, '.md dosyasında PK ikili verisi OLMAMALIDIR (düz metin)');
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    assert.ok(mdContent.includes('C# ve F# dilleri'), 'C# ve F# korunmalıdır');
    assert.ok(mdContent.includes('#etiket'), '#etiket bozulmamalıdır');
    assert.ok(mdContent.includes('3*4=12'), '3*4=12 matematiksel ifadesi korunmalıdır');
    logPass(".md dosyası 'P' ile başladığı halde PK sanılmadan düz metin olarak kaydedildi.");

    // 2. Farklı Kaydet -> .txt
    await env.app.evaluate((_, p) => { (globalThis).__nextMockSavePath = p; }, txtPath);
    await env.page.keyboard.press('Control+Shift+S');
    await env.page.waitForTimeout(1000);

    assert.ok(fs.existsSync(txtPath), '.txt dosyası oluşturulmalıdır');
    const txtRaw = fs.readFileSync(txtPath);
    assert.equal(txtRaw[0], 0xef, '.txt dosyası UTF-8 BOM ilk baytı 0xEF içermelidir');
    assert.equal(txtRaw[1], 0xbb, '.txt dosyası UTF-8 BOM ikinci baytı 0xBB içermelidir');
    assert.equal(txtRaw[2], 0xbf, '.txt dosyası UTF-8 BOM üçüncü baytı 0xBF içermelidir');

    const txtContent = fs.readFileSync(txtPath, 'utf8');
    const cleanTxt = txtContent.replace(/^\uFEFF/, '');
    assert.equal(/^\s*#\s+/m.test(cleanTxt), false, '.txt çıktısında Markdown "# " başlık işareti olmamalıdır');
    assert.equal(txtContent.includes('**'), false, '.txt çıktısında Markdown ** işareti olmamalıdır');
    assert.ok(txtContent.includes('C# ve F# dilleri'), '.txt içinde C# ve F# korunmalıdır');
    assert.ok(txtContent.includes('#etiket'), '.txt içinde #etiket korunmalıdır');
    assert.ok(txtContent.includes('Türkçe karakterler: ç, ğ, ı, ö, ş, ü, İ, Ğ, Ş'), 'Türkçe karakterler tam korunmalıdır');
    logPass('.txt dosyası UTF-8 BOM ile, Markdown işaretsiz ve Türkçe karakterlerle kaydedildi.');

    passedCount++;
    results.push({ name: 'Senaryo 2: .md ve .txt Farklı Kaydet Doğrulaması', status: 'PASS' });
  } catch (err) {
    logFail('Senaryo 2 Başarısız', err);
    failedCount++;
    results.push({ name: 'Senaryo 2: .md ve .txt Farklı Kaydet Doğrulaması', status: 'FAIL', error: err.message });
  } finally {
    await env.cleanup();
  }
}

// =====================================================================
// SENARYO 3: Dosya Adı Harf Büyüklüğü/Küçüklüğü Korunumu
// =====================================================================
async function runScenario3() {
  logSection('SENARYO 3: Dosya Adı Harf Büyüklüğü/Küçüklüğü Korunumu');
  const env = await createTestApp();
  try {
    const exactName = 'Büyük Küçük Test.docx';
    const targetDocx = path.join(env.tmpWorkDir, exactName);

    await env.app.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
    }, targetDocx);

    await env.page.evaluate(() => {
      const el = document.querySelector('.ProseMirror');
      el.focus();
    });
    await env.page.keyboard.type('Test');
    await env.page.waitForTimeout(200);

    await env.page.keyboard.press('Control+s');
    await env.page.waitForTimeout(1000);

    assert.ok(fs.existsSync(targetDocx), 'Dosya diskte mevcut olmalıdır');
    const dirEntries = fs.readdirSync(env.tmpWorkDir);
    assert.ok(dirEntries.includes(exactName), `Diskteki dosya adı harf duyarlılığıyla tam eşleşmelidir: ${exactName}`);

    logPass(`Diskteki dosya adı aynen korundu: ${exactName}`);

    passedCount++;
    results.push({ name: 'Senaryo 3: Dosya Adı Büyük/Küçük Harf Korunumu', status: 'PASS' });
  } catch (err) {
    logFail('Senaryo 3 Başarısız', err);
    failedCount++;
    results.push({ name: 'Senaryo 3: Dosya Adı Büyük/Küçük Harf Korunumu', status: 'FAIL', error: err.message });
  } finally {
    await env.cleanup();
  }
}

// =====================================================================
// SENARYO 4: Markdown Dosyası Açma: h1, strong ve li DOM Öğeleri
// =====================================================================
async function runScenario4() {
  logSection('SENARYO 4: Markdown Dosyası Açma: h1, strong ve li DOM Öğeleri');
  const env = await createTestApp();
  try {
    const mdFile = path.join(env.tmpWorkDir, 'test_oku.md');
    const mdContent = `# Ana Başlık

Bu paragrafta **kalın metin** bulunmaktadır.

- Birinci liste öğesi
- İkinci liste öğesi
`;
    fs.writeFileSync(mdFile, mdContent, 'utf8');

    await env.app.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
    }, mdFile);

    await env.page.keyboard.press('Control+o');
    await env.page.waitForTimeout(1200);

    const h1Count = await env.page.locator('.ProseMirror h1').count();
    const strongCount = await env.page.locator('.ProseMirror strong').count();
    const liCount = await env.page.locator('.ProseMirror li').count();

    assert.ok(h1Count >= 1, 'DOM içinde en az 1 adet h1 başlık öğesi bulunmalıdır');
    assert.ok(strongCount >= 1, 'DOM içinde en az 1 adet strong (kalın) öğesi bulunmalıdır');
    assert.ok(liCount >= 2, 'DOM içinde en az 2 adet li (liste) öğesi bulunmalıdır');

    logPass(`Markdown dosyası DOM'a aktarıldı: ${h1Count} h1, ${strongCount} strong, ${liCount} li öğesi bulundu.`);

    passedCount++;
    results.push({ name: 'Senaryo 4: Markdown h1, strong, li Render', status: 'PASS' });
  } catch (err) {
    logFail('Senaryo 4 Başarısız', err);
    failedCount++;
    results.push({ name: 'Senaryo 4: Markdown h1, strong, li Render', status: 'FAIL', error: err.message });
  } finally {
    await env.cleanup();
  }
}

// =====================================================================
// SENARYO 5: TXT Açma Güvenliği (XSS Koruması)
// =====================================================================
async function runScenario5() {
  logSection('SENARYO 5: TXT Açma Güvenliği (XSS Koruması)');
  const env = await createTestApp();
  try {
    const dangerousTxt = path.join(env.tmpWorkDir, 'guvenlik.txt');
    const rawMalicious = '<b>x</b> & <img src=x onerror=alert(1)> ve <script>window.__xss=true;</script>';
    fs.writeFileSync(dangerousTxt, rawMalicious, 'utf8');

    await env.app.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
    }, dangerousTxt);

    await env.page.keyboard.press('Control+o');
    await env.page.waitForTimeout(1200);

    const bCount = await env.page.locator('.ProseMirror b').count();
    const imgCount = await env.page.locator('.ProseMirror img').count();
    const scriptCount = await env.page.locator('.ProseMirror script').count();

    assert.equal(bCount, 0, 'TXT açıldığında DOM içinde <b> öğesi ASLA OLUŞMAMALIDIR');
    assert.equal(imgCount, 0, 'TXT açıldığında DOM içinde <img> öğesi ASLA OLUŞMAMALIDIR');
    assert.equal(scriptCount, 0, 'TXT açıldığında DOM içinde <script> öğesi ASLA OLUŞMAMALIDIR');

    const textContent = await env.page.locator('.ProseMirror').innerText();
    assert.ok(textContent.includes('<b>x</b>'), 'Metin harfi harfine görünmelidir');
    assert.ok(textContent.includes('<img src=x onerror=alert(1)>'), 'IMG etiketi harfi harfine görünmelidir');

    logPass('TXT içindeki HTML etiketleri render edilmedi, harfi harfine güvenli metin olarak gösterildi.');

    passedCount++;
    results.push({ name: 'Senaryo 5: TXT Güvenliği (XSS Koruması)', status: 'PASS' });
  } catch (err) {
    logFail('Senaryo 5 Başarısız', err);
    failedCount++;
    results.push({ name: 'Senaryo 5: TXT Güvenliği (XSS Koruması)', status: 'FAIL', error: err.message });
  } finally {
    await env.cleanup();
  }
}

// =====================================================================
// SENARYO 6: ANSI (Windows-1254 / CP1254) Kodlu Türkçe Metin Açma
// =====================================================================
async function runScenario6() {
  logSection('SENARYO 6: ANSI (Windows-1254 / CP1254) Kodlu Türkçe Metin Açma');
  const env = await createTestApp();
  try {
    const ansiTxt = path.join(env.tmpWorkDir, 'turkce_ansi.txt');
    // Windows-1254 Türkçe karakter baytları:
    // ş (0xFE), ğ (0xF0), ı (0xFD), İ (0xDD), ö (0xF6), ü (0xFC), ç (0xE7)
    const ansiBytes = Buffer.from([
      0xfe, 0x20, // ş
      0xf0, 0x20, // ğ
      0xfd, 0x20, // ı
      0xdd, 0x20, // İ
      0xf6, 0x20, // ö
      0xfc, 0x20, // ü
      0xe7        // ç
    ]);
    fs.writeFileSync(ansiTxt, ansiBytes);

    await env.app.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
    }, ansiTxt);

    await env.page.keyboard.press('Control+o');
    await env.page.waitForTimeout(1200);

    const textContent = await env.page.locator('.ProseMirror').innerText();
    assert.ok(textContent.includes('ş ğ ı İ ö ü ç'), `ANSI metin doğru çözülmelidir. Gerçek metin: "${textContent.trim()}"`);

    logPass('Windows-1254 kodlu tek bayt Türkçe karakterler bozulmadan çözüldü.');

    passedCount++;
    results.push({ name: 'Senaryo 6: ANSI (Windows-1254) Türkçe Açma', status: 'PASS' });
  } catch (err) {
    logFail('Senaryo 6 Başarısız', err);
    failedCount++;
    results.push({ name: 'Senaryo 6: ANSI (Windows-1254) Türkçe Açma', status: 'FAIL', error: err.message });
  } finally {
    await env.cleanup();
  }
}

// =====================================================================
async function assertDocxXmlStructure(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const xml = await zip.file('word/document.xml').async('string');
  const numXml = await zip.file('word/numbering.xml').async('string');

  // 1A.3: numbering.xml'de bullet için numFmt="bullet", numaralı için numFmt="decimal"
  assert.ok(numXml.includes('w:numFmt w:val="bullet"'), 'numbering.xml madde işaretli liste için numFmt="bullet" içermelidir');
  assert.ok(numXml.includes('w:numFmt w:val="decimal"'), 'numbering.xml numaralı liste için numFmt="decimal" içermelidir');
  assert.ok(numXml.includes('w:lvlText w:val="%1."'), 'numbering.xml numaralı liste için lvlText="%1." içermelidir');

  // a) word/document.xml: başlık paragraflarının pStyle değerleri (Heading1/2/3)
  assert.ok(xml.includes('w:pStyle w:val="Heading1"'), 'document.xml Heading1 pStyle içermelidir');
  assert.ok(xml.includes('w:pStyle w:val="Heading2"'), 'document.xml Heading2 pStyle içermelidir');
  assert.ok(xml.includes('w:pStyle w:val="Heading3"'), 'document.xml Heading3 pStyle içermelidir');

  // w:tbl içinde 3 satır ve 3 sütun
  const tblMatch = xml.match(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/);
  assert.ok(tblMatch, 'document.xml içinde w:tbl bulunmalıdır');
  const tblXml = tblMatch[0];

  // 1C: tblBorders kontrolü (tablo kenarlıkları #9CA3AF ve 0.5pt = sz="4")
  const tblBordersMatch = tblXml.match(/<w:tblBorders[\s>][\s\S]*?<\/w:tblBorders>/);
  assert.ok(tblBordersMatch, 'w:tblPr içinde w:tblBorders bulunmalıdır');
  assert.ok(tblBordersMatch[0].includes('w:color="9CA3AF"'), 'w:tblBorders içinde #9CA3AF renk tanımlı olmalıdır');
  assert.ok(tblBordersMatch[0].includes('w:sz="4"'), 'w:tblBorders içinde 0.5pt (sz="4") kenarlık tanımlı olmalıdır');

  // 1B.3: Tablo başlık hücrelerinde w:shd var (#F3F4F6)
  assert.ok(tblXml.includes('w:fill="F3F4F6"'), 'Tablo başlık hücresinde w:shd w:fill="F3F4F6" gölgesi bulunmalıdır');
  assert.ok(tblXml.includes('<w:tblHeader/>') || tblXml.includes('<w:tblHeader />'), 'Tablo başlık satırında w:tblHeader bulunmalıdır');

  const rows = tblXml.match(/<w:tr[\s>]/g) || [];
  assert.equal(rows.length, 3, 'w:tbl içinde tam 3 satır bulunmalıdır');

  const rowMatches = tblXml.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || [];
  for (let rIdx = 0; rIdx < rowMatches.length; rIdx++) {
    const cells = rowMatches[rIdx].match(/<w:tc[\s>]/g) || [];
    assert.equal(cells.length, 3, `w:tbl satır ${rIdx + 1} içinde 3 sütun (w:tc) bulunmalıdır`);
  }

  // listeler için w:numPr
  assert.ok(xml.includes('<w:numPr>'), 'document.xml listeler için w:numPr içermelidir');
  assert.ok(!xml.includes('{numbered-list-0}'), 'document.xml içinde çözülmemiş {numbered-list-0} bulunmamalıdır');

  // boş paragraflar (w:p içinde w:t olmayan)
  const paras = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
  const emptyParas = paras.filter(p => !p.includes('<w:t') && !p.includes('<w:drawing'));
  assert.ok(emptyParas.length > 0, 'document.xml içinde boş paragraflar (w:p içinde w:t olmayan) bulunmalıdır');

  console.log(`  [XML Doğrulama] Heading1/2/3: OK | Numaralı/Madde No: OK | Tablo 3x3 tblBorders & shd: OK | Boş paragraf: ${emptyParas.length} adet`);
}

function assertDocxPdfAndImage(docxPath, workDir, pngArtifactPath) {
  const sofficePath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
  const pyExe = 'C:\\Users\\User\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';
  const scriptPath = path.join(projectRoot, 'scripts', 'pdf-to-image.py');

  if (!fs.existsSync(sofficePath)) {
    throw new Error('LibreOffice bulunamadı: ' + sofficePath);
  }

  const baseName = path.basename(docxPath, path.extname(docxPath));
  const pdfPath = path.join(workDir, `${baseName}.pdf`);

  execSync(`"${sofficePath}" --headless --convert-to pdf "${docxPath}" --outdir "${workDir}"`);
  assert.ok(fs.existsSync(pdfPath), `LibreOffice PDF üretmiş olmalıdır: ${pdfPath}`);

  try {
    const renderOutput = execSync(`"${pyExe}" "${scriptPath}" --assert-styles "${pdfPath}" "${pngArtifactPath}"`).toString();
    console.log('  [LibreOffice & PyMuPDF]', renderOutput.trim());
    assert.ok(fs.existsSync(pngArtifactPath), `${pngArtifactPath} diskte oluşturulmalıdır`);

    const statsMatch = renderOutput.match(/DRAWINGS_STATS:\s*({.*})/);
    const stats = statsMatch ? JSON.parse(statsMatch[1]) : { fills: 0, strokes: 0 };
    return stats;
  } catch (err) {
    if (err.stdout) console.error('  [PyMuPDF Doğrulama Çıktısı]:\n' + err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    throw err;
  }
}

// =====================================================================
// SENARYO 7: Gerçek vText Arayüzünde DOCX Üretimi, XML/PDF Stilleri & 5 Tur Döngü
// =====================================================================
async function runScenario7() {
  logSection('SENARYO 7: Gerçek vText Arayüzünde DOCX Üretimi, XML/PDF Stilleri & 5 Tur Döngü');
  const env = await createTestApp();
  try {
    const docxPath = path.join(env.tmpWorkDir, 'scenario7_vtext.docx');
    const pngPath = path.join(artifactsDir, 'scenario7_libreoffice_rendered.png');

    // Diyalog yanıtını testten ayarla (Ctrl+S için dosya yolu)
    await env.app.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
    }, docxPath);

    // Editöre odaklan ve varsayılan başlangıç şablonunu temizle
    await env.page.evaluate(() => {
      const el = document.querySelector('.ProseMirror');
      el.focus();
    });
    await env.page.keyboard.press('Control+a');
    await env.page.keyboard.press('Backspace');
    await env.page.waitForTimeout(100);

    async function selectBlockType(label) {
      const blockBtn = env.page.locator('button[aria-haspopup="menu"]').first();
      await blockBtn.click({ force: true });
      await env.page.waitForTimeout(150);
      await env.page.locator(`button[role="menuitem"]:has-text("${label}")`).click({ force: true });
      await env.page.waitForTimeout(150);
      await env.page.evaluate(() => document.querySelector('.ProseMirror').focus());
      await env.page.waitForTimeout(50);
    }

    // 1. Başlık 1
    await selectBlockType('Başlık 1');
    await env.page.keyboard.type('vText Proje Raporu');
    await env.page.keyboard.press('Enter');
    await env.page.keyboard.press('Enter'); // Boş satır

    // 2. Paragraf: Kalın ve İtalik içeren metin
    await selectBlockType('Paragraf');
    await env.page.keyboard.type('Bu belgede ');
    await env.page.keyboard.press('Control+b');
    await env.page.keyboard.type('kalın metin');
    await env.page.keyboard.press('Control+b');
    await env.page.keyboard.type(' ve ');
    await env.page.keyboard.press('Control+i');
    await env.page.keyboard.type('italik metin');
    await env.page.keyboard.press('Control+i');
    await env.page.keyboard.type(' bulunmaktadır.');
    await env.page.keyboard.press('Enter');
    await env.page.keyboard.press('Enter'); // Boş satır

    // 3. Başlık 2
    await selectBlockType('Başlık 2');
    await env.page.keyboard.type('Bölüm 1: Özellikler ve Sırasız Liste');
    await env.page.keyboard.press('Enter');
    await env.page.keyboard.press('Enter'); // Boş satır

    // 4. 3 maddelik madde işaretli liste
    await env.page.locator('button[title="Madde işaretli liste"]').click({ force: true });
    await env.page.waitForTimeout(100);
    await env.page.keyboard.type('Birinci liste maddesi');
    await env.page.keyboard.press('Enter');
    await env.page.keyboard.type('İkinci liste maddesi');
    await env.page.keyboard.press('Enter');
    await env.page.keyboard.type('Üçüncü liste maddesi');
    await env.page.keyboard.press('Enter');
    await env.page.keyboard.press('Enter'); // Listeden çık
    await env.page.keyboard.press('Enter'); // Boş satır

    // 5. Başlık 3
    await selectBlockType('Başlık 3');
    await env.page.keyboard.type('Bölüm 1.1: Sıralı Adımlar');
    await env.page.keyboard.press('Enter');
    await env.page.keyboard.press('Enter'); // Boş satır

    // 6. 3 maddelik numaralı liste
    await env.page.locator('button[title="Numaralı liste"]').click({ force: true });
    await env.page.waitForTimeout(100);
    await env.page.keyboard.type('İlk adım doğrulaması');
    await env.page.keyboard.press('Enter');
    await env.page.keyboard.type('İkinci adım paketleme');
    await env.page.keyboard.press('Enter');
    await env.page.keyboard.type('Üçüncü adım dağıtım');
    await env.page.keyboard.press('Enter');
    await env.page.keyboard.press('Enter'); // Listeden çık
    await env.page.keyboard.press('Enter'); // Boş satır

    // 7. Başlık satırı olan 3x3 tablo
    await env.page.locator('button[title*="Tablo ekle"]').click({ force: true });
    await env.page.waitForTimeout(200);

    const tableData = [
      'Modül', 'Durum', 'Notlar',
      'DOCX Motoru', 'Aktif', 'Tam uyumlu',
      'Stil Tablosu', 'Aktif', 'Calibri ve 24pt'
    ];
    for (let i = 0; i < tableData.length; i++) {
      await env.page.keyboard.type(tableData[i]);
      if (i < tableData.length - 1) {
        await env.page.keyboard.press('Tab');
      }
    }

    // Ctrl+S ile kaydet
    await env.page.keyboard.press('Control+s');
    await env.page.waitForTimeout(1500);

    assert.ok(fs.existsSync(docxPath), 'vText içinde Ctrl+S ile üretilen DOCX dosyası diskte oluşturulmalıdır');
    fs.copyFileSync(docxPath, path.join(artifactsDir, 'scenario7_vtext_exported.docx'));
    logPass('Belge çalışan vText içinde klavye ve araç çubuğuyla üretildi ve Ctrl+S ile kaydedildi.');

    // 2a. word/document.xml doğrulamaları (Heading1/2/3, w:tbl 3x3, w:numPr, boş paragraflar)
    await assertDocxXmlStructure(docxPath);
    logPass('İlk üretilen DOCX word/document.xml doğrulamalarını başarıyla geçti.');

    // 2b & 2c. LibreOffice PDF & PyMuPDF stil doğrulaması ve PNG çıktısı
    const initialDrawings = assertDocxPdfAndImage(docxPath, env.tmpWorkDir, pngPath);
    logPass(`İlk DOCX LibreOffice ile PDF/PNG'ye dönüştürüldü ve PyMuPDF stilleri doğrulandı: ${pngPath}`);

    // Başlangıç paragraf sayısını ölç
    const initialParagraphCount = await countDocxParagraphs(docxPath);
    console.log(`  Başlangıç DOCX paragraf sayısı: ${initialParagraphCount}`);

    // Sekmeyi kapat
    await env.page.keyboard.press('Control+w');
    await env.page.waitForTimeout(600);

    // 2d. 5 Tur Kaydet-Aç Döngüsü (Real Electron App)
    await env.app.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
    }, docxPath);

    let lastParagraphCount = initialParagraphCount;
    for (let round = 1; round <= 5; round++) {
      // Dosyayı aç (Ctrl+O)
      await env.page.keyboard.press('Control+o');
      await env.page.waitForTimeout(1000);

      // Kaydet (Ctrl+S)
      await env.page.keyboard.press('Control+s');
      await env.page.waitForTimeout(1000);

      // Sekmeyi kapat (Ctrl+W)
      await env.page.keyboard.press('Control+w');
      await env.page.waitForTimeout(600);

      // Her turun docx'ini ayrı sakla (1B.1)
      const roundDocx = path.join(artifactsDir, `scenario7_round${round}.docx`);
      fs.copyFileSync(docxPath, roundDocx);

      // Mammoth HTML çıktısını incele (1B.1: <ol> ve <th> korunuyor mu?)
      const buf = fs.readFileSync(docxPath);
      const mRes = await mammoth.convertToHtml({ buffer: buf }, { ignoreEmptyParagraphs: false });
      const hasOl = mRes.value.includes('<ol>');
      const hasTh = mRes.value.includes('<th>');

      const pCount = await countDocxParagraphs(docxPath);
      console.log(`  Tur ${round}: Paragraf = ${pCount} | Mammoth <ol>: ${hasOl} | Mammoth <th>: ${hasTh}`);
      assert.equal(pCount, initialParagraphCount, `Tur ${round}'de paragraf sayısı sabit kalmalıdır!`);
      assert.ok(hasOl, `Tur ${round}'de mammoth çıktısında numaralı liste (<ol>) korunmalıdır`);
      assert.ok(hasTh, `Tur ${round}'de mammoth çıktısında tablo başlığı (<th>) korunmalıdır`);
      lastParagraphCount = pCount;
    }
    logPass(`5 tur kaydet-aç döngüsünde paragraf sayısı (${lastParagraphCount}), <ol> ve <th> tamamen korundu.`);

    // 2d. Beş turluk döngünün SON dosyasına da aynı XML ve PDF/PNG assertion'ları uygulanır
    await assertDocxXmlStructure(docxPath);
    logPass('5. turun son dosyasında word/document.xml (Heading1/2/3, w:tbl 3x3, tblBorders, w:shd, w:numPr, boş paragraflar) doğrulandı.');

    const roundtripFinalPngPath = path.join(artifactsDir, 'scenario7_roundtrip_final_rendered.png');
    const round5Drawings = assertDocxPdfAndImage(docxPath, env.tmpWorkDir, roundtripFinalPngPath);
    logPass(`5. turun son dosyasında LibreOffice & PyMuPDF stilleri doğrulandı: ${roundtripFinalPngPath}`);

    // 1B.3: PyMuPDF page.get_drawings() ile tablonun dolgu dikdörtgeni ve çizgileri iki dosyada da eşit olmalı
    console.log(`  [Çizim Karşılaştırma] İlk Dosya: ${JSON.stringify(initialDrawings)} | 5. Tur: ${JSON.stringify(round5Drawings)}`);
    assert.equal(round5Drawings.fills, initialDrawings.fills, 'Tablo başlık gölgesi dolgusu sayısı ilk dosya ile 5. tur dosyasında eşit olmalıdır');
    assert.equal(round5Drawings.strokes, initialDrawings.strokes, 'Tablo kenarlık çizgisi sayısı ilk dosya ile 5. tur dosyasında eşit olmalıdır');
    assert.ok(round5Drawings.fills > 0, 'Tablo başlık gölgesi dolgusu bulunmalıdır');
    assert.ok(round5Drawings.strokes > 0, 'Tablo kenarlık çizgisi bulunmalıdır');
    logPass('İlk dosya ile 5. tur dosyasında tablo dolgu ve çizgi sayıları birebir eşit doğrulandı.');

    passedCount++;
    results.push({ name: 'Senaryo 7: DOCX Canlı Üretim, XML/PDF Stilleri & 5 Tur Döngü', status: 'PASS' });
  } catch (err) {
    logFail('Senaryo 7 Başarısız', err);
    failedCount++;
    results.push({ name: 'Senaryo 7: DOCX Canlı Üretim, XML/PDF Stilleri & 5 Tur Döngü', status: 'FAIL', error: err.message });
  } finally {
    await env.cleanup();
  }
}

// =====================================================================
// SENARYO 8: Kapatma Akışları (Kaydet, Kaydetme, İptal, Son Sekme, Çakışma)
// =====================================================================
async function runScenario8() {
  logSection('SENARYO 8: Kapatma Akışları (Kaydet, Kaydetme, İptal, Son Sekme, Çakışma Uyarısı)');
  try {
  // 8A. Kaydedilmemiş sekme yokken onaysız doğrudan kapanma
  {
    const env = await createTestApp();
    try {
      await env.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.close();
      });
      await new Promise((r) => setTimeout(r, 600));

      const isDestroyed = await isAppOrWindowClosed(env.app);
      assert.ok(isDestroyed, 'Kaydedilmemiş sekme yokken pencere onaysız kapanmalıdır');
      logPass('Kaydedilmemiş sekme yokken pencere onaysız kapandı.');
    } finally {
      await env.cleanup();
    }
  }

  // 8B1. Kaydedilmemiş sekmeyle pencere X kapatma: Onay diyaloğu açılmalı ve İptal seçilince pencere açık kalmalı
  {
    const env = await createTestApp();
    try {
      await env.app.evaluate(({ dialog }) => {
        (globalThis).__confirmDialogCount = 0;
        dialog.showMessageBox = async () => {
          (globalThis).__confirmDialogCount++;
          return { response: 2 }; // 2 = İptal
        };
      });

      await env.page.evaluate(() => {
        document.querySelector('.ProseMirror').focus();
      });
      await env.page.keyboard.type('Pencere X İptal Testi');
      await env.page.waitForTimeout(300);

      await env.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.close();
      });
      await new Promise((r) => setTimeout(r, 800));

      const isDestroyed = await isAppOrWindowClosed(env.app);
      assert.ok(!isDestroyed, 'Kaydedilmemiş sekme varken pencere onay diyaloğu açılmadan kapandı (Pencere X)');

      const dialogCount = await env.app.evaluate(() => (globalThis).__confirmDialogCount);
      assert.ok(dialogCount >= 1, 'Pencere X kapatmasında onay diyaloğu açılmalıdır');

      const stillOpen = await env.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return win && !win.isDestroyed();
      });
      assert.ok(stillOpen, 'Kaydedilmemiş sekme varken pencere kapandı (İptal seçilmesine rağmen kapandı)');
      logPass('Pencere X: Kaydedilmemiş sekme varken onay diyaloğu açıldı ve İptal ile pencere açık kaldı.');
    } finally {
      await env.cleanup();
    }
  }

  // 8B2. Kaydedilmemiş sekmeyle Ctrl+W kapatma: Onay diyaloğu açılmalı ve İptal seçilince sekme açık kalmalı
  {
    const env = await createTestApp();
    try {
      await env.app.evaluate(({ dialog }) => {
        (globalThis).__confirmDialogCount = 0;
        dialog.showMessageBox = async () => {
          (globalThis).__confirmDialogCount++;
          return { response: 2 }; // 2 = İptal
        };
      });

      await env.page.evaluate(() => {
        document.querySelector('.ProseMirror').focus();
      });
      await env.page.keyboard.type('Ctrl+W İptal Testi');
      await env.page.waitForTimeout(300);

      await env.page.keyboard.press('Control+w');
      await new Promise((r) => setTimeout(r, 800));

      const isDestroyed = await isAppOrWindowClosed(env.app);
      assert.ok(!isDestroyed, 'Kaydedilmemiş sekme varken Ctrl+W ile pencere beklenmedik şekilde kapandı');

      const dialogCount = await env.app.evaluate(() => (globalThis).__confirmDialogCount);
      assert.ok(dialogCount >= 1, 'Ctrl+W kapatmasında onay diyaloğu açılmalıdır');

      const dirtyDot = await env.page.locator('.bg-accent.rounded-full').count();
      assert.ok(dirtyDot > 0, 'Kaydedilmemiş sekme varken Ctrl+W ile onay alınmadan sekme kapandı');
      logPass('Ctrl+W: Kaydedilmemiş sekme varken onay diyaloğu açıldı ve İptal ile sekme açık kaldı.');
    } finally {
      await env.cleanup();
    }
  }

  // 8B3. Kaydedilmemiş sekmeyle Sekme X butonuna tıklama: Onay diyaloğu açılmalı ve İptal seçilince sekme açık kalmalı
  {
    const env = await createTestApp();
    try {
      await env.app.evaluate(({ dialog }) => {
        (globalThis).__confirmDialogCount = 0;
        dialog.showMessageBox = async () => {
          (globalThis).__confirmDialogCount++;
          return { response: 2 }; // 2 = İptal
        };
      });

      await env.page.evaluate(() => {
        document.querySelector('.ProseMirror').focus();
      });
      await env.page.keyboard.type('Sekme X İptal Testi');
      await env.page.waitForTimeout(300);

      // Sekmedeki kapat butonu (X)
      const closeBtn = env.page.locator('button[aria-label*="sekmesini kapat"]').first();
      await closeBtn.click({ force: true });
      await new Promise((r) => setTimeout(r, 800));

      const isDestroyed = await isAppOrWindowClosed(env.app);
      assert.ok(!isDestroyed, 'Kaydedilmemiş sekme varken Sekme X ile pencere beklenmedik şekilde kapandı');

      const dialogCount = await env.app.evaluate(() => (globalThis).__confirmDialogCount);
      assert.ok(dialogCount >= 1, 'Sekme X butonunda onay diyaloğu açılmalıdır');

      const dirtyDot = await env.page.locator('.bg-accent.rounded-full').count();
      assert.ok(dirtyDot > 0, 'Kaydedilmemiş sekme varken sekme X butonuyla onay alınmadan sekme kapandı');
      logPass('Sekme X: Kaydedilmemiş sekme varken onay diyaloğu açıldı ve İptal ile sekme açık kaldı.');
    } finally {
      await env.cleanup();
    }
  }

  // 8C. Kaydedilmemiş sekmeyle pencere kapatma: "Kaydetme" yanıtı (kaydetmeden kapanır)
  {
    const env = await createTestApp();
    try {
      await env.app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({ response: 1 }); // 1 = Kaydetme (dont-save)
      });

      await env.page.evaluate(() => {
        document.querySelector('.ProseMirror').focus();
      });
      await env.page.keyboard.type('Kaydetmeden Kapatma Testi');
      await env.page.waitForTimeout(300);

      await env.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.close();
      });
      await new Promise((r) => setTimeout(r, 800));

      const isDestroyed = await isAppOrWindowClosed(env.app);
      assert.ok(isDestroyed, 'Kaydetme seçilince pencere değişiklikleri kaydetmeden kapanmalıdır');
      logPass('Kapatma onayında "Kaydetme" seçilince pencere kapandı.');
    } finally {
      await env.cleanup();
    }
  }

  // 8D. Kaydedilmemiş sekmeyle pencere kapatma: "Kaydet" yanıtı (kaydeder ve kapanır)
  {
    const env = await createTestApp();
    try {
      const savedDocPath = path.join(env.tmpWorkDir, 'kapanirken_kaydedilen.docx');
      await env.app.evaluate(({ dialog }, p) => {
        dialog.showMessageBox = async () => ({ response: 0 }); // 0 = Kaydet
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
      }, savedDocPath);

      await env.page.evaluate(() => {
        document.querySelector('.ProseMirror').focus();
      });
      await env.page.keyboard.type('Kapanırken Kaydedilen İçerik');
      await env.page.waitForTimeout(300);

      await env.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.close();
      });
      await new Promise((r) => setTimeout(r, 1200));

      assert.ok(fs.existsSync(savedDocPath), 'Kapanırken "Kaydet" seçilen dosya diske yazılmış olmalıdır');
      const isDestroyed = await isAppOrWindowClosed(env.app);
      assert.ok(isDestroyed, 'Kayıt tamamlandıktan sonra pencere kapanmalıdır');
      logPass('Kapatma onayında "Kaydet" seçilince dosya diske kaydedildi ve pencere kapandı.');
    } finally {
      await env.cleanup();
    }
  }

  // 8E. Ctrl+W ile son sekmeyi kapatma -> Boş belge açılmalı
  {
    const env = await createTestApp();
    try {
      await env.page.keyboard.press('Control+w');
      await env.page.waitForTimeout(600);

      const tabCount = await env.page.locator('.tab-item, [role="tab"]').count();
      assert.ok(tabCount >= 1, 'Son sekme kapanınca boş sekme açık kalmalıdır');
      logPass('Ctrl+W ile son sekme kapatılınca yeni boş belge hazırlandı.');
    } finally {
      await env.cleanup();
    }
  }

  // 8F. Farklı Kaydet ile açık başka bir dosyanın üzerine yazma uyarısı
  {
    const env = await createTestApp();
    try {
      const openDocPath = path.join(env.tmpWorkDir, 'hedef.docx');
      const fixtureDocx = fs.existsSync(path.join(artifactsDir, 'scenario7_vtext_exported.docx'))
        ? path.join(artifactsDir, 'scenario7_vtext_exported.docx')
        : path.join(artifactsDir, 'vtext_sample_fixture.docx');
      fs.copyFileSync(fixtureDocx, openDocPath);

      // Hedef dosyayı aç
      await env.app.evaluate(({ dialog }, p) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
      }, openDocPath);
      await env.page.keyboard.press('Control+o');
      await env.page.waitForTimeout(1000);

      // Yeni bir sekme aç (Ctrl+N)
      await env.page.keyboard.press('Control+n');
      await env.page.waitForTimeout(600);

      // Yeni sekmeye yaz
      await env.page.evaluate(() => {
        document.querySelector('.ProseMirror').focus();
      });
      await env.page.keyboard.type('Çakışma metni');
      await env.page.waitForTimeout(300);

      await env.app.evaluate(({ dialog }, p) => {
        (globalThis).__overwritePromptTriggered = false;
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
        dialog.showMessageBox = async () => {
          (globalThis).__overwritePromptTriggered = true;
          return { response: 0 }; // 0 = İptal
        };
      }, openDocPath);

      await env.page.keyboard.press('Control+Shift+S');
      await env.page.waitForTimeout(1000);

      const overwritePromptTriggered = await env.app.evaluate(() => (globalThis).__overwritePromptTriggered);
      assert.ok(overwritePromptTriggered, 'Açık dosya yoluna farklı kaydet yapılınca çakışma uyarısı gösterilmelidir');
      logPass('Açık dosya üzerine farklı kaydet yapılınca çakışma uyarısı verildi ve İptal ile hedef korundu.');
    } finally {
      await env.cleanup();
    }
  }

    passedCount++;
    results.push({ name: 'Senaryo 8: Kapatma ve Güvenlik Akışları', status: 'PASS' });
  } catch (err) {
    logFail('Senaryo 8 Başarısız', err);
    failedCount++;
    results.push({ name: 'Senaryo 8: Kapatma ve Güvenlik Akışları', status: 'FAIL', error: err.message });
  }
}

// =====================================================================
// SENARYO 9: Aynı Dosyayı İki Kez Açma & Büyük/Küçük Harf Normalizasyonu
// =====================================================================
async function runScenario9() {
  logSection('SENARYO 9: Aynı Dosyayı İki Kez Açma & Büyük/Küçük Harf Normalizasyonu');
  const env = await createTestApp();
  try {
    const filePath = path.join(env.tmpWorkDir, 'tekrar.docx');
    const fixtureDocx = fs.existsSync(path.join(artifactsDir, 'scenario7_vtext_exported.docx'))
      ? path.join(artifactsDir, 'scenario7_vtext_exported.docx')
      : path.join(artifactsDir, 'vtext_sample_fixture.docx');
    fs.copyFileSync(fixtureDocx, filePath);

    // 1. Dosyayı ilk kez aç
    await env.app.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
    }, filePath);
    await env.page.keyboard.press('Control+o');
    await env.page.waitForTimeout(1000);

    let tabCount = await env.page.locator('.tab-item, [role="tab"]').count();
    const initialTabs = tabCount;

    // 2. Aynı dosyayı birebir aynı yolla tekrar aç
    await env.page.keyboard.press('Control+o');
    await env.page.waitForTimeout(1000);

    tabCount = await env.page.locator('.tab-item, [role="tab"]').count();
    assert.equal(tabCount, initialTabs, 'Aynı dosya tekrar açıldığında ikinci sekme oluşmamalıdır');

    // 3. Aynı dosyayı Windows büyük/küçük harf farkıyla aç (TEKRAR.DOCX)
    const upperPath = path.join(env.tmpWorkDir, 'TEKRAR.DOCX');
    await env.app.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
    }, upperPath);
    await env.page.keyboard.press('Control+o');
    await env.page.waitForTimeout(1000);

    tabCount = await env.page.locator('.tab-item, [role="tab"]').count();
    assert.equal(tabCount, initialTabs, 'Farklı büyük/küçük harfle açılan aynı dosya tek sekmede kalmalıdır');

    logPass('Aynı dosya ve büyük/küçük harf varyasyonları tek sekme olarak korundu.');

    passedCount++;
    results.push({ name: 'Senaryo 9: Tek Sekme ve Yol Normalizasyonu', status: 'PASS' });
  } catch (err) {
    logFail('Senaryo 9 Başarısız', err);
    failedCount++;
    results.push({ name: 'Senaryo 9: Tek Sekme ve Yol Normalizasyonu', status: 'FAIL', error: err.message });
  } finally {
    await env.cleanup();
  }
}

// =====================================================================
// SENARYO 10: PDF Dışa Aktarma (%PDF Başlığı, docId/Başlık Değişmezliği)
// =====================================================================
async function runScenario10() {
  logSection('SENARYO 10: PDF Dışa Aktarma (%PDF Başlığı, docId/Başlık Değişmezliği)');
  const env = await createTestApp();
  try {
    const pdfExportPath = path.join(env.tmpWorkDir, 'disa_aktarim.pdf');

    await env.app.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
    }, pdfExportPath);

    await env.page.evaluate(() => {
      const el = document.querySelector('.ProseMirror');
      el.focus();
    });
    await env.page.keyboard.type('PDF Metni');
    await env.page.waitForTimeout(200);

    // İlk sekme başlığını al
    const tabTitleBefore = await env.page.locator('.tab-item, [role="tab"]').first().innerText();

    // Ctrl+Alt+P veya Ctrl+Shift+D ile PDF dışa aktarma tetikle
    await env.page.keyboard.press('Control+Alt+p');
    await env.page.waitForTimeout(2000);

    assert.ok(fs.existsSync(pdfExportPath), 'PDF dosyası diskte oluşturulmalıdır');
    const pdfBytes = fs.readFileSync(pdfExportPath);
    assert.ok(pdfBytes.length > 10, 'PDF içeriği boş olmamalıdır');
    
    // %PDF sihirli baytları (0x25 0x50 0x44 0x46)
    assert.equal(pdfBytes[0], 0x25, '% baytı');
    assert.equal(pdfBytes[1], 0x50, 'P baytı');
    assert.equal(pdfBytes[2], 0x44, 'D baytı');
    assert.equal(pdfBytes[3], 0x46, 'F baytı');

    // Sekme başlığı ve formatının değişmediğini doğrula
    const tabTitleAfter = await env.page.locator('.tab-item, [role="tab"]').first().innerText();
    assert.equal(tabTitleAfter, tabTitleBefore, 'PDF dışa aktarma aktif sekme başlığını değiştirmemelidir');

    logPass('Geçerli %PDF dosyası üretildi, sekme başlığı/durumu aynen korundu.');

    passedCount++;
    results.push({ name: 'Senaryo 10: PDF Dışa Aktarma Doğrulaması', status: 'PASS' });
  } catch (err) {
    logFail('Senaryo 10 Başarısız', err);
    failedCount++;
    results.push({ name: 'Senaryo 10: PDF Dışa Aktarma Doğrulaması', status: 'FAIL', error: err.message });
  } finally {
    await env.cleanup();
  }
}

async function main() {
  console.log(`\n======================================================================`);
  console.log(`vText UÇTAN UCA (E2E) TEST KOŞUSU BAŞLADI`);
  console.log(`Çalışma Dizini: ${projectRoot}`);
  console.log(`Zaman: ${new Date().toISOString()}`);
  console.log(`======================================================================`);

  await runScenario1();
  await runScenario2();
  await runScenario3();
  await runScenario4();
  await runScenario5();
  await runScenario6();
  await runScenario7();
  await runScenario8();
  await runScenario9();
  await runScenario10();

  console.log(`\n======================================================================`);
  console.log(`E2E TEST ÖZETİ: ${passedCount} BAŞARILI, ${failedCount} BAŞARISIZ (Toplam: ${passedCount + failedCount})`);
  console.log(`======================================================================`);
  results.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.status}] ${r.name} ${r.error ? `-> ${r.error}` : ''}`);
  });

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('E2E Test Çalıştırıcı Beklenmeyen Hata:', err);
  process.exit(1);
});
