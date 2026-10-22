import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { DocumentFormat } from '../shared/types';

export interface DocumentEntry {
  docId: string;
  filePath: string;
  format: DocumentFormat;
  title: string;
  registeredAt: number;
  lastSavedAt?: number;
  openedFromDisk?: boolean;
  wasLastSavedByVText?: boolean;
  diskMtimeMs?: number;
  diskSha256?: string;
}

/**
 * Dosya yolunu canonical biçime normalleştirir:
 * 1. path.resolve ile mutlak yola dönüştürür.
 * 2. fs.realpathSync.native ile Windows 8.3 kısa adlarını (örn. PROGRA~1) ve symlink'leri çözer.
 * 3. Windows dosya sistemi büyük/küçük harfe duyarsız olduğundan küçük harfe dönüştürür.
 */
export function normalizePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') return '';
  let resolved = path.resolve(filePath);

  try {
    if (fs.existsSync(resolved)) {
      resolved = fs.realpathSync.native(resolved);
    }
  } catch {
    // Henüz diskte var olmayan yeni dosyalar için resolved yol korunur
  }

  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export class DocumentRegistry {
  private static instance: DocumentRegistry;
  private entries: Map<string, DocumentEntry> = new Map();

  public static getInstance(): DocumentRegistry {
    if (!DocumentRegistry.instance) {
      DocumentRegistry.instance = new DocumentRegistry();
    }
    return DocumentRegistry.instance;
  }

  public register(filePath: string, format: DocumentFormat, title?: string): DocumentEntry {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Dosya yolu geçerli bir metin olmalıdır.');
    }
    const resolvedPath = path.resolve(filePath);
    const canonicalKey = normalizePath(resolvedPath);

    // Eğer bu canonical yol altında zaten bir kayıt varsa, onu güncelle ve döndür
    for (const entry of this.entries.values()) {
      if (normalizePath(entry.filePath) === canonicalKey) {
        entry.format = format;
        if (title) entry.title = title;
        return entry;
      }
    }

    // Yeni rastgele, tahmin edilemez UUID v4 oluşturulur
    const docId = crypto.randomUUID();
    const entry: DocumentEntry = {
      docId,
      filePath: resolvedPath,
      format,
      title: title || path.basename(resolvedPath),
      registeredAt: Date.now()
    };
    this.entries.set(docId, entry);
    return entry;
  }

  public get(docId: string): DocumentEntry | undefined {
    if (!docId || typeof docId !== 'string') return undefined;
    return this.entries.get(docId);
  }

  public getByPath(filePath: string): DocumentEntry | undefined {
    if (!filePath || typeof filePath !== 'string') return undefined;
    const canonicalKey = normalizePath(filePath);
    for (const entry of this.entries.values()) {
      if (normalizePath(entry.filePath) === canonicalKey) return entry;
    }
    return undefined;
  }

  public unregister(docId: string): boolean {
    return this.entries.delete(docId);
  }

  public update(
    docId: string,
    updates: Partial<Pick<DocumentEntry, 'filePath' | 'format' | 'title' | 'lastSavedAt'>>
  ): DocumentEntry | undefined {
    const entry = this.entries.get(docId);
    if (!entry) return undefined;
    if (updates.filePath) entry.filePath = path.resolve(updates.filePath);
    if (updates.format) entry.format = updates.format;
    if (updates.title) entry.title = updates.title;
    if (updates.lastSavedAt) entry.lastSavedAt = updates.lastSavedAt;
    return entry;
  }

  public clear(): void {
    this.entries.clear();
  }

  public getCount(): number {
    return this.entries.size;
  }
}

export const documentRegistry = DocumentRegistry.getInstance();
