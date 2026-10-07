import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

let inMemoryApiKey: string | null = null;
let importedFromPlaintext: boolean = false;

function getAppDataDir(): string {
  const dir = path.join(app.getPath('appData'), 'Kalem');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getEncryptedKeyPath(): string {
  return path.join(getAppDataDir(), 'key.enc');
}

export function getApiKey(): string | null {
  if (inMemoryApiKey) return inMemoryApiKey;

  // 1. Try reading encrypted key from %APPDATA%/Kalem/key.enc
  const encPath = getEncryptedKeyPath();
  if (fs.existsSync(encPath)) {
    try {
      const encryptedBuffer = fs.readFileSync(encPath);
      if (safeStorage.isEncryptionAvailable()) {
        inMemoryApiKey = safeStorage.decryptString(encryptedBuffer).trim();
        return inMemoryApiKey;
      }
    } catch {
      // Fallback
    }
  }

  // 2. Search for plain text key files: key.txt, openrouterkey.txt
  const candidateDirs = [
    process.cwd(),
    path.dirname(process.execPath),
    getAppDataDir()
  ];
  const candidateFiles = ['openrouterkey.txt', 'key.txt'];

  for (const dir of candidateDirs) {
    for (const filename of candidateFiles) {
      const fullPath = path.join(dir, filename);
      if (fs.existsSync(fullPath)) {
        try {
          const raw = fs.readFileSync(fullPath, 'utf8').trim();
          if (raw.length > 5) {
            inMemoryApiKey = raw;
            importedFromPlaintext = true;
            // Encrypt and persist
            saveApiKey(raw);
            return inMemoryApiKey;
          }
        } catch {
          // Ignore read error
        }
      }
    }
  }

  return null;
}

export function saveApiKey(key: string): boolean {
  const cleanKey = key.trim();
  inMemoryApiKey = cleanKey;

  const encPath = getEncryptedKeyPath();
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(cleanKey);
      fs.writeFileSync(encPath, encrypted);
      return true;
    } else {
      // Base64 fallback if safeStorage is unavailable in dev environment
      const buffer = Buffer.from(cleanKey, 'utf8').toString('base64');
      fs.writeFileSync(encPath, buffer, 'utf8');
      return true;
    }
  } catch {
    return false;
  }
}

export function removeApiKey(): void {
  inMemoryApiKey = null;
  const encPath = getEncryptedKeyPath();
  if (fs.existsSync(encPath)) {
    try {
      fs.unlinkSync(encPath);
    } catch {}
  }
}

export function hasImportedFromPlaintext(): boolean {
  return importedFromPlaintext;
}

export function getMaskedApiKey(): string | undefined {
  const key = getApiKey();
  if (!key) return undefined;
  if (key.length <= 10) return '••••••••';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

export async function testApiKey(): Promise<{ valid: boolean; label?: string; usage?: number; limit?: number | null; error?: string }> {
  const key = getApiKey();
  if (!key) {
    return { valid: false, error: 'API anahtarı bulunamadı.' };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });

    if (response.status === 401) {
      return { valid: false, error: 'API anahtarı geçersiz (401).' };
    }
    if (response.status === 402) {
      return { valid: false, error: 'Kredi yetersiz (402).' };
    }
    if (!response.ok) {
      return { valid: false, error: `Sunucu hatası (${response.status})` };
    }

    const json = (await response.json()) as any;
    return {
      valid: true,
      label: json.data?.label,
      usage: json.data?.usage,
      limit: json.data?.limit
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Bağlantı hatası' };
  }
}
