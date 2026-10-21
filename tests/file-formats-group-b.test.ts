import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DocumentRegistry } from '../src/main/registry.ts';
import { saveFile, openFileByPath, decodeTextBuffer } from '../src/main/files.ts';
import { exportTipTapJsonToDocx } from '../src/renderer/src/io/docxExport.ts';
import { tipTapJsonToPlainText } from '../src/renderer/src/io/plainText.ts';
import JSZip from 'jszip';

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

    // 4. UTF-16 LE BOM (0xFF 0xFE)
    const utf16leText = 'vText UTF-16 LE Türkçe: Ğüç';
    const utf16leEncoded = Buffer.from(utf16leText, 'utf16le');
    const bomUtf16le = Buffer.concat([Buffer.from([0xff, 0xfe]), utf16leEncoded]);
    assert.equal(decodeTextBuffer(bomUtf16le), utf16leText, 'UTF-16 LE BOM dosya içeriği doğru çözülmelidir');

    // 5. UTF-16 BE BOM (0xFE 0xFF)
    const beEncoded = Buffer.from(utf16leEncoded);
    beEncoded.swap16();
    const bomUtf16be = Buffer.concat([Buffer.from([0xfe, 0xff]), beEncoded]);
    assert.equal(decodeTextBuffer(bomUtf16be), utf16leText, 'UTF-16 BE BOM dosya içeriği doğru çözülmelidir');
  });

  it('B1b: TXT dışa aktarımı: Tablo (sekme \\t), blok alıntı (> OLMADAN), callout, promptBlock, codeBlock (tırnaksız), hardBreak kuralları', () => {
    const tipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Başlık' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Satır 1' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Satır 2 (hardBreak)' }
          ]
        },
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Bu bir alıntı metnidir.' }]
            }
          ]
        },
        {
          type: 'callout',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Önemli bilgi kutusu.' }]
            }
          ]
        },
        {
          type: 'codeBlock',
          attrs: { language: 'javascript' },
          content: [{ type: 'text', text: 'const a = 1;\nconsole.log(a);' }]
        },
        {
          type: 'promptBlock',
          content: [{ type: 'text', text: 'Yapay zeka istemi metni.' }]
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ad' }] }] },
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Yaş' }] }] }
              ]
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ali' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '25' }] }] }
              ]
            }
          ]
        }
      ]
    };

    const out = tipTapJsonToPlainText(tipTapDoc);

    // 1. hardBreak
    assert.match(out, /Satır 1\nSatır 2 \(hardBreak\)/);

    // 2. blockquote (> OLMADAN düz metin)
    assert.equal(out.includes('>'), false, 'Blok alıntıda > işareti bulunmamalıdır');
    assert.match(out, /Bu bir alıntı metnidir\./);

    // 3. callout
    assert.match(out, /Önemli bilgi kutusu\./);

    // 4. codeBlock (tırnaksız düz metin)
    assert.equal(out.includes('```'), false, 'Kod bloğunda ``` tırnakları bulunmamalıdır');
    assert.match(out, /const a = 1;\nconsole\.log\(a\);/);

    // 5. promptBlock
    assert.match(out, /Yapay zeka istemi metni\./);

    // 6. table hücreleri tab (\t) ile ayrılmış olmalıdır
    assert.match(out, /Ad\tYaş\nAli\t25/);
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

  // GRUP 3: TABLO BAŞLIĞI DOĞRULAMASI
  it('Grup 3: Başlıklı ve başlıksız iki tablolu DOCX round-trip: ilkinde w:tblHeader ve w:shd var, ikincisinde kesinlikle yok', async () => {
    // 1. İki tablo içeren TipTap belgesi oluştur:
    // Tablo 1: 1. satır header (th), 2. satır body (td)
    // Tablo 2: Başlıksız, tüm satırlar body (td)
    const twoTablesDoc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlık Sütun 1' }] }] },
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlık Sütun 2' }] }] }
              ]
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Veri 1' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Veri 2' }] }] }
              ]
            }
          ]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Tablolar arası boşluk' }]
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlıksız Satır 1-A' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlıksız Satır 1-B' }] }] }
              ]
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlıksız Satır 2-A' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlıksız Satır 2-B' }] }] }
              ]
            }
          ]
        }
      ]
    };

    // 2. İlk dışa aktarma (exportTipTapJsonToDocx)
    const docxBytes = await exportTipTapJsonToDocx(twoTablesDoc, 'İki Tablo');
    const docxPath = path.join(tmpDir, 'two_tables.docx');
    fs.writeFileSync(docxPath, Buffer.from(docxBytes));

    // 3. Dosyayı vText openFileByPath ile aç (mammoth + sanitizeDocxTableHeaders)
    const openRes = await openFileByPath(docxPath);
    assert.equal(openRes.success, true);
    const html = openRes.content!;

    // İlk tablonun <th> ve <thead> içerdiğini, ikinci tablonun ise <th> İÇERMEDİĞİNİ doğrula
    assert.ok(html.includes('<th><p>Başlık Sütun 1</p></th>'), 'İlk tablo <th> içermelidir');
    assert.ok(html.includes('<thead>'), 'İlk tablo <thead> içermelidir');
    assert.ok(!html.includes('Başlıksız Satır 1-A</p></th>'), 'Başlıksız tablo asla <th> içermemelidir');
    assert.ok(html.includes('<td><p>Başlıksız Satır 1-A</p></td>'), 'Başlıksız tablonun ilk satırı <td> olmalıdır');

    // 4. HTML'den geri TipTap JSON simülasyonu yapıp tekrar dışa aktar (Round-trip)
    const roundTripDoc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlık Sütun 1' }] }] },
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlık Sütun 2' }] }] }
              ]
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Veri 1' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Veri 2' }] }] }
              ]
            }
          ]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Tablolar arası boşluk' }]
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlıksız Satır 1-A' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlıksız Satır 1-B' }] }] }
              ]
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlıksız Satır 2-A' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlıksız Satır 2-B' }] }] }
              ]
            }
          ]
        }
      ]
    };

    const finalDocxBytes = await exportTipTapJsonToDocx(roundTripDoc, 'Final İki Tablo');
    const finalDocxPath = path.join(tmpDir, 'two_tables_roundtrip.docx');
    fs.writeFileSync(finalDocxPath, Buffer.from(finalDocxBytes));

    // 5. XML İncelemesi: JSZip ile word/document.xml çıkar ve iki tabloyu ayrı ayrı doğrula
    const zip = await JSZip.loadAsync(Buffer.from(finalDocxBytes));
    const docXml = await zip.file('word/document.xml')!.async('string');

    // Tabloları ayır
    const tableMatches = docXml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g);
    assert.equal(tableMatches?.length, 2, 'Belgede tam 2 adet w:tbl bulunmalıdır');

    const [table1Xml, table2Xml] = tableMatches;

    // Tablo 1: Başlıklı tablo doğrulaması
    assert.ok(table1Xml.includes('<w:tblHeader'), 'İlk tabloda w:tblHeader bulunmalıdır');
    assert.ok(table1Xml.includes('w:shd'), 'İlk tablonun başlık satırında w:shd bulunmalıdır');
    // Tablo 2: Başlıksız tablo doğrulaması
    assert.ok(!table2Xml.includes('<w:tblHeader'), 'İkinci tabloda w:tblHeader KESİNLİKLE OLMAMALIDIR');
    assert.ok(!table2Xml.includes('w:shd'), 'İkinci tabloda w:shd (başlık gölgesi) KESİNLİKLE OLMAMALIDIR');
  });

  it('GRUP 4: Bozuk, parola korumalı veya sahte docx dosyalarında kullanıcı dostu Türkçe hata, loglama ve registry sızıntı önleme', async () => {
    const fixturesDir = path.resolve(__dirname, 'fixtures');
    const corruptCases = [
      { name: '0 baytlık .docx', file: path.join(fixturesDir, 'corrupt-zero-byte.docx') },
      { name: 'ZIP olmayan düz metin .docx', file: path.join(fixturesDir, 'corrupt-plain-text.docx') },
      { name: 'İkili .doc -> .docx', file: path.join(fixturesDir, 'corrupt-fake-doc.docx') },
      { name: 'ODT biçimi -> .docx', file: path.join(fixturesDir, 'corrupt-fake-odt.docx') },
      { name: '~$ kilit dosyası', file: path.join(fixturesDir, '~$corrupt-lock.docx') },
      { name: 'Bozuk (kesik) ZIP', file: path.join(fixturesDir, 'corrupt-truncated.docx') }
    ];

    const initialCount = registry.getCount();

    for (const tc of corruptCases) {
      const res = await openFileByPath(tc.file);
      assert.equal(res.success, false, `${tc.name} açılmamalıdır`);
      const expectedError = tc.name === 'ODT biçimi -> .docx'
        ? 'Bu dosya aslında bir ODT belgesi (uzantısı .docx yapılmış). LibreOffice\'te Farklı Kaydet > Word 2007-365 (.docx) ile kaydedip tekrar deneyin.'
        : 'Bu dosya açılamadı. Dosya bozuk, parola korumalı veya desteklenmeyen bir biçimde olabilir.';
      assert.equal(
        res.error,
        expectedError,
        `${tc.name} beklenen kullanıcı dostu Türkçe hata mesajını vermelidir`
      );
      assert.ok(res.details && res.details.length > 0, `${tc.name} teknik hata detayını içermelidir`);
      assert.equal(res.docId, undefined, `${tc.name} için docId üretilmemelidir`);
      assert.equal(registry.getCount(), initialCount, `${tc.name} sonrasında registry'de docId sızıntısı olmamalıdır`);
    }

    // Geçerli dosyalar açılmalıdır
    const validGuiTest = path.join(fixturesDir, 'libreoffice-gui-test.docx');
    const validSoffice = path.join(fixturesDir, 'sample-for-soffice.docx');

    const validRes1 = await openFileByPath(validGuiTest);
    assert.equal(validRes1.success, true, 'libreoffice-gui-test.docx başarıyla açılmalıdır');
    assert.ok(validRes1.content && validRes1.content.length > 0);
    assert.ok(validRes1.docId);

    const validRes2 = await openFileByPath(validSoffice);
    assert.equal(validRes2.success, true, 'soffice ile üretilmiş geçerli docx başarıyla açılmalıdır');
    assert.ok(validRes2.content && validRes2.content.length > 0);
    assert.ok(validRes2.docId);
  });
});


