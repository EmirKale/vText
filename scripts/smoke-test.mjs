import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

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

// 1. İzole temiz userData klasörü ve geçici işaret dosyası oluştur
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-smoke-user-'));
const markerFile = path.join(os.tmpdir(), `vtext-smoke-out-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

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
    `--smoke-test-out=${markerFile}`
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
      if (data && data.success === true && (data.settingKeys || data.settings)) {
        const keys = data.settingKeys || Object.keys(data.settings);
        console.log(`[Smoke Test] BAŞARILI! İşaret dosyası ${elapsed}ms içinde yazıldı ve IPC settings:get doğrulandı.`);
        console.log(`[Smoke Test] Ayar anahtarları (yalnızca anahtarlar, değer içermez):`, keys);
        success = true;
        break;
      } else {
        console.error(`[Smoke Test] BAŞARISIZ! İşaret dosyasında IPC hatası bildirildi:`, data);
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
    console.error(`[Smoke Test] Süreç ayakta (PID: ${child.pid}) fakat pencere yüklenemedi veya IPC yanıt vermedi.`);
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
    if (fs.existsSync(tmpUserData)) {
      fs.rmSync(tmpUserData, { recursive: true, force: true });
    }
  } catch {}
}
