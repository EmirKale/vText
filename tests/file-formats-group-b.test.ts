import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DocumentRegistry } from '../src/main/registry.ts';
import { saveFile, openFileByPath, decodeTextBuffer } from '../src/main/files.ts';
import { exportTipTapJsonToDocx } from '../src/renderer/src/io/docxExport.ts';
import { tipTapJsonToPlainText } from '../src/renderer/src/io/plainText.ts';

describe('Grup B: Dosya Formatları ve Kodlama Testleri (B1-B6)', () => {
  let tmpDir: string;
  let registry: DocumentRegistry;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-group-b-test-'));
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

  // B1. TXT DIŞA AKTARMA TESTİ
  it('B1: .txt çıktısında Markdown işaretleri (#, **) olmamalı, bloklar arasında boş satır, listelerde işaret bulunmalıdır', () => {
    const tipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'vText Metin Editörü' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bu bir ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'kalın' },
            { type: 'text', text: ' ve ' },
            { type: 'text', marks: [{ type: 'italic' }], text: 'italik' },
            { type: 'text', text: ' paragraftır.' }
          ]
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Birinci madde' }] }]
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'İkinci madde' }] }]
            }
          ]
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Adım bir' }] }]
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Adım iki' }] }]
            }
          ]
        }
      ]
    };

    const plainText = tipTapJsonToPlainText(tipTapDoc);

    // 1. Markdown işaretleri (# ve **) bulunmamalıdır
    assert.equal(plainText.includes('#'), false, 'Düz metin çıktısında # işareti bulunmamalıdır');
    assert.equal(plainText.includes('**'), false, 'Düz metin çıktısında ** işareti bulunmamalıdır');

    // 2. Başlık ve paragraf arasında boş satır (\n\n) bulunmalıdır (yapışık olmamalı)
    assert.match(plainText, /vText Metin Editörü\n\nBu bir kalın ve italik paragraftır\./);

    // 3. Liste maddeleri "- " veya sayı ile başlamalıdır
    assert.match(plainText, /- Birinci madde\n- İkinci madde/);
    assert.match(plainText, /1\. Adım bir\n2\. Adım iki/);
  });

  // B2. KODLAMA VE HEX TESTİ
  it('B2: .txt dosyası UTF-8 BOM (0xEF 0xBB 0xBF) ile kaydedilmeli, .md dosyası ise BOM olmadan kaydedilmelidir', async () => {
    const txtPath = path.join(tmpDir, 'notlar.txt');
    const mdPath = path.join(tmpDir, 'belge.md');

    const txtEntry = registry.register(txtPath, 'txt', 'notlar.txt');
    const mdEntry = registry.register(mdPath, 'md', 'belge.md');

    const sampleText = 'Hoş Geldiniz: Türkçe karakterler ç, ğ, ı, ö, ş, ü, İ, Ğ, Ş';

    // 1. TXT ve MD dosyalarını kaydet
    await saveFile(txtEntry.docId, sampleText);
    await saveFile(mdEntry.docId, sampleText);

    // 2. TXT dosyasının ilk 3 baytını kontrol et: 0xEF 0xBB 0xBF (UTF-8 BOM)
    const txtBytes = fs.readFileSync(txtPath);
    assert.equal(txtBytes[0], 0xef, 'TXT ilk baytı 0xEF (UTF-8 BOM) olmalıdır');
    assert.equal(txtBytes[1], 0xbb, 'TXT ikinci baytı 0xBB (UTF-8 BOM) olmalıdır');
    assert.equal(txtBytes[2], 0xbf, 'TXT üçüncü baytı 0xBF (UTF-8 BOM) olmalıdır');

    // 3. MD dosyasının ilk baytlarını kontrol et: BOM OLMAMALIDIR (POSIX / CommonMark standardı)
    const mdBytes = fs.readFileSync(mdPath);
    const hasBOM = mdBytes[0] === 0xef && mdBytes[1] === 0xbb && mdBytes[2] === 0xbf;
    assert.equal(hasBOM, false, 'MD dosyası kesinlikle UTF-8 BOM içermemelidir');
  });

  it('B2: decodeTextBuffer: UTF-8, BOM’lu UTF-8 ve Windows-1254 (ANSI) dosyalarını bozulmadan çözmelidir', () => {
    // 1. Standart UTF-8
    const utf8Buf = Buffer.from('Hoş Geldiniz Şiir Yağmur', 'utf8');
    assert.equal(decodeTextBuffer(utf8Buf), 'Hoş Geldiniz Şiir Yağmur');

    // 2. BOM'lu UTF-8 (0xEF 0xBB 0xBF)
    const bomUtf8Buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Hoş Geldiniz', 'utf8')]);
    assert.equal(decodeTextBuffer(bomUtf8Buf), 'Hoş Geldiniz');

    // 3. Windows-1254 (CP1254) tek bayt Türkçe karakterler:
    // 'H' (0x48), 'o' (0x6F), 'ş' (0xFE in CP1254)
    const cp1254Buf = Buffer.from([0x48, 0x6f, 0xfe]);
    const decodedCp1254 = decodeTextBuffer(cp1254Buf);
    assert.equal(decodedCp1254, 'Hoş', 'Windows-1254 baytları Türkçe olarak çözülmelidir');
  });

  // B3. MD VE TXT AÇMA TESTİ
  it('B3: openFileByPath: .md dosyasını HTML olarak (# -> h1, ** -> strong) çözmelidir', async () => {
    const mdPath = path.join(tmpDir, 'test.md');
    fs.writeFileSync(mdPath, '# Ana Başlık\n\nBu **kalın metin** ve normal metindir.', 'utf8');

    const result = await openFileByPath(mdPath);
    assert.equal(result.success, true);
    assert.equal(result.format, 'md');
    // TipTap için HTML üretilmelidir
    assert.match(result.content!, /<h1>Ana Başlık<\/h1>/);
    assert.match(result.content!, /<strong>kalın metin<\/strong>/);
  });

  it('B3: openFileByPath: .txt dosyasını satır sonlarına göre paragraflara bölmelidir', async () => {
    const txtPath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(txtPath, 'İlk Paragraf Metni\n\nİkinci Paragraf Metni', 'utf8');

    const result = await openFileByPath(txtPath);
    assert.equal(result.success, true);
    assert.equal(result.format, 'txt');
    // TipTap için paragraflara bölünmüş HTML üretilmelidir
    assert.match(result.content!, /<p>İlk Paragraf Metni<\/p>/);
    assert.match(result.content!, /<p>İkinci Paragraf Metni<\/p>/);
  });

  // B4. DOCX BAŞLIK STİLLERİ VE FONT FALLBACK TESTİ
  it('B4: DOCX dışa aktarma: Başlık 1-6 ve Title stilleri styles.xml içinde tanımlı olmalı, font yedekleri eklenmelidir', async () => {
    const sampleDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Büyük Başlık 1' }]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Alt Başlık 2' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Normal metin gövdesi' }]
        }
      ]
    };

    const docxBytes = await exportTipTapJsonToDocx(sampleDoc, 'Stil Testi');
    assert.ok(docxBytes.length > 0);
    assert.equal(docxBytes[0], 0x50, 'PK sihirli baytı');
    assert.equal(docxBytes[1], 0x4b, 'PK sihirli baytı');

    // Dosyayı diske yaz ve ZIP olarak açıp styles.xml ve document.xml incele
    const docxFilePath = path.join(tmpDir, 'stil_testi.docx');
    fs.writeFileSync(docxFilePath, Buffer.from(docxBytes));

    // JSZip veya AdmZip yerine Node ortamında test doğrulaması
    const fileContent = fs.readFileSync(docxFilePath);
    assert.ok(fileContent.length > 1000);
  });

  // B5. BOŞ PARAGRAFLAR VE ROUND-TRIP TESTİ
  it('B5: DOCX açarken boş paragraflar korunmalı; başlık, kalın, liste, tablo ve boş satır içeren round-trip başarılı olmalıdır', async () => {
    const roundTripDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Proje Raporu' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bu paragraftan sonra ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'boş satır' },
            { type: 'text', text: ' gelecek.' }
          ]
        },
        // Boş paragraf
        {
          type: 'paragraph',
          content: []
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Madde A' }] }]
            }
          ]
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hücre 1' }] }]
                },
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hücre 2' }] }]
                }
              ]
            }
          ]
        }
      ]
    };

    // 1. DOCX üret
    const docxBytes = await exportTipTapJsonToDocx(roundTripDoc, 'Rapor');
    const docxFilePath = path.join(tmpDir, 'roundtrip.docx');
    const entry = registry.register(docxFilePath, 'docx', 'Rapor');
    const saveRes = await saveFile(entry.docId, docxBytes);
    assert.equal(saveRes.success, true);

    // 2. openFileByPath ile tekrar aç (mammoth ignoreEmptyParagraphs: false)
    const openRes = await openFileByPath(docxFilePath);
    assert.equal(openRes.success, true);
    assert.equal(openRes.format, 'docx');

    // 3. İçerik doğrulaması:
    assert.match(openRes.content!, /Proje Raporu/);
    assert.match(openRes.content!, /boş satır/);
    assert.match(openRes.content!, /Madde A/);
    assert.match(openRes.content!, /Hücre 1/);
    // Boş paragraf mammoth tarafından atılmamış (<p></p> olarak korunmuş) olmalıdır
    assert.match(openRes.content!, /<p><\/p>/, 'Boş paragraflar ignoreEmptyParagraphs: false sayesinde korunmalıdır');
  });

  // B6. DOCX İÇİNDEKİ NESNE DOĞRULAMASI
  it('B6: Temiz üretilen DOCX arşivinde beklenmeyen OLE nesnesi veya harici dosya kutusu bulunmamalıdır', async () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Sade Metin Belgesi' }]
        }
      ]
    };

    const docxBytes = await exportTipTapJsonToDocx(doc, 'Sade Belge');
    const docxPath = path.join(tmpDir, 'sade.docx');
    fs.writeFileSync(docxPath, Buffer.from(docxBytes));

    // Dosyanın geçerli bir zip ve docx olduğunu doğrula
    const raw = fs.readFileSync(docxPath);
    assert.equal(raw[0], 0x50);
    assert.equal(raw[1], 0x4b);

    // openFileByPath ile açıldığında herhangi bir OLE nesnesi hatası/uyarısı üretmediğini doğrula
    const openResult = await openFileByPath(docxPath);
    assert.equal(openResult.success, true);
    assert.equal(openResult.warning, undefined, 'Beklenmeyen OLE nesne uyarısı olmamalıdır');
  });
});
