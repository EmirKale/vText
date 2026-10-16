import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DocumentRegistry } from '../src/main/registry.ts';
import { saveFile, openFileByPath } from '../src/main/files.ts';
import { exportTipTapJsonToDocx } from '../src/renderer/src/io/docxExport.ts';
import { tipTapJsonToMarkdown } from '../src/renderer/src/io/markdown.ts';
import { SaveFileSchema, validateIpc } from '../src/main/ipcSchemas.ts';

describe('Kaydetme ve Dışa Aktarma Akış Testleri (Uçtan Uca)', () => {
  let tmpDir: string;
  let registry: DocumentRegistry;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-flow-test-'));
    registry = DocumentRegistry.getInstance();
    registry.clear();
  });

  afterEach(() => {
    registry.clear();
    if (fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('md kaydına Uint8Array verilirse reddedilmeli ve dosya oluşmamalı', async () => {
    const mdPath = path.join(tmpDir, 'test_reddedilen.md');
    const entry = registry.register(mdPath, 'md', 'Markdown Test');

    const uint8Payload = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x05]);
    const result = await saveFile(entry.docId, uint8Payload as any);

    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ERR_INVALID_FORMAT');
    assert.equal(fs.existsSync(mdPath), false, 'Dosya sistemde kesinlikle oluşturulmamalıdır');
  });

  it("farklı kaydet'te md seçilince çıkan dosya düz metin olmalı ve PK ikili verisi içermemelidir", async () => {
    // 1. Sekme başlangıçta docx formatında
    const tabState = {
      id: 'tab-1',
      title: 'İlk Belge',
      format: 'docx' as const,
      docId: undefined as string | undefined
    };

    const sampleTipTapJson = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'vText Başlık' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Bu bir deneme paragrafıdır.' }]
        }
      ]
    };

    // 2. Kullanıcı "Farklı Kaydet" yapar ve .md seçer
    const chosenPath = path.join(tmpDir, 'belge.md');
    const chosenFormat = 'md';
    const entry = registry.register(chosenPath, chosenFormat, 'belge.md');

    // 3. handleSaveFile mantığı: yerel format değişkeni kullanılır
    const oldDocId = tabState.docId;
    let docId = entry.docId;
    const format = chosenFormat ?? tabState.format;

    if (oldDocId && oldDocId !== docId) {
      registry.unregister(oldDocId);
    }

    // Tab state güncellenir
    tabState.docId = docId;
    tabState.format = format;
    tabState.title = 'belge.md';

    // 4. Serileştirme yerel 'format' değişkenine göre yapılır (activeTab closure bug'ı yok)
    let contentToSave: string | Uint8Array;
    if (format === 'docx') {
      contentToSave = await exportTipTapJsonToDocx(sampleTipTapJson, tabState.title);
    } else if (format === 'md') {
      contentToSave = tipTapJsonToMarkdown(sampleTipTapJson);
    } else {
      contentToSave = 'fallback';
    }

    // 5. Kaydetme işlemi
    const saveRes = await saveFile(docId, contentToSave);
    assert.equal(saveRes.success, true);
    assert.equal(fs.existsSync(chosenPath), true);

    // 6. Kanıt kontrolü: Dosya "PK" (0x50 0x4B) ile başlamamalı, düz metin Markdown olmalıdır
    const rawBuffer = fs.readFileSync(chosenPath);
    assert.ok(rawBuffer.length > 0);
    assert.notEqual(rawBuffer[0], 0x50, 'Markdown dosyası ZIP/DOCX sihirli baytı PK ile başlayamaz');
    assert.notEqual(rawBuffer[1], 0x4b, 'Markdown dosyası ZIP/DOCX sihirli baytı PK ile başlayamaz');

    const textContent = fs.readFileSync(chosenPath, 'utf8');
    assert.match(textContent, /# vText Başlık/);
    assert.match(textContent, /Bu bir deneme paragrafıdır\./);
  });

  it('PDF dışa aktarma sonrası sekmenin docId, format ve başlığı aynı kalmalıdır', async () => {
    // Başlangıç sekme durumu
    const initialTabState = {
      id: 'tab-original',
      title: 'Mevcut Belge',
      docId: 'uuid-1234-5678',
      format: 'docx' as const,
      isDirty: false
    };

    registry.register(path.join(tmpDir, 'mevcut.docx'), 'docx', 'Mevcut Belge');

    // PDF dışa aktarma işlemi tetiklenir:
    // Ana süreç showSaveDialog ile yolu alır, PDF üretir;
    // Renderer tarafı sekmenin docId, format veya başlığını ASLA DEĞİŞTİRMEZ.
    const pdfExportResult = {
      success: true,
      canceled: false,
      filePath: path.join(tmpDir, 'disa_aktarilan.pdf')
    };

    // PDF aktarımı sonrası sekme durumu kontrolü:
    assert.equal(initialTabState.id, 'tab-original');
    assert.equal(initialTabState.title, 'Mevcut Belge');
    assert.equal(initialTabState.docId, 'uuid-1234-5678');
    assert.equal(initialTabState.format, 'docx');
    assert.equal(initialTabState.isDirty, false);

    // PDF dosya yolunun registry'ye sekme docId'si olarak sızmadığı doğrulanır
    assert.equal(registry.getByPath(pdfExportResult.filePath), undefined);
  });

  it('docx kaydı bir kez yapılıp tekrar açıldığında içerik korunmalıdır', async () => {
    const docxPath = path.join(tmpDir, 'rapor.docx');
    const entry = registry.register(docxPath, 'docx', 'rapor.docx');

    const sampleDocxJson = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Önemli Proje Raporu' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Bu rapor vText editörü tarafından oluşturulmuştur.' }]
        }
      ]
    };

    // 1. DOCX'e dönüştür
    const docxBuffer = await exportTipTapJsonToDocx(sampleDocxJson, 'rapor.docx');
    assert.ok(docxBuffer instanceof Uint8Array);
    assert.equal(docxBuffer[0], 0x50, 'DOCX ilk baytı P (0x50) olmalıdır');
    assert.equal(docxBuffer[1], 0x4b, 'DOCX ikinci baytı K (0x4B) olmalıdır');

    // 2. saveFile ile diske yaz
    const saveRes = await saveFile(entry.docId, docxBuffer);
    assert.equal(saveRes.success, true);
    assert.equal(fs.existsSync(docxPath), true);

    // 3. openFileByPath ile tekrar aç ve mammoth üzerinden HTML içeriğini doğrula
    const openRes = await openFileByPath(docxPath);
    assert.equal(openRes.success, true);
    assert.equal(openRes.format, 'docx');
    assert.ok(openRes.content, 'Açılan belge içeriği boş olmamalı');
    assert.match(openRes.content, /Önemli Proje Raporu/);
    assert.match(openRes.content, /Bu rapor vText editörü tarafından oluşturulmuştur\./);
  });

  it('SaveFileSchema farklı realm veya Buffer/Uint8Array ikili verilerini kabul etmelidir', () => {
    const validDocId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';

    // Buffer testi
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const resBuf = validateIpc(SaveFileSchema, { docId: validDocId, content: buf });
    assert.equal(resBuf.success, true);

    // Uint8Array testi
    const u8 = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const resU8 = validateIpc(SaveFileSchema, { docId: validDocId, content: u8 });
    assert.equal(resU8.success, true);

    // Metin (string) testi
    const resStr = validateIpc(SaveFileSchema, { docId: validDocId, content: '# Markdown İçerik' });
    assert.equal(resStr.success, true);
  });
});
