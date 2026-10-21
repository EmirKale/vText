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

// 1. İzole temiz userData klasörü, geçici işaret dosyası ve docx oluştur
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-smoke-user-'));
const markerFile = path.join(os.tmpdir(), `vtext-smoke-out-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
const tmpDocx = path.join(os.tmpdir(), `vtext-smoke-in-${Date.now()}-${Math.random().toString(36).slice(2)}.docx`);

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
    `--smoke-test-open=${tmpDocx}`
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
        const keys = Object.keys(data).sort();
        console.log(`[Smoke Test] BAŞARILI! İşaret dosyası ${elapsed}ms içinde yazıldı.`);
        console.log(`[Smoke Test] İşaret dosyası içeriği:`, JSON.stringify(data));
        
        // YALNIZCA başarı durumu, başlık sayısı ve paragraf sayısı kontrolü
        if (keys.join(',') !== 'headingCount,paragraphCount,success') {
          console.error(`[Smoke Test] HATA: İşaret dosyasında beklenmeyen ek alanlar var:`, keys);
          cleanup();
          process.exit(1);
        }

        if (typeof data.headingCount !== 'number' || data.headingCount < 1) {
          console.error(`[Smoke Test] HATA: headingCount beklenen değerde değil:`, data.headingCount);
          cleanup();
          process.exit(1);
        }

        if (typeof data.paragraphCount !== 'number' || data.paragraphCount < 1) {
          console.error(`[Smoke Test] HATA: paragraphCount beklenen değerde değil:`, data.paragraphCount);
          cleanup();
          process.exit(1);
        }

        console.log(`[Smoke Test] Başlık sayısı: ${data.headingCount}, Paragraf/Madde sayısı: ${data.paragraphCount}`);
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
    if (fs.existsSync(tmpUserData)) {
      fs.rmSync(tmpUserData, { recursive: true, force: true });
    }
  } catch {}
}

