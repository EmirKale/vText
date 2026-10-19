import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const fixturesDir = path.resolve('tests/fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

const soffice = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

// 1. libreoffice-gui-test.docx: Başlık, 3 maddelik numaralı liste, 3x3 başlıksız tablo
const html1 = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <h1>Test Belgesi Başlığı</h1>
  <ol>
    <li>Numaralı Adım 1</li>
    <li>Numaralı Adım 2</li>
    <li>Numaralı Adım 3</li>
  </ol>
  <table>
    <tr><td>Hücre 1-1</td><td>Hücre 1-2</td><td>Hücre 1-3</td></tr>
    <tr><td>Hücre 2-1</td><td>Hücre 2-2</td><td>Hücre 2-3</td></tr>
    <tr><td>Hücre 3-1</td><td>Hücre 3-2</td><td>Hücre 3-3</td></tr>
  </table>
</body>
</html>`;

const tmpHtml1 = path.join(fixturesDir, 'temp1.html');
fs.writeFileSync(tmpHtml1, html1, 'utf-8');
execSync(`"${soffice}" --headless --convert-to docx "${tmpHtml1}" --outdir "${fixturesDir}"`);
fs.unlinkSync(tmpHtml1);
const targetDocx1 = path.join(fixturesDir, 'libreoffice-gui-test.docx');
if (fs.existsSync(targetDocx1)) fs.unlinkSync(targetDocx1);
fs.renameSync(path.join(fixturesDir, 'temp1.docx'), targetDocx1);
console.log('1. Created libreoffice-gui-test.docx:', fs.existsSync(targetDocx1));

// 2. Grup 4 için test dosyaları:
// a) 0 baytlık .docx
fs.writeFileSync(path.join(fixturesDir, 'zero-byte.docx'), Buffer.alloc(0));

// b) ZIP olmayan düz metin .docx
fs.writeFileSync(path.join(fixturesDir, 'plain-text.docx'), 'Bu dosya aslında düz metindir, zip veya docx değildir.', 'utf-8');

// c) İkili .doc biçimini .docx uzantısına çevrilmiş dosya (Word 97-2004 OLE compound file header: D0 CF 11 E0)
const fakeDoc = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
fs.writeFileSync(path.join(fixturesDir, 'fake-doc.docx'), fakeDoc);

// d) ODT biçimini .docx uzantısına çevrilmiş dosya (LibreOffice ile gerçek bir ODT üret ve .docx uzantısıyla kaydet)
const tmpOdtHtml = path.join(fixturesDir, 'temp_odt.html');
fs.writeFileSync(tmpOdtHtml, '<p>ODT Metni</p>', 'utf-8');
execSync(`"${soffice}" --headless --convert-to odt "${tmpOdtHtml}" --outdir "${fixturesDir}"`);
fs.unlinkSync(tmpOdtHtml);
const fakeOdtDocx = path.join(fixturesDir, 'odt-as-docx.docx');
if (fs.existsSync(fakeOdtDocx)) fs.unlinkSync(fakeOdtDocx);
fs.renameSync(path.join(fixturesDir, 'temp_odt.odt'), fakeOdtDocx);

// e) ~$ ile başlayan kilit / geçici Word dosyası (lock file)
fs.writeFileSync(path.join(fixturesDir, '~$lock-file.docx'), 'Owner file lock content', 'utf-8');

// f) Bozuk (kesik) ZIP .docx
const validDocxBuf = fs.readFileSync(targetDocx1);
// İlk 100 baytını alarak kesik/bozuk zip oluştur
fs.writeFileSync(path.join(fixturesDir, 'corrupt-truncated.docx'), validDocxBuf.subarray(0, 100));

console.log('All test fixtures created successfully under tests/fixtures/');
