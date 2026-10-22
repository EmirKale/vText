import { describe, it, expect } from 'vitest';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { openFileByPath, normalizeMammothHtml, MAMMOTH_STYLE_MAP } from '../src/main/files';
import { exportTipTapJsonToDocx } from '../src/renderer/src/io/docxExport';
import { DocumentRegistry } from '../src/main/registry';

describe('Grup 5: İçe Aktarma Sadakati ve Biçim Koruma Testleri', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');

  // 5.2 (a) w:jc hizalama
  it('5.2 (a): doc1_alignment.docx açıldığında ortalanmış başlık, sağa ve iki yana yaslı paragraflar textAlign stiliyle korunmalıdır', async () => {
    DocumentRegistry.getInstance().clear();
    const docPath = path.join(fixturesDir, 'doc1_alignment.docx');
    assert.ok(fs.existsSync(docPath), 'doc1_alignment.docx mevcut olmalıdır');

    const result = await openFileByPath(docPath);
    assert.equal(result.success, true, 'Dosya başarıyla açılmalıdır');
    const html = result.content;

    // Ortalanmış başlık
    assert.match(
      html,
      /<h1[^>]*style="text-align:\s*center"[^>]*>Ortalanmış Başlık 1<\/h1>/i,
      'Ortalanmış Başlık 1 textAlign center stiline sahip olmalıdır'
    );

    // Sağa yaslı paragraf
    assert.match(
      html,
      /<p[^>]*style="text-align:\s*right"[^>]*>Bu sağa yaslı bir paragraftır\.<\/p>/i,
      'Sağa yaslı paragraf textAlign right stiline sahip olmalıdır'
    );

    // İki yana yaslı paragraf
    assert.match(
      html,
      /<p[^>]*style="text-align:\s*justify"[^>]*>Bu iki yana yaslı bir paragraftır/i,
      'İki yana yaslı paragraf textAlign justify stiline sahip olmalıdır'
    );
  });

  // 5.2 (b) Emphasis ve Strong karakter stilleri
  it('5.2 (b): doc4_run_styles.docx açıldığında Emphasis (em) ve Strong (strong) karakter stilleri korunmalıdır', async () => {
    DocumentRegistry.getInstance().clear();
    const docPath = path.join(fixturesDir, 'doc4_run_styles.docx');
    assert.ok(fs.existsSync(docPath), 'doc4_run_styles.docx mevcut olmalıdır');

    const result = await openFileByPath(docPath);
    assert.equal(result.success, true, 'Dosya başarıyla açılmalıdır');
    const html = result.content;

    assert.match(html, /<em>Emphasis stili<\/em>/i, 'Emphasis karakter stili em etiketi olarak korunmalıdır');
    assert.match(html, /<strong>Strong stili<\/strong>/i, 'Strong karakter stili strong etiketi olarak korunmalıdır');
  });

  // 5.2 (c) İç içe listeler (neden düzleştiği ve dışa aktarımda korunduğu)
  it('5.2 (c): 3 seviyeli iç içe madde işaretli ve numaralı liste dışa aktarıldığında w:ilvl 0, 1 ve 2 seviyeleri korunmalıdır (düzleşmemelidir)', async () => {
    const nestedListTipTap = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Madde Seviye 1' }] },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        { type: 'paragraph', content: [{ type: 'text', text: 'Madde Seviye 2' }] },
                        {
                          type: 'bulletList',
                          content: [
                            {
                              type: 'listItem',
                              content: [
                                { type: 'paragraph', content: [{ type: 'text', text: 'Madde Seviye 3' }] }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Numara Seviye 1' }] },
                {
                  type: 'orderedList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        { type: 'paragraph', content: [{ type: 'text', text: 'Numara Seviye 2' }] },
                        {
                          type: 'orderedList',
                          content: [
                            {
                              type: 'listItem',
                              content: [
                                { type: 'paragraph', content: [{ type: 'text', text: 'Numara Seviye 3' }] }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const docxBytes = await exportTipTapJsonToDocx(nestedListTipTap, 'Nested List Test');
    const zip = await JSZip.loadAsync(docxBytes);
    const docXml = await zip.file('word/document.xml')?.async('string');
    assert.ok(docXml, 'word/document.xml bulunmalıdır');

    const ilvlMatches = [...docXml.matchAll(/<w:ilvl\s+w:val="(\d+)"/g)].map((m) => m[1]);
    // Her iki liste için seviye 0, 1 ve 2 bulunmalı
    assert.ok(ilvlMatches.includes('0'), 'Seviye 0 bulunmalıdır');
    assert.ok(ilvlMatches.includes('1'), 'Seviye 1 bulunmalıdır (düzleşme yok)');
    assert.ok(ilvlMatches.includes('2'), 'Seviye 2 bulunmalıdır (3. seviye iç içe korundu)');
  });

  // 5.3 Bilinen sınırlar (test.todo)
  it.todo('5.3 Bilinen Sınır: DOCX serbest yazı tipi (w:rFonts) ve punto (w:sz) bilgisi Mammoth tasarım felsefesi gereği HTML aktarımında atılır');
  it.todo('5.3 Bilinen Sınır: Sayfa sonları (w:br type="page") ve üstbilgi/altbilgi Mammoth tarafından ayrıştırılmaz');
  it.todo('5.3 Bilinen Sınır: Dipnotlar ve sonnotlar TipTap şemasında karşılık bulmaz');
});
