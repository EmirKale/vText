import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const exePath = path.join(rootDir, 'dist', 'win-unpacked', 'vText.exe');

console.log(`[Smoke Test] Paketlenmiş uygulama duman testi başlatılıyor...`);
console.log(`[Smoke Test] Hedef exe: ${exePath}`);

if (!fs.existsSync(exePath)) {
  console.error(`[Smoke Test] HATA: Exe dosyası bulunamadı: ${exePath}`);
  process.exit(1);
}

// app.asar paketinde markdown-it bağımlılığının asar içinde yer aldığını doğrula
const asarPath = path.join(path.dirname(exePath), 'resources', 'app.asar');
if (fs.existsSync(asarPath)) {
  const asarBuf = fs.readFileSync(asarPath);
  const hasMarkdownItInAsar = asarBuf.includes(Buffer.from('"markdown-it":{"files":{"LICENSE"'));
  if (!hasMarkdownItInAsar) {
    console.error(`[Smoke Test] HATA: markdown-it paketi app.asar içinde bulunamadı (build.files ile dışlanmış)!`);
    process.exit(1);
  }
  console.log(`[Smoke Test] app.asar içinde markdown-it paketi başarıyla doğrulandı.`);
}

// 1. İzole temiz userData klasörü, geçici işaret dosyası, docx, md ve txt oluştur
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-smoke-user-'));
const markerFile = path.join(os.tmpdir(), `vtext-smoke-out-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
const tmpDocx = path.join(os.tmpdir(), `vtext-smoke-in-${Date.now()}-${Math.random().toString(36).slice(2)}.docx`);
const tmpMd = path.join(os.tmpdir(), `vtext-smoke-in-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
const tmpTxt = path.join(os.tmpdir(), `vtext-smoke-in-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);

// Küçük geçerli bir DOCX oluştur (1 başlık + 2 maddelik liste)
const testDoc = new Document({
  sections: [
    {
      children: [
        new Paragraph({
          text: 'Duman Testi Başlığı',
          heading: HeadingLevel.HEADING_1
        }),
        new Paragraph({
          text: 'Birinci liste maddesi',
          bullet: { level: 0 }
        }),
        new Paragraph({
          text: 'İkinci liste maddesi',
          bullet: { level: 0 }
        })
      ]
    }
  ]
});

const docxBuffer = await Packer.toBuffer(testDoc);
fs.writeFileSync(tmpDocx, docxBuffer);
console.log(`[Smoke Test] Test DOCX dosyası oluşturuldu: ${tmpDocx} (${docxBuffer.length} bayt)`);

// Markdown dosyası oluştur (markdown-it asar yükleme doğrulaması)
const mdContent = `# Markdown Duman Başlığı\n\nBirinci markdown paragrafı.\n\nİkinci markdown paragrafı.\n`;
fs.writeFileSync(tmpMd, mdContent, 'utf-8');
console.log(`[Smoke Test] Test MD dosyası oluşturuldu: ${tmpMd}`);

// TXT dosyası oluştur (K5: Windows-1254 / CP1254 kodlaması ile ş, ğ, ı, İ, ö, ü, ç)
const cp1254Bytes = Buffer.from([
  0x54, 0xfc, 0x72, 0x6b, 0xe7, 0x65, 0x20, 0x6b, 0x61, 0x72, 0x61, 0x6b, 0x74, 0x65, 0x72, 0x6c, 0x65, 0x72, 0x3a, 0x20, // "Türkçe karakterler: "
  0xfe, 0x20, 0xf0, 0x20, 0xfd, 0x20, 0xdd, 0x20, 0xf6, 0x20, 0xfc, 0x20, 0xe7, 0x2e, // "ş ğ ı İ ö ü ç."
  0x0d, 0x0a, 0x0d, 0x0a,
  0x49, 0x6b, 0x69, 0x6e, 0x63, 0x69, 0x20, 0x64, 0xfc, 0x7a, 0x20, 0x6d, 0x65, 0x74, 0x69, 0x6e, 0x20, 0x70, 0x61, 0x72, 0x61, 0x67, 0x72, 0x61, 0x66, 0xfd, 0x2e, 0x0d, 0x0a // "İkinci düz metin paragrafı.\r\n"
]);
fs.writeFileSync(tmpTxt, cp1254Bytes);
console.log(`[Smoke Test] Test TXT (Windows-1254) dosyası oluşturuldu: ${tmpTxt} (${cp1254Bytes.length} bayt)`);

if (fs.existsSync(markerFile)) {
  fs.unlinkSync(markerFile);
}

let exitedPrematurely = false;
let exitCode = null;

let appOutput = '';

// 2. Exe'yi izole parametrelerle başlat
const child = spawn(
  exePath,
  [
    `--user-data-dir=${tmpUserData}`,
    '--smoke-test',
    `--smoke-test-out=${markerFile}`,
    `--smoke-test-open=${tmpDocx},${tmpMd},${tmpTxt}`
  ],
  {
    cwd: path.dirname(exePath),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  }
);

child.stdout?.on('data', (chunk) => {
  appOutput += chunk.toString();
});
child.stderr?.on('data', (chunk) => {
  appOutput += chunk.toString();
});

child.on('error', (err) => {
  console.error(`[Smoke Test] Exe başlatılamadı:`, err);
  cleanup();
  process.exit(1);
});

child.on('exit', (code, signal) => {
  exitedPrematurely = true;
  exitCode = code !== null ? code : signal;
});

console.log(`[Smoke Test] vText.exe başlatıldı (PID: ${child.pid}). İşaret dosyası bekleniyor (en fazla 15 sn)...`);

const maxWaitMs = 15000;
const pollIntervalMs = 500;
let elapsed = 0;
let success = false;

while (elapsed < maxWaitMs) {
  await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  elapsed += pollIntervalMs;

  if (fs.existsSync(markerFile)) {
    try {
      const raw = fs.readFileSync(markerFile, 'utf-8');
      const data = JSON.parse(raw);
      if (data && data.success === true) {
        console.log(`[Smoke Test] BAŞARILI! İşaret dosyası ${elapsed}ms içinde yazıldı.`);
        console.log(`[Smoke Test] İşaret dosyası içeriği:`, JSON.stringify(data));

        // İşaret dosyasında YALNIZCA başarı durumu, turkceKarakterKorundu ve sayılar olmalıdır (hiçbir yol veya metin sızmamalıdır)
        for (const [key, val] of Object.entries(data)) {
          if (key === 'success' || key === 'turkceKarakterKorundu') {
            if (typeof val !== 'boolean') {
              console.error(`[Smoke Test] HATA: ${key} alanı boolean değil:`, typeof val);
              cleanup();
              process.exit(1);
            }
          } else {
            if (typeof val !== 'number') {
              console.error(`[Smoke Test] HATA: Alan sayısal değil (${key}):`, typeof val, val);
              cleanup();
              process.exit(1);
            }
          }
        }

        if (data.turkceKarakterKorundu !== true) {
          console.error(`[Smoke Test] HATA: turkceKarakterKorundu false döndü (Windows-1254 karakterleri bozuldu)!`);
          cleanup();
          process.exit(1);
        }

        if (typeof data.docxHeadings !== 'number' || data.docxHeadings < 1) {
          console.error(`[Smoke Test] HATA: docxHeadings beklenen değerde değil:`, data.docxHeadings);
          cleanup();
          process.exit(1);
        }
        if (typeof data.docxParagraphs !== 'number' || data.docxParagraphs < 2) {
          console.error(`[Smoke Test] HATA: docxParagraphs beklenen değerde değil:`, data.docxParagraphs);
          cleanup();
          process.exit(1);
        }
        if (typeof data.mdHeadings !== 'number' || data.mdHeadings < 1) {
          console.error(`[Smoke Test] HATA: mdHeadings beklenen değerde değil (markdown-it hatası?):`, data.mdHeadings);
          cleanup();
          process.exit(1);
        }
        if (typeof data.mdParagraphs !== 'number' || data.mdParagraphs < 2) {
          console.error(`[Smoke Test] HATA: mdParagraphs beklenen değerde değil:`, data.mdParagraphs);
          cleanup();
          process.exit(1);
        }
        if (typeof data.txtParagraphs !== 'number' || data.txtParagraphs < 2) {
          console.error(`[Smoke Test] HATA: txtParagraphs beklenen değerde değil (kodlama çözücü hatası?):`, data.txtParagraphs);
          cleanup();
          process.exit(1);
        }

        console.log(`[Smoke Test] DOCX: ${data.docxHeadings} başlık, ${data.docxParagraphs} paragraf/madde.`);
        console.log(`[Smoke Test] MD: ${data.mdHeadings} başlık, ${data.mdParagraphs} paragraf (markdown-it asar doğrulandı).`);
        console.log(`[Smoke Test] TXT: ${data.txtParagraphs} paragraf (kodlama çözücü doğrulandı).`);
        success = true;
        break;
      } else {
        console.error(`[Smoke Test] BAŞARISIZ! İşaret dosyasında hata bildirildi:`, data);
        cleanup();
        process.exit(1);
      }
    } catch (parseErr) {
      // Dosya henüz yazılıyor olabilir, sonraki döngüde tekrar dene
    }
  }

  if (exitedPrematurely) {
    console.error(`[Smoke Test] BAŞARISIZ! İşaret dosyası yazılmadan uygulama kapandı (Çıkış kodu / Sinyal: ${exitCode}).`);
    if (appOutput.trim()) {
      console.error(`[Smoke Test] Uygulama Hata / Konsol Çıktısı:\n${appOutput.trim()}`);
    }
    cleanup();
    process.exit(1);
  }
}

if (!success) {
  console.error(`[Smoke Test] BAŞARISIZ! 15 saniye içinde işaret dosyası (${markerFile}) yazılmadı!`);
  if (!exitedPrematurely) {
    console.error(`[Smoke Test] Süreç ayakta (PID: ${child.pid}) fakat pencere yüklenemedi veya DOCX açılamadı.`);
  }
  cleanup();
  process.exit(1);
}

cleanup();
console.log(`[Smoke Test] Duman testi başarıyla tamamlandı (PASS).`);
process.exit(0);

function cleanup() {
  try {
    if (process.platform === 'win32' && child.pid) {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else if (child.pid) {
      child.kill('SIGTERM');
    }
  } catch {}

  try {
    if (fs.existsSync(markerFile)) {
      fs.unlinkSync(markerFile);
    }
  } catch {}

  try {
    if (fs.existsSync(tmpDocx)) {
      fs.unlinkSync(tmpDocx);
    }
  } catch {}

  try {
    if (fs.existsSync(tmpMd)) {
      fs.unlinkSync(tmpMd);
    }
  } catch {}

  try {
    if (fs.existsSync(tmpTxt)) {
      fs.unlinkSync(tmpTxt);
    }
  } catch {}

  try {
    if (fs.existsSync(tmpUserData)) {
      fs.rmSync(tmpUserData, { recursive: true, force: true });
    }
  } catch {}
}

