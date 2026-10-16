import crypto from 'crypto';
import path from 'path';
import { DocumentFormat } from '../shared/types';

export interface DocumentEntry {
  docId: string;
  filePath: string;
  format: DocumentFormat;
  title: string;
  registeredAt: number;
  lastSavedAt?: number;
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

    // If already registered under this path, update and return existing entry
    for (const entry of this.entries.values()) {
      if (entry.filePath === resolvedPath) {
        entry.format = format;
        if (title) entry.title = title;
        return entry;
      }
    }

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
    const resolved = path.resolve(filePath);
    for (const entry of this.entries.values()) {
      if (entry.filePath === resolved) return entry;
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

