import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { detectUnsupportedDocxFeatures } from '../src/main/docxFeatureDetector';
import { openFileByPath } from '../src/main/files';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('GRUP E: Kaybolacak İçerik Uyarısı & Desteklenmeyen Öğe Tespiti', () => {
  // Temel boş geçerli docx zip yapısı
  function createBaseDocxZip(documentXmlContent: string): JSZip {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${documentXmlContent}</w:body></w:document>`);
    return zip;
  }

  it('1. Temiz (öğesiz) belgede hiçbir uyarı verilmemelidir', async () => {
    const zip = createBaseDocxZip('<w:p><w:r><w:t>Düzgün metin</w:t></w:r></w:p>');
    const res = await detectUnsupportedDocxFeatures(zip);

    expect(res.hasUnsupported).toBe(false);
    expect(res.features).toHaveLength(0);
    expect(res.warningMessage).toBeUndefined();
  });

  it('2. Üstbilgi ve altbilgi içeren DOCX doğru tespit edilmelidir', async () => {
    const zip = createBaseDocxZip('<w:p><w:r><w:t>Gövde</w:t></w:r></w:p>');
    zip.file('word/header1.xml', '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Gizli Üstbilgi</w:t></w:r></w:p></w:hdr>');

    const res = await detectUnsupportedDocxFeatures(zip);
    expect(res.hasUnsupported).toBe(true);
    expect(res.features).toContain('üstbilgi/altbilgi');
    expect(res.warningMessage).toContain('üstbilgi/altbilgi');
  });

  it('3. Dipnot ve sonnot içeren DOCX doğru tespit edilmelidir (ayırıcılar hariç)', async () => {
    // Sadece ayırıcı içeren footnotes (kullanıcı notu yok) -> tespit edilmemeli
    const zipSep = createBaseDocxZip('<w:p><w:r><w:t>Gövde</w:t></w:r></w:p>');
    zipSep.file('word/footnotes.xml', '<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:type="separator" w:id="0"><w:p><w:r><w:separator/></w:r></w:p></w:footnote></w:footnotes>');
    const resSep = await detectUnsupportedDocxFeatures(zipSep);
    expect(resSep.features).not.toContain('dipnot/sonnot');

    // Gerçek kullanıcı dipnotu içeren -> tespit edilmeli
    const zipFn = createBaseDocxZip('<w:p><w:r><w:t>Gövde</w:t></w:r></w:p>');
    zipFn.file('word/footnotes.xml', '<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:id="1"><w:p><w:r><w:t>Bu bir dipnot metnidir</w:t></w:r></w:p></w:footnote></w:footnotes>');
    const resFn = await detectUnsupportedDocxFeatures(zipFn);
    expect(resFn.hasUnsupported).toBe(true);
    expect(resFn.features).toContain('dipnot/sonnot');
    expect(resFn.warningMessage).toContain('dipnot/sonnot');
  });

  it('4. Sayfa sonu (w:br w:type="page") içeren DOCX tespit edilmelidir', async () => {
    const zip = createBaseDocxZip('<w:p><w:r><w:t>Sayfa 1</w:t><w:br w:type="page"/><w:t>Sayfa 2</w:t></w:r></w:p>');
    const res = await detectUnsupportedDocxFeatures(zip);
    expect(res.hasUnsupported).toBe(true);
    expect(res.features).toContain('sayfa sonu');
    expect(res.warningMessage).toContain('sayfa sonu');
  });

  it('5. Yorumlar içeren DOCX tespit edilmelidir', async () => {
    const zip = createBaseDocxZip('<w:p><w:commentRangeStart w:id="0"/><w:r><w:t>Yorumlu metin</w:t></w:r><w:commentRangeEnd w:id="0"/></w:p>');
    zip.file('word/comments.xml', '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0"><w:p><w:r><w:t>Kullanıcı yorumu</w:t></w:r></w:p></w:comment></w:comments>');
    const res = await detectUnsupportedDocxFeatures(zip);
    expect(res.hasUnsupported).toBe(true);
    expect(res.features).toContain('yorumlar');
    expect(res.warningMessage).toContain('yorumlar');
  });

  it('6. Değişiklik izleme (w:ins / w:del) içeren DOCX tespit edilmelidir', async () => {
    const zip = createBaseDocxZip('<w:p><w:ins w:id="1" w:author="Ali"><w:r><w:t>Eklenen metin</w:t></w:r></w:ins></w:p>');
    const res = await detectUnsupportedDocxFeatures(zip);
    expect(res.hasUnsupported).toBe(true);
    expect(res.features).toContain('değişiklik izleme');
    expect(res.warningMessage).toContain('değişiklik izleme');
  });

  it('7. İçerik denetimleri (w:sdt) içeren DOCX tespit edilmelidir', async () => {
    const zip = createBaseDocxZip('<w:sdt><w:sdtPr/><w:sdtContent><w:p><w:r><w:t>Form alanı</w:t></w:r></w:p></w:sdtContent></w:sdt>');
    const res = await detectUnsupportedDocxFeatures(zip);
    expect(res.hasUnsupported).toBe(true);
    expect(res.features).toContain('içerik denetimleri');
    expect(res.warningMessage).toContain('içerik denetimleri');
  });

  it('8. Gömülü nesneler (w:object veya word/embeddings/) içeren DOCX tespit edilmelidir', async () => {
    const zip = createBaseDocxZip('<w:p><w:r><w:object><v:shape/></w:object></w:r></w:p>');
    zip.file('word/embeddings/oleObject1.bin', 'fake ole binary');
    const res = await detectUnsupportedDocxFeatures(zip);
    expect(res.hasUnsupported).toBe(true);
    expect(res.features).toContain('gömülü nesneler');
    expect(res.warningMessage).toContain('gömülü nesneler');
  });

  it('9. Birden fazla öğe içerdiğinde tüm öğeler tek uyarı mesajında toplanmalıdır ve tam dosya yolu sızmamalıdır', async () => {
    const zip = createBaseDocxZip('<w:p><w:r><w:t>Metin</w:t><w:br w:type="page"/></w:r><w:ins w:id="1"><w:r><w:t>Ek</w:t></w:r></w:ins></w:p>');
    zip.file('word/header1.xml', '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Başlık</w:t></w:r></w:p></w:hdr>');

    const res = await detectUnsupportedDocxFeatures(zip);
    expect(res.hasUnsupported).toBe(true);
    expect(res.features).toContain('üstbilgi/altbilgi');
    expect(res.features).toContain('sayfa sonu');
    expect(res.features).toContain('değişiklik izleme');

    const msg = res.warningMessage!;
    expect(msg).toMatch(/^Bu belgede vText'in henüz desteklemediği öğeler var/);
    expect(msg).toMatch(/Kaydederseniz bu öğeler kaybolabilir\. Orijinalin yedeği kaydetmeden önce alınır\.$/);
    expect(msg).not.toMatch(/[C-Z]:\\|\/home\/|\/tmp\//); // Dosya yolu sızmamalı
  });

  it('10. openFileByPath üzerinden gerçek docx dosyası açılırken unsupportedWarning üretilmelidir', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-docx-warn-'));
    try {
      const docxPath = path.join(tmpDir, 'uyarili.docx');
      const zip = createBaseDocxZip('<w:p><w:r><w:t>Gövde</w:t><w:br w:type="page"/></w:r></w:p>');
      zip.file('word/header1.xml', '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Üstbilgi Yazısı</w:t></w:r></w:p></w:hdr>');
      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(docxPath, buf);

      const openRes = await openFileByPath(docxPath);
      expect(openRes.success).toBe(true);
      expect(openRes.unsupportedWarning).toBeDefined();
      expect(openRes.unsupportedWarning).toContain('üstbilgi/altbilgi');
      expect(openRes.unsupportedWarning).toContain('sayfa sonu');
      expect(openRes.unsupportedFeatures).toEqual(expect.arrayContaining(['üstbilgi/altbilgi', 'sayfa sonu']));
      expect(openRes.unsupportedWarning).not.toContain(tmpDir); // Yol sızıntısı yok
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
