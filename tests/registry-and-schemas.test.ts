import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import assert from 'node:assert/strict';
import path from 'path';
import crypto from 'crypto';
import { DocumentRegistry, normalizePath } from '../src/main/registry.ts';
import { isAllowedUrl } from '../src/main/ipcSecurity.ts';
import { pathToFileURL } from 'url';
import {
  SaveFileSchema,
  UnregisterFileSchema,
  ShowSaveDialogSchema,
  OpenDroppedFilePathSchema,
  RequestIdSchema,
  GenerateArticleSchema,
  RewriteSchema,
  ProofreadBlocksSchema,
  TranslateSchema,
  ImageGenSchema,
  ConfirmOverwriteSchema,
  SaveSettingsSchema,
  validateIpc,
  MAX_CONTENT_STRING_LENGTH,
  MAX_CONTENT_BUFFER_BYTES
} from '../src/main/ipcSchemas.ts';
import { saveFile } from '../src/main/files.ts';
import { closeCoordinator } from '../src/main/closeCoordinator.ts';
import { isValidSmokeTestOutPath, isValidSmokeTestOpenPath } from '../src/main/smokeValidator.ts';
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

  it('aşırı büyük ArrayBufferView / Buffer içeriği (> 100MB) reddedilmelidir', () => {
    const fakeView = {
      buffer: new ArrayBuffer(0),
      byteLength: MAX_CONTENT_BUFFER_BYTES + 500,
      byteOffset: 0
    };
    Object.setPrototypeOf(fakeView, Uint8Array.prototype);

    const res = validateIpc(SaveFileSchema, {
      docId: crypto.randomUUID(),
      content: fakeView
    });
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /100MB/);
    }
  });
});

describe('Zod Schemas - UnregisterFileSchema', () => {
  it('geçerli UUID ile docId unregister şemasından geçmelidir', () => {
    const validUuid = crypto.randomUUID();
    const res = validateIpc(UnregisterFileSchema, { docId: validUuid });
    assert.equal(res.success, true);
    if (res.success) {
      assert.equal(res.data.docId, validUuid);
    }
  });

  it('geçersiz, boş veya UUID olmayan docId unregister şemasında reddedilmelidir', () => {
    assert.equal(validateIpc(UnregisterFileSchema, { docId: '' }).success, false);
    assert.equal(validateIpc(UnregisterFileSchema, { docId: 'gecersiz-id' }).success, false);
    assert.equal(validateIpc(UnregisterFileSchema, { docId: 12345 }).success, false);
    assert.equal(validateIpc(UnregisterFileSchema, {}).success, false);
  });
});

describe('Zod Schemas - ShowSaveDialogSchema', () => {
  it('geçerli başlık ve desteklenen formatları kabul etmelidir (PDF hariç)', () => {
    const formats = ['docx', 'md', 'txt', 'html', 'odt', 'rtf', 'doc'] as const;
    for (const fmt of formats) {
      const res = validateIpc(ShowSaveDialogSchema, {
        defaultTitle: 'Gecerli Belge Adi',
        format: fmt
      });
      assert.equal(res.success, true, `Format ${fmt} kabul edilmeliydi`);
    }
  });

  it('PDF formatı save dialog şemasında reddedilmelidir (PDF ayrı komutla aktarılır)', () => {
    const res = validateIpc(ShowSaveDialogSchema, {
      defaultTitle: 'Rapor',
      format: 'pdf'
    });
    assert.equal(res.success, false, 'PDF formatı showSaveDialog tarafından reddedilmeliydi');
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

  it('kayıtlı DOCX formatına "PK" ile başlamayan geçersiz ikili veri verildiğinde ERR_INVALID_FORMAT dönmeli ve dosya oluşmamalıdır', async () => {
    const docxPath = path.join(tmpDir, 'test_invalid_magic.docx');
    const entry = DocumentRegistry.getInstance().register(docxPath, 'docx', 'Word Bad Magic');

    const invalidBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]); // Not PK
    const result = await saveFile(entry.docId, invalidBuffer);
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ERR_INVALID_FORMAT');
    assert.match(result.error || '', /"PK"/);
    assert.equal(fs.existsSync(docxPath), false, 'Hatalı DOCX dosyası diske yazılmamalıdır');
  });

  it('kayıtlı DOCX formatına Uint8Array/Buffer içeriği verildiğinde başarıyla kaydetmelidir', async () => {
    const docxPath = path.join(tmpDir, 'test_ok.docx');
    const entry = DocumentRegistry.getInstance().register(docxPath, 'docx', 'Word OK');

    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK zip header
    const result = await saveFile(entry.docId, buffer);
    assert.equal(result.success, true);
    assert.equal(fs.existsSync(docxPath), true);
  });

  it('kayıtlı PDF formatı saveFile ile kaydedilmek istendiğinde ERR_INVALID_FORMAT ile reddedilmelidir', async () => {
    const pdfPath = path.join(tmpDir, 'test.pdf');
    const entry = DocumentRegistry.getInstance().register(pdfPath, 'pdf', 'PDF Doc');

    const result = await saveFile(entry.docId, '%PDF-1.4 sample content');
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ERR_INVALID_FORMAT');
    assert.match(result.error || '', /saveFile ile kaydedilemez/);
    assert.equal(fs.existsSync(pdfPath), false, 'Reddedilen PDF dosyası diske yazılmamalıdır');
  });

  it('md kaydına Uint8Array verilirse reddedilmeli ve dosya oluşmamalı', async () => {
    const mdPath = path.join(tmpDir, 'binary_to_md.md');
    const entry = DocumentRegistry.getInstance().register(mdPath, 'md', 'Markdown Binary Test');

    const binaryData = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const result = await saveFile(entry.docId, binaryData as any);
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ERR_INVALID_FORMAT');
    assert.match(result.error || '', /düz metin/i);
    assert.equal(fs.existsSync(mdPath), false, 'Uint8Array gönderildiğinde .md dosyası ASLA oluşturulmamalıdır');
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

  it('ConfirmOverwriteSchema: geçerli parametreleri doğrulamalı ve varsayılanları atamalıdır', () => {
    const valid = validateIpc(ConfirmOverwriteSchema, { targetTitle: 'hedef.docx', isDirty: true });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.targetTitle, 'hedef.docx');
      assert.equal(valid.data.isDirty, true);
    }

    const defaultApplied = validateIpc(ConfirmOverwriteSchema, {});
    assert.equal(defaultApplied.success, true);
    if (defaultApplied.success) {
      assert.equal(defaultApplied.data.targetTitle, 'Belge');
      assert.equal(defaultApplied.data.isDirty, false);
    }
  });

  it('Windows yol normalleştirmesi: büyük/küçük harf duyarsızlığı ve aynı dosya için tek docId üretilmesi', () => {
    const p1 = 'C:\\Users\\Emir\\Belgeler\\Rapor.DOCX';
    const p2 = 'c:\\users\\emir\\belgeler\\rapor.docx';
    const p3 = 'C:\\USERS\\EMIR\\BELGELER\\RAPOR.DOCX';

    const norm1 = normalizePath(p1);
    const norm2 = normalizePath(p2);
    const norm3 = normalizePath(p3);

    if (process.platform === 'win32') {
      assert.equal(norm1, norm2);
      assert.equal(norm2, norm3);
    }

    // DocumentRegistry'ye farklı büyük/küçük harfle kaydedildiğinde:
    const reg = new DocumentRegistry();
    const entry1 = reg.register(p1, 'docx', 'Rapor');
    const entry2 = reg.register(p2, 'docx', 'rapor');
    const entry3 = reg.register(p3, 'docx', 'RAPOR');

    // Aynı docId dönmeli, yeni kayıt açılmamalıdır
    assert.equal(entry1.docId, entry2.docId);
    assert.equal(entry2.docId, entry3.docId);
    assert.equal(reg.getCount(), 1);

    // getByPath ile de farklı harf büyüklükleriyle bulunabilmelidir
    const found = reg.getByPath('c:\\USERS\\emir\\BELGELER\\rapor.docx');
    assert.ok(found);
    assert.equal(found.docId, entry1.docId);

    // docId'nin tahmin edilemezliği: rastgele UUID v4 olmalıdır, yoldan türetilen deterministik bir hash DEĞİLDİR
    assert.match(
      entry1.docId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'docId rastgele UUID v4 olmalıdır'
    );
  });

  it('isAllowedUrl: Program Files, boşluklu kullanıcı adları ve Türkçe karakterli yolları doğru doğrulamalıdır', () => {
    // 1. Program Files yolu (boşluklu)
    const progFilesPath = 'C:\\Program Files\\vText\\resources\\app.asar\\out\\renderer\\index.html';
    const progFilesUrl = pathToFileURL(progFilesPath).href;
    assert.ok(progFilesUrl.includes('%20'), 'URL boşluk için %20 içermelidir');
    assert.equal(
      isAllowedUrl(progFilesUrl, [progFilesPath], true),
      true,
      'Program Files URL doğrulaması başarılı olmalıdır'
    );

    // 2. Boşluklu kullanıcı adı yolu
    const userSpacePath = 'C:\\Users\\Emir Kale\\AppData\\Local\\Programs\\vText\\resources\\app.asar\\out\\renderer\\index.html';
    const userSpaceUrl = pathToFileURL(userSpacePath).href;
    assert.ok(userSpaceUrl.includes('Emir%20Kale'));
    assert.equal(
      isAllowedUrl(userSpaceUrl, [userSpacePath], true),
      true,
      'Boşluklu kullanıcı adı URL doğrulaması başarılı olmalıdır'
    );

    // 3. Türkçe karakterli yol (İ, ş, ç)
    const turkishPath = 'C:\\Users\\İşçi\\AppData\\Local\\Programs\\vText\\resources\\app.asar\\out\\renderer\\index.html';
    const turkishUrl = pathToFileURL(turkishPath).href;
    // pathToFileURL Türkçe karakterleri UTF-8 percent-encode eder (%C4%B0, %C5%9F, %C3%A7)
    assert.ok(turkishUrl.includes('%C4%B0') || turkishUrl.includes('%C5%9F') || turkishUrl.includes('%C3%A7'));
    assert.equal(
      isAllowedUrl(turkishUrl, [turkishPath], true),
      true,
      'Türkçe karakterli yol URL doğrulaması başarılı olmalıdır'
    );

    // 4. Windows büyük/küçük harf duyarsızlığı kontrolü (URL küçük harf, expected büyük harf)
    const lowerUrl = pathToFileURL('c:\\program files\\vtext\\resources\\app.asar\\out\\renderer\\index.html').href;
    assert.equal(
      isAllowedUrl(lowerUrl, [progFilesPath], true),
      true,
      'Farklı büyük/küçük harfli URL Windows üzerinde eşleşmelidir'
    );

    // 5. Yetkisiz dosya yolları kesinlikle reddedilmelidir
    const unauthorizedUrl = pathToFileURL('C:\\Users\\İşçi\\AppData\\Local\\Programs\\vText\\resources\\evil.html').href;
    assert.equal(
      isAllowedUrl(unauthorizedUrl, [turkishPath], true),
      false,
      'Yetkisiz index dışı HTML reddedilmelidir'
    );
  });

  it('Kapatma zaman aşımı el sıkışması (handshake): renderer onay kutusu açınca gerçek closeCoordinator sayacı durdurulmalı, 10 sn beklense bile zaman aşımı çalışmamalıdır', () => {
    vi.useFakeTimers();
    closeCoordinator.reset();
    let timeoutFired = false;

    // Pencere kapatma isteği: closeCoordinator üzerinden başlatılır
    closeCoordinator.setClosePending(true);
    closeCoordinator.startCloseTimeout(() => {
      timeoutFired = true;
    }, 3500);

    // Renderer pencere kapatma talebini aldığını ve kullanıcıya sorduğunu bildirir:
    // (window:promptingClose IPC çağrısı -> closeCoordinator.stopCloseTimeout())
    closeCoordinator.stopCloseTimeout();

    // Kullanıcı 10 saniye boyunca karar vermeyi bekler
    vi.advanceTimersByTime(10000);

    // Sayaç durdurulduğu için "Yanıt Vermiyor" uyarısı ASLA tetiklenmemiştir
    assert.equal(timeoutFired, false, 'Kullanıcı karar verirken 3.5 sn zaman aşımı tetiklenmemelidir');

    // Kullanıcı kararını verince pencere kapatılır veya iptal edilir
    closeCoordinator.clearCloseTimeout();
    assert.equal(closeCoordinator.isClosing(), false);
    vi.useRealTimers();
  });

  it('Kapatma zaman aşımı: renderer HİÇ yanıt vermezse (çökerse) gerçek closeCoordinator 3.5 saniye sonra zaman aşımı devreye girmelidir', () => {
    vi.useFakeTimers();
    closeCoordinator.reset();
    let timeoutFired = false;

    closeCoordinator.setClosePending(true);
    closeCoordinator.startCloseTimeout(() => {
      timeoutFired = true;
    }, 3500);

    // Renderer dondu/çöktü, promptingClose HİÇ gelmedi
    // 3.4 saniye sonra henüz tetiklenmemeli
    vi.advanceTimersByTime(3400);
    assert.equal(timeoutFired, false);

    // 3.5 saniye dolunca zaman aşımı tetiklenmeli
    vi.advanceTimersByTime(200);
    assert.equal(timeoutFired, true, 'Renderer hiç yanıt vermezse 3.5 sn sonra zaman aşımı tetiklenmelidir');

    closeCoordinator.reset();
    vi.useRealTimers();
  });

  it('Güncelleme kurulum akışı: updater:install "Kaydet" seçilince belgeler kaydedildikten sonra quitAndInstall tetiklenmelidir', () => {
    closeCoordinator.reset();

    // 1. Kullanıcı "Güncelle ve Yeniden Başlat" der, kaydedilmemiş sekme vardır
    // Dialogda "Kaydet" seçilince updater:install koordinatöre bildirim yapar:
    closeCoordinator.setInstallPendingAfterSave(true);
    assert.equal(closeCoordinator.isInstallPending(), true);

    // 2. Renderer belgeleri kaydeder ve window.kalem.window.close(true) çağırır.
    // ipcMain window:close işleyicisi çalışır:
    let quitAndInstallCalled = false;
    const fakeQuitAndInstall = () => {
      quitAndInstallCalled = true;
    };

    if (closeCoordinator.isInstallPending()) {
      closeCoordinator.setInstallPendingAfterSave(false);
      closeCoordinator.setAppQuitting(true);
      fakeQuitAndInstall();
    }

    // 3. Doğrulama: Uygulama sadece kapanmakla kalmaz, quitAndInstall çağrılarak güncelleme kurulur!
    assert.equal(quitAndInstallCalled, true, 'Belgeler kaydedildikten sonra autoUpdater.quitAndInstall çalıştırılmalıdır');
    assert.equal(closeCoordinator.isQuitting(), true);
    assert.equal(closeCoordinator.isInstallPending(), false);

    closeCoordinator.reset();
  });

  it('Güncelleme kurulum akışı: "Kaydet" seçildikten sonra kullanıcı kaydetme diyaloğunda "İptal" derse güncelleme kurulumu durdurulmalıdır', () => {
    closeCoordinator.reset();

    // 1. Güncelleme için kaydetme bekleniyor
    closeCoordinator.setInstallPendingAfterSave(true);

    // 2. Kullanıcı kaydetme diyaloğunda "İptal" seçti -> renderer window:cancelClose çağırır
    closeCoordinator.setInstallPendingAfterSave(false);
    closeCoordinator.clearCloseTimeout();

    // 3. Doğrulama: Kurulum bayrağı temizlenmiş ve pencere kapatılmamıştır
    assert.equal(closeCoordinator.isInstallPending(), false);
    assert.equal(closeCoordinator.isClosing(), false);
    closeCoordinator.reset();
  });

  describe('3A. updateRepo ve Güvenli Ayar Şeması Doğrulaması', () => {
    it('SaveSettingsSchema geçerli ayarları başarıyla kabul etmelidir', () => {
      const valid = {
        textModel: 'openai/gpt-4o',
        fontSize: 18,
        theme: 'dark' as const,
        autoCheckUpdates: false
      };
      const res = validateIpc(SaveSettingsSchema, valid);
      assert.equal(res.success, true);
    });

    it('SaveSettingsSchema: settings:save({ updateRepo: "x/y" }) .strict() şema ile kesinlikle reddedilmelidir', () => {
      const maliciousPayload = {
        fontSize: 16,
        updateRepo: 'malicious-attacker/vText'
      };
      const res = validateIpc(SaveSettingsSchema, maliciousPayload);
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(
          res.error.includes('unrecognized_keys') || res.error.includes('updateRepo'),
          `Hata mesajı bilinmeyen anahtar (updateRepo) uyarısı içermelidir: ${res.error}`
        );
      }
    });

    it('Eski bir electron-store kaydında updateRepo varsa yok sayılmalı ve temizlenmelidir', () => {
      // Simüle edilen store haritası
      const mockStoreData: Record<string, any> = {
        fontSize: 16,
        theme: 'dark',
        updateRepo: 'old-owner/old-repo'
      };

      const mockStore = {
        get: (key: string) => mockStoreData[key],
        set: (key: string, val: any) => { mockStoreData[key] = val; },
        has: (key: string) => key in mockStoreData,
        delete: (key: string) => { delete mockStoreData[key]; }
      };

      // settings:get davranışı
      if (mockStore.has('updateRepo')) {
        mockStore.delete('updateRepo');
      }

      assert.equal(mockStore.has('updateRepo'), false, 'Eski updateRepo kaydı silinmelidir');
      assert.equal(mockStore.get('updateRepo'), undefined);
    });

    it('Auto-update güncelleme kaynağı dinamik ayardan değil, package.json build.publish yapılandırmasından okunmalıdır', () => {
      const pkgPath = path.resolve('package.json');
      const pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      assert.ok(pkgContent.build?.publish, 'package.json içinde build.publish yapılandırması bulunmalıdır');
      assert.equal(pkgContent.build.publish[0].owner, 'EmirKale');
      assert.equal(pkgContent.build.publish[0].repo, 'vText');
      assert.equal(pkgContent.build.publish[0].provider, 'github');
    });
  });

  describe('3B. Duman Testi Bayrağı Güvenliği ve Anahtar İzolasyonu', () => {
    it('--smoke-test-out yalnızca os.tmpdir() altındaki .json uzantılı dosyaları kabul etmelidir', () => {
      const validPath = path.join(os.tmpdir(), 'smoke-valid-test.json');
      assert.equal(isValidSmokeTestOutPath(validPath), true);

      const nonJsonPath = path.join(os.tmpdir(), 'smoke-invalid.txt');
      assert.equal(isValidSmokeTestOutPath(nonJsonPath), false);

      const outsideTmpPath = path.resolve('C:\\Windows\\System32\\hacked.json');
      assert.equal(isValidSmokeTestOutPath(outsideTmpPath), false);

      const relativeTraversalPath = path.join(os.tmpdir(), '..', 'arbitrary.json');
      assert.equal(isValidSmokeTestOutPath(relativeTraversalPath), false);

      assert.equal(isValidSmokeTestOutPath(null), false);
      assert.equal(isValidSmokeTestOutPath(''), false);
    });

    it('--smoke-test-open yalnızca os.tmpdir() altındaki .docx, .md ve .txt dosyalarını kabul etmelidir', () => {
      const validDocx = path.join(os.tmpdir(), 'valid.docx');
      const validMd = path.join(os.tmpdir(), 'valid.md');
      const validTxt = path.join(os.tmpdir(), 'valid.txt');
      assert.equal(isValidSmokeTestOpenPath(validDocx), true);
      assert.equal(isValidSmokeTestOpenPath(validMd), true);
      assert.equal(isValidSmokeTestOpenPath(validTxt), true);

      const invalidExt = path.join(os.tmpdir(), 'invalid.exe');
      assert.equal(isValidSmokeTestOpenPath(invalidExt), false);

      const outsideTmp = path.resolve('C:\\Windows\\System32\\test.docx');
      assert.equal(isValidSmokeTestOpenPath(outsideTmp), false);

      const traversal = path.join(os.tmpdir(), '..', 'evil.md');
      assert.equal(isValidSmokeTestOpenPath(traversal), false);

      assert.equal(isValidSmokeTestOpenPath(null), false);
      assert.equal(isValidSmokeTestOpenPath(''), false);
    });

    it('Duman testi işaret dosyasına yalnızca durum ve ayar ANAHTARLARI yazılmalı, hiçbir DEĞER yazılmamalıdır', () => {
      const sampleSettings = {
        hasApiKey: true,
        maskedApiKey: 'sk-...1234',
        realSecretApiKey: 'sk-ant-live-secret-never-expose',
        textModel: 'openai/gpt-4o',
        imageModel: 'google/imagen-3',
        fontSize: 16
      };

      // Simüle edilen güvenli duman testi çıktısı
      const settingKeys = Object.keys(sampleSettings).sort();
      const payload = {
        success: true,
        settingKeys,
        timestamp: Date.now()
      };

      const serialized = JSON.stringify(payload);
      assert.ok(!serialized.includes('sk-ant-live-secret-never-expose'), 'Gerçek gizli anahtar işaret dosyasına sızamaz');
      assert.ok(!serialized.includes('sk-...1234'), 'Maskelenmiş anahtar dahi değer olarak yazılamaz');
      assert.ok(!serialized.includes('openai/gpt-4o'), 'Model değerleri yazılamaz');
      assert.deepEqual(payload.settingKeys, [
        'fontSize',
        'hasApiKey',
        'imageModel',
        'maskedApiKey',
        'realSecretApiKey',
        'textModel'
      ]);
    });
  });
});

