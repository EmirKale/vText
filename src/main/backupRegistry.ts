import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { normalizePath } from './registry';

let customRegistryPath: string | null = null;

export function setCustomBackupRegistryPath(p: string | null): void {
  customRegistryPath = p;
}

export function getBackupRegistryPath(): string {
  if (customRegistryPath) return customRegistryPath;
  try {
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'backup-hash-registry.json');
    }
  } catch {}
  return path.join(os.tmpdir(), 'vtext-backup-hash-registry.json');
}

export function getFilePathHash(filePath: string): string {
  const norm = normalizePath(filePath);
  return crypto.createHash('sha256').update(norm).digest('hex');
}

export function computeBufferSha256(buf: Buffer | Uint8Array | string): string {
  const hash = crypto.createHash('sha256');
  if (typeof buf === 'string') {
    hash.update(buf, 'utf8');
  } else {
    hash.update(buf);
  }
  return hash.digest('hex');
}

export function loadBackupRegistry(): Record<string, string> {
  const regPath = getBackupRegistryPath();
  try {
    if (!fs.existsSync(regPath)) {
      return {};
    }
    const raw = fs.readFileSync(regPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    console.warn(`[backupRegistry] Bozuk kayıt defteri formatı (${regPath}), güvenli tarafta kalınarak boş kabul edildi.`);
    return {};
  } catch (err) {
    console.warn(`[backupRegistry] Kayıt defteri okunamadı (${regPath}), güvenli tarafta kalınıyor:`, err);
    return {};
  }
}

export function saveBackupRegistry(registry: Record<string, string>): void {
  const regPath = getBackupRegistryPath();
  try {
    const dir = path.dirname(regPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${regPath}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(registry, null, 2), 'utf8');
    try {
      fs.renameSync(tempPath, regPath);
    } catch {
      // Windows EPERM fallback: doğrudan kopyala ve geçiciyi sil
      fs.copyFileSync(tempPath, regPath);
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
  } catch (err) {
    console.error(`[backupRegistry] Kayıt defteri diske yazılamadı (${regPath}):`, err);
  }
}

export function recordFileSavedByVText(filePath: string, contentSha256: string): void {
  const registry = loadBackupRegistry();
  const key = getFilePathHash(filePath);
  registry[key] = contentSha256;
  saveBackupRegistry(registry);
}

export function isFileLastWrittenByVText(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const diskBuffer = fs.readFileSync(filePath);
    const diskSha256 = computeBufferSha256(diskBuffer);
    const registry = loadBackupRegistry();
    const key = getFilePathHash(filePath);
    const storedSha256 = registry[key];
    return typeof storedSha256 === 'string' && storedSha256.length > 0 && storedSha256 === diskSha256;
  } catch (err) {
    console.warn(`[backupRegistry] isFileLastWrittenByVText kontrolünde hata (${filePath}), güvenli tarafta kalınıyor:`, err);
    return false;
  }
}
