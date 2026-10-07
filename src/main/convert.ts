import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

let cachedPandoc: boolean | null = null;
let cachedLibreOffice: boolean | null = null;
let libreOfficePath: string = 'soffice';

export async function detectTools(): Promise<{ hasPandoc: boolean; hasLibreOffice: boolean }> {
  // 1. Detect Pandoc
  if (cachedPandoc === null) {
    try {
      await execFileAsync('pandoc', ['--version']);
      cachedPandoc = true;
    } catch {
      cachedPandoc = false;
    }
  }

  // 2. Detect LibreOffice
  if (cachedLibreOffice === null) {
    try {
      await execFileAsync('soffice', ['--version']);
      cachedLibreOffice = true;
      libreOfficePath = 'soffice';
    } catch {
      // Check common Windows paths
      const commonPaths = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
      ];
      let found = false;
      for (const p of commonPaths) {
        if (fs.existsSync(p)) {
          cachedLibreOffice = true;
          libreOfficePath = p;
          found = true;
          break;
        }
      }
      if (!found) {
        cachedLibreOffice = false;
      }
    }
  }

  return {
    hasPandoc: cachedPandoc,
    hasLibreOffice: cachedLibreOffice
  };
}

export async function convertWithPandocOrLibreOffice(
  inputPath: string,
  targetFormat: 'docx' | 'odt' | 'rtf'
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  const tools = await detectTools();
  const tempDir = os.tmpdir();
  const ext = path.extname(inputPath).toLowerCase();

  // If input is .doc (binary), only LibreOffice can convert it
  if (ext === '.doc' || tools.hasLibreOffice) {
    if (!tools.hasLibreOffice) {
      return {
        success: false,
        error: 'Eski .doc dosyalarını dönüştürmek için LibreOffice gereklidir.'
      };
    }

    try {
      // soffice --headless --convert-to docx --outdir <tempDir> <inputPath>
      await execFileAsync(libreOfficePath, [
        '--headless',
        '--convert-to',
        targetFormat,
        '--outdir',
        tempDir,
        inputPath
      ]);

      const baseName = path.basename(inputPath, ext);
      const generatedPath = path.join(tempDir, `${baseName}.${targetFormat}`);

      if (fs.existsSync(generatedPath)) {
        return { success: true, outputPath: generatedPath };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // If Pandoc is available
  if (tools.hasPandoc) {
    try {
      const baseName = path.basename(inputPath, ext);
      const generatedPath = path.join(tempDir, `${baseName}.${targetFormat}`);

      await execFileAsync('pandoc', [
        inputPath,
        '-o',
        generatedPath
      ]);

      if (fs.existsSync(generatedPath)) {
        return { success: true, outputPath: generatedPath };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return {
    success: false,
    error: `${ext.toUpperCase()} dosya formatını dönüştürmek için bilgisayarınızda Pandoc veya LibreOffice kurulu olmalıdır.`
  };
}
