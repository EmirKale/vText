import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import JSZip from 'jszip';
import { exportTipTapJsonToDocx } from '../src/renderer/src/io/docxExport.ts';

const SOFFICE = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

// 3 satırlık bir paragraf içeren örnek TipTap JSON (12pt Calibri)
const sampleDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Bu bir deneme paragrafıdır. Satır aralığı birimlerinin Word, LibreOffice ve vText arasındaki uyumunu ölçmek amacıyla ardışık satırlar oluşturulmuştur. Her satırın taban çizgisi (baseline) yüksekliği PyMuPDF aracılığıyla hassas biçimde tespit edilmektedir.'
        }
      ]
    }
  ]
};

async function main() {
  const scratchDir = path.resolve('scratch_i1');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  // 1. DOCX üret
  const docxBuf = await exportTipTapJsonToDocx(sampleDoc, 'I1_Measurement');
  const docxPath = path.join(scratchDir, 'vtext_sample.docx');
  fs.writeFileSync(docxPath, docxBuf);

  // 2. docx styles.xml incele
  const zip = await JSZip.loadAsync(docxBuf);
  const stylesXml = await zip.file('word/styles.xml').async('string');
  const docDefaultsSpacing = stylesXml.match(/<w:docDefaults>[\s\S]*?<w:spacing\b[^>]*\/>[\s\S]*?<\/w:docDefaults>/)?.[0] || 'yok';
  const normalStyleSpacing = stylesXml.match(/<w:style[^>]*w:styleId="Normal"[\s\S]*?<w:spacing\b[^>]*\/>[\s\S]*?<\/w:style>/)?.[0] || 'yok';

  console.log('=== HAM XML: styles.xml docDefaults ===');
  console.log(docDefaultsSpacing);
  console.log('=== HAM XML: styles.xml Normal Stili ===');
  console.log(normalStyleSpacing);

  // 3. LibreOffice ile DOCX -> PDF dönüştür
  execSync(`"${SOFFICE}" --headless --convert-to pdf --outdir "${scratchDir}" "${docxPath}"`);
  const loPdfPath = path.join(scratchDir, 'vtext_sample.pdf');

  // 4. PyMuPDF ile satırların baseline (veya y koordinatları) farkını ölç
  const pyFilePath = path.join(scratchDir, 'measure.py');
  const pyCode = `import fitz

def measure_baselines(pdf_path):
    doc = fitz.open(pdf_path)
    page = doc[0]
    blocks = page.get_text('words')
    lines = {}
    for w in blocks:
        line_id = w[6]
        if line_id not in lines:
            lines[line_id] = []
        lines[line_id].append(w[3]) # y1 is bottom / baseline
    
    y_baselines = [sum(vals)/len(vals) for line_id, vals in sorted(lines.items())]
    diffs = [y_baselines[i+1] - y_baselines[i] for i in range(len(y_baselines)-1)]
    return y_baselines, diffs

baselines, diffs = measure_baselines(r'${loPdfPath.replace(/\\/g, '\\\\')}')
print('LibreOffice PDF Baselines (pt):', [round(b, 2) for b in baselines])
print('LibreOffice PDF Step (pt):', [round(d, 2) for d in diffs])
avg_diff = sum(diffs)/len(diffs) if diffs else 0
print('LibreOffice PDF Ortalamasi (pt):', round(avg_diff, 2))
`;
  fs.writeFileSync(pyFilePath, pyCode);
  const pyOut = execSync(`py "${pyFilePath}"`, { encoding: 'utf8' });
  console.log(pyOut);

  // 5. Editör satır adımı hesabı:
  // Editörde 12pt yazı boyutu, 16px (12pt = 16px @ 96DPI)
  // CSS line-height: 1.4 -> satır kutusu yüksekliği = 16px * 1.4 = 22.4 px
  // pt cinsinden: 22.4 px * (72 / 96) = 22.4 * 0.75 = 16.8 pt
  console.log('=== EDİTÖR SATIR ADIMI HESABI ===');
  console.log('Editör CSS font-size: 16px (12pt)');
  console.log('Editör CSS line-height: 1.4');
  console.log('Editör Satır Adımı: 16px * 1.4 = 22.4 px');
  console.log('Editör Satır Adımı (pt): 22.4 px * 0.75 = 16.80 pt');

  fs.rmSync(scratchDir, { recursive: true, force: true });
}

main().catch(console.error);
