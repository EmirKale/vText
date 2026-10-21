import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const sofficePath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
const fixturesDir = path.resolve('tests', 'fixtures');
const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <h1 style="text-align: center;">Ortalanmis Baslik Testi</h1>
  <p>Gövde metninde <em>Emphasis Italik Vurgusu</em> bulunmaktadir.</p>
  <ul>
    <li>Madde Seviye Bir
      <ul>
        <li>Madde Seviye Iki
          <ul>
            <li>Madde Seviye Uc</li>
          </ul>
        </li>
      </ul>
    </li>
  </ul>
</body>
</html>`;

const htmlPath = path.join(fixturesDir, 'scenario15-fixture.html');
fs.writeFileSync(htmlPath, htmlContent, 'utf8');

execFileSync(sofficePath, [
  '--headless',
  '--convert-to',
  'docx:Office Open XML Text',
  '--outdir',
  fixturesDir,
  htmlPath
]);

const generatedDocx = path.join(fixturesDir, 'scenario15-fixture.docx');
console.log('Generated scenario15-fixture.docx:', fs.existsSync(generatedDocx));
