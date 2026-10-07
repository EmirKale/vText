import { app, dialog, protocol, net, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mammoth from 'mammoth';
import { DocumentFormat, FileOpenResult, FileSaveResult } from '../shared/types';
import { convertWithPandocOrLibreOffice } from './convert';

export function getAssetsDir(): string {
  const dir = path.join(app.getPath('appData'), 'vText', 'assets');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function registerKalemAssetProtocol(): void {
  const handleAsset = async (request: Request) => {
    try {
      const parsedUrl = new URL(request.url);
      const filename = parsedUrl.hostname ? `${parsedUrl.hostname}${parsedUrl.pathname}` : parsedUrl.pathname.replace(/^\//, '');
      const safeFilename = path.basename(filename);
      const filePath = path.join(getAssetsDir(), safeFilename);
      const fallbackPath = path.join(app.getPath('appData'), 'Kalem', 'assets', safeFilename);

      const targetPath = fs.existsSync(filePath) ? filePath : fs.existsSync(fallbackPath) ? fallbackPath : null;

      if (!targetPath) {
        return new Response('Not Found', { status: 404 });
      }

      return net.fetch(`file://${targetPath}`);
    } catch {
      return new Response('Error', { status: 500 });
    }
  };

  protocol.handle('vtext-asset', handleAsset);
  protocol.handle('kalem-asset', handleAsset);
}

export async function saveAssetImage(dataUrl: string): Promise<{ assetUrl: string; filePath: string }> {
  const assetsDir = getAssetsDir();
  const id = crypto.randomUUID();
  const filename = `${id}.png`;
  const filePath = path.join(assetsDir, filename);

  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  await fs.promises.writeFile(filePath, buffer);

  return {
    assetUrl: `kalem-asset://${filename}`,
    filePath
  };
}

export async function showOpenFilePicker(browserWindow: BrowserWindow): Promise<FileOpenResult> {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Belge Aç',
    properties: ['openFile'],
    filters: [
      { name: 'Tüm Desteklenen Belgeler', extensions: ['docx', 'md', 'txt', 'html', 'htm', 'odt', 'rtf', 'doc'] },
      { name: 'Word Belgeleri (*.docx)', extensions: ['docx'] },
      { name: 'Markdown (*.md)', extensions: ['md', 'markdown'] },
      { name: 'Metin Dosyaları (*.txt)', extensions: ['txt'] },
      { name: 'HTML Belgeleri (*.html)', extensions: ['html', 'htm'] },
      { name: 'Diğer Formatlar (*.odt, *.rtf, *.doc)', extensions: ['odt', 'rtf', 'doc'] },
      { name: 'Tüm Dosyalar', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }

  const targetPath = result.filePaths[0];
  return openFileByPath(targetPath);
}

export async function openFileByPath(filePath: string): Promise<FileOpenResult> {
  try {
    const ext = path.extname(filePath).toLowerCase().replace('.', '') as DocumentFormat;
    const title = path.basename(filePath);

    // 1. Markdown, TXT, HTML
    if (ext === 'md' || ext === 'txt' || ext === 'html') {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return {
        success: true,
        filePath,
        title,
        content,
        format: ext
      };
    }

    // 2. DOCX (mammoth)
    if (ext === 'docx') {
      const buffer = await fs.promises.readFile(filePath);
      const mammothResult = await mammoth.convertToHtml({ buffer });
      return {
        success: true,
        filePath,
        title,
        content: mammothResult.value, // HTML format for TipTap
        format: 'docx',
        warning: mammothResult.messages.length > 0 ? mammothResult.messages.map(m => m.message).join('\n') : undefined
      };
    }

    // 3. ODT, RTF, DOC (Pandoc / LibreOffice)
    if (ext === 'odt' || ext === 'rtf' || ext === 'doc') {
      const converted = await convertWithPandocOrLibreOffice(filePath, 'docx');
      if (converted.success && converted.outputPath) {
        const buffer = await fs.promises.readFile(converted.outputPath);
        const mammothResult = await mammoth.convertToHtml({ buffer });
        return {
          success: true,
          filePath,
          title,
          content: mammothResult.value,
          format: ext
        };
      } else {
        return {
          success: false,
          error: converted.error || `${ext.toUpperCase()} formatını dönüştürmek için sisteminizde Pandoc veya LibreOffice bulunamadı.`
        };
      }
    }

    // Fallback: try reading as UTF-8
    const rawContent = await fs.promises.readFile(filePath, 'utf8');
    return {
      success: true,
      filePath,
      title,
      content: rawContent,
      format: ext
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Dosya açılırken bir hata oluştu.'
    };
  }
}

export async function showSaveFilePicker(
  browserWindow: BrowserWindow,
  defaultTitle: string,
  preferredFormat: DocumentFormat = 'docx'
): Promise<string | null> {
  const filterMap: Record<DocumentFormat, { name: string; extensions: string[] }> = {
    docx: { name: 'Word Belgesi (*.docx)', extensions: ['docx'] },
    md: { name: 'Markdown (*.md)', extensions: ['md'] },
    pdf: { name: 'PDF Belgesi (*.pdf)', extensions: ['pdf'] },
    html: { name: 'HTML Belgesi (*.html)', extensions: ['html'] },
    txt: { name: 'Metin Dosyası (*.txt)', extensions: ['txt'] },
    odt: { name: 'OpenDocument Metni (*.odt)', extensions: ['odt'] },
    rtf: { name: 'Zengin Metin (*.rtf)', extensions: ['rtf'] },
    doc: { name: 'Word 97-2003 (*.doc)', extensions: ['doc'] }
  };

  const activeFilter = filterMap[preferredFormat] || filterMap.docx;

  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Belgeyi Kaydet',
    defaultPath: defaultTitle.endsWith(`.${preferredFormat}`) ? defaultTitle : `${defaultTitle}.${preferredFormat}`,
    filters: [
      activeFilter,
      filterMap.docx,
      filterMap.md,
      filterMap.html,
      filterMap.txt
    ]
  });

  return result.canceled ? null : result.filePath;
}

export async function saveFile(
  filePath: string,
  content: string | Buffer
): Promise<FileSaveResult> {
  try {
    await fs.promises.writeFile(filePath, content);
    return { success: true, filePath };
  } catch (err: any) {
    return { success: false, error: err.message || 'Dosya kaydedilemedi.' };
  }
}
