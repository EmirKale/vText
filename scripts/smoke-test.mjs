import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
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

let exitedPrematurely = false;
let exitCode = null;

// Exe'yi yönetici OLMADAN, standart kullanıcı olarak başlat
const child = spawn(exePath, [], {
  cwd: path.dirname(exePath),
  stdio: 'ignore',
  detached: false
});

child.on('error', (err) => {
  console.error(`[Smoke Test] Exe başlatılamadı:`, err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  exitedPrematurely = true;
  exitCode = code !== null ? code : signal;
});

console.log(`[Smoke Test] vText.exe başlatıldı (PID: ${child.pid}). 10 saniye gözlemleniyor...`);

const waitSeconds = 10;
for (let i = 1; i <= waitSeconds; i++) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (exitedPrematurely) {
    console.error(`[Smoke Test] BAŞARISIZ! Uygulama ${i}. saniyede beklenmedik şekilde kapandı (Çıkış kodu / Sinyal: ${exitCode}).`);
    process.exit(1);
  }
}

console.log(`[Smoke Test] Başarılı! Uygulama 10 saniye boyunca çökmeden kararlı şekilde çalıştı.`);

// Uygulama ağacını temizce kapat
try {
  if (process.platform === 'win32' && child.pid) {
    execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
} catch {
  // Process might have already shut down cleanly
}

console.log(`[Smoke Test] Uygulama sonlandırıldı. Test tamamlandı.`);
process.exit(0);
