import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const projectRoot = path.resolve('.');
const tmpCloneDir = path.join(os.tmpdir(), `vtext-clean-clone-${Date.now()}`);

console.log(`[CLEAN CLONE SIMULATION] Geçici dizin: ${tmpCloneDir}`);

try {
  fs.mkdirSync(tmpCloneDir, { recursive: true });

  // 1. git ls-files ile izlenen dosyaları listele
  const filesListRaw = execSync('git ls-files', { cwd: projectRoot, encoding: 'utf-8' });
  const files = filesListRaw.split(/\r?\n/).filter((f) => f.trim().length > 0);

  console.log(`[CLEAN CLONE SIMULATION] Kopyalanacak dosya sayısı: ${files.length}`);

  for (const relFile of files) {
    const src = path.join(projectRoot, relFile);
    const dest = path.join(tmpCloneDir, relFile);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  // 2. npm ci çalıştır
  console.log(`[CLEAN CLONE SIMULATION] npm ci çalıştırılıyor...`);
  const ciOut = execSync('npm ci', { cwd: tmpCloneDir, encoding: 'utf-8', stdio: 'pipe' });
  console.log(`[CLEAN CLONE SIMULATION] npm ci tamamlandı.`);

  // 3. npm test çalıştır
  console.log(`[CLEAN CLONE SIMULATION] npm test çalıştırılıyor...`);
  const testOut = execSync('npm test', { cwd: tmpCloneDir, encoding: 'utf-8', stdio: 'pipe' });
  console.log(testOut);
  console.log(`[CLEAN CLONE SIMULATION] BAŞARILI: Temiz klon üzerinde npm test 100% yeşil!`);
} catch (err) {
  console.error(`[CLEAN CLONE SIMULATION] HATA:`, err.stdout || err.message);
  process.exit(1);
} finally {
  try {
    fs.rmSync(tmpCloneDir, { recursive: true, force: true });
  } catch {}
}
