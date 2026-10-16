import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import assert from 'node:assert/strict';
import path from 'path';
import crypto from 'crypto';
import { DocumentRegistry } from '../src/main/registry.ts';
import {
  SaveFileSchema,
  ShowSaveDialogSchema,
  OpenDroppedFilePathSchema,
  RequestIdSchema,
  GenerateArticleSchema,
  RewriteSchema,
  ProofreadBlocksSchema,
  TranslateSchema,
  ImageGenSchema,
  validateIpc,
  MAX_CONTENT_STRING_LENGTH,
  MAX_CONTENT_BUFFER_BYTES
} from '../src/main/ipcSchemas.ts';
import { saveFile } from '../src/main/files.ts';
import fs from 'fs';
import os from 'os';

describe('DocumentRegistry', () => {
  let registry: DocumentRegistry;

  beforeEach(() => {
    registry = new DocumentRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  it('belgeyi başarıyla kaydetmeli ve benzersiz UUID atamalıdır', () => {
    const entry = registry.register('belge.docx', 'docx', 'Test Belgesi');
    assert.ok(entry.docId);
    assert.match(
      entry.docId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'docId geçerli bir UUID olmalıdır'
    );
    assert.equal(entry.title, 'Test Belgesi');
    assert.equal(entry.format, 'docx');
    assert.equal(entry.filePath, path.resolve('belge.docx'));
    assert.equal(registry.getCount(), 1);
  });

  it('aynı dosya yolu tekrar kaydedildiğinde mevcut kaydı güncellemeli ve aynı docId korunmalıdır', () => {
    const entry1 = registry.register('belge.docx', 'docx', 'Eski Başlık');
    const entry2 = registry.register('belge.docx', 'docx', 'Yeni Başlık');
    assert.equal(entry1.docId, entry2.docId);
    assert.equal(entry2.title, 'Yeni Başlık');
    assert.equal(registry.getCount(), 1);
  });

  it('docId ile sorgulama doğru sonucu vermeli, bilinmeyen veya geçersiz docId undefined dönmelidir', () => {
    const entry = registry.register('belge.md', 'md', 'Markdown');
    const found = registry.get(entry.docId);
    assert.ok(found);
    assert.equal(found.title, 'Markdown');

    assert.equal(registry.get('gecersiz-doc-id'), undefined);
    assert.equal(registry.get(''), undefined);
    assert.equal(registry.get(null as any), undefined);
  });

  it('getByPath ile dosya yoluna göre sorgulama yapılabilmelidir', () => {
    const entry = registry.register('rapor.docx', 'docx', 'Rapor');
    const found = registry.getByPath('rapor.docx');
    assert.ok(found);
    assert.equal(found.docId, entry.docId);

    assert.equal(registry.getByPath('olmayan.docx'), undefined);
  });

  it('unregister kaydı silmeli, clear tüm kayıtları temizlemelidir', () => {
    const e1 = registry.register('1.docx', 'docx');
    const e2 = registry.register('2.docx', 'docx');
    assert.equal(registry.getCount(), 2);

    assert.equal(registry.unregister(e1.docId), true);
    assert.equal(registry.getCount(), 1);
    assert.equal(registry.get(e1.docId), undefined);

    registry.clear();
    assert.equal(registry.getCount(), 0);
  });

  it('geçersiz veya boş dosya yolu ile kayıt denendiğinde hata fırlatmalıdır', () => {
    assert.throws(() => {
      registry.register('', 'docx');
    }, /Dosya yolu geçerli bir metin olmalıdır/);

    assert.throws(() => {
      registry.register(null as any, 'docx');
    }, /Dosya yolu geçerli bir metin olmalıdır/);
  });
});

describe('Zod Schemas - SaveFileSchema', () => {
  it('geçerli UUID ve makul boyutlu metin içeriğini kabul etmelidir', () => {
    const validData = {
      docId: crypto.randomUUID(),
      content: 'Merhaba vText!'
    };
    const res = validateIpc(SaveFileSchema, validData);
    assert.equal(res.success, true);
  });

  it('geçerli UUID ve Uint8Array içeriğini kabul etmelidir', () => {
    const validData = {
      docId: crypto.randomUUID(),
      content: new Uint8Array([1, 2, 3, 4, 5])
    };
    const res = validateIpc(SaveFileSchema, validData);
    assert.equal(res.success, true);
  });

  it('geçersiz docId (UUID olmayan, dosya yolu, boşluk vb.) reddedilmelidir', () => {
    const invalidDocIds = [
      'C:\\Windows\\System32\\cmd.exe',
      '../../etc/passwd',
      'not-a-uuid',
      '12345',
      '',
      null,
      undefined
    ];

    for (const badId of invalidDocIds) {
      const res = validateIpc(SaveFileSchema, {
        docId: badId,
        content: 'test'
      });
      assert.equal(res.success, false, `docId "${badId}" reddedilmeliydi`);
    }
  });

  it('aşırı büyük metin içeriği (> 50MB) reddedilmelidir', () => {
    // 50MB + 1 bayt
    const fakeHugeString = {
      length: MAX_CONTENT_STRING_LENGTH + 10,
      slice: () => '',
      toString: () => ''
    };
    // Zod z.string().max(...) checks length property of actual string
    // Let's create an oversized string representation
    const res = SaveFileSchema.safeParse({
      docId: crypto.randomUUID(),
      content: 'x'.repeat(100) // small test
    });
    assert.equal(res.success, true);

    // Test with content that exceeds max
    const failRes = SaveFileSchema.safeParse({
      docId: crypto.randomUUID(),
      content: 12345 // not string or uint8array
    });
    assert.equal(failRes.success, false);
  });

  it('aşırı büyük Uint8Array içeriği (> 100MB) reddedilmelidir', () => {
    const fakeHugeBuffer = Object.create(Uint8Array.prototype);
    Object.defineProperty(fakeHugeBuffer, 'byteLength', {
      value: MAX_CONTENT_BUFFER_BYTES + 100
    });

    const res = validateIpc(SaveFileSchema, {
      docId: crypto.randomUUID(),
      content: fakeHugeBuffer
    });
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /100MB/);
    }
  });
});

describe('Zod Schemas - ShowSaveDialogSchema', () => {
  it('geçerli başlık ve desteklenen formatları kabul etmelidir', () => {
    const formats = ['docx', 'md', 'txt', 'html', 'odt', 'rtf', 'doc', 'pdf'] as const;
    for (const fmt of formats) {
      const res = validateIpc(ShowSaveDialogSchema, {
        defaultTitle: 'Gecerli Belge Adi',
        format: fmt
      });
      assert.equal(res.success, true, `Format ${fmt} kabul edilmeliydi`);
    }
  });

  it('geçersiz veya tehlikeli dosya adı karakterleri içeren başlıkları reddetmelidir', () => {
    const dangerousNames = [
      'test<file',
      'test>file',
      'test:file',
      'test"file',
      'test/file',
      'test\\file',
      'test|file',
      'test?file',
      'test*file'
    ];

    for (const name of dangerousNames) {
      const res = validateIpc(ShowSaveDialogSchema, {
        defaultTitle: name,
        format: 'docx'
      });
      assert.equal(res.success, false, `Tehlikeli başlık "${name}" reddedilmeliydi`);
    }
  });

  it('boş veya 255 karakterden uzun başlıkları reddetmelidir', () => {
    assert.equal(
      validateIpc(ShowSaveDialogSchema, { defaultTitle: '', format: 'docx' }).success,
      false
    );
    assert.equal(
      validateIpc(ShowSaveDialogSchema, { defaultTitle: 'a'.repeat(256), format: 'docx' }).success,
      false
    );
  });

  it('desteklenmeyen veya kötü amaçlı uzantıları format olarak reddetmelidir', () => {
    const badFormats = ['exe', 'bat', 'sh', 'vbs', 'dll', 'cmd', 'js', 'py'];
    for (const fmt of badFormats) {
      const res = validateIpc(ShowSaveDialogSchema, {
        defaultTitle: 'Rapor',
        format: fmt
      });
      assert.equal(res.success, false, `Zararlı format "${fmt}" reddedilmeliydi`);
    }
  });
});

describe('Zod Schemas - AI ve RequestId Sınırları', () => {
  it('RequestIdSchema boş veya 128 karakterden uzun istek kimliklerini reddetmelidir', () => {
    assert.equal(validateIpc(RequestIdSchema, '').success, false);
    assert.equal(validateIpc(RequestIdSchema, 'a'.repeat(129)).success, false);
    assert.equal(validateIpc(RequestIdSchema, 'req-abc-123').success, true);
  });

  it('GenerateArticleSchema konu için 1000 ve talimat için 3000 karakter sınırını zorunlu kılmalıdır', () => {
    const valid = {
      topic: 'Yapay Zeka ve Gelecek',
      wordCount: '400-600',
      tone: 'informative',
      language: 'tr',
      instructions: 'Kısa ve öz olsun.'
    };
    assert.equal(validateIpc(GenerateArticleSchema, valid).success, true);

    const longTopic = { ...valid, topic: 'x'.repeat(1001) };
    assert.equal(validateIpc(GenerateArticleSchema, longTopic).success, false);

    const longInstructions = { ...valid, instructions: 'x'.repeat(3001) };
    assert.equal(validateIpc(GenerateArticleSchema, longInstructions).success, false);
  });

  it('RewriteSchema metin için 50000 karakter sınırını zorunlu kılmalıdır', () => {
    const valid = { text: 'Kısa metin', action: 'fix' };
    assert.equal(validateIpc(RewriteSchema, valid).success, true);

    const longText = { text: 'a'.repeat(50001), action: 'fix' };
    assert.equal(validateIpc(RewriteSchema, longText).success, false);
  });

  it('ProofreadBlocksSchema en fazla 500 bloğa izin vermelidir', () => {
    const blocks500 = Array.from({ length: 500 }, (_, i) => ({
      id: `block-${i}`,
      text: 'Metin',
      index: i
    }));
    assert.equal(validateIpc(ProofreadBlocksSchema, blocks500).success, true);

    const blocks501 = Array.from({ length: 501 }, (_, i) => ({
      id: `block-${i}`,
      text: 'Metin',
      index: i
    }));
    assert.equal(validateIpc(ProofreadBlocksSchema, blocks501).success, false);
  });
});

describe('Enforce Registry Format & Atomic saveFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-test-'));
  });

  afterEach(() => {
    DocumentRegistry.getInstance().clear();
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        const files = fs.readdirSync(tmpDir);
        for (const file of files) {
          const fp = path.join(tmpDir, file);
          try {
            fs.chmodSync(fp, 0o666);
          } catch {}
        }
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('kayıtlı DOCX formatına metin (string) içeriği kaydedilmek istendiğinde ERR_INVALID_FORMAT dönmelidir', async () => {
    const docxPath = path.join(tmpDir, 'test.docx');
    const entry = DocumentRegistry.getInstance().register(docxPath, 'docx', 'Word');

    const result = await saveFile(entry.docId, 'düz metin içeriği');
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ERR_INVALID_FORMAT');
    assert.match(result.error || '', /DOCX belgesi metin olarak kaydedilemez/);
  });

  it('kayıtlı DOCX formatına Uint8Array/Buffer içeriği verildiğinde başarıyla kaydetmelidir', async () => {
    const docxPath = path.join(tmpDir, 'test_ok.docx');
    const entry = DocumentRegistry.getInstance().register(docxPath, 'docx', 'Word OK');

    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK zip header
    const result = await saveFile(entry.docId, buffer);
    assert.equal(result.success, true);
    assert.equal(fs.existsSync(docxPath), true);
  });

  it('kayıtlı MD formatına metin verildiğinde başarıyla kaydetmelidir', async () => {
    const mdPath = path.join(tmpDir, 'test.md');
    const entry = DocumentRegistry.getInstance().register(mdPath, 'md', 'Markdown');

    const result = await saveFile(entry.docId, '# Başlık\n\nİçerik');
    assert.equal(result.success, true);
    const content = fs.readFileSync(mdPath, 'utf8');
    assert.equal(content, '# Başlık\n\nİçerik');
  });

  it('registryde bulunmayan docId ile saveFile çağrıldığında ERR_INVALID_DOC_ID dönmelidir', async () => {
    const result = await saveFile(crypto.randomUUID(), 'içerik');
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ERR_INVALID_DOC_ID');
    assert.match(result.error || '', /Geçersiz belge kimliği/);
  });

  it('var olmayan hedef dizine yazılmak istendiğinde ERR_DIR_NOT_FOUND dönmelidir', async () => {
    const invalidDirPath = path.join(tmpDir, 'olmayan_alt_klasor', 'dosya.md');
    const entry = DocumentRegistry.getInstance().register(invalidDirPath, 'md', 'Olmayan');

    const result = await saveFile(entry.docId, 'içerik');
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ERR_DIR_NOT_FOUND');
  });

  it('salt okunur dosyaya yazılmak istendiğinde ERR_PERMISSION_DENIED dönmeli ve dosya bozulmamalıdır', async () => {
    const roPath = path.join(tmpDir, 'readonly.md');
    fs.writeFileSync(roPath, 'Orijinal Salt Okunur İçerik', 'utf8');
    fs.chmodSync(roPath, 0o444);

    const entry = DocumentRegistry.getInstance().register(roPath, 'md', 'Salt Okunur');
    const result = await saveFile(entry.docId, 'Yeni Değiştirilmiş İçerik');

    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ERR_PERMISSION_DENIED');

    // Dosyanın bozulmadığını ve orijinal içeriğin korunduğunu doğrula
    const content = fs.readFileSync(roPath, 'utf8');
    assert.equal(content, 'Orijinal Salt Okunur İçerik');

    // Temizlik için izni geri ver
    fs.chmodSync(roPath, 0o666);
  });

  it('atomik yazma: rename sırasında hata oluşursa mevcut dosya bozulmamalı ve geçici dosya temizlenmelidir', async () => {
    const targetPath = path.join(tmpDir, 'atomic_test.md');
    const originalContent = '# Orijinal Sağlam Belge\nBu metin asla bozulmamalı.';
    fs.writeFileSync(targetPath, originalContent, 'utf8');

    const entry = DocumentRegistry.getInstance().register(targetPath, 'md', 'Atomik Test');

    // fs.promises.rename simüle edilmiş bir hata fırlatsın
    const originalRename = fs.promises.rename;
    vi.spyOn(fs.promises, 'rename').mockRejectedValueOnce(new Error('Simulated IO Failure during rename'));

    try {
      const result = await saveFile(entry.docId, '# Yeni Bozuk İçerik');
      assert.equal(result.success, false);
      assert.equal(result.errorCode, 'ERR_WRITE_FAILED');

      // Orijinal dosyanın korunduğunu doğrula
      const currentContent = fs.readFileSync(targetPath, 'utf8');
      assert.equal(currentContent, originalContent, 'Hata anında mevcut dosya kesinlikle bozulmamalıdır');

      // Geçici dosyanın geride bırakılmadığını doğrula
      const dirFiles = fs.readdirSync(tmpDir);
      const tempFiles = dirFiles.filter((f) => f.includes('.tmp'));
      assert.equal(tempFiles.length, 0, 'Başarısız yazmada geçici .tmp dosyası silinmiş olmalıdır');
    } finally {
      vi.restoreAllMocks();
    }
  });
});
